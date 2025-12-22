import random
import uuid # [NOVO] Para gerar ID de grupos
from datetime import datetime, timedelta, date
from dateutil.relativedelta import relativedelta # [NOVO] Para cálculos de meses
from faker import Faker
from sqlalchemy.orm import Session
from sqlalchemy import inspect
from dotenv import load_dotenv # [CORREÇÃO] Importante

# [CORREÇÃO] Carrega variaveis de ambiente antes de qualquer import do App
load_dotenv()

# Imports do App
from app.db.session import SessionLocal

# Tenta importar Models (incluindo o novo Ritmo)
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

# Inicializa Faker
fake = Faker('pt_BR')
db = SessionLocal()

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
            print("❌ Nenhum usuário encontrado! Rode 'python create_user.py' antes.")
            exit(1)
    except Exception as e:
        print(f"⚠️ Erro ao buscar usuário: {e}")
        return None

def create_instance(model_class, data, user_id=None):
    """
    Cria instância do model verificando colunas e injetando user_id.
    """
    mapper = inspect(model_class)
    columns = [c.key for c in mapper.attrs]
    
    # Injeta user_id se o modelo suportar
    if user_id and 'user_id' in columns:
        data['user_id'] = user_id
        
    # Remove campos inválidos
    clean_data = {k: v for k, v in data.items() if k in columns}
    
    instance = model_class(**clean_data)
    
    # Tratamento especial para Setter de Criptografia do Cofre
    if model_class == Segredo and 'valor' in data:
        instance.valor = data['valor'] # Aciona o @valor.setter
        
    return instance

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
            db.commit() # Commit para gerar ID
            db.refresh(grupo)
        grupos_objs.append(grupo)
    
    # 2. Anotações (30 notas)
    titulos_notas = ["Resumo Reunião", "Lista de Livros", "Ideia App SaaS", "Receita Panqueca", "Senhas Wifi", "Rascunho Email"]
    for _ in range(30):
        grupo = random.choice(grupos_objs)
        html = f"<p>{fake.paragraph()}</p><ul><li>{fake.sentence()}</li><li>{fake.sentence()}</li></ul>"
        
        nota = create_instance(Anotacao, {
            "titulo": f"{random.choice(titulos_notas)} - {fake.word().capitalize()}",
            "conteudo": html,
            "fixado": random.choice([True] + [False]*9),
            "data_criacao": fake.date_time_between(start_date='-6M', end_date='now'),
            "grupo_id": grupo.id
        }, user_id)
        db.add(nota)
    db.commit()
            
    # 3. Tarefas (50 tarefas)
    verbos = ["Ligar para", "Comprar", "Finalizar", "Estudar", "Enviar", "Pagar", "Revisar"]
    for _ in range(50):
        dt_criacao = fake.date_time_between(start_date='-3M', end_date='now')
        status = random.choice(["Pendente", "Em andamento", "Concluído"])
        
        tarefa = create_instance(Tarefa, {
            "titulo": f"{random.choice(verbos)} {fake.first_name() if 'Ligar' in verbos else fake.word()}",
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
                    titulo=f"Etapa {i+1}: {fake.word()}", 
                    concluido=random.choice([True, False]), 
                    tarefa_id=tarefa.id
                )
                db.add(sub)

    db.commit()
    print("   ✅ Registros OK.")

def create_financas(user_id):
    print("💰 Populando Finanças (Pontuais, Recorrentes e Parceladas)...")
    
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
        ("Eletrônicos", "despesa", "fa-plug", "#6366f1"), # Nova categoria para parcelados
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
    print("   ... Gerando recorrências (Assinaturas)")
    recorrencias = [
        ("Netflix", "Assinaturas", 55.90, "despesa"),
        ("Spotify", "Assinaturas", 21.90, "despesa"),
        ("Academia", "Saúde", 120.00, "despesa"),
        ("Aluguel", "Moradia", 2500.00, "despesa"),
        ("Salário Mensal", "Salário", 6500.00, "receita")
    ]

    for desc_base, cat_nome, valor, tipo in recorrencias:
        grupo_id = uuid.uuid4().hex
        cat = cats_objs.get(cat_nome)
        if not cat: continue # Segurança

        start_date = fake.date_time_between(start_date='-8M', end_date='-7M')
        
        # Gera 12 ocorrências
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

    # 4. Transações PARCELADAS (Compras Grandes)
    print("   ... Gerando compras parceladas")
    parcelados = [
        ("Notebook Gamer", "Eletrônicos", 7000.00, 10), # 10x
        ("Viagem Férias", "Lazer", 4500.00, 6),         # 6x
        ("iPhone 15", "Eletrônicos", 6000.00, 12),      # 12x
    ]

    for desc_base, cat_nome, valor_total, qtd_parcelas in parcelados:
        grupo_id = uuid.uuid4().hex
        cat = cats_objs.get(cat_nome) or cats_objs.get("Lazer") # Fallback
        
        valor_parcela = round(valor_total / qtd_parcelas, 2)
        start_date = fake.date_time_between(start_date='-5M', end_date='-2M')

        for i in range(1, qtd_parcelas + 1):
            data_venc = start_date + relativedelta(months=i-1)
            status = "Efetivada" if data_venc < datetime.now() else "Pendente"
            
            # Ajuste de centavos na primeira parcela (opcional, mas profissional)
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
    
    tipos = ["Reunião", "Consulta Médica", "Almoço com Cliente", "Treino", "Call Daily", "Aniversário"]
    locais = ["Google Meet", "Escritório", "Centro", "Academia Smart", "Zoom"]
    
    for _ in range(60):
        dt = fake.date_time_between(start_date='-2M', end_date='+2M')
        # Zera segundos para ficar bonito
        dt = dt.replace(second=0, microsecond=0)
        
        status = 'Pendente'
        if dt < datetime.now():
            status = random.choice(['Realizado', 'Perdido', 'Realizado']) # Mais chance de realizado
            
        evt = create_instance(Compromisso, {
            "titulo": f"{random.choice(tipos)}: {fake.first_name()}",
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
    print("🔒 Populando Cofre...")
    
    contas = [
        ("Netflix", "Entretenimento", "user@gmail.com"),
        ("Spotify", "Música", "user.name"),
        ("Gov.br", "Pessoal", "123.456.789-00"),
        ("AWS Console", "Trabalho", "admin-user"),
        ("Instagram", "Social", "@usuario_insta"),
        ("Banco Inter", "Financeiro", "conta 1234")
    ]
    
    for titulo, servico, login in contas:
        segredo = create_instance(Segredo, {
            "titulo": titulo,
            "servico": servico,
            "notas": f"Login: {login} | Criado em {fake.date()}",
            "data_expiracao": fake.future_date() if random.random() < 0.2 else None,
            "valor": fake.password(length=12) # Isso será criptografado pelo Setter
        }, user_id)
        db.add(segredo)
        
    db.commit()
    print("   ✅ Cofre OK.")

def create_ritmo(user_id):
    print("💪 Populando Ritmo (Treino & Dieta)...")
    
    # 1. Bio
    bio = create_instance(RitmoBio, {
        "peso": 80.5, "altura": 178, "idade": 28, "genero": "M",
        "nivel_atividade": "moderado", "objetivo": "ganho_massa",
        "tmb": 1800, "gasto_calorico_total": 2600,
        "meta_proteina": 160, "meta_carbo": 300, "meta_gordura": 70, "meta_agua": 3.5,
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
    
    # Dias do Plano
    treinos = [
        ("Treino A - Peito/Tríceps", [("Supino Reto", "Peito", 4), ("Crucifixo", "Peito", 3), ("Tríceps Corda", "Tríceps", 4)]),
        ("Treino B - Costas/Bíceps", [("Puxada Alta", "Costas", 4), ("Remada Curvada", "Costas", 3), ("Rosca Direta", "Bíceps", 4)]),
        ("Treino C - Pernas/Ombro", [("Agachamento", "Quadríceps", 4), ("Leg Press", "Quadríceps", 3), ("Elevação Lateral", "Ombros", 4)])
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
    ref1 = RitmoRefeicao(dieta_id=dieta.id, nome="Café da Manhã", ordem=0)
    db.add(ref1); db.commit(); db.refresh(ref1)
    
    ali1 = RitmoAlimentoItem(refeicao_id=ref1.id, nome="Ovos Inteiros", quantidade=3, unidade="un", calorias=210, proteina=18, carbo=2, gordura=15)
    ali2 = RitmoAlimentoItem(refeicao_id=ref1.id, nome="Pão Integral", quantidade=2, unidade="fatias", calorias=120, proteina=4, carbo=24, gordura=2)
    db.add_all([ali1, ali2])
    
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
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()