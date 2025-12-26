"""
=======================================================================================
ARQUIVO: cofre.py (Endpoints do Cofre de Senhas)
=======================================================================================

OBJETIVO:
    Expor as rotas para o gerenciamento seguro de credenciais e segredos.
    Atua como controlador para operações de criação, listagem e, crucialmente,
    a recuperação segura (descriptografia) de senhas.

PARTE DO SISTEMA:
    Backend / API Layer / Security

RESPONSABILIDADES:
    1. Receber requisições HTTPS protegidas por autenticação.
    2. Enforçar o isolamento de dados (Multi-tenancy) via injeção de dependência.
    3. Delegar a lógica de criptografia/descriptografia para o Service.
    4. Segregar a leitura de metadados (lista) da leitura de valores sensíveis (detalhe).

COMUNICAÇÃO:
    - Chama: app.services.cofre.cofre_service (Lógica de Criptografia).
    - Recebe: app.schemas.cofre (Contratos de Dados).
    - Depende: app.api.deps (Usuário Autenticado).

=======================================================================================
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.api import deps
from app.schemas.cofre import SegredoResponse, SegredoCreate, SegredoUpdate, SegredoValueResponse
from app.services.cofre import cofre_service

router = APIRouter()

# --------------------------------------------------------------------------------------
# ROTAS DE LEITURA E ESCRITA
# --------------------------------------------------------------------------------------

@router.get("/", response_model=List[SegredoResponse])
def listar_segredos(
    db: Session = Depends(deps.get_db), 
    current_user = Depends(deps.get_current_user)
):
    """
    Lista todos os segredos do usuário.
    
    Regra de Segurança:
        Retorna apenas os METADADOS (Título, Serviço, Login, Notas).
        O campo de senha/valor NÃO é retornado nesta rota para evitar exposição
        em massa ou vazamento acidental em logs de frontend.
    """
    # Garante que o usuário só receba seus próprios dados (Multi-tenancy)
    return cofre_service.get_all(db, current_user.id)

@router.post("/", response_model=SegredoResponse)
def criar_segredo(
    dados: SegredoCreate, 
    db: Session = Depends(deps.get_db), 
    current_user = Depends(deps.get_current_user)
):
    """
    Armazena um novo segredo.
    
    O Service se encarrega de criptografar o campo 'valor' antes de persistir no banco.
    """
    return cofre_service.create(db, dados, current_user.id)

@router.put("/{id}", response_model=SegredoResponse)
def atualizar_segredo(
    id: int, 
    dados: SegredoUpdate, 
    db: Session = Depends(deps.get_db), 
    current_user = Depends(deps.get_current_user)
):
    """
    Atualiza metadados de um segredo.
    
    Nota: Geralmente, a alteração da senha em si requer um fluxo específico ou 
    re-criptografia, dependendo da implementação do Service.
    """
    segredo = cofre_service.update(db, id, dados, current_user.id)
    if not segredo: 
        raise HTTPException(404, "Segredo não encontrado")
    return segredo

@router.delete("/{id}")
def excluir_segredo(
    id: int, 
    db: Session = Depends(deps.get_db), 
    current_user = Depends(deps.get_current_user)
):
    success = cofre_service.delete(db, id, current_user.id)
    if not success: 
        raise HTTPException(404, "Segredo não encontrado")
    return {"status": "success"}

# --------------------------------------------------------------------------------------
# ROTA SENSÍVEL (DECRYPTION ON DEMAND)
# --------------------------------------------------------------------------------------

@router.get("/{id}/valor", response_model=SegredoValueResponse)
def obter_valor_segredo(
    id: int, 
    db: Session = Depends(deps.get_db), 
    current_user = Depends(deps.get_current_user)
):
    """
    Rota exclusiva para 'Revelar Senha' ou 'Copiar'.
    
    Segurança:
    1. Único ponto da API onde a descriptografia ocorre.
    2. Exige uma requisição explícita do usuário (intencionalidade).
    3. Retorna um Schema específico (SegredoValueResponse) que contém o campo 'valor'.
    """
    valor = cofre_service.get_decrypted_value(db, id, current_user.id)
    
    if valor is None: 
        raise HTTPException(404, "Segredo não encontrado")
        
    return {"valor": valor}