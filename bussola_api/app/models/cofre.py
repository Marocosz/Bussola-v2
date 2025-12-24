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
    data_criacao = Column(Date, default=datetime.utcnow)
    data_expiracao = Column(Date, nullable=True)

    # [REFATORADO] 
    # Mapeamos explicitamente para "_valor_criptografado" para manter compatibilidade
    # com o banco de dados existente, mas usamos um nome de atributo limpo no Python.
    # Removemos a lógica automática de getter/setter por segurança.
    valor_criptografado = Column("_valor_criptografado", String(500), nullable=False)

    # [SEGURANÇA] Vínculo com Usuário (Multi-tenancy)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    user = relationship("User", back_populates="segredos")