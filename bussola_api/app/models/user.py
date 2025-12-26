"""
=======================================================================================
ARQUIVO: user.py (Modelo de Dados - Usuário e Identidade)
=======================================================================================

OBJETIVO:
    Entidade central do sistema. Gerencia autenticação, permissões, dados de perfil,
    status de assinatura (SaaS) e atua como a raiz de todos os relacionamentos de dados.

PARTE DO SISTEMA:
    Backend / Core / Auth.

RESPONSABILIDADES:
    1. Identidade: Credenciais (Email/Senha/OAuth).
    2. Controle de Acesso: Flags de ativo, superuser, verificado.
    3. SaaS: Status do plano Premium e integrações de pagamento (Stripe).
    4. Relacionamentos: Ponto central para cascade delete (Apagar User -> Apaga Tudo).

COMUNICAÇÃO:
    - Relaciona-se com: TODOS os outros módulos (Agenda, Finanças, Ritmo, etc).
=======================================================================================
"""

from sqlalchemy import Boolean, Column, Integer, String, JSON
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class User(Base):
    __tablename__ = "user"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    
    # [AUTENTICAÇÃO HÍBRIDA]
    # 'hashed_password' é nullable porque usuários que logam via Google/Facebook
    # podem não ter uma senha local definida inicialmente.
    hashed_password = Column(String, nullable=True)
    
    full_name = Column(String, nullable=True)
    
    # Controle de Acesso e Permissões
    is_active = Column(Boolean, default=True)   # Soft delete / Banimento
    is_superuser = Column(Boolean, default=False) # Admin do sistema

    # =========================================================
    # SEGURANÇA E AUTH FLOW
    # =========================================================
    # Gate de Segurança: Impede login local até confirmação de email.
    # Logins via Provedor (Google) geralmente setam isso como True automaticamente.
    is_verified = Column(Boolean, default=False)
    
    # Metadados para Frontend:
    # Ajuda a decidir se mostra botão "Alterar Senha" (Local) ou não (Google).
    auth_provider = Column(String, default="local") 
    
    # Account Linking: ID único retornado pelo provider (sub do OIDC) para garantir
    # que o email x@gmail.com logado via Google é o mesmo usuário.
    provider_id = Column(String, nullable=True, index=True)

    # =========================================================
    # CAMPOS SAAS / INTEGRAÇÕES
    # =========================================================
    # Controle de Plano (Freemium vs Premium)
    is_premium = Column(Boolean, default=False)
    
    # Status detalhado do ciclo de vida da assinatura (ex: inadimplente, cancelado).
    plan_status = Column(String, default="free") 
    
    # Chave estrangeira lógica para o Gateway de Pagamento (Stripe).
    stripe_customer_id = Column(String, nullable=True, index=True)

    # Integrações Sociais (Legado/Bot)
    discord_id = Column(String, unique=True, nullable=True, index=True)
    avatar_url = Column(String, nullable=True) 

    # =========================================================
    # PREFERÊNCIAS DE USUÁRIO (Dashboard)
    # =========================================================
    # Persistência de estado da UI
    city = Column(String, default="Uberlandia", nullable=True)
    news_preferences = Column(JSON, default=["tech"], nullable=True)

    # =========================================================
    # RELACIONAMENTOS GERAIS (CENTRAL DE DADOS)
    # =========================================================
    # A definição 'cascade="all, delete-orphan"' é crítica aqui.
    # Garante a conformidade com a LGPD/GDPR: Se o usuário solicitar exclusão da conta,
    # o banco de dados limpará automaticamente todos os dados associados a ele.

    compromissos = relationship("Compromisso", back_populates="user", cascade="all, delete-orphan")
    segredos = relationship("Segredo", back_populates="user", cascade="all, delete-orphan")
    
    categorias_financas = relationship("Categoria", back_populates="user", cascade="all, delete-orphan")
    transacoes = relationship("Transacao", back_populates="user", cascade="all, delete-orphan")
    
    grupos_anotacao = relationship("GrupoAnotacao", back_populates="user", cascade="all, delete-orphan")
    anotacoes = relationship("Anotacao", back_populates="user", cascade="all, delete-orphan")
    tarefas = relationship("Tarefa", back_populates="user", cascade="all, delete-orphan")

    # =========================================================
    # RELACIONAMENTOS RITMO (SAÚDE)
    # =========================================================
    ritmo_bios = relationship("RitmoBio", back_populates="user", cascade="all, delete-orphan")
    ritmo_planos = relationship("RitmoPlanoTreino", back_populates="user", cascade="all, delete-orphan")
    ritmo_dietas = relationship("RitmoDietaConfig", back_populates="user", cascade="all, delete-orphan")