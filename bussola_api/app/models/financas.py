from sqlalchemy import Column, Integer, String, Float, DateTime, Date, ForeignKey, func
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.db.base_class import Base

class Categoria(Base):
    __tablename__ = 'categoria'

    id = Column(Integer, primary_key=True)
    nome = Column(String(100), nullable=False) 
    tipo = Column(String(50), nullable=False, default='despesa') # 'despesa' ou 'receita'
    meta_limite = Column(Float, nullable=False, default=0.0)
    icone = Column(String(50), nullable=True)
    cor = Column(String(7), nullable=True, default="#ffffff")

    # [SEGURANÇA] Vínculo com Usuário
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    user = relationship("User", back_populates="categorias_financas")

    # Relacionamentos
    transacoes = relationship('Transacao', back_populates='categoria', lazy=True)
    historico_gastos = relationship('HistoricoGastoMensal', back_populates='categoria', cascade="all, delete-orphan")

class Transacao(Base):
    __tablename__ = 'transacao'

    id = Column(Integer, primary_key=True)
    descricao = Column(String(200), nullable=False)
    valor = Column(Float, nullable=False)
    # Usando lambda para garantir o horário atual na inserção
    data = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    
    categoria_id = Column(Integer, ForeignKey('categoria.id'), nullable=False)
    
    tipo_recorrencia = Column(String(50), nullable=False, default='pontual')
    status = Column(String(50), nullable=False, default='Pendente')
    
    parcela_atual = Column(Integer, nullable=True)
    total_parcelas = Column(Integer, nullable=True)
    frequencia = Column(String(50), nullable=True)
    id_grupo_recorrencia = Column(String(100), nullable=True, index=True)

    # [SEGURANÇA] Vínculo com Usuário (Redundante mas vital para performance de query)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    user = relationship("User", back_populates="transacoes")

    categoria = relationship('Categoria', back_populates='transacoes')

class HistoricoGastoMensal(Base):
    __tablename__ = 'historico_gasto_mensal'

    id = Column(Integer, primary_key=True)
    total_gasto = Column(Float, nullable=False, default=0.0)
    data_referencia = Column(Date, nullable=False, index=True)
    categoria_id = Column(Integer, ForeignKey('categoria.id'), nullable=False)

    categoria = relationship('Categoria', back_populates='historico_gastos')