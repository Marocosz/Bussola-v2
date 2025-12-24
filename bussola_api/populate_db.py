import random
import uuid
from datetime import datetime, timedelta, date
from dateutil.relativedelta import relativedelta
from faker import Faker
from sqlalchemy.orm import Session
from sqlalchemy import inspect
from dotenv import load_dotenv
from cryptography.fernet import Fernet # [NOVO] Para criptografar senhas manualmente

# Carrega variáveis de ambiente
load_dotenv()

# Imports do App
from app.db.session import SessionLocal
from app.core.config import settings

# Tenta importar Models
try:
    from app.models.user import User
    from app.models.financas import Categoria, Transacao
    from app.models.registros import GrupoAnotacao, Anotacao, Link, Tarefa, Subtarefa
    from app.models.agenda import Compromisso
    from app.models.cofre import Segredo
    from app.models.ritmo import (
        RitmoBio, RitmoPlanoTreino, RitmoDiaTreino, RitmoExercicioItem,
        RitmoDietaConfig, RitmoRefeicao, RitmoAlimentoItem
    )
except ImportError as e:
    print(f"⚠️ Erro ao importar Models: {e}")
    exit(1)

# Inicializa Faker e Banco
fake = Faker('pt_BR')
db = SessionLocal()

# Inicializa Criptografia (Igual ao Service)
try:
    cipher_suite = Fernet(settings.ENCRYPTION_KEY.encode())
except Exception:
    cipher_suite = None
    print("⚠️ AVISO: ENCRYPTION_KEY não encontrada. Senhas do cofre podem falhar.")

# ==============================================================================
# UTILITÁRIOS
# ==============================================================================

def get_target_user_id():
    """Retorna o ID do primeiro usuário encontrado no banco."""
    try:
        user = db.query(User).first()
        if user:
            print(f"👤 Dados serão vinculados ao usuário: {user.email} (ID: {user.id})")
            return user.id
        else:
            print("❌ Nenhum usuário encontrado! Crie um usuário manualmente primeiro.")
            exit(1)
    except Exception as e:
        print(f"⚠️ Erro ao buscar usuário: {e}")
        return None

def create_instance(model_class, data, user_id=None):
    """
    Cria instância do model de forma segura.
    """
    mapper = inspect(model_class)
    columns = [c.key for c in mapper.attrs]
    
    # Injeta user_id se o modelo suportar
    if user_id and 'user_id' in columns:
        data['user_id'] = user_id
        
    # Remove campos que não existem no model (segurança)
    clean_data = {k: v for k, v in data.items() if k in columns}
    
    return model_class(**clean_data)

# ==============================================================================
# MÓDULOS DE POPULAÇÃO
# ==============================================================================

def create_registros(user_id):
    print("📝 Populando Caderno (Notas e Tarefas)...")
    
    # 1. Grupos
    grupos_data = [
        ("Pessoal", "#3b82f6"), ("Trabalho", "#ef4444"), 
        ("Estudos", "#10b981"), ("Ideias", "#f59e0b"), 
        ("Projetos", "#8b5cf6"), ("Saúde", "#ec4899")
    ]
    
    grupos_objs = []
    for nome, cor in grupos_data:
        grupo = db.query(GrupoAnotacao).filter_by(nome=nome, user_id=user_id).first()
        if not grupo:
            grupo = create_instance(GrupoAnotacao, {"nome": nome, "cor": cor}, user_id)
            db.add(grupo)
            db.commit()
            db.refresh(grupo)
        grupos_objs.append(grupo)
    
    # 2. Anotações (30 notas)
    titulos = ["Resumo Reunião", "Lista de Livros", "Ideia App SaaS", "Receita Panqueca", "Senhas Wifi", "Rascunho Email", "Playlist Foco"]
    for _ in range(30):
        grupo = random.choice(grupos_objs)
        html = f"<p>{fake.paragraph()}</p><ul><li>{fake.sentence()}</li><li>{fake.sentence()}</li></ul>"
        
        nota = create_instance(Anotacao, {
            "titulo": f"{random.choice(titulos)} - {fake.word().capitalize()}",
            "conteudo": html,
            "fixado": random.choice([True] + [False]*9),
            "data_criacao": fake.date_time_between(start_date='-6M', end_date='now'),
            "grupo_id": grupo.id
        }, user_id)
        db.add(nota)
    db.commit()
            
    # 3. Tarefas (50 tarefas)
    verbos = ["Ligar para", "Comprar", "Finalizar", "Estudar", "Enviar", "Pagar", "Revisar", "Agendar"]
    for _ in range(50):
        dt_criacao = fake.date_time_between(start_date='-3M', end_date='now')
        status = random.choice(["Pendente", "Em andamento", "Concluído"])
        
        tarefa = create_instance(Tarefa, {
            "titulo": f"{random.choice(verbos)} {fake.bs()}",
            "descricao": fake.sentence(),
            "status": status,
            "prioridade": random.choice(["Baixa", "Média", "Alta", "Crítica"]),
            "fixado": random.choice([True, False]),
            "data_criacao": dt_criacao,
            "data_conclusao": datetime.now() if status == "Concluído" else None,
            "prazo": dt_criacao + timedelta(days=random.randint(1, 15))
        }, user_id)
        
        db.add(tarefa)
        db.flush()
        
        # Subtarefas
        if random.random() < 0.4:
            for i in range(random.randint(1, 3)):
                sub = Subtarefa(
                    titulo=f"Passo {i+1}: {fake.word()}", 
                    concluido=random.choice([True, False]), 
                    tarefa_id=tarefa.id
                )
                db.add(sub)

    db.commit()
    print("   ✅ Registros OK.")

