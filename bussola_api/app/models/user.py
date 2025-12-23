from sqlalchemy import Boolean, Column, Integer, String, JSON
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class User(Base):
    __tablename__ = "user"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    
    # [ALTERADO] Senha opcional para suportar Login Social
    hashed_password = Column(String, nullable=True)
    
    full_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)

    # =========================================================
    # [NOVO] SEGURANÇA E AUTH
    # =========================================================
    # Bloqueia login local até clicar no email. 
    # Google Login deve setar isso como True automaticamente.
    is_verified = Column(Boolean, default=False)
    
    # 'local', 'google', 'facebook'. Ajuda no frontend a saber se mostra botão "Alterar Senha"
    auth_provider = Column(String, default="local") 
    
    # ID único do Google/Facebook para garantir account linking seguro
    provider_id = Column(String, nullable=True, index=True)

    # =========================================================
    # CAMPOS SAAS / INTEGRAÇÕES
    # =========================================================
    # Controle de Plano
    is_premium = Column(Boolean, default=False)
    plan_status = Column(String, default="free") # free, active, canceled, past_due
    stripe_customer_id = Column(String, nullable=True, index=True)

    # Integrações Sociais (Mantidos legado ou para outros usos)
    discord_id = Column(String, unique=True, nullable=True, index=True)
    avatar_url = Column(String, nullable=True) 

    # =========================================================
    # PREFERÊNCIAS DE USUÁRIO (Dashboard)
    # =========================================================
    city = Column(String, default="Uberlandia", nullable=True)
    news_preferences = Column(JSON, default=["tech"], nullable=True)

    # =========================================================
    # RELACIONAMENTOS GERAIS
    # =========================================================
    compromissos = relationship("Compromisso", back_populates="user", cascade="all, delete-orphan")
    segredos = relationship("Segredo", back_populates="user", cascade="all, delete-orphan")
    
    categorias_financas = relationship("Categoria", back_populates="user", cascade="all, delete-orphan")
    transacoes = relationship("Transacao", back_populates="user", cascade="all, delete-orphan")
    
    grupos_anotacao = relationship("GrupoAnotacao", back_populates="user", cascade="all, delete-orphan")
    anotacoes = relationship("Anotacao", back_populates="user", cascade="all, delete-orphan")
    tarefas = relationship("Tarefa", back_populates="user", cascade="all, delete-orphan")

    # =========================================================
    # RELACIONAMENTOS RITMO
    # =========================================================
    ritmo_bios = relationship("RitmoBio", back_populates="user", cascade="all, delete-orphan")
    ritmo_planos = relationship("RitmoPlanoTreino", back_populates="user", cascade="all, delete-orphan")
    ritmo_dietas = relationship("RitmoDietaConfig", back_populates="user", cascade="all, delete-orphan")