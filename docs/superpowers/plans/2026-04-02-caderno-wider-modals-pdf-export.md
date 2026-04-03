# Caderno — Modais Mais Largos + Exportação PDF — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alargar os modais do Caderno e adicionar geração + download de PDF bem formatado para cada anotação.

**Architecture:** (1) Ajuste CSS nos modais (700→900, 800→1000). (2) Novo `pdf_service.py` no backend converte Markdown→HTML→PDF via WeasyPrint em memória. (3) Novo endpoint POST `export-pdf` retorna `StreamingResponse`. (4) Botão "Download" no `ViewAnotacaoModal` chama o endpoint via axios blob e dispara download.

**Tech Stack:** Python `markdown` + `weasyprint` + `Pygments` (backend), `BytesIO` + `StreamingResponse` (FastAPI), axios `responseType: 'blob'` (frontend).

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `bussola_web/src/pages/Registros/styles.css` | Widen modal max-widths |
| Create | `bussola_api/app/services/pdf_service.py` | Markdown→HTML→PDF pipeline |
| Modify | `bussola_api/app/schemas/registros.py` | Add `ExportPdfRequest` schema |
| Modify | `bussola_api/app/api/v1/endpoints/registros.py` | Add `export-pdf` endpoint |
| Modify | `bussola_web/src/services/api.ts` | Add `exportAnotacaoPdf()` function |
| Modify | `bussola_web/src/pages/Registros/components/ViewAnotacaoModal.jsx` | Add Download PDF button |
| Modify | `bussola_api/requirements.txt` | Add markdown, weasyprint, Pygments |
| Modify | `bussola_api/Dockerfile` | Add WeasyPrint system deps |

---

### Task 1: Widen Modals (CSS)

**Files:**
- Modify: `bussola_web/src/pages/Registros/styles.css:515` and `:576`

- [ ] **Step 1: Change base modal max-width from 700px to 900px**

In `bussola_web/src/pages/Registros/styles.css`, find line 515:
```css
    max-width: 700px;
```
Replace with:
```css
    max-width: 900px;
```

- [ ] **Step 2: Change large-modal max-width from 800px to 1000px**

In the same file, find line 576:
```css
    max-width: 800px;
```
Replace with:
```css
    max-width: 1000px;
```

- [ ] **Step 3: Commit**

```bash
git add bussola_web/src/pages/Registros/styles.css
git commit -m "style(registros): widen view and edit modals (900px/1000px)"
```

---

### Task 2: Add Python Dependencies and Dockerfile System Packages

**Files:**
- Modify: `bussola_api/requirements.txt`
- Modify: `bussola_api/Dockerfile`

- [ ] **Step 1: Add markdown, weasyprint, Pygments to requirements.txt**

Append to the end of `bussola_api/requirements.txt`:
```
markdown==3.7
weasyprint==63.1
Pygments==2.19.1
```

- [ ] **Step 2: Add WeasyPrint system dependencies to Dockerfile**

In `bussola_api/Dockerfile`, replace the `apt-get` block (lines 14-18):
```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    tzdata \
    && rm -rf /var/lib/apt/lists/*
```
With:
```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    tzdata \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libcairo2 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    shared-mime-info \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*
```

- [ ] **Step 3: Commit**

```bash
git add bussola_api/requirements.txt bussola_api/Dockerfile
git commit -m "build: add weasyprint, markdown, Pygments deps and system libs"
```

---

### Task 3: Create PDF Service

**Files:**
- Create: `bussola_api/app/services/pdf_service.py`

- [ ] **Step 1: Create `pdf_service.py` with full pipeline**

Create `bussola_api/app/services/pdf_service.py`:

