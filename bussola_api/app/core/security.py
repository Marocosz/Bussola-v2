"""
=======================================================================================
ARQUIVO: security.py (Utilitários de Segurança e Criptografia)
=======================================================================================

OBJETIVO:
    Fornecer as primitivas criptográficas essenciais para o sistema de autenticação.
    Centraliza a lógica de hashing de senhas e geração de tokens JWT (JSON Web Tokens).

PARTE DO SISTEMA:
    Backend / Core (Security Layer)

RESPONSABILIDADES:
    1. Gerenciar o contexto de criptografia de senhas (Bcrypt).
    2. Gerar hashes seguros para armazenamento (Data at Rest).
    3. Verificar correspondência de senhas (Login).
    4. Emitir tokens de acesso assinados para autenticação stateless.

COMUNICAÇÃO:
    - Utilizado por: app.api.endpoints.auth (Login), app.services.user (Cadastro/Update).
    - Dependências: app.core.config (Secret Key, Algorithm, Token Expiration).

=======================================================================================
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Union
from jose import jwt
from passlib.context import CryptContext
from app.core.config import settings

# --------------------------------------------------------------------------------------
# CONFIGURAÇÃO DE HASHING
# --------------------------------------------------------------------------------------
# Configura o contexto de criptografia (Passlib).
# 'bcrypt' é escolhido por ser lento intencionalmente (work factor), dificultando
# ataques de força bruta e rainbow tables. 'deprecated="auto"' permite rotação de hashes antigos.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Expõe o algoritmo para ser reutilizado na validação de tokens em outros módulos (deps.py)
ALGORITHM = settings.ALGORITHM

def create_access_token(subject: Union[str, Any], expires_delta: timedelta = None) -> str:
    """
    Gera um Token JWT assinado para autenticação Stateless (Curta Duração).

    Por que existe:
        Permite que o cliente mantenha a sessão ativa sem que o servidor precise manter
        estado ou consultar o banco para validar identidade a cada requisição (apenas valida assinatura).

    Dados Recebidos:
        - subject: Identificador único do usuário (geralmente ID). Mapeado para a claim 'sub'.
        - expires_delta: Tempo opcional de vida. Se None, usa o padrão do sistema.

    Retorna:
        str: O token codificado e assinado digitalmente.
    """
    
    # Define expiração em UTC para evitar inconsistências de fuso horário entre servidor/cliente
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # Monta o payload (Claims)
    # 'exp': Expiration Time (Segurança: tokens devem morrer eventualmente)
    # 'sub': Subject (Quem é o dono do token)
    # 'type': 'access' (Diferenciação explícita)
    to_encode = {"exp": expire, "sub": str(subject), "type": "access"}
    
    # Assina o token usando a chave privada (SECRET_KEY)
    # Isso garante integridade: se o payload for alterado pelo cliente, a assinatura será inválida.
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(subject: Union[str, Any], expires_delta: timedelta = None) -> str:
    """
    Gera um Token de Atualização (Longa Duração).
    Usado apenas na rota /refresh para obter um novo access token.
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    to_encode = {"exp": expire, "sub": str(subject), "type": "refresh"}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifica se a senha em texto plano corresponde ao hash armazenado.
    Utilizado durante o processo de Login.
    """
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """
    Gera um hash irreversível da senha usando Bcrypt + Salt automático.
    Deve ser chamado antes de salvar/atualizar qualquer senha no banco de dados.
    """
    return pwd_context.hash(password)