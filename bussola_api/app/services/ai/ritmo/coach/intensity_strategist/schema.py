from pydantic import BaseModel

class IntensityStrategistContext(BaseModel):
    nivel_usuario: str
    foco_treino: str # "hipertrofia", "forca"
    semanas_treinando: int = 1 # Para saber se é hora de Deload