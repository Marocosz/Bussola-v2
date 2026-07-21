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
