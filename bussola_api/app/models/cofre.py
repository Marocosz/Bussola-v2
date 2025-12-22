import os
from sqlalchemy import Column, Integer, String, Text, Date, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from cryptography.fernet import Fernet
from app.db.base_class import Base

# Carrega a chave de criptografia do ambiente
encryption_key = os.getenv('ENCRYPTION_KEY')

if encryption_key:
    cipher_suite = Fernet(encryption_key.encode())
else:
    print("AVISO CRÍTICO: ENCRYPTION_KEY não definida no ambiente.")
    cipher_suite = None

class Segredo(Base):
    __tablename__ = 'segredo'

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String(200), nullable=False)
    servico = Column(String(100), nullable=True)
    notas = Column(Text, nullable=True)
    data_criacao = Column(Date, default=datetime.utcnow)
    data_expiracao = Column(Date, nullable=True)

    # Armazena o valor criptografado
    _valor_criptografado = Column(String(500), nullable=False)

    # [SEGURANÇA] Vínculo com Usuário
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    user = relationship("User", back_populates="segredos")

    @property
    def valor(self):
        """Descriptografa ao ler"""
        if cipher_suite and self._valor_criptografado:
            try:
                return cipher_suite.decrypt(self._valor_criptografado.encode()).decode()
            except Exception as e:
                print(f"Erro ao descriptografar segredo ID {self.id}: {e}")
                return "!! ERRO !!"
        return None

    @valor.setter
    def valor(self, valor_plano: str):
        """Criptografa ao salvar"""
        if cipher_suite and valor_plano:
            encrypted_value = cipher_suite.encrypt(valor_plano.encode())
            self._valor_criptografado = encrypted_value.decode()