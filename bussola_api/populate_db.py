import random
from datetime import datetime, timedelta
from faker import Faker
from sqlalchemy.orm import Session

# Imports do App
from app.db.session import SessionLocal

# Models
from app.models.financas import Categoria, Transacao
from app.models.registros import GrupoAnotacao, Anotacao, Link, Tarefa, Subtarefa
from app.models.agenda import Compromisso
from app.models.cofre import Segredo

# Inicializa Faker (em Português)
fake = Faker('pt_BR')
db = SessionLocal()

def create_registros():
    print("📝 Populando Caderno & Tarefas (Volume Alto)...")
    
    # 1. Grupos
    grupos_nomes = [
        ("Pessoal", "#3b82f6"), ("Trabalho", "#ef4444"), 
        ("Estudos", "#10b981"), ("Ideias", "#f59e0b"), ("Projetos", "#8b5cf6"),
        ("Viagens", "#06b6d4"), ("Saúde", "#ec4899")
    ]
    grupos_objs = []
    for nome, cor in grupos_nomes:
        grupo = db.query(GrupoAnotacao).filter(GrupoAnotacao.nome == nome).first()
        if not grupo:
            grupo = GrupoAnotacao(nome=nome, cor=cor)
            db.add(grupo)
            grupos_objs.append(grupo)
        else:
            grupos_objs.append(grupo)
    db.commit()
    
    # 2. Anotações (Gera 200 notas espalhadas no último ano)
    print("   ... Gerando 200 anotações")
    for _ in range(200):
        grupo = random.choice(grupos_objs)
        # Gera HTML simples simulando o Quill
        html_content = f"""
        <p>{fake.paragraph(nb_sentences=5)}</p>
        <ul>
            <li>{fake.sentence()}</li>
            <li>{fake.sentence()}</li>
            <li>{fake.sentence()}</li>
            <li>{fake.sentence()}</li>
        </ul>
        <p><strong>Obs:</strong> {fake.sentence()}</p>
        <p>{fake.text()}</p>
        """
        
        nota = Anotacao(
            titulo=fake.sentence(nb_words=random.randint(2, 6)).replace(".", ""),
            conteudo=html_content,
            fixado=random.choice([True] + [False]*9), # 10% chance de fixar
            data_criacao=fake.date_time_between(start_date='-1y', end_date='now'),
            grupo_id=grupo.id
        )
        db.add(nota)
        db.flush()

        # Adiciona Links aleatórios em algumas notas
        if random.random() < 0.4:
            for _ in range(random.randint(1, 3)):
                db.add(Link(url=fake.url(), anotacao_id=nota.id))
    
    # 3. Tarefas (Gera 150 tarefas: Passadas e Futuras)
    print("   ... Gerando 150 tarefas")
    for _ in range(150):
        # Distribuição de status
        status = random.choices(["Pendente", "Em andamento", "Concluído"], weights=[40, 20, 40], k=1)[0]
        prioridade = random.choices(["Baixa", "Média", "Alta", "Crítica"], weights=[30, 40, 20, 10], k=1)[0]
        
        data_base = fake.date_time_between(start_date='-1y', end_date='+6M')
        
        data_conclusao = None
        if status == "Concluído":
            # Se concluído, data base é passado, e conclusão é um pouco depois
            data_criacao = data_base
            data_conclusao = data_criacao + timedelta(days=random.randint(0, 10))
            if data_conclusao > datetime.now(): data_conclusao = datetime.now() # Ajuste lógico
        else:
            data_criacao = data_base
            data_conclusao = None

        # Prazo (Opcional)
        prazo = None
        if random.random() < 0.6:
            prazo = data_criacao + timedelta(days=random.randint(1, 30))

        tarefa = Tarefa(
            titulo=f"{random.choice(['Fazer', 'Comprar', 'Ligar para', 'Enviar', 'Revisar'])} {fake.bs()}",
            descricao=fake.text(max_nb_chars=150),
            status=status,
            fixado=random.choice([True] + [False]*15),
            prioridade=prioridade,
            prazo=prazo,
            data_criacao=data_criacao,
            data_conclusao=data_conclusao
        )
        db.add(tarefa)
        db.flush()

        # Subtarefas
        if random.random() < 0.5:
            for _ in range(random.randint(1, 5)):
                sub_concluido = True if status == "Concluído" else random.choice([True, False])
                db.add(Subtarefa(
                    titulo=fake.sentence(nb_words=4).replace(".", ""),
                    concluido=sub_concluido,
                    tarefa_id=tarefa.id
                ))
            
    db.commit()
    print("   ✅ Registros massivos criados.")

