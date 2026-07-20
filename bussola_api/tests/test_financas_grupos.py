"""
Edição de transações agrupadas (parcelada/recorrente) com alcance:
- categoria/descrição propagam ao grupo inteiro;
- valor respeita escopo 'apenas' vs 'futuras';
- parcelada recalcula o total exibido como a soma real das parcelas.
"""
from datetime import datetime
from dateutil.relativedelta import relativedelta

from app.models.financas import Categoria, Transacao
from app.services.financas import financas_service
from app.schemas.financas import TransacaoUpdate


def _cat(db, user, nome="Cat", tipo="despesa"):
    c = Categoria(nome=nome, tipo=tipo, user_id=user.id)
    db.add(c); db.commit(); db.refresh(c)
    return c


def _grupo_recorrente(db, user, cat, base=datetime(2026, 1, 10), n=4, valor=100.0):
    grupo = "grp-rec"
    rows = []
    for i in range(n):
        t = Transacao(
            descricao="Netflix", valor=valor, data=base + relativedelta(months=i),
            categoria_id=cat.id, tipo_recorrencia="recorrente",
            id_grupo_recorrencia=grupo, status="Pendente", user_id=user.id,
        )
        db.add(t); rows.append(t)
    db.commit()
    for t in rows: db.refresh(t)
    return rows


def test_categoria_propaga_grupo_inteiro(db, user):
    cat = _cat(db, user, "Antiga")
    nova = _cat(db, user, "Nova")
    rows = _grupo_recorrente(db, user, cat)
    meio = rows[1]
    financas_service.atualizar_transacao(db, meio.id, TransacaoUpdate(categoria_id=nova.id), user.id)
    for t in rows:
        db.refresh(t)
        assert t.categoria_id == nova.id


def test_descricao_propaga_grupo_inteiro(db, user):
    cat = _cat(db, user)
    rows = _grupo_recorrente(db, user, cat)
    financas_service.atualizar_transacao(db, rows[2].id, TransacaoUpdate(descricao="Netflix Premium"), user.id)
    for t in rows:
        db.refresh(t)
        assert t.descricao == "Netflix Premium"


def test_valor_apenas_altera_so_alvo(db, user):
    cat = _cat(db, user)
    rows = _grupo_recorrente(db, user, cat, valor=100.0)
    meio = rows[1]
    financas_service.atualizar_transacao(db, meio.id, TransacaoUpdate(valor=200.0, escopo_valor="apenas"), user.id)
    db.refresh(meio)
    assert meio.valor == 200.0
    for t in (rows[0], rows[2], rows[3]):
        db.refresh(t)
        assert t.valor == 100.0


def test_valor_futuras_altera_alvo_e_posteriores(db, user):
    cat = _cat(db, user)
    rows = _grupo_recorrente(db, user, cat, valor=100.0)
    meio = rows[1]  # base + 1 mês
    financas_service.atualizar_transacao(db, meio.id, TransacaoUpdate(valor=200.0, escopo_valor="futuras"), user.id)
    db.refresh(rows[0])
    assert rows[0].valor == 100.0  # anterior intacto
    for t in (rows[1], rows[2], rows[3]):
        db.refresh(t)
        assert t.valor == 200.0


def test_valor_parcela_recalcula_total(db, user):
    cat = _cat(db, user)
    grupo = "grp-parc"
    base = datetime(2026, 1, 10)
    rows = []
    for i in range(3):
        t = Transacao(
            descricao="TV", valor=100.0, data=base + relativedelta(months=i),
            categoria_id=cat.id, tipo_recorrencia="parcelada",
            parcela_atual=i + 1, total_parcelas=3, valor_total_parcelamento=300.0,
            id_grupo_recorrencia=grupo, status="Pendente", user_id=user.id,
        )
        db.add(t); rows.append(t)
    db.commit()
    for t in rows: db.refresh(t)

    # muda só a 1ª parcela para 150 → total real = 150 + 100 + 100 = 350
    financas_service.atualizar_transacao(db, rows[0].id, TransacaoUpdate(valor=150.0, escopo_valor="apenas"), user.id)
    for t in rows: db.refresh(t)
    assert rows[0].valor == 150.0
    assert rows[1].valor == 100.0 and rows[2].valor == 100.0
    for t in rows:
        assert t.valor_total_parcelamento == 350.0


def test_pontual_nao_propaga(db, user):
    cat = _cat(db, user)
    t = Transacao(descricao="Café", valor=10.0, data=datetime(2026, 1, 5),
                  categoria_id=cat.id, tipo_recorrencia="pontual",
                  status="Efetivada", user_id=user.id)
    db.add(t); db.commit(); db.refresh(t)
    out = financas_service.atualizar_transacao(db, t.id, TransacaoUpdate(valor=25.0), user.id)
    assert out.valor == 25.0
