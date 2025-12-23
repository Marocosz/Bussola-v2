from typing import Optional, List
from pydantic import BaseModel, EmailStr

# Propriedades compartilhadas
class UserBase(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = True
    is_superuser: Optional[bool] = False
    
    # Campos de preferência
    city: Optional[str] = "Uberlandia"
    news_preferences: Optional[List[str]] = ["tech"] 

# Propriedades para receber via API na criação (senha é obrigatória para cadastro LOCAL)
class UserCreate(UserBase):
    email: EmailStr
    password: str

# Propriedades para atualizar
class UserUpdate(UserBase):
    password: Optional[str] = None

# Schema para o usuário atualizar a si mesmo
class UserUpdateMe(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    city: Optional[str] = None
    news_preferences: Optional[List[str]] = None

# Propriedades para retornar via API (NUNCA retornamos a senha)
class UserInDBBase(UserBase):
    id: Optional[int] = None
    
    # [NOVO] Informações de Auth na resposta
    is_verified: bool = False
    auth_provider: str = "local"

    class Config:
        from_attributes = True 

# O que a API retorna
class User(UserInDBBase):
    is_superuser: bool
    is_premium: bool = False
    pass

# O que é salvo no Banco (inclui a senha hash)
class UserInDB(UserInDBBase):
    hashed_password: Optional[str] = None

# Schema para definir a Nova Senha (Reset)
class NewPassword(BaseModel):
    token: str
    new_password: str

# Schema para troca de senha logado
class UpdatePassword(BaseModel):
    current_password: str
    new_password: str