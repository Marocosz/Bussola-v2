"""
=======================================================================================
ARQUIVO: tools/financas.py (MCP - Finanças)
=======================================================================================

OBJETIVO:
    Transações, categorias e ajustes de caixa. Só traduz argumentos para o
    financas_service — a regra de negócio continua no service.
=======================================================================================
"""

from datetime import date, datetime, time
from typing import Any, Literal, Optional

from dateutil.relativedelta import relativedelta
from fastapi.encoders import jsonable_encoder
from mcp.server.mcpserver.exceptions import ToolError

from app.core.timezone import now_local
from app.mcp.context import ESCOPO_ESCRITA, apenas_informados, exigir, usuario_e_db
from app.mcp.resolvers import resolver_categoria
from app.mcp.tools import registrar
from app.schemas.caixa import AjusteCaixaCreate, AjusteCaixaUpdate
from app.schemas.financas import CategoriaCreate, CategoriaUpdate, TransacaoCreate, TransacaoUpdate
from app.services.financas import financas_service
from app.services.panorama import panorama_service

Tipo = Literal["receita", "despesa"]
Pagamento = Literal["pix", "credito", "debito", "transferencia"]


def parse_mes(mes: Optional[str]) -> datetime:
    """'AAAA-MM' -> primeiro dia do mês (None = mês atual)."""
    if not mes:
        return datetime.combine(now_local().date().replace(day=1), time())
    try:
        return datetime.strptime(mes, "%Y-%m")
    except ValueError:
        raise ToolError(f"Mês inválido: '{mes}'. Use o formato AAAA-MM, ex.: 2026-10.")


def _quando(dia: Optional[date]) -> Optional[datetime]:
    return datetime.combine(dia, time()) if dia else None


def _transacao(t) -> dict[str, Any]:
    return {
        "id": t.id,
        "descricao": t.descricao,
        "valor": t.valor,
        "data": t.data.date().isoformat(),
        "categoria": t.categoria.nome if t.categoria else None,
        "tipo": t.categoria.tipo if t.categoria else None,
        "status": t.status,
        "tipo_pagamento": t.tipo_pagamento,
        "tipo_recorrencia": t.tipo_recorrencia,
        "parcela": f"{t.parcela_atual}/{t.total_parcelas}" if t.total_parcelas else None,
    }


def _categoria(c) -> dict[str, Any]:
    return {"id": c.id, "nome": c.nome, "tipo": c.tipo, "meta_limite": c.meta_limite, "icone": c.icone, "cor": c.cor}


def _ajuste(a) -> dict[str, Any]:
    return {"id": a.id, "tipo": a.tipo, "valor": a.valor,
            "data": a.data.date().isoformat() if a.data else None, "observacao": a.observacao}


# --- Leitura ---

def resumo_financeiro(mes: Optional[str] = None) -> dict[str, Any]:
    """Resumo de um mês ('AAAA-MM', padrão = atual): receitas e despesas efetivadas, balanço,
    caixa total, quanto falta pagar/receber (pendentes), orçamento por categoria e previsão."""
    with usuario_e_db() as (db, user):
        inicio = parse_mes(mes)
        dados = panorama_service.get_dashboard_data(db, user.id, start_date=inicio,
                                                    end_date=inicio + relativedelta(months=1))
        kpis = jsonable_encoder(dados["kpis"])
        pendentes = financas_service.listar_transacoes(db, user.id, mes=inicio.strftime("%Y-%m"),
                                                       status="Pendente", limite=1000)
        return {
            "mes": inicio.strftime("%Y-%m"),
            "receita": kpis["receita_mes"],
            "despesa": kpis["despesa_mes"],
            "balanco": kpis["balanco_mes"],
            "caixa": kpis["caixa"],
            "a_pagar": round(sum(t.valor for t in pendentes if t.categoria.tipo == "despesa"), 2),
            "a_receber": round(sum(t.valor for t in pendentes if t.categoria.tipo == "receita"), 2),
            "orcamento": jsonable_encoder(dados.get("orcamento", [])),
            "previsao": jsonable_encoder(dados.get("forecast")),
        }


