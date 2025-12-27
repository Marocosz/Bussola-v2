from typing import List
from pydantic import BaseModel

class ExerciseItem(BaseModel):
    nome: str # Ex: "Agachamento Livre"
    categoria: str # Ex: "Pernas", "Ombros"

class TechniqueMasterContext(BaseModel):
    exercicios_chave: List[ExerciseItem] # Lista filtrada (sem isoladores bobos)
    lesoes_historico: List[str] = [] # Futuro: "Lombar", "Joelho"