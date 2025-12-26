"""
=======================================================================================
ARQUIVO: ritmo.py (Schemas - Saúde e Performance)
=======================================================================================

OBJETIVO:
    Definir DTOs para o módulo Ritmo, cobrindo Biometria, Treino e Nutrição.
    Estruturado hierarquicamente (Plano -> Dia -> Item).

PARTE DO SISTEMA:
    Backend / API Layer.
=======================================================================================
"""

from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

# ======================================================================================
# 1. BIOMETRIA (Corpo e Metas)
# ======================================================================================

class BioBase(BaseModel):
    peso: float
    altura: float
    idade: int
    genero: str
    bf_estimado: Optional[float] = None
    nivel_atividade: str
    objetivo: str

class BioCreate(BioBase):
    pass 

class BioResponse(BioBase):
    id: int
    # Campos calculados pelo backend (TMB, Macros)
    tmb: float
    gasto_calorico_total: float
    meta_proteina: float
    meta_carbo: float
    meta_gordura: float
    meta_agua: float
    data_registro: datetime

    class Config:
        from_attributes = True


# ======================================================================================
# 2. TREINO (Estrutura Hierárquica)
# ======================================================================================

# Nível 3: Exercício
class ExercicioItemBase(BaseModel):
    nome_exercicio: str
    api_id: Optional[int] = None
    grupo_muscular: Optional[str] = None
    series: int
    repeticoes_min: int
    repeticoes_max: int
    descanso_segundos: Optional[int] = None
    observacao: Optional[str] = None

class ExercicioItemCreate(ExercicioItemBase):
    pass

class ExercicioItemResponse(ExercicioItemBase):
    id: int
    dia_treino_id: int
    class Config:
        from_attributes = True

# Nível 2: Dia de Treino
class DiaTreinoBase(BaseModel):
    nome: str
    ordem: int

class DiaTreinoCreate(DiaTreinoBase):
    exercicios: Optional[List[ExercicioItemCreate]] = []

class DiaTreinoResponse(DiaTreinoBase):
    id: int
    plano_id: int
    exercicios: List[ExercicioItemResponse] = []
    class Config:
        from_attributes = True

# Nível 1: Plano de Treino (Raiz)
class PlanoTreinoBase(BaseModel):
    nome: str
    ativo: bool = False

class PlanoTreinoCreate(PlanoTreinoBase):
    dias: Optional[List[DiaTreinoCreate]] = []

class PlanoTreinoResponse(PlanoTreinoBase):
    id: int
    data_criacao: datetime
    dias: List[DiaTreinoResponse] = [] 
    class Config:
        from_attributes = True


# ======================================================================================
# 3. NUTRIÇÃO (Estrutura Hierárquica)
# ======================================================================================

# Nível 3: Alimento
class AlimentoItemBase(BaseModel):
    nome: str
    quantidade: float
    unidade: str
    calorias: float
    proteina: float
    carbo: float
    gordura: float

class AlimentoItemCreate(AlimentoItemBase):
    pass

class AlimentoItemResponse(AlimentoItemBase):
    id: int
    refeicao_id: int
    class Config:
        from_attributes = True

# Nível 2: Refeição
class RefeicaoBase(BaseModel):
    nome: str
    ordem: int

class RefeicaoCreate(RefeicaoBase):
    alimentos: Optional[List[AlimentoItemCreate]] = []

class RefeicaoResponse(RefeicaoBase):
    id: int
    dieta_id: int
    alimentos: List[AlimentoItemResponse] = []
    
    @property
    def total_calorias_refeicao(self) -> float:
        """Cálculo on-the-fly do total calórico desta refeição."""
        if not self.alimentos:
            return 0.0
        return sum(a.calorias for a in self.alimentos)

    class Config:
        from_attributes = True

# Nível 1: Dieta (Raiz)
class DietaConfigBase(BaseModel):
    nome: str
    ativo: bool = False

class DietaConfigCreate(DietaConfigBase):
    refeicoes: Optional[List[RefeicaoCreate]] = []

class DietaConfigResponse(DietaConfigBase):
    id: int
    calorias_calculadas: float
    refeicoes: List[RefeicaoResponse] = []
    class Config:
        from_attributes = True