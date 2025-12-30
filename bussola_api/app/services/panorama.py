"""
=======================================================================================
ARQUIVO: panorama.py (Serviço de Inteligência e Dashboards)
=======================================================================================

OBJETIVO:
    Atuar como um hub central de Business Intelligence (BI). Este serviço agrega dados
    de todos os outros módulos (Finanças, Agenda, Registros, Cofre) para gerar
    relatórios, KPIs e gráficos unificados.

PARTE DO SISTEMA:
    Backend / Service Layer / Analytics.

RESPONSABILIDADES:
    1. Calcular KPIs financeiros (Receita vs Despesa) baseados em filtros temporais.
    2. Monitorar a saúde da agenda (Compromissos pendentes, perdidos, próximos).
    3. Consolidar estatísticas de produtividade (Tarefas por prioridade).
    4. Gerar estruturas de dados formatadas especificamente para gráficos (Chart.js).
    5. Fornecer dados detalhados para modais de "Visão Geral" (Drill-down).

COMUNICAÇÃO:
    - Lê dados de TODOS os Models do sistema.
    - Não realiza escritas (apenas Leitura/Agregação).
    - Utilizado por: app.api.endpoints.panorama.

=======================================================================================
"""

from sqlalchemy.orm import Session
from sqlalchemy import func, case, and_, or_
from datetime import datetime
from dateutil.relativedelta import relativedelta

# Importação dos Models de todos os domínios para agregação
from app.models.financas import Transacao, Categoria
from app.models.agenda import Compromisso 
from app.models.registros import Anotacao, Tarefa, GrupoAnotacao
from app.models.cofre import Segredo 

