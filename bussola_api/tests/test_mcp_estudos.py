import pytest
from mcp.server.mcpserver.exceptions import ToolError

from app.services.estudos import estudos_service
from tests.estudos_amostras import FONTES, blocos_todos_os_tipos, quiz, texto


def test_catalogo_de_blocos(mcp_call):
    cat = mcp_call("catalogo_de_blocos")
    assert cat["versao_formato"] == 1
    assert {"quiz", "comparacao", "diagrama", "questao_aberta"} <= set(cat["blocos"])
    assert cat["minimos_por_tipo_material"]["exercicios"] == ["quiz", "questao_aberta"]


def test_criar_com_tema_novo_ler_e_listar_temas(mcp_call):
    r = mcp_call("salvar_material", tema="Python", tipo="aula", titulo="Variáveis em Python", nivel="iniciante",
                 tags=["python"], blocos=blocos_todos_os_tipos(), fontes=FONTES)
    assert r["url"].endswith(f"/estudos/{r['id']}")
    assert [b["id"] for b in r["blocos"]][:3] == ["b1", "b2", "b3"] and r["total_fontes"] == 2
    lido = mcp_call("ler_material", id=r["id"])
    assert lido["tema_nome"] == "Python" and len(lido["blocos"]) == 15
    assert lido["blocos"][13]["correta"] == 1 and lido["url"] == r["url"]
    temas = mcp_call("listar_temas_estudo")["itens"]
    assert [(t["nome"], t["total_materiais"]) for t in temas] == [("Python", 1)]


def test_material_invalido_vira_toolerror_em_portugues_e_nada_grava(mcp_call):
    with pytest.raises(ToolError, match=r"bloco 1 \(quiz\): 'correta' = 3, mas há 2 opções"):
        mcp_call("salvar_material", tipo="exercicios", titulo="X",
                 blocos=[quiz(opcoes=["a", "b"], correta=3, explicacao="porque")])
    with pytest.raises(ToolError, match="informe tipo, titulo e blocos"):
        mcp_call("salvar_material", titulo="Sem blocos")
    assert mcp_call("listar_materiais")["itens"] == []


def test_edicao_parcial_por_titulo_e_editar_blocos(mcp_call):
    r = mcp_call("salvar_material", tipo="resumo", titulo="Git básico", blocos=[texto("commit e push")])
    mcp_call("salvar_material", id=r["id"], subtitulo="O essencial")
    lido = mcp_call("ler_material", id=r["id"])
    assert lido["subtitulo"] == "O essencial" and lido["blocos"][0]["conteudo"] == "commit e push"
    e = mcp_call("editar_blocos", material="git basico", operacoes=[
        {"op": "inserir", "depois_de": "b1", "blocos": [{"tipo": "alerta", "nivel": "dica", "texto": "use branches"}]},
    ])
    assert [b["id"] for b in e["blocos"]] == ["b1", "b2"]
    with pytest.raises(ToolError, match=r"operação 1 \(remover\): bloco 'b9' não existe"):
        mcp_call("editar_blocos", material=str(r["id"]), operacoes=[{"op": "remover", "id": "b9"}])
    mcp_call("salvar_material", id=r["id"], tema="Git")
    assert mcp_call("ler_material", id=r["id"])["tema_nome"] == "Git"
    mcp_call("salvar_material", id=r["id"], tema="")
    assert mcp_call("ler_material", id=r["id"])["tema_id"] is None


def test_listar_filtros_e_busca(mcp_call):
    mcp_call("salvar_material", tema="SQL", tipo="aula", titulo="Índices", tags=["postgres"], blocos=[texto("x")])
    mcp_call("salvar_material", tipo="resumo", titulo="Joins", blocos=[texto("y")])
    assert [m["titulo"] for m in mcp_call("listar_materiais", tema="sql")["itens"]] == ["Índices"]
    assert [m["titulo"] for m in mcp_call("listar_materiais", tipo="resumo")["itens"]] == ["Joins"]
    assert [m["titulo"] for m in mcp_call("listar_materiais", busca="indices")["itens"]] == ["Índices"]
    assert [m["titulo"] for m in mcp_call("listar_materiais", tag="postgres")["itens"]] == ["Índices"]
    item = mcp_call("listar_materiais", busca="joins")["itens"][0]
    assert {"id", "titulo", "tipo", "tema_nome", "tags", "nivel", "estudado", "atualizado_em", "url"} <= set(item)
    assert "blocos" not in item


