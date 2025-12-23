from typing import Optional
from pydantic import BaseModel, EmailStr

# Propriedades compartilhadas
class UserBase(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = True
    is_superuser: Optional[bool] = False

# Propriedades para receber via API na criação (senha é obrigatória)
class UserCreate(UserBase):
    email: EmailStr
    password: str

# Propriedades para atualizar
class UserUpdate(UserBase):
    password: Optional[str] = None

# Propriedades para retornar via API (NUNCA retornamos a senha)
class UserInDBBase(UserBase):
    id: Optional[int] = None

    class Config:
        from_attributes = True # Permite ler direto do modelo SQLAlchemy

# O que a API retorna
class User(UserInDBBase):
    # [ALTERAÇÃO IMPORTANTE]
    # Redefinimos aqui para garantir que esses campos SEMPRE venham no JSON
    # e não sejam tratados como opcionais ocultos.
    is_superuser: bool
    is_premium: bool = False # Adicionado pois seu script usa isso
    pass

# O que é salvo no Banco (inclui a senha hash)
class UserInDB(UserInDBBase):
    hashed_password: str

# [NOVO] Schema para definir a Nova Senha (Reset)
class NewPassword(BaseModel):
    token: str
    new_password: str