```python
"""
PDF generation service for notebook notes.
Converts Markdown content to a styled PDF using WeasyPrint.
"""

import re
import unicodedata
from io import BytesIO
from datetime import datetime

import markdown
from pygments.formatters import HtmlFormatter
from weasyprint import HTML


def generate_pdf(
    titulo: str,
    conteudo: str,
    grupo_nome: str | None,
    grupo_cor: str | None,
    data_criacao: str,
) -> tuple[BytesIO, str]:
    """Generate a PDF from markdown content. Returns (buffer, filename)."""
    html_body = _markdown_to_html(conteudo)
    full_html = _build_full_html(titulo, html_body, grupo_nome, grupo_cor, data_criacao)
    
    buffer = BytesIO()
    HTML(string=full_html).write_pdf(buffer)
    buffer.seek(0)
    
    filename = _slugify(titulo) + ".pdf"
    return buffer, filename


def _markdown_to_html(conteudo: str) -> str:
    """Convert markdown string to HTML with rich extensions."""
    extensions = [
        "tables",
        "fenced_code",
        "codehilite",
        "nl2br",
        "sane_lists",
        "attr_list",
        "def_list",
        "footnotes",
    ]
    extension_configs = {
        "codehilite": {
            "css_class": "codehilite",
            "guess_lang": True,
            "noclasses": False,
        },
    }
    return markdown.markdown(
        conteudo,
        extensions=extensions,
        extension_configs=extension_configs,
        output_format="html",
    )


def _build_full_html(
    titulo: str,
    html_body: str,
    grupo_nome: str | None,
    grupo_cor: str | None,
    data_criacao: str,
) -> str:
    """Wrap the HTML body in a complete document with embedded CSS."""
    cor = grupo_cor or "#999"
    
    # Format date in pt-BR
    try:
        dt = datetime.fromisoformat(data_criacao)
        data_fmt = dt.strftime("%d/%m/%Y %H:%M")
    except (ValueError, TypeError):
        data_fmt = data_criacao

    export_date = datetime.now().strftime("%d/%m/%Y")

    # Pygments CSS for syntax highlighting
    pygments_css = HtmlFormatter(style="monokai").get_style_defs(".codehilite")

    grupo_badge = ""
    if grupo_nome:
        grupo_badge = (
            f'<span class="grupo-badge" style="background:{cor};">'
            f"{grupo_nome}</span>"
        )

    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<style>
/* ---------- Page ---------- */
@page {{
    size: A4;
    margin: 2cm;
    @bottom-center {{
        content: "Bussola · Exportado em {export_date}";
        font-size: 8pt;
        color: #999;
    }}
    @bottom-right {{
        content: counter(page);
        font-size: 8pt;
        color: #999;
    }}
}}

/* ---------- Base ---------- */
body {{
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #1a1a2e;
    margin: 0;
    padding: 0;
}}

/* ---------- Header ---------- */
.note-header {{
    border-left: 6px solid {cor};
    padding: 12px 16px;
    margin-bottom: 24px;
    background: #f8f9fa;
    border-radius: 0 8px 8px 0;
}}
.grupo-badge {{
    display: inline-block;
    color: #fff;
    font-size: 9pt;
    font-weight: 600;
    padding: 2px 10px;
    border-radius: 12px;
    margin-bottom: 6px;
}}
.note-header h1 {{
    margin: 8px 0 4px 0;
    font-size: 22pt;
    color: #1a1a2e;
}}
.note-date {{
    font-size: 9pt;
    color: #666;
}}

/* ---------- Headings ---------- */
h1 {{ font-size: 18pt; border-bottom: 2px solid #e0e0e0; padding-bottom: 6px; margin-top: 28px; }}
h2 {{ font-size: 15pt; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-top: 24px; }}
h3 {{ font-size: 13pt; margin-top: 20px; }}
h4 {{ font-size: 11pt; margin-top: 16px; }}

/* ---------- Blockquote ---------- */
blockquote {{
    border-left: 4px solid #5b6abf;
    background: #f0f4ff;
    margin: 16px 0;
    padding: 12px 16px;
    font-style: italic;
    color: #333;
}}
blockquote p {{ margin: 0; }}

/* ---------- Code ---------- */
{pygments_css}

.codehilite {{
    background: #1e1e2e !important;
    color: #cdd6f4;
    padding: 14px 16px;
    border-radius: 8px;
    font-size: 9pt;
    line-height: 1.5;
    overflow-x: auto;
    margin: 16px 0;
}}
.codehilite pre {{ margin: 0; white-space: pre-wrap; word-wrap: break-word; }}

code {{
    background: #eff1f5;
    color: #d20f39;
    padding: 2px 5px;
    border-radius: 4px;
    font-family: "Courier New", Courier, monospace;
    font-size: 9.5pt;
}}
pre code {{
    background: transparent;
    color: inherit;
    padding: 0;
}}

/* ---------- Tables ---------- */
table {{
    border-collapse: collapse;
    width: 100%;
    margin: 16px 0;
    font-size: 10pt;
}}
th, td {{
    border: 1px solid #d0d0d0;
    padding: 8px 12px;
    text-align: left;
}}
th {{
    background: #e8ecf0;
    font-weight: 600;
}}
tr:nth-child(even) {{
    background: #f8f9fa;
}}

/* ---------- Lists ---------- */
ul, ol {{
    padding-left: 24px;
    margin: 8px 0;
}}
li {{
    margin: 4px 0;
}}

/* ---------- Links ---------- */
a {{
    color: #2563eb;
    text-decoration: none;
}}
a::after {{
    content: " (" attr(href) ")";
    font-size: 8pt;
    color: #888;
}}

/* ---------- Horizontal Rule ---------- */
hr {{
    border: none;
    border-top: 1px solid #dde1e7;
    margin: 24px 0;
}}

/* ---------- Checkboxes ---------- */
input[type="checkbox"] {{
    appearance: none;
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    border: 2px solid #999;
    border-radius: 3px;
    vertical-align: middle;
    margin-right: 6px;
    position: relative;
}}
input[type="checkbox"]:checked {{
    background: #22c55e;
    border-color: #22c55e;
}}
input[type="checkbox"]:checked::after {{
    content: "\\2713";
    color: #fff;
    font-size: 10px;
    position: absolute;
    top: -1px;
    left: 1px;
}}

/* ---------- Images ---------- */
img {{
    max-width: 100%;
    height: auto;
    border-radius: 6px;
}}
</style>
</head>
<body>
<div class="note-header">
    {grupo_badge}
    <h1 style="font-size:22pt; border:none; padding:0;">{titulo}</h1>
    <div class="note-date">{data_fmt}</div>
</div>

{html_body}
</body>
</html>"""


def _slugify(text: str) -> str:
    """Convert text to a safe filename slug."""
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^\w\s-]", "", text.lower())
    text = re.sub(r"[-\s]+", "-", text).strip("-")
    return text or "nota"
```

