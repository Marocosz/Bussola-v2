"""
=======================================================================================
ARQUIVO: financas.py (Serviço de Domínio - Finanças Pessoais)
=======================================================================================

OBJETIVO:
    Gerenciar toda a lógica financeira da aplicação, desde a simples criação de transações
    até complexos algoritmos de projeção de gastos recorrentes e parcelados.

PARTE DO SISTEMA:
    Backend / Service Layer.

RESPONSABILIDADES:
    1. CRUD Inteligente: Criação de transações pontuais, recorrentes e parcelamentos.
    2. Projeção Futura: Worker interno que gera lançamentos futuros automaticamente.
    3. Dashboard: Agregação de dados, cálculo de totais por categoria e históricos.
    4. Integridade: Gestão de categorias padrão ("Indefinida") à prova de falhas.

COMUNICAÇÃO:
    - Models: Transacao, Categoria.
    - Utilizado por: app.api.endpoints.financas.
    - Dependências: dateutil (cálculos de datas complexos), sqlalchemy (agregadores).

=======================================================================================
"""

import uuid
from datetime import datetime
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, desc
from sqlalchemy.exc import IntegrityError # Import para tratamento de concorrência
from collections import defaultdict
import random

from app.models.financas import Transacao, Categoria 
from app.schemas.financas import TransacaoCreate, TransacaoUpdate

# Catálogo de ícones FontAwesome disponíveis para escolha no frontend
ICONES_DISPONIVEIS = [
    "fa-solid fa-utensils", "fa-solid fa-burger", "fa-solid fa-cart-shopping",
    "fa-solid fa-house", "fa-solid fa-lightbulb", "fa-solid fa-wifi",
    "fa-solid fa-car", "fa-solid fa-gas-pump", "fa-solid fa-film",
    "fa-solid fa-gamepad", "fa-solid fa-shirt", "fa-solid fa-pills",
    "fa-solid fa-dollar-sign", "fa-solid fa-graduation-cap"
]

