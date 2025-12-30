# 🧠 Módulo Registros

O módulo **Registros** atua como o **"Segundo Cérebro"** do usuário no Bússola V2. Ele unifica a gestão de conhecimento (Anotações/Wiki Pessoal) e a gestão de execução (Tarefas/To-Do List) em um único fluxo de produtividade.

> [!TIP]
> **Objetivo:** Capturar ideias rapidamente, organizar informações em contextos (Grupos), recuperar dados via busca instantânea e estruturar planos de ação complexos através de tarefas hierárquicas.

---

## 📂 Arquitetura e Arquivos

O módulo segue a arquitetura de **Camadas** padrão do sistema, com forte ênfase em recursividade para as tarefas e processamento no Frontend para a busca:

| Camada | Arquivo | Responsabilidade |
| :--- | :--- | :--- |
| **Controller** | `app/api/endpoints/registros.py` | Rotas de API, validação de payload e tratamento de erros HTTP. |
| **Service** | `app/services/registros.py` | **Lógica Complexa.** Gerencia a recursividade de subtarefas e regras de grupos. |
| **Model** | `app/models/registros.py` | Tabelas `anotacao`, `grupo`, `tarefa` e `subtarefa` (Auto-relacionamento). |
| **Frontend** | `src/pages/Registros/index.jsx` | Lógica de UI, filtros locais, busca textual e gerenciamento de modais. |
| **Estilos** | `src/pages/Registros/styles.css` | Design System específico do módulo (Cards, Accordions, Modais). |

---

## 🧠 Lógica de Negócio e Funcionalidades

### 1. Busca Textual Inteligente (Client-Side)

Para garantir velocidade instantânea na recuperação de informações, o módulo implementa um motor de busca local no Frontend.

* **Filtro Híbrido:** A busca varre tanto o **Título** quanto o **Conteúdo** das anotações.
* **Sanitização de HTML:** Como as notas são salvas em *Rich Text* (HTML), o algoritmo de busca remove automaticamente todas as tags (`<p>`, `<strong>`, etc.) antes de comparar os termos. Isso impede que uma busca por "div" retorne todas as notas do sistema, focando apenas no texto legível pelo humano.
* **Escopo Global:** A busca ignora o filtro de grupos visual, varrendo todas as notas carregadas (incluindo fixadas) para garantir que nada seja perdido.

### 2. Gestão de Tarefas Recursivas (Árvore de Execução)

Diferente de listas "To-Do" simples, o Bússola V2 implementa uma estrutura de **Árvore de Subtarefas**. Uma tarefa pode ter subtarefas, que por sua vez podem ter outras subtarefas, infinitamente.

#### A. Criação e Edição Recursiva
O Backend é capaz de receber um JSON aninhado e persisti-lo no banco relacional mantendo a hierarquia.

```python
# Trecho de: app/services/registros.py -> _create_subtarefas_recursivo

def _create_subtarefas_recursivo(self, db, lista_subs, tarefa_id, parent_id=None):
    for sub_data in lista_subs:
        nova_sub = Subtarefa(..., parent_id=parent_id)
        db.add(nova_sub)
        db.flush() # Gera o ID imediatamente para usar como parent dos filhos
        
        if sub_data.subtarefas:
            # Chama a si mesma para criar os filhos deste nó
            self._create_subtarefas_recursivo(db, sub_data.subtarefas, tarefa_id, nova_sub.id)
```

#### B. Estratégia de Atualização "Destrutiva" (Simplificação de Estado)
Ao editar uma tarefa complexa, a sincronização de "mover nós", "deletar nós" e "criar nós" seria extremamente custosa e propensa a erros. O sistema adota uma estratégia robusta:

> [!NOTE]
> **Snapshot Update:** Ao salvar a edição de uma tarefa, o sistema **apaga todas as subtarefas antigas** e recria a árvore inteira baseada no novo payload enviado pelo Frontend. Isso garante que o banco sempre reflita exatamente o que o usuário está vendo na tela, sem "lixo" de dados órfãos.

---

### 3. Gestão de Conhecimento (Anotações)

As anotações funcionam como um *Wiki Pessoal*, suportando edição de texto rico (HTML via React Quill) e anexos de links.

#### A. Organização por Grupos (Pastas)
O usuário pode criar grupos coloridos (ex: "Trabalho" em Vermelho, "Pessoal" em Azul).
* **Safe Delete de Grupos:** Se o usuário excluir um Grupo (pasta), as anotações dentro dele **NÃO** são apagadas. Elas apenas perdem o vínculo e vão para um estado "Sem Grupo/Indefinido". Isso previne perda acidental de conhecimento.

#### B. Fixação (Pin)
Notas importantes podem ser fixadas. O endpoint de Dashboard (`GET /`) já retorna essas notas em uma lista separada (`anotacoes_fixadas`) para que o Frontend as renderize com destaque no topo.

---

### 4. Dashboard e Inteligência de Dados

O serviço de registros não apenas lista dados, ele os organiza temporalmente e por prioridade para o Dashboard.

* **Agrupamento Temporal:** As notas soltas são agrupadas por Mês/Ano (ex: "Janeiro 2025") para criar uma timeline de conhecimento.
* **Ordenação por Prioridade:** As tarefas não são listadas aleatoriamente. O SQL utiliza uma cláusula `CASE` para forçar a ordem: `Crítica > Alta > Média > Baixa`, seguida pelo `Prazo` mais próximo.

