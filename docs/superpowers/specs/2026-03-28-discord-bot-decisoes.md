# Discord Bot — Decisões de Sessão
**Data:** 2026-03-28

Registro das discussões, decisões arquiteturais e raciocínios da sessão de design do bot.

---

## Tipo de instalação

**Decisão: User Install + Guild Install (ambos habilitados)**

- User Install permite que o bot funcione via DM sem precisar de um servidor
- Guild Install mantém a opção para quem quiser usar em servidor próprio
- A interação principal é via **DM** — mais privado, sem fricção de criar servidor

**Descartado:**
- Servidor comunitário com canais privados por usuário — complexo de gerenciar permissões, cria centenas de canais
- Apenas Guild Install — obrigaria o usuário a ter um servidor Discord

---

## Notificações via DM

**Decisão: Notificações proativas via DM são viáveis**

O bot consegue abrir DM e enviar mensagens proativamente desde que o usuário tenha iniciado conversa pelo menos uma vez. Com User Install, o usuário instala o bot diretamente — isso libera o DM automaticamente, contornando a restrição de privacidade do Discord.

**Módulos planejados:**
- Finanças — alerta de limite de gastos, resumo diário/semanal
- Agenda — lembrete de compromisso X minutos antes
- Registros — tarefas com prazo próximo
- Ritmo — lembrete de registrar refeição, meta de treino

**Controle pelo usuário:** cada categoria de notificação é ativada/desativada individualmente, tanto via `/notificacoes` no Discord quanto pelo frontend em "Minha Conta → Notificações Discord".

**Armazenamento das preferências:**
```python
notification_discord = Column(JSON, default={
    "agenda":    { "ativo": False, "minutos_antes": 30 },
    "financas":  { "ativo": False, "alerta_limite": True, "resumo_semanal": True },
    "registros": { "ativo": False, "horas_antes_prazo": 24 },
    "ritmo":     { "ativo": False, "lembrete_refeicao": True, "lembrete_treino": True }
})
```

**Arquitetura das notificações (fase futura):**
```
APScheduler roda jobs paralelos ao loop do Discord:
  ├── agenda_lembretes      → a cada 5 min
  ├── financas_alertas      → a cada hora
  ├── financas_resumo       → todo domingo 20h
  ├── registros_prazos      → todo dia 8h
  └── ritmo_lembretes       → conforme config do usuário

Cada job:
  → Bot chama GET /api/v1/bot/notificacoes/<modulo>
  → API retorna lista de { discord_id, mensagem } para usuários que devem ser notificados
  → Bot envia DM para cada discord_id
```

A API decide **quem** notificar e **o quê**. O bot só entrega.

---

## Arquitetura: Bot como client HTTP

**Decisão: Bot separado que consome a API via HTTP com SERVICE_TOKEN**

### Opções consideradas

**Opção A — Bot chama a API via HTTP** ✅ Escolhida
```
bussola_bot/ → HTTP (SERVICE_TOKEN) → bussola_api/
```

**Opção B — Bot integrado ao FastAPI (mesmo processo)**
Descartada: acoplamento total, crash do bot derruba a API.

**Opção C — Bot com acesso direto ao DB (SQLAlchemy)**
Descartada para SaaS: bypassa toda a lógica de negócio, validações e middlewares da API. Funciona para self-hosted, mas cria dívida técnica.

### Por que a Opção A para SaaS

Em SaaS, a API é a única porta de entrada para os dados. Frontend, bot, integrações externas — todos passam pela API. Isso garante:
- Toda validação e regra de negócio centralizada na API
- Rate limiting e auditoria aplicados uniformemente
- O bot não precisa saber nada sobre o DB — é um client thin
- Troca de banco (SQLite → PostgreSQL), escala horizontal da API: o bot não muda nada

**Nota sobre múltiplas instâncias:** o Discord bot é sempre um único processo — não escala horizontalmente. A questão de múltiplas instâncias se aplica à API, não ao bot.

---

## Segurança — Decisões e Raciocínio

### SERVICE_TOKEN

O bot autentica com a API via um segredo compartilhado enviado no header:
```
X-Bot-Service-Token: <segredo>
```

Todos os endpoints `/api/v1/bot/...` rejeitam requests sem esse token (401). Token comprometido: rotaciona no `.env`, zero código alterado.

### Identidade do usuário por comando

**Como o bot sabe de qual usuário buscar os dados?**

O `discord_id` é extraído pelo bot do evento Discord (não é input do usuário — o usuário não injeta esse valor). O bot envia o `discord_id` junto com o SERVICE_TOKEN. A API resolve:

```
discord_id → SELECT user WHERE discord_id = X → user.id
```

Todos os queries já filtram por `user_id` (mesmo mecanismo do JWT do frontend). Isolamento entre usuários é garantido pelo sistema existente — sem lógica extra.

**Depends reutilizável:**
```python
async def get_bot_user(discord_id, token, db) -> User:
    if token != settings.BOT_SERVICE_TOKEN: raise 401
    user = db.query(User).filter(User.discord_id == discord_id).first()
    if not user or not user.is_active: raise 403
    return user
```

### Proteção por camadas

| Camada | Ameaça | Defesa |
|--------|--------|--------|
| Bot → API | Chamada externa sem token | SERVICE_TOKEN obrigatório → 401 |
| Identidade | Bot tenta acessar dados de outro usuário | discord_id lookup no DB — só acessa quem está vinculado |
| Spoofing | Usuário injeta discord_id falso | discord_id vem do evento Discord, não do input do usuário |
| Token vazado | SERVICE_TOKEN comprometido | Rotaciona no .env sem redeploy |
| Produção SaaS | Chamadas de IPs desconhecidos | IP allowlist — API só aceita do IP do servidor do bot |

### Dados bloqueados no Discord

**Cofre de senhas — completamente bloqueado.** Senhas nunca trafegam via Discord. O cog `cofre` não existe no bot.

### Rate limiting (duplo)

- Discord limita nativamente por usuário
- API tem rate limit por SERVICE_TOKEN via slowapi
- Bot aplica throttle simples por discord_id para evitar spam de comandos

### Auditoria

Todo comando registra: `discord_id | user_id | comando | timestamp | sucesso/falha`

---

## Vinculação de conta — Decisão de fluxo

**Decisão: OAuth-style com one-time token**

### Opções consideradas

**A) Código gerado no frontend, digitado no Discord** (`/link ABC123`)
**B) Credenciais diretas no Discord** (`/link email senha`) — descartada imediatamente, expõe credenciais no chat
**C) One-time token via link no browser** ✅ Escolhida

### Fluxo escolhido

```
/link no Discord
  → API gera UUID, salva com discord_id + expires_at (10min)
  → Bot envia link seguro no DM
  → Usuário abre browser, faz login no Bussola
  → Frontend chama API com o token
  → API valida e vincula discord_id ao user
  → Token invalidado (used=True)
  → Bot detecta vinculação e envia confirmação
```

**Por que é seguro:**
- Token de uso único — não pode ser reutilizado
- Expira em 10 minutos
- Nenhuma credencial trafega pelo Discord
- Token válido só para o discord_id que gerou — não pode ser usado por outra pessoa

---

## Escopo definido para implementação imediata

1. Estrutura de pastas do `bussola_bot/`
2. Fluxo completo de vinculação (bot + API + frontend)
3. Mensagem de boas-vindas ao instalar
4. Mensagem de confirmação pós-vinculação

**Fora do escopo desta fase:**
- Comandos por módulo (financas, agenda, registros, ritmo)
- Sistema de notificações com APScheduler
- Configuração de preferências de notificação
