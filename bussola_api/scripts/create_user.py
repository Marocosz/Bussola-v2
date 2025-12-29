"""
=======================================================================================
ARQUIVO: create_user.py (Script de Automação / CLI)
=======================================================================================

OBJETIVO:
    Permitir a criação de um Super Usuário (Administrador) diretamente pelo terminal.
    Essencial para o "bootstrap" (inicialização) do sistema, criando o primeiro acesso
    sem depender da API ou de registros públicos.

PARTE DO SISTEMA:
    Scripts / DevOps / Setup Inicial.

RESPONSABILIDADES:
    1. Ler credenciais via argumentos de linha de comando (para CI/CD) ou input interativo.
    2. Conectar ao banco de dados utilizando a infraestrutura da aplicação.
    3. Verificar se o usuário já existe e oferecer opção de promoção a Admin.
    4. Criar novos administradores com flags de privilégio total (is_superuser).

COMUNICAÇÃO:
    - Banco de Dados: app.db.session (SessionLocal).
    - Modelos: app.models.user.User.
    - Segurança: app.core.security (Hashing de senha).

=======================================================================================
"""

import argparse
import getpass
import sys
from dotenv import load_dotenv
import os

# Carrega variáveis de ambiente (necessário para conectar no DB via SQLAlchemy)
load_dotenv()

# Importações do App
# Adicionei o path para garantir que o python encontre o módulo 'app' na raiz
# Pega o diretório onde este arquivo está (pasta scripts)
current_dir = os.path.dirname(os.path.abspath(__file__))
# Pega o diretório pai (raiz do projeto)
parent_dir = os.path.dirname(current_dir)
sys.path.append(parent_dir)

from app.db.session import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash

def create_admin_user():
    """
    Função principal do script CLI.
    
    Lógica de Execução:
    1. Tenta ler e-mail/senha dos argumentos (flags).
    2. Se não fornecidos, solicita via input interativo (seguro para senhas).
    3. Verifica colisão de e-mail no banco.
    4. Cria ou atualiza o usuário com permissões de Superuser.
    """
    
    # ----------------------------------------------------------------------------------
    # 1. PARSE DE ARGUMENTOS
    # ----------------------------------------------------------------------------------
    # Permite automação (ex: em scripts de deploy) usando:
    # python scripts/create_user.py --email ditanixplayer@gmail.com --password asddsa
    parser = argparse.ArgumentParser(description="Criar usuário Super Admin para o Bússola API")
    parser.add_argument("--email", type=str, help="E-mail do administrador")
    parser.add_argument("--password", type=str, help="Senha do administrador")
    
    args = parser.parse_args()

    # ----------------------------------------------------------------------------------
    # 2. COLETA DE DADOS (FALLBACK INTERATIVO)
    # ----------------------------------------------------------------------------------
    
    # Obtém E-mail
    email = args.email
    if not email:
        print("--- Criação de Super Usuário (Admin) ---")
        email = input("Digite o E-mail do Admin: ").strip()
        if not email:
            print("❌ E-mail é obrigatório.")
            return

    # Obtém Senha
    password = args.password
    if not password:
        # getpass: Oculta os caracteres digitados no terminal para segurança
        password = getpass.getpass("Digite a Senha do Admin: ").strip()
        if not password:
            print("❌ Senha é obrigatória.")
            return

    # ----------------------------------------------------------------------------------
    # 3. OPERAÇÃO DE BANCO DE DADOS
    # ----------------------------------------------------------------------------------
    # Cria uma sessão dedicada apenas para a execução deste script
    db = SessionLocal()
    
    try:
        # Verifica duplicidade para evitar erro de Unique Constraint
        user = db.query(User).filter(User.email == email).first()
        
        if user:
            print(f"⚠️  O usuário {email} já existe no sistema.")
            
            # REGRA DE NEGÓCIO: PROMOÇÃO
            # Se o usuário existe mas é comum, permite transformá-lo em Admin
            # sem precisar deletar e criar de novo (preserva dados vinculados).
            if not user.is_superuser:
                promote = input("Este usuário existe mas não é Admin. Deseja torná-lo Admin? (s/n): ")
                if promote.lower() == 's':
                    user.is_superuser = True
                    user.is_premium = True
                    db.commit()
                    print("✅ Usuário promovido a Admin com sucesso!")
            return

        print(f"Criando novo Admin: {email}...")
        
        # Criação do Objeto User
        # Define explicitamente flags de privilégio e plano vitalício
        new_user = User(
            email=email,
            # Importante: A senha NUNCA é salva em texto plano.
            hashed_password=get_password_hash(password),
            full_name="Super Administrador",
            is_active=True,
            
            # --- PODERES DE ADMIN ---
            # is_superuser: Acesso total ao sistema/painel administrativo
            is_superuser=True,  
            
            # --- DADOS DO PLANO ---
            # Em instalações Self-Hosted, o admin recebe o plano máximo por padrão.
            is_premium=True,
            plan_status="lifetime_admin"
        )
        
        db.add(new_user)
        db.commit()
        print(f"✅ Sucesso! Usuário {email} criado como Super Admin.")
        
    except Exception as e:
        print(f"❌ Erro ao criar usuário: {e}")
    finally:
        # Garante o fechamento da conexão para não deixar pendências no pool
        db.close()

if __name__ == "__main__":
    create_admin_user()