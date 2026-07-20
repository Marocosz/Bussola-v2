"""
=======================================================================================
ARQUIVO: metas.py (Serviço de Domínio - Metas & Cofrinhos)
=======================================================================================
OBJETIVO:
    Lógica do sistema de metas: CRUD, aportes/retiradas (transferência neutra),
    projeção de data-alvo, KPIs de patrimônio e aporte mensal agendado.
=======================================================================================
"""

from dateutil.relativedelta import relativedelta

from app.core.timezone import now_utc
from app.models.metas import Meta, MovimentacaoMeta
from app.schemas.metas import MetaCreate, MetaUpdate, MovimentacaoCreate


class MetasService:

    # ---------- helpers internos ----------
    def _get_meta(self, db, meta_id, user_id):
        return (
            db.query(Meta)
            .filter(Meta.id == meta_id, Meta.user_id == user_id)
            .first()
        )

    def _recompute_saldo(self, db, meta: Meta) -> None:
        """Recalcula saldo_atual a partir das movimentações EFETIVADAS."""
        efetivadas = [m for m in meta.movimentacoes if m.status == "Efetivada"]
        total = sum(
            (m.valor if m.tipo == "aporte" else -m.valor) for m in efetivadas
        )
        meta.saldo_atual = round(total, 2)

        if meta.saldo_atual >= meta.valor_alvo and meta.status == "ativa":
            meta.status = "concluida"
            meta.concluida_em = now_utc()
        elif meta.saldo_atual < meta.valor_alvo and meta.status == "concluida":
            meta.status = "ativa"
            meta.concluida_em = None
        db.commit()
        db.refresh(meta)

    # ---------- CRUD ----------
    def criar_meta(self, db, meta_in: MetaCreate, user_id: int) -> Meta:
        meta = Meta(**meta_in.model_dump(), user_id=user_id)
        db.add(meta)
        db.commit()
        db.refresh(meta)
        return meta

    def listar_metas(self, db, user_id: int, include_arquivadas: bool = False):
        query = db.query(Meta).filter(Meta.user_id == user_id)
        if not include_arquivadas:
            query = query.filter(Meta.status != "arquivada")
        return query.order_by(Meta.created_at.desc()).all()

    def atualizar_meta(self, db, meta_id, meta_in: MetaUpdate, user_id) -> Meta | None:
        meta = self._get_meta(db, meta_id, user_id)
        if not meta:
            return None
        for field, value in meta_in.model_dump(exclude_unset=True).items():
            setattr(meta, field, value)
        db.commit()
        db.refresh(meta)
        # alvo pode ter mudado → reavaliar status
        self._recompute_saldo(db, meta)
        return meta

    def deletar_meta(self, db, meta_id, user_id) -> bool:
        """Arquiva a meta (soft delete): preserva o histórico de movimentações e
        devolve o valor guardado ao Disponível — como 'encerrar' uma recorrência.
        Não conta mais em total_guardado (que só soma metas 'ativa')."""
        meta = self._get_meta(db, meta_id, user_id)
        if not meta:
            return False
        meta.status = "arquivada"
        db.commit()
        return True

    # ---------- movimentações ----------
    def _pode_retirar(self, meta: Meta) -> bool:
        """Meta trancada só libera retirada se concluída ou se a data-alvo já passou."""
        if not meta.trancada:
            return True
        if meta.status == "concluida":
            return True
        if meta.data_alvo and meta.data_alvo <= now_utc().date():
            return True
        return False

    def criar_movimentacao(self, db, meta_id, mov_in: MovimentacaoCreate, user_id):
        meta = self._get_meta(db, meta_id, user_id)
        if not meta:
            raise ValueError("Meta não encontrada")

        if mov_in.tipo == "retirada":
            if not self._pode_retirar(meta):
                raise ValueError("Meta trancada: retirada bloqueada")
            if round(mov_in.valor, 2) > meta.saldo_atual:
                raise ValueError("Retirada maior que o saldo disponível")

        mov = MovimentacaoMeta(
            meta_id=meta.id,
            user_id=user_id,
            tipo=mov_in.tipo.value,
            valor=round(mov_in.valor, 2),
            data=mov_in.data or now_utc(),
            status="Efetivada",
            origem="manual",
            observacao=mov_in.observacao,
        )
        db.add(mov)
        db.commit()
        db.refresh(meta)
        self._recompute_saldo(db, meta)
        db.refresh(mov)
        return mov

    def listar_movimentacoes(self, db, meta_id, user_id):
        meta = self._get_meta(db, meta_id, user_id)
        if not meta:
            return []
        return (
            db.query(MovimentacaoMeta)
            .filter(MovimentacaoMeta.meta_id == meta_id)
            .order_by(MovimentacaoMeta.data.desc())
            .all()
        )

    def deletar_movimentacao(self, db, meta_id, mov_id, user_id) -> bool:
        meta = self._get_meta(db, meta_id, user_id)
        if not meta:
            return False
        mov = (
            db.query(MovimentacaoMeta)
            .filter(MovimentacaoMeta.id == mov_id, MovimentacaoMeta.meta_id == meta_id)
            .first()
        )
        if not mov:
            return False
        db.delete(mov)
        db.commit()
        db.refresh(meta)
        self._recompute_saldo(db, meta)
        return True

    # ---------- projeção & KPIs ----------
    def _media_aporte_mensal(self, meta: Meta) -> float:
        """Média mensal dos aportes efetivados desde a criação da meta."""
        aportes = [m for m in meta.movimentacoes
                   if m.status == "Efetivada" and m.tipo == "aporte" and m.valor > 0]
        if not aportes:
            return 0.0
        primeira = min(m.data for m in aportes)
        meses = max(1, (now_utc().replace(tzinfo=None) - primeira.replace(tzinfo=None)).days / 30.0)
        return round(sum(m.valor for m in aportes) / meses, 2)

    def enriquecer_meta(self, db, meta: Meta) -> dict:
        faltante = max(0.0, round(meta.valor_alvo - meta.saldo_atual, 2))
        progresso = 0.0
        if meta.valor_alvo > 0:
            progresso = round(min(100.0, (meta.saldo_atual / meta.valor_alvo) * 100), 1)

        meses_restantes = None
        aporte_sugerido = None
        if meta.data_alvo:
            hoje = now_utc().date()
            delta = relativedelta(meta.data_alvo, hoje)
            meses_restantes = max(0, delta.years * 12 + delta.months + (1 if delta.days > 0 else 0))
            if meses_restantes > 0:
                aporte_sugerido = round(faltante / meses_restantes, 2)

        data_projetada = None
        if faltante > 0:
            ritmo = self._media_aporte_mensal(meta)
            if ritmo > 0:
                meses_ate = faltante / ritmo
                data_projetada = (now_utc().date() + relativedelta(months=int(meses_ate) + 1))

        return {
            "id": meta.id,
            "nome": meta.nome,
            "valor_alvo": meta.valor_alvo,
            "saldo_atual": meta.saldo_atual,
            "data_alvo": meta.data_alvo,
            "icone": meta.icone,
            "cor": meta.cor,
            "imagem_url": meta.imagem_url,
            "trancada": meta.trancada,
            "status": meta.status,
            "aporte_mensal_valor": meta.aporte_mensal_valor,
            "aporte_mensal_dia": meta.aporte_mensal_dia,
            "created_at": meta.created_at,
            "concluida_em": meta.concluida_em,
            "progresso_pct": progresso,
            "aporte_sugerido": aporte_sugerido,
            "data_projetada": data_projetada,
            "meses_restantes": meses_restantes,
        }

    def total_guardado(self, db, user_id: int) -> float:
        metas = db.query(Meta).filter(
            Meta.user_id == user_id, Meta.status == "ativa"
        ).all()
        return round(sum(m.saldo_atual for m in metas), 2)

    def listar_grupos_cofre(self, db, user_id: int) -> list:
        """
        Monta os cofrinhos como 'grupos' para a lista de transações (exibição).
        Cada cofre com ≥1 movimentação vira 1 linha representante (movimentação
        mais recente) + a lista de movimentações para expandir. NÃO é uma
        Transacao real — não afeta os totais de receita/despesa (transferência neutra).
        """
        metas = db.query(Meta).filter(Meta.user_id == user_id).all()
        grupos = []
        for m in metas:
            movs = sorted(m.movimentacoes, key=lambda x: x.data, reverse=True)
            if not movs:
                continue
            rep = movs[0]
            grupos.append({
                "id_grupo": f"cofre-{m.id}",
                "meta_id": m.id,
                "nome": m.nome,
                "icone": m.icone,
                "cor": m.cor,
                "descricao": f"{'Aporte' if rep.tipo == 'aporte' else 'Retirada'} · {m.nome}",
                "data": rep.data,
                "valor": rep.valor,
                "tipo": rep.tipo,
                "status": rep.status,
                "arquivada": (m.status == "arquivada"),
                "movimentacoes": [
                    {"id": x.id, "data": x.data, "valor": x.valor, "tipo": x.tipo, "status": x.status}
                    for x in movs
                ],
            })
        return grupos

    def calcular_resumo(self, db, user_id: int, saldo_bruto: float) -> dict:
        guardado = self.total_guardado(db, user_id)
        total = round(saldo_bruto, 2)
        qtd_metas = db.query(Meta).filter(
            Meta.user_id == user_id, Meta.status != "arquivada"
        ).count()
        return {
            "disponivel": round(total - guardado, 2),
            "guardado": guardado,
            "total": total,
            "qtd_metas": qtd_metas,
        }


    # ---------- aporte mensal agendado ----------
    def gerar_aportes_agendados(self, db, user_id: int) -> None:
        """Idempotente: garante 1 aporte Pendente no mês corrente por meta configurada."""
        hoje = now_utc()
        metas = db.query(Meta).filter(
            Meta.user_id == user_id,
            Meta.status == "ativa",
            Meta.aporte_mensal_valor.isnot(None),
        ).all()
        for meta in metas:
            ja_existe = any(
                m.origem == "agendado"
                and m.data.year == hoje.year
                and m.data.month == hoje.month
                for m in meta.movimentacoes
            )
            if ja_existe:
                continue
            dia = min(meta.aporte_mensal_dia or 1, 28)
            data_mov = hoje.replace(day=dia, hour=0, minute=0, second=0, microsecond=0)
            db.add(MovimentacaoMeta(
                meta_id=meta.id,
                user_id=user_id,
                tipo="aporte",
                valor=round(meta.aporte_mensal_valor, 2),
                data=data_mov,
                status="Pendente",
                origem="agendado",
                id_grupo_recorrencia=f"agendado-{meta.id}",
            ))
        db.commit()

    def toggle_status_movimentacao(self, db, meta_id, mov_id, user_id):
        meta = self._get_meta(db, meta_id, user_id)
        if not meta:
            return None
        mov = (
            db.query(MovimentacaoMeta)
            .filter(MovimentacaoMeta.id == mov_id, MovimentacaoMeta.meta_id == meta_id)
            .first()
        )
        if not mov:
            return None
        mov.status = "Efetivada" if mov.status == "Pendente" else "Pendente"
        db.commit()
        db.refresh(meta)
        self._recompute_saldo(db, meta)
        db.refresh(mov)
        return mov


metas_service = MetasService()
