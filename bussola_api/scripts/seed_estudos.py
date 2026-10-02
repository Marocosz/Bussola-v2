"""
=======================================================================================
ARQUIVO: seed_estudos.py (Script de desenvolvimento - módulo Estudos)
=======================================================================================

OBJETIVO:
    Criar materiais de teste para conferir o frontend do módulo Estudos:
      - "Material de teste — todos os blocos": os 15 tipos, citações, escapes,
        um diagrama e uma fórmula com sintaxe inválida (devem virar aviso só no bloco);
      - com --grande: "Material de teste — 200 blocos" (limite do servidor).

USO (em bussola_api/, com o venv ativo):
    python scripts/seed_estudos.py --email voce@exemplo.com [--grande]
=======================================================================================
"""

import argparse
import os
import sys

from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import base  # noqa: E402  (registra todos os models)
from app.db.session import SessionLocal, engine  # noqa: E402
from app.models.user import User  # noqa: E402
from app.services.estudos import estudos_service  # noqa: E402

FONTES = [
    {"titulo": "PostgreSQL Docs — Index Types", "url": "https://www.postgresql.org/docs/current/indexes-types.html"},
    {"titulo": "Use The Index, Luke — Anatomy of an Index", "url": "https://use-the-index-luke.com/sql/anatomy"},
]


def blocos_completos() -> list[dict]:
    return [
        {"tipo": "secao", "titulo": "Formatação inline"},
        {"tipo": "texto", "conteudo": (
            "Texto com **negrito**, *itálico*, `código` e citações [1] e [2].\n\n"
            "Segundo parágrafo: `lista[0]` não é citação; colchetes literais \\[1]; "
            "2 * 3 * 4 = 24 fica literal; <b>HTML</b> aparece como texto.\nQuebra simples aqui."
        )},
        {"tipo": "conceito", "titulo": "Índice", "texto": "Estrutura auxiliar que evita ler a tabela inteira [1]."},
        {"tipo": "analogia", "texto": "Como o índice remissivo no fim de um livro."},
        {"tipo": "definicao", "termo": "B-tree", "definicao": "Árvore balanceada com nós de muitas chaves [2]."},
        {"tipo": "passos", "passos": [
            {"titulo": "Raiz", "texto": "Compara a chave com os separadores."},
            {"titulo": "Folha", "texto": "Chega à página com o ponteiro para a linha [2]."},
        ]},
        {"tipo": "codigo", "linguagem": "sql", "codigo": "CREATE INDEX idx_email ON usuario (email);\n-- ``` dentro do código\n",
         "legenda": "Índice simples"},
        {"tipo": "comparacao", "colunas": ["B-tree", "Hash"], "linhas": [
            {"rotulo": "Intervalos", "valores": ["sim", "não"], "destaque": 0},
            {"rotulo": "Igualdade", "valores": ["O(log n)", "O(1) médio"], "destaque": 1},
        ]},
        {"tipo": "decisao", "regras": [
            {"se": "Consulta por intervalo", "entao": "use **B-tree**"},
            {"se": "Só igualdade em tabela enorme", "entao": "considere *hash*"},
        ]},
        {"tipo": "lista", "itens": ["Colunas do WHERE", "Colunas do JOIN [1]"], "estilo": "checklist"},
        {"tipo": "lista", "itens": ["Item simples", "Outro item"]},
        {"tipo": "alerta", "nivel": "dica", "texto": "Meça antes de criar índices."},
        {"tipo": "alerta", "nivel": "atencao", "titulo": "Armadilha", "texto": "Índice demais deixa INSERT lento [1]."},
        {"tipo": "alerta", "nivel": "erro", "texto": "Função na coluna do WHERE anula o índice [2]."},
        {"tipo": "formula", "latex": "h \\approx \\log_m n", "legenda": "Altura da árvore"},
        {"tipo": "formula", "latex": "\\frac{1}{", "legenda": "Fórmula inválida (deve mostrar aviso)"},
        {"tipo": "diagrama", "mermaid": "graph TD\n  R[Raiz] --> A[Nó]\n  R --> B[Nó]\n  A --> F1[Folha]", "legenda": "Estrutura"},
        {"tipo": "diagrama", "mermaid": "graph TD; A-->", "legenda": "Diagrama inválido (deve mostrar aviso)"},
        {"tipo": "quiz", "pergunta": "Qual índice atende BETWEEN?", "opcoes": ["Hash", "B-tree", "Nenhum"],
         "correta": 1, "explicacao": "Hash só atende igualdade [1]."},
        {"tipo": "questao_aberta", "pergunta": "Por que índices deixam escritas mais lentas?",
         "resposta_modelo": "Cada INSERT/UPDATE também atualiza a estrutura do índice [2]."},
    ]


def blocos_grandes() -> list[dict]:
    paragrafo = ("Parágrafo longo para teste de desempenho com citação [1]. " * 25).strip()
    blocos: list[dict] = []
    for i in range(40):
        blocos.append({"tipo": "secao", "titulo": f"Seção {i + 1}"})
        blocos.append({"tipo": "texto", "conteudo": paragrafo})
        blocos.append({"tipo": "conceito", "titulo": f"Conceito {i + 1}", "texto": "Texto do conceito [2]."})
        blocos.append({"tipo": "codigo", "linguagem": "python", "codigo": f"def f{i}(x):\n    return x * {i}\n"})
        if i % 2:
            blocos.append({"tipo": "diagrama", "mermaid": f"graph LR\n  A{i}[Início] --> B{i}[Fim]"})
        else:
            blocos.append({"tipo": "formula", "latex": f"x_{{{i}}} = \\sum_{{k=1}}^{{{i + 1}}} k"})
    return blocos


def main() -> None:
    parser = argparse.ArgumentParser(description="Cria materiais de teste do módulo Estudos.")
    parser.add_argument("--email", required=True, help="email de um usuário existente")
    parser.add_argument("--grande", action="store_true", help="também cria um material com 200 blocos")
    args = parser.parse_args()

    base.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == args.email).first()
        if not user:
            sys.exit(f"Usuário {args.email} não encontrado.")
        tema = estudos_service.obter_ou_criar_tema(db, user.id, "Testes do frontend")
        m = estudos_service.criar_material(
            db, user.id, tipo="aula", titulo="Material de teste — todos os blocos",
            subtitulo="Cada tipo de bloco, avisos de render e citações", nivel="intermediario",
            tags=["teste"], tema_id=tema.id, blocos=blocos_completos(), fontes=FONTES,
        )
        print(f"Criado material {m.id}: /estudos/{m.id}")
        if args.grande:
            g = estudos_service.criar_material(
                db, user.id, tipo="resumo", titulo="Material de teste — 200 blocos",
                nivel="avancado", tags=["teste", "desempenho"], tema_id=tema.id,
                blocos=blocos_grandes(), fontes=FONTES,
            )
            print(f"Criado material {g.id}: /estudos/{g.id} ({len(g.blocos)} blocos)")
    finally:
        db.close()


if __name__ == "__main__":
    main()
