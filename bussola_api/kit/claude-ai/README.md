# Kit Estudos — claude.ai (web e app)

Skill `estudos` (sem subagentes) + instruções para um Projeto "Estudos".

## Instalar

1. **Conector do Bússola** — no claude.ai: Configurações → Conectores → Adicionar conector
   personalizado → URL `https://bussola.marocos.dev/mcp`. Faça login no Bússola e autorize
   "ler e escrever".
2. **Skill** — Configurações → Capacidades → Skills → enviar skill → escolha **`estudos.zip`**
   (está dentro deste zip; contém a pasta `estudos/` com `SKILL.md` e `references/`). Skills
   exigem "Execução de código e criação de arquivos" ativada nas Capacidades. Os nomes dos menus
   podem variar um pouco entre versões do app.
3. **Projeto** — crie um Projeto "Estudos", cole o conteúdo de `instrucoes-do-projeto.md` nas
   instruções do Projeto (o botão "Copiar instruções do Projeto" em /estudos/kit faz isso) e
   ative o conector Bússola nas conversas dele.
4. Teste numa conversa do Projeto: "Crie uma aula sobre índices em bancos de dados no Bússola."

## Usar

No site, escolha o destino **claude.ai** e use **Pedir ao Claude**: a frase copiada já diz a ação,
o material e o bloco. Cole numa conversa do Projeto.

## Atualizar

Baixe o zip de novo em **/estudos/kit**, remova a skill antiga e envie o `estudos.zip` novo. A
versão está em `VERSION`.