class PanoramaService:
    
    def get_dashboard_data(self, db: Session, user_id: int, period: str = 'Mensal'):
        """
        Gera o payload principal do Dashboard (Home/Panorama).
        
        Lógica Temporal:
            Calcula o intervalo de datas (start_date até end_date) dinamicamente
            com base no filtro escolhido pelo usuário (Mensal, Trimestral, Semestral).
            O 'end_date' é sempre o início do mês seguinte para cobrir o mês atual inteiro.

        Segurança (Multi-tenancy):
            Todas as sub-queries aplicam estritamente o filtro `user_id`, garantindo
            que dados de um usuário nunca vazem para o dashboard de outro.
        """
        today = datetime.now()
        
        # Define o range de datas baseado no filtro
        end_date = (today.replace(day=1) + relativedelta(months=1)).replace(hour=0, minute=0, second=0)
        
        if period == 'Trimestral':
            # Retrocede 3 meses a partir do fim do mês atual
            start_date = (end_date - relativedelta(months=3))
        elif period == 'Semestral':
            # Retrocede 6 meses a partir do fim do mês atual
            start_date = (end_date - relativedelta(months=6))
        else: # Mensal (Padrão)
            start_date = today.replace(day=1, hour=0, minute=0, second=0)

        # ==============================================================================
        # 1. BLOCO DE FINANÇAS
        # ==============================================================================
        # Regra de Negócio: Consideramos 'Efetivadas' E 'Pendentes'.
        # Isso garante que o usuário veja o orçamento TOTAL do período, incluindo
        # contas recorrentes ou parceladas que vencem no futuro próximo.
        
        receita = db.query(func.sum(Transacao.valor)).join(Categoria).filter(
            Categoria.tipo == 'receita', 
            Transacao.user_id == user_id, # [SEGURANÇA] Isolamento de dados
            Transacao.data >= start_date, 
            Transacao.data < end_date
            # Filtro de status removido para incluir previsões
        ).scalar() or 0.0

        despesa = db.query(func.sum(Transacao.valor)).join(Categoria).filter(
            Categoria.tipo == 'despesa',
            Transacao.user_id == user_id, # [SEGURANÇA]
            Transacao.data >= start_date, 
            Transacao.data < end_date
            # Filtro de status removido para incluir previsões
        ).scalar() or 0.0

        # ==============================================================================
        # 2. BLOCO DE AGENDA (Compromissos)
        # ==============================================================================
        # Regra de Negócio:
        # - Realizados: Passado + Status diferente de Cancelado.
        # - Pendentes: Futuro (a partir de agora) até o fim do filtro.
        # - Perdidos: Passado + Status 'Pendente' (Usuário esqueceu de marcar como feito).
        
        # Realizados
        comp_realizados = db.query(func.count(Compromisso.id)).filter(
            Compromisso.user_id == user_id,
            Compromisso.data_hora >= start_date, 
            Compromisso.data_hora < today,
            Compromisso.status != 'Cancelado' 
        ).scalar() or 0

        # Pendentes (Futuros na janela selecionada)
        comp_pendentes = db.query(func.count(Compromisso.id)).filter(
            Compromisso.user_id == user_id,
            Compromisso.data_hora >= today,
            Compromisso.data_hora < end_date,
            Compromisso.status != 'Cancelado'
        ).scalar() or 0

        # Perdidos (Passados não concluídos)
        comp_perdidos = db.query(func.count(Compromisso.id)).filter(
            Compromisso.user_id == user_id,
            Compromisso.data_hora >= start_date,
            Compromisso.data_hora < today,
            Compromisso.status == 'Pendente' 
        ).scalar() or 0
        
        # Próximo Compromisso (Destaque no Dashboard)
        # Nota: Ignora o filtro de data final. Pega o próximo item real a partir de "agora".
        proximo_comp_obj = db.query(Compromisso).filter(
            Compromisso.user_id == user_id,
            Compromisso.data_hora >= today,
            Compromisso.status != 'Cancelado'
        ).order_by(Compromisso.data_hora.asc()).first()
        
        proximo_comp = None
        if proximo_comp_obj:
            proximo_comp = {
                "titulo": proximo_comp_obj.titulo,
                "data": proximo_comp_obj.data_hora, 
                "cor": getattr(proximo_comp_obj, 'cor', '#3b82f6') 
            }

        # ==============================================================================
        # 3. BLOCO DE REGISTROS (Produtividade)
        # ==============================================================================
        
        # Anotações: Volume de notas criadas no período.
        total_anotacoes = db.query(func.count(Anotacao.id)).filter(
            Anotacao.user_id == user_id,
            Anotacao.data_criacao >= start_date,
            Anotacao.data_criacao < end_date
        ).scalar() or 0
        
        # Tarefas Pendentes: Agrupadas por Prioridade (Crítica, Alta, Média, Baixa).
        # Útil para matriz de Eisenhower ou análise de urgência.
        tarefas_stats = db.query(
            Tarefa.prioridade, 
            func.count(Tarefa.id)
        ).filter(
            Tarefa.user_id == user_id,
            Tarefa.status != 'Concluído',
            Tarefa.data_criacao >= start_date, 
            Tarefa.data_criacao < end_date
        ).group_by(Tarefa.prioridade).all()
        
        t_dict = {prioridade: count for prioridade, count in tarefas_stats}
        
        tarefas_pendentes_detalhe = {
            "critica": t_dict.get('Crítica', 0),
            "alta": t_dict.get('Alta', 0),
            "media": t_dict.get('Média', 0),
            "baixa": t_dict.get('Baixa', 0)
        }
        
        # Tarefas Concluídas: KPI de entrega.
        # Regra complexa (OR):
        # 1. Tarefa tem data_conclusao E ela cai no período.
        # 2. OU Tarefa não tem data_conclusao (legado), então usamos data_criacao como proxy.
        total_tarefas_concluidas = db.query(func.count(Tarefa.id)).filter(
            Tarefa.user_id == user_id,
            Tarefa.status == 'Concluído',
            or_(
                and_(Tarefa.data_conclusao != None, Tarefa.data_conclusao >= start_date, Tarefa.data_conclusao < end_date),
                and_(Tarefa.data_conclusao == None, Tarefa.data_criacao >= start_date, Tarefa.data_criacao < end_date)
            )
        ).scalar() or 0

        # ==============================================================================
        # 4. BLOCO DO COFRE (Segurança de Senhas)
        # ==============================================================================
        # Regra: Analisa a validade dos segredos (Cartões, tokens) comparando com hoje.
        # O try/except garante que falhas na tabela de segredos não quebrem o dashboard inteiro.
        try:
            chaves_ativas = db.query(func.count(Segredo.id)).filter(
                Segredo.user_id == user_id,
                or_(Segredo.data_expiracao == None, Segredo.data_expiracao >= today)
            ).scalar() or 0
            
            chaves_expiradas = db.query(func.count(Segredo.id)).filter(
                Segredo.user_id == user_id,
                Segredo.data_expiracao < today
            ).scalar() or 0
        except:
            chaves_ativas = 0
            chaves_expiradas = 0

        # ==============================================================================
        # MONTAGEM FINAL DOS KPIS
        # ==============================================================================
        kpis = {
            "receita_mes": receita,
            "despesa_mes": despesa,
            "balanco_mes": receita - despesa, # Saldo líquido do período
            "compromissos_realizados": comp_realizados,
            "compromissos_pendentes": comp_pendentes,
            "compromissos_perdidos": comp_perdidos,
            "proximo_compromisso": proximo_comp,
            "total_anotacoes": total_anotacoes,
            "tarefas_pendentes": tarefas_pendentes_detalhe,
            "tarefas_concluidas": total_tarefas_concluidas,
            "chaves_ativas": chaves_ativas,
            "chaves_expiradas": chaves_expiradas
        }

        # ==============================================================================
        # 5. GERAÇÃO DE GRÁFICOS (Aggregation Layer)
        # ==============================================================================
        
        # Gráfico de Rosca (Donut): Gastos por Categoria
        # Inclui Pendentes e Efetivadas para visão completa do orçamento.
        gastos_cat = db.query(Categoria.nome, Categoria.cor, func.sum(Transacao.valor))\
            .join(Transacao).filter(
                Categoria.tipo == 'despesa',
                Transacao.user_id == user_id,
                Transacao.data >= start_date,
                Transacao.data < end_date
            ).group_by(Categoria.id).all()
        
        # Separação de listas para bibliotecas de charts (Chart.js / ApexCharts)
        rosca_labels = [g[0] for g in gastos_cat]
        rosca_colors = [g[1] for g in gastos_cat]
        rosca_data = [g[2] for g in gastos_cat]

        # Gráfico de Linha: Evolução Financeira (Últimos 6 meses fixos)
        evolucao_labels, evol_rec, evol_desp = [], [], []
        
        for i in range(5, -1, -1):
            mes_alvo = today - relativedelta(months=i)
            ini = mes_alvo.replace(day=1, hour=0, minute=0, second=0)
            fim = ini + relativedelta(months=1)
            
            meses_pt = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
            evolucao_labels.append(f"{meses_pt[ini.month-1]}/{ini.year % 100}")

            r = db.query(func.sum(Transacao.valor)).join(Categoria).filter(
                Categoria.tipo == 'receita', 
                Transacao.user_id == user_id,
                Transacao.data >= ini, Transacao.data < fim
            ).scalar() or 0.0
            
            d = db.query(func.sum(Transacao.valor)).join(Categoria).filter(
                Categoria.tipo == 'despesa', 
                Transacao.user_id == user_id,
                Transacao.data >= ini, Transacao.data < fim
            ).scalar() or 0.0
            
            evol_rec.append(r)
            evol_desp.append(d)

        # Gráfico de Barras: Gasto Semanal (Placeholder de estrutura)
        semanal_labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
        semanal_data = [0, 0, 0, 0, 0, 0, 0]
        
        # Categorias auxiliares para filtros no frontend
        cats_filtro = db.query(Categoria).filter(
            Categoria.tipo == 'despesa',
            Categoria.user_id == user_id
        ).all()

        return {
            "kpis": kpis,
            "gastos_por_categoria": {"labels": rosca_labels, "data": rosca_data, "colors": rosca_colors},
            "evolucao_mensal_receita": evol_rec,
            "evolucao_mensal_despesa": evol_desp,
            "evolucao_labels": evolucao_labels,
            "gasto_semanal": {"labels": semanal_labels, "data": semanal_data},
            "categorias_para_filtro": cats_filtro
        }

    # ==============================================================================
    # MÉTODOS DE SUPORTE AOS MODAIS (DRILL-DOWN)
    # ==============================================================================

    def get_provisoes_data(self, db: Session, user_id: int):
        """
        Retorna transações futuras para o modal de Provisões.
        Regra: Itens 'Pendente' (qualquer data) OU Itens futuros (mesmo se já efetivados).
        """
        today = datetime.now()
        
        transacoes = db.query(Transacao).join(Categoria).filter(
            Transacao.user_id == user_id,
            or_(Transacao.status == 'Pendente', Transacao.data > today)
        ).order_by(Transacao.data.asc()).all()
        
        resultado = []
        for t in transacoes:
            # Formatação do tipo para exibição amigável
            tipo = "Pontual"
            
            # [CORREÇÃO] Verifica corretamente o tipo_recorrencia
            if t.tipo_recorrencia == 'recorrente':
                tipo = "Recorrente"
            elif t.tipo_recorrencia == 'parcelada':
                tipo = f"Parcela {t.parcela_atual}/{t.total_parcelas}"
            
            resultado.append({
                "id": t.id,
                "descricao": t.descricao,
                "valor": t.valor,
                "data_vencimento": t.data,
                "categoria_nome": t.categoria.nome,
                "categoria_cor": t.categoria.cor,
                "tipo_recorrencia": tipo,
                "status": t.status
            })
        return resultado

    def get_roteiro_data(self, db: Session, user_id: int):
        """
        Retorna TODOS os compromissos ativos (não cancelados) para visualização em Lista/Timeline.
        """
        compromissos = db.query(Compromisso).filter(
            Compromisso.user_id == user_id,
            Compromisso.status != 'Cancelado'
        ).all()

        res = []
        for c in compromissos:
            res.append({
                "id": c.id,
                "titulo": c.titulo,
                "data_inicio": c.data_hora,
                "data_fim": c.data_hora,
                "tipo": "Compromisso",
                "cor": getattr(c, 'cor', '#ccc'),
                "status": c.status
            })
        return res

    def get_registros_resumo_data(self, db: Session, user_id: int):
        """
        Gera um feed misto de Tarefas e Anotações recentes para o modal de produtividade.
        """
        # Notas: Pega as 10 mais recentes
        notas = db.query(Anotacao).join(GrupoAnotacao, isouter=True).filter(
            Anotacao.user_id == user_id
        ).order_by(Anotacao.data_criacao.desc()).limit(10).all()
        
        # Tarefas: Retorna todas
        tarefas = db.query(Tarefa).filter(
            Tarefa.user_id == user_id
        ).all()
        
        res = []
        # Normalização de dados para lista unificada
        for t in tarefas:
            res.append({
                "id": t.id,
                "titulo": t.titulo,
                "tipo": "Tarefa",
                "grupo_ou_prioridade": t.prioridade,
                "data_criacao": t.data_criacao,
                "status": t.status
            })
            
        for n in notas:
            grupo_nome = n.grupo.nome if n.grupo else "Sem Grupo"
            res.append({
                "id": n.id,
                "titulo": n.titulo,
                "tipo": "Anotação",
                "grupo_ou_prioridade": grupo_nome,
                "data_criacao": n.data_criacao,
                "status": "-"
            })
            
        return res

    def get_category_history(self, db: Session, category_id: int, user_id: int):
        """
        Dados para o gráfico "Sparkline" (minigráfico) de cada categoria.
        
        Segurança:
            Verifica explicitamente se a categoria pertence ao usuário antes de buscar
            o histórico, prevenindo enumeração ou acesso a dados de outros usuários.
        """
        labels = []
        data = []
        today = datetime.now()

        # [SEGURANÇA EXTRA] Validação de propriedade da categoria
        cat_check = db.query(Categoria).filter(Categoria.id == category_id, Categoria.user_id == user_id).first()
        if not cat_check:
            return {"labels": [], "data": []}

        # Gera histórico dos últimos 6 meses para esta categoria específica
        for i in range(5, -1, -1):
            mes_alvo = today - relativedelta(months=i)
            ini = mes_alvo.replace(day=1, hour=0, minute=0, second=0)
            fim = ini + relativedelta(months=1)
            
            meses_pt = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
            labels.append(f"{meses_pt[ini.month-1]}/{ini.year % 100}")

            total = db.query(func.sum(Transacao.valor)).filter(
                Transacao.categoria_id == category_id,
                Transacao.user_id == user_id,
                Transacao.data >= ini,
                Transacao.data < fim
                # Sem filtro de status para incluir previsões da categoria
            ).scalar() or 0.0
            
            data.append(total)
            
        return {"labels": labels, "data": data}

panorama_service = PanoramaService()