def listar_transacoes(
    mes: Optional[str] = None,
    categoria: Optional[str] = None,
    tipo: Optional[Tipo] = None,
    status: Optional[Literal["Pendente", "Efetivada"]] = None,
    busca: Optional[str] = None,
    limite: int = 50,
) -> dict[str, Any]:
    """Lista transações, mais recentes primeiro. Filtros: mes ('AAAA-MM'), categoria (nome ou id),
    tipo (receita/despesa), status, busca (trecho da descrição). limite máx. 200."""
    with usuario_e_db() as (db, user):
        categoria_id = resolver_categoria(db, user.id, categoria, tipo).id if categoria else None
        transacoes = financas_service.listar_transacoes(
            db, user.id, mes=parse_mes(mes).strftime("%Y-%m") if mes else None, categoria_id=categoria_id,
            tipo=tipo, status=status, busca=busca, limite=min(limite, 200),
        )
        return {"itens": [_transacao(t) for t in transacoes]}


def listar_categorias(tipo: Optional[Tipo] = None) -> dict[str, Any]:
    """Categorias de receita/despesa com o limite mensal (meta_limite) de cada uma."""
    with usuario_e_db() as (db, user):
        return {"itens": [_categoria(c) for c in financas_service.listar_categorias(db, user.id, tipo)]}


# --- Escrita ---

def salvar_transacao(
    id: Optional[int] = None,
    descricao: Optional[str] = None,
    valor: Optional[float] = None,
    data: Optional[date] = None,
    categoria: Optional[str] = None,
    tipo: Optional[Tipo] = None,
    status: Optional[Literal["Pendente", "Efetivada"]] = None,
    tipo_pagamento: Optional[Pagamento] = None,
    tipo_recorrencia: Literal["pontual", "parcelada", "recorrente"] = "pontual",
    total_parcelas: Optional[int] = None,
    frequencia: Optional[Literal["semanal", "mensal", "anual"]] = None,
    aplicar_valor_em: Literal["apenas", "futuras"] = "apenas",
) -> dict[str, Any]:
    """Cria (sem id) ou edita (com id; só os campos enviados) uma transação.
    categoria: nome ou id; tipo (receita/despesa) desempata nomes iguais.
    Criar exige descricao, valor e categoria; data padrão = hoje. Pontual nasce Efetivada.
    Parcelada: valor = total e exige total_parcelas. Recorrente exige frequencia.
    Em séries, aplicar_valor_em="futuras" leva a mudança de valor às próximas ocorrências."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        categoria_id = resolver_categoria(db, user.id, categoria, tipo).id if categoria else None
        if id is None:
            if not (descricao and valor is not None and categoria_id):
                raise ToolError("Para criar, informe descricao, valor e categoria.")
            if tipo_recorrencia == "parcelada" and not total_parcelas:
                raise ToolError("Transação parcelada exige total_parcelas.")
            if tipo_recorrencia == "recorrente" and not frequencia:
                raise ToolError("Transação recorrente exige frequencia.")
            dados = TransacaoCreate(**apenas_informados(
                descricao=descricao, valor=valor, data=_quando(data or now_local().date()),
                categoria_id=categoria_id, status=status, tipo_pagamento=tipo_pagamento,
                tipo_recorrencia=tipo_recorrencia, total_parcelas=total_parcelas, frequencia=frequencia,
            ))
            transacao = financas_service.criar_transacao(db, dados, user.id)
        else:
            dados = TransacaoUpdate(**apenas_informados(
                descricao=descricao, valor=valor, data=_quando(data), categoria_id=categoria_id,
                status=status, tipo_pagamento=tipo_pagamento,
            ), escopo_valor=aplicar_valor_em)
            transacao = exigir(financas_service.atualizar_transacao(db, id, dados, user.id),
                               f"Transação {id} não encontrada.")
        db.refresh(transacao)
        return _transacao(transacao)


def marcar_pagamento(id: int, pago: bool = True) -> dict[str, Any]:
    """Marca a transação como paga/recebida (Efetivada) ou pendente. Pode repetir sem efeito colateral."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        transacao = exigir(
            financas_service.definir_status_transacao(db, id, "Efetivada" if pago else "Pendente", user.id),
            f"Transação {id} não encontrada.",
        )
        return _transacao(transacao)


