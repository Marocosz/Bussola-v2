# Bússola Bot — Discord

O Bússola Bot é a interface do Bússola direto no Discord. Você pode consultar dados, registrar informações e receber notificações sem abrir o app.

---

## Como começar

### 1. Adicionar o bot à sua conta

Acesse o link de instalação e clique em **"Autorizar"**:

```
https://discord.com/oauth2/authorize?client_id=1487509947880177775
```

Selecione **"Adicionar à minha conta"** (User Install) — o bot funcionará nos seus DMs, sem precisar de um servidor.

---

### 2. Iniciar conversa com o bot

Após autorizar, abra o Discord e acesse o bot nos seus **Apps** (menu lateral) ou procure por **Bússola** nos seus DMs.

O bot enviará automaticamente uma mensagem de boas-vindas com o botão **"Vincular Conta"**.

---

### 3. Vincular sua conta Bússola

Clique em **"Vincular Conta"** — o bot enviará um link seguro com validade de **10 minutos**.

Acesse o link, faça login no Bússola (se ainda não estiver logado) e confirme a vinculação. O bot avisará no Discord assim que a vinculação for concluída.

> O link é de uso único e expira em 10 minutos. Se expirar, use `/link` para gerar um novo.

---

### 4. Pronto

Após vincular, você tem acesso a todos os comandos. Use `/ajuda` para ver o que está disponível.

---

## Comandos disponíveis

| Comando | Descrição |
|---------|-----------|
| `/link` | Gera um novo link de vinculação |
| `/desvincular` | Remove a vinculação entre Discord e Bussola |
| `/ajuda` | Lista todos os comandos disponíveis |

> Mais comandos são adicionados a cada atualização.

---

## Notificações

Após vincular, você pode ativar notificações para receber alertas diretamente no DM:

- **Finanças** — alertas de limite de gastos, resumo semanal
- **Agenda** — lembretes de compromissos
- **Registros** — tarefas com prazo próximo
- **Ritmo** — lembretes de refeição e treino

Configure em `/notificacoes` no Discord ou em **Minha Conta → Notificações Discord** no app.

---

## Segurança

- Suas senhas do **Cofre** nunca são acessíveis via Discord
- O link de vinculação é de uso único e expira em 10 minutos
- Nenhuma credencial trafega pelo chat
- Use `/desvincular` a qualquer momento para revogar o acesso

---

## Problemas comuns

**O link de vinculação expirou**
Use `/link` no DM do bot para gerar um novo.

**O bot não responde**
Verifique se a vinculação foi concluída. Se necessário, use `/link` novamente.

**Quero desvincular minha conta**
Use `/desvincular` no Discord ou acesse **Minha Conta → Desconectar Discord** no app.
