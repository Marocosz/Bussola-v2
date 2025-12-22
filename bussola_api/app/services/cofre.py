from sqlalchemy.orm import Session
from app.models.cofre import Segredo
from app.schemas.cofre import SegredoCreate, SegredoUpdate

class CofreService:
    
    def get_all(self, db: Session, user_id: int):
        # [SEGURANÇA] Filtra por user_id
        return db.query(Segredo).filter(Segredo.user_id == user_id).order_by(Segredo.servico, Segredo.titulo).all()

    def create(self, db: Session, dados: SegredoCreate, user_id: int):
        novo = Segredo(
            titulo=dados.titulo,
            servico=dados.servico,
            notas=dados.notas,
            data_expiracao=dados.data_expiracao,
            user_id=user_id # [SEGURANÇA]
        )
        # O setter do model criptografa automaticamente
        novo.valor = dados.valor
        
        db.add(novo)
        db.commit()
        db.refresh(novo)
        return novo

    def update(self, db: Session, id: int, dados: SegredoUpdate, user_id: int):
        # [SEGURANÇA] Filtra por id e user_id
        segredo = db.query(Segredo).filter(Segredo.id == id, Segredo.user_id == user_id).first()
        if not segredo: return None

        if dados.titulo is not None: segredo.titulo = dados.titulo
        if dados.servico is not None: segredo.servico = dados.servico
        if dados.notas is not None: segredo.notas = dados.notas
        
        # Lógica especial para data de expiração (permitir remover/setar None)
        # No Pydantic, se o campo vier, usamos ele (mesmo que seja None explicitamente enviado)
        if dados.model_fields_set and 'data_expiracao' in dados.model_dump(exclude_unset=True):
             segredo.data_expiracao = dados.data_expiracao
        elif dados.data_expiracao is not None:
             segredo.data_expiracao = dados.data_expiracao

        db.commit()
        db.refresh(segredo)
        return segredo

    def delete(self, db: Session, id: int, user_id: int):
        # [SEGURANÇA] Filtra por id e user_id
        segredo = db.query(Segredo).filter(Segredo.id == id, Segredo.user_id == user_id).first()
        if segredo:
            db.delete(segredo)
            db.commit()
            return True
        return False

    def get_decrypted_value(self, db: Session, id: int, user_id: int):
        # [SEGURANÇA] Filtra por id e user_id
        segredo = db.query(Segredo).filter(Segredo.id == id, Segredo.user_id == user_id).first()
        if not segredo: return None
        # O getter do model descriptografa automaticamente
        return segredo.valor

cofre_service = CofreService()