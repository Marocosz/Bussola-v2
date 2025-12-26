"""
=======================================================================================
ARQUIVO: user.py (Schemas - Gestão de Usuários)
=======================================================================================

OBJETIVO:
    Definir DTOs para cadastro, atualização e leitura de usuários.
    Gerencia a sensibilidade da senha (Input Only) e preferências de perfil.

PARTE DO SISTEMA:
    Backend / API Layer / Auth.
=======================================================================================
"""

from typing import Optional, List
from pydantic import BaseModel, EmailStr

# Propriedades comuns a todos os schemas de User
class UserBase(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = True
    is_superuser: Optional[bool] = False
    
    # Preferências de UI persistidas
    city: Optional[str] = "Uberlandia"
    news_preferences: Optional[List[str]] = ["tech"] 

class UserCreate(UserBase):
    """Cadastro inicial (Obrigatório Email e Senha)."""
    email: EmailStr
    password: str

class UserUpdate(UserBase):
    """Atualização administrativa (Pode resetar senha)."""
    password: Optional[str] = None

class UserUpdateMe(BaseModel):
    """Atualização do próprio perfil (Campos limitados por segurança)."""
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    city: Optional[str] = None
    news_preferences: Optional[List[str]] = None

class UserInDBBase(UserBase):
    """Base para resposta segura (Sem senha)."""
    id: Optional[int] = None
    
    # Metadados de Auth
    is_verified: bool = False
    auth_provider: str = "local"

    class Config:
        from_attributes = True 

class User(UserInDBBase):
    """Schema público de retorno da API."""
    is_superuser: bool
    is_premium: bool = False
    pass

class UserInDB(UserInDBBase):
    """Schema interno (Database), inclui hash da senha."""
    hashed_password: Optional[str] = None

# --- FLUXO DE SENHA ---

class NewPassword(BaseModel):
    """Recuperação de senha (Esqueci minha senha)."""
    token: str
    new_password: str

class UpdatePassword(BaseModel):
    """Troca de senha logado (Exige senha atual)."""
    current_password: str
    new_password: str