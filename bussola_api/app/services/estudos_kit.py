"""
=======================================================================================
ARQUIVO: estudos_kit.py (Serviço - kit do Claude para o módulo Estudos)
=======================================================================================

OBJETIVO:
    Montar em memória o zip do kit para cada alvo (claude-code, claude-ai) a partir de
    bussola_api/kit/: arquivos do alvo + kit/compartilhado/references copiado para dentro
    da pasta da skill. Nenhum caminho vem do usuário além do `alvo`, validado contra ALVOS.
=======================================================================================
"""

import io
import zipfile
from pathlib import Path

KIT_DIR = Path(__file__).resolve().parents[2] / "kit"

# alvo -> pasta da skill dentro do zip (onde references/ é copiado)
ALVOS: dict[str, str] = {
    "claude-code": "skills/estudos",
    "claude-ai": "estudos",
}


def versao() -> str:
    return (KIT_DIR / "VERSION").read_text(encoding="utf-8").strip()


def instrucoes_projeto() -> str:
    return (KIT_DIR / "claude-ai" / "instrucoes-do-projeto.md").read_text(encoding="utf-8")


def _arquivos(raiz: Path):
    for caminho in sorted(raiz.rglob("*")):
        if caminho.is_file() and not caminho.is_symlink():
            yield caminho


def _zipar(membros: list[tuple[str, bytes]]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for nome, dados in membros:
            zf.writestr(nome, dados)
    return buffer.getvalue()


def montar_zip(alvo: str) -> bytes:
    if alvo not in ALVOS:
        raise KeyError(alvo)
    pasta_alvo = KIT_DIR / alvo
    pasta_skill = ALVOS[alvo]
    membros: list[tuple[str, bytes]] = [("VERSION", (KIT_DIR / "VERSION").read_bytes())]
    for arquivo in _arquivos(pasta_alvo):
        membros.append((arquivo.relative_to(pasta_alvo).as_posix(), arquivo.read_bytes()))
    referencias = KIT_DIR / "compartilhado" / "references"
    for arquivo in _arquivos(referencias):
        membros.append((f"{pasta_skill}/references/{arquivo.relative_to(referencias).as_posix()}", arquivo.read_bytes()))
    if alvo == "claude-ai":
        # A pasta da skill zipada sozinha: é o que o claude.ai aceita no upload de skills.
        skill = [(nome, dados) for nome, dados in membros if nome.startswith(f"{pasta_skill}/")]
        membros.append(("estudos.zip", _zipar(skill)))
    return _zipar(membros)
