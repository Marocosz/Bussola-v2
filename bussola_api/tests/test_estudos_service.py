import importlib.util
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect

from app.models.estudos import EstudoMaterial, EstudoResposta, EstudoTema
from app.schemas.estudos_blocos import BlocosInvalidos
from app.services.estudos import estudos_service
from tests.estudos_amostras import FONTES, blocos_todos_os_tipos, quiz, texto


def _material(db, user, tipo="aula", blocos=None, **campos):
    campos.setdefault("titulo", "Material")
    return estudos_service.criar_material(db, user.id, tipo=tipo, blocos=blocos or [texto("a")], **campos)


def test_migration_cria_as_mesmas_colunas_dos_models():
    caminho = Path(__file__).resolve().parents[1] / "alembic" / "versions" / "e4b8c1d2a9f7_add_estudos_tables.py"
    spec = importlib.util.spec_from_file_location("mig_estudos", caminho)
    mig = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mig)
    assert mig.down_revision == "c7e2a9d4f1b3"
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        conn.exec_driver_sql('CREATE TABLE "user" (id INTEGER PRIMARY KEY)')
        with Operations.context(MigrationContext.configure(conn)):
            mig.upgrade()
        insp = inspect(conn)
        for model in (EstudoTema, EstudoMaterial, EstudoResposta):
            colunas_banco = {c["name"] for c in insp.get_columns(model.__tablename__)}
            assert colunas_banco == {c.name for c in model.__table__.columns}, model.__tablename__
        with Operations.context(MigrationContext.configure(conn)):
            mig.downgrade()
        assert not {"estudo_tema", "estudo_material", "estudo_resposta"} & set(inspect(conn).get_table_names())


def test_criar_material_completo(db, user):
    tema = estudos_service.salvar_tema(db, user.id, nome="Python")
    m = _material(db, user, blocos=blocos_todos_os_tipos(), fontes=FONTES, tema_id=tema.id,
                  nivel="iniciante", tags=["python", " Python ", "básico"], subtitulo="  O começo  ")
    assert [b["id"] for b in m.blocos][:2] == ["b1", "b2"] and m.seq_bloco == 15
    assert m.tags == ["python", "básico"]
    assert m.subtitulo == "O começo" and m.tema_nome == "Python" and m.tema_cor == "#4A6DFF"
    assert m.estudado is False
    assert m.fontes[0]["titulo"] == FONTES[0]["titulo"]


def test_material_invalido_nao_grava(db, user):
    with pytest.raises(BlocosInvalidos, match="correta"):
        _material(db, user, tipo="exercicios", blocos=[quiz(correta=9)], fontes=FONTES)
    with pytest.raises(ValueError, match="nivel"):
        _material(db, user, nivel="expert")
    with pytest.raises(ValueError, match="Tema 999 não encontrado"):
        _material(db, user, tema_id=999)
    with pytest.raises(ValueError, match="titulo"):
        _material(db, user, titulo="  ")
    with pytest.raises(ValueError, match="no máximo 10 tags"):
        _material(db, user, tags=[f"t{i}" for i in range(11)])
    assert db.query(EstudoMaterial).count() == 0


def test_temas_nome_unico_contagem_e_edicao(db, user, outro_user):
    t = estudos_service.salvar_tema(db, user.id, nome="Banco de Dados", cor="#10b981", icone="fa-database")
    with pytest.raises(ValueError, match="Já existe um tema chamado 'Banco de Dados'"):
        estudos_service.salvar_tema(db, user.id, nome="banco de dados")
    assert estudos_service.salvar_tema(db, outro_user.id, nome="Banco de Dados").id != t.id
    with pytest.raises(ValueError, match="#RRGGBB"):
        estudos_service.salvar_tema(db, user.id, tema_id=t.id, cor="verde")
    with pytest.raises(ValueError, match="Font Awesome"):
        estudos_service.salvar_tema(db, user.id, tema_id=t.id, icone="<script>")
    with pytest.raises(ValueError, match="informe o nome"):
        estudos_service.salvar_tema(db, user.id)
    _material(db, user, tema_id=t.id)
    editado = estudos_service.salvar_tema(db, user.id, tema_id=t.id, descricao="SQL e afins")
    assert editado.nome == "Banco de Dados" and editado.cor == "#10b981" and editado.descricao == "SQL e afins"
    temas = estudos_service.listar_temas(db, user.id)
    assert [(x["nome"], x["total_materiais"]) for x in temas] == [("Banco de Dados", 1)]
    assert estudos_service.salvar_tema(db, user.id, tema_id=9999, nome="x") is None


