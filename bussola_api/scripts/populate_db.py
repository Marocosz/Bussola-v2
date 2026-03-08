"""
=======================================================================================
ARQUIVO: populate_db.py (Script de Seed / População de Dados)
=======================================================================================

OBJETIVO:
    Preencher o banco de dados com dados fictícios (mas realistas) para facilitar o
    desenvolvimento e testes. Cria cenários complexos como transações parceladas,
    recorrências, histórico de agenda e dados criptografados.

PARTE DO SISTEMA:
    Scripts / Dev Tools.

RESPONSABILIDADES:
    1. Identificar um usuário alvo (primeiro do banco) para vincular os dados.
    2. Gerar dados massivos para Finanças, Agenda, Registros, Cofre e Ritmo.
    3. Simular lógica de negócio real (ex: Criptografar senhas do cofre, calcular datas de parcelas).
    4. Garantir integridade referencial ao criar objetos (ex: Vincular Subtarefa -> Tarefa -> User).

COMUNICAÇÃO:
    - Models: Importa todos os modelos do sistema.
    - DB: Usa app.db.session.SessionLocal.
    - Libs: Faker (dados falsos), Cryptography (segurança), Dateutil (datas relativas).

=======================================================================================
"""

import random
import uuid
import sys
import os
from datetime import datetime, timedelta, date
from dateutil.relativedelta import relativedelta
from faker import Faker
from sqlalchemy.orm import Session
from sqlalchemy import inspect
from dotenv import load_dotenv
from cryptography.fernet import Fernet 

# Ajuste de Path para execução via CLI
# Permite que o script encontre o pacote 'app' mesmo estando dentro de 'scripts/'
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.append(parent_dir)

# Carrega variáveis de ambiente
load_dotenv()

# Imports do App (Só funcionam após o sys.path.append)
from app.db.session import SessionLocal
from app.core.config import settings

# Importação defensiva dos Models
# Se faltar algum model novo, o script avisa e para, evitando erros parciais.
try:
    from app.models.user import User
    from app.models.financas import Categoria, Transacao
    from app.models.registros import GrupoAnotacao, Anotacao, Link, Tarefa, Subtarefa, Habito, HabitoRegistro
    from app.models.agenda import Compromisso
    from app.models.cofre import Segredo
    from app.models.ritmo import (
        RitmoBio, RitmoPlanoTreino, RitmoDiaTreino, RitmoExercicioItem,
        RitmoDietaConfig, RitmoRefeicao, RitmoAlimentoItem
    )
except ImportError as e:
    print(f"⚠️ Erro ao importar Models: {e}")
    exit(1)

# Inicializa Faker (Localizado PT-BR) e Sessão do Banco
fake = Faker('pt_BR')
db = SessionLocal()

# Inicializa Motor de Criptografia
# Necessário para popular a tabela 'Segredo' corretamente.
# Se a chave não existir, o script roda mas avisa que as senhas estarão corrompidas.
try:
    cipher_suite = Fernet(settings.ENCRYPTION_KEY.encode())
except Exception:
    cipher_suite = None
    print("⚠️ AVISO: ENCRYPTION_KEY não encontrada. Senhas do cofre podem falhar.")

# ==============================================================================
# UTILITÁRIOS
# ==============================================================================