def encerrar_recorrencia(id: int) -> dict[str, Any]:
    """Encerra uma série recorrente/parcelada: apaga as ocorrências pendentes e preserva o histórico."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        resultado = financas_service.encerrar_recorrencia(db, id, user.id)
        if "error" in resultado:
            raise ToolError(resultado["error"])
        return resultado


def excluir_transacao(id: int) -> dict[str, Any]:
    """Exclui uma transação. Em série (recorrente/parcelada) sem nada efetivado, exclui a série toda;
    com algo efetivado, recusa — use encerrar_recorrencia."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        exigir(financas_service.excluir_transacao(db, id, user.id), f"Transação {id} não encontrada.")
        return {"ok": True}


def salvar_categoria(
    id: Optional[int] = None,
    nome: Optional[str] = None,
    tipo: Optional[Tipo] = None,
    meta_limite: Optional[float] = None,
    icone: Optional[str] = None,
    cor: Optional[str] = None,
) -> dict[str, Any]:
    """Cria (sem id; exige nome e tipo) ou edita (com id) uma categoria. meta_limite = orçamento mensal;
    icone = classe Font Awesome (ex.: 'fa-solid fa-cart-shopping'); cor = hex."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        campos = apenas_informados(nome=nome, tipo=tipo, meta_limite=meta_limite, icone=icone, cor=cor)
        if id is None:
            if not (nome and tipo):
                raise ToolError("Para criar, informe nome e tipo.")
            categoria = financas_service.criar_categoria(db, CategoriaCreate(**campos), user.id)
        else:
            categoria = exigir(financas_service.atualizar_categoria(db, id, CategoriaUpdate(**campos), user.id),
                               f"Categoria {id} não encontrada.")
        return _categoria(categoria)


def excluir_categoria(categoria: str) -> dict[str, Any]:
    """Exclui uma categoria (nome ou id). As transações dela vão para 'Indefinida'."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        alvo = resolver_categoria(db, user.id, categoria)
        financas_service.excluir_categoria(db, alvo.id, user.id)
        return {"ok": True}


def salvar_ajuste_caixa(
    id: Optional[int] = None,
    tipo: Optional[Literal["entrada", "saida"]] = None,
    valor: Optional[float] = None,
    data: Optional[date] = None,
    observacao: Optional[str] = None,
) -> dict[str, Any]:
    """Cria (sem id; exige valor; tipo padrão entrada) ou edita um ajuste de caixa: dinheiro fora das
    transações do mês (saldo inicial, correções). Não conta como receita/despesa."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        campos = apenas_informados(tipo=tipo, valor=valor, data=_quando(data), observacao=observacao)
        if id is None:
            if valor is None:
                raise ToolError("Para criar, informe o valor.")
            ajuste = financas_service.criar_ajuste(db, AjusteCaixaCreate(**campos), user.id)
        else:
            ajuste = exigir(financas_service.atualizar_ajuste(db, id, AjusteCaixaUpdate(**campos), user.id),
                            f"Ajuste {id} não encontrado.")
        return _ajuste(ajuste)


def excluir_ajuste_caixa(id: int) -> dict[str, Any]:
    """Exclui um ajuste de caixa."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        exigir(financas_service.deletar_ajuste(db, id, user.id), f"Ajuste {id} não encontrado.")
        return {"ok": True}


def register(mcp):
    registrar(
        mcp,
        leitura=(resumo_financeiro, listar_transacoes, listar_categorias),
        escrita=(salvar_transacao, marcar_pagamento, encerrar_recorrencia, salvar_categoria, salvar_ajuste_caixa),
        destrutivas=(excluir_transacao, excluir_categoria, excluir_ajuste_caixa),
    )