def test_excluir_tema_so_se_vazio(db, user):
    t = estudos_service.salvar_tema(db, user.id, nome="Redes")
    m = _material(db, user, tema_id=t.id)
    with pytest.raises(ValueError, match=r"O tema 'Redes' tem 1 material\(is\)"):
        estudos_service.excluir_tema(db, t.id, user.id)
    estudos_service.excluir_material(db, m.id, user.id)
    assert estudos_service.excluir_tema(db, t.id, user.id) is True
    assert estudos_service.excluir_tema(db, t.id, user.id) is False


def test_obter_ou_criar_tema_reaproveita_sem_acento(db, user):
    a = estudos_service.obter_ou_criar_tema(db, user.id, "Programação")
    b = estudos_service.obter_ou_criar_tema(db, user.id, "programacao")
    assert a.id == b.id and db.query(EstudoTema).count() == 1


def test_atualizar_parcial_preserva_e_revalida(db, user):
    m = _material(db, user, blocos=[texto("um [1]"), texto("dois")], fontes=FONTES)
    m = estudos_service.atualizar_material(db, m.id, user.id, subtitulo="novo")
    assert m.subtitulo == "novo" and [b["id"] for b in m.blocos] == ["b1", "b2"]
    m = estudos_service.atualizar_material(db, m.id, user.id, blocos=[m.blocos[1], texto("três")])
    assert [b["id"] for b in m.blocos] == ["b2", "b3"]  # b1 saiu; o bloco novo não reaproveita b1
    with pytest.raises(BlocosInvalidos, match="exige pelo menos 1 bloco 'comparacao'"):
        estudos_service.atualizar_material(db, m.id, user.id, tipo="comparativo")
    with pytest.raises(ValueError, match="campo"):
        estudos_service.atualizar_material(db, m.id, user.id, cor="x")
    m = estudos_service.atualizar_material(db, m.id, user.id, tema_id=None)
    assert m.tema_id is None
    assert estudos_service.atualizar_material(db, 999, user.id, titulo="x") is None


def test_encolher_fontes_com_citacao_rejeita_e_nao_altera(db, user):
    m = _material(db, user, blocos=[texto("primeira [1]"), texto("segunda [2]")], fontes=FONTES)
    with pytest.raises(BlocosInvalidos,
                       match=r"bloco 2 \(texto\): citação \[2\] em 'conteudo', mas o material tem 1 fonte"):
        estudos_service.atualizar_material(db, m.id, user.id, fontes=FONTES[:1])
    db.expire_all()
    atual = estudos_service.get_material(db, m.id, user.id)
    assert len(atual.fontes) == 2 and atual.blocos[1]["conteudo"] == "segunda [2]"


def test_editar_blocos_inserir_substituir_remover(db, user):
    m = _material(db, user, blocos=[texto("1"), texto("2"), texto("3")])
    m = estudos_service.editar_blocos(db, m.id, user.id, [
        {"op": "inserir", "depois_de": "b1", "blocos": [texto("novo")]},
        {"op": "substituir", "id": "b3", "bloco": {"tipo": "alerta", "nivel": "dica", "texto": "virou alerta", "id": "zz"}},
        {"op": "remover", "id": "b2"},
    ])
    assert [b["id"] for b in m.blocos] == ["b1", "b4", "b3"]
    assert m.blocos[2]["tipo"] == "alerta" and m.blocos[1]["conteudo"] == "novo"


def test_editar_blocos_antes_de_e_no_fim(db, user):
    m = _material(db, user, blocos=[texto("1")])
    m = estudos_service.editar_blocos(db, m.id, user.id, [
        {"op": "inserir", "antes_de": "b1", "blocos": [{"tipo": "secao", "titulo": "Início"}]},
        {"op": "inserir", "blocos": [texto("fim")]},
    ])
    assert [b["tipo"] for b in m.blocos] == ["secao", "texto", "texto"]
    assert m.blocos[-1]["conteudo"] == "fim"


