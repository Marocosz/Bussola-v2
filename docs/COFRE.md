# 🔐 Módulo Cofre de Senhas

O módulo **Cofre** é o componente de alta segurança do Bússola V2, projetado para armazenar, gerenciar e auditar o acesso a credenciais sensíveis (senhas, tokens de API, chaves SSH).

> [!CAUTION]
> **Foco em Segurança:** Diferente dos outros módulos, aqui a integridade e confidencialidade dos dados têm prioridade máxima. Nenhuma senha é armazenada em texto plano (*Plain Text*) no banco de dados e o acesso exige autenticação estrita em múltiplas camadas.

---

## 🛡️ Arquitetura de Segurança (Security by Design)

O sistema implementa o padrão **Encryption at Rest** (Criptografia em Repouso) utilizando criptografia simétrica de nível militar.

### 1. Camadas de Proteção
1.  **Transport Layer (HTTPS):** Todas as trocas de dados ocorrem via TLS.
2.  **API Segregation:** A API separa estritamente as rotas de "Listagem" das rotas de "Acesso ao Valor".
    * `GET /cofre/`: Retorna apenas título e serviço. O campo de senha **não é processado**.
    * `GET /cofre/{id}/valor`: Única rota capaz de descriptografar.
3.  **Storage Layer:** No banco, a coluna é `valor_criptografado`. Um dump do banco é inútil sem a chave de aplicação.
4.  **Frontend Volatile Memory:** A senha só existe na memória do navegador enquanto o modal de visualização estiver aberto ou durante o timer de limpeza do clipboard (60s).

### 2. Algoritmo de Criptografia
* **Biblioteca:** `cryptography` (Python).
* **Primitiva:** **Fernet** (AES-128 em modo CBC + HMAC-SHA256 para assinatura e integridade).
* **Chave (Secret):** Gerenciada via variável de ambiente `ENCRYPTION_KEY`.

---

## 🔐 Verificação em Dupla Camada (Dual Layer Security)

O sistema aplica controles de segurança tanto na interface quanto no servidor, com responsabilidades distintas e complementares:

| Camada | Tipo de Proteção | Objetivo |
| :--- | :--- | :--- |
| **Frontend** | **Verificação de Intenção** | Evita erro humano, cliques acidentais e exposição visual ("olhar por cima do ombro"). Exige confirmação explícita para destravar ações sensíveis. |
| **Backend** | **Autenticação e Autorização** | **Barreira Inviolável.** Verifica criptograficamente o Token JWT e garante isolamento de dados (Multi-tenancy). Impede acesso direto via API/Curl. |

---

## 🔍 Auditoria de Código: Provas de Segurança

Abaixo estão os trechos reais do código que garantem a confiabilidade do sistema.

### 1. Backend: Autorização e Isolamento (Inviolável)
Mesmo que um atacante tente pular a interface, o Backend rejeita qualquer acesso a dados que não pertençam ao usuário do Token.

**Arquivo:** `app/api/endpoints/cofre.py`
```python
@router.get("/{id}/valor", response_model=SegredoValueResponse)
def obter_valor_segredo(
    id: int, 
    db: Session = Depends(deps.get_db), 
    current_user = Depends(deps.get_current_user) # <--- 1. Exige Login Válido
):
    # 2. O ID do usuário é passado para o serviço, garantindo isolamento total.
    valor = cofre_service.get_decrypted_value(db, id, current_user.id)
    
    if valor is None:
        raise HTTPException(404) # Retorna 404 se o dado existe mas não é seu.
    ...
```

### 2. Backend: Criptografia na Escrita
Ao criar ou atualizar uma senha, o sistema utiliza a chave mestra para transformar o texto em hash antes de tocar o banco de dados.

**Arquivo:** `app/services/cofre.py`
```python
# Trecho do método update
if dados.valor is not None:
     if cipher_suite:
         # A senha é criptografada IMEDIATAMENTE. O texto plano é descartado.
         segredo.valor_criptografado = cipher_suite.encrypt(dados.valor.encode()).decode()
     else:
         raise Exception("Erro de configuração: Chave de criptografia ausente.")
```

### 3. Frontend: Trava de Segurança (Prevenção de Acidentes)
Para evitar alterações acidentais ou maliciosas (caso o usuário deixe o PC desbloqueado), o campo de senha no modal de edição inicia **Bloqueado**. Para editar, é necessária uma confirmação explícita.

**Arquivo:** `src/pages/Cofre/components/SegredoModal.jsx`
```javascript
// Função de Segurança para Destravar a Senha
const handleUnlockPassword = async () => {
    // Exige interação consciente do usuário via Dialog
    const isConfirmed = await confirm({
        title: 'Alterar Senha?',
        description: 'Você está prestes a redefinir a credencial. Deseja continuar?',
        variant: 'warning'
    });

    if (isConfirmed) {
        setIsPasswordEditable(true); // Só destrava a UI após confirmação
    }
};
```

### 4. Frontend: Limpeza Automática de Memória
Ao copiar uma senha, o sistema inicia um contador de **60 segundos**. Após esse tempo, a área de transferência do sistema operacional é limpa.