def get_target_user_id():
    """
    Busca o ID do usuário "dono" dos dados.
    Geralmente pega o primeiro usuário criado (Admin).
    """
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
    Factory genérica e segura para criar instâncias de Models.
    
    Funcionalidades:
    1. Introspecção: Verifica quais colunas o Model realmente tem.
    2. Limpeza: Remove chaves do dicionário 'data' que não existem no Model (evita erros).
    3. Injeção: Adiciona 'user_id' automaticamente se a tabela tiver essa coluna.
    """
    mapper = inspect(model_class)
    columns = [c.key for c in mapper.attrs]
    
    # Injeta user_id se o modelo suportar (Multi-tenancy)
    if user_id and 'user_id' in columns:
        data['user_id'] = user_id
        
    # Filtro de campos inválidos
    clean_data = {k: v for k, v in data.items() if k in columns}
    
    return model_class(**clean_data)

# ==============================================================================
# MÓDULOS DE POPULAÇÃO (SEEDERS)
# ==============================================================================

def create_registros(user_id):
    """
    Popula o módulo de Produtividade (Notas e Tarefas).
    ATUALIZADO: Cria cenários específicos para testar os Agentes de IA.
    """
    print("📝 Populando Caderno e Tarefas (Cenários para IA)...")
    
    # 1. Grupos (Pastas)
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
    
    # 2. Anotações (30 notas genéricas)
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

    # --- CENÁRIOS DE TAREFAS PARA IA ---
    now = datetime.now()

    # Cenário A: Task Breaker (Tarefas Vagas e Sem Verbo)
    vagas = ["Projeto", "Reunião", "TCC", "Viagem", "Reforma", "Festa", "Mudar de Casa"]
    for v in vagas:
        t = create_instance(Tarefa, {
            "titulo": v, # Título vago proposital
            "descricao": None,
            "status": "Pendente",
            "prioridade": "Média",
            "fixado": False,
            "data_criacao": now - timedelta(days=2),
            "prazo": now + timedelta(days=5)
        }, user_id)
        db.add(t)

    # Cenário B: Time Strategist (Tarefas Atrasadas/Overdue)
    atrasadas = ["Pagar Internet", "Entregar Relatório Mensal", "Renovar Seguro", "Ligar para Cliente X"]
    for a in atrasadas:
        t = create_instance(Tarefa, {
            "titulo": a,
            "descricao": "Deveria ter sido feito dias atrás.",
            "status": "Pendente",
            "prioridade": "Alta",
            "fixado": True,
            "data_criacao": now - timedelta(days=10),
            "prazo": now - timedelta(days=random.randint(2, 5)) # Venceu há 2-5 dias
        }, user_id)
        db.add(t)

    # Cenário C: Time Strategist (Pânico / Dia Cheio)
    for i in range(8):
        t = create_instance(Tarefa, {
            "titulo": f"Tarefa do Dia Cheio {i+1}",
            "descricao": "Parte do teste de sobrecarga.",
            "status": "Pendente",
            "prioridade": random.choice(["Média", "Alta"]),
            "fixado": False,
            "data_criacao": now - timedelta(hours=5),
            "prazo": now.replace(hour=23, minute=59) # Vence hoje
        }, user_id)
        db.add(t)

    # Cenário D: Priority Alchemist (Tarefas Estagnadas/Zombie)
    estagnadas = ["Ler Livro Clean Code", "Arrumar Garagem", "Fazer Backup Fotos", "Atualizar Currículo"]
    for e in estagnadas:
        t = create_instance(Tarefa, {
            "titulo": e,
            "descricao": "Tarefa que estou procrastinando.",
            "status": "Pendente",
            "prioridade": "Alta", # Inflação de prioridade
            "fixado": False,
            "data_criacao": now - timedelta(days=random.randint(20, 45)), # Criada há 20-45 dias
            "prazo": None # Sem prazo definido ("Algum dia")
        }, user_id)
        db.add(t)

    # Cenário E: Flow Architect (Vácuo / Semana Livre)
    # Filler Antes (Hoje + 3 até Hoje + 8)
    for _ in range(5):
        dt = now + timedelta(days=random.randint(3, 8))
        t = create_instance(Tarefa, {
            "titulo": f"Tarefa Futura {fake.bs()}",
            "status": "Pendente",
            "prioridade": "Baixa",
            "data_criacao": now,
            "prazo": dt
        }, user_id)
        db.add(t)

    # Filler Depois (Hoje + 16 em diante)
    for _ in range(5):
        dt = now + timedelta(days=random.randint(16, 25))
        t = create_instance(Tarefa, {
            "titulo": f"Tarefa Longe {fake.bs()}",
            "status": "Pendente",
            "prioridade": "Média",
            "data_criacao": now,
            "prazo": dt
        }, user_id)
        db.add(t)
        
    db.commit()
    print("   ✅ Registros OK (Cenários de IA criados).")

def create_habitos(user_id):
    """
    Popula o módulo de Hábitos (Jornada).
    Cria hábitos com histórico preenchido (últimos 21 dias) para gerar gráficos ricos na UI.
    """
    print("🔁 Populando Hábitos...")
    
    TODOS = ["seg","ter","qua","qui","sex","sab","dom"]
    habitos_data = [
        {"titulo": "Meditação Diária",         "descricao": "15 minutos de mindfulness na varanda",        "horario": "07:00", "frequencia": TODOS,                                     "duracao_min": 15, "cor": "#8b5cf6"},
        {"titulo": "Leitura Técnica",           "descricao": "Ler pelo menos 10 páginas de clean code",    "horario": "21:30", "frequencia": TODOS,                                     "duracao_min": 30, "cor": "#3b82f6"},
        {"titulo": "Alongamento",               "descricao": "Alongamento rápido antes do trabalho",       "horario": "08:30", "frequencia": TODOS,                                     "duracao_min": 10, "cor": "#10b981"},
        {"titulo": "Trabalhar no Side Project", "descricao": "Desenvolver features do projeto pessoal",    "horario": "19:00", "frequencia": ["ter","qui","sab","dom"],                  "duracao_min": 60, "cor": "#f59e0b"},
    ]
    
    now = datetime.now()
    
    for h_data in habitos_data:
        habito = create_instance(Habito, h_data, user_id)
        db.add(habito)
        db.commit()
        db.refresh(habito)
        
        # Gerar histórico passado (últimos 21 dias, excluindo hoje para a UI iniciar limpa)
        for i in range(21, 0, -1):
            date_to_check = (now - timedelta(days=i)).date()
            weekday_str = ["seg","ter","qua","qui","sex","sab","dom"][date_to_check.weekday()]
            
            if weekday_str in habito.frequencia:
                # 75% de taxa de conclusão
                concluido = random.random() < 0.75
                registro = create_instance(HabitoRegistro, {
                    "habito_id": habito.id,
                    "data": date_to_check,
                    "concluido": concluido
                })
                db.add(registro)
    
    db.commit()
    print("   ✅ Hábitos OK.")


def create_financas(user_id):
    """
    Popula o módulo Financeiro.
    Cria cenários complexos com cobertura completa de status:
    - Pontuais (Pagas e Pendentes)
    - Parceladas Ativas (Passado e Futuro)
    - Parceladas Finalizadas (Tudo pago)
    - Recorrentes Ativas (Normal)
    - Recorrentes Canceladas (Histórico Zumbi - flag encerrada)
    """
    print("💰 Populando Finanças (Transações Complexas)...")
    
    # 1. Categorias Padrão (Com Ícones e Cores reais da UI)
    cats_config = [
        # Receitas
        ("Salário", "receita", "fa-solid fa-money-bill", "#10b981"),
        ("Freelance", "receita", "fa-solid fa-laptop", "#3b82f6"),
        ("Investimentos", "receita", "fa-solid fa-chart-line", "#8b5cf6"),
        
        # Despesas
        ("Alimentação", "despesa", "fa-solid fa-utensils", "#ef4444"),
        ("Mercado", "despesa", "fa-solid fa-cart-shopping", "#f97316"),
        ("Moradia", "despesa", "fa-solid fa-house", "#f97316"),
        ("Transporte", "despesa", "fa-solid fa-car", "#eab308"),
        ("Lazer", "despesa", "fa-solid fa-gamepad", "#8b5cf6"),
        ("Assinaturas", "despesa", "fa-solid fa-credit-card", "#6366f1"),
        ("Saúde", "despesa", "fa-solid fa-pills", "#ec4899"),
        ("Eletrônicos", "despesa", "fa-solid fa-plug", "#6366f1"),
        ("Educação", "despesa", "fa-solid fa-graduation-cap", "#14b8a6"),
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
    
    # 2. Transações PONTUAIS (Mistura de Efetivadas e Pendentes)
    print("   ... Gerando transações pontuais")
    for _ in range(120):
        is_rec = random.random() < 0.25 # 25% Receita
        cat = random.choice(cats_rec) if is_rec else random.choice(cats_desp)
        
        # Datas de -4 meses até +1 mês
        dt = fake.date_time_between(start_date='-4M', end_date='+1M')
        
        # Regra de status: Passado = Efetivada, Futuro = Pendente
        # Mas adicionamos 10% de chance de algo no passado estar "Esquecido/Pendente"
        status = "Efetivada"
        if dt > datetime.now():
            status = "Pendente"
        elif random.random() < 0.1: 
            status = "Pendente" # Esqueceu de pagar

        valor = random.uniform(200, 5000) if is_rec else random.uniform(15, 600)
        
        trans = create_instance(Transacao, {
            "descricao": f"{cat.nome} - {fake.word().capitalize()}",
            "valor": round(valor, 2),
            "data": dt,
            "categoria_id": cat.id,
            "tipo_recorrencia": "pontual",
            "status": status,
            "recorrencia_encerrada": False
        }, user_id)
        db.add(trans)

    # 3. Transações RECORRENTES (Assinaturas)
    
    # A) Assinaturas ATIVAS (Gera histórico passado e futuro próximo)
    print("   ... Gerando assinaturas ativas")
    recorrencias_ativas = [
        ("Netflix Premium", "Assinaturas", 55.90, "despesa"),
        ("Academia Smart", "Saúde", 129.90, "despesa"),
        ("Aluguel", "Moradia", 2200.00, "despesa"),
        ("Salário Mensal", "Salário", 6500.00, "receita")
    ]

    for desc_base, cat_nome, valor, tipo in recorrencias_ativas:
        grupo_id = uuid.uuid4().hex
        cat = cats_objs.get(cat_nome) or cats_objs.get("Outros")
        
        # Começou há 6 meses, vai até +2 meses (worker projection simulada)
        start_date = fake.date_time_between(start_date='-6M', end_date='-5M')
        
        for i in range(9): # 6 passados + 3 futuros
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
                "status": status,
                "recorrencia_encerrada": False
            }, user_id)
            db.add(trans)

    # B) Assinaturas CANCELADAS (Cenário Zumbi)
    # Assinou por 4 meses e cancelou. Só deve ter histórico passado com flag True.
    print("   ... Gerando assinaturas canceladas (Zumbi)")
    recorrencias_canceladas = [
        ("Curso Inglês (Cancelado)", "Educação", 250.00),
        ("Spotify (Cancelado)", "Assinaturas", 29.90)
    ]

    for desc_base, cat_nome, valor in recorrencias_canceladas:
        grupo_id = uuid.uuid4().hex
        cat = cats_objs.get(cat_nome)
        
        # Começou há 8 meses, durou 4 meses
        start_date = fake.date_time_between(start_date='-8M', end_date='-7M')
        
        for i in range(4):
            data_venc = start_date + relativedelta(months=i)
            # Todas no passado, efetivadas, mas MARCADAS como encerradas
            trans = create_instance(Transacao, {
                "descricao": desc_base,
                "valor": valor,
                "data": data_venc,
                "categoria_id": cat.id,
                "tipo_recorrencia": "recorrente",
                "frequencia": "mensal",
                "id_grupo_recorrencia": grupo_id,
                "status": "Efetivada",
                "recorrencia_encerrada": True # <--- AQUI ESTÁ O TRUQUE
            }, user_id)
            db.add(trans)

    # 4. Transações PARCELADAS
    
    # A) Parceladas ATIVAS (Meio do caminho)
    print("   ... Gerando parcelamentos ativos")
    parcelados_ativos = [
        ("Macbook Air", "Eletrônicos", 8500.00, 10), # Ainda pagando
        ("Viagem Férias", "Lazer", 4200.00, 12),     # Ainda pagando
    ]

    for desc_base, cat_nome, valor_total, qtd_parcelas in parcelados_ativos:
        grupo_id = uuid.uuid4().hex
        cat = cats_objs.get(cat_nome)
        
        # Lógica de Centavos (Mesma do Service)
        valor_parcela = round(valor_total / qtd_parcelas, 2)
        diferenca = round(valor_total - (valor_parcela * qtd_parcelas), 2)
        
        # Começou há uns 3-4 meses (então tem pagas e pendentes)
        start_date = datetime.now() - relativedelta(months=3)

        for i in range(1, qtd_parcelas + 1):
            data_venc = start_date + relativedelta(months=i-1)
            status = "Efetivada" if data_venc < datetime.now() else "Pendente"
            
            valor_final = valor_parcela
            if i == 1: valor_final += diferenca # Ajuste na primeira

            trans = create_instance(Transacao, {
                "descricao": f"{desc_base}",
                "valor": valor_final,
                "data": data_venc,
                "categoria_id": cat.id,
                "tipo_recorrencia": "parcelada",
                "parcela_atual": i,
                "total_parcelas": qtd_parcelas,
                "id_grupo_recorrencia": grupo_id,
                "status": status,
                "valor_total_parcelamento": valor_total, # Importante para UX
                "recorrencia_encerrada": False
            }, user_id)
            db.add(trans)

    # B) Parceladas FINALIZADAS (Histórico completo pago)
    print("   ... Gerando parcelamentos finalizados")
    parcelados_fim = [
        ("Celular Antigo", "Eletrônicos", 2500.00, 5),
        ("IPVA 2024", "Transporte", 1500.00, 3)
    ]

    for desc_base, cat_nome, valor_total, qtd_parcelas in parcelados_fim:
        grupo_id = uuid.uuid4().hex
        cat = cats_objs.get(cat_nome)
        
        valor_parcela = round(valor_total / qtd_parcelas, 2)
        diferenca = round(valor_total - (valor_parcela * qtd_parcelas), 2)
        
        # Terminou há 2 meses
        end_date = datetime.now() - relativedelta(months=2)
        start_date = end_date - relativedelta(months=qtd_parcelas)

        for i in range(1, qtd_parcelas + 1):
            data_venc = start_date + relativedelta(months=i-1)
            
            valor_final = valor_parcela
            if i == 1: valor_final += diferenca

            trans = create_instance(Transacao, {
                "descricao": f"{desc_base}",
                "valor": valor_final,
                "data": data_venc,
                "categoria_id": cat.id,
                "tipo_recorrencia": "parcelada",
                "parcela_atual": i,
                "total_parcelas": qtd_parcelas,
                "id_grupo_recorrencia": grupo_id,
                "status": "Efetivada", # Tudo pago
                "valor_total_parcelamento": valor_total,
                "recorrencia_encerrada": False # Não foi cancelada, foi concluída
            }, user_id)
            db.add(trans)
        
    db.commit()
    print("   ✅ Finanças OK.")

def create_agenda(user_id):
    """Popula eventos de calendário (passados, futuros e perdidos)."""
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
    """
    Popula cofre com criptografia real.
    Simula o serviço: cifra o dado antes de salvar.
    """
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
        
        # Simula Criptografia do Service
        senha_cripto = ""
        if cipher_suite:
            senha_cripto = cipher_suite.encrypt(senha_limpa.encode()).decode()
        
        segredo = create_instance(Segredo, {
            "titulo": titulo,
            "servico": servico,
            "notas": f"Login: {login} | Criado em {fake.date()}",
            "data_expiracao": fake.future_date() if random.random() < 0.2 else None,
            "valor_criptografado": senha_cripto # Campo interno físico
        }, user_id)
        db.add(segredo)
        
    db.commit()
    print("   ✅ Cofre OK.")

def create_ritmo(user_id):
    """Popula módulo de saúde (Bio, Treino Hierárquico e Dieta Hierárquica)."""
    print("💪 Populando Ritmo (Bio, Treinos, Nutrição)...")
    
    # 1. Bio (Snapshot)
    bio = create_instance(RitmoBio, {
        "peso": 80.5, "altura": 178, "idade": 28, "genero": "M",
        "nivel_atividade": "moderado", "objetivo": "ganho_massa",
        "tmb": 1800, "gasto_calorico_total": 2600,
        "meta_proteina": 160, "meta_carbo": 300, "meta_gordura": 70, "meta_agua": 3.5,
        "bf_estimado": 18.5,
        "data_registro": datetime.now()
    }, user_id)
    db.add(bio)
    
    # 2. Planos de Treino (Plano -> Dias -> Exercícios)
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
            
    # 3. Dieta (Dieta -> Refeições -> Alimentos)
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
    """Função Principal"""
    print("🚀 Iniciando script de população PROFISSIONAL...")
    try:
        uid = get_target_user_id()
        
        create_registros(uid)
        create_habitos(uid)
        create_financas(uid)
        create_agenda(uid)
        create_cofre(uid)
        create_ritmo(uid)
        
        print(f"\n✨ Banco de dados populado com sucesso para o usuário ID {uid}!")
        
    except Exception as e:
        print(f"\n❌ Erro crítico: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()