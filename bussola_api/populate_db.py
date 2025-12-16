import random
from datetime import datetime, timedelta
from faker import Faker
from sqlalchemy.orm import Session
from sqlalchemy import inspect

# Imports do App
from app.db.session import SessionLocal

# Tenta importar o User (Baseado no seu deps.py, ele está em app.models.user)
try:
    from app.models.user import User
except ImportError:
    User = None
    print("⚠️ Modelo User não encontrado. Dados serão gerados sem vínculo.")

# Models de Dados
from app.models.financas import Categoria, Transacao
from app.models.registros import GrupoAnotacao, Anotacao, Link, Tarefa, Subtarefa
from app.models.agenda import Compromisso
from app.models.cofre import Segredo

# Inicializa Faker
fake = Faker('pt_BR')
db = SessionLocal()

def get_target_user_id():
    """Retorna o ID do primeiro usuário encontrado (criado pelo create_user.py)."""
    if User:
        try:
            user = db.query(User).first()
            if user:
                print(f"👤 Dados serão vinculados ao usuário: {user.email} (ID: {user.id})")
                return user.id
        except Exception as e:
            print(f"⚠️ Aviso ao buscar usuário: {e}")
    return None

def create_instance(model_class, data, user_id=None):
    """
    Cria uma instância do model apenas se os campos existirem.
    Verifica se a tabela tem 'user_id' antes de tentar atribuir.
    """
    # Verifica colunas existentes na tabela
    mapper = inspect(model_class)
    columns = [c.key for c in mapper.attrs]
    
    # Se user_id foi passado e o modelo aceita, adiciona
    if user_id and 'user_id' in columns:
        data['user_id'] = user_id
        
    # Remove campos do dicionário 'data' que não existem no modelo (segurança extra)
    clean_data = {k: v for k, v in data.items() if k in columns}
    
    return model_class(**clean_data)

def create_registros(user_id=None):
    print("📝 Populando Caderno & Tarefas...")
    
    grupos_nomes = [
        ("Pessoal", "#3b82f6"), ("Trabalho", "#ef4444"), 
        ("Estudos", "#10b981"), ("Ideias", "#f59e0b"), 
        ("Projetos", "#8b5cf6"), ("Saúde", "#ec4899")
    ]
    
    grupos_objs = []
    
    # 1. Grupos
    for nome, cor in grupos_nomes:
        # Tenta buscar existente
        query = db.query(GrupoAnotacao).filter(GrupoAnotacao.nome == nome)
        # Se o modelo tiver user_id, filtra por ele
        if user_id and hasattr(GrupoAnotacao, 'user_id'):
            query = query.filter(GrupoAnotacao.user_id == user_id)
            
        grupo = query.first()
        
        if not grupo:
            grupo = create_instance(GrupoAnotacao, {"nome": nome, "cor": cor}, user_id)
            db.add(grupo)
            grupos_objs.append(grupo)
        else:
            grupos_objs.append(grupo)
    db.commit()
    
    # 2. Anotações
    print("   ... Gerando 100 anotações")
    for _ in range(100):
        grupo = random.choice(grupos_objs)
        html = f"<p>{fake.paragraph()}</p><ul><li>{fake.sentence()}</li></ul>"
        
        nota_data = {
            "titulo": fake.sentence(nb_words=4).replace(".", ""),
            "conteudo": html,
            "fixado": random.choice([True] + [False]*9),
            "data_criacao": fake.date_time_between(start_date='-1y', end_date='now'),
            "grupo_id": grupo.id
        }
        
        nota = create_instance(Anotacao, nota_data, user_id)
        db.add(nota)
        db.flush() # Gera ID

        # Links (Opcional)
        if random.random() < 0.3:
            db.add(Link(url=fake.url(), anotacao_id=nota.id))
            
    # 3. Tarefas
    print("   ... Gerando 80 tarefas")
    for _ in range(80):
        status = random.choice(["Pendente", "Em andamento", "Concluído"])
        prioridade = random.choice(["Baixa", "Média", "Alta", "Crítica"])
        
        dt_base = fake.date_time_between(start_date='-6M', end_date='+2M')
        dt_concl = dt_base if status == "Concluído" else None
        
        tarefa_data = {
            "titulo": f"{random.choice(['Ligar', 'Comprar', 'Verificar'])} {fake.word()}",
            "descricao": fake.sentence(),
            "status": status,
            "prioridade": prioridade,
            "fixado": random.choice([True, False, False]),
            "data_criacao": dt_base,
            "data_conclusao": dt_concl
        }
        
        tarefa = create_instance(Tarefa, tarefa_data, user_id)
        db.add(tarefa)
        db.flush()
        
        # Subtarefas
        if random.random() < 0.5:
            db.add(Subtarefa(titulo=fake.sentence(nb_words=3), concluido=random.choice([True, False]), tarefa_id=tarefa.id))

    db.commit()
    print("   ✅ Registros concluídos.")

