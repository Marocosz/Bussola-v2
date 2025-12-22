from sqlalchemy import Column, Integer, String, Text, Date, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from cryptography.fernet import Fernet
from app.db.base_class import Base

# [AQUI ESTÁ A MÁGICA] Importamos a configuração centralizada
from app.core.config import settings 

# Inicializa a criptografia usando a variável que o Pydantic carregou
try:
    cipher_suite = Fernet(settings.ENCRYPTION_KEY.encode())
except Exception as e:
    # Se a chave no .env estiver errada/vazia, avisa mas não derruba o sistema inteiro
    print(f"AVISO: Falha ao carregar ENCRYPTION_KEY no Model Cofre: {e}")
    cipher_suite = None

class Segredo(Base):
    __tablename__ = 'segredo'

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String(200), nullable=False)
    servico = Column(String(100), nullable=True)
    notas = Column(Text, nullable=True)
    data_criacao = Column(Date, default=datetime.utcnow)
    data_expiracao = Column(Date, nullable=True)

    # Armazena o valor criptografado no banco
    _valor_criptografado = Column(String(500), nullable=False)

    # [SEGURANÇA] Vínculo com Usuário (Multi-tenancy)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    user = relationship("User", back_populates="segredos")

    @property
    def valor(self):
        """Lê do banco e descriptografa para usar na API"""
        if cipher_suite and self._valor_criptografado:
            try:
                return cipher_suite.decrypt(self._valor_criptografado.encode()).decode()
            except Exception:
                return "!! ERRO DE DESCRIPTOGRAFIA !!"
        return None

    @valor.setter
    def valor(self, valor_plano: str):
        """Recebe senha limpa e criptografa antes de salvar no banco"""
        if cipher_suite and valor_plano:
            encrypted_value = cipher_suite.encrypt(valor_plano.encode())
            self._valor_criptografado = encrypted_value.decode()