def create_financas(user_id):
    print("💰 Populando Finanças (Transações Complexas)...")
    
    # 1. Categorias
    cats_config = [
        ("Salário", "receita", "fa-money-bill", "#10b981"),
        ("Freelance", "receita", "fa-laptop", "#3b82f6"),
        ("Investimentos", "receita", "fa-chart-line", "#8b5cf6"),
        ("Alimentação", "despesa", "fa-utensils", "#ef4444"),
        ("Moradia", "despesa", "fa-house", "#f97316"),
        ("Transporte", "despesa", "fa-car", "#eab308"),
        ("Lazer", "despesa", "fa-gamepad", "#8b5cf6"),
        ("Assinaturas", "despesa", "fa-credit-card", "#6366f1"),
        ("Saúde", "despesa", "fa-heart-pulse", "#ec4899"),
        ("Eletrônicos", "despesa", "fa-plug", "#6366f1"),
        ("Educação", "despesa", "fa-graduation-cap", "#14b8a6"),
    ]
    
    cats_objs = {}
    for nome, tipo, icone, cor in cats_config:
        cat = db.query(Categoria).filter_by(nome=nome, user_id=user_id, tipo=tipo).first()
        if not cat:
            cat = create_instance(Categoria, {
                "nome": nome, "tipo": tipo, "icone": icone, "cor": cor, 
                "meta_limite": random.uniform(1000, 5000)
            }, user_id)
            db.add(cat)
            db.commit()
            db.refresh(cat)
        cats_objs[nome] = cat
    
    cats_rec = [c for c in cats_objs.values() if c.tipo == 'receita']
    cats_desp = [c for c in cats_objs.values() if c.tipo == 'despesa']
    
    # 2. Transações PONTUAIS (150 itens)
    print("   ... Gerando transações pontuais")
    for _ in range(150):
        is_rec = random.random() < 0.3 
        cat = random.choice(cats_rec) if is_rec else random.choice(cats_desp)
        
        dt = fake.date_time_between(start_date='-6M', end_date='+2M')
        status = "Efetivada" if dt < datetime.now() else "Pendente"
        valor = random.uniform(200, 2000) if is_rec else random.uniform(15, 500)
        
        trans = create_instance(Transacao, {
            "descricao": f"{cat.nome} - {fake.word().capitalize()}",
            "valor": round(valor, 2),
            "data": dt,
            "categoria_id": cat.id,
            "tipo_recorrencia": "pontual",
            "status": status
        }, user_id)
        db.add(trans)

    # 3. Transações RECORRENTES (Assinaturas e Contas Fixas - 12 meses)
    print("   ... Gerando assinaturas e fixos")
    recorrencias = [
        ("Netflix Premium", "Assinaturas", 55.90, "despesa"),
        ("Spotify Family", "Assinaturas", 34.90, "despesa"),
        ("Academia Smart", "Saúde", 129.90, "despesa"),
        ("Aluguel Apt", "Moradia", 2200.00, "despesa"),
        ("Internet Fibra", "Moradia", 149.90, "despesa"),
        ("Salário Mensal", "Salário", 5500.00, "receita"),
        ("Rendimentos CDI", "Investimentos", 120.50, "receita")
    ]

    for desc_base, cat_nome, valor, tipo in recorrencias:
        grupo_id = uuid.uuid4().hex
        cat = cats_objs.get(cat_nome)
        if not cat: continue 

        start_date = fake.date_time_between(start_date='-8M', end_date='-7M')
        
        # Gera 12 meses
        for i in range(12):
            data_venc = start_date + relativedelta(months=i)
            status = "Efetivada" if data_venc < datetime.now() else "Pendente"
            
            trans = create_instance(Transacao, {
                "descricao": desc_base,
                "valor": valor,
                "data": data_venc,
                "categoria_id": cat.id,
                "tipo_recorrencia": "recorrente",
                "frequencia": "mensal",
                "id_grupo_recorrencia": grupo_id,
                "status": status
            }, user_id)
            db.add(trans)

    # 4. Transações PARCELADAS
    print("   ... Gerando compras parceladas")
    parcelados = [
        ("Macbook Air", "Eletrônicos", 8500.00, 10),
        ("Curso Python Pro", "Educação", 1200.00, 4),
        ("Revisão Carro", "Transporte", 1800.00, 3),
    ]

    for desc_base, cat_nome, valor_total, qtd_parcelas in parcelados:
        grupo_id = uuid.uuid4().hex
        cat = cats_objs.get(cat_nome) or cats_objs.get("Lazer")
        
        valor_parcela = round(valor_total / qtd_parcelas, 2)
        start_date = fake.date_time_between(start_date='-5M', end_date='-2M')

        for i in range(1, qtd_parcelas + 1):
            data_venc = start_date + relativedelta(months=i-1)
            status = "Efetivada" if data_venc < datetime.now() else "Pendente"
            
            # Ajuste de centavos
            valor_final = valor_parcela
            if i == 1:
                diff = round(valor_total - (valor_parcela * qtd_parcelas), 2)
                valor_final += diff

            trans = create_instance(Transacao, {
                "descricao": f"{desc_base} ({i}/{qtd_parcelas})",
                "valor": valor_final,
                "data": data_venc,
                "categoria_id": cat.id,
                "tipo_recorrencia": "parcelada",
                "parcela_atual": i,
                "total_parcelas": qtd_parcelas,
                "id_grupo_recorrencia": grupo_id,
                "status": status
            }, user_id)
            db.add(trans)
        
    db.commit()
    print("   ✅ Finanças OK.")