- [ ] **Step 2: Commit**

```bash
git add bussola_api/app/services/pdf_service.py
git commit -m "feat(registros): add PDF generation service with WeasyPrint"
```

---

### Task 4: Add Schema and Backend Endpoint

**Files:**
- Modify: `bussola_api/app/schemas/registros.py` (add `ExportPdfRequest` at end)
- Modify: `bussola_api/app/api/v1/endpoints/registros.py` (add endpoint after anotacoes section)

- [ ] **Step 1: Add `ExportPdfRequest` schema**

At the end of `bussola_api/app/schemas/registros.py`, before the Dashboard section comment, add:

```python
# --------------------------------------------------------------------------------------
# EXPORT PDF
# --------------------------------------------------------------------------------------
class ExportPdfRequest(BaseModel):
    titulo: str
    conteudo: str
    grupo_nome: Optional[str] = None
    grupo_cor: Optional[str] = None
    data_criacao: str
```

- [ ] **Step 2: Add the export-pdf endpoint**

In `bussola_api/app/api/v1/endpoints/registros.py`:

Add these imports at the top (merge with existing imports):
```python
from fastapi.responses import StreamingResponse
from app.schemas.registros import ExportPdfRequest
```

Then after the `toggle_fixar_anotacao` endpoint (after line 148), add:

```python
@router.post("/anotacoes/export-pdf")
def export_anotacao_pdf(
    dados: ExportPdfRequest,
    current_user = Depends(deps.get_current_user)
):
    """Gera e retorna um PDF a partir do conteúdo Markdown de uma anotação."""
    from app.services.pdf_service import generate_pdf

    buffer, filename = generate_pdf(
        titulo=dados.titulo,
        conteudo=dados.conteudo,
        grupo_nome=dados.grupo_nome,
        grupo_cor=dados.grupo_cor,
        data_criacao=dados.data_criacao,
    )
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
```

- [ ] **Step 3: Commit**

```bash
git add bussola_api/app/schemas/registros.py bussola_api/app/api/v1/endpoints/registros.py
git commit -m "feat(registros): add export-pdf endpoint with Pydantic schema"
```

---

### Task 5: Add Frontend API Function

**Files:**
- Modify: `bussola_web/src/services/api.ts` (after `toggleFixarAnotacao` around line 463)

