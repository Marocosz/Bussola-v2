import uuid
from datetime import datetime
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, desc
from collections import defaultdict
import random

from app.models.financas import Transacao, Categoria # Assumindo que você já migrou os Models do SQLAlchemy
from app.schemas.financas import TransacaoCreate, TipoRecorrencia

# Lista de ícones (pode ser movida para um arquivo de constantes depois)
ICONES_DISPONIVEIS = [
    "fa-solid fa-utensils", "fa-solid fa-burger", "fa-solid fa-cart-shopping",
    "fa-solid fa-house", "fa-solid fa-lightbulb", "fa-solid fa-wifi",
    "fa-solid fa-car", "fa-solid fa-gas-pump", "fa-solid fa-film",
    "fa-solid fa-gamepad", "fa-solid fa-shirt", "fa-solid fa-pills",
    "fa-solid fa-dollar-sign", "fa-solid fa-graduation-cap"
]

class FinancasService:
    
    def gerar_paleta_cores(self, n=20):
        # Gera cores hexadecimais aleatórias (simplificado)
        cores = []
        for _ in range(n):
            color = "#{:06x}".format(random.randint(0, 0xFFFFFF))
            cores.append(color)
        return cores

    def gerar_transacoes_futuras(self, db: Session):
        """
        Lógica portada do Flask: Verifica recorrências e cria as próximas instâncias.
        """
        today_date = datetime.now().date()

        grupos = db.query(Transacao.id_grupo_recorrencia).filter(
            Transacao.tipo_recorrencia.in_(['recorrente', 'parcelada'])
        ).distinct().all()

        for grupo_tuple in grupos:
            grupo_id = grupo_tuple[0]
            if not grupo_id: continue

            ultima = db.query(Transacao).filter_by(id_grupo_recorrencia=grupo_id).order_by(Transacao.data.desc()).first()
            if not ultima: continue

            # Lógica Recorrente (Assinatura)
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
                        id_grupo_recorrencia=grupo_id, status='Pendente', frequencia=frequencia
                    )
                    db.add(nova)
                    # Incremento loop
                    if frequencia == 'semanal': proximo_vencimento += relativedelta(weeks=1)
                    elif frequencia == 'mensal': proximo_vencimento += relativedelta(months=1)
                    elif frequencia == 'anual': proximo_vencimento += relativedelta(years=1)

            # Lógica Parcelada
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
            # Pontuais já nascem efetivadas na lógica antiga, ou pendentes? 
            # O antigo forçava 'Efetivada'. Vamos manter padrão 'Pendente' se não especificado, ou seguir o form.
            if not dados.status: nova.status = 'Efetivada' 
            db.add(nova)
            db.commit()
            db.refresh(nova)
            return nova

        elif dados.tipo_recorrencia == 'parcelada':
            grupo_id = uuid.uuid4().hex
            # Cria a primeira parcela
            primeira = Transacao(**dados.model_dump())
            primeira.parcela_atual = 1
            primeira.id_grupo_recorrencia = grupo_id
            # Logica antiga: parcelas futuras nascem Pendentes. A primeira depende do input.
            db.add(primeira)
            db.commit()
            return primeira

        elif dados.tipo_recorrencia == 'recorrente':
            grupo_id = uuid.uuid4().hex
            nova = Transacao(**dados.model_dump())
            nova.id_grupo_recorrencia = grupo_id
            db.add(nova)
            db.commit()
            return nova

financas_service = FinancasService()