def create_financas():
    print("💰 Populando Finanças (Histórico de 1 ano)...")
    
    # 1. Categorias
    cats_data = [
        ("Salário", "receita", "fa-money-bill", "#10b981"),
        ("Freelance", "receita", "fa-laptop", "#3b82f6"),
        ("Investimentos", "receita", "fa-chart-line", "#8b5cf6"),
        ("Alimentação", "despesa", "fa-utensils", "#ef4444"),
        ("Moradia", "despesa", "fa-house", "#f97316"),
        ("Transporte", "despesa", "fa-car", "#eab308"),
        ("Lazer", "despesa", "fa-gamepad", "#8b5cf6"),
        ("Saúde", "despesa", "fa-heart-pulse", "#ec4899"),
        ("Educação", "despesa", "fa-graduation-cap", "#6366f1"),
        ("Assinaturas", "despesa", "fa-ticket", "#64748b"),
        ("Compras", "despesa", "fa-bag-shopping", "#f43f5e"),
    ]
    
    cats_objs = []
    for nome, tipo, icone, cor in cats_data:
        cat = db.query(Categoria).filter(Categoria.nome == nome).first()
        if not cat:
            cat = Categoria(nome=nome, tipo=tipo, icone=icone, cor=cor, meta_limite=random.uniform(500, 3000))
            db.add(cat)
            cats_objs.append(cat)
        else:
            cats_objs.append(cat)
    db.commit()
    
    cats_despesa = db.query(Categoria).filter(Categoria.tipo == 'despesa').all()
    cats_receita = db.query(Categoria).filter(Categoria.tipo == 'receita').all()

    # 2. Transações (Gera 2.000 transações para preencher bem os gráficos)
    print("   ... Gerando 2.000 transações financeiras")
    
    for _ in range(2000):
        # 25% Receita, 75% Despesa
        eh_receita = random.random() < 0.25 
        categoria = random.choice(cats_receita) if eh_receita else random.choice(cats_despesa)
        
        # Datas: 1 ano para trás, 6 meses para frente (previsão)
        data_t = fake.date_time_between(start_date='-1y', end_date='+6M')
        
        # Valores
        if eh_receita:
            valor = random.uniform(2000, 15000) if "Salário" in categoria.nome else random.uniform(200, 3000)
        else:
            if "Moradia" in categoria.nome:
                valor = random.uniform(800, 2500)
            elif "Alimentação" in categoria.nome:
                valor = random.uniform(20, 300)
            else:
                valor = random.uniform(15, 1000)

        # Status: Passado = Efetivada, Futuro = Pendente
        status = "Efetivada" if data_t < datetime.now() else "Pendente"
        
        # Parcelamento (10% das despesas)
        tipo_rec = 'pontual'
        if not eh_receita and random.random() < 0.10:
            tipo_rec = 'parcelada'
        
        if tipo_rec == 'parcelada':
            total_parc = random.randint(2, 12)
            valor_parcela = valor / total_parc
            
            # Cria as N parcelas
            for p in range(1, total_parc + 1):
                data_p = data_t + timedelta(days=30 * (p-1))
                status_p = "Efetivada" if data_p < datetime.now() else "Pendente"
                
                # Se passou de 1 ano no futuro, para (opcional, mas bom pra não sujar mt)
                if data_p > datetime.now() + timedelta(days=365):
                    break

                t = Transacao(
                    descricao=f"Compra {fake.word()} ({p}/{total_parc})",
                    valor=valor_parcela,
                    data=data_p,
                    categoria_id=categoria.id,
                    tipo_recorrencia='parcelada',
                    status=status_p,
                    parcela_atual=p,
                    total_parcelas=total_parc
                )
                db.add(t)
        else:
            # Transação Normal ou Recorrente (Assinaturas)
            if "Assinaturas" in categoria.nome or "Moradia" in categoria.nome:
                tipo_rec = 'recorrente' if random.random() < 0.5 else 'pontual'

            t = Transacao(
                descricao=fake.sentence(nb_words=3).replace(".", ""),
                valor=valor,
                data=data_t,
                categoria_id=categoria.id,
                tipo_recorrencia=tipo_rec,
                status=status
            )
            db.add(t)
            
    db.commit()
    print("   ✅ Finanças populadas com histórico.")

