from enum import Enum
from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal, Union
import uuid
import logging

logger = logging.getLogger(__name__)

# ==============================================================================
# 1. ENUMS INTELIGENTES (A Verdade Única do Sistema)
# ==============================================================================

class ActionKind(str, Enum):
    SWAP = "swap"
    ADD = "add"
    REMOVE = "remove"
    ADJUST = "adjust"
    INFO = "info"
    PROGRESSION = "progression"

    @classmethod
    def from_string(cls, value: str):
        v = str(value).lower().strip()
        # 1. Tentativa Exata
        try:
            return cls(v)
        except ValueError:
            pass

        # 2. Mapa de Intenção (Semantic Matching)
        if "change" in v or "replac" in v or "substit" in v: return cls.SWAP
        if "delet" in v or "remov" in v: return cls.REMOVE
        if "add" in v or "insert" in v or "create" in v: return cls.ADD
        if "updat" in v or "modif" in v or "adjust" in v: return cls.ADJUST
        if "evol" in v or "progress" in v or "increas" in v: return cls.PROGRESSION
        
        # 3. Fallback Seguro
        return cls.INFO

class SuggestionType(str, Enum):
    WARNING = "warning"       # Amarelo
    TIP = "tip"               # Azul
    SUGGESTION = "suggestion" # Roxo
    PRAISE = "praise"         # Verde
    CRITICAL = "critical"     # Vermelho (Borda Grossa)
    ERROR = "error"           # Vermelho (Bug)
    COMPLIMENT = "compliment" # Verde (Elogio)

    @classmethod
    def from_string(cls, value: str):
        v = str(value).lower().strip()
        try:
            return cls(v)
        except ValueError:
            pass

        # Semantic Matching
        if "critic" in v or "fatal" in v or "urgent" in v: return cls.CRITICAL
        if "warn" in v or "alert" in v or "danger" in v: return cls.WARNING
        if "error" in v or "fail" in v or "bug" in v: return cls.ERROR
        if "praise" in v or "good" in v or "great" in v or "compliment" in v: return cls.PRAISE
        if "tip" in v or "hint" in v or "idea" in v: return cls.TIP
        
        # Fallback Seguro
        logger.warning(f"[Schema] Type IA desconhecido '{v}'. Normalizando para 'suggestion'.")
        return cls.SUGGESTION

class SeverityLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"
    NONE = "none"

    @classmethod
    def from_string(cls, value: str):
        v = str(value).lower().strip()
        try:
            return cls(v)
        except ValueError:
            pass
            
        if "extreme" in v or "fatal" in v: return cls.CRITICAL
        if "high" in v or "urgent" in v: return cls.HIGH
        if "mid" in v or "avg" in v: return cls.MEDIUM
        if "low" in v or "mild" in v: return cls.LOW
        if "zero" in v or "null" in v: return cls.NONE
        
        return cls.MEDIUM # Padrão estatístico

# ==============================================================================
# 2. MODELS (Camada de Validação)
# ==============================================================================

class ActionPayload(BaseModel):
    """
    Define uma ação sugerida para o usuário.
    Permite que o frontend renderize botões funcionais (ex: 'Aplicar Troca').
    """
    kind: ActionKind = Field(
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

    @field_validator('kind', mode='before')
    @classmethod
    def validate_kind(cls, v):
        # Delega a inteligência para o Enum
        return ActionKind.from_string(v)

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
    
    type: SuggestionType = Field(
        ..., 
        description="Classificação visual (Define a cor do card/alerta)."
    )
    
    severity: SeverityLevel = Field(
        SeverityLevel.LOW, 
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

    # --------------------------------------------------------------------------
    # VALIDADORES DE TIPO E SEVERIDADE
    # --------------------------------------------------------------------------
    
    @field_validator('type', mode='before')
    @classmethod
    def validate_type(cls, v):
        return SuggestionType.from_string(v)

    @field_validator('severity', mode='before')
    @classmethod
    def validate_severity(cls, v):
        return SeverityLevel.from_string(v)

    class Config:
        # Importante: Serializa os Enums como seus valores string ("warning") 
        # e não como objetos python, facilitando para o Frontend.
        use_enum_values = True
        json_schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "domain": "nutri",
                "agent_source": "meal_detective",
                "type": "warning",
                "severity": "high",
                "title": "Jantar Pesado",
                "content": "Seu jantar contém **80g de gordura**...",
                "action": None,
                "actionable": False
            }
        }