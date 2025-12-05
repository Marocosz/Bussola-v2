from sqlalchemy import Column, Integer, String, Text, Date
from datetime import datetime, timezone
from cryptography.fernet import Fernet
from app.db.base import Base
from app.core.config import settings

# Inicializa a suite de criptografia com a chave do .env
cipher_suite = Fernet(settings.ENCRYPTION_KEY.encode()) if settings.ENCRYPTION_KEY else None

class Segredo(Base):
    __tablename__ = 'segredo'

    id = Column(Integer, primary_key=True)
    titulo = Column(String(200), nullable=False)
    servico = Column(String(100), nullable=True)
    notas = Column(Text, nullable=True)
    data_criacao = Column(Date, nullable=False, default=lambda: datetime.now(timezone.utc).date())
    data_expiracao = Column(Date, nullable=True)

    # Armazena o dado criptografado
    _valor_criptografado = Column("valor_criptografado", String(500), nullable=False)

    @property
    def valor(self):
        """Descriptografa ao acessar"""
        if cipher_suite and self._valor_criptografado:
            try:
                return cipher_suite.decrypt(self._valor_criptografado.encode()).decode()
            except Exception:
                return "!! ERRO !!"
        return None

    @valor.setter
    def valor(self, valor_plano: str):
        """Criptografa ao salvar"""
        if cipher_suite and valor_plano:
            self._valor_criptografado = cipher_suite.encrypt(valor_plano.encode()).decode()