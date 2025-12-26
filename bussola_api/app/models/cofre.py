"""
=======================================================================================
ARQUIVO: cofre.py (Modelo de Dados - Cofre de Senhas)
=======================================================================================

OBJETIVO:
    Armazenar informações sensíveis de forma segura. Diferente de outros modelos,
    este requer tratamento especial para criptografia de campos.

PARTE DO SISTEMA:
    Backend / Database Layer / Security.

RESPONSABILIDADES:
    1. Persistir metadados de segredos (título, serviço, datas).
    2. Mapear o campo de valor criptografado para uma coluna interna do banco,
       evitando exposição acidental em logs ou dumps simples.

COMUNICAÇÃO:
    - Relaciona-se com: app.models.user.User.
    - Dependência Lógica: O Service responsável DEVE criptografar o valor ANTES
      de instanciar este modelo.
=======================================================================================
"""

from sqlalchemy import Column, Integer, String, Text, Date, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base_class import Base

class Segredo(Base):
    __tablename__ = 'segredo'

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String(200), nullable=False)
    servico = Column(String(100), nullable=True)
    notas = Column(Text, nullable=True)
    
    # Auditoria básica de criação e validade (ex: validade de cartão de crédito)
    data_criacao = Column(Date, default=datetime.utcnow)
    data_expiracao = Column(Date, nullable=True)

    # [SEGURANÇA E ARQUITETURA]
    # Mapeamento explícito da coluna "_valor_criptografado".
    # Intenção: Ocultar o acesso direto ao valor bruto no objeto Python.
    # O valor armazenado aqui JÁ DEVE estar criptografado (Fernet/AES) pela camada de serviço.
    # Nunca salvar texto plano nesta coluna.
    valor_criptografado = Column("_valor_criptografado", String(500), nullable=False)

    # [SEGURANÇA / MULTI-TENANCY]
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    user = relationship("User", back_populates="segredos")