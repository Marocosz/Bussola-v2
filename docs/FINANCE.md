# 💰 Módulo Finanças

O módulo **Finanças** é o motor contábil do **Bússola V2**. Ele não apenas registra gastos, mas projeta o futuro financeiro do usuário através de um sistema inteligente de recorrências e parcelamentos.

> [!TIP]
> **Objetivo:** Oferecer controle total sobre o Fluxo de Caixa, permitindo visão de passado (histórico), presente (saldo atual) e futuro (contas a pagar/receber geradas automaticamente).

---

## 📂 Arquitetura e Arquivos

O módulo segue a arquitetura de **Camadas (Layered Architecture)** para separar responsabilidades:

| Camada | Arquivo | Responsabilidade |
| :--- | :--- | :--- |
| **Controller** | `app/api/endpoints/financas.py` | Recebe requisições HTTP, valida sessões e chama os serviços. |
| **Service** | `app/services/financas.py` | **Core da Lógica.** Contém regras de recorrência, parcelamento e projeção. |
| **Model** | `app/models/financas.py` | Definição das tabelas `transacao`, `categoria` e `historico_gasto_mensal`. |
| **Schema** | `app/schemas/financas.py` | DTOs (Data Transfer Objects) e validação de dados (Pydantic). |

---

## 🧠 Lógica de Negócio e Funcionalidades

### 1. Sistema de Transações Híbrido

O sistema suporta três tipos de movimentações financeiras, cada uma com um comportamento lógico distinto no banco de dados:

#### A. Transação Pontual
Um registro simples, único e imutável no tempo (ex: "Um café", "Gasolina").

#### B. Parcelamento Inteligente (Smart Installments)
Ao criar uma compra parcelada (ex: "Notebook em 10x"), o sistema não cria apenas um registro. Ele **projeta e insere todas as parcelas futuras** imediatamente.

> [!IMPORTANT]
> **Algoritmo de Centavos:** O sistema trata dízimas financeiras automaticamente. Se uma compra de R$ 100,00 for dividida em 3x, o sistema não divide simplesmente por 3 (o que daria 33.333...). Ele ajusta a diferença na **primeira parcela**.

```python
# Trecho de: app/services/financas.py -> criar_transacao

valor_parcela_base = round(valor_total / qtd_parcelas, 2)
diferenca = round(valor_total - (valor_parcela_base * qtd_parcelas), 2)

for i in range(1, qtd_parcelas + 1):
    valor_desta = valor_parcela_base
    
    # A diferença de arredondamento é somada à primeira parcela
    if i == 1:
        valor_desta += diferenca
    
    # ... lógica de criação da transação ...
```
*Resultado:* Parcela 1 = R$ 33,34 | Parcela 2 = R$ 33,33 | Parcela 3 = R$ 33,33. Total = R$ 100,00.

#### C. Recorrência Infinita (Subscriptions)
Para contas fixas (Netflix, Aluguel, Salário), o sistema cria a primeira transação e marca com um `id_grupo_recorrencia`. O resto é gerenciado pelo **Worker de Projeção**.

---

### 2. Worker de Projeção Futura ("Catch-up")

O Bússola V2 possui um mecanismo passivo que verifica, toda vez que o dashboard é carregado, se existem contas recorrentes que "venceram" desde o último acesso.

> [!NOTE]
> Se o usuário não acessar o sistema por 3 meses, ao fazer login, o sistema identificará a lacuna temporal e gerará automaticamente as 3 mensalidades de "Netflix" pendentes para manter o saldo correto.

```python
# Trecho de: app/services/financas.py -> gerar_transacoes_futuras

# Se a última transação conhecida já passou (está no passado)
if ultima.data.date() <= today_date:
    
    # Loop de "Catch-up": Gera pendências até alcançar a data de hoje
    while proximo_vencimento.date() <= today_date:
        nova = Transacao(..., status='Pendente') # Cria como pendente
        db.add(nova)
        
        # Avança o tempo baseado na frequência (Semanal/Mensal/Anual)
        if frequencia == 'mensal': 
            proximo_vencimento += relativedelta(months=1)
```

---

### 3. Gestão de Categorias e "Safe Delete"

O sistema impede a perda de dados financeiros acidental. As categorias possuem regras estritas de integridade.

* **Categoria "Indefinida":** Cada usuário possui, obrigatoriamente, uma categoria de sistema chamada "Indefinida" (uma para Receita, outra para Despesa).
* **Safe Delete:** Ao tentar excluir uma categoria personalizada (ex: "Lazer"), o sistema verifica se há transações nela. Se houver, elas **não são apagadas**, mas sim movidas para "Indefinida".

```python
# Trecho de: app/api/endpoints/financas.py -> delete_categoria

# Se houver órfãos, move para a categoria de sistema
if transacoes:
    cat_destino = financas_service.get_or_create_indefinida(db, cat.tipo, current_user.id)
    
    for t in transacoes:
        t.categoria_id = cat_destino.id # Re-parenting
    
    db.commit()

# Só agora a categoria original é excluída
db.delete(cat)
```

> [!WARNING]
> **Concorrência (Race Condition):** A criação da categoria "Indefinida" é protegida por um bloco `try/except IntegrityError` para evitar que duas requisições simultâneas tentem criar a mesma categoria de sistema, o que causaria erro 500 no banco.

---

### 4. Dashboard e Agregação

O endpoint `GET /` do módulo financeiro não retorna apenas linhas de banco de dados. Ele retorna uma **ViewModel** completa pronta para gráficos.

1.  **Separação Temporal:** As transações são agrupadas em dicionários por Mês/Ano (ex: `"Janeiro/2025": [...]`) para facilitar a renderização de listas no Frontend.
2.  **Cálculo On-the-fly:**
    * `total_mes`: Soma apenas transações dentro do mês vigente.
    * `total_historico`: Soma todo o histórico da categoria.
    * `media_valor`: Ticket médio de gasto naquela categoria.

---

## 📐 Estrutura de Dados (Models)

### `Transacao`
A unidade atômica financeira.
- **id_grupo_recorrencia** (Indexado): O elo que une parcelas ou recorrências. Permite editar/excluir todas as parcelas de uma compra de uma só vez.
- **status**: `Pendente` (padrão para futuras) ou `Efetivada`.
- **data**: Usa `datetime` com timezone UTC.

### `Categoria`
Agrupador lógico.
- **tipo**: `receita` ou `despesa`. Define se o valor soma ou subtrai no cálculo global.
- **user_id**: Garante isolamento total dos dados (Multi-tenancy).

---

## 🔌 API Endpoints

### Transações
| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `POST` | `/transacoes` | Cria transação. Se parcelada, cria N registros. |
| `PUT` | `/transacoes/{id}` | Edita uma transação específica. |
| `PUT` | `/transacoes/{id}/toggle-status` | Alterna entre Pendente/Efetivada (Quick Action). |
| `DELETE` | `/transacoes/{id}` | Deleta. Se for recorrente, deleta o grupo todo. |

### Categorias
| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `POST` | `/categorias` | Cria categoria (valida unicidade de nome). |
| `PUT` | `/categorias/{id}` | Edita cor, ícone ou nome. |
| `DELETE` | `/categorias/{id}` | Deleta e move transações para "Indefinida". |

### Dashboard
| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `GET` | `/` | Retorna JSON complexo com totais, listas agrupadas e metadados. |