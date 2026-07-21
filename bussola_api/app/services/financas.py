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

from app.models.financas import Transacao, Categoria
from app.models.caixa import AjusteCaixa
from app.schemas.financas import TransacaoCreate, TransacaoUpdate
from app.schemas.caixa import AjusteCaixaCreate, AjusteCaixaUpdate

# Catálogo de ícones FontAwesome disponíveis para escolha no frontend
ICONES_DISPONIVEIS = [
    # Alimentação
    "fa-solid fa-utensils", "fa-solid fa-burger", "fa-solid fa-mug-hot",
    # Moradia & Contas
    "fa-solid fa-house", "fa-solid fa-lightbulb", "fa-solid fa-wifi",
    "fa-solid fa-droplet", "fa-solid fa-fire", "fa-solid fa-wrench",
    # Transporte
    "fa-solid fa-car", "fa-solid fa-gas-pump", "fa-solid fa-bus",
    "fa-solid fa-plane",
    # Compras & Vestuário
    "fa-solid fa-cart-shopping", "fa-solid fa-shirt", "fa-solid fa-bag-shopping",
    # Saúde & Bem-estar
    "fa-solid fa-pills", "fa-solid fa-heart-pulse", "fa-solid fa-dumbbell",
    # Lazer & Entretenimento
    "fa-solid fa-film", "fa-solid fa-gamepad", "fa-solid fa-music",
    "fa-solid fa-book", "fa-solid fa-tv",
    # Educação & Trabalho
    "fa-solid fa-graduation-cap", "fa-solid fa-briefcase", "fa-solid fa-laptop",
    # Finanças & Receitas
    "fa-solid fa-dollar-sign", "fa-solid fa-piggy-bank", "fa-solid fa-coins",
]

# Paleta fixa de cores para categorias (determinística — não muda a cada carregamento)
CORES_DISPONIVEIS = [
    # Vermelhos / Rosas
    "#ef4444", "#f87171", "#ec4899", "#f43f5e",
    # Laranjas / Amarelos
    "#f97316", "#fb923c", "#eab308", "#facc15",
    # Verdes
    "#22c55e", "#10b981", "#4ade80",
    # Azuis / Ciano
    "#3b82f6", "#60a5fa", "#06b6d4", "#0ea5e9",
    # Roxos / Índigo
    "#8b5cf6", "#6366f1", "#a78bfa",
    # Rosa / Fúcsia
    "#d946ef", "#c026d3",
    # Terrosos
    "#a16207", "#92400e",
    # Neutros
    "#64748b", "#6b7280",
    # Extras
    "#14b8a6", "#84cc16", "#f59e0b", "#22d3ee",
]

