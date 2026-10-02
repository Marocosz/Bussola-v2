import pytest

from app.schemas.estudos_blocos import (
    MAX_BLOCOS, MODELOS, BlocosInvalidos, catalogo, citacoes, validar_fontes, validar_material,
)
from tests.estudos_amostras import FONTES, blocos_todos_os_tipos, quiz, texto


def test_todos_os_tipos_validos_e_ids_gerados():
    blocos, seq = validar_material("aula", blocos_todos_os_tipos(), len(FONTES))
    assert [b["id"] for b in blocos] == [f"b{i}" for i in range(1, 16)]
    assert seq == 15
    assert next(iter(blocos[0])) == "id"
    assert blocos[9]["estilo"] == "checklist"
    assert "legenda" not in validar_material("aula", [{"tipo": "codigo", "linguagem": "go", "codigo": "x"}], 0)[0][0]


def test_preserva_ids_e_continua_a_sequencia():
    blocos, seq = validar_material("aula", [dict(texto("a"), id="b7"), texto("b")], 0)
    assert [b["id"] for b in blocos] == ["b7", "b8"] and seq == 8
    blocos, seq = validar_material("aula", [texto("a")], 0, seq_bloco=20)
    assert blocos[0]["id"] == "b21" and seq == 21
    blocos, _ = validar_material("aula", [dict(texto("a"), id="intro"), texto("b")], 0)
    assert [b["id"] for b in blocos] == ["intro", "b1"]


def test_id_repetido_rejeitado():
    with pytest.raises(BlocosInvalidos, match=r"bloco 2 \(texto\): id 'b1' repetido \(já usado no bloco 1\)"):
        validar_material("aula", [dict(texto("a"), id="b1"), dict(texto("b"), id="b1")], 0)


def test_tipo_desconhecido_ou_ausente():
    with pytest.raises(BlocosInvalidos, match=r"bloco 1: tipo 'video' desconhecido\. Tipos válidos: secao"):
        validar_material("aula", [{"tipo": "video"}], 0)
    with pytest.raises(BlocosInvalidos, match=r"bloco 2: informe 'tipo'"):
        validar_material("aula", [texto("a"), {"conteudo": "x"}], 0)
    with pytest.raises(BlocosInvalidos, match=r"bloco 1: deve ser um objeto"):
        validar_material("aula", ["texto solto"], 0)


def test_mensagens_em_portugues_com_local():
    sem_explicacao = quiz()
    del sem_explicacao["explicacao"]
    with pytest.raises(BlocosInvalidos, match=r"^bloco 1 \(quiz\): 'explicacao' é obrigatório$"):
        validar_material("exercicios", [sem_explicacao], 1)
    with pytest.raises(BlocosInvalidos, match=r"bloco 1 \(passos\): 'passos' precisa de pelo menos 2 item"):
        validar_material("aula", [{"tipo": "passos", "passos": [{"titulo": "a", "texto": "b"}]}], 0)
    with pytest.raises(BlocosInvalidos, match=r"bloco 1 \(texto\): campo 'cor' não existe neste tipo"):
        validar_material("aula", [dict(texto("a"), cor="red")], 0)
    with pytest.raises(BlocosInvalidos, match=r"bloco 1 \(alerta\): 'nivel' deve ser um de"):
        validar_material("aula", [{"tipo": "alerta", "nivel": "info", "texto": "x"}], 0)
    with pytest.raises(BlocosInvalidos, match=r"bloco 1 \(texto\): 'conteudo' não pode ser vazio"):
        validar_material("aula", [texto("   ")], 0)


def test_quiz_correta_fora_do_intervalo():
    q = quiz(opcoes=["a", "b", "c", "d"], correta=5)
    with pytest.raises(BlocosInvalidos, match=r"^bloco 4 \(quiz\): 'correta' = 5, mas há 4 opções"):
        validar_material("exercicios", [texto("x"), texto("y"), texto("z"), q], 1)
    with pytest.raises(BlocosInvalidos, match=r"'correta' = -1"):
        validar_material("exercicios", [quiz(correta=-1)], 1)


def test_quiz_numero_de_opcoes():
    with pytest.raises(BlocosInvalidos, match=r"'opcoes' precisa de pelo menos 2"):
        validar_material("exercicios", [quiz(opcoes=["a"], correta=0)], 1)
    with pytest.raises(BlocosInvalidos, match=r"'opcoes' aceita no máximo 6"):
        validar_material("exercicios", [quiz(opcoes=list("abcdefg"), correta=0)], 1)


def test_comparacao_valores_e_destaque():
    base = {"tipo": "comparacao", "colunas": ["A", "B", "C"]}
    with pytest.raises(BlocosInvalidos, match=r"bloco 1 \(comparacao\): linhas\[0\] tem 2 valores, mas há 3 colunas"):
        validar_material("comparativo", [dict(base, linhas=[{"rotulo": "x", "valores": ["1", "2"]}])], 0)
    with pytest.raises(BlocosInvalidos, match=r"linhas\[0\]\.destaque = 3, mas há 3 colunas"):
        validar_material("comparativo", [dict(base, linhas=[{"rotulo": "x", "valores": ["1", "2", "3"], "destaque": 3}])], 0)
    with pytest.raises(BlocosInvalidos, match=r"'colunas' precisa de pelo menos 2"):
        validar_material("comparativo", [{"tipo": "comparacao", "colunas": ["A"], "linhas": [{"rotulo": "x", "valores": ["1"]}]}], 0)


