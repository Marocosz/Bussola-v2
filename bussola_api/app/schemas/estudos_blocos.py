"""
=======================================================================================
ARQUIVO: estudos_blocos.py (Schemas - contrato dos blocos do módulo Estudos)
=======================================================================================

OBJETIVO:
    Fonte única do formato dos materiais de estudo: modelos de cada bloco (união
    discriminada por `tipo`), fontes, regras de composição do material, citações [n],
    geração/preservação de ids e o catálogo exposto ao Claude (catalogo_de_blocos).

    A gramática inline (citações) é espelhada no site em
    bussola_web/src/pages/Estudos/blocos/inline.js — mudou aqui, mude lá.
=======================================================================================
"""

import re
from typing import Annotated, Any, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, StrictInt, StringConstraints, ValidationError

VERSAO_FORMATO = 1

MAX_BLOCOS = 200
MAX_FONTES = 50
MAX_TAGS = 10
LIM_TITULO = 200
LIM_TEXTO = 6000
LIM_ITEM = 1000
LIM_CODIGO = 20000
LIM_LATEX = 2000
LIM_MERMAID = 6000
LIM_URL = 1000
LIM_TAG = 40

TIPOS_MATERIAL = ("aula", "resumo", "comparativo", "exercicios")
NIVEIS = ("iniciante", "intermediario", "avancado")
TIPOS_RESPONDIVEIS = ("quiz", "questao_aberta")


class BlocosInvalidos(ValueError):
    """Material fora do contrato. A mensagem (português) aponta bloco e campo."""


# ---------------------------------------------------------------------------
# Tipos base
# ---------------------------------------------------------------------------
Titulo = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=LIM_TITULO)]
Texto = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=LIM_TEXTO)]
Item = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=LIM_ITEM)]
Legenda = Optional[Annotated[str, StringConstraints(strip_whitespace=True, max_length=LIM_TITULO)]]
IdBloco = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9_-]{1,24}$")]


class _Estrito(BaseModel):
    model_config = ConfigDict(extra="forbid")


class _Bloco(_Estrito):
    id: Optional[IdBloco] = None


class BlocoSecao(_Bloco):
    tipo: Literal["secao"]
    titulo: Titulo


class BlocoTexto(_Bloco):
    tipo: Literal["texto"]
    conteudo: Texto


class BlocoConceito(_Bloco):
    tipo: Literal["conceito"]
    titulo: Titulo
    texto: Texto


class BlocoDefinicao(_Bloco):
    tipo: Literal["definicao"]
    termo: Titulo
    definicao: Texto


class BlocoAnalogia(_Bloco):
    tipo: Literal["analogia"]
    texto: Texto


class Passo(_Estrito):
    titulo: Titulo
    texto: Texto


class BlocoPassos(_Bloco):
    tipo: Literal["passos"]
    passos: list[Passo] = Field(min_length=2, max_length=20)


class BlocoCodigo(_Bloco):
    tipo: Literal["codigo"]
    linguagem: Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^[A-Za-z0-9+#._-]{1,30}$")]
    codigo: Annotated[str, StringConstraints(min_length=1, max_length=LIM_CODIGO)]  # sem strip: indentação importa
    legenda: Legenda = None


class LinhaComparacao(_Estrito):
    rotulo: Item
    valores: list[Item] = Field(min_length=1, max_length=6)
    destaque: Optional[StrictInt] = None


class BlocoComparacao(_Bloco):
    tipo: Literal["comparacao"]
    colunas: list[Titulo] = Field(min_length=2, max_length=6)
    linhas: list[LinhaComparacao] = Field(min_length=1, max_length=40)


class Regra(_Estrito):
    se: Item
    entao: Item


class BlocoDecisao(_Bloco):
    tipo: Literal["decisao"]
    regras: list[Regra] = Field(min_length=1, max_length=20)


class BlocoLista(_Bloco):
    tipo: Literal["lista"]
    itens: list[Item] = Field(min_length=1, max_length=50)
    estilo: Literal["pontos", "checklist"] = "pontos"


class BlocoAlerta(_Bloco):
    tipo: Literal["alerta"]
    nivel: Literal["dica", "atencao", "erro"]
    texto: Texto
    titulo: Optional[Titulo] = None


class BlocoFormula(_Bloco):
    tipo: Literal["formula"]
    latex: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=LIM_LATEX)]
    legenda: Legenda = None


