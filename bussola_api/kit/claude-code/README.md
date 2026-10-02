# Kit Estudos — Claude Code

Skill `estudos` + 3 subagentes (pesquisador, escritor, revisor) para criar materiais no módulo
**Estudos** do Bússola.

## Instalar

1. Conecte o Bússola como servidor MCP (uma vez):
   - No Bússola: **Configurações da Conta → Conexões MCP → Novo token** (ler e escrever).
   - No terminal:
     `claude mcp add --transport http bussola https://bussola.marocos.dev/mcp --header "Authorization: Bearer <token>"`
2. Descompacte este zip dentro da pasta do Claude Code do seu usuário:
   - Linux/macOS: `~/.claude/`
   - Windows: `%USERPROFILE%\.claude\`

   Ficam `skills/estudos/` (com `references/`) e `agents/estudos-*.md`. Para usar só num projeto,
   descompacte em `<projeto>/.claude/`.
3. Reinicie o Claude Code e teste: `/estudos aula índices em bancos de dados`.

## Usar

- `/estudos aula <assunto>`, `/estudos resumo <assunto>`, `/estudos comparativo <X> vs <Y>`,
  `/estudos exercicios <assunto | material:ID> [só erros]`.
- No site, **Pedir ao Claude** (destino "Claude Code") copia comandos prontos, como
  `/estudos aprofundar material:12 bloco:b7` — cole aqui.

## Atualizar

Baixe o zip de novo em **/estudos/kit** e descompacte por cima. A versão está em `VERSION`; se o
Claude avisar que o formato dos blocos mudou, é hora de atualizar.
