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
    print("📝 Populando Caderno & Tarefas...")
    
    # 1. Grupos
    grupos_nomes = [
        ("Pessoal", "#3b82f6"), ("Trabalho", "#ef4444"), 
        ("Estudos", "#10b981"), ("Ideias", "#f59e0b"), ("Projetos", "#8b5cf6")
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
    
    # 2. Anotações (Gera 20 notas)
    for _ in range(20):
        grupo = random.choice(grupos_objs)
        # Gera HTML simples simulando o Quill
        html_content = f"""
        <p>{fake.paragraph()}</p>
        <ul>
            <li>{fake.sentence()}</li>
            <li>{fake.sentence()}</li>
            <li>{fake.sentence()}</li>
        </ul>
        <p><strong>Obs:</strong> {fake.sentence()}</p>
        """
        
        nota = Anotacao(
            titulo=fake.sentence(nb_words=4).replace(".", ""),
            conteudo=html_content,
            fixado=random.choice([True, False, False, False]), # 25% chance de fixar
            data_criacao=fake.date_time_between(start_date='-5M', end_date='now'),
            grupo_id=grupo.id
        )
        db.add(nota)
        db.flush()

        # Adiciona Links aleatórios em algumas notas
        if random.choice([True, False]):
            for _ in range(random.randint(1, 3)):
                db.add(Link(url=fake.url(), anotacao_id=nota.id))
    
    # 3. Tarefas (Gera 15 tarefas)
    for _ in range(15):
        status = random.choice(["Pendente", "Em andamento", "Concluído"])
        
        # Tarefas pendentes tendem a ser recentes, concluídas podem ser antigas
        if status == "Concluído":
            data_criacao = fake.date_time_between(start_date='-2M', end_date='-1d')
            data_conclusao = fake.date_time_between(start_date=data_criacao, end_date='now')
        else:
            data_criacao = fake.date_time_between(start_date='-1M', end_date='now')
            data_conclusao = None

        tarefa = Tarefa(
            titulo=f"Fazer {fake.bs()}",
            descricao=fake.text(max_nb_chars=100),
            status=status,
            fixado=random.choice([True, False]),
            data_criacao=data_criacao,
            data_conclusao=data_conclusao
        )
        db.add(tarefa)
        db.flush()

        # Subtarefas
        for _ in range(random.randint(1, 6)):
            # Se a tarefa tá concluída, as subs tbm estão (geralmente)
            sub_concluido = True if status == "Concluído" else random.choice([True, False])
            db.add(Subtarefa(
                titulo=fake.sentence(nb_words=3).replace(".", ""),
                concluido=sub_concluido,
                tarefa_id=tarefa.id
            ))
            
    db.commit()
    print("   ✅ Registros criados.")

def create_financas():
    print("💰 Populando Finanças...")
    
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
    ]
    
    cats_objs = []
    for nome, tipo, icone, cor in cats_data:
        cat = db.query(Categoria).filter(Categoria.nome == nome).first()
        if not cat:
            cat = Categoria(nome=nome, tipo=tipo, icone=icone, cor=cor, meta_limite=random.uniform(500, 2000))
            db.add(cat)
            cats_objs.append(cat)
        else:
            cats_objs.append(cat)
    db.commit()
    
    # Recarrega categorias separadas
    cats_despesa = db.query(Categoria).filter(Categoria.tipo == 'despesa').all()
    cats_receita = db.query(Categoria).filter(Categoria.tipo == 'receita').all()

    # 2. Transações (Gera 80 transações: Passado, Presente e Futuro Próximo)
    for _ in range(80):
        eh_receita = random.random() < 0.3 # 30% chance de ser receita
        categoria = random.choice(cats_receita) if eh_receita else random.choice(cats_despesa)
        
        # Datas entre 4 meses atrás e 1 mês pra frente
        data_t = fake.date_time_between(start_date='-4M', end_date='+1M')
        
        # Valores realistas
        if eh_receita:
            valor = random.uniform(1500, 8000)
        else:
            valor = random.uniform(20, 800)

        # Status: se data < hoje -> Efetivada, senão Pendente
        status = "Efetivada" if data_t < datetime.now() else "Pendente"
        
        # Simula parcelamento (apenas despesas)
        tipo_rec = random.choice(['pontual', 'pontual', 'pontual', 'parcelada'])
        
        if tipo_rec == 'parcelada' and not eh_receita:
            total_parc = random.randint(2, 12)
            valor_parcela = valor / total_parc
            
            for p in range(1, total_parc + 1):
                data_p = data_t + timedelta(days=30 * (p-1))
                status_p = "Efetivada" if data_p < datetime.now() else "Pendente"
                
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
            t = Transacao(
                descricao=fake.sentence(nb_words=3).replace(".", ""),
                valor=valor,
                data=data_t,
                categoria_id=categoria.id,
                tipo_recorrencia='pontual',
                status=status
            )
            db.add(t)
            
    db.commit()
    print("   ✅ Finanças populadas.")

def create_agenda():
    print("📅 Populando Agenda/Roteiro...")
    
    locais = ["Escritório", "Zoom", "Casa", "Consultório", "Faculdade", "Shopping"]
    
    # Gera 30 compromissos
    for _ in range(30):
        data_evt = fake.date_time_between(start_date='-2M', end_date='+2M')
        
        if data_evt < datetime.now():
            status = random.choice(['Realizado', 'Realizado', 'Realizado', 'Perdido'])
        else:
            status = 'Pendente'
            
        evt = Compromisso(
            titulo=random.choice(["Reunião", "Consulta", "Aula", "Entrega", "Almoço", "Academia", "Call"]) + " com " + fake.first_name(),
            descricao=fake.sentence(),
            local=random.choice(locais),
            data_hora=data_evt,
            lembrete=random.choice([True, False]),
            status=status
        )
        db.add(evt)
    
    db.commit()
    print("   ✅ Agenda populada.")

def create_cofre():
    print("🔒 Populando Cofre...")
    
    # Limpa cofre antes para não duplicar se rodar 2x (opcional, mas bom pra testes)
    # db.query(Segredo).delete()
    
    servicos = [
        ("Netflix", "Entretenimento"), ("Spotify", "Música"), 
        ("AWS Console", "Trabalho"), ("Gmail Principal", "Pessoal"), 
        ("Instagram", "Social"), ("Nubank", "Financeiro"),
        ("Steam", "Jogos"), ("ChatGPT", "IA")
    ]
    
    for nome, categoria in servicos:
        segredo = Segredo(
            titulo=f"Acesso {nome}",
            servico=categoria,
            usuario_login=fake.email(),
            # Simulação de senha encriptada
            senha_encriptada=f"ENC_{fake.password(length=12)}", 
            notas=fake.sentence(),
            data_expiracao=fake.future_date() if random.random() < 0.2 else None
        )
        db.add(segredo)
        
    db.commit()
    print("   ✅ Cofre populado.")

def main():
    print("🚀 Iniciando População do Banco de Dados...")
    try:
        create_registros()
        create_financas()
        create_agenda()
        create_cofre()
        print("\n✨ Processo finalizado com sucesso! (Usuário não foi alterado)")
    except Exception as e:
        print(f"\n❌ Erro ao popular banco: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()