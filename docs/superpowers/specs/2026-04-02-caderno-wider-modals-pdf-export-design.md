# Design: Caderno — Modais Mais Largos + Exportação PDF

**Data:** 2026-04-02
**Módulo:** Registros / Caderno (Anotações)
**Status:** Aprovado

---

## 1. Modais Mais Largos

### Mudanças em `bussola_web/src/pages/Registros/styles.css`

| Seletor | Antes | Depois |
|---|---|---|
| `.modal-content`, `.view-modal` | `max-width: 700px` | `max-width: 900px` |
| `.large-modal` | `max-width: 800px` | `max-width: 1000px` |

Mantém `width: 95%` para mobile. Nenhuma alteração em componentes JSX.

---

## 2. Botão "Download PDF" no Modal de Visualização

### Posição
Ao lado dos botões "Copiar MD" e "Copiar texto" no `ViewAnotacaoModal.jsx`, no container flex existente (linha 86).

### Estilo
- Mesmo tamanho/formato dos botões existentes: `font-size: 0.78rem`, `padding: 3px 10px`, `border-radius: 6px`
- Destaque sutil: background `rgba(var(--cor-azul-primario-rgb), 0.1)`, texto em `var(--cor-azul-primario)`
- Ícone: `fa-solid fa-download`

### Comportamento
1. Clique dispara POST para `/api/v1/registros/anotacoes/export-pdf`
2. Body: `{ titulo, conteudo, grupo_nome, grupo_cor, data_criacao }` da nota atual
3. Loading: botão mostra "Gerando..." com spinner (`fa-spinner fa-spin`)
4. Sucesso: blob PDF → download automático como `{titulo-slugificado}.pdf`
5. Erro: toast via contexto existente

### Serviço Frontend
Adicionar `exportAnotacaoPdf(data)` em `bussola_web/src/services/api.ts` — POST com `responseType: 'blob'`.

---

## 3. Backend — Endpoint e PDF Service

### Endpoint

**Rota:** `POST /api/v1/registros/anotacoes/export-pdf`
**Arquivo:** `bussola_api/app/api/v1/endpoints/registros.py`
**Auth:** JWT obrigatório (`get_current_user`)

**Request body (Pydantic):**
```python
class ExportPdfRequest(BaseModel):
    titulo: str
    conteudo: str
    grupo_nome: str | None = None
    grupo_cor: str | None = None
    data_criacao: str
```

**Response:** `StreamingResponse(content_type="application/pdf")` com `Content-Disposition: attachment; filename="titulo.pdf"`

### PDF Service

**Arquivo novo:** `bussola_api/app/services/pdf_service.py`

**Pipeline:**
1. `markdown` lib converte MD → HTML com extensões: `tables`, `fenced_code`, `codehilite`, `nl2br`, `sane_lists`, `attr_list`, `def_list`, `footnotes`
2. HTML fragment embebido em template HTML completo com `<meta charset="utf-8">` e CSS inline
3. `weasyprint.HTML(string=html).write_pdf()` → BytesIO

**Funções:**
- `generate_pdf(titulo, conteudo, grupo_nome, grupo_cor, data_criacao) -> BytesIO`
- `_markdown_to_html(conteudo) -> str`
- `_build_full_html(titulo, html_body, grupo_nome, grupo_cor, data_criacao) -> str`
- `_slugify(text) -> str`

**Estilo do PDF (CSS inline no template):**
- Página A4, margens 2cm
- Header: badge do grupo com cor dinâmica, título 22pt, data formatada pt-BR
- `h1`: 18pt com borda inferior; `h2`: 15pt com borda mais fina
- Blockquotes: borda lateral 4px indigo, fundo `#f0f4ff`, itálico
- Code blocks: fundo `#1e1e2e`, texto `#cdd6f4`, monospace, syntax highlighting via Pygments CSS
- Code inline: fundo `#eff1f5`, cor `#d20f39`
- Tabelas: zebra-striping, bordas, header com fundo `#e8ecf0`
- Links: azul, URL exibida via `::after`
- Checkboxes: ☐ e ✅ via CSS `content`
- Footer via `@page`: "Bussola · Exportado em DD/MM/YYYY" + número de página
- Fontes: sans-serif para body, monospace para código

**Encoding:** UTF-8 em todo o pipeline.

---

## 4. Dependências e Infra

### Python (requirements.txt)
- `markdown`
- `weasyprint`
- `Pygments`

### Dockerfile (bussola_api/Dockerfile)
Adicionar ao `apt-get install`:
```
libpango-1.0-0 libpangocairo-1.0-0 libcairo2 libgdk-pixbuf-2.0-0 libffi-dev shared-mime-info fonts-liberation
```

---

## Fora do Escopo
- Customização de tema do PDF pelo usuário
- Export de múltiplas notas de uma vez
- Preview do PDF antes do download
- Export em outros formatos (DOCX, etc.)
- PDF do modal de edição (só do visualizador)
