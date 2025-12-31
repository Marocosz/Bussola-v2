"""
=======================================================================================
ARQUIVO: ritmo.py (Modelo de Dados - Módulo Ritmo / Saúde)
=======================================================================================

OBJETIVO:
    Modelar o domínio complexo de Saúde e Performance, abrangendo três pilares:
    Biometria, Treinamento Físico e Nutrição.

PARTE DO SISTEMA:
    Backend / Database Layer.

RESPONSABILIDADES:
    1. RitmoBio: Snapshot histórico do corpo e metas do usuário.
    2. Treino: Estrutura hierárquica (Plano -> Dia -> Exercício).
    3. Dieta: Estrutura hierárquica (Config -> Refeição -> Alimento).

COMUNICAÇÃO:
    - User (Dono dos dados).
    - Integrações Externas: Campos como 'api_id' sugerem vínculo com APIs de terceiros.
=======================================================================================
"""

from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.db.base_class import Base
from app.core.timezone import now_utc # [NOVO]

# ==========================================================
# 1. TABELA DE BIO-DADOS (Corpo & Metas)
# ==========================================================

class RitmoBio(Base):
    """
    Armazena o estado físico atual e as metas calculadas do usuário.
    Geralmente criado a cada nova avaliação física ou atualização de peso.
    """
    __tablename__ = 'ritmo_bio'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('user.id'))
    
    # Dados Antropométricos
    peso = Column(Float) # kg
    altura = Column(Float) # cm
    idade = Column(Integer)
    genero = Column(String) # Usado para fórmulas de TMB (Harris-Benedict/Mifflin)
    bf_estimado = Column(Float, nullable=True) 
    
    # Fatores para cálculo energético
    nivel_atividade = Column(String) # Multiplicador de TMB
    objetivo = Column(String) # Define superávit ou déficit calórico
    
    # Resultados Calculados e Persistidos (Snapshot)
    # Importante persistir para não depender de recálculo se a fórmula mudar.
    tmb = Column(Float) 
    gasto_calorico_total = Column(Float) 
    
    # Metas nutricionais derivadas
    meta_proteina = Column(Float)
    meta_carbo = Column(Float)
    meta_gordura = Column(Float)
    meta_agua = Column(Float) 
    
    data_registro = Column(DateTime, default=now_utc) # [CORREÇÃO]

    user = relationship("User", back_populates="ritmo_bios")


# ==========================================================
# 2. TABELAS DE TREINO (Plano -> Dia -> Exercicio)
# ==========================================================

class RitmoPlanoTreino(Base):
    """
    Cabeçalho de um ciclo de periodização (ex: Mesociclo de Hipertrofia).
    """
    __tablename__ = 'ritmo_plano_treino'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('user.id'))
    
    nome = Column(String) 
    # Define qual ficha o app deve mostrar na Home. Apenas um deve ser True por user.
    ativo = Column(Boolean, default=False) 
    data_criacao = Column(DateTime, default=now_utc) # [CORREÇÃO]

    # Cascade Delete: Apagar o plano remove toda a árvore de dias e exercícios.
    dias = relationship("RitmoDiaTreino", back_populates="plano", cascade="all, delete-orphan")
    user = relationship("User", back_populates="ritmo_planos")


class RitmoDiaTreino(Base):
    """
    Divisão do treino (Split). Ex: Treino A, Treino B.
    """
    __tablename__ = 'ritmo_dia_treino'

    id = Column(Integer, primary_key=True, index=True)
    plano_id = Column(Integer, ForeignKey('ritmo_plano_treino.id'))
    
    nome = Column(String) 
    ordem = Column(Integer, default=0) # Ordenação na UI

    plano = relationship("RitmoPlanoTreino", back_populates="dias")
    exercicios = relationship("RitmoExercicioItem", back_populates="dia_treino", cascade="all, delete-orphan")


class RitmoExercicioItem(Base):
    """
    A menor unidade do treino: O exercício em si e sua prescrição de carga/volume.
    """
    __tablename__ = 'ritmo_exercicio_item'

    id = Column(Integer, primary_key=True, index=True)
    dia_treino_id = Column(Integer, ForeignKey('ritmo_dia_treino.id'))
    
    # Metadados do Exercício
    nome_exercicio = Column(String) 
    # Integração Externa: ID de referência em APIs como Wger ou ExerciseDB para buscar gifs/imgs.
    api_id = Column(Integer, nullable=True) 
    grupo_muscular = Column(String, nullable=True) 
    
    # Prescrição de Volume e Intensidade
    series = Column(Integer)
    repeticoes_min = Column(Integer)
    repeticoes_max = Column(Integer)
    descanso_segundos = Column(Integer, nullable=True)
    observacao = Column(String, nullable=True) # Ex: "Drop-set na última"

    dia_treino = relationship("RitmoDiaTreino", back_populates="exercicios")


# ==========================================================
# 3. TABELAS DE NUTRIÇÃO (Dieta -> Refeição -> Alimento)
# ==========================================================

class RitmoDietaConfig(Base):
    """
    Configuração macro da dieta vigente.
    """
    __tablename__ = 'ritmo_dieta_config'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('user.id'))
    
    nome = Column(String) 
    ativo = Column(Boolean, default=False)
    
    # Soma total das calorias de todos os alimentos (Cache para performance).
    calorias_calculadas = Column(Float, default=0) 
    
    refeicoes = relationship("RitmoRefeicao", back_populates="dieta", cascade="all, delete-orphan")
    user = relationship("User", back_populates="ritmo_dietas")


class RitmoRefeicao(Base):
    """
    Agrupamento lógico de alimentos por horário/momento.
    """
    __tablename__ = 'ritmo_refeicao'

    id = Column(Integer, primary_key=True, index=True)
    dieta_id = Column(Integer, ForeignKey('ritmo_dieta_config.id'))
    
    nome = Column(String) # Ex: "Almoço", "Pós-treino"
    ordem = Column(Integer, default=0)

    dieta = relationship("RitmoDietaConfig", back_populates="refeicoes")
    alimentos = relationship("RitmoAlimentoItem", back_populates="refeicao", cascade="all, delete-orphan")


class RitmoAlimentoItem(Base):
    """
    Item alimentar específico com seus valores nutricionais calculados pela quantidade.
    """
    __tablename__ = 'ritmo_alimento_item'

    id = Column(Integer, primary_key=True, index=True)
    refeicao_id = Column(Integer, ForeignKey('ritmo_refeicao.id'))
    
    nome = Column(String) 
    quantidade = Column(Float) 
    unidade = Column(String) # 'g', 'ml', 'fatia'
    
    # Macros Calculados (Snapshot)
    # Os valores aqui são resultado de: (ValorTabela * Quantidade) / 100
    # Salvar o resultado evita recálculos complexos na leitura da dieta.
    calorias = Column(Float)
    proteina = Column(Float)
    carbo = Column(Float)
    gordura = Column(Float)
    
    refeicao = relationship("RitmoRefeicao", back_populates="alimentos")