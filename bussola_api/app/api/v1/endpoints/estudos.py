"""Endpoints do módulo Estudos (prefixo /estudos). O site só lê, responde e marca estudado;
quem cria/edita material é o Claude, via MCP."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api import deps
from app.schemas.estudos import (
    EstudadoUpdate, MaterialResponse, MaterialResumo, RespostaCreate, RespostaResponse, TemaResponse,
)
from app.services import estudos_kit
from app.services.estudos import estudos_service

router = APIRouter()


def _material_ou_404(db: Session, material_id: int, user_id: int):
    material = estudos_service.get_material(db, material_id, user_id)
    if not material:
        raise HTTPException(status_code=404, detail="Material não encontrado")
    return material


@router.get("/temas", response_model=list[TemaResponse])
def listar_temas(db: Session = Depends(deps.get_db), current_user=Depends(deps.get_current_user)):
    return [TemaResponse(**t) for t in estudos_service.listar_temas(db, current_user.id)]


@router.get("/materiais", response_model=list[MaterialResumo])
def listar_materiais(
    tema_id: Optional[int] = None,
    tipo: Optional[str] = None,
    estudado: Optional[bool] = None,
    tag: Optional[str] = None,
    busca: Optional[str] = None,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_user),
):
    return estudos_service.listar_materiais(db, current_user.id, tema_id=tema_id, tipo=tipo, tag=tag,
                                            estudado=estudado, busca=busca, limite=1000)


@router.get("/materiais/{material_id}", response_model=MaterialResponse)
def ler_material(material_id: int, db: Session = Depends(deps.get_db), current_user=Depends(deps.get_current_user)):
    return _material_ou_404(db, material_id, current_user.id)


@router.post("/materiais/{material_id}/respostas", response_model=RespostaResponse)
def responder(material_id: int, dados: RespostaCreate, db: Session = Depends(deps.get_db),
              current_user=Depends(deps.get_current_user)):
    try:
        registro = estudos_service.registrar_resposta(db, material_id, current_user.id, dados.bloco_id,
                                                      dados.resposta, dados.acertou)
    except ValueError as erro:
        raise HTTPException(status_code=400, detail=str(erro))
    if registro is None:
        raise HTTPException(status_code=404, detail="Material não encontrado")
    return registro


@router.patch("/materiais/{material_id}/estudado", response_model=MaterialResponse)
def marcar_estudado(material_id: int, dados: EstudadoUpdate, db: Session = Depends(deps.get_db),
                    current_user=Depends(deps.get_current_user)):
    material = estudos_service.marcar_estudado(db, material_id, current_user.id, dados.estudado)
    if not material:
        raise HTTPException(status_code=404, detail="Material não encontrado")
    return material


@router.delete("/materiais/{material_id}")
def excluir_material(material_id: int, db: Session = Depends(deps.get_db), current_user=Depends(deps.get_current_user)):
    if not estudos_service.excluir_material(db, material_id, current_user.id):
        raise HTTPException(status_code=404, detail="Material não encontrado")
    return {"ok": True}


# ---------- kit do Claude ----------
@router.get("/kit/versao")
def kit_versao(current_user=Depends(deps.get_current_user)):
    return {"versao": estudos_kit.versao()}


@router.get("/kit/instrucoes-projeto")
def kit_instrucoes_projeto(current_user=Depends(deps.get_current_user)):
    return {"texto": estudos_kit.instrucoes_projeto()}


@router.get("/kit/{alvo}.zip")
def kit_zip(alvo: str, current_user=Depends(deps.get_current_user)):
    if alvo not in estudos_kit.ALVOS:
        raise HTTPException(status_code=404, detail="Kit não encontrado")
    return Response(
        content=estudos_kit.montar_zip(alvo),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="bussola-estudos-{alvo}.zip"'},
    )
