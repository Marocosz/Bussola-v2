from datetime import datetime

import pytest

from app.models.financas import Categoria, Transacao
from app.schemas.financas import CategoriaCreate, CategoriaUpdate, TransacaoCreate
from app.services.financas import financas_service


@pytest.fixture
def cats(db, user):
    mercado = Categoria(nome="Mercado", tipo="despesa", user_id=user.id)
    salario = Categoria(nome="Salário", tipo="receita", user_id=user.id)
    db.add_all([mercado, salario])
    db.commit()
    return mercado, salario


def _t(db, user, cat, descricao, valor, data, **extra):
    return financas_service.criar_transacao(
        db, TransacaoCreate(descricao=descricao, valor=valor, data=data, categoria_id=cat.id, **extra), user.id
    )


def test_listar_transacoes_filtros(db, user, cats):
    mercado, salario = cats
    _t(db, user, mercado, "Feira", 10, datetime(2026, 10, 1))
    _t(db, user, salario, "Salário", 5000, datetime(2026, 10, 5))
    _t(db, user, mercado, "Antiga", 7, datetime(2026, 9, 1))
    assert [t.descricao for t in financas_service.listar_transacoes(db, user.id, mes="2026-10", tipo="despesa")] == ["Feira"]
    assert len(financas_service.listar_transacoes(db, user.id, categoria_id=mercado.id)) == 2
    assert [t.descricao for t in financas_service.listar_transacoes(db, user.id, busca="feir")] == ["Feira"]
    assert len(financas_service.listar_transacoes(db, user.id, limite=1)) == 1


def test_definir_status_e_excluir_pontual(db, user, cats):
    t = _t(db, user, cats[0], "Feira", 10, datetime(2026, 10, 1))
    assert financas_service.definir_status_transacao(db, t.id, "Pendente", user.id).status == "Pendente"
    assert financas_service.excluir_transacao(db, t.id, user.id) is True
    assert financas_service.excluir_transacao(db, t.id, user.id) is False


def test_excluir_serie_com_efetivada_bloqueia(db, user, cats):
    t = _t(db, user, cats[0], "TV", 300, datetime(2026, 10, 1), tipo_recorrencia="parcelada", total_parcelas=3)
    financas_service.definir_status_transacao(db, t.id, "Efetivada", user.id)
    with pytest.raises(ValueError, match="efetivados"):
        financas_service.excluir_transacao(db, t.id, user.id)


def test_categoria_crud_regras(db, user):
    c = financas_service.criar_categoria(db, CategoriaCreate(nome="Pets", tipo="despesa"), user.id)
    with pytest.raises(ValueError, match="Já existe"):
        financas_service.criar_categoria(db, CategoriaCreate(nome="pets", tipo="despesa"), user.id)
    with pytest.raises(ValueError, match="reservado"):
        financas_service.criar_categoria(db, CategoriaCreate(nome="Indefinida", tipo="despesa"), user.id)
    assert financas_service.atualizar_categoria(db, c.id, CategoriaUpdate(meta_limite=200), user.id).meta_limite == 200
    indef = financas_service.get_or_create_indefinida(db, "despesa", user.id)
    with pytest.raises(PermissionError):
        financas_service.excluir_categoria(db, indef.id, user.id)
    assert [x.nome for x in financas_service.listar_categorias(db, user.id, tipo="despesa")] == ["Indefinida (Despesa)", "Pets"]


def test_excluir_categoria_move_transacoes_so_do_usuario(db, user, cats):
    mercado = cats[0]
    t = _t(db, user, mercado, "Feira", 10, datetime(2026, 10, 1))
    assert financas_service.excluir_categoria(db, mercado.id, user.id) is True
    db.refresh(t)
    assert t.categoria.nome == "Indefinida (Despesa)"
    assert financas_service.excluir_categoria(db, mercado.id, user.id) is False
