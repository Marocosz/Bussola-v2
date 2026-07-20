"""
=======================================================================================
ARQUIVO: metas.py (Serviço de Domínio - Metas & Cofrinhos)
=======================================================================================
OBJETIVO:
    Lógica do sistema de metas: CRUD, aportes/retiradas (transferência neutra),
    projeção de data-alvo, KPIs de patrimônio e aporte mensal agendado.
=======================================================================================
"""

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

    def listar_metas(self, db, user_id: int):
        return (
            db.query(Meta)
            .filter(Meta.user_id == user_id)
            .order_by(Meta.created_at.desc())
            .all()
        )

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
        meta = self._get_meta(db, meta_id, user_id)
        if not meta:
            return False
        db.delete(meta)
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


metas_service = MetasService()
