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
    
    def get_dashboard_data(self, db: Session, user_id: int, month: int = None, year: int = None, period_length: int = 1):
        """
        Gera o payload principal do Dashboard (Home/Panorama).
        
        Lógica Temporal (Atualizada):
            Recebe mês/ano de início e a duração do período (1, 3 ou 6 meses).
            Se não fornecido, usa o mês/ano atual como padrão.

        Segurança (Multi-tenancy):
            Todas as sub-queries aplicam estritamente o filtro `user_id`, garantindo
            que dados de um usuário nunca vazem para o dashboard de outro.
        """
        today = datetime.now()
        
        # Define Data de Início
        if month and year:
            start_date = datetime(year, month, 1)
        else:
            start_date = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            
        # Define Data de Fim (Start + Duração)
        # Ex: Se start=Jan e length=3 (Trimestral) -> End=Abril 1st (Jan+3 meses)
        end_date = start_date + relativedelta(months=period_length)

        # ==============================================================================
        # 1. BLOCO DE FINANÇAS
        # ==============================================================================
        # Regra de Negócio: Consideramos 'Efetivadas' E 'Pendentes'.
        
        receita = db.query(func.sum(Transacao.valor)).join(Categoria).filter(
            Categoria.tipo == 'receita', 
            Transacao.user_id == user_id, # [SEGURANÇA] Isolamento de dados
            Transacao.data >= start_date, 
            Transacao.data < end_date
        ).scalar() or 0.0

        despesa = db.query(func.sum(Transacao.valor)).join(Categoria).filter(
            Categoria.tipo == 'despesa',
            Transacao.user_id == user_id, # [SEGURANÇA]
            Transacao.data >= start_date, 
            Transacao.data < end_date
        ).scalar() or 0.0

        # ==============================================================================
        # 2. BLOCO DE AGENDA (Compromissos)
        # ==============================================================================
        
        # Realizados
        comp_realizados = db.query(func.count(Compromisso.id)).filter(
            Compromisso.user_id == user_id,
            Compromisso.data_hora >= start_date, 
            Compromisso.data_hora < today, # Realizados são sempre no passado relativo a hoje
            Compromisso.status != 'Cancelado' 
        ).scalar() or 0

        # Pendentes (Futuros na janela selecionada ou "Agora" se a janela incluir hoje)
        # Ajuste: Pendentes dentro da janela de análise selecionada
        comp_pendentes = db.query(func.count(Compromisso.id)).filter(
            Compromisso.user_id == user_id,
            Compromisso.data_hora >= start_date, # Dentro da janela
            Compromisso.data_hora < end_date,
            Compromisso.status == 'Pendente' # Status específico
        ).scalar() or 0

        # Perdidos (Passados não concluídos na janela)
        comp_perdidos = db.query(func.count(Compromisso.id)).filter(
            Compromisso.user_id == user_id,
            Compromisso.data_hora >= start_date,
            Compromisso.data_hora < today, # Já passou de hoje
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
        
        # Tarefas Pendentes
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
        
        # Tarefas Concluídas
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
            "balanco_mes": receita - despesa, 
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
        gastos_cat = db.query(Categoria.nome, Categoria.cor, func.sum(Transacao.valor))\
            .join(Transacao).filter(
                Categoria.tipo == 'despesa',
                Transacao.user_id == user_id,
                Transacao.data >= start_date,
                Transacao.data < end_date
            ).group_by(Categoria.id).all()
        
        rosca_labels = [g[0] for g in gastos_cat]
        rosca_colors = [g[1] for g in gastos_cat]
        rosca_data = [g[2] for g in gastos_cat]

        # Gráfico de Linha: Evolução Financeira (Últimos 6 meses fixos relativos a hoje, ou adaptável)
        # Mantendo últimos 6 meses a partir de HOJE para dar contexto histórico geral
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

        # Gráfico de Barras: Gasto Semanal (Média Real)
        # Lógica: Agrupa todas as despesas do período pelo dia da semana
        # Python: 0=Segunda, 6=Domingo. ChartJS (nosso label): 0=Dom, 1=Seg...
        semanal_map = {0: 0.0, 1: 0.0, 2: 0.0, 3: 0.0, 4: 0.0, 5: 0.0, 6: 0.0}
        
        todas_despesas = db.query(Transacao.data, Transacao.valor).join(Categoria).filter(
            Categoria.tipo == 'despesa',
            Transacao.user_id == user_id,
            Transacao.data >= start_date,
            Transacao.data < end_date
        ).all()

        for t in todas_despesas:
            # weekday(): 0=Seg, 6=Dom
            dia_semana_py = t.data.weekday()
            
            # Conversão para formato [Dom, Seg, Ter...]
            # Se py=6(Dom) -> map=0. Se py=0(Seg) -> map=1
            idx_chart = 0 if dia_semana_py == 6 else dia_semana_py + 1
            semanal_map[idx_chart] += t.valor

        semanal_labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
        semanal_data = [semanal_map[i] for i in range(7)]
        
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
            tipo = "Pontual"
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