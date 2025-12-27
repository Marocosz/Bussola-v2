from pydantic import BaseModel, Field

class MacroAuditorContext(BaseModel):
    """
    Define EXATAMENTE quais dados o Macro Auditor precisa para trabalhar.
    Isso evita enviar dados inúteis (como ID do usuário ou timestamp) para a IA.
    """
    # Dados Biológicos
    peso_atual: float
    objetivo: str # ex: "perda_peso", "hipertrofia"
    tmb: float # Taxa Metabólica Basal
    get: float # Gasto Energético Total (TMB * Nível Atividade)
    
    # Dados da Dieta Atual
    dieta_calorias: float
    dieta_proteina: float
    dieta_carbo: float
    dieta_gordura: float
    agua_ml: float

    # Metadados para Logs
    user_level: str = "intermadiary"