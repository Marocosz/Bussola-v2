from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

# ==========================================
# 1. SCHEMAS BIO (Corpo)
# ==========================================

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
    # Campos calculados pelo backend:
    tmb: float
    gasto_calorico_total: float
    meta_proteina: float
    meta_carbo: float
    meta_gordura: float
    meta_agua: float
    data_registro: datetime

    class Config:
        from_attributes = True


# ==========================================
# 2. SCHEMAS TREINO
# ==========================================

# --- Exercicio (Nível 3) ---
class ExercicioItemBase(BaseModel):
    nome_exercicio: str
    api_id: Optional[int] = None
    grupo_muscular: Optional[str] = None
    series: int
    repeticoes_min: int
    repeticoes_max: int
    carga_prevista: Optional[float] = None
    descanso_segundos: Optional[int] = None
    observacao: Optional[str] = None

class ExercicioItemCreate(ExercicioItemBase):
    pass

class ExercicioItemResponse(ExercicioItemBase):
    id: int
    dia_treino_id: int
    class Config:
        from_attributes = True

# --- Dia de Treino (Nível 2) ---
class DiaTreinoBase(BaseModel):
    nome: str
    ordem: int

class DiaTreinoCreate(DiaTreinoBase):
    # Permite criar o dia já com exercicios dentro (opcional)
    exercicios: Optional[List[ExercicioItemCreate]] = []

class DiaTreinoResponse(DiaTreinoBase):
    id: int
    plano_id: int
    exercicios: List[ExercicioItemResponse] = []
    class Config:
        from_attributes = True

# --- Plano de Treino (Nível 1 - Topo) ---
class PlanoTreinoBase(BaseModel):
    nome: str
    descricao: Optional[str] = None
    ativo: bool = False

class PlanoTreinoCreate(PlanoTreinoBase):
    pass

class PlanoTreinoResponse(PlanoTreinoBase):
    id: int
    data_criacao: datetime
    # Retorna o plano completo com Dias e Exercícios aninhados
    dias: List[DiaTreinoResponse] = [] 
    class Config:
        from_attributes = True


# ==========================================
# 3. SCHEMAS NUTRIÇÃO
# ==========================================

# --- Alimento (Nível 3) ---
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

# --- Refeição (Nível 2) ---
class RefeicaoBase(BaseModel):
    nome: str
    horario: Optional[str] = None
    ordem: int

class RefeicaoCreate(RefeicaoBase):
    alimentos: Optional[List[AlimentoItemCreate]] = []

class RefeicaoResponse(RefeicaoBase):
    id: int
    dieta_id: int
    alimentos: List[AlimentoItemResponse] = []
    
    # Campo computado simples para facilitar o front (opcional)
    @property
    def total_calorias_refeicao(self) -> float:
        return sum(a.calorias for a in self.alimentos)

    class Config:
        from_attributes = True

# --- Dieta Config (Nível 1 - Topo) ---
class DietaConfigBase(BaseModel):
    nome: str
    ativo: bool = False

class DietaConfigCreate(DietaConfigBase):
    pass

class DietaConfigResponse(DietaConfigBase):
    id: int
    calorias_calculadas: float
    refeicoes: List[RefeicaoResponse] = []
    class Config:
        from_attributes = True