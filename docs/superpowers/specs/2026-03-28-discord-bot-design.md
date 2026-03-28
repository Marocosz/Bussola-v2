# Discord Bot — Design Spec
**Data:** 2026-03-28
**Escopo atual:** Estrutura base + vinculação de conta

---

## Visão Geral

O Bússola Bot é uma segunda interface do backend — funciona como um client HTTP que consome a `bussola_api` usando um `SERVICE_TOKEN` dedicado. O usuário interage via slash commands no DM do Discord; o bot traduz esses comandos em chamadas autenticadas à API.

**Arquitetura:**
```
Discord User → Bot (discord.py) → HTTP (SERVICE_TOKEN) → bussola_api → DB
```

O bot nunca acessa o banco diretamente. A API é a única porta de entrada para os dados.

---

## Escopo desta Fase

1. Estrutura de pastas do `bussola_bot/`
2. Fluxo de vinculação de conta (Discord ↔ Bussola) via OAuth-style one-time token
3. Mensagem de boas-vindas ao instalar o bot
4. Mensagem de confirmação pós-vinculação

---

## Estrutura de Pastas

```
bussola_bot/
├── main.py                  # Entry point — inicia o bot
├── requirements.txt         # discord.py, httpx, python-dotenv
├── .env.example
│
└── bot/
    ├── client.py            # Instância do Bot e carregamento dos cogs
    ├── api_client.py        # Wrapper HTTP para bussola_api (httpx)
    │
    └── cogs/
        ├── auth.py          # /link, /desvincular, on_message (boas-vindas)
        ├── financas.py      # (placeholder — fase futura)
        ├── agenda.py        # (placeholder — fase futura)
        ├── registros.py     # (placeholder — fase futura)
        ├── ritmo.py         # (placeholder — fase futura)
        └── configuracoes.py # (placeholder — fase futura)
```

---

## Fluxo de Vinculação

```
1. Usuário instala o bot (User Install) ou inicia DM
2. Bot detecta primeiro contato → envia mensagem de boas-vindas com botão "Vincular Conta"
3. Usuário clica no botão
4. Bot chama POST /api/v1/bot/auth/link-token { discord_id }
5. API gera UUID, salva { token, discord_id, expires_at: +10min } na tabela discord_link_tokens
6. API retorna { token }
7. Bot envia DM com link: <FRONTEND_URL>/discord/link?token=<uuid>
8. Usuário abre o browser, faz login no Bussola (se não estiver logado)
9. Frontend chama POST /api/v1/discord/link/confirm { token }
10. API valida: token existe? não expirou? não foi usado?
11. API vincula: User.discord_id = discord_id do token
12. API marca token como used=True
13. Bot fica em polling: GET /api/v1/bot/auth/link-status?discord_id=<id> (a cada 3s, timeout 10min)
14. Quando vinculado, bot envia DM de confirmação
```

---

## Segurança

### Camada 1 — Bot → API
- Header `X-Bot-Service-Token: <segredo>` em toda request
- Endpoints `/api/v1/bot/...` rejeitam qualquer request sem o token válido (401)
- Token rotacionável via `.env` sem redeploy

### Camada 2 — Vinculação
- One-time token: UUID v4, expira em 10 minutos, invalidado após uso
- Nenhuma credencial trafega pelo Discord
- Token válido só para o `discord_id` que gerou

### Camada 3 — Identidade por comando
- Todo endpoint `/bot/` recebe `discord_id`
- API resolve `discord_id → user_id` via `Depends(get_bot_user)`
- Verifica `user.is_active` antes de processar
- Todos os queries filtram por `user_id` — isolamento total entre usuários

### Dados bloqueados no Discord
- Cofre de senhas: nunca exposto via bot

---

## Mudanças na bussola_api

### Novo modelo: `DiscordLinkToken`
```python
class DiscordLinkToken(Base):
    __tablename__ = "discord_link_tokens"
    id         = Column(Integer, primary_key=True)
    token      = Column(String, unique=True, index=True)  # UUID
    discord_id = Column(String, nullable=False)
    expires_at = Column(DateTime(timezone=True))
    used       = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

### Novos endpoints

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/api/v1/bot/auth/link-token` | SERVICE_TOKEN | Gera one-time token |
| GET | `/api/v1/bot/auth/link-status` | SERVICE_TOKEN | Verifica se discord_id foi vinculado |
| POST | `/api/v1/discord/link/confirm` | JWT (usuário logado) | Confirma vinculação via frontend |

### Novo Depends
```python
async def get_bot_user(discord_id: str, token: str = Header(..., alias="X-Bot-Service-Token"), db) -> User
```

### Novo campo em Settings
```
BOT_SERVICE_TOKEN: str  # segredo compartilhado entre bot e API
```

---

## Mensagens do Bot

### Boas-vindas (primeiro contato)
```
Olá! Sou o Bússola Bot 🧭

Sou a interface do Bússola direto no seu Discord —
consulte seus dados, registre informações e receba
notificações sem sair do Discord.

Para começar, vincule sua conta Bússola:
[Vincular Conta] ← botão
```

### Pós-vinculação
```
✅ Conta vinculada com sucesso!

Você já pode usar todos os comandos.
Digite /ajuda para ver o que está disponível.
```

---

## Variáveis de Ambiente

### bussola_bot/.env
```
DISCORD_BOT_TOKEN=
BOT_SERVICE_TOKEN=     # mesmo valor que na API
API_BASE_URL=http://localhost:8000
```

### bussola_api/.env (adicionais)
```
BOT_SERVICE_TOKEN=     # segredo compartilhado
```

---

## Fases Futuras (fora deste escopo)

- Cogs de comandos por módulo (financas, agenda, registros, ritmo)
- Sistema de notificações com APScheduler
- Comando `/notificacoes` para configurar preferências
- Integração com frontend para toggle de notificações