def create_agenda(user_id):
    print("📅 Populando Agenda...")
    
    tipos = ["Daily Scrum", "Consulta Dentista", "Almoço Equipe", "Treino Pesado", "Review Projeto", "Aniversário Mãe"]
    locais = ["Google Meet", "Consultório Dr. André", "Restaurante Coco Bambu", "Smart Fit", "Zoom", "Casa"]
    
    for _ in range(60):
        dt = fake.date_time_between(start_date='-2M', end_date='+2M')
        dt = dt.replace(second=0, microsecond=0)
        
        status = 'Pendente'
        if dt < datetime.now():
            status = random.choice(['Realizado', 'Realizado', 'Perdido']) 
            
        evt = create_instance(Compromisso, {
            "titulo": f"{random.choice(tipos)}",
            "descricao": fake.sentence(),
            "local": random.choice(locais),
            "data_hora": dt,
            "lembrete": random.choice([True, False]),
            "status": status
        }, user_id)
        db.add(evt)
        
    db.commit()
    print("   ✅ Agenda OK.")

def create_cofre(user_id):
    print("🔒 Populando Cofre (Com Criptografia)...")
    
    contas = [
        ("Netflix", "Entretenimento", "user@gmail.com"),
        ("Spotify", "Música", "user.name"),
        ("Gov.br", "Pessoal", "123.456.789-00"),
        ("AWS Console", "Trabalho", "admin-user"),
        ("Instagram", "Social", "@usuario_insta"),
        ("Banco Inter", "Financeiro", "conta 1234"),
        ("Steam", "Games", "gamer_pro"),
        ("Notion", "Produtividade", "email@corp.com")
    ]
    
    for titulo, servico, login in contas:
        senha_limpa = fake.password(length=12)
        
        # Criptografa manualmente pois removemos o setter mágico do Model
        senha_cripto = ""
        if cipher_suite:
            senha_cripto = cipher_suite.encrypt(senha_limpa.encode()).decode()
        
        segredo = create_instance(Segredo, {
            "titulo": titulo,
            "servico": servico,
            "notas": f"Login: {login} | Criado em {fake.date()}",
            "data_expiracao": fake.future_date() if random.random() < 0.2 else None,
            "valor_criptografado": senha_cripto # Campo correto do BD
        }, user_id)
        db.add(segredo)
        
    db.commit()
    print("   ✅ Cofre OK.")