class BlocoDiagrama(_Bloco):
    tipo: Literal["diagrama"]
    mermaid: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=LIM_MERMAID)]
    legenda: Legenda = None


class BlocoQuiz(_Bloco):
    tipo: Literal["quiz"]
    pergunta: Item
    opcoes: list[Item] = Field(min_length=2, max_length=6)
    correta: StrictInt
    explicacao: Texto


class BlocoQuestaoAberta(_Bloco):
    tipo: Literal["questao_aberta"]
    pergunta: Item
    resposta_modelo: Texto


Bloco = Annotated[
    Union[
        BlocoSecao, BlocoTexto, BlocoConceito, BlocoDefinicao, BlocoAnalogia, BlocoPassos, BlocoCodigo,
        BlocoComparacao, BlocoDecisao, BlocoLista, BlocoAlerta, BlocoFormula, BlocoDiagrama, BlocoQuiz,
        BlocoQuestaoAberta,
    ],
    Field(discriminator="tipo"),
]

# tipo -> modelo (os mesmos membros da união; validar pelo membro escolhido pela tag deixa o
# caminho do erro sem o prefixo da tag, o que dá mensagens mais limpas)
MODELOS: dict[str, type[_Bloco]] = {
    "secao": BlocoSecao, "texto": BlocoTexto, "conceito": BlocoConceito, "definicao": BlocoDefinicao,
    "analogia": BlocoAnalogia, "passos": BlocoPassos, "codigo": BlocoCodigo, "comparacao": BlocoComparacao,
    "decisao": BlocoDecisao, "lista": BlocoLista, "alerta": BlocoAlerta, "formula": BlocoFormula,
    "diagrama": BlocoDiagrama, "quiz": BlocoQuiz, "questao_aberta": BlocoQuestaoAberta,
}


class Fonte(_Estrito):
    titulo: Titulo
    url: Annotated[str, StringConstraints(strip_whitespace=True, max_length=LIM_URL, pattern=r"^https?://\S+$")]


# ---------------------------------------------------------------------------
# Gramática inline (só o necessário para achar citações) — ver o plano/ESTUDOS.md
# ---------------------------------------------------------------------------
ESCAPAVEIS = set("\\*`[]")
_CITACAO = re.compile(r"\[(\d{1,3})\]")
_PARAGRAFO = re.compile(r"\n{2,}")

# Campos que aceitam formatação inline, por tipo de bloco (documentação do catálogo)
CAMPOS_INLINE: dict[str, list[str]] = {
    "texto": ["conteudo"], "conceito": ["texto"], "definicao": ["definicao"], "analogia": ["texto"],
    "passos": ["passos[].texto"], "alerta": ["texto"], "quiz": ["explicacao"],
    "questao_aberta": ["resposta_modelo"], "lista": ["itens[]"], "decisao": ["regras[].entao"],
}
_CAMPO_INLINE_SIMPLES = {
    "texto": "conteudo", "conceito": "texto", "definicao": "definicao", "analogia": "texto",
    "alerta": "texto", "quiz": "explicacao", "questao_aberta": "resposta_modelo",
}


def citacoes(texto: str) -> list[int]:
    """Números citados com [n], com as mesmas regras do TextoInline do site: parágrafos
    (linha em branco) isolados, '\\x' escapa, `código` não é interpretado (crase sem par é literal)."""
    achados: list[int] = []
    for paragrafo in _PARAGRAFO.split(texto):
        i, n = 0, len(paragrafo)
        while i < n:
            c = paragrafo[i]
            if c == "\\" and i + 1 < n and paragrafo[i + 1] in ESCAPAVEIS:
                i += 2
                continue
            if c == "`":
                fim = paragrafo.find("`", i + 1)
                if fim != -1:
                    i = fim + 1
                    continue
            if c == "[":
                m = _CITACAO.match(paragrafo, i)
                if m:
                    achados.append(int(m.group(1)))
                    i = m.end()
                    continue
            i += 1
    return achados


def textos_inline(bloco: dict) -> list[tuple[str, str]]:
    """(caminho do campo, texto) de todos os campos com formatação inline de um bloco já validado."""
    tipo = bloco["tipo"]
    if tipo == "passos":
        return [(f"passos[{i}].texto", p["texto"]) for i, p in enumerate(bloco["passos"])]
    if tipo == "lista":
        return [(f"itens[{i}]", item) for i, item in enumerate(bloco["itens"])]
    if tipo == "decisao":
        return [(f"regras[{i}].entao", r["entao"]) for i, r in enumerate(bloco["regras"])]
    campo = _CAMPO_INLINE_SIMPLES.get(tipo)
    return [(campo, bloco[campo])] if campo else []


