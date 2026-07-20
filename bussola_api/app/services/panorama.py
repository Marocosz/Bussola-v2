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
    
    def get_dashboard_data(self, db: Session, user_id: int, start_date: datetime = None, end_date: datetime = None):
        """
        Gera o payload principal do Dashboard (Home/Panorama).

        Lógica Temporal (Atualizada):
            Recebe um intervalo [start_date, end_date) livre (presets ou personalizado,
            estilo Provisões). Se não fornecido, usa o mês atual como padrão.
            O fim é EXCLUSIVO (usa `< end_date`).

        Segurança (Multi-tenancy):
            Todas as sub-queries aplicam estritamente o filtro `user_id`, garantindo
            que dados de um usuário nunca vazem para o dashboard de outro.
        """
        today = datetime.now()

        if not start_date:
            start_date = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if not end_date:
            end_date = start_date + relativedelta(months=1)

        # ==============================================================================
        # 1. BLOCO DE FINANÇAS
        # ==============================================================================
        # [P0] Só EFETIVADAS — sincroniza com o header de Finanças (total_ganho/gasto),
        # que conta apenas Efetivada. Pendentes/futuras aparecem em Provisões/forecast.

        receita = db.query(func.sum(Transacao.valor)).join(Categoria).filter(
            Categoria.tipo == 'receita',
            Transacao.user_id == user_id,  # [SEGURANÇA] Isolamento de dados
            Transacao.status == 'Efetivada',
            Transacao.data >= start_date,
            Transacao.data < end_date
        ).scalar() or 0.0

        despesa = db.query(func.sum(Transacao.valor)).join(Categoria).filter(
            Categoria.tipo == 'despesa',
            Transacao.user_id == user_id,  # [SEGURANÇA]
            Transacao.status == 'Efetivada',
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
        # FORECAST (P0) — só quando HOJE ∈ [start, end). Usa ritmo realizado +
        # expõe compromissos já conhecidos no resto do período. Período fechado → None.
        # ==============================================================================
        forecast = None
        if start_date <= today < end_date:
            despesa_ate_hoje = db.query(func.sum(Transacao.valor)).join(Categoria).filter(
                Categoria.tipo == 'despesa', Transacao.user_id == user_id,
                Transacao.status == 'Efetivada',
                Transacao.data >= start_date, Transacao.data <= today,
            ).scalar() or 0.0
            conhecido_pendente = db.query(func.sum(Transacao.valor)).join(Categoria).filter(
                Categoria.tipo == 'despesa', Transacao.user_id == user_id,
                Transacao.status == 'Pendente',
                Transacao.data > today, Transacao.data < end_date,
            ).scalar() or 0.0
            elapsed = max(1, (today - start_date).days + 1)
            total = max(elapsed, (end_date - start_date).days)
            projetado = round((despesa_ate_hoje / elapsed) * total, 2)
            forecast = {
                "elapsed_days": elapsed,
                "total_days": total,
                "realizado": round(despesa_ate_hoje, 2),
                "projetado": projetado,
                "conhecido_pendente": round(conhecido_pendente, 2),
                "status": "danger" if projetado > receita else "safe",
            }

        # ==============================================================================
        # MONTAGEM FINAL DOS KPIS
        # ==============================================================================
        # Caixa acumulado (patrimônio): saldo inicial + receitas − despesas
        # efetivadas de todos os tempos. Não é mensal (independe da janela).
        from app.services.financas import financas_service
        from app.models.caixa import AjusteCaixa
        caixa = financas_service.calcular_caixa(db, user_id)

        kpis = {
            "receita_mes": receita,
            "despesa_mes": despesa,
            "balanco_mes": receita - despesa,
            "caixa": caixa,
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
        # 5. GERAÇÃO DE GRÁFICOS (Aggregation Layer) — tudo EFETIVADA (realizado)
        # ==============================================================================
        meses_pt = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

        def _por_categoria(tipo, top_n=8):
            rows = db.query(Categoria.nome, Categoria.cor, func.sum(Transacao.valor))\
                .join(Transacao).filter(
                    Categoria.tipo == tipo, Transacao.user_id == user_id,
                    Transacao.status == 'Efetivada',
                    Transacao.data >= start_date, Transacao.data < end_date,
                ).group_by(Categoria.id).all()
            rows = [(n, c, float(v or 0.0)) for (n, c, v) in rows if (v or 0) > 0]
            rows.sort(key=lambda r: r[2], reverse=True)
            if len(rows) > top_n:
                resto = sum(r[2] for r in rows[top_n:])
                rows = rows[:top_n] + [("Outros", "#94a3b8", resto)]
            return {"labels": [r[0] for r in rows], "colors": [r[1] for r in rows], "data": [r[2] for r in rows]}

        gastos_por_categoria = _por_categoria('despesa')
        receitas_por_categoria = _por_categoria('receita')

        # --- Tendência: 12 meses terminando no mês do fim da janela (ou hoje) ---
        # caixa_real[i] = patrimônio REAL no fim de cada mês (baseline + acumulado),
        # não uma soma-corrente que começa do zero.
        anchor = today if today >= end_date else end_date
        anchor_ini = anchor.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        win_start = anchor_ini - relativedelta(months=11)

        def _sum_tx(tipo, ini, fim):
            q = db.query(func.sum(Transacao.valor)).join(Categoria).filter(
                Categoria.tipo == tipo, Transacao.user_id == user_id,
                Transacao.status == 'Efetivada')
            if ini is not None:
                q = q.filter(Transacao.data >= ini)
            if fim is not None:
                q = q.filter(Transacao.data < fim)
            return q.scalar() or 0.0

        def _sum_ajuste(tipo, ini, fim):
            q = db.query(func.sum(AjusteCaixa.valor)).filter(
                AjusteCaixa.user_id == user_id, AjusteCaixa.tipo == tipo)
            if ini is not None:
                q = q.filter(AjusteCaixa.data >= ini)
            if fim is not None:
                q = q.filter(AjusteCaixa.data < fim)
            return q.scalar() or 0.0

        # Baseline = caixa no instante imediatamente anterior à janela.
        caixa_running = (_sum_ajuste('entrada', None, win_start) - _sum_ajuste('saida', None, win_start)) \
            + _sum_tx('receita', None, win_start) - _sum_tx('despesa', None, win_start)

        evolucao_labels, evol_rec, evol_desp, evol_caixa = [], [], [], []
        for i in range(12):
            ini = win_start + relativedelta(months=i)
            fim = ini + relativedelta(months=1)
            evolucao_labels.append(f"{meses_pt[ini.month-1]}/{ini.year % 100}")
            r = _sum_tx('receita', ini, fim)
            d = _sum_tx('despesa', ini, fim)
            aj = _sum_ajuste('entrada', ini, fim) - _sum_ajuste('saida', ini, fim)
            caixa_running += aj + r - d
            evol_rec.append(r)
            evol_desp.append(d)
            evol_caixa.append(round(caixa_running, 2))

        # --- Padrão semanal: MÉDIA por dia da semana (não soma) ---
        semanal_soma = {i: 0.0 for i in range(7)}
        despesas_periodo = db.query(Transacao.data, Transacao.valor).join(Categoria).filter(
            Categoria.tipo == 'despesa', Transacao.user_id == user_id,
            Transacao.status == 'Efetivada',
            Transacao.data >= start_date, Transacao.data < end_date,
        ).all()
        for t in despesas_periodo:
            idx = 0 if t.data.weekday() == 6 else t.data.weekday() + 1  # [Dom..Sáb]
            semanal_soma[idx] += t.valor
        # nº de ocorrências de cada dia da semana no range (para a média)
        semanal_cont = {i: 0 for i in range(7)}
        dia = start_date.date()
        fim_dia = end_date.date()
        while dia < fim_dia:
            idx = 0 if dia.weekday() == 6 else dia.weekday() + 1
            semanal_cont[idx] += 1
            dia += relativedelta(days=1)
        semanal_labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
        semanal_data = [round(semanal_soma[i] / semanal_cont[i], 2) if semanal_cont[i] else 0.0 for i in range(7)]

        # Categorias auxiliares para filtros no frontend
        cats_filtro = db.query(Categoria).filter(
            Categoria.tipo == 'despesa',
            Categoria.user_id == user_id
        ).all()

        return {
            "kpis": kpis,
            "forecast": forecast,
            "gastos_por_categoria": gastos_por_categoria,
            "receitas_por_categoria": receitas_por_categoria,
            "evolucao_mensal_receita": evol_rec,
            "evolucao_mensal_despesa": evol_desp,
            "evolucao_caixa_real": evol_caixa,
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
            or_(
                Transacao.status == 'Pendente',
                Transacao.data > today,
                Transacao.tipo_recorrencia == 'pontual'
            )
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