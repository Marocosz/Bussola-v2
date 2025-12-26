"""
=======================================================================================
ARQUIVO: base_class.py (Base Declarativa do SQLAlchemy)
=======================================================================================

OBJETIVO:
    Definir a classe base fundamental para o mapeamento Objeto-Relacional (ORM).
    Todas as entidades do sistema (tabelas) devem herdar desta classe.

PARTE DO SISTEMA:
    Backend / Database Layer (Camada de Persistência)

RESPONSABILIDADES:
    1. Prover a classe pai 'Base' que mantém o registro central (metadata) das tabelas.
    2. Permitir que o SQLAlchemy mapeie classes Python para tabelas SQL.

COMUNICAÇÃO:
    - Importado por: Todos os modelos em 'app.models.*' (ex: User, Agenda).
    - Relacionado com: app.db.base.py (que agrega todos os modelos para o Alembic).

=======================================================================================
"""

from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    """
    Classe base para todos os modelos do sistema (Padrão SQLAlchemy 2.0).

    Arquitetura:
        Ao herdar desta classe, os modelos são automaticamente registrados no
        objeto 'metadata'. Isso é crucial para que ferramentas como o Alembic
        consigam detectar as tabelas e gerar as migrações de banco de dados
        automaticamente.
    """
    pass