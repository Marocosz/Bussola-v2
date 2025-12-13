import uuid
from datetime import datetime
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, desc
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

    # --- CORREÇÃO AQUI ---
    def get_or_create_indefinida(self, db: Session, tipo: str) -> Categoria:
        """
        Busca ou cria uma categoria 'Indefinida' ESPECÍFICA para o tipo.
        Usa nomes distintos para não quebrar a constraint UNIQUE do banco.
        """
        # Ex: "Indefinida (Despesa)" ou "Indefinida (Receita)"
        nome_padrao = f"Indefinida ({tipo.capitalize()})"
        
        cat = db.query(Categoria).filter(
            Categoria.nome == nome_padrao,
            Categoria.tipo == tipo
        ).first()

        if not cat:
            # Tenta buscar só por "Indefinida" caso tenha sobrado da tentativa anterior errada
            # para evitar duplicidade ou erro se você limpar o banco manualmente
            cat_legacy = db.query(Categoria).filter(
                Categoria.nome == "Indefinida", 
                Categoria.tipo == tipo
            ).first()
            
            if cat_legacy:
                # Atualiza a antiga para o novo padrão
                cat_legacy.nome = nome_padrao
                db.commit()
                db.refresh(cat_legacy)
                return cat_legacy

            # Cria nova se não existir nada
            cat = Categoria(
                nome=nome_padrao,
                tipo=tipo,
                icone="fa-solid fa-circle-question", 
                cor="#94a3b8", # Cinza
                meta_limite=0
            )
            db.add(cat)
            db.commit()
            db.refresh(cat)
        
        return cat

    def gerar_transacoes_futuras(self, db: Session):
        today_date = datetime.now().date()

        grupos = db.query(Transacao.id_grupo_recorrencia).filter(
            Transacao.tipo_recorrencia.in_(['recorrente', 'parcelada'])
        ).distinct().all()

        for grupo_tuple in grupos:
            grupo_id = grupo_tuple[0]
            if not grupo_id: continue

            ultima = db.query(Transacao).filter_by(id_grupo_recorrencia=grupo_id).order_by(Transacao.data.desc()).first()
            if not ultima: continue

            if ultima.tipo_recorrencia == 'recorrente':
                proximo_vencimento = ultima.data
                frequencia = ultima.frequencia
                
                if frequencia == 'semanal': proximo_vencimento += relativedelta(weeks=1)
                elif frequencia == 'mensal': proximo_vencimento += relativedelta(months=1)
                elif frequencia == 'anual': proximo_vencimento += relativedelta(years=1)

                while proximo_vencimento.date() <= today_date:
                    nova = Transacao(
                        descricao=ultima.descricao, valor=ultima.valor, data=proximo_vencimento,
                        categoria_id=ultima.categoria_id, tipo_recorrencia='recorrente',
                        id_grupo_recorrencia=grupo_id, status='Pendente', frequencia=frequencia
                    )
                    db.add(nova)
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
                        id_grupo_recorrencia=grupo_id, status='Pendente'
                    )
                    db.add(nova)
                    prox_vencimento += relativedelta(months=1)
                    prox_parcela += 1
        
        db.commit()

    def criar_transacao(self, db: Session, dados: TransacaoCreate):
        if dados.tipo_recorrencia == 'pontual':
            nova = Transacao(**dados.model_dump())
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
                    status=dados.status or 'Pendente'
                )
                
                db.add(nova)
                
                if i == 1:
                    primeira_criada = nova

            db.commit()
            db.refresh(primeira_criada)
            return primeira_criada

        elif dados.tipo_recorrencia == 'recorrente':
            grupo_id = uuid.uuid4().hex
            nova = Transacao(**dados.model_dump())
            nova.id_grupo_recorrencia = grupo_id
            db.add(nova)
            db.commit()
            return nova

    def atualizar_transacao(self, db: Session, id: int, dados: TransacaoUpdate):
        transacao = db.query(Transacao).get(id)
        if not transacao:
            return None
        
        update_data = dados.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(transacao, key, value)
            
        db.commit()
        db.refresh(transacao)
        return transacao

financas_service = FinancasService()