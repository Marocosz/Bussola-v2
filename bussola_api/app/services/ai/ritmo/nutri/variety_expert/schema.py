from typing import List
from pydantic import BaseModel

class FoodItemSimple(BaseModel):
    nome: str         # Ex: "Arroz Branco"
    quantidade: str   # Ex: "150g"
    refeicao: str     # Ex: "Almoço" (Ajuda a IA a não sugerir Aveia no Jantar)

class VarietyExpertContext(BaseModel):
    """
    Contexto focado apenas nos alimentos.
    A IA usará isso para detectar repetições e sugerir trocas.
    """
    alimentos_dieta: List[FoodItemSimple]
    restricoes: List[str] = [] # Ex: ["Sem Lactose", "Vegano"] (Futuro)