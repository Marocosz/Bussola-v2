"""
Guarda offline da cadeia de migrations (COOLIFY-DEPLOY-CHECKLIST 7.6½):
uma cadeia Alembic bifurcada (2+ heads) só explode no boot de produção. Este
teste falha ANTES do push se houver mais de um head.
"""
from alembic.config import Config
from alembic.script import ScriptDirectory


def test_alembic_single_head():
    cfg = Config("alembic.ini")
    script = ScriptDirectory.from_config(cfg)
    heads = script.get_heads()
    assert len(heads) == 1, f"Alembic com múltiplos heads (cadeia bifurcada): {heads}"