def test_editar_blocos_atomico_quando_resultado_invalido(db, user):
    m = _material(db, user, tipo="exercicios", blocos=[texto("enunciado"), quiz()], fontes=FONTES)
    with pytest.raises(BlocosInvalidos, match="exige pelo menos 1 bloco 'quiz' ou 'questao_aberta'"):
        estudos_service.editar_blocos(db, m.id, user.id, [
            {"op": "inserir", "blocos": [texto("x")]},
            {"op": "remover", "id": "b2"},
        ])
    db.expire_all()
    assert [b["id"] for b in estudos_service.get_material(db, m.id, user.id).blocos] == ["b1", "b2"]


def test_editar_blocos_erros_de_operacao(db, user):
    m = _material(db, user, blocos=[texto("1")])
    with pytest.raises(BlocosInvalidos, match=r"operação 1 \(remover\): bloco 'b9' não existe"):
        estudos_service.editar_blocos(db, m.id, user.id, [{"op": "remover", "id": "b9"}])
    with pytest.raises(BlocosInvalidos, match=r"operação 1: op 'mover' desconhecida"):
        estudos_service.editar_blocos(db, m.id, user.id, [{"op": "mover", "id": "b1"}])
    with pytest.raises(BlocosInvalidos, match="lista não vazia"):
        estudos_service.editar_blocos(db, m.id, user.id, [])
    with pytest.raises(BlocosInvalidos, match="precisa de pelo menos 1 bloco"):
        estudos_service.editar_blocos(db, m.id, user.id, [{"op": "remover", "id": "b1"}])
    with pytest.raises(BlocosInvalidos, match=r"operação 1 \(inserir\): use 'depois_de' ou 'antes_de'"):
        estudos_service.editar_blocos(db, m.id, user.id, [
            {"op": "inserir", "depois_de": "b1", "antes_de": "b1", "blocos": [texto()]},
        ])
    assert estudos_service.editar_blocos(db, 999, user.id, [{"op": "remover", "id": "b1"}]) is None


def test_id_removido_nunca_reaproveitado_e_historico_marca_bloco_removido(db, user):
    m = _material(db, user, tipo="exercicios", blocos=[quiz(), quiz(pergunta="Outra?")], fontes=FONTES)
    estudos_service.registrar_resposta(db, m.id, user.id, "b2", 0)
    m = estudos_service.editar_blocos(db, m.id, user.id, [
        {"op": "remover", "id": "b2"},
        {"op": "inserir", "blocos": [quiz(pergunta="Nova?")]},
    ])
    assert [b["id"] for b in m.blocos] == ["b1", "b3"]
    historico = estudos_service.listar_respostas(db, user.id, material_id=m.id)
    assert historico[0]["bloco_id"] == "b2"
    assert historico[0]["bloco_existe"] is False and historico[0]["pergunta"] is None
    with pytest.raises(ValueError, match="não existe mais"):
        estudos_service.registrar_resposta(db, m.id, user.id, "b2", 1)


def test_resposta_quiz_calcula_acertou_no_servidor(db, user):
    m = _material(db, user, tipo="exercicios", blocos=[quiz(correta=1)], fontes=FONTES)
    errada = estudos_service.registrar_resposta(db, m.id, user.id, "b1", 0, acertou=True)
    certa = estudos_service.registrar_resposta(db, m.id, user.id, "b1", 1)
    assert (errada.acertou, certa.acertou) == (False, True)
    with pytest.raises(ValueError, match="Opção 3 não existe"):
        estudos_service.registrar_resposta(db, m.id, user.id, "b1", 3)
    with pytest.raises(ValueError, match="índice da opção"):
        estudos_service.registrar_resposta(db, m.id, user.id, "b1", "tupla")
    with pytest.raises(ValueError, match="índice da opção"):
        estudos_service.registrar_resposta(db, m.id, user.id, "b1", True)
    erros = estudos_service.listar_respostas(db, user.id, so_erros=True)
    assert [r["resposta"] for r in erros] == [0]
    assert erros[0]["pergunta"] == "Qual destes é imutável?" and erros[0]["bloco_existe"] is True


