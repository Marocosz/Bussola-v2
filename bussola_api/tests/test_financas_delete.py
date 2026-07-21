"""
Proteção de exclusão: histórico efetivado de séries (recorrente/parcelada) não
pode ser apagado; séries nunca efetivadas podem; pontual sempre pode.
"""
from datetime import datetime
from dateutil.relativedelta import relativedelta

from app.models.financas import Categoria, Transacao


def _cat(db, user):
    c = Categoria(nome="Cat", tipo="despesa", user_id=user.id)
    db.add(c); db.commit(); db.refresh(c)
    return c


def _grupo(db, user, cat, grupo, tipo, statuses):
    base = datetime(2026, 1, 10)
    for i, st in enumerate(statuses):
        db.add(Transacao(
            descricao="Serie", valor=100.0, data=base + relativedelta(months=i),
            categoria_id=cat.id, tipo_recorrencia=tipo, id_grupo_recorrencia=grupo,
            status=st, user_id=user.id,
        ))
    db.commit()


def test_delete_pontual_ok(client, db, user):
    cat = _cat(db, user)
    t = Transacao(descricao="Café", valor=10.0, data=datetime(2026, 1, 1), categoria_id=cat.id,
                  tipo_recorrencia="pontual", status="Efetivada", user_id=user.id)
    db.add(t); db.commit(); db.refresh(t)
    r = client.delete(f"/api/v1/financas/transacoes/{t.id}")
    assert r.status_code == 200
    assert db.query(Transacao).filter(Transacao.id == t.id).first() is None


def test_delete_grupo_com_efetivada_bloqueado(client, db, user):
    cat = _cat(db, user)
    _grupo(db, user, cat, "g1", "recorrente", ["Efetivada", "Pendente"])
    alvo = db.query(Transacao).filter(Transacao.id_grupo_recorrencia == "g1").first()
    r = client.delete(f"/api/v1/financas/transacoes/{alvo.id}")
    assert r.status_code == 400
    # nada foi removido — histórico protegido
    assert db.query(Transacao).filter(Transacao.id_grupo_recorrencia == "g1").count() == 2


def test_delete_grupo_sem_efetivada_remove(client, db, user):
    cat = _cat(db, user)
    _grupo(db, user, cat, "g2", "parcelada", ["Pendente", "Pendente", "Pendente"])
    alvo = db.query(Transacao).filter(Transacao.id_grupo_recorrencia == "g2").first()
    r = client.delete(f"/api/v1/financas/transacoes/{alvo.id}")
    assert r.status_code == 200
    assert db.query(Transacao).filter(Transacao.id_grupo_recorrencia == "g2").count() == 0
