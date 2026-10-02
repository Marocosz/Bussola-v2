"""
=======================================================================================
ARQUIVO: estudos.py (Serviço de Domínio - Estudos)
=======================================================================================

OBJETIVO:
    Biblioteca de materiais de estudo: temas, materiais em blocos tipados (o contrato
    mora em app/schemas/estudos_blocos.py), respostas de quiz/questão aberta e
    marcação de estudado. Todo query filtra por user_id.

REGRAS:
    - Qualquer escrita em material revalida o material RESULTANTE inteiro antes de
      tocar no ORM: se falhar, nada muda (BlocosInvalidos / ValueError).
    - seq_bloco só cresce: id de bloco removido nunca volta a ser emitido.
=======================================================================================
"""

import re
import unicodedata
from typing import Any, Optional

from sqlalchemy import func
from sqlalchemy.orm import defer

from app.core.timezone import now_utc
from app.models.estudos import EstudoMaterial, EstudoResposta, EstudoTema
from app.schemas.estudos_blocos import (
    LIM_TAG, LIM_TITULO, MAX_TAGS, NIVEIS, TIPOS_RESPONDIVEIS, BlocosInvalidos, validar_fontes, validar_material,
)

LIM_SUBTITULO = 300
LIM_NOME_TEMA = 100
LIM_DESCRICAO_TEMA = 500
LIM_RESPOSTA_TEXTO = 5000
CAMPOS_MATERIAL = {"tipo", "titulo", "subtitulo", "nivel", "tags", "tema_id", "blocos", "fontes"}
_COR = re.compile(r"^#[0-9A-Fa-f]{6}$")
_ICONE = re.compile(r"^fa-[a-z0-9-]{1,40}$")


def _normalizar(texto: Optional[str]) -> str:
    sem_acento = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode()
    return sem_acento.casefold().strip()


def _normalizar_tags(tags: Any) -> list[str]:
    if tags is None:
        return []
    if not isinstance(tags, list):
        raise ValueError("'tags' deve ser uma lista de textos.")
    saida, vistos = [], set()
    for tag in tags:
        if not isinstance(tag, str):
            raise ValueError("'tags' deve ser uma lista de textos.")
        limpa = tag.strip()
        if not limpa:
            continue
        if len(limpa) > LIM_TAG:
            raise ValueError(f"A tag '{limpa[:20]}…' passa de {LIM_TAG} caracteres.")
        chave = _normalizar(limpa)
        if chave not in vistos:
            vistos.add(chave)
            saida.append(limpa)
    if len(saida) > MAX_TAGS:
        raise ValueError(f"Use no máximo {MAX_TAGS} tags.")
    return saida


def _indice(blocos: list[dict], bid: Any, n: int, op: str) -> int:
    if not bid:
        raise BlocosInvalidos(f"operação {n} ({op}): informe o id do bloco")
    for i, bloco in enumerate(blocos):
        if bloco.get("id") == bid:
            return i
    raise BlocosInvalidos(f"operação {n} ({op}): bloco '{bid}' não existe")


def _aplicar_operacoes(blocos: list[dict], operacoes: Any) -> list[dict]:
    """Aplica as operações em ordem sobre uma CÓPIA da lista. Não valida o conteúdo dos blocos
    (isso é da validar_material, chamada depois sobre o resultado)."""
    if not isinstance(operacoes, list) or not operacoes:
        raise BlocosInvalidos("informe 'operacoes' (lista não vazia)")
    resultado = [dict(b) for b in blocos]
    for n, oper in enumerate(operacoes, start=1):
        if not isinstance(oper, dict):
            raise BlocosInvalidos(f"operação {n}: deve ser um objeto com 'op'")
        op = oper.get("op")
        if op == "inserir":
            novos = oper.get("blocos")
            if not isinstance(novos, list) or not novos:
                raise BlocosInvalidos(f"operação {n} (inserir): informe 'blocos' (lista não vazia)")
            if oper.get("depois_de") and oper.get("antes_de"):
                raise BlocosInvalidos(f"operação {n} (inserir): use 'depois_de' ou 'antes_de', não os dois")
            if oper.get("depois_de"):
                pos = _indice(resultado, oper["depois_de"], n, op) + 1
            elif oper.get("antes_de"):
                pos = _indice(resultado, oper["antes_de"], n, op)
            else:
                pos = len(resultado)
            resultado[pos:pos] = [dict(b) if isinstance(b, dict) else b for b in novos]
        elif op == "substituir":
            i = _indice(resultado, oper.get("id"), n, op)
            novo = oper.get("bloco")
            if not isinstance(novo, dict):
                raise BlocosInvalidos(f"operação {n} (substituir): informe 'bloco' (objeto)")
            resultado[i] = {**novo, "id": resultado[i]["id"]}  # o id do bloco substituído é mantido
        elif op == "remover":
            del resultado[_indice(resultado, oper.get("id"), n, op)]
        else:
            raise BlocosInvalidos(f"operação {n}: op '{op}' desconhecida (use inserir, substituir ou remover)")
    return resultado