def test_citacoes_scanner_segue_a_gramatica():
    assert citacoes("a [1] `[2]` \\[3] [x] [12] [1234] [0]") == [1, 12, 0]
    assert citacoes("crase `sem par [2]") == [2]
    assert citacoes("`a\n\n[3]`") == [3]  # código não atravessa parágrafo
    assert citacoes("**negrito [4]** e *itálico [5]*") == [4, 5]


def test_citacao_fora_do_intervalo():
    with pytest.raises(BlocosInvalidos, match=r"bloco 1 \(texto\): citação \[3\] em 'conteudo', mas o material tem 2 fonte"):
        validar_material("aula", [texto("x [3]")], 2)
    with pytest.raises(BlocosInvalidos, match=r"citação \[1\] em 'passos\[1\]\.texto', mas o material não tem fontes"):
        validar_material("aula", [{"tipo": "passos", "passos": [{"titulo": "a", "texto": "b"}, {"titulo": "c", "texto": "d [1]"}]}], 0)
    with pytest.raises(BlocosInvalidos, match=r"citação \[0\]"):
        validar_material("aula", [texto("x [0]")], 2)
    with pytest.raises(BlocosInvalidos, match=r"'itens\[1\]'"):
        validar_material("aula", [{"tipo": "lista", "itens": ["ok", "fonte [9]"]}], 1)


def test_citacao_em_codigo_escapada_ou_em_campo_literal_e_ignorada():
    blocos = [
        texto("use `a[3]` e \\[9] literal"),
        {"tipo": "secao", "titulo": "Referência [7]"},          # título é literal
        {"tipo": "codigo", "linguagem": "python", "codigo": "x[1]"},
    ]
    assert len(validar_material("aula", blocos, 0)[0]) == 3


def test_minimos_por_tipo_de_material():
    with pytest.raises(BlocosInvalidos, match=r"material do tipo 'comparativo' exige pelo menos 1 bloco 'comparacao'"):
        validar_material("comparativo", [texto("x")], 1)
    with pytest.raises(BlocosInvalidos, match=r"material do tipo 'exercicios' exige pelo menos 1 bloco 'quiz' ou 'questao_aberta'"):
        validar_material("exercicios", [texto("x")], 1)
    assert validar_material("resumo", [texto("x")], 1)
    with pytest.raises(BlocosInvalidos, match=r"tipo de material 'apostila' inválido"):
        validar_material("apostila", [texto("x")], 1)


def test_limite_de_blocos():
    grandes = [texto("x" * 6000) for _ in range(MAX_BLOCOS)]
    blocos, seq = validar_material("aula", grandes, 0)
    assert len(blocos) == 200 and seq == 200
    with pytest.raises(BlocosInvalidos, match=r"o material aceita no máximo 200 blocos \(recebeu 201\)"):
        validar_material("aula", grandes + [texto("y")], 0)
    with pytest.raises(BlocosInvalidos, match=r"o material precisa de pelo menos 1 bloco"):
        validar_material("aula", [], 0)
    with pytest.raises(BlocosInvalidos, match=r"'conteudo' passa do limite de 6000 caracteres"):
        validar_material("aula", [texto("x" * 6001)], 0)


def test_diagrama_e_formula_nao_sao_interpretados_no_servidor():
    blocos = [
        {"tipo": "diagrama", "mermaid": "graph TD; A-->"},      # sintaxe Mermaid inválida
        {"tipo": "formula", "latex": "\\frac{1}{"},             # LaTeX inválido
    ]
    assert len(validar_material("aula", blocos, 0)[0]) == 2


def test_fontes():
    assert validar_fontes(None) == []
    assert validar_fontes(FONTES)[1]["url"] == "https://peps.python.org/pep-0008/"
    with pytest.raises(BlocosInvalidos, match=r"fonte 1: 'url' deve começar com http:// ou https://"):
        validar_fontes([{"titulo": "x", "url": "javascript:alert(1)"}])
    with pytest.raises(BlocosInvalidos, match=r"fonte 2: 'titulo' é obrigatório"):
        validar_fontes([FONTES[0], {"url": "https://a.dev"}])
    with pytest.raises(BlocosInvalidos, match=r"no máximo 50 fontes"):
        validar_fontes([FONTES[0]] * 51)


def test_catalogo_cobre_todos_os_tipos_e_exemplos_validam():
    cat = catalogo()
    assert cat["versao_formato"] == 1
    assert set(cat["blocos"]) == set(MODELOS)
    assert cat["minimos_por_tipo_material"] == {"comparativo": ["comparacao"], "exercicios": ["quiz", "questao_aberta"]}
    assert cat["limites"]["blocos_por_material"] == 200
    for tipo, desc in cat["blocos"].items():
        campos_modelo = set(MODELOS[tipo].model_fields) - {"id", "tipo"}
        assert set(desc["campos"]) == campos_modelo, tipo
        assert set(desc["obrigatorios"]) <= campos_modelo
        material = "comparativo" if tipo == "comparacao" else ("exercicios" if tipo in ("quiz", "questao_aberta") else "aula")
        validar_material(material, [desc["exemplo"]], 2)
    assert cat["blocos"]["quiz"]["obrigatorios"] == ["pergunta", "opcoes", "correta", "explicacao"]
    assert "texto.conteudo" in cat["formatacao_inline"]["campos"]