# ---------------------------------------------------------------------------
# Mensagens de erro em português
# ---------------------------------------------------------------------------
def _caminho(loc) -> str:
    texto = ""
    for parte in loc:
        if isinstance(parte, int):
            texto += f"[{parte}]"
        else:
            texto += f".{parte}" if texto else str(parte)
    return texto


def _fragmento(erro: dict) -> str:
    campo = _caminho(erro.get("loc", ()))
    tipo, ctx = erro["type"], erro.get("ctx") or {}
    if tipo == "extra_forbidden":
        return f"campo '{campo}' não existe neste tipo"
    alvo = f"'{campo}' " if campo else ""
    if tipo == "missing":
        return f"{alvo}é obrigatório"
    if tipo == "string_too_short":
        return f"{alvo}não pode ser vazio"
    if tipo == "string_too_long":
        return f"{alvo}passa do limite de {ctx.get('max_length')} caracteres"
    if tipo == "too_short":
        return f"{alvo}precisa de pelo menos {ctx.get('min_length')} item(ns)"
    if tipo == "too_long":
        return f"{alvo}aceita no máximo {ctx.get('max_length')} item(ns)"
    if tipo == "literal_error":
        return f"{alvo}deve ser um de: {ctx.get('expected')}"
    if tipo == "string_pattern_mismatch":
        if campo.endswith("url"):
            return f"{alvo}deve começar com http:// ou https://"
        return f"{alvo}tem formato inválido"
    if tipo == "string_type":
        return f"{alvo}deve ser texto"
    if tipo.startswith("int"):
        return f"{alvo}deve ser um número inteiro"
    if tipo == "list_type":
        return f"{alvo}deve ser uma lista"
    if tipo in ("model_type", "dict_type", "model_attributes_type"):
        return f"{alvo}deve ser um objeto"
    return f"{alvo}{erro.get('msg', 'inválido')}"


def _erro(prefixo: str, exc: ValidationError) -> BlocosInvalidos:
    return BlocosInvalidos(f"{prefixo}: " + "; ".join(_fragmento(e) for e in exc.errors()[:5]))


# ---------------------------------------------------------------------------
# Validação
# ---------------------------------------------------------------------------
def _checar_regras(prefixo: str, bloco: dict) -> None:
    if bloco["tipo"] == "quiz":
        n = len(bloco["opcoes"])
        if not 0 <= bloco["correta"] < n:
            raise BlocosInvalidos(
                f"{prefixo}: 'correta' = {bloco['correta']}, mas há {n} opções (use um índice de 0 a {n - 1})"
            )
    elif bloco["tipo"] == "comparacao":
        n = len(bloco["colunas"])
        for i, linha in enumerate(bloco["linhas"]):
            if len(linha["valores"]) != n:
                raise BlocosInvalidos(f"{prefixo}: linhas[{i}] tem {len(linha['valores'])} valores, mas há {n} colunas")
            destaque = linha.get("destaque")
            if destaque is not None and not 0 <= destaque < n:
                raise BlocosInvalidos(
                    f"{prefixo}: linhas[{i}].destaque = {destaque}, mas há {n} colunas (use um índice de 0 a {n - 1})"
                )


def _checar_citacoes(prefixo: str, bloco: dict, n_fontes: int) -> None:
    for campo, texto in textos_inline(bloco):
        for n in citacoes(texto):
            if not 1 <= n <= n_fontes:
                disponivel = f"o material tem {n_fontes} fonte(s)" if n_fontes else "o material não tem fontes"
                raise BlocosInvalidos(f"{prefixo}: citação [{n}] em '{campo}', mas {disponivel}")


def _validar_bloco(posicao: int, bruto: Any, n_fontes: int) -> dict:
    if not isinstance(bruto, dict):
        raise BlocosInvalidos(f"bloco {posicao}: deve ser um objeto com 'tipo'")
    tipo = bruto.get("tipo")
    if tipo is None:
        raise BlocosInvalidos(f"bloco {posicao}: informe 'tipo'. Tipos válidos: {', '.join(MODELOS)}")
    modelo = MODELOS.get(tipo) if isinstance(tipo, str) else None
    if modelo is None:
        raise BlocosInvalidos(f"bloco {posicao}: tipo '{tipo}' desconhecido. Tipos válidos: {', '.join(MODELOS)}")
    prefixo = f"bloco {posicao} ({tipo})"
    try:
        dados = modelo.model_validate(bruto).model_dump(exclude_none=True)
    except ValidationError as exc:
        raise _erro(prefixo, exc) from None
    _checar_regras(prefixo, dados)
    _checar_citacoes(prefixo, dados, n_fontes)
    return dados


