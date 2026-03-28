"""
=======================================================================================
ARQUIVO: agenda.py (Endpoints da Agenda)
=======================================================================================

OBJETIVO:
    Expor as rotas HTTP da API relacionadas ao módulo de Agenda/Calendário.
    Atua como a camada de "Controller", recebendo requisições, validando autenticação
    e delegando a lógica de negócio para o Service.

PARTE DO SISTEMA:
    Backend / API Layer / Endpoints

RESPONSABILIDADES:
    1. Definir os métodos HTTP (GET, POST, PUT, DELETE, PATCH).
    2. Injetar dependências (Sessão de Banco e Usuário Autenticado).
    3. Validar os schemas de entrada (Pydantic).
    4. Garantir que todas as operações sejam filtradas pelo `current_user.id` (Segurança).

COMUNICAÇÃO:
    - Chama: app.services.agenda (Lógica de Negócio).
    - Recebe: app.schemas.agenda (Formatos de Dados).
    - Depende: app.api.deps (Autenticação e DB).

=======================================================================================
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from app.api import deps
from app.schemas.agenda import AgendaDashboardResponse, CompromissoCreate, CompromissoUpdate, CompromissoResponse
from app.services.agenda import agenda_service

router = APIRouter()

class StatusUpdate(BaseModel):
    status: str

# --------------------------------------------------------------------------------------
# ROTAS DE LEITURA (READ)
# --------------------------------------------------------------------------------------

@router.get("/", response_model=AgendaDashboardResponse)
def get_agenda(
    mes: Optional[int] = Query(None, ge=1, le=12, description="Mês para visualização (1-12)"),
    ano: Optional[int] = Query(None, ge=2000, le=2100, description="Ano para visualização"),
    db: Session = Depends(deps.get_db), 
    current_user = Depends(deps.get_current_user)
):
    """
    Retorna a visão geral da Agenda (Dashboard).
    
    Objetivo:
        Fornecer todos os dados necessários para renderizar o calendário mensal e 
        a lista de compromissos em uma única requisição.

    Melhorias (v2):
        - Aceita parâmetros `mes` e `ano` opcionais para permitir navegação no histórico
          ou planejamento futuro (remove limitação de 15 dias).
        - Se não informados, assume o mês atual.

    Segurança:
        Passa explicitamente o `current_user.id` para o serviço, garantindo que
        o usuário veja apenas os seus próprios compromissos.
    """
    return agenda_service.get_dashboard(db, current_user.id, mes, ano)

# --------------------------------------------------------------------------------------
# ROTAS DE ESCRITA (CREATE, UPDATE, DELETE)
# --------------------------------------------------------------------------------------

@router.post("/", response_model=CompromissoResponse)
def create_compromisso(
    dados: CompromissoCreate, 
    db: Session = Depends(deps.get_db), 
    current_user = Depends(deps.get_current_user)
):
    """
    Cria um novo compromisso na agenda.

    Entrada:
        - dados: Objeto com título, data_hora, local, etc.
    
    Retorno:
        - O objeto Compromisso criado com seu ID gerado.
    """
    return agenda_service.create(db, dados, current_user.id)

@router.put("/{id}", response_model=CompromissoResponse)
def update_compromisso(
    id: int, 
    dados: CompromissoUpdate, 
    db: Session = Depends(deps.get_db), 
    current_user = Depends(deps.get_current_user)
):
    """
    Atualiza os dados de um compromisso existente.

    Regra de Segurança:
        O serviço verificará se o 'id' do compromisso pertence ao 'current_user.id'.
        Se tentar alterar o compromisso de outro usuário, a ação será bloqueada/ignorada.
    """
    return agenda_service.update(db, id, dados, current_user.id)

@router.patch("/{id}/status")
def set_status(
    id: int,
    body: StatusUpdate,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Define explicitamente o status de um compromisso.
    Valores aceitos: 'Realizado', 'Cancelado', 'Pendente'
    """
    VALID = {'Realizado', 'Cancelado', 'Pendente'}
    if body.status not in VALID:
        raise HTTPException(status_code=400, detail=f"Status inválido. Use: {VALID}")
    result = agenda_service.set_status(db, id, body.status, current_user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Compromisso não encontrado.")
    return {"status": "success", "new_status": result.status}

@router.delete("/{id}")
def delete_compromisso(
    id: int, 
    db: Session = Depends(deps.get_db), 
    current_user = Depends(deps.get_current_user)
):
    """
    Remove definitivamente um compromisso.
    """
    agenda_service.delete(db, id, current_user.id)
    return {"status": "success"}