def create_ritmo(user_id):
    print("💪 Populando Ritmo (Bio, Treinos, Nutrição)...")
    
    # 1. Bio
    bio = create_instance(RitmoBio, {
        "peso": 80.5, "altura": 178, "idade": 28, "genero": "M",
        "nivel_atividade": "moderado", "objetivo": "ganho_massa",
        "tmb": 1800, "gasto_calorico_total": 2600,
        "meta_proteina": 160, "meta_carbo": 300, "meta_gordura": 70, "meta_agua": 3.5,
        "bf_estimado": 18.5,
        "data_registro": datetime.now()
    }, user_id)
    db.add(bio)
    
    # 2. Planos de Treino
    plano = create_instance(RitmoPlanoTreino, {
        "nome": "Hipertrofia ABC 2025", "ativo": True
    }, user_id)
    db.add(plano)
    db.commit()
    db.refresh(plano)
    
    treinos = [
        ("Treino A - Peito/Tríceps", [("Supino Reto", "Peito", 4), ("Crucifixo", "Peito", 3), ("Tríceps Corda", "Tríceps", 4), ("Mergulho", "Tríceps", 3)]),
        ("Treino B - Costas/Bíceps", [("Puxada Alta", "Costas", 4), ("Remada Curvada", "Costas", 3), ("Rosca Direta", "Bíceps", 4), ("Rosca Martelo", "Bíceps", 3)]),
        ("Treino C - Pernas/Ombro", [("Agachamento", "Quadríceps", 4), ("Leg Press", "Quadríceps", 3), ("Stiff", "Posterior", 4), ("Elevação Lateral", "Ombros", 4)])
    ]
    
    for idx, (nome_dia, exercicios) in enumerate(treinos):
        dia = RitmoDiaTreino(plano_id=plano.id, nome=nome_dia, ordem=idx)
        db.add(dia)
        db.commit()
        db.refresh(dia)
        
        for nome_ex, grupo, series in exercicios:
            ex = RitmoExercicioItem(
                dia_treino_id=dia.id,
                nome_exercicio=nome_ex,
                grupo_muscular=grupo,
                series=series,
                repeticoes_min=8,
                repeticoes_max=12,
                descanso_segundos=60
            )
            db.add(ex)
            
    # 3. Dieta
    dieta = create_instance(RitmoDietaConfig, {
        "nome": "Bulking Limpo", "ativo": True, "calorias_calculadas": 2800
    }, user_id)
    db.add(dieta)
    db.commit()
    db.refresh(dieta)
    
    # Refeições
    refeicoes_data = [
        ("Café da Manhã", [("Ovos Inteiros", 3, "un", 210, 18, 2, 15), ("Pão Integral", 2, "fatias", 120, 4, 24, 2)]),
        ("Almoço", [("Arroz Branco", 200, "g", 260, 5, 56, 0), ("Frango Grelhado", 150, "g", 240, 46, 0, 5), ("Feijão", 100, "g", 76, 5, 14, 0)]),
        ("Lanche Tarde", [("Whey Protein", 1, "dose", 110, 24, 3, 1), ("Banana Prata", 1, "un", 70, 1, 18, 0)]),
        ("Jantar", [("Patinho Moído", 150, "g", 300, 40, 0, 12), ("Batata Doce", 200, "g", 170, 3, 40, 0)])
    ]

    for idx, (nome_ref, alimentos) in enumerate(refeicoes_data):
        ref = RitmoRefeicao(dieta_id=dieta.id, nome=nome_ref, ordem=idx)
        db.add(ref); db.commit(); db.refresh(ref)
        
        for nome, qtd, unid, cal, prot, carb, gord in alimentos:
            ali = RitmoAlimentoItem(
                refeicao_id=ref.id, nome=nome, quantidade=qtd, unidade=unid,
                calorias=cal, proteina=prot, carbo=carb, gordura=gord
            )
            db.add(ali)
    
    db.commit()
    print("   ✅ Ritmo OK.")

def main():
    print("🚀 Iniciando script de população PROFISSIONAL...")
    try:
        uid = get_target_user_id()
        
        create_registros(uid)
        create_financas(uid)
        create_agenda(uid)
        create_cofre(uid)
        create_ritmo(uid)
        
        print("\n✨ Banco de dados populado com sucesso para o usuário ID {}!".format(uid))
        
    except Exception as e:
        print(f"\n❌ Erro crítico: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()