import uuid
from datetime import datetime
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, desc
from sqlalchemy.exc import IntegrityError # [NOVO] Import para tratar concorrência
from collections import defaultdict
import random

from app.models.financas import Transacao, Categoria 
from app.schemas.financas import TransacaoCreate, TransacaoUpdate, TipoRecorrencia

# Lista de ícones
ICONES_DISPONIVEIS = [
    "fa-solid fa-utensils", "fa-solid fa-burger", "fa-solid fa-cart-shopping",
    "fa-solid fa-house", "fa-solid fa-lightbulb", "fa-solid fa-wifi",
    "fa-solid fa-car", "fa-solid fa-gas-pump", "fa-solid fa-film",
    "fa-solid fa-gamepad", "fa-solid fa-shirt", "fa-solid fa-pills",
    "fa-solid fa-dollar-sign", "fa-solid fa-graduation-cap"
]

class FinancasService:
    
    def gerar_paleta_cores(self, n=20):
        cores = []
        for _ in range(n):
            color = "#{:06x}".format(random.randint(0, 0xFFFFFF))
            cores.append(color)
        return cores

    def get_or_create_indefinida(self, db: Session, tipo: str, user_id: int) -> Categoria:
        """
        Busca ou cria uma categoria 'Indefinida' ESPECÍFICA para o tipo E USUÁRIO.
        Usa nomes distintos para não quebrar a constraint UNIQUE do banco.
        BLINDADO: Usa try/except para evitar erro de concorrência (Race Condition).
        """
        nome_padrao = f"Indefinida ({tipo.capitalize()})"
        
        # 1. Tenta buscar existente
        cat = db.query(Categoria).filter(
            Categoria.nome == nome_padrao,
            Categoria.tipo == tipo,
            Categoria.user_id == user_id
        ).first()

        if cat:
            return cat

        # 2. Se não achou, tenta a legada
        cat_legacy = db.query(Categoria).filter(
            Categoria.nome == "Indefinida", 
            Categoria.tipo == tipo,
            Categoria.user_id == user_id
        ).first()
        
        if cat_legacy:
            cat_legacy.nome = nome_padrao
            db.commit()
            db.refresh(cat_legacy)
            return cat_legacy

        # 3. Se não achou nenhuma, tenta criar (com proteção de concorrência)
        try:
            nova_cat = Categoria(
                nome=nome_padrao,
                tipo=tipo,
                icone="fa-solid fa-circle-question", 
                cor="#94a3b8", # Cinza
                meta_limite=0,
                user_id=user_id
            )
            db.add(nova_cat)
            db.commit()
            db.refresh(nova_cat)
            return nova_cat
        except IntegrityError:
            db.rollback()
            # Se deu erro, é porque outra requisição criou milissegundos antes.
            # Buscamos novamente e retornamos.
            return db.query(Categoria).filter(
                Categoria.nome == nome_padrao,
                Categoria.tipo == tipo,
                Categoria.user_id == user_id
            ).first()

    def gerar_transacoes_futuras(self, db: Session, user_id: int):
        today_date = datetime.now().date()

        # [PERFORMANCE] Busca APENAS grupos ativos do usuário para evitar processamento inútil
        grupos = db.query(Transacao.id_grupo_recorrencia).filter(
            Transacao.tipo_recorrencia.in_(['recorrente', 'parcelada']),
            Transacao.user_id == user_id
        ).distinct().all()

        if not grupos:
            return # Sai cedo se não tiver nada pra processar

        for grupo_tuple in grupos:
            grupo_id = grupo_tuple[0]
            if not grupo_id: continue

            # Busca última transação deste grupo
            ultima = db.query(Transacao).filter(
                Transacao.id_grupo_recorrencia == grupo_id,
                Transacao.user_id == user_id
            ).order_by(Transacao.data.desc()).first()
            
            if not ultima: continue

            # Se a última já está no futuro, não precisamos fazer nada para este grupo
            if ultima.data.date() > today_date:
                continue

            # Lógica de Geração
            if ultima.tipo_recorrencia == 'recorrente':
                proximo_vencimento = ultima.data
                frequencia = ultima.frequencia
                
                # Incremento inicial
                if frequencia == 'semanal': proximo_vencimento += relativedelta(weeks=1)
                elif frequencia == 'mensal': proximo_vencimento += relativedelta(months=1)
                elif frequencia == 'anual': proximo_vencimento += relativedelta(years=1)

                while proximo_vencimento.date() <= today_date:
                    nova = Transacao(
                        descricao=ultima.descricao, valor=ultima.valor, data=proximo_vencimento,
                        categoria_id=ultima.categoria_id, tipo_recorrencia='recorrente',
                        id_grupo_recorrencia=grupo_id, status='Pendente', frequencia=frequencia,
                        user_id=user_id
                    )
                    db.add(nova)
                    # Próximo incremento
                    if frequencia == 'semanal': proximo_vencimento += relativedelta(weeks=1)
                    elif frequencia == 'mensal': proximo_vencimento += relativedelta(months=1)
                    elif frequencia == 'anual': proximo_vencimento += relativedelta(years=1)

            elif ultima.tipo_recorrencia == 'parcelada':
                if ultima.parcela_atual >= ultima.total_parcelas: continue

                prox_parcela = ultima.parcela_atual + 1
                prox_vencimento = ultima.data + relativedelta(months=1)

                while prox_vencimento.date() <= today_date and prox_parcela <= ultima.total_parcelas:
                    nova = Transacao(
                        descricao=ultima.descricao, valor=ultima.valor, data=prox_vencimento,
                        categoria_id=ultima.categoria_id, tipo_recorrencia='parcelada',
                        parcela_atual=prox_parcela, total_parcelas=ultima.total_parcelas,
                        id_grupo_recorrencia=grupo_id, status='Pendente',
                        user_id=user_id
                    )
                    db.add(nova)
                    prox_vencimento += relativedelta(months=1)
                    prox_parcela += 1
        
        db.commit()

    def get_dashboard_data(self, db: Session, user_id: int):
        """
        Centraliza a lógica de montagem do dashboard de finanças.
        Calcula estatísticas de categorias e agrupa transações.
        """
        # 1. Manutenção e Garantia de Categorias do Sistema
        self.gerar_transacoes_futuras(db, user_id)
        
        # Cria "Indefinida (Despesa)" e "Indefinida (Receita)"
        self.get_or_create_indefinida(db, "despesa", user_id)
        self.get_or_create_indefinida(db, "receita", user_id)

        # 2. Datas
        today = datetime.now()
        start_of_month = today.replace(day=1, hour=0, minute=0, second=0)
        next_month = start_of_month + relativedelta(months=1)

        # 3. Categorias com Totais
        
        # --- DESPESAS ---
        cats_despesa = db.query(Categoria).filter(Categoria.tipo == 'despesa', Categoria.user_id == user_id).all()
        for cat in cats_despesa:
            total_mes = db.query(func.sum(Transacao.valor)).filter(
                Transacao.categoria_id == cat.id,
                Transacao.data >= start_of_month,
                Transacao.data < next_month,
                Transacao.status == 'Efetivada'
            ).scalar()
            cat.total_gasto = total_mes or 0.0

            stats = db.query(
                func.sum(Transacao.valor),   
                func.avg(Transacao.valor),   
                func.count(Transacao.id)     
            ).filter(
                Transacao.categoria_id == cat.id,
                Transacao.status == 'Efetivada'
            ).first()

            cat.total_historico = stats[0] or 0.0
            cat.media_valor = stats[1] or 0.0
            cat.qtd_transacoes = stats[2] or 0

        # --- RECEITAS ---
        cats_receita = db.query(Categoria).filter(Categoria.tipo == 'receita', Categoria.user_id == user_id).all()
        for cat in cats_receita:
            total_mes = db.query(func.sum(Transacao.valor)).filter(
                Transacao.categoria_id == cat.id,
                Transacao.data >= start_of_month,
                Transacao.data < next_month,
                Transacao.status == 'Efetivada'
            ).scalar()
            cat.total_ganho = total_mes or 0.0

            stats = db.query(
                func.sum(Transacao.valor),
                func.avg(Transacao.valor),
                func.count(Transacao.id)
            ).filter(
                Transacao.categoria_id == cat.id,
                Transacao.status == 'Efetivada'
            ).first()

            cat.total_historico = stats[0] or 0.0
            cat.media_valor = stats[1] or 0.0
            cat.qtd_transacoes = stats[2] or 0

        # 4. Transações Agrupadas
        transacoes = db.query(Transacao).filter(Transacao.user_id == user_id).order_by(desc(Transacao.data)).all()
        
        pontuais_map = defaultdict(list)
        recorrentes_map = defaultdict(list)

        meses_traducao = {
            1: "Janeiro", 2: "Fevereiro", 3: "Março", 4: "Abril", 5: "Maio", 6: "Junho",
            7: "Julho", 8: "Agosto", 9: "Setembro", 10: "Outubro", 11: "Novembro", 12: "Dezembro"
        }

        for t in transacoes:
            mes_key = f"{meses_traducao[t.data.month]}/{t.data.year}"
            if t.tipo_recorrencia == 'pontual':
                pontuais_map[mes_key].append(t)
            else:
                recorrentes_map[mes_key].append(t)

        return {
            "categorias_despesa": cats_despesa,
            "categorias_receita": cats_receita,
            "transacoes_pontuais": pontuais_map,
            "transacoes_recorrentes": recorrentes_map,
            "icones_disponiveis": ICONES_DISPONIVEIS,
            "cores_disponiveis": self.gerar_paleta_cores()
        }

    def criar_transacao(self, db: Session, dados: TransacaoCreate, user_id: int):
        
        if dados.tipo_recorrencia == 'pontual':
            nova = Transacao(**dados.model_dump(), user_id=user_id)
            if not dados.status: nova.status = 'Pendente'
            db.add(nova)
            db.commit()
            db.refresh(nova)
            return nova

        elif dados.tipo_recorrencia == 'parcelada':
            grupo_id = uuid.uuid4().hex
            
            valor_total = dados.valor
            qtd_parcelas = dados.total_parcelas
            
            valor_parcela_base = round(valor_total / qtd_parcelas, 2)
            diferenca = round(valor_total - (valor_parcela_base * qtd_parcelas), 2)
            
            primeira_criada = None

            for i in range(1, qtd_parcelas + 1):
                valor_desta = valor_parcela_base
                if i == 1:
                    valor_desta += diferenca
                
                data_vencimento = dados.data + relativedelta(months=i-1)
                
                nova = Transacao(
                    descricao=dados.descricao,
                    valor=valor_desta,
                    data=data_vencimento,
                    categoria_id=dados.categoria_id,
                    tipo_recorrencia='parcelada',
                    parcela_atual=i,
                    total_parcelas=qtd_parcelas,
                    id_grupo_recorrencia=grupo_id,
                    status=dados.status or 'Pendente',
                    user_id=user_id
                )
                
                db.add(nova)
                
                if i == 1:
                    primeira_criada = nova

            db.commit()
            db.refresh(primeira_criada)
            return primeira_criada

        elif dados.tipo_recorrencia == 'recorrente':
            grupo_id = uuid.uuid4().hex
            nova = Transacao(**dados.model_dump(), user_id=user_id)
            nova.id_grupo_recorrencia = grupo_id
            db.add(nova)
            db.commit()
            return nova

    def atualizar_transacao(self, db: Session, id: int, dados: TransacaoUpdate, user_id: int):
        transacao = db.query(Transacao).filter(Transacao.id == id, Transacao.user_id == user_id).first()
        if not transacao:
            return None
        
        update_data = dados.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(transacao, key, value)
            
        db.commit()
        db.refresh(transacao)
        return transacao

financas_service = FinancasService()