from app.models.registros import Tarefa, StatusTarefa
from app.services.registros import registros_service
from app.schemas.registros import TarefaCreate


def test_tarefa_tem_ordem_default_zero(db, user):
    t = Tarefa(titulo="X", user_id=user.id)
    db.add(t)
    db.commit()
    db.refresh(t)
    assert t.ordem == 0


def test_status_cancelado_existe_no_enum():
    assert StatusTarefa.CANCELADO.value == "Cancelado"


def test_create_tarefa_recebe_ordem_no_fim_da_coluna(db, user):
    t1 = registros_service.create_tarefa(db, TarefaCreate(titulo="A"), user.id)
    t2 = registros_service.create_tarefa(db, TarefaCreate(titulo="B"), user.id)
    assert t1.ordem == 0
    assert t2.ordem == 1


def test_board_agrupa_e_ordena(client):
    client.post("/api/v1/registros/tarefas", json={"titulo": "P1"})
    client.post("/api/v1/registros/tarefas", json={"titulo": "P2"})
    client.post("/api/v1/registros/tarefas", json={"titulo": "A1", "status": "Em andamento"})

    client.post("/api/v1/registros/tarefas", json={"titulo": "B1", "status": "Bloqueado"})

    r = client.get("/api/v1/registros/tarefas/board")
    assert r.status_code == 200, r.text
    body = r.json()
    assert {"a_fazer", "em_andamento", "bloqueado", "concluido", "cancelado"} == set(body.keys())
    assert [t["titulo"] for t in body["a_fazer"]] == ["P1", "P2"]   # ordem asc
    assert len(body["em_andamento"]) == 1
    assert len(body["bloqueado"]) == 1
    assert body["a_fazer"][0]["ordem"] == 0


def test_reordenar_dentro_da_coluna(client):
    id1 = client.post("/api/v1/registros/tarefas", json={"titulo": "P1"}).json()["id"]
    id2 = client.post("/api/v1/registros/tarefas", json={"titulo": "P2"}).json()["id"]

    r = client.patch(
        "/api/v1/registros/tarefas/reordenar",
        json={"status": "Pendente", "tarefa_ids": [id2, id1]},
    )
    assert r.status_code == 200, r.text
    a_fazer = client.get("/api/v1/registros/tarefas/board").json()["a_fazer"]
    assert [t["id"] for t in a_fazer] == [id2, id1]


def test_reordenar_entre_colunas_muda_status_e_conclusao(client):
    tid = client.post("/api/v1/registros/tarefas", json={"titulo": "X"}).json()["id"]

    client.patch(
        "/api/v1/registros/tarefas/reordenar",
        json={"status": "Concluído", "tarefa_ids": [tid]},
    )
    board = client.get("/api/v1/registros/tarefas/board").json()
    assert [t["id"] for t in board["concluido"]] == [tid]
    assert board["concluido"][0]["data_conclusao"] is not None
    assert board["a_fazer"] == []

    client.patch(
        "/api/v1/registros/tarefas/reordenar",
        json={"status": "Em andamento", "tarefa_ids": [tid]},
    )
    board = client.get("/api/v1/registros/tarefas/board").json()
    assert board["em_andamento"][0]["data_conclusao"] is None


def test_reordenar_ignora_tarefa_de_outro_user(db, client, user):
    from app.models.user import User
    outro = User(email="outro@x.dev", hashed_password="y", is_active=True)
    db.add(outro)
    db.commit()
    db.refresh(outro)
    alheia = Tarefa(titulo="alheia", status="Pendente", user_id=outro.id)
    db.add(alheia)
    db.commit()
    db.refresh(alheia)

    r = client.patch(
        "/api/v1/registros/tarefas/reordenar",
        json={"status": "Concluído", "tarefa_ids": [alheia.id]},
    )
    assert r.status_code == 200
    db.refresh(alheia)
    assert alheia.status == "Pendente"   # inalterada