class FinancasService:

    def gerar_paleta_cores(self):
        """Retorna paleta fixa de cores para categorias."""
        return CORES_DISPONIVEIS

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
            cat.media_valor = (stats[1] or 0) / 100  # func.avg não herda MoneyCents → volta centavos
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
            cat.media_valor = (stats[1] or 0) / 100  # func.avg não herda MoneyCents → volta centavos
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

        # [METAS] Resumo de patrimônio: Caixa acumulado (saldo inicial + receitas −
        # despesas efetivadas de todos os tempos), disponível = caixa − guardado.
        from app.services.metas import metas_service  # import local evita ciclo de import
        _caixa = self.calcular_caixa(db, user_id)
        _resumo = metas_service.calcular_resumo(db, user_id, _caixa)
        _grupos_cofre = metas_service.listar_grupos_cofre(db, user_id)

        return {
            "categorias_despesa": cats_despesa,
            "categorias_receita": cats_receita,
            "transacoes_pontuais": pontuais_map,
            "transacoes_recorrentes": recorrentes_map,
            "icones_disponiveis": ICONES_DISPONIVEIS,
            "cores_disponiveis": self.gerar_paleta_cores(),
            "resumo_patrimonio": _resumo,
            "transacoes_cofre": _grupos_cofre,
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
                    tipo_pagamento=dados.tipo_pagamento,
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
        Atualização com propagação POR NATUREZA DO CAMPO em grupos
        (parcelada/recorrente):

        - categoria_id / descricao: reclassificação/renome → propaga ao GRUPO
          INTEIRO (passado + futuro), automaticamente.
        - valor: aplica na alvo; se `escopo_valor == 'futuras'`, também nas
          ocorrências posteriores (data > data original). Em parceladas, o
          `valor_total_parcelamento` é recalculado como a soma real das parcelas.
        - tipo_pagamento: aplica na alvo; propaga conforme `escopo_tipo_pagamento`
          ('apenas' | 'futuras' | 'todas' — esta última inclui as anteriores).
        - data / status / recorrencia_encerrada: só na ocorrência alvo.

        Transações 'pontual' (ou sem grupo) só alteram a própria linha.
        """
        # 1. Busca a transação original
        transacao = db.query(Transacao).filter(Transacao.id == id, Transacao.user_id == user_id).first()
        if not transacao:
            return None

        # Dados de referência
        grupo_id = transacao.id_grupo_recorrencia
        data_original = transacao.data
        tipo = transacao.tipo_recorrencia
        is_grupo = bool(grupo_id) and tipo in ('recorrente', 'parcelada')

        # `escopo_valor`/`escopo_tipo_pagamento` são só de controle — não viram atributo.
        update_data = dados.model_dump(exclude_unset=True)
        escopo_valor = update_data.pop('escopo_valor', 'apenas')
        escopo_tipo_pagamento = update_data.pop('escopo_tipo_pagamento', 'apenas')

        # 2. Atualiza a transação alvo (todos os campos enviados)
        for key, value in update_data.items():
            setattr(transacao, key, value)

        if is_grupo:
            # 3a. Atributos de classificação → grupo inteiro (passado + futuro).
            atributos_grupo = {
                k: update_data[k] for k in ('categoria_id', 'descricao')
                if k in update_data
            }
            if atributos_grupo:
                db.query(Transacao).filter(
                    Transacao.id_grupo_recorrencia == grupo_id,
                    Transacao.user_id == user_id,
                    Transacao.id != transacao.id,
                ).update(atributos_grupo, synchronize_session=False)

            # 3b. Valor → alvo (já aplicada) + posteriores se escopo 'futuras'.
            if 'valor' in update_data and escopo_valor == 'futuras':
                db.query(Transacao).filter(
                    Transacao.id_grupo_recorrencia == grupo_id,
                    Transacao.user_id == user_id,
                    Transacao.data > data_original,
                ).update({'valor': update_data['valor']}, synchronize_session=False)

            # 3b'. Forma de pagamento → alvo (já aplicada) + escopo escolhido.
            if 'tipo_pagamento' in update_data and escopo_tipo_pagamento != 'apenas':
                q_tp = db.query(Transacao).filter(
                    Transacao.id_grupo_recorrencia == grupo_id,
                    Transacao.user_id == user_id,
                    Transacao.id != transacao.id,
                )
                if escopo_tipo_pagamento == 'futuras':
                    q_tp = q_tp.filter(Transacao.data > data_original)
                # 'todas' → sem filtro de data (inclui anteriores).
                q_tp.update(
                    {'tipo_pagamento': update_data['tipo_pagamento']},
                    synchronize_session=False,
                )

            # 3c. Parcelada: total exibido = soma real das parcelas do grupo.
            if tipo == 'parcelada' and 'valor' in update_data:
                db.flush()  # garante que os updates acima entrem na soma
                novo_total = db.query(func.sum(Transacao.valor)).filter(
                    Transacao.id_grupo_recorrencia == grupo_id,
                    Transacao.user_id == user_id,
                ).scalar() or 0.0
                db.query(Transacao).filter(
                    Transacao.id_grupo_recorrencia == grupo_id,
                    Transacao.user_id == user_id,
                ).update({'valor_total_parcelamento': novo_total}, synchronize_session=False)

        db.commit()
        db.refresh(transacao)
        return transacao

    # ----------------------------------------------------------------------------------
    # CAIXA ACUMULADO + AJUSTES DE CAIXA (saldo inicial / dinheiro histórico)
    # ----------------------------------------------------------------------------------
    def calcular_caixa(self, db: Session, user_id: int) -> float:
        """
        Caixa (patrimônio acumulado) =
            Σ ajustes(entrada − saída)
            + Σ receitas efetivadas (todos os tempos)
            − Σ despesas efetivadas (todos os tempos).

        Movimentações de cofrinho NÃO entram (transferência neutra). Pendentes/
        futuras não entram (só 'Efetivada'). func.sum(MoneyCents) volta em reais.
        """
        receita = db.query(func.sum(Transacao.valor)).join(Categoria).filter(
            Categoria.tipo == 'receita',
            Transacao.user_id == user_id,
            Transacao.status == 'Efetivada',
        ).scalar() or 0.0
        despesa = db.query(func.sum(Transacao.valor)).join(Categoria).filter(
            Categoria.tipo == 'despesa',
            Transacao.user_id == user_id,
            Transacao.status == 'Efetivada',
        ).scalar() or 0.0

        entradas = db.query(func.sum(AjusteCaixa.valor)).filter(
            AjusteCaixa.user_id == user_id, AjusteCaixa.tipo == 'entrada',
        ).scalar() or 0.0
        saidas = db.query(func.sum(AjusteCaixa.valor)).filter(
            AjusteCaixa.user_id == user_id, AjusteCaixa.tipo == 'saida',
        ).scalar() or 0.0

        return round((entradas - saidas) + receita - despesa, 2)

    def listar_ajustes(self, db: Session, user_id: int):
        return db.query(AjusteCaixa).filter(
            AjusteCaixa.user_id == user_id
        ).order_by(desc(AjusteCaixa.data)).all()

    def criar_ajuste(self, db: Session, dados: AjusteCaixaCreate, user_id: int) -> AjusteCaixa:
        ajuste = AjusteCaixa(
            user_id=user_id,
            tipo=dados.tipo.value if hasattr(dados.tipo, 'value') else dados.tipo,
            valor=round(dados.valor, 2),
            data=dados.data or datetime.now(),
            observacao=dados.observacao,
        )
        db.add(ajuste)
        db.commit()
        db.refresh(ajuste)
        return ajuste

    def atualizar_ajuste(self, db: Session, ajuste_id: int, dados: AjusteCaixaUpdate, user_id: int):
        ajuste = db.query(AjusteCaixa).filter(
            AjusteCaixa.id == ajuste_id, AjusteCaixa.user_id == user_id
        ).first()
        if not ajuste:
            return None
        update_data = dados.model_dump(exclude_unset=True)
        if 'tipo' in update_data and update_data['tipo'] is not None:
            t = update_data['tipo']
            update_data['tipo'] = t.value if hasattr(t, 'value') else t
        if 'valor' in update_data and update_data['valor'] is not None:
            update_data['valor'] = round(update_data['valor'], 2)
        for key, value in update_data.items():
            setattr(ajuste, key, value)
        db.commit()
        db.refresh(ajuste)
        return ajuste

    def deletar_ajuste(self, db: Session, ajuste_id: int, user_id: int) -> bool:
        ajuste = db.query(AjusteCaixa).filter(
            AjusteCaixa.id == ajuste_id, AjusteCaixa.user_id == user_id
        ).first()
        if not ajuste:
            return False
        db.delete(ajuste)
        db.commit()
        return True

financas_service = FinancasService()