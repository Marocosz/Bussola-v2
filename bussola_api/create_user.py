import os
from dotenv import load_dotenv
from app.db.session import SessionLocal
from app.db.base import Base

# Carrega o ambiente
load_dotenv()

from app.db.session import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash

def create_initial_user():
    db = SessionLocal()
    
    # Pega credenciais do .env (ou usa padrão se não existir)
    email = os.getenv("ADMIN_USERNAME", "marcos@bussola.com")
    password = os.getenv("ADMIN_PASSWORD", "159951")
    
    # Verifica se já existe
    user = db.query(User).filter(User.email == email).first()
    if user:
        print(f"Usuário {email} já existe!")
        return

    print(f"Criando usuário inicial: {email}")
    
    new_user = User(
        email=email,
        hashed_password=get_password_hash(password),
        full_name="Administrador",
        is_superuser=True,
        is_active=True
    )
    
    db.add(new_user)
    db.commit()
    print("✅ Usuário criado com sucesso!")

if __name__ == "__main__":
    create_initial_user()