```python
# Trecho de: app/services/registros.py -> get_dashboard_data

ordenacao_prioridade = case(
    (Tarefa.prioridade == 'Crítica', 1),
    (Tarefa.prioridade == 'Alta', 2),
    (Tarefa.prioridade == 'Média', 3),
    (Tarefa.prioridade == 'Baixa', 4),
    else_=5
)
# Order by: Prioridade -> Prazo -> ID
```

---

## 🎨 UX, UI e Design System

O design do módulo foi refinado para oferecer clareza visual e feedback tátil, utilizando uma paleta de cores moderna e sombras progressivas.

### A. Cards de Anotação (Caderno)
* **Visualização Compacta:** Os cards exibem um resumo do conteúdo com `overflow hidden` e `text-overflow ellipsis` para manter a grade alinhada.
* **Identidade do Grupo:** Cada card possui uma borda lateral grossa (`border-left: 6px`) na cor do grupo ao qual pertence, permitindo identificação visual rápida (scanning) sem ler o nome do grupo.
* **Feedback de Hover:** Ao passar o mouse, o card eleva-se levemente (`translateY(-4px)`) e a sombra se intensifica, convidando ao clique.
* **Ações Contextuais:** Botões de fixar e links externos aparecem ou mudam de cor dinamicamente para reduzir poluição visual quando não estão em foco.

### B. Cards de Tarefa (Execução)
* **Indicadores de Prioridade:** Badges coloridas (Crítica/Vermelho, Alta/Laranja, Média/Azul, Baixa/Verde) com fundo translúcido para rápida triagem.
* **Alertas de Prazo:** O card detecta automaticamente datas passadas, alterando a cor da tag de prazo e a borda do card para vermelho, sinalizando urgência.
* **Barra de Progresso:** Uma barra visual calcula a % de conclusão baseada nos checkboxes das subtarefas filhas, oferecendo gratificação visual ao completar etapas.

### C. Navegação e Layout
* **Accordions Suaves:** Os grupos de anotações e a lista de tarefas concluídas utilizam accordions com animação de altura e opacidade para não sobrecarregar a tela com informações desnecessárias.
* **Headers Conectados:** O design utiliza cabeçalhos de coluna unificados visualmente com o corpo do conteúdo, criando uma sensação de "aplicativo desktop" robusto.
* **Modais Híbridos:** Modais utilizam `backdrop-filter: blur` para manter o foco no conteúdo editado, enquanto o resto da interface fica suavemente desfocado.

### D. Cascata de Conclusão (Smart Toggle)
Ao marcar um item "Pai" como concluído na árvore de subtarefas, o sistema entende a intenção do usuário e **marca automaticamente todos os filhos** como concluídos. O inverso também ocorre (desmarcar o pai desmarca os filhos).

---

## 📸 Prints do Design

A interface combina funcionalidade densa com respiro visual.

<div align="center">
  <img src="images/registros_1.png" alt="Visão Geral do Caderno e Tarefas" width="48%">
  <img src="images/registros_2.png" alt="Modal de Edição de Notas" width="48%">
  <img src="images/registros_3.png" alt="Modal de Edição de Notas" width="48%">
  <img src="images/registros_4.png" alt="Modal de Edição de Notas" width="48%">
</div>

---

## 📐 Estrutura de Dados (Models)

### `Tarefa` & `Subtarefa`
O coração da execução.
- **Subtarefa (Auto-relacionamento):** Possui um campo `parent_id` que aponta para a própria tabela, permitindo recursividade infinita.
- **Cascade Delete:** A configuração do banco garante que apagar uma Tarefa (Raiz) limpa automaticamente toda a sua árvore de descendentes.

### `Anotacao` & `GrupoAnotacao`
O coração do conhecimento.
- **conteudo**: Armazena HTML bruto gerado pelo editor.
- **fixado**: Booleano para destacar notas importantes.
- **grupo_id**: Chave estrangeira *Nullable*. Permite que a nota exista sem grupo.

---

## 🔌 API Endpoints

### Anotações
| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `POST` | `/anotacoes` | Cria nota com HTML e links opcionais. |
| `PUT` | `/anotacoes/{id}` | Edita conteúdo. Substitui lista de links inteira. |
| `PATCH`| `/anotacoes/{id}/toggle-fixar` | Alterna status de fixado (Pin). |
| `DELETE` | `/anotacoes/{id}` | Exclusão permanente. |

### Tarefas
| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `POST` | `/tarefas` | Cria tarefa raiz (aceita árvore de subtarefas no JSON). |
| `PUT` | `/tarefas/{id}` | Edita tarefa. **Recria** todas as subtarefas (Snapshot). |
| `PATCH`| `/tarefas/{id}/status` | Move tarefa entre colunas (Pendente / Concluído). |
| `PATCH`| `/subtarefas/{id}/toggle` | Marca check/uncheck com efeito cascata nos filhos. |

### Grupos
| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `POST` | `/grupos` | Cria nova pasta organizadora. |
| `DELETE` | `/grupos/{id}` | Deleta pasta e move notas para "Sem Grupo". |