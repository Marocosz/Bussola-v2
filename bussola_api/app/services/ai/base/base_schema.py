"""
=======================================================================================
ARQUIVO: base_schema.py (Schemas e Enums Base para IA)
=======================================================================================

OBJETIVO:
    Definir a estrutura de dados universal (Contrato de Dados) para todas as respostas
    geradas pelos agentes de Inteligência Artificial do sistema.

CAMADA:
    Core / Shared Services (Backend).
    Este arquivo atua como o contrato de interface entre os Agentes de IA (Backend)
    e os componentes visuais de IA (Frontend).

RESPONSABILIDADES:
    1. Padronização: Garantir que Nutri, Coach, Finanças e Agenda falem a "mesma língua".
    2. Resiliência: Normalizar saídas imprevisíveis de LLMs (Fuzzy Matching) para Enums rígidos.
    3. Interface de UI: Definir estruturas que o Frontend siba renderizar (Cards, Botões, Alertas).

COMUNICAÇÃO:
    - Utilizado por: Todos os `orchestrator.py` e `agent.py` dos domínios.
    - Consumido por: Frontend (Componente AiAssistant e Renderizadores de Cards).
    - Integrado com: Pydantic (validação) e saídas brutas de LLMs (OpenAI/Anthropic/Google).
"""

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
    """
    Define a 'intenção técnica' da ação sugerida.
    Usado pelo Frontend para decidir qual ícone ou comportamento de botão exibir.
    """
    SWAP = "swap"
    ADD = "add"
    REMOVE = "remove"
    ADJUST = "adjust"
    INFO = "info"
    PROGRESSION = "progression"

    @classmethod
    def from_string(cls, value: str):
        """
        Normaliza a saída textual da IA para um Enum válido.
        
        MOTIVAÇÃO:
        LLMs (Large Language Models) nem sempre respeitam a saída JSON estrita ou podem
        usar sinônimos (ex: "delete" ao invés de "remove").
        
        LÓGICA:
        1. Tenta conversão exata.
        2. Se falhar, usa 'Semantic Matching' (busca por palavras-chave na string).
        3. Se nada funcionar, retorna um fallback seguro (INFO) para evitar quebra de fluxo.
        """
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
    """
    Classificação semântica da sugestão.
    Determina o estilo visual (cores, ícones) no Frontend (ex: Vermelho para CRITICAL).
    """
    WARNING = "warning"
    TIP = "tip"
    SUGGESTION = "suggestion"
    PRAISE = "praise"
    CRITICAL = "critical"
    ERROR = "error"
    COMPLIMENT = "compliment"

    @classmethod
    def from_string(cls, value: str):
        """
        Normaliza a classificação de severidade/tipo vinda da IA.
        
        IMPORTANTE:
        Mapeia termos variados que a IA pode gerar (como 'fail', 'bug', 'hint')
        para os tipos padrões suportados pelo Design System.
        """
        v = str(value).lower().strip()
        try:
            return cls(v)
        except ValueError:
            pass

        # Semantic Matching Atualizado
        if "critic" in v or "fatal" in v or "urgent" in v: return cls.CRITICAL
        if "warn" in v or "alert" in v or "danger" in v: return cls.WARNING
        if "error" in v or "fail" in v or "bug" in v: return cls.ERROR
        
        # Mapeamento para Elogios
        if "praise" in v or "good" in v or "great" in v or "compliment" in v or "ok" in v: 
            return cls.PRAISE
            
        # Mapeamento para Dicas/Informações
        if "tip" in v or "hint" in v or "idea" in v or "info" in v: 
            return cls.TIP
        
        # Fallback Seguro
        return cls.SUGGESTION

class SeverityLevel(str, Enum):
    """
    Nível de prioridade para ordenação e filtragem de insights.
    Permite que o 'Orchestrator' decida quais cards mostrar primeiro.
    """
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"
    NONE = "none"

    @classmethod
    def from_string(cls, value: str):
        """
        Converte a percepção de urgência da IA em níveis padronizados.
        Se a IA retornar algo desconhecido (ex: 'mild'), mapeia para o nível mais próximo.
        """
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
    Estrutura de Ação Executável.
    
    OBJETIVO:
    Transformar uma sugestão textual em um objeto programático que o Frontend possa
    usar para chamar uma API ou abrir um modal (ex: Botão "Trocar por Arroz Integral").
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
        # Intercepta a validação para usar o método inteligente 'from_string' do Enum
        # Isso evita erros de validação Pydantic caso a IA envie uma string fora do padrão.
        return ActionKind.from_string(v)

class AtomicSuggestion(BaseModel):
    """
    CONTRATO PRINCIPAL DE RETORNO DA IA.
    
    OBJETIVO:
    Representa a menor unidade de feedback (Insight) que pode ser exibida na tela.
    Serve como um contêiner agnóstico: funciona tanto para Finanças quanto para Nutrição.
    
    INTEGRAÇÃO:
    Este objeto é o que o Endpoint da API retorna para o Frontend React.
    """
    id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="Identificador único (UUID) para controle de estado no frontend."
    )
    # Define os domínios de negócio aceitos.
    # Adicionar um novo agente requer atualizar este Literal.
    domain: Literal["nutri", "coach", "registros", "roteiro", "financas"] = Field(
        ..., 
        description="O domínio de origem da sugestão (Categoria)."
    )
    agent_source: str = Field(
        ..., 
        description="Nome do agente especialista que gerou (ex: 'flow_architect')."
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
        description="Título curto e direto (ex: 'Semana Livre')."
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
        description="ID do banco de dados relacionado (ex: ID da Tarefa)."
    )
    actionable: bool = Field(
        False, 
        description="Flag rápida para saber se existe uma ação vinculada."
    )

    # --------------------------------------------------------------------------
    # VALIDADORES DE ROBUSTEZ (LLM SAFEGUARDS)
    # --------------------------------------------------------------------------
    # Estes validadores garantem que strings alucinadas pela IA sejam convertidas
    # em Enums válidos antes de chegar ao Frontend, prevenindo crashes na UI.
    
    @field_validator('type', mode='before')
    @classmethod
    def validate_type(cls, v):
        return SuggestionType.from_string(v)

    @field_validator('severity', mode='before')
    @classmethod
    def validate_severity(cls, v):
        return SeverityLevel.from_string(v)

    class Config:
        # Garante que, ao converter para JSON, os Enums sejam serializados como strings simples
        use_enum_values = True
        json_schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "domain": "agenda",
                "agent_source": "flow_architect",
                "type": "tip",
                "severity": "medium",
                "title": "Semana Livre",
                "content": "Você não tem tarefas agendadas...",
                "action": None,
                "actionable": False
            }
        }