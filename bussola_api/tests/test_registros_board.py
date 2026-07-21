from app.models.registros import Tarefa, StatusTarefa


def test_tarefa_tem_ordem_default_zero(db, user):
    t = Tarefa(titulo="X", user_id=user.id)
    db.add(t)
    db.commit()
    db.refresh(t)
    assert t.ordem == 0


def test_status_cancelado_existe_no_enum():
    assert StatusTarefa.CANCELADO.value == "Cancelado"
