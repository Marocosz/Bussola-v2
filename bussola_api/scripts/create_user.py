import argparse
import getpass
import sys
from dotenv import load_dotenv

# Carrega variáveis de ambiente (necessário para conectar no DB)
load_dotenv()

# Importações do App
# Adicionei o path para garantir que o python encontre o módulo 'app'
sys.path.append(".") 
from app.db.session import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash

def create_admin_user():
    # 1. Configura os argumentos de linha de comando
    parser = argparse.ArgumentParser(description="Criar usuário Super Admin para o Bússola API")
    parser.add_argument("--email", type=str, help="E-mail do administrador")
    parser.add_argument("--password", type=str, help="Senha do administrador")
    
    args = parser.parse_args()

    # 2. Obtém E-mail (Argumento ou Interativo)
    email = args.email
    if not email:
        print("--- Criação de Super Usuário (Admin) ---")
        email = input("Digite o E-mail do Admin: ").strip()
        if not email:
            print("❌ E-mail é obrigatório.")
            return

    # 3. Obtém Senha (Argumento ou Interativo Seguro)
    password = args.password
    if not password:
        # getpass esconde a senha enquanto você digita
        password = getpass.getpass("Digite a Senha do Admin: ").strip()
        if not password:
            print("❌ Senha é obrigatória.")
            return

    # 4. Conecta no Banco e Cria
    db = SessionLocal()
    
    try:
        # Verifica duplicidade
        user = db.query(User).filter(User.email == email).first()
        if user:
            print(f"⚠️  O usuário {email} já existe no sistema.")
            # Se já existe, mas não é admin, vamos promover? (Opcional)
            if not user.is_superuser:
                promote = input("Este usuário existe mas não é Admin. Deseja torná-lo Admin? (s/n): ")
                if promote.lower() == 's':
                    user.is_superuser = True
                    user.is_premium = True
                    db.commit()
                    print("✅ Usuário promovido a Admin com sucesso!")
            return

        print(f"Criando novo Admin: {email}...")
        
        new_user = User(
            email=email,
            hashed_password=get_password_hash(password),
            full_name="Super Administrador",
            is_active=True,
            
            # --- PODERES DE ADMIN ---
            is_superuser=True,  # Isso permite acessar /users/ e criar outros
            
            # --- DADOS DO PLANO (Admin Self-Hosted merece Premium) ---
            is_premium=True,
            plan_status="lifetime_admin"
        )
        
        db.add(new_user)
        db.commit()
        print(f"✅ Sucesso! Usuário {email} criado como Super Admin.")
        
    except Exception as e:
        print(f"❌ Erro ao criar usuário: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_admin_user()