class EstudosService:

    # ---------- temas ----------
    def listar_temas(self, db, user_id: int) -> list[dict]:
        contagens = dict(
            db.query(EstudoMaterial.tema_id, func.count(EstudoMaterial.id))
            .filter(EstudoMaterial.user_id == user_id)
            .group_by(EstudoMaterial.tema_id)
            .all()
        )
        temas = db.query(EstudoTema).filter(EstudoTema.user_id == user_id).order_by(EstudoTema.nome).all()
        return [
            {"id": t.id, "nome": t.nome, "cor": t.cor, "icone": t.icone, "descricao": t.descricao,
             "total_materiais": contagens.get(t.id, 0)}
            for t in temas
        ]

    def get_tema(self, db, tema_id: int, user_id: int) -> Optional[EstudoTema]:
        return db.query(EstudoTema).filter(EstudoTema.id == tema_id, EstudoTema.user_id == user_id).first()

    def buscar_tema_por_nome(self, db, user_id: int, nome: str) -> Optional[EstudoTema]:
        alvo = _normalizar(nome)
        temas = db.query(EstudoTema).filter(EstudoTema.user_id == user_id).all()
        return next((t for t in temas if _normalizar(t.nome) == alvo), None)

    def salvar_tema(self, db, user_id: int, tema_id: Optional[int] = None, nome: Optional[str] = None,
                    cor: Optional[str] = None, icone: Optional[str] = None,
                    descricao: Optional[str] = None) -> Optional[EstudoTema]:
        if tema_id is None:
            if not (nome or "").strip():
                raise ValueError("Para criar um tema, informe o nome.")
            tema = EstudoTema(user_id=user_id)
        else:
            tema = self.get_tema(db, tema_id, user_id)
            if not tema:
                return None
        if nome is not None:
            nome = nome.strip()
            if not 1 <= len(nome) <= LIM_NOME_TEMA:
                raise ValueError(f"O nome do tema deve ter de 1 a {LIM_NOME_TEMA} caracteres.")
            existente = self.buscar_tema_por_nome(db, user_id, nome)
            if existente and existente.id != tema.id:
                raise ValueError(f"Já existe um tema chamado '{existente.nome}'.")
        if cor is not None and not _COR.match(cor):
            raise ValueError("'cor' deve estar no formato #RRGGBB.")
        if icone is not None and not _ICONE.match(icone):
            raise ValueError("'icone' deve ser uma classe do Font Awesome, ex.: fa-database.")
        if descricao is not None and len(descricao) > LIM_DESCRICAO_TEMA:
            raise ValueError(f"'descricao' passa de {LIM_DESCRICAO_TEMA} caracteres.")

        if nome is not None:
            tema.nome = nome
        if cor is not None:
            tema.cor = cor
        if icone is not None:
            tema.icone = icone
        if descricao is not None:
            tema.descricao = descricao.strip() or None
        if tema.id is None:
            db.add(tema)
        db.commit()
        db.refresh(tema)
        return tema

    def obter_ou_criar_tema(self, db, user_id: int, nome: str) -> EstudoTema:
        return self.buscar_tema_por_nome(db, user_id, nome) or self.salvar_tema(db, user_id, nome=nome)

    def excluir_tema(self, db, tema_id: int, user_id: int) -> bool:
        tema = self.get_tema(db, tema_id, user_id)
        if not tema:
            return False
        total = (
            db.query(func.count(EstudoMaterial.id))
            .filter(EstudoMaterial.user_id == user_id, EstudoMaterial.tema_id == tema.id)
            .scalar()
        )
        if total:
            raise ValueError(f"O tema '{tema.nome}' tem {total} material(is); mova ou exclua os materiais antes.")
        db.delete(tema)
        db.commit()
        return True

    # ---------- materiais ----------
    def listar_materiais(self, db, user_id: int, tema_id: Optional[int] = None, tipo: Optional[str] = None,
                         tag: Optional[str] = None, estudado: Optional[bool] = None,
                         busca: Optional[str] = None, limite: int = 100) -> list[EstudoMaterial]:
        query = (
            db.query(EstudoMaterial)
            .options(defer(EstudoMaterial.blocos))
            .filter(EstudoMaterial.user_id == user_id)
        )
        if tema_id is not None:
            query = query.filter(EstudoMaterial.tema_id == tema_id)
        if tipo:
            query = query.filter(EstudoMaterial.tipo == tipo)
        if estudado is True:
            query = query.filter(EstudoMaterial.estudado_em.isnot(None))
        elif estudado is False:
            query = query.filter(EstudoMaterial.estudado_em.is_(None))
        materiais = query.order_by(EstudoMaterial.atualizado_em.desc(), EstudoMaterial.id.desc()).all()
        if tag:
            alvo = _normalizar(tag)
            materiais = [m for m in materiais if any(_normalizar(t) == alvo for t in (m.tags or []))]
        if busca:
            alvo = _normalizar(busca)
            materiais = [
                m for m in materiais
                if alvo in _normalizar(m.titulo) or any(alvo in _normalizar(t) for t in (m.tags or []))
            ]
        return materiais[:max(1, limite)]

    def get_material(self, db, material_id: int, user_id: int) -> Optional[EstudoMaterial]:
        return (
            db.query(EstudoMaterial)
            .filter(EstudoMaterial.id == material_id, EstudoMaterial.user_id == user_id)
            .first()
        )

    def _cabecalho(self, db, user_id: int, campos: dict) -> dict:
        """Valida/normaliza os campos de cabeçalho presentes em `campos` (tipo é validado em validar_material)."""
        saida: dict[str, Any] = {}
        if "tipo" in campos:
            saida["tipo"] = campos["tipo"]
        if "titulo" in campos:
            titulo = (campos["titulo"] or "").strip()
            if not 1 <= len(titulo) <= LIM_TITULO:
                raise ValueError(f"'titulo' deve ter de 1 a {LIM_TITULO} caracteres.")
            saida["titulo"] = titulo
        if "subtitulo" in campos:
            subtitulo = (campos["subtitulo"] or "").strip()
            if len(subtitulo) > LIM_SUBTITULO:
                raise ValueError(f"'subtitulo' passa de {LIM_SUBTITULO} caracteres.")
            saida["subtitulo"] = subtitulo or None
        if "nivel" in campos:
            if campos["nivel"] not in NIVEIS:
                raise ValueError(f"'nivel' deve ser um de: {', '.join(NIVEIS)}.")
            saida["nivel"] = campos["nivel"]
        if "tags" in campos:
            saida["tags"] = _normalizar_tags(campos["tags"])
        if "tema_id" in campos:
            tema_id = campos["tema_id"]
            if tema_id is not None and not self.get_tema(db, tema_id, user_id):
                raise ValueError(f"Tema {tema_id} não encontrado.")
            saida["tema_id"] = tema_id
        return saida

    def criar_material(self, db, user_id: int, *, tipo: str, titulo: str, blocos: Any, fontes: Any = None,
                       tema_id: Optional[int] = None, subtitulo: Optional[str] = None,
                       nivel: str = "intermediario", tags: Any = None) -> EstudoMaterial:
        cabecalho = self._cabecalho(db, user_id, {
            "tipo": tipo, "titulo": titulo, "subtitulo": subtitulo, "nivel": nivel,
            "tags": tags or [], "tema_id": tema_id,
        })
        fontes_ok = validar_fontes(fontes)
        blocos_ok, seq = validar_material(tipo, blocos, len(fontes_ok), 0)
        agora = now_utc()
        material = EstudoMaterial(user_id=user_id, **cabecalho, blocos=blocos_ok, fontes=fontes_ok,
                                  seq_bloco=seq, criado_em=agora, atualizado_em=agora)
        db.add(material)
        db.commit()
        db.refresh(material)
        return material

    def atualizar_material(self, db, material_id: int, user_id: int, **campos) -> Optional[EstudoMaterial]:
        """Edição parcial: só as chaves presentes mudam. `blocos` substitui a lista inteira.
        Qualquer mudança revalida o material resultante inteiro (tipo × blocos × fontes)."""
        material = self.get_material(db, material_id, user_id)
        if not material:
            return None
        desconhecidos = set(campos) - CAMPOS_MATERIAL
        if desconhecidos:
            raise ValueError(f"campo(s) desconhecido(s): {', '.join(sorted(desconhecidos))}")
        cabecalho = self._cabecalho(db, user_id, campos)
        fontes = validar_fontes(campos["fontes"]) if "fontes" in campos else list(material.fontes or [])
        tipo = cabecalho.get("tipo", material.tipo)
        blocos = campos["blocos"] if "blocos" in campos else [dict(b) for b in material.blocos]
        blocos_ok, seq = validar_material(tipo, blocos, len(fontes), material.seq_bloco or 0)

        for chave, valor in cabecalho.items():
            setattr(material, chave, valor)
        material.fontes = fontes
        material.blocos = blocos_ok
        material.seq_bloco = seq
        material.atualizado_em = now_utc()
        db.commit()
        db.refresh(material)
        return material

    def editar_blocos(self, db, material_id: int, user_id: int, operacoes: Any) -> Optional[EstudoMaterial]:
        material = self.get_material(db, material_id, user_id)
        if not material:
            return None
        resultado = _aplicar_operacoes(material.blocos or [], operacoes)
        blocos_ok, seq = validar_material(material.tipo, resultado, len(material.fontes or []), material.seq_bloco or 0)
        material.blocos = blocos_ok
        material.seq_bloco = seq
        material.atualizado_em = now_utc()
        db.commit()
        db.refresh(material)
        return material

    def marcar_estudado(self, db, material_id: int, user_id: int, estudado: bool) -> Optional[EstudoMaterial]:
        """Idempotente: marcar de novo mantém a data da primeira marcação."""
        material = self.get_material(db, material_id, user_id)
        if not material:
            return None
        if estudado and material.estudado_em is None:
            material.estudado_em = now_utc()
        elif not estudado:
            material.estudado_em = None
        db.commit()
        db.refresh(material)
        return material

    def excluir_material(self, db, material_id: int, user_id: int) -> bool:
        material = self.get_material(db, material_id, user_id)
        if not material:
            return False
        db.query(EstudoResposta).filter(
            EstudoResposta.material_id == material.id, EstudoResposta.user_id == user_id
        ).delete(synchronize_session=False)
        db.delete(material)
        db.commit()
        return True

    # ---------- respostas ----------
    def registrar_resposta(self, db, material_id: int, user_id: int, bloco_id: str, resposta: Any,
                           acertou: Optional[bool] = None) -> Optional[EstudoResposta]:
        """Quiz: `resposta` = índice da opção; `acertou` é calculado aqui (o do cliente é ignorado).
        Questão aberta: `resposta` = texto livre (opcional); `acertou` vem do usuário."""
        material = self.get_material(db, material_id, user_id)
        if not material:
            return None
        bloco = next((b for b in material.blocos or [] if b.get("id") == bloco_id), None)
        if bloco is None:
            raise ValueError(f"O bloco '{bloco_id}' não existe mais neste material (recarregue a página).")
        if bloco["tipo"] == "quiz":
            if isinstance(resposta, bool) or not isinstance(resposta, int):
                raise ValueError("Para quiz, 'resposta' é o índice da opção escolhida.")
            if not 0 <= resposta < len(bloco["opcoes"]):
                raise ValueError(f"Opção {resposta} não existe (o quiz tem {len(bloco['opcoes'])} opções).")
            certo = resposta == bloco["correta"]
        elif bloco["tipo"] == "questao_aberta":
            if acertou is None:
                raise ValueError("Para questão aberta, informe 'acertou' (true/false).")
            resposta = "" if resposta is None else str(resposta)
            if len(resposta) > LIM_RESPOSTA_TEXTO:
                raise ValueError(f"A resposta passa de {LIM_RESPOSTA_TEXTO} caracteres.")
            certo = bool(acertou)
        else:
            raise ValueError(f"O bloco '{bloco_id}' é do tipo '{bloco['tipo']}' e não aceita resposta.")
        registro = EstudoResposta(user_id=user_id, material_id=material.id, bloco_id=bloco_id,
                                  resposta=resposta, acertou=certo, respondido_em=now_utc())
        db.add(registro)
        db.commit()
        db.refresh(registro)
        return registro

    def listar_respostas(self, db, user_id: int, material_id: Optional[int] = None, so_erros: bool = False,
                         limite: int = 50) -> list[dict]:
        query = (
            db.query(EstudoResposta, EstudoMaterial)
            .join(EstudoMaterial, EstudoMaterial.id == EstudoResposta.material_id)
            .filter(EstudoResposta.user_id == user_id, EstudoMaterial.user_id == user_id)
        )
        if material_id is not None:
            query = query.filter(EstudoResposta.material_id == material_id)
        if so_erros:
            query = query.filter(EstudoResposta.acertou.is_(False))
        linhas = (
            query.order_by(EstudoResposta.respondido_em.desc(), EstudoResposta.id.desc())
            .limit(max(1, limite))
            .all()
        )
        saida = []
        for resposta, material in linhas:
            bloco = next(
                (b for b in material.blocos or []
                 if b.get("id") == resposta.bloco_id and b["tipo"] in TIPOS_RESPONDIVEIS),
                None,
            )
            saida.append({
                "id": resposta.id,
                "material_id": material.id,
                "material": material.titulo,
                "bloco_id": resposta.bloco_id,
                "bloco_existe": bloco is not None,
                "pergunta": bloco["pergunta"] if bloco else None,
                "resposta": resposta.resposta,
                "acertou": resposta.acertou,
                "respondido_em": resposta.respondido_em.isoformat() if resposta.respondido_em else None,
            })
        return saida


estudos_service = EstudosService()