def test_marcar_estudado_idempotente_e_filtro(mcp_call):
    r = mcp_call("salvar_material", tipo="aula", titulo="Redes", blocos=[texto("x")])
    a = mcp_call("marcar_estudado", material="redes")
    b = mcp_call("marcar_estudado", material=str(r["id"]), estudado=True)
    assert a["estudado"] is True and a["estudado_em"] == b["estudado_em"]
    assert [m["id"] for m in mcp_call("listar_materiais", estudado=True)["itens"]] == [r["id"]]
    assert mcp_call("marcar_estudado", material="redes", estudado=False)["estudado"] is False


def test_listar_respostas_quiz_so_erros(mcp_call, mcp_db, user):
    r = mcp_call("salvar_material", tipo="exercicios", titulo="Quiz Python", blocos=[quiz()], fontes=FONTES)
    estudos_service.registrar_resposta(mcp_db, r["id"], user.id, "b1", 0)
    estudos_service.registrar_resposta(mcp_db, r["id"], user.id, "b1", 1)
    todas = mcp_call("listar_respostas_quiz", material="quiz python")["itens"]
    assert [x["acertou"] for x in todas] == [True, False]
    erros = mcp_call("listar_respostas_quiz", so_erros=True)["itens"]
    assert len(erros) == 1 and erros[0]["pergunta"] == "Qual destes é imutável?" and erros[0]["resposta"] == 0


def test_temas_e_exclusoes(mcp_call):
    t = mcp_call("salvar_tema", nome="Redes", cor="#10b981", icone="fa-network-wired")
    assert t["total_materiais"] == 0 and t["cor"] == "#10b981"
    assert mcp_call("salvar_tema", id=t["id"], descricao="TCP/IP")["nome"] == "Redes"
    with pytest.raises(ToolError, match="Já existe um tema"):
        mcp_call("salvar_tema", nome="redes")
    r = mcp_call("salvar_material", tema="redes", tipo="aula", titulo="TCP", blocos=[texto("x")])
    with pytest.raises(ToolError, match=r"tem 1 material\(is\)"):
        mcp_call("excluir_tema", tema="Redes")
    assert mcp_call("excluir_material", id=r["id"]) == {"ok": True}
    with pytest.raises(ToolError, match="não encontrado"):
        mcp_call("ler_material", id=r["id"])
    assert mcp_call("excluir_tema", tema=str(t["id"])) == {"ok": True}


def test_escopo_de_leitura_bloqueia_escrita(mcp_call):
    assert mcp_call("catalogo_de_blocos", escopos=("bussola:read",))["versao_formato"] == 1
    escritas = [
        ("salvar_tema", {"nome": "X"}),
        ("salvar_material", {"tipo": "aula", "titulo": "X", "blocos": [texto("x")]}),
        ("editar_blocos", {"material": "1", "operacoes": [{"op": "remover", "id": "b1"}]}),
        ("marcar_estudado", {"material": "1"}),
        ("excluir_material", {"id": 1}),
        ("excluir_tema", {"tema": "x"}),
    ]
    for nome, args in escritas:
        with pytest.raises(ToolError, match="bussola:write"):
            mcp_call(nome, escopos=("bussola:read",), **args)


def test_isolamento(mcp_call, outro_user):
    r = mcp_call("salvar_material", tema="Meu", tipo="aula", titulo="Privado", blocos=[texto("x")])
    with pytest.raises(ToolError, match="não encontrado"):
        mcp_call("ler_material", usuario=outro_user, id=r["id"])
    with pytest.raises(ToolError, match="não foi encontrado"):
        mcp_call("editar_blocos", usuario=outro_user, material="Privado", operacoes=[{"op": "remover", "id": "b1"}])
    assert mcp_call("listar_materiais", usuario=outro_user)["itens"] == []
    assert mcp_call("listar_temas_estudo", usuario=outro_user)["itens"] == []
