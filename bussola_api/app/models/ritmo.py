from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base_class import Base

# ==========================================================
# 1. TABELA DE BIO-DADOS (Corpo & Metas)
# ==========================================================

class RitmoBio(Base):
    __tablename__ = 'ritmo_bio'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('user.id'))
    
    # Dados Corporais
    peso = Column(Float) # kg
    altura = Column(Float) # cm
    idade = Column(Integer)
    genero = Column(String) # 'M' ou 'F'
    bf_estimado = Column(Float, nullable=True) # % de gordura
    
    # Configuração de Metas
    nivel_atividade = Column(String) # 'sedentario', 'leve', 'moderado', 'alto', 'atleta'
    objetivo = Column(String) # 'perda_peso', 'manutencao', 'ganho_massa'
    
    # Resultados Calculados (Persistidos para histórico)
    tmb = Column(Float) # Taxa Metabólica Basal
    gasto_calorico_total = Column(Float) # GET
    
    # Metas de Macros (em gramas)
    meta_proteina = Column(Float)
    meta_carbo = Column(Float)
    meta_gordura = Column(Float)
    meta_agua = Column(Float) # Litros
    
    data_registro = Column(DateTime, default=datetime.utcnow)

    # Relacionamento com User (String para evitar import circular)
    user = relationship("User", back_populates="ritmo_bios")


# ==========================================================
# 2. TABELAS DE TREINO (Plano -> Dia -> Exercicio)
# ==========================================================

class RitmoPlanoTreino(Base):
    __tablename__ = 'ritmo_plano_treino'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('user.id'))
    
    nome = Column(String) # Ex: "Hipertrofia ABC - 2025"
    descricao = Column(String, nullable=True)
    ativo = Column(Boolean, default=False) 
    data_criacao = Column(DateTime, default=datetime.utcnow)

    # Relacionamento: Se deletar o plano, deleta os dias filhos
    dias = relationship("RitmoDiaTreino", back_populates="plano", cascade="all, delete-orphan")
    user = relationship("User", back_populates="ritmo_planos")


class RitmoDiaTreino(Base):
    __tablename__ = 'ritmo_dia_treino'

    id = Column(Integer, primary_key=True, index=True)
    plano_id = Column(Integer, ForeignKey('ritmo_plano_treino.id'))
    
    nome = Column(String) # Ex: "Treino A - Peito"
    ordem = Column(Integer, default=0) # 1, 2, 3...

    plano = relationship("RitmoPlanoTreino", back_populates="dias")
    # Relacionamento: Se deletar o dia, deleta os exercícios filhos
    exercicios = relationship("RitmoExercicioItem", back_populates="dia_treino", cascade="all, delete-orphan")


class RitmoExercicioItem(Base):
    __tablename__ = 'ritmo_exercicio_item'

    id = Column(Integer, primary_key=True, index=True)
    dia_treino_id = Column(Integer, ForeignKey('ritmo_dia_treino.id'))
    
    # Dados do Exercício
    nome_exercicio = Column(String) 
    api_id = Column(Integer, nullable=True) # ID externo (Wger/ExerciseDB)
    grupo_muscular = Column(String, nullable=True) 
    
    # Prescrição
    series = Column(Integer)
    repeticoes_min = Column(Integer)
    repeticoes_max = Column(Integer)
    carga_prevista = Column(Float, nullable=True) # kg
    descanso_segundos = Column(Integer, nullable=True)
    observacao = Column(String, nullable=True)

    dia_treino = relationship("RitmoDiaTreino", back_populates="exercicios")


# ==========================================================
# 3. TABELAS DE NUTRIÇÃO (Dieta -> Refeição -> Alimento)
# ==========================================================

class RitmoDietaConfig(Base):
    __tablename__ = 'ritmo_dieta_config'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('user.id'))
    
    nome = Column(String) # Ex: "Dieta Cutting"
    ativo = Column(Boolean, default=False)
    calorias_calculadas = Column(Float, default=0) # Soma total das refeições
    
    refeicoes = relationship("RitmoRefeicao", back_populates="dieta", cascade="all, delete-orphan")
    user = relationship("User", back_populates="ritmo_dietas")


class RitmoRefeicao(Base):
    __tablename__ = 'ritmo_refeicao'

    id = Column(Integer, primary_key=True, index=True)
    dieta_id = Column(Integer, ForeignKey('ritmo_dieta_config.id'))
    
    nome = Column(String) # "Café da Manhã"
    horario = Column(String, nullable=True) # "08:00"
    ordem = Column(Integer, default=0)

    dieta = relationship("RitmoDietaConfig", back_populates="refeicoes")
    alimentos = relationship("RitmoAlimentoItem", back_populates="refeicao", cascade="all, delete-orphan")


class RitmoAlimentoItem(Base):
    __tablename__ = 'ritmo_alimento_item'

    id = Column(Integer, primary_key=True, index=True)
    refeicao_id = Column(Integer, ForeignKey('ritmo_refeicao.id'))
    
    nome = Column(String) # "Arroz Branco"
    quantidade = Column(Float) # Ex: 100
    unidade = Column(String) # 'g', 'ml'
    
    # Macros Calculados
    calorias = Column(Float)
    proteina = Column(Float)
    carbo = Column(Float)
    gordura = Column(Float)
    
    refeicao = relationship("RitmoRefeicao", back_populates="alimentos")