def test_resposta_questao_aberta_e_bloco_que_nao_e_pergunta(db, user):
    m = _material(db, user, tipo="exercicios", blocos=[
        texto("x"),
        {"tipo": "questao_aberta", "pergunta": "Por quê?", "resposta_modelo": "Porque sim."},
    ])
    with pytest.raises(ValueError, match="informe 'acertou'"):
        estudos_service.registrar_resposta(db, m.id, user.id, "b2", "minha resposta")
    r = estudos_service.registrar_resposta(db, m.id, user.id, "b2", "minha resposta", acertou=True)
    assert r.acertou is True and r.resposta == "minha resposta"
    with pytest.raises(ValueError, match="é do tipo 'texto' e não aceita resposta"):
        estudos_service.registrar_resposta(db, m.id, user.id, "b1", 0)


def test_marcar_estudado_idempotente(db, user):
    m = _material(db, user)
    primeira = estudos_service.marcar_estudado(db, m.id, user.id, True).estudado_em
    assert primeira is not None
    assert estudos_service.marcar_estudado(db, m.id, user.id, True).estudado_em == primeira
    assert estudos_service.marcar_estudado(db, m.id, user.id, False).estudado is False
    assert estudos_service.marcar_estudado(db, m.id, user.id, False).estudado is False
    assert estudos_service.marcar_estudado(db, 999, user.id, True) is None


def test_excluir_material_apaga_respostas(db, user):
    m = _material(db, user, tipo="exercicios", blocos=[quiz()], fontes=FONTES)
    estudos_service.registrar_resposta(db, m.id, user.id, "b1", 1)
    assert estudos_service.excluir_material(db, m.id, user.id) is True
    assert db.query(EstudoResposta).count() == 0
    assert estudos_service.excluir_material(db, m.id, user.id) is False


def test_listar_filtros(db, user):
    tema = estudos_service.salvar_tema(db, user.id, nome="SQL")
    a = _material(db, user, titulo="Índices em Postgres", tags=["postgres", "performance"], tema_id=tema.id)
    b = _material(db, user, tipo="resumo", titulo="Joins", tags=["sql"])
    estudos_service.marcar_estudado(db, b.id, user.id, True)

    def ids(**filtros):
        return [m.id for m in estudos_service.listar_materiais(db, user.id, **filtros)]

    assert set(ids()) == {a.id, b.id}
    assert ids(tema_id=tema.id) == [a.id]
    assert ids(tipo="resumo") == [b.id]
    assert ids(tag="Postgres") == [a.id]
    assert ids(busca="indices") == [a.id]   # sem acento, no título
    assert ids(busca="perform") == [a.id]   # nas tags
    assert ids(estudado=True) == [b.id] and ids(estudado=False) == [a.id]
    assert len(ids(limite=1)) == 1


def test_isolamento_entre_usuarios(db, user, outro_user):
    tema = estudos_service.salvar_tema(db, user.id, nome="Meu")
    m = _material(db, user, tipo="exercicios", blocos=[quiz()], fontes=FONTES, tema_id=tema.id)
    estudos_service.registrar_resposta(db, m.id, user.id, "b1", 1)
    assert estudos_service.get_material(db, m.id, outro_user.id) is None
    assert estudos_service.listar_materiais(db, outro_user.id) == []
    assert estudos_service.listar_temas(db, outro_user.id) == []
    assert estudos_service.listar_respostas(db, outro_user.id) == []
    assert estudos_service.registrar_resposta(db, m.id, outro_user.id, "b1", 1) is None
    assert estudos_service.editar_blocos(db, m.id, outro_user.id, [{"op": "remover", "id": "b1"}]) is None
    assert estudos_service.atualizar_material(db, m.id, outro_user.id, titulo="x") is None
    assert estudos_service.marcar_estudado(db, m.id, outro_user.id, True) is None
    assert estudos_service.excluir_material(db, m.id, outro_user.id) is False
    assert estudos_service.excluir_tema(db, tema.id, outro_user.id) is False
    with pytest.raises(ValueError, match="Tema"):
        _material(db, outro_user, tema_id=tema.id)
