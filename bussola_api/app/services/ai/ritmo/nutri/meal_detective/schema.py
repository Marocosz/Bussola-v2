from typing import List
from pydantic import BaseModel

class AlimentoItemContext(BaseModel):
    nome: str
    quantidade: str # Ex: "100g"
    proteina: float
    carbo: float
    gordura: float

class RefeicaoContext(BaseModel):
    id: int # ID do banco (Para vincular a sugestão ao card correto)
    nome: str # Ex: "Café da Manhã"
    horario: str # Ex: "08:00"
    alimentos: List[AlimentoItemContext]
    total_calorias: float

class MealDetectiveContext(BaseModel):
    """
    Contexto para análise detalhada de refeições.
    Enviamos a lista completa para que ele possa analisar também a distribuição (timing).
    """
    refeicoes: List[RefeicaoContext]
    objetivo_usuario: str # "hipertrofia" ou "perda_peso" afeta a análise do timing