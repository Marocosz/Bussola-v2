from typing import Dict
from pydantic import BaseModel

class VolumeArchitectContext(BaseModel):
    """
    Contexto simplificado para análise de volume.
    Recebe o somatório já calculado pelo Orquestrador.
    """
    nivel_usuario: str # "iniciante", "intermediario", "avancado"
    objetivo: str # "hipertrofia", "forca", "emagrecimento"
    # Ex: {"Peito": 12, "Costas": 20, "Pernas": 4}
    volume_semanal: Dict[str, int]