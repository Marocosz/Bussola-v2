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
from app.schemas.metas import MetaCreate, MetaUpdate


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


metas_service = MetasService()