def create_financas(user_id=None):
    print("💰 Populando Finanças...")
    
    cats_info = [
        ("Salário", "receita", "fa-money-bill", "#10b981"),
        ("Freelance", "receita", "fa-laptop", "#3b82f6"),
        ("Investimentos", "receita", "fa-chart-line", "#8b5cf6"),
        ("Alimentação", "despesa", "fa-utensils", "#ef4444"),
        ("Moradia", "despesa", "fa-house", "#f97316"),
        ("Transporte", "despesa", "fa-car", "#eab308"),
        ("Lazer", "despesa", "fa-gamepad", "#8b5cf6"),
        ("Educação", "despesa", "fa-graduation-cap", "#6366f1"),
        ("Saúde", "despesa", "fa-heart-pulse", "#ec4899"),
    ]
    
    cats_objs = []
    for nome, tipo, icone, cor in cats_info:
        # Busca Categoria (com ou sem user_id)
        query = db.query(Categoria).filter(Categoria.nome == nome)
        if user_id and hasattr(Categoria, 'user_id'):
            query = query.filter(Categoria.user_id == user_id)
        
        cat = query.first()
        if not cat:
            cat = create_instance(Categoria, {
                "nome": nome, "tipo": tipo, "icone": icone, "cor": cor, 
                "meta_limite": random.uniform(500, 3000)
            }, user_id)
            db.add(cat)
            cats_objs.append(cat)
        else:
            cats_objs.append(cat)
    db.commit()
    
    cats_receita = [c for c in cats_objs if c.tipo == 'receita']
    cats_despesa = [c for c in cats_objs if c.tipo == 'despesa']
    
    print("   ... Gerando 1.000 transações")
    for _ in range(1000):
        eh_receita = random.random() < 0.25
        categoria = random.choice(cats_receita) if eh_receita else random.choice(cats_despesa)
        
        dt = fake.date_time_between(start_date='-1y', end_date='+6M')
        status = "Efetivada" if dt < datetime.now() else "Pendente"
        
        valor = random.uniform(2000, 10000) if eh_receita else random.uniform(20, 1500)
        
        trans_data = {
            "descricao": fake.sentence(nb_words=3).replace(".", ""),
            "valor": valor,
            "data": dt,
            "categoria_id": categoria.id,
            "tipo_recorrencia": "pontual",
            "status": status
        }
        
        t = create_instance(Transacao, trans_data, user_id)
        db.add(t)
        
    db.commit()
    print("   ✅ Finanças concluídas.")

def create_agenda(user_id=None):
    print("📅 Populando Agenda...")
    
    locais = ["Zoom", "Escritório", "Casa", "Rua", "Consultório"]
    tipos = ["Reunião", "Consulta", "Almoço", "Treino", "Call"]
    
    for _ in range(150):
        dt = fake.date_time_between(start_date='-6M', end_date='+6M')
        
        # Status lógico
        if dt < datetime.now():
            status = random.choice(['Realizado', 'Perdido'])
        else:
            status = 'Pendente'
            
        agenda_data = {
            "titulo": f"{random.choice(tipos)}: {fake.first_name()}",
            "descricao": fake.sentence(),
            "local": random.choice(locais),
            "data_hora": dt,
            "lembrete": random.choice([True, False]),
            "status": status
            # REMOVIDO CAMPO 'COR' PARA EVITAR ERRO
        }
        
        evt = create_instance(Compromisso, agenda_data, user_id)
        db.add(evt)
        
    db.commit()
    print("   ✅ Agenda concluída.")

def create_cofre(user_id=None):
    print("🔒 Populando Cofre...")
    
    servicos = ["Netflix", "Spotify", "Amazon", "Gov.br", "Gmail"]
    
    for servico in servicos:
        cofre_data = {
            "titulo": servico,
            "servico": "Entretenimento" if servico != "Gov.br" else "Pessoal",
            "usuario_login": fake.email(),
            "senha_encriptada": "ENC_TESTE_123",
            "notas": fake.sentence(),
            "data_expiracao": fake.future_date()
        }
        
        seg = create_instance(Segredo, cofre_data, user_id)
        db.add(seg)
        
    db.commit()
    print("   ✅ Cofre concluído.")

def main():
    print("🚀 Iniciando script de população (Modo Seguro)...")
    try:
        # Busca usuário para vincular
        uid = get_target_user_id()
        
        create_registros(uid)
        create_financas(uid)
        create_agenda(uid)
        create_cofre(uid)
        
        print("\n✨ Banco de dados populado com sucesso!")
        
    except Exception as e:
        print(f"\n❌ Erro crítico: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()