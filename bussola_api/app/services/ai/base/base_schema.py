from pydantic import BaseModel, Field
from typing import Optional, Literal, Union
import uuid

class ActionPayload(BaseModel):
    """
    Define uma ação sugerida para o usuário.
    Permite que o frontend renderize botões funcionais (ex: 'Aplicar Troca').
    """
    kind: Literal["swap", "add", "remove", "adjust", "info"] = Field(
        ..., 
        description="O tipo de ação técnica a ser realizada."
    )
    target: str = Field(
        ..., 
        description="O alvo da ação (ex: nome do alimento, ID do exercício)."
    )
    value: Optional[Union[str, float, int]] = Field(
        None, 
        description="O valor da mudança (ex: '100g', '3 séries')."
    )

class AtomicSuggestion(BaseModel):
    """
    Representa UMA única unidade de informação/ação gerada pela IA.
    É a estrutura atômica que o Frontend receberá.
    """
    id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="Identificador único (UUID) para controle de estado no frontend."
    )
    domain: Literal["nutri", "coach"] = Field(
        ..., 
        description="O domínio de origem da sugestão."
    )
    agent_source: str = Field(
        ..., 
        description="Nome do agente que gerou (ex: 'meal_detective')."
    )
    type: Literal["warning", "tip", "suggestion", "praise", "critical"] = Field(
        ..., 
        description="Classificação visual (Define a cor do card/alerta)."
    )
    severity: Literal["low", "medium", "high"] = Field(
        "low", 
        description="Nível de prioridade para ordenação."
    )
    title: str = Field(
        ..., 
        description="Título curto e direto (ex: 'Baixa Proteína')."
    )
    content: str = Field(
        ..., 
        description="Explicação detalhada em Markdown simples."
    )
    action: Optional[ActionPayload] = Field(
        None, 
        description="Estrutura de ação executável (opcional)."
    )
    related_entity_id: Optional[int] = Field(
        None, 
        description="ID do banco de dados relacionado (ex: ID da Refeição ou Plano)."
    )
    actionable: bool = Field(
        False, 
        description="Flag rápida para saber se existe uma ação vinculada."
    )

    class Config:
        json_schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "domain": "nutri",
                "agent_source": "meal_detective",
                "type": "warning",
                "severity": "high",
                "title": "Jantar Pesado",
                "content": "Seu jantar contém **80g de gordura**, o que pode atrapalhar o sono.",
                "action": None,
                "actionable": False
            }
        }