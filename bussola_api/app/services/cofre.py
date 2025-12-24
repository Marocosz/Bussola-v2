from sqlalchemy.orm import Session
from cryptography.fernet import Fernet
from app.core.config import settings
from app.models.cofre import Segredo
from app.schemas.cofre import SegredoCreate, SegredoUpdate

# Inicializa a criptografia no nível do Service
try:
    cipher_suite = Fernet(settings.ENCRYPTION_KEY.encode())
except Exception as e:
    print(f"AVISO: Falha ao carregar ENCRYPTION_KEY no CofreService: {e}")
    cipher_suite = None

class CofreService:
    
    def get_all(self, db: Session, user_id: int):
        """
        Retorna a lista de segredos (METADADOS APENAS).
        Não realiza descriptografia, garantindo performance e segurança.
        """
        return db.query(Segredo).filter(Segredo.user_id == user_id).order_by(Segredo.servico, Segredo.titulo).all()

    def create(self, db: Session, dados: SegredoCreate, user_id: int):
        # 1. Criptografa o valor explicitamente
        valor_encrypted = ""
        if cipher_suite and dados.valor:
            valor_encrypted = cipher_suite.encrypt(dados.valor.encode()).decode()
        else:
            # Fallback de segurança ou erro se a chave não estiver configurada
            if not cipher_suite:
                raise Exception("Encryption Key não configurada. Não é possível salvar segredos.")
        
        # 2. Cria o objeto com o valor já criptografado
        novo = Segredo(
            titulo=dados.titulo,
            servico=dados.servico,
            notas=dados.notas,
            data_expiracao=dados.data_expiracao,
            valor_criptografado=valor_encrypted, # Salva direto no campo físico
            user_id=user_id
        )
        
        db.add(novo)
        db.commit()
        db.refresh(novo)
        return novo

    def update(self, db: Session, id: int, dados: SegredoUpdate, user_id: int):
        segredo = db.query(Segredo).filter(Segredo.id == id, Segredo.user_id == user_id).first()
        if not segredo: return None

        if dados.titulo is not None: segredo.titulo = dados.titulo
        if dados.servico is not None: segredo.servico = dados.servico
        if dados.notas is not None: segredo.notas = dados.notas
        
        if dados.model_fields_set and 'data_expiracao' in dados.model_dump(exclude_unset=True):
             segredo.data_expiracao = dados.data_expiracao
        elif dados.data_expiracao is not None:
             segredo.data_expiracao = dados.data_expiracao

        db.commit()
        db.refresh(segredo)
        return segredo

    def delete(self, db: Session, id: int, user_id: int):
        segredo = db.query(Segredo).filter(Segredo.id == id, Segredo.user_id == user_id).first()
        if segredo:
            db.delete(segredo)
            db.commit()
            return True
        return False

    def get_decrypted_value(self, db: Session, id: int, user_id: int) -> str:
        """
        ÚNICO método autorizado a descriptografar a senha.
        Usado apenas na rota específica de 'Ver/Copiar Senha'.
        """
        segredo = db.query(Segredo).filter(Segredo.id == id, Segredo.user_id == user_id).first()
        
        if not segredo: 
            return None
            
        if cipher_suite and segredo.valor_criptografado:
            try:
                return cipher_suite.decrypt(segredo.valor_criptografado.encode()).decode()
            except Exception:
                return "!! ERRO DE DESCRIPTOGRAFIA !!"
        
        return "!! ERRO: SISTEMA SEM CHAVE !!"

cofre_service = CofreService()