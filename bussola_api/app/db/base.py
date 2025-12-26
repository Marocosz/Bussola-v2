"""
=======================================================================================
ARQUIVO: base.py (Registro Central de Modelos)
=======================================================================================

OBJETIVO:
    Centralizar a importação de todos os modelos do sistema para garantir que eles sejam
    registrados no `Base.metadata`.

PARTE DO SISTEMA:
    Backend / Database / Migrations

RESPONSABILIDADES:
    1. Importar a classe base do SQLAlchemy.
    2. Importar todos os modelos de domínio (User, Finanças, Ritmo, etc.).
    3. Servir de ponto de entrada para o Alembic (`env.py`) detectar tabelas e gerar migrações.

COMUNICAÇÃO:
    - Importa de: app.models.*
    - Utilizado por: alembic/env.py

NOTA TÉCNICA:
    As importações abaixo podem parecer não utilizadas (unused imports), mas são 
    obrigatórias para que o SQLAlchemy e o Alembic tenham ciência da existência 
    dessas tabelas antes de gerar o SQL de criação/alteração.
=======================================================================================
"""

# Importa a classe Base que contém o objeto 'metadata' compartilhado
from app.db.base_class import Base

# --------------------------------------------------------------------------------------
# IMPORTAÇÃO DE MODELOS DE DOMÍNIO
# --------------------------------------------------------------------------------------
# Ao importar os módulos abaixo, as classes decoradas (ex: class User(Base)) são
# executadas e se auto-registram no metadata da Base.

from app.models.user import User
from app.models.financas import Categoria, Transacao
from app.models.registros import Anotacao, Link
from app.models.cofre import Segredo
from app.models.agenda import Compromisso

# Módulo Ritmo (Saúde e Performance)
# Agrupa tabelas de Biometria, Treino e Nutrição
from app.models.ritmo import (
    RitmoBio, 
    RitmoPlanoTreino, 
    RitmoDiaTreino, 
    RitmoExercicioItem, 
    RitmoDietaConfig, 
    RitmoRefeicao, 
    RitmoAlimentoItem
)