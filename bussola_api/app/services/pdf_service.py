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
