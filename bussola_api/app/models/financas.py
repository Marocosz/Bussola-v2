"""
=======================================================================================
ARQUIVO: financas.py (Modelo de Dados - Gestão Financeira)
=======================================================================================

OBJETIVO:
    Definir as entidades principais para o controle financeiro pessoal, incluindo
    transações, categorização e histórico consolidado para performance.

PARTE DO SISTEMA:
    Backend / Database Layer.

RESPONSABILIDADES:
    1. Categoria: Classificação e definição de comportamento (Receita vs Despesa).
    2. Transacao: Registro de movimentação financeira.
    3. HistoricoGastoMensal: Tabela de agregação (Snapshot) para relatórios rápidos.

COMUNICAÇÃO:
    - Relaciona-se com: User.
    - Agregações: O HistoricoGastoMensal é derivado das Transações.
=======================================================================================
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Date, ForeignKey, func
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.db.base_class import Base

class Categoria(Base):
    """
    Define como o dinheiro é agrupado. O campo 'tipo' dita a regra de negócio
    para cálculo de saldo (soma ou subtrai).
    """
    __tablename__ = 'categoria'

    id = Column(Integer, primary_key=True)
    nome = Column(String(100), nullable=False) 
    
    # Regra de Negócio: 'despesa' (subtrai do saldo) ou 'receita' (soma ao saldo).
    tipo = Column(String(50), nullable=False, default='despesa') 
    
    # Usado para alertas de orçamento estourado.
    meta_limite = Column(Float, nullable=False, default=0.0)
    
    # UI Helpers (ícone e cor para o frontend)
    icone = Column(String(50), nullable=True)
    cor = Column(String(7), nullable=True, default="#ffffff")

    # [SEGURANÇA] Garante que categorias são privadas por usuário.
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    user = relationship("User", back_populates="categorias_financas")

    # Relacionamentos
    transacoes = relationship('Transacao', back_populates='categoria', lazy=True)
    # Cascade delete: Se apagar a categoria, apaga o histórico agregado, mas as transações (acima)
    # podem ficar órfãs dependendo da configuração do banco (aqui o default é set null ou restrict).
    historico_gastos = relationship('HistoricoGastoMensal', back_populates='categoria', cascade="all, delete-orphan")

class Transacao(Base):
    """
    Registro atômico de uma movimentação financeira.
    """
    __tablename__ = 'transacao'

    id = Column(Integer, primary_key=True)
    descricao = Column(String(200), nullable=False)
    valor = Column(Float, nullable=False)
    
    # [DECISÃO TÉCNICA] Uso de Lambda no default:
    # 'default=datetime.now' executaria apenas no boot do servidor.
    # 'default=lambda: ...' executa a função no momento da inserção (INSERT),
    # garantindo o timestamp correto da transação.
    data = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    
    categoria_id = Column(Integer, ForeignKey('categoria.id'), nullable=False)
    
    # Controle de Recorrência:
    # 'pontual', 'fixa', 'parcelada'. Define lógica de projeção futura.
    tipo_recorrencia = Column(String(50), nullable=False, default='pontual')
    status = Column(String(50), nullable=False, default='Pendente')
    
    # Campos exclusivos para parcelamento
    parcela_atual = Column(Integer, nullable=True)
    total_parcelas = Column(Integer, nullable=True)
    frequencia = Column(String(50), nullable=True)
    
    # Agrupador: Permite editar todas as ocorrências de uma transação recorrente de uma vez.
    id_grupo_recorrencia = Column(String(100), nullable=True, index=True)

    # [SEGURANÇA / PERFORMANCE]
    # O user_id aqui é redundante (já existe em Categoria), mas é vital para performance.
    # Permite buscar "todas as transações do usuário X" sem fazer JOIN com Categoria.
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    user = relationship("User", back_populates="transacoes")

    categoria = relationship('Categoria', back_populates='transacoes')

class HistoricoGastoMensal(Base):
    """
    Tabela de Cache/Agregação.
    Armazena o total gasto por categoria em um mês específico para evitar
    recalcular somatórios pesados toda vez que o Dashboard é aberto.
    """
    __tablename__ = 'historico_gasto_mensal'

    id = Column(Integer, primary_key=True)
    total_gasto = Column(Float, nullable=False, default=0.0)
    
    # Define o mês/ano de competência (ex: 2023-10-01 representa Outubro/23)
    data_referencia = Column(Date, nullable=False, index=True)
    
    categoria_id = Column(Integer, ForeignKey('categoria.id'), nullable=False)
    categoria = relationship('Categoria', back_populates='historico_gastos')