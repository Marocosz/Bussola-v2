"""
SCRIPT: cleanup_users.py
DESCRIÇÃO: Remove contas não verificadas expiradas (criadas há +24h).
"""
import sys
import os
from datetime import timedelta
from sqlalchemy import text

# Setup de diretório para importar o app
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.append(parent_dir)

from app.db.session import SessionLocal
from app.models.user import User
from app.core.timezone import now_utc # [NOVO]

def cleanup_unverified_users():
    db = SessionLocal()
    try:
        # Define o tempo limite (ex: 24 horas atrás)
        threshold = now_utc() - timedelta(hours=24) # [CORREÇÃO]
        
        print(f"🔍 Buscando usuários não verificados antes de {threshold}...")

        # Query: Não verificados E Antigos
        users_to_delete = db.query(User).filter(
            User.is_verified == False,
            User.created_at < threshold
        ).all()

        count = len(users_to_delete)
        
        if count > 0:
            print(f"🗑️ Encontrados {count} usuários expirados. Deletando...")
            for user in users_to_delete:
                db.delete(user)
                print(f"   - Deletado: {user.email}")
            
            db.commit()
            print("✅ Limpeza concluída com sucesso.")
        else:
            print("✨ Nenhum usuário expirado encontrado.")

    except Exception as e:
        print(f"❌ Erro na limpeza: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    cleanup_unverified_users()