- [ ] **Step 1: Add `exportAnotacaoPdf` function**

After the `toggleFixarAnotacao` function (line 463), add:

```typescript
export interface ExportPdfData {
    titulo: string;
    conteudo: string;
    grupo_nome?: string | null;
    grupo_cor?: string | null;
    data_criacao: string;
}

export const exportAnotacaoPdf = async (data: ExportPdfData): Promise<Blob> => {
    const response = await api.post('/registros/anotacoes/export-pdf', data, {
        responseType: 'blob',
    });
    return response.data;
};
```

- [ ] **Step 2: Commit**

```bash
git add bussola_web/src/services/api.ts
git commit -m "feat(registros): add exportAnotacaoPdf API function"
```

---

### Task 6: Add Download PDF Button to View Modal

**Files:**
- Modify: `bussola_web/src/pages/Registros/components/ViewAnotacaoModal.jsx`

- [ ] **Step 1: Add imports and state**

At the top of `ViewAnotacaoModal.jsx`, update the imports:

```jsx
import React, { useState } from 'react';
import { BaseModal } from '../../../components/BaseModal';
import { MarkdownViewer } from './MarkdownViewer';
import { exportAnotacaoPdf } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import '../styles.css';
import '../styles/markdown.css';
import { logger } from '../../../utils/logger';
```

- [ ] **Step 2: Add pdfLoading state and handleDownloadPdf handler**

Inside the component function, after the `const [copyState, setCopyState] = useState(null);` line, add:

```jsx
const [pdfLoading, setPdfLoading] = useState(false);
const { addToast } = useToast();
```

After the `handleCopy` function (after line 51), add:

```jsx
const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
        const blob = await exportAnotacaoPdf({
            titulo: nota.titulo || 'Sem título',
            conteudo: nota.conteudo || '',
            grupo_nome: nota.grupo?.nome || null,
            grupo_cor: nota.grupo?.cor || null,
            data_criacao: nota.data_criacao,
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(nota.titulo || 'nota').replace(/[^a-zA-Z0-9\u00C0-\u024F\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'nota'}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        logger.error("Erro ao gerar PDF", { error: String(e) });
        addToast('Erro ao gerar o PDF. Tente novamente.', 'error');
    } finally {
        setPdfLoading(false);
    }
};
```

- [ ] **Step 3: Add the Download button in the JSX**

In the button container `<div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>` (line 86), after the "Copiar texto" button (after line 110, before the closing `</div>`), add:

```jsx
<button
    className="md-icon-btn"
    onClick={handleDownloadPdf}
    disabled={pdfLoading}
    title="Baixar como PDF"
    style={{
        fontSize: '0.78rem',
        padding: '3px 10px',
        border: '1px solid rgba(74,109,255,0.3)',
        borderRadius: '6px',
        background: 'rgba(74,109,255,0.1)',
        color: 'var(--cor-azul-primario)',
        cursor: pdfLoading ? 'wait' : 'pointer',
    }}
>
    {pdfLoading
        ? <><i className="fa-solid fa-spinner fa-spin"></i> Gerando...</>
        : <><i className="fa-solid fa-download"></i> Download</>
    }
</button>
```

- [ ] **Step 4: Commit**

```bash
git add bussola_web/src/pages/Registros/components/ViewAnotacaoModal.jsx
git commit -m "feat(registros): add Download PDF button to view modal"
```

---

### Task 7: Manual Verification

- [ ] **Step 1: Rebuild Docker containers**

```bash
docker compose up -d --build
```

- [ ] **Step 2: Verify modal widths**

Open a note in the view modal and edit modal. Confirm they are wider than before (900px and 1000px respectively).

- [ ] **Step 3: Test PDF download**

Click the "Download" button on a view modal with markdown content that includes: headings, code blocks, a table, a blockquote, and a list. Confirm:
- PDF downloads with correct filename
- UTF-8 characters (acentos) render correctly
- Code blocks have dark background with syntax highlighting
- Tables have zebra-striping
- Footer shows "Bussola · Exportado em DD/MM/YYYY"

- [ ] **Step 4: Test edge cases**

- Note with empty content → should still generate a PDF with just the header
- Note without a group → should render without group badge
- Note with very long content → should paginate correctly

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(registros): caderno wider modals and PDF export"
```