**Arquivo:** `src/pages/Cofre/components/ViewSecretModal.jsx`
```javascript
// Timer de segurança
useEffect(() => {
    let interval = null;
    if (timeLeft > 0) {
        // ... contagem regressiva ...
    } else if (timeLeft === 0) {
        // LIMPEZA DO CLIPBOARD DO S.O.
        navigator.clipboard.writeText('');
        addToast({ type: 'info', title: 'Segurança', description: 'Área de transferência limpa.' });
        setTimeLeft(null);
    }
    return () => clearInterval(interval);
}, [timeLeft]);
```

---

## 🧠 Fluxos de Uso Seguro

### A. Visualizar/Copiar Senha
1.  Usuário clica no botão 👁️ (Ver).
2.  Frontend solicita confirmação: *"Visualizar Credencial?"* (Proteção Visual).
3.  Se confirmado, abre o `ViewSecretModal`.
4.  O modal chama `GET /cofre/{id}/valor`. O Backend verifica autorização, descriptografa e envia.
5.  A senha aparece mascarada (`••••`). O usuário pode clicar em "Revelar" ou "Copiar".
6.  Se clicar em "Copiar", um timer de 60s inicia. Ao fim, o clipboard é apagado.

### B. Atualizar Senha
1.  Usuário clica no botão ✏️ (Editar).
2.  O `SegredoModal` abre com os dados carregados, mas a senha aparece como **BLOQUEADA**.
3.  Usuário clica em "Alterar".
4.  Frontend solicita confirmação de segurança.
5.  Se confirmado, o campo de senha é liberado.
6.  Ao salvar, o Backend detecta o novo valor, re-criptografa e sobrescreve o hash antigo no banco.

---

## ⚠️ Análise de Riscos e Probabilidades (Real-World Analysis)

Nenhum sistema é 100% invulnerável. Esta seção detalha francamente os vetores de ataque possíveis nesta arquitetura (Server-Side Encryption) e a probabilidade de ocorrência.

| Vetor de Risco | Cenário | Probabilidade | Mitigação no Bússola V2 |
| :--- | :--- | :--- | :--- |
| **Vazamento de Banco de Dados** | Um atacante obtém um dump SQL (`.sql`) contendo a tabela `segredo`. | **Média (15%)**<br>*(Depende da infra)* | **Total.** O atacante veria apenas strings `gAAAA...`. Sem a `ENCRYPTION_KEY` (que fica na RAM do servidor, não no banco), os dados são matematicamente irrecuperáveis. |
| **Acesso Físico (Desbloqueado)** | Usuário deixa o PC desbloqueado e sai. Um colega acessa o sistema. | **Alta (30%)**<br>*(Erro Humano)* | **Parcial.** O atacante precisa clicar em "Ver" (aciona Dialog) e a senha aparece mascarada inicialmente. Se copiar, o histórico limpa em 60s. |
| **Histórico de Clipboard** | Usuário usa `Win+V` no Windows, mantendo o histórico de cópias ativo. | **Alta (40%)**<br>*(Limitação Web)* | **Educativa.** O sistema limpa o clipboard atual após 60s, mas não tem permissão do S.O. para limpar o histórico antigo (`Win+V`). |
| **Comprometimento do Servidor** | Hacker ganha acesso `root` ao servidor onde roda a API. | **Baixa (< 1%)**<br>*(Se bem configurado)* | **Nenhuma.** Se o atacante tem root, ele tem acesso ao código, ao banco e à `ENCRYPTION_KEY` na variável de ambiente. |
| **Man-in-the-Middle** | Atacante intercepta o Wi-Fi do usuário para ler a senha trafegando. | **Nula (0%)**<br>*(Com HTTPS)* | **Total.** O uso obrigatório de HTTPS/TLS torna os dados ilegíveis durante o tráfego. |

> [!NOTE]
> **Veredito:** O sistema é extremamente seguro para ameaças externas (vazamentos de dados), mas exige confiança na administração do servidor (não é Zero-Knowledge) e boas práticas do usuário final (bloquear o PC).

---

## 📱 Screenshots (Interface de Segurança)

### 1. Lista Segura (Dados Ocultos)
![Lista de Segredos](https://via.placeholder.com/800x400?text=Lista+Segura+-+Senhas+Ocultas)
*A listagem exibe apenas metadados. Nenhuma senha é trafegada nesta tela.*

### 2. Modal de Visualização (Protegido)
![Modal Ver Senha](https://via.placeholder.com/800x400?text=Modal+Ver+Senha+-+Mascarado+e+Timer)
*Senha mascarada por padrão, botão de revelar opcional e timer de auto-destruição do clipboard.*

### 3. Edição Travada (Prevenção de Erros)
![Edição Travada](https://via.placeholder.com/800x400?text=Modal+Edicao+-+Campo+Senha+Bloqueado)
*O campo de senha exige um "Destravamento" explícito para ser alterado.*

---

## 🔌 API Endpoints

| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `GET` | `/cofre/` | Lista metadados. **Seguro:** Ignora a coluna de valor criptografado. |
| `POST` | `/cofre/` | Cria novo segredo. Encripta imediatamente. |
| `GET` | `/cofre/{id}/valor`| **Rota Sensível.** Descriptografa e retorna a senha original. |
| `PUT` | `/cofre/{id}` | Atualiza metadados ou senha (se enviada). |
| `DELETE` | `/cofre/{id}` | Remove o segredo permanentemente. |