def create_agenda():
    print("📅 Populando Agenda (300 compromissos)...")
    
    locais = ["Escritório", "Zoom", "Google Meet", "Casa", "Consultório", "Faculdade", "Shopping", "Cliente"]
    tipos = ["Reunião", "Consulta", "Aula", "Treino", "Almoço", "Call", "Viagem", "Aniversário"]
    
    # Gera 300 compromissos (-1 ano a +1 ano)
    for _ in range(300):
        data_evt = fake.date_time_between(start_date='-1y', end_date='+1y')
        
        if data_evt < datetime.now():
            status = random.choices(['Realizado', 'Perdido', 'Cancelado'], weights=[80, 15, 5], k=1)[0]
        else:
            status = 'Pendente'
            
        evt = Compromisso(
            titulo=f"{random.choice(tipos)}: {fake.bs()}",
            descricao=fake.sentence(),
            local=random.choice(locais),
            data_hora=data_evt,
            lembrete=random.choice([True, False]),
            status=status,
            cor=fake.color() # Se o modelo tiver cor
        )
        db.add(evt)
    
    db.commit()
    print("   ✅ Agenda populada.")

def create_cofre():
    print("🔒 Populando Cofre...")
    
    # Serviços Fixos
    servicos_fixos = [
        ("Netflix", "Entretenimento"), ("Spotify", "Música"), 
        ("AWS Console", "Trabalho"), ("Gmail Principal", "Pessoal"), 
        ("Instagram", "Social"), ("Nubank", "Financeiro"),
        ("Steam", "Jogos"), ("ChatGPT", "IA")
    ]
    
    for nome, categoria in servicos_fixos:
        segredo = Segredo(
            titulo=f"Acesso {nome}",
            servico=categoria,
            usuario_login=fake.email(),
            senha_encriptada=f"ENC_{fake.password(length=12)}", 
            notas=fake.sentence(),
            data_expiracao=fake.future_date() if random.random() < 0.3 else None
        )
        db.add(segredo)

    # Serviços Aleatórios para volume
    for _ in range(40):
        domain = fake.domain_name()
        segredo = Segredo(
            titulo=f"Conta {domain}",
            servico="Outros",
            usuario_login=fake.user_name(),
            senha_encriptada=f"ENC_{fake.password(length=16)}",
            notas="Gerado automaticamente",
            data_expiracao=fake.date_between(start_date='-6M', end_date='+2y') if random.random() < 0.5 else None
        )
        db.add(segredo)
        
    db.commit()
    print("   ✅ Cofre populado.")

def main():
    print("🚀 Iniciando População MASSIVA do Banco de Dados...")
    try:
        create_registros()
        create_financas()
        create_agenda()
        create_cofre()
        print("\n✨ Processo finalizado com sucesso! (Muitos dados gerados)")
    except Exception as e:
        print(f"\n❌ Erro ao popular banco: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()