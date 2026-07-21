"""
=======================================================================================
ARQUIVO: schema_sync.py (Sincronização leve de colunas no boot)
=======================================================================================

OBJETIVO:
    Cobrir a lacuna do `Base.metadata.create_all()`: ele CRIA tabelas novas, mas nunca
    faz `ALTER TABLE` numa tabela que já existe. Quando um modelo ganha uma coluna nova
    (ex.: `tarefa.ordem`) e a migração Alembic não roda em produção, toda query naquela
    tabela quebra com "no such column" (HTTP 500).

    Esta função roda no boot, é IDEMPOTENTE e SEGURA:
      - só faz `ADD COLUMN` para colunas que existem no modelo mas faltam na tabela;
      - NUNCA dropa coluna, NUNCA altera tipo, NUNCA mexe em dado existente;
      - coluna nova NOT NULL sem default possível é PULADA com aviso (o boot nunca
        quebra por causa disso) — esse caso raro deve ir por migração manual.

    Não substitui o Alembic (que segue como histórico/evolução de schema para dev e
    para mudanças complexas: renome, drop, migração de dado). É a rede de segurança
    para o caso comum "adicionei uma coluna" no deploy do Coolify.

PARTE DO SISTEMA:
    Backend / Core Infrastructure

COMUNICAÇÃO:
    - Usa: app.db.base (Base.metadata, com todos os modelos já registrados)
    - Chamado por: app.main (logo após o create_all)
=======================================================================================
"""

import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

# Importa o registro central de modelos: garante que Base.metadata conheça TODAS as
# tabelas antes de compararmos com o banco.
from app.db.base import Base

logger = logging.getLogger(__name__)


def _default_sql(column) -> str | None:
    """
    Descobre um literal SQL de DEFAULT para a coluna, na seguinte ordem:
      1) server_default explícito (ex.: server_default="0");
      2) default Python escalar (ex.: default=0, default=False);
      3) fallback por tipo, APENAS quando a coluna é NOT NULL (senão não precisa).
    Retorna None quando não há default e a coluna é anulável (NULL basta).
    """
    # 1) server_default explícito
    if column.server_default is not None:
        arg = getattr(column.server_default, "arg", None)
        if arg is not None:
            return str(getattr(arg, "text", arg))

    # 2) default Python escalar (ignora defaults "callable", que dependem de runtime)
    default = column.default
    if default is not None and getattr(default, "is_scalar", False):
        value = default.arg
        if isinstance(value, bool):
            return "1" if value else "0"
        if isinstance(value, (int, float)):
            return str(value)
        return f"'{value}'"

    # 3) fallback por tipo — só necessário para NOT NULL (linhas existentes precisam
    #    de um valor). Anulável fica sem default (NULL).
    if not column.nullable:
        try:
            py_type = column.type.python_type
        except (NotImplementedError, AttributeError):
            py_type = None
        if py_type in (int, float, bool):
            return "0"
        if py_type is str:
            return "''"

    return None


def sync_missing_columns(engine: Engine) -> None:
    """
    Adiciona no banco as colunas que existem nos modelos mas faltam em tabelas já
    criadas. Seguro para rodar em todo boot.
    """
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    for table in Base.metadata.sorted_tables:
        # Tabela ainda não existe → o create_all cria com todas as colunas. Ignoramos.
        if table.name not in existing_tables:
            continue

        db_columns = {col["name"] for col in inspector.get_columns(table.name)}

        for column in table.columns:
            if column.name in db_columns:
                continue

            default_sql = _default_sql(column)

            # NOT NULL sem qualquer default viável: não dá pra adicionar com segurança
            # numa tabela que já tem linhas. Pula e avisa (não derruba o boot).
            if not column.nullable and default_sql is None:
                logger.warning(
                    "schema_sync: coluna ausente %s.%s é NOT NULL e não tem default; "
                    "pulando — adicione via migração Alembic manual.",
                    table.name, column.name,
                )
                continue

            column_type = column.type.compile(dialect=engine.dialect)
            ddl = f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {column_type}'
            if not column.nullable:
                ddl += " NOT NULL"
            if default_sql is not None:
                ddl += f" DEFAULT {default_sql}"

            with engine.begin() as conn:
                conn.execute(text(ddl))

            logger.warning(
                "schema_sync: coluna adicionada %s.%s (%s)",
                table.name, column.name, column_type,
            )
