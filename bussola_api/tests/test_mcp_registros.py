import pytest
from mcp.server.mcpserver.exceptions import ToolError


def test_grupos(mcp_call):
    g = mcp_call("salvar_grupo", nome="Estudos", cor="#00ff00")
    with pytest.raises(ToolError, match="Já existe"):
        mcp_call("salvar_grupo", nome="Estudos")
    assert mcp_call("salvar_grupo", id=g["id"], cor="#0000ff")["nome"] == "Estudos"
    assert [x["nome"] for x in mcp_call("listar_grupos")["itens"]] == ["Estudos"]
    assert mcp_call("excluir_grupo", grupo="estudos") == {"ok": True}


def test_anotacao_markdown_vira_html_e_edicao_preserva(mcp_call):
    mcp_call("salvar_grupo", nome="Ideias")
    nota = mcp_call("salvar_anotacao", titulo="Plano", conteudo_markdown="# Meta\n\nTexto **forte**",
                    grupo="ideias", links=["https://exemplo.dev"])
    lida = mcp_call("ler_anotacao", id=nota["id"])
    assert "<strong>forte</strong>" in lida["conteudo"]

    mcp_call("salvar_anotacao", id=nota["id"], titulo="Plano v2")
    depois = mcp_call("ler_anotacao", id=nota["id"])
    assert depois["titulo"] == "Plano v2"
    assert depois["conteudo"] == lida["conteudo"]
    assert depois["grupo"]["nome"] == "Ideias"
    assert [l["url"] for l in depois["links"]] == ["https://exemplo.dev"]


def test_listar_anotacoes_busca_e_trecho(mcp_call):
    mcp_call("salvar_anotacao", titulo="Mercado", conteudo_markdown="comprar café")
    mcp_call("salvar_anotacao", titulo="Outra", conteudo_markdown="nada")
    r = mcp_call("listar_anotacoes", busca="café")
    assert [n["titulo"] for n in r["itens"]] == ["Mercado"]
    assert "comprar café" in r["itens"][0]["trecho"]
    assert "<" not in r["itens"][0]["trecho"]


def test_tarefa_com_subtarefas_e_marcar_idempotente(mcp_call):
    t = mcp_call("salvar_tarefa", titulo="Revisar contrato", prioridade="Alta", subtarefas=["Ler", "Assinar"])
    assert [s["titulo"] for s in t["subtarefas"]] == ["Ler", "Assinar"]
    sub_id = t["subtarefas"][0]["id"]
    mcp_call("marcar_subtarefa", id=sub_id, feita=True)
    mcp_call("marcar_subtarefa", id=sub_id, feita=True)
    tarefa = mcp_call("listar_tarefas", status="Pendente")["itens"][0]
    assert tarefa["subtarefas"][0]["concluido"] is True


def test_editar_status_adicionar_subtarefa_e_excluir(mcp_call, outro_user):
    t = mcp_call("salvar_tarefa", titulo="Deploy")
    r = mcp_call("salvar_tarefa", id=t["id"], status="Concluído", subtarefas=["Checar logs"])
    assert r["status"] == "Concluído" and r["data_conclusao"] is not None
    assert [s["titulo"] for s in r["subtarefas"]] == ["Checar logs"]
    assert mcp_call("listar_tarefas", status="Pendente")["itens"] == []
    with pytest.raises(ToolError, match="não encontrada"):
        mcp_call("excluir_tarefa", usuario=outro_user, id=t["id"])
    assert mcp_call("excluir_tarefa", id=t["id"]) == {"ok": True}
