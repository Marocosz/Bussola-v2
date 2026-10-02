import pytest
from mcp.server.mcpserver.exceptions import ToolError

DIAS = [{"nome": "Treino A", "ordem": 1, "exercicios": [
    {"nome_exercicio": "Supino", "grupo_muscular": "Peito", "series": 4, "repeticoes_min": 8, "repeticoes_max": 12},
]}]
REFEICOES = [{"nome": "Café", "ordem": 1, "alimentos": [
    {"nome": "Ovo", "quantidade": 100, "unidade": "g", "calorias": 155, "proteina": 13, "carbo": 1, "gordura": 11},
]}]


def test_bio(mcp_call):
    assert mcp_call("ultimo_bio") == {"bio": None, "volume_semanal": {}}
    bio = mcp_call("registrar_bio", peso=80, altura=180, idade=30, genero="M",
                   nivel_atividade="moderado", objetivo="ganho_massa")
    assert bio["tmb"] > 0
    assert mcp_call("ultimo_bio")["bio"]["peso"] == 80


def test_treino_criar_ativar_editar_excluir(mcp_call):
    plano = mcp_call("salvar_treino", nome="ABC", dias=DIAS, ativo=True)
    assert plano["ativo"] is True and plano["dias"][0]["exercicios"][0]["nome_exercicio"] == "Supino"
    assert mcp_call("ultimo_bio")["volume_semanal"] == {}  # sem bio, volume não é calculado
    dias = plano["dias"]
    dias[0]["nome"] = "Treino A (peito)"
    editado = mcp_call("salvar_treino", id=plano["id"], nome="ABC", dias=dias)
    assert editado["dias"][0]["nome"] == "Treino A (peito)"
    assert editado["ativo"] is True  # omitir ativo na edição mantém o estado
    assert len(mcp_call("listar_treinos")["itens"]) == 1
    assert mcp_call("excluir_treino", id=plano["id"]) == {"ok": True}
    with pytest.raises(ToolError, match="não encontrado"):
        mcp_call("excluir_treino", id=plano["id"])


def test_dieta_e_alimentos(mcp_call):
    dieta = mcp_call("salvar_dieta", nome="Cutting", refeicoes=REFEICOES, ativo=True)
    assert dieta["calorias_calculadas"] == 155 and dieta["ativo"] is True
    editada = mcp_call("salvar_dieta", id=dieta["id"], nome="Cutting 2", refeicoes=REFEICOES)
    assert editada["ativo"] is True and editada["nome"] == "Cutting 2"
    assert len(mcp_call("listar_dietas")["itens"]) == 1
    alimentos = mcp_call("buscar_alimento", q="arroz")["itens"]
    assert alimentos and {"nome", "calorias_100g"} <= alimentos[0].keys()
    assert mcp_call("excluir_dieta", id=dieta["id"]) == {"ok": True}
