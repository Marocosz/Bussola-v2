from app.services.estudos import estudos_service
from tests.estudos_amostras import FONTES, quiz, texto

BASE = "/api/v1/estudos"


def _exercicios(db, user, **campos):
    return estudos_service.criar_material(
        db, user.id, tipo="exercicios", titulo=campos.pop("titulo", "Exercícios de Python"),
        blocos=[texto("Enunciado [1]."), quiz(correta=1),
                {"tipo": "questao_aberta", "pergunta": "Explique.", "resposta_modelo": "Assim [2]."}],
        fontes=FONTES, **campos,
    )


def test_listar_temas_e_materiais(client, db, user):
    tema = estudos_service.salvar_tema(db, user.id, nome="Python", cor="#10b981")
    m = _exercicios(db, user, tema_id=tema.id, tags=["python"])
    temas = client.get(f"{BASE}/temas").json()
    assert temas == [{"id": tema.id, "nome": "Python", "cor": "#10b981", "icone": "fa-book-open",
                      "descricao": None, "total_materiais": 1}]
    lista = client.get(f"{BASE}/materiais").json()
    assert [x["id"] for x in lista] == [m.id]
    assert lista[0]["tema_nome"] == "Python" and lista[0]["estudado"] is False and "blocos" not in lista[0]
    assert client.get(f"{BASE}/materiais", params={"tipo": "aula"}).json() == []
    assert len(client.get(f"{BASE}/materiais", params={"tema_id": tema.id, "estudado": "false"}).json()) == 1
    assert len(client.get(f"{BASE}/materiais", params={"busca": "pyth"}).json()) == 1


def test_ler_material_e_404_de_outro_usuario(client, db, user, outro_user):
    m = _exercicios(db, user)
    corpo = client.get(f"{BASE}/materiais/{m.id}").json()
    assert [b["id"] for b in corpo["blocos"]] == ["b1", "b2", "b3"]
    assert corpo["fontes"][1]["url"] == FONTES[1]["url"] and corpo["tema_cor"] is None
    alheio = _exercicios(db, outro_user)
    r = client.get(f"{BASE}/materiais/{alheio.id}")
    assert r.status_code == 404 and r.json()["detail"] == "Material não encontrado"


def test_resposta_quiz_acertou_calculado_no_servidor(client, db, user):
    m = _exercicios(db, user)
    errada = client.post(f"{BASE}/materiais/{m.id}/respostas", json={"bloco_id": "b2", "resposta": 0, "acertou": True})
    assert errada.status_code == 200, errada.text
    assert errada.json()["acertou"] is False
    certa = client.post(f"{BASE}/materiais/{m.id}/respostas", json={"bloco_id": "b2", "resposta": 1})
    assert certa.json()["acertou"] is True and certa.json()["resposta"] == 1


def test_resposta_questao_aberta_usa_acertou_do_cliente(client, db, user):
    m = _exercicios(db, user)
    r = client.post(f"{BASE}/materiais/{m.id}/respostas", json={"bloco_id": "b3", "resposta": "minha", "acertou": False})
    assert r.status_code == 200 and r.json()["acertou"] is False and r.json()["resposta"] == "minha"
    sem = client.post(f"{BASE}/materiais/{m.id}/respostas", json={"bloco_id": "b3"})
    assert sem.status_code == 400 and "acertou" in sem.json()["detail"]


def test_resposta_invalida_400_e_nada_gravado(client, db, user):
    m = _exercicios(db, user)
    estudos_service.editar_blocos(db, m.id, user.id, [{"op": "remover", "id": "b2"}])
    removido = client.post(f"{BASE}/materiais/{m.id}/respostas", json={"bloco_id": "b2", "resposta": 1})
    assert removido.status_code == 400 and "não existe mais" in removido.json()["detail"]
    nao_pergunta = client.post(f"{BASE}/materiais/{m.id}/respostas", json={"bloco_id": "b1", "resposta": 0})
    assert nao_pergunta.status_code == 400 and "não aceita resposta" in nao_pergunta.json()["detail"]
    m2 = _exercicios(db, user, titulo="Outro")
    fora = client.post(f"{BASE}/materiais/{m2.id}/respostas", json={"bloco_id": "b2", "resposta": 7})
    assert fora.status_code == 400 and "Opção 7 não existe" in fora.json()["detail"]
    assert client.post(f"{BASE}/materiais/99999/respostas", json={"bloco_id": "b2", "resposta": 1}).status_code == 404
    assert client.post(f"{BASE}/materiais/{m2.id}/respostas", json={"bloco_id": "", "resposta": 1}).status_code == 422
    assert estudos_service.listar_respostas(db, user.id) == []


def test_estudado_patch_idempotente(client, db, user):
    m = _exercicios(db, user)
    a = client.patch(f"{BASE}/materiais/{m.id}/estudado", json={"estudado": True}).json()
    b = client.patch(f"{BASE}/materiais/{m.id}/estudado", json={"estudado": True}).json()
    assert a["estudado"] is True and a["estudado_em"] == b["estudado_em"]
    c = client.patch(f"{BASE}/materiais/{m.id}/estudado", json={"estudado": False}).json()
    assert c["estudado"] is False and c["estudado_em"] is None
    assert client.patch(f"{BASE}/materiais/99999/estudado", json={"estudado": True}).status_code == 404


def test_delete_material(client, db, user):
    m = _exercicios(db, user)
    client.post(f"{BASE}/materiais/{m.id}/respostas", json={"bloco_id": "b2", "resposta": 1})
    assert client.delete(f"{BASE}/materiais/{m.id}").json() == {"ok": True}
    assert client.get(f"{BASE}/materiais/{m.id}").status_code == 404
    assert client.delete(f"{BASE}/materiais/{m.id}").status_code == 404
    assert estudos_service.listar_respostas(db, user.id) == []


def test_respondidos_do_material_ultima_resposta_por_bloco(client, db, user, outro_user):
    m = _exercicios(db, user)
    assert client.get(f"{BASE}/materiais/{m.id}/respostas").json() == []
    client.post(f"{BASE}/materiais/{m.id}/respostas", json={"bloco_id": "b2", "resposta": 0})
    client.post(f"{BASE}/materiais/{m.id}/respostas", json={"bloco_id": "b2", "resposta": 1})
    client.post(f"{BASE}/materiais/{m.id}/respostas", json={"bloco_id": "b3", "resposta": "x", "acertou": False})
    corpo = client.get(f"{BASE}/materiais/{m.id}/respostas").json()
    assert sorted((r["bloco_id"], r["acertou"]) for r in corpo) == [("b2", True), ("b3", False)]
    alheio = _exercicios(db, outro_user)
    assert client.get(f"{BASE}/materiais/{alheio.id}/respostas").status_code == 404
