import re
from pathlib import Path

import pytest

KIT = Path(__file__).resolve().parents[1] / "kit"
REFERENCIAS = ["acoes.md", "blocos.md", "metodo-de-pesquisa.md", "pedagogia.md", "receitas.md"]
ACOES_DO_SITE = ["aprofundar", "simplificar", "exercicios", "comparativo", "fontes", "duvida"]
TOOLS = [
    "catalogo_de_blocos", "listar_temas_estudo", "listar_materiais", "ler_material", "listar_respostas_quiz",
    "salvar_tema", "salvar_material", "editar_blocos", "marcar_estudado", "excluir_material", "excluir_tema",
]
SKILLS = ["claude-code/skills/estudos/SKILL.md", "claude-ai/estudos/SKILL.md"]


def _frontmatter(caminho: Path) -> dict:
    texto = caminho.read_text(encoding="utf-8")
    assert texto.startswith("---\n"), f"{caminho} sem frontmatter"
    bruto = texto.split("---\n", 2)[1]
    campos = {}
    for linha in bruto.strip().splitlines():
        chave, _, valor = linha.partition(":")
        campos[chave.strip()] = valor.strip()
    return campos


def test_versao_semver():
    assert re.fullmatch(r"\d+\.\d+\.\d+", (KIT / "VERSION").read_text(encoding="utf-8").strip())


def test_referencias_compartilhadas_existem():
    assert sorted(p.name for p in (KIT / "compartilhado" / "references").iterdir()) == REFERENCIAS


@pytest.mark.parametrize("skill", SKILLS)
def test_skills_frontmatter_valido_e_conhecem_o_formato(skill):
    fm = _frontmatter(KIT / skill)
    assert fm["name"] == "estudos"
    assert 80 < len(fm["description"]) <= 1024
    # YAML simples: sem ": " nem " #" no valor (quebrariam o parser de frontmatter)
    assert ": " not in fm["description"] and " #" not in fm["description"]
    texto = (KIT / skill).read_text(encoding="utf-8")
    assert "`versao_formato` 1" in texto and "/estudos/kit" in texto
    for referencia in REFERENCIAS:
        assert referencia in texto, referencia


def test_skill_claude_ai_lista_todas_as_tools():
    texto = (KIT / "claude-ai" / "estudos" / "SKILL.md").read_text(encoding="utf-8")
    for tool in TOOLS:
        assert f"`{tool}`" in texto, tool


@pytest.mark.parametrize("agente,tools", [
    ("estudos-pesquisador", "WebSearch, WebFetch, Read"),
    ("estudos-escritor", "Read"),
    ("estudos-revisor", "WebFetch, WebSearch, Read"),
])
def test_agentes_claude_code(agente, tools):
    fm = _frontmatter(KIT / "claude-code" / "agents" / f"{agente}.md")
    assert fm["name"] == agente and fm["tools"] == tools
    assert fm["model"] in {"sonnet", "opus", "haiku", "inherit"}
    assert fm["description"] and ": " not in fm["description"]
    skill = (KIT / "claude-code" / "skills" / "estudos" / "SKILL.md").read_text(encoding="utf-8")
    assert agente in skill


def test_acoes_documenta_cada_acao_do_site():
    texto = (KIT / "compartilhado" / "references" / "acoes.md").read_text(encoding="utf-8")
    for acao in ACOES_DO_SITE:
        assert f"/estudos {acao} material:" in texto, acao
    assert "Use a skill estudos para aprofundar o bloco b7 do material 12 no Bússola." in texto


def test_readmes_e_instrucoes():
    assert "claude mcp add --transport http bussola" in (KIT / "claude-code" / "README.md").read_text(encoding="utf-8")
    assert "estudos.zip" in (KIT / "claude-ai" / "README.md").read_text(encoding="utf-8")
    assert "skill **estudos**" in (KIT / "claude-ai" / "instrucoes-do-projeto.md").read_text(encoding="utf-8")


# ---------------------------------------------------------------------------
# Download (Task 5)
# ---------------------------------------------------------------------------
import io
import zipfile

from app.services.estudos_kit import montar_zip

BASE = "/api/v1/estudos"
ESPERADO_CLAUDE_CODE = {
    "VERSION",
    "README.md",
    "skills/estudos/SKILL.md",
    *[f"skills/estudos/references/{r}" for r in REFERENCIAS],
    "agents/estudos-escritor.md",
    "agents/estudos-pesquisador.md",
    "agents/estudos-revisor.md",
}
SKILL_CLAUDE_AI = {"estudos/SKILL.md", *[f"estudos/references/{r}" for r in REFERENCIAS]}
ESPERADO_CLAUDE_AI = {"VERSION", "README.md", "instrucoes-do-projeto.md", "estudos.zip", *SKILL_CLAUDE_AI}


def _baixar(client, alvo):
    r = client.get(f"{BASE}/kit/{alvo}.zip")
    assert r.status_code == 200, r.text
    assert r.headers["content-type"] == "application/zip"
    assert f'filename="bussola-estudos-{alvo}.zip"' in r.headers["content-disposition"]
    return zipfile.ZipFile(io.BytesIO(r.content))


def test_versao_e_instrucoes_via_api(client):
    assert client.get(f"{BASE}/kit/versao").json() == {"versao": (KIT / "VERSION").read_text(encoding="utf-8").strip()}
    texto = client.get(f"{BASE}/kit/instrucoes-projeto").json()["texto"]
    assert texto == (KIT / "claude-ai" / "instrucoes-do-projeto.md").read_text(encoding="utf-8")


def test_zip_claude_code_tem_exatamente_os_arquivos_esperados(client):
    zf = _baixar(client, "claude-code")
    assert set(zf.namelist()) == ESPERADO_CLAUDE_CODE
    assert zf.read("skills/estudos/references/acoes.md") == (KIT / "compartilhado" / "references" / "acoes.md").read_bytes()
    assert zf.read("agents/estudos-revisor.md") == (KIT / "claude-code" / "agents" / "estudos-revisor.md").read_bytes()


def test_zip_claude_ai_traz_skill_pronta_para_upload(client):
    zf = _baixar(client, "claude-ai")
    assert set(zf.namelist()) == ESPERADO_CLAUDE_AI
    interno = zipfile.ZipFile(io.BytesIO(zf.read("estudos.zip")))
    assert set(interno.namelist()) == SKILL_CLAUDE_AI
    assert interno.read("estudos/SKILL.md") == (KIT / "claude-ai" / "estudos" / "SKILL.md").read_bytes()


def test_alvo_invalido_404(client):
    r = client.get(f"{BASE}/kit/outro.zip")
    assert r.status_code == 404 and r.json()["detail"] == "Kit não encontrado"
    assert client.get(f"{BASE}/kit/compartilhado.zip").status_code == 404
    assert client.get(f"{BASE}/kit/..%2Fclaude-code.zip").status_code == 404
    assert client.get(f"{BASE}/kit/claude-code.tar").status_code == 404
    with pytest.raises(KeyError):
        montar_zip("../claude-code")


def test_kit_exige_login(client):
    from app.api import deps
    from app.main import app

    del app.dependency_overrides[deps.get_current_user]
    assert client.get(f"{BASE}/kit/claude-code.zip").status_code == 401
    assert client.get(f"{BASE}/kit/versao").status_code == 401