MINIMOS: dict[str, tuple[tuple[str, ...], str]] = {
    "comparativo": (("comparacao",), "pelo menos 1 bloco 'comparacao'"),
    "exercicios": (("quiz", "questao_aberta"), "pelo menos 1 bloco 'quiz' ou 'questao_aberta'"),
}

_ID_GERADO = re.compile(r"^b(\d{1,6})$")


def _atribuir_ids(blocos: list[dict], seq_bloco: int) -> tuple[list[dict], int]:
    vistos: dict[str, int] = {}
    seq = seq_bloco
    for pos, bloco in enumerate(blocos, start=1):
        bid = bloco.get("id")
        if bid is None:
            continue
        if bid in vistos:
            raise BlocosInvalidos(f"bloco {pos} ({bloco['tipo']}): id '{bid}' repetido (já usado no bloco {vistos[bid]})")
        vistos[bid] = pos
        m = _ID_GERADO.match(bid)
        if m:
            seq = max(seq, int(m.group(1)))
    saida = []
    for bloco in blocos:
        bid = bloco.get("id")
        if bid is None:
            seq += 1
            while f"b{seq}" in vistos:
                seq += 1
            bid = f"b{seq}"
            vistos[bid] = 0
        saida.append({"id": bid, **{k: v for k, v in bloco.items() if k != "id"}})
    return saida, seq


def validar_fontes(fontes: Any) -> list[dict]:
    if fontes is None:
        return []
    if not isinstance(fontes, list):
        raise BlocosInvalidos("'fontes' deve ser uma lista de {titulo, url}")
    if len(fontes) > MAX_FONTES:
        raise BlocosInvalidos(f"o material aceita no máximo {MAX_FONTES} fontes (recebeu {len(fontes)})")
    saida = []
    for i, fonte in enumerate(fontes, start=1):
        try:
            saida.append(Fonte.model_validate(fonte).model_dump())
        except ValidationError as exc:
            raise _erro(f"fonte {i}", exc) from None
    return saida


def validar_material(tipo_material: str, blocos: Any, n_fontes: int, seq_bloco: int = 0) -> tuple[list[dict], int]:
    """Valida o material inteiro. Devolve (blocos normalizados com id, novo seq_bloco).
    Levanta BlocosInvalidos (ValueError) com mensagem apontando o local."""
    if tipo_material not in TIPOS_MATERIAL:
        raise BlocosInvalidos(f"tipo de material '{tipo_material}' inválido. Use: {', '.join(TIPOS_MATERIAL)}")
    if not isinstance(blocos, list) or not blocos:
        raise BlocosInvalidos("o material precisa de pelo menos 1 bloco")
    if len(blocos) > MAX_BLOCOS:
        raise BlocosInvalidos(f"o material aceita no máximo {MAX_BLOCOS} blocos (recebeu {len(blocos)})")
    validados = [_validar_bloco(pos, bruto, n_fontes) for pos, bruto in enumerate(blocos, start=1)]
    regra = MINIMOS.get(tipo_material)
    if regra and not any(b["tipo"] in regra[0] for b in validados):
        raise BlocosInvalidos(f"material do tipo '{tipo_material}' exige {regra[1]}")
    return _atribuir_ids(validados, seq_bloco)


