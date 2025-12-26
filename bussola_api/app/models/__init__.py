"""
=======================================================================================
ARQUIVO: __init__.py (Registro Central de Modelos)
=======================================================================================

OBJETIVO:
    Exportar todos os modelos do sistema a partir de um único ponto.
    Isso facilita as importações em outros módulos (ex: 'from app.models import User')
    e garante que o SQLAlchemy e o Alembic localizem todas as tabelas.

PARTE DO SISTEMA:
    Backend / Database Layer.

RESPONSABILIDADES:
    1. Agrupar modelos por domínio (User, Finanças, Agenda, etc.).
    2. Simplificar namespaces de importação.

COMUNICAÇÃO:
    - Importa de: Módulos internos de 'app.models.*'.
    - Utilizado por: Services, Schemas e 'app.db.base.py'.
=======================================================================================
"""

from .user import User
from .financas import Categoria, Transacao, HistoricoGastoMensal
from .agenda import Compromisso

# Módulo Registros (Produtividade)
# Agrupa entidades de Anotações, Links e Gestão de Tarefas (To-Do)
from .registros import (
    Anotacao, 
    Link, 
    GrupoAnotacao, 
    Tarefa, 
    Subtarefa
)

from .cofre import Segredo

# Módulo Ritmo (Saúde & Performance)
# Agrupa entidades de Biometria, Treino Físico e Nutrição
from .ritmo import (
    RitmoBio, 
    RitmoPlanoTreino, 
    RitmoDiaTreino, 
    RitmoExercicioItem, 
    RitmoDietaConfig, 
    RitmoRefeicao,  
    RitmoAlimentoItem
)