class FinancasService:
    
    def gerar_paleta_cores(self, n=20):
        """Gera cores hexadecimais aleatórias para gráficos e categorias."""
        cores = []
        for _ in range(n):
            color = "#{:06x}".format(random.randint(0, 0xFFFFFF))
            cores.append(color)
        return cores

    def get_or_create_indefinida(self, db: Session, tipo: str, user_id: int) -> Categoria:
        """
        Busca ou cria uma categoria de fallback ('Indefinida') para transações sem classificação.
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

        # 2. Migração de legado: Renomeia categorias antigas se existirem
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

        # 3. Criação segura
        try:
            nova_cat = Categoria(
                nome=nome_padrao,
                tipo=tipo,
                icone="fa-solid fa-circle-question", 
                cor="#94a3b8", # Cinza neutro
                meta_limite=0,
                user_id=user_id
            )
            db.add(nova_cat)
            db.commit()
            db.refresh(nova_cat)
            return nova_cat
        except IntegrityError:
            db.rollback()
            return db.query(Categoria).filter(
                Categoria.nome == nome_padrao,
                Categoria.tipo == tipo,
                Categoria.user_id == user_id
            ).first()

    def gerar_transacoes_futuras(self, db: Session, user_id: int):
        """
        WORKER DE PROJEÇÃO: Gera lançamentos futuros baseados em regras de recorrência.
        Garante projeção até 'Hoje + 2 meses' para o usuário ver contas futuras.
        """
        today = datetime.now().date()
        horizonte_limite = today + relativedelta(months=2)

        grupos = db.query(Transacao.id_grupo_recorrencia).filter(
            Transacao.tipo_recorrencia.in_(['recorrente', 'parcelada']),
            Transacao.user_id == user_id
        ).distinct().all()

        if not grupos:
            return 

        for grupo_tuple in grupos:
            grupo_id = grupo_tuple[0]
            if not grupo_id: continue

            # Pega o último lançamento conhecido deste grupo
            ultima = db.query(Transacao).filter(
                Transacao.id_grupo_recorrencia == grupo_id,
                Transacao.user_id == user_id
            ).order_by(Transacao.data.desc()).first()
            
            if not ultima: continue

            # Se o usuário encerrou, não gera mais nada.
            if ultima.recorrencia_encerrada:
                continue

            # Se já estamos projetados até o horizonte limite, não precisa criar mais
            if ultima.data.date() >= horizonte_limite:
                continue

            # CASO A: RECORRÊNCIA INFINITA
            if ultima.tipo_recorrencia == 'recorrente':
                proximo_vencimento = ultima.data
                frequencia = ultima.frequencia
                
                if frequencia == 'semanal': proximo_vencimento += relativedelta(weeks=1)
                elif frequencia == 'mensal': proximo_vencimento += relativedelta(months=1)
                elif frequencia == 'anual': proximo_vencimento += relativedelta(years=1)

                while proximo_vencimento.date() <= horizonte_limite:
                    nova = Transacao(
                        descricao=ultima.descricao, valor=ultima.valor, data=proximo_vencimento,
                        categoria_id=ultima.categoria_id, tipo_recorrencia='recorrente',
                        id_grupo_recorrencia=grupo_id, status='Pendente', frequencia=frequencia,
                        user_id=user_id
                    )
                    db.add(nova)
                    
                    if frequencia == 'semanal': proximo_vencimento += relativedelta(weeks=1)
                    elif frequencia == 'mensal': proximo_vencimento += relativedelta(months=1)
                    elif frequencia == 'anual': proximo_vencimento += relativedelta(years=1)

            # CASO B: PARCELAMENTO FINITO
            elif ultima.tipo_recorrencia == 'parcelada':
                if ultima.parcela_atual >= ultima.total_parcelas: continue

                prox_parcela = ultima.parcela_atual + 1
                prox_vencimento = ultima.data + relativedelta(months=1)

                while prox_vencimento.date() <= horizonte_limite and prox_parcela <= ultima.total_parcelas:
                    nova = Transacao(
                        descricao=ultima.descricao, valor=ultima.valor, data=prox_vencimento,
                        categoria_id=ultima.categoria_id, tipo_recorrencia='parcelada',
                        parcela_atual=prox_parcela, total_parcelas=ultima.total_parcelas,
                        id_grupo_recorrencia=grupo_id, status='Pendente',
                        valor_total_parcelamento=ultima.valor_total_parcelamento, # Propaga o valor original
                        user_id=user_id
                    )
                    db.add(nova)
                    prox_vencimento += relativedelta(months=1)
                    prox_parcela += 1
        
        db.commit()

    def get_dashboard_data(self, db: Session, user_id: int):
        """
        Agregador de Dados para o Dashboard Financeiro.
        """
        self.gerar_transacoes_futuras(db, user_id)
        self.get_or_create_indefinida(db, "despesa", user_id)
        self.get_or_create_indefinida(db, "receita", user_id)

        today = datetime.now()
        start_of_month = today.replace(day=1, hour=0, minute=0, second=0)
        next_month = start_of_month + relativedelta(months=1)

        # Totais Despesas
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
                func.sum(Transacao.valor), func.avg(Transacao.valor), func.count(Transacao.id)
            ).filter(
                Transacao.categoria_id == cat.id, Transacao.status == 'Efetivada'
            ).first()

            cat.total_historico = stats[0] or 0.0
            cat.media_valor = stats[1] or 0.0
            cat.qtd_transacoes = stats[2] or 0

        # Totais Receitas
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
                func.sum(Transacao.valor), func.avg(Transacao.valor), func.count(Transacao.id)
            ).filter(
                Transacao.categoria_id == cat.id, Transacao.status == 'Efetivada'
            ).first()

            cat.total_historico = stats[0] or 0.0
            cat.media_valor = stats[1] or 0.0
            cat.qtd_transacoes = stats[2] or 0

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
        
    def encerrar_recorrencia(self, db: Session, transacao_id: int, user_id: int):
        """
        Encerra uma série financeira.
        Remove o futuro e blinda todo o grupo restante como encerrado.
        """
        alvo = db.query(Transacao).filter(Transacao.id == transacao_id, Transacao.user_id == user_id).first()
        if not alvo: return {"error": "Transação não encontrada", "code": 404}
        
        if not alvo.id_grupo_recorrencia:
            return {"error": "Esta transação não possui recorrência ativa.", "code": 400}

        grupo_id = alvo.id_grupo_recorrencia

        # Remove Futuro
        deletadas = db.query(Transacao).filter(
            Transacao.id_grupo_recorrencia == grupo_id,
            Transacao.user_id == user_id,
            Transacao.status == 'Pendente'
        ).delete()

        # Blinda Passado/Restante
        db.query(Transacao).filter(
            Transacao.id_grupo_recorrencia == grupo_id,
            Transacao.user_id == user_id
        ).update({
            "recorrencia_encerrada": True
        })

        db.commit()
        return {
            "status": "success", 
            "message": "Série encerrada e histórico blindado.",
            "futuras_removidas": deletadas
        }

    # ----------------------------------------------------------------------------------
    # LÓGICA DE CRIAÇÃO (FACTORY)
    # ----------------------------------------------------------------------------------
    def criar_transacao(self, db: Session, dados: TransacaoCreate, user_id: int):
        
        # CASO 1: Transação Simples
        if dados.tipo_recorrencia == 'pontual':
            nova = Transacao(**dados.model_dump(), user_id=user_id)
            # Pontuais nascem efetivadas por padrão
            if not dados.status or dados.status == 'Pendente': 
                nova.status = 'Efetivada'
            db.add(nova)
            db.commit()
            db.refresh(nova)
            return nova

        # CASO 2: Parcelamento (Gera N transações futuras de uma vez)
        elif dados.tipo_recorrencia == 'parcelada':
            grupo_id = uuid.uuid4().hex
            
            valor_total_compra = dados.valor
            qtd_parcelas = dados.total_parcelas
            
            valor_parcela_base = round(valor_total_compra / qtd_parcelas, 2)
            diferenca = round(valor_total_compra - (valor_parcela_base * qtd_parcelas), 2)
            
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
                    valor_total_parcelamento=valor_total_compra, # Salva o total original
                    user_id=user_id
                )
                
                db.add(nova)
                
                if i == 1:
                    primeira_criada = nova

            db.commit()
            db.refresh(primeira_criada)
            return primeira_criada

        # CASO 3: Recorrência Contínua
        elif dados.tipo_recorrencia == 'recorrente':
            grupo_id = uuid.uuid4().hex
            nova = Transacao(**dados.model_dump(), user_id=user_id)
            nova.id_grupo_recorrencia = grupo_id
            if not dados.status: nova.status = 'Pendente'
            db.add(nova)
            db.commit()
            return nova

    def atualizar_transacao(self, db: Session, id: int, dados: TransacaoUpdate, user_id: int):
        """
        Atualização com Propagação (Cascata) APENAS PARA RECORRENTES.
        
        Regra:
        1. Recorrente (Netflix): Muda a atual e todas as futuras (plano mudou).
        2. Parcelada (TV): Muda APENAS a atual (desconto pontual na parcela).
        3. Pontual: Muda APENAS a atual.
        """
        # 1. Busca a transação original
        transacao = db.query(Transacao).filter(Transacao.id == id, Transacao.user_id == user_id).first()
        if not transacao:
            return None

        # Dados de referência
        grupo_id = transacao.id_grupo_recorrencia
        data_original = transacao.data
        tipo = transacao.tipo_recorrencia

        # 2. Atualiza a transação alvo
        update_data = dados.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(transacao, key, value)
            
        # 3. Propagação para o Futuro
        # [MODIFICADO] Só propaga se for estritamente 'recorrente'.
        # 'parcelada' agora é tratada como indivíduo, pois valores são contratuais fixos.
        campos_para_propagar = {
            k: v for k, v in update_data.items() 
            if k in ['valor', 'descricao', 'categoria_id']
        }

        if grupo_id and campos_para_propagar and tipo == 'recorrente':
            # Atualiza transações do mesmo grupo que possuem data maior que a atual
            db.query(Transacao).filter(
                Transacao.id_grupo_recorrencia == grupo_id,
                Transacao.user_id == user_id,
                Transacao.data > data_original
            ).update(campos_para_propagar, synchronize_session=False)

        db.commit()
        db.refresh(transacao)
        return transacao

financas_service = FinancasService()