# ---------------------------------------------------------------------------
# Catálogo (contrato lido pelo Claude via MCP)
# ---------------------------------------------------------------------------
DESCRICOES: dict[str, dict[str, Any]] = {
    "secao": {
        "uso": "Divide o material em partes com título (vira âncora no site).",
        "campos": {"titulo": f"texto até {LIM_TITULO}"},
        "exemplo": {"tipo": "secao", "titulo": "Como funciona"},
    },
    "texto": {
        "uso": "Prosa curta: motivação, ligação entre blocos, explicação. Parágrafos separados por linha em branco.",
        "campos": {"conteudo": f"texto com formatação inline, até {LIM_TEXTO}"},
        "exemplo": {"tipo": "texto", "conteudo": "Um *índice* evita ler a tabela inteira [1].\n\nO custo é escrita mais lenta."},
    },
    "conceito": {
        "uso": "A ideia central de um assunto, em cartão de destaque.",
        "campos": {"titulo": f"texto até {LIM_TITULO}", "texto": f"inline, até {LIM_TEXTO}"},
        "exemplo": {"tipo": "conceito", "titulo": "Índice", "texto": "Estrutura auxiliar que acelera buscas [1]."},
    },
    "definicao": {
        "uso": "Termo + definição formal (com citação).",
        "campos": {"termo": f"texto até {LIM_TITULO}", "definicao": f"inline, até {LIM_TEXTO}"},
        "exemplo": {"tipo": "definicao", "termo": "B-tree", "definicao": "Árvore balanceada de busca com nós de muitas chaves [1]."},
    },
    "analogia": {
        "uso": "Ponte com algo cotidiano, antes da definição formal.",
        "campos": {"texto": f"inline, até {LIM_TEXTO}"},
        "exemplo": {"tipo": "analogia", "texto": "Um índice é como o índice remissivo no fim de um livro."},
    },
    "passos": {
        "uso": "Processo ordenado (2 a 20 passos).",
        "campos": {"passos": f"lista de {{titulo (até {LIM_TITULO}), texto (inline, até {LIM_TEXTO})}}, 2 a 20"},
        "exemplo": {"tipo": "passos", "passos": [
            {"titulo": "Busca", "texto": "Desce da raiz comparando chaves."},
            {"titulo": "Leitura", "texto": "Lê só as páginas necessárias [2]."},
        ]},
    },
    "codigo": {
        "uso": "Exemplo executável, comando ou configuração (realce de sintaxe + copiar).",
        "campos": {"linguagem": "identificador (ex.: python, sql, bash, ts), até 30", "codigo": f"texto literal até {LIM_CODIGO}",
                   "legenda": f"opcional, até {LIM_TITULO}"},
        "exemplo": {"tipo": "codigo", "linguagem": "sql", "codigo": "CREATE INDEX idx_email ON usuario (email);", "legenda": "Índice simples"},
    },
    "comparacao": {
        "uso": "Tabela critérios × opções; destaque = índice da coluna vencedora na linha.",
        "campos": {"colunas": "2 a 6 nomes", "linhas": "1 a 40 de {rotulo, valores (um por coluna), destaque? (índice da coluna)}"},
        "exemplo": {"tipo": "comparacao", "colunas": ["B-tree", "Hash"], "linhas": [
            {"rotulo": "Busca por intervalo", "valores": ["sim", "não"], "destaque": 0},
            {"rotulo": "Igualdade", "valores": ["O(log n)", "O(1) médio"], "destaque": 1},
        ]},
    },
    "decisao": {
        "uso": "Guia 'quando usar o quê' em regras se → então.",
        "campos": {"regras": f"1 a 20 de {{se (até {LIM_ITEM}), entao (inline, até {LIM_ITEM})}}"},
        "exemplo": {"tipo": "decisao", "regras": [{"se": "Consultas por intervalo", "entao": "use **B-tree**"}]},
    },
    "lista": {
        "uso": "Itens sem ordem; estilo checklist para verificações.",
        "campos": {"itens": f"1 a 50 textos inline (até {LIM_ITEM})", "estilo": "pontos (padrão) | checklist"},
        "exemplo": {"tipo": "lista", "itens": ["Colunas do WHERE", "Colunas do JOIN"], "estilo": "checklist"},
    },
    "alerta": {
        "uso": "Callout: dica, atencao (armadilha) ou erro (erro comum grave).",
        "campos": {"nivel": "dica | atencao | erro", "texto": f"inline, até {LIM_TEXTO}", "titulo": f"opcional, até {LIM_TITULO}"},
        "exemplo": {"tipo": "alerta", "nivel": "atencao", "titulo": "Armadilha", "texto": "Índice demais deixa INSERT lento [1]."},
    },
    "formula": {
        "uso": "Matemática em LaTeX (KaTeX, sem \\href/\\url/macros).",
        "campos": {"latex": f"LaTeX até {LIM_LATEX}", "legenda": f"opcional, até {LIM_TITULO}"},
        "exemplo": {"tipo": "formula", "latex": "h \\approx \\log_m n", "legenda": "Altura da árvore"},
    },
    "diagrama": {
        "uso": "Fluxos, sequências, estados, hierarquias em Mermaid (sem click/HTML).",
        "campos": {"mermaid": f"código Mermaid até {LIM_MERMAID}", "legenda": f"opcional, até {LIM_TITULO}"},
        "exemplo": {"tipo": "diagrama", "mermaid": "graph TD\n  R[Raiz] --> A[Nó]\n  R --> B[Nó]", "legenda": "Estrutura"},
    },
    "quiz": {
        "uso": "Pergunta de múltipla escolha interativa (registra a resposta).",
        "campos": {"pergunta": f"texto até {LIM_ITEM}", "opcoes": f"2 a 6 textos (até {LIM_ITEM})",
                   "correta": "índice (0-based) da opção correta", "explicacao": f"inline, até {LIM_TEXTO}"},
        "exemplo": {"tipo": "quiz", "pergunta": "Qual índice atende 'WHERE idade BETWEEN 20 AND 30'?",
                    "opcoes": ["Hash", "B-tree"], "correta": 1, "explicacao": "Hash só atende igualdade [1]."},
    },
    "questao_aberta": {
        "uso": "Pergunta discursiva: o usuário revela a resposta modelo e marca acertei/errei.",
        "campos": {"pergunta": f"texto até {LIM_ITEM}", "resposta_modelo": f"inline, até {LIM_TEXTO}"},
        "exemplo": {"tipo": "questao_aberta", "pergunta": "Por que índices deixam escritas mais lentas?",
                    "resposta_modelo": "Cada INSERT/UPDATE também atualiza a estrutura do índice [1]."},
    },
}


def catalogo() -> dict[str, Any]:
    blocos = {}
    for tipo, modelo in MODELOS.items():
        desc = DESCRICOES[tipo]
        blocos[tipo] = {
            "uso": desc["uso"],
            "campos": desc["campos"],
            "obrigatorios": [nome for nome, info in modelo.model_fields.items() if info.is_required() and nome != "tipo"],
            "formatacao_inline": CAMPOS_INLINE.get(tipo, []),
            "exemplo": desc["exemplo"],
        }
    return {
        "versao_formato": VERSAO_FORMATO,
        "tipos_material": {
            "aula": "ensinar um assunto do zero até usar",
            "resumo": "revisão densa de algo já estudado",
            "comparativo": "X vs Y: tabela + regras de decisão",
            "exercicios": "prática graduada (quiz e questões abertas)",
        },
        "minimos_por_tipo_material": {tipo: list(regra[0]) for tipo, regra in MINIMOS.items()},
        "niveis": list(NIVEIS),
        "limites": {
            "blocos_por_material": MAX_BLOCOS, "fontes": MAX_FONTES, "tags": MAX_TAGS, "tag": LIM_TAG,
            "titulo": LIM_TITULO, "texto": LIM_TEXTO, "item": LIM_ITEM, "codigo": LIM_CODIGO,
            "latex": LIM_LATEX, "mermaid": LIM_MERMAID, "url": LIM_URL,
        },
        "formatacao_inline": {
            "campos": [f"{tipo}.{campo}" for tipo, campos in CAMPOS_INLINE.items() for campo in campos],
            "sintaxe": [
                "**negrito** e *itálico* (a marca de abertura não pode ser seguida de espaço, nem a de fechamento precedida)",
                "`código` (conteúdo literal)",
                "[n] = citação da fonte n (1 a 3 dígitos; 1 ≤ n ≤ len(fontes))",
                "escapes: \\* \\` \\[ \\] \\\\",
                "linha em branco separa parágrafos; nunca HTML nem Markdown de títulos/listas/links",
            ],
        },
        "regras": [
            "Cada bloco: {\"id\"?, \"tipo\", ...campos}. Sem id = o servidor gera b<n>; ids existentes são preservados e únicos.",
            "Ao reenviar blocos em salvar_material, mantenha o id dos blocos que continuam.",
            "Ids de blocos removidos nunca são reaproveitados.",
            "fontes = [{titulo, url (http/https)}]; [n] aponta para a posição n (começa em 1).",
            "Erros indicam 'bloco N (tipo)' com N a partir de 1; índices internos (opcoes[1], linhas[0]) começam em 0.",
            "O servidor não interpreta Mermaid nem LaTeX: sintaxe inválida aparece como aviso no site.",
        ],
        "blocos": blocos,
    }
