"""Amostras de blocos/fontes válidos para os testes do módulo Estudos."""

FONTES = [
    {"titulo": "Python Docs — Data model", "url": "https://docs.python.org/3/reference/datamodel.html"},
    {"titulo": "PEP 8", "url": "https://peps.python.org/pep-0008/"},
]


def texto(conteudo: str = "Python é **interpretado** [1].") -> dict:
    return {"tipo": "texto", "conteudo": conteudo}


def quiz(**campos) -> dict:
    base = {
        "tipo": "quiz",
        "pergunta": "Qual destes é imutável?",
        "opcoes": ["lista", "tupla", "dict"],
        "correta": 1,
        "explicacao": "Tuplas não mudam depois de criadas [1].",
    }
    base.update(campos)
    return base


def blocos_todos_os_tipos() -> list[dict]:
    return [
        {"tipo": "secao", "titulo": "Introdução"},
        texto(),
        {"tipo": "conceito", "titulo": "Variável", "texto": "Um nome que aponta para um *objeto* [2]."},
        {"tipo": "definicao", "termo": "Tipagem dinâmica", "definicao": "O tipo pertence ao valor, não ao nome [1]."},
        {"tipo": "analogia", "texto": "Uma variável é uma etiqueta colada numa caixa."},
        {"tipo": "passos", "passos": [
            {"titulo": "Escreva", "texto": "Crie `ola.py`."},
            {"titulo": "Rode", "texto": "Execute `python ola.py`."},
        ]},
        {"tipo": "codigo", "linguagem": "python", "codigo": "print('olá')\n", "legenda": "Primeiro programa"},
        {"tipo": "comparacao", "colunas": ["Lista", "Tupla"],
         "linhas": [{"rotulo": "Mutável", "valores": ["sim", "não"], "destaque": 1}]},
        {"tipo": "decisao", "regras": [{"se": "Precisa alterar depois", "entao": "use **lista**"}]},
        {"tipo": "lista", "itens": ["Legível", "Versátil"], "estilo": "checklist"},
        {"tipo": "alerta", "nivel": "atencao", "texto": "Indentação faz parte da sintaxe [2].", "titulo": "Cuidado"},
        {"tipo": "formula", "latex": "O(n \\log n)", "legenda": "Ordenação"},
        {"tipo": "diagrama", "mermaid": "graph TD; A-->B", "legenda": "Fluxo"},
        quiz(),
        {"tipo": "questao_aberta", "pergunta": "Explique tipagem dinâmica.",
         "resposta_modelo": "O tipo vai com o valor, não com a variável [1]."},
    ]
