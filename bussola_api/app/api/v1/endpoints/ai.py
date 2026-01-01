"""
=======================================================================================
ARQUIVO: ai.py (Endpoints de Inteligência Artificial)
=======================================================================================
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Any, List, Dict
from datetime import datetime, timedelta, time
import locale
import pytz 

# Imports Existentes
from app.api import deps
# Import da Autoridade de Tempo para padronização
from app.core.timezone import to_local, now_local, now_utc 

# Serviços e Orchestrators Existentes
from app.services.ritmo import RitmoService
from app.services.ai.ritmo.orchestrator import RitmoOrchestrator
from app.services.ai.ritmo.schema import RitmoAnalysisResponse

from app.services.ai.registros.orchestrator import RegistrosOrchestrator
from app.services.ai.registros.context import RegistrosContext, TaskItemContext
from app.models.registros import Tarefa

from app.services.ai.roteiro.orchestrator import RoteiroOrchestrator
from app.models.agenda import Compromisso 

# [NOVO] Imports Finanças (Orchestrator e Models)
from app.services.ai.financas.orchestrator import FinancasOrchestrator
from app.models.financas import Transacao, Categoria, HistoricoGastoMensal

router = APIRouter()

try:
    locale.setlocale(locale.LC_TIME, 'pt_BR.UTF-8')
except:
    pass

# ==============================================================================
# RITMO (Saúde & Treino)
# ==============================================================================
@router.get("/ritmo/insight", response_model=RitmoAnalysisResponse)
async def get_ritmo_ai_insight(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
) -> Any:
    bio = RitmoService.get_latest_bio(db, current_user.id)
    if not bio:
        return RitmoAnalysisResponse(suggestions=[])
    dieta_ativa = RitmoService.get_dieta_ativa(db, current_user.id)
    plano_treino_ativo = RitmoService.get_plano_ativo(db, current_user.id)
    response = await RitmoOrchestrator.analyze_profile(
        bio=bio,
        dieta=dieta_ativa,
        plano_treino=plano_treino_ativo
    )
    return response

# ==============================================================================
# REGISTROS (Tarefas & Produtividade)
# ==============================================================================
@router.get("/registros/insight", response_model=RitmoAnalysisResponse)
async def get_registros_ai_insight(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
) -> Any:
    # 1. Coletar TAREFAS
    db_tasks = db.query(Tarefa).filter(Tarefa.user_id == current_user.id).all()
    
    # [FIX] Data atual baseada no fuso correto (Brasil)
    now = now_local()
    
    tasks_context_list = []
    for t in db_tasks:
        tasks_context_list.append(TaskItemContext(
            id=t.id,
            titulo=t.titulo,
            descricao=t.descricao, 
            prioridade=getattr(t, 'prioridade', 'media'),
            status='concluida' if t.status == 'Concluído' else 'pendente',
            data_vencimento=t.prazo.strftime("%Y-%m-%d") if t.prazo else None,
            created_at=t.data_criacao.strftime("%Y-%m-%d") if t.data_criacao else now.strftime("%Y-%m-%d"),
            has_subtasks=len(t.subtarefas) > 0 if getattr(t, 'subtarefas', None) else False
        ))

    # 2. Montar Contexto
    registros_context = RegistrosContext(
        user_id=current_user.id,
        data_atual=now.strftime("%Y-%m-%d"),
        hora_atual=now.strftime("%H:%M"),
        dia_semana=now.strftime("%A").capitalize(),
        tarefas=tasks_context_list
    )

    # 3. Execução
    suggestions = await RegistrosOrchestrator.analyze(registros_context)
    
    return RitmoAnalysisResponse(suggestions=suggestions)

# ==============================================================================
# ROTEIRO (Agenda & Logística)
# ==============================================================================
@router.get("/roteiro/insight", response_model=RitmoAnalysisResponse)
async def get_roteiro_ai_insight(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
) -> Any:
    """
    Gera insights sobre AGENDA e ROTINA (Roteiro).
    Aciona: Conflict Guardian, Travel Marshal, Density Auditor, Recovery Agent.
    """
    # 1. Definições Temporais (Escopo de 30 dias)
    # [FIX] Usamos UTC para calcular a janela de busca no banco (assumindo banco UTC)
    utc_now = now_utc()
    
    # Define o início do dia de hoje (base UTC)
    start_db = utc_now.replace(hour=0, minute=0, second=0, microsecond=0)
    # Define o fim daqui a 30 dias
    end_db = start_db + timedelta(days=30)

    # 2. Buscar Compromissos no Banco
    compromissos_db = db.query(Compromisso).filter(
        Compromisso.user_id == current_user.id,
        Compromisso.data_hora >= start_db,
        Compromisso.data_hora <= end_db
    ).all()
    
    # 3. Mapeamento para Formato Padrão do Agente (Dict)
    agenda_itens: List[Dict[str, Any]] = []
    
    for comp in compromissos_db:
        # [CRÍTICO] Conversão centralizada via Autoridade de Tempo (app.core.timezone)
        # Converte o dado do banco (UTC/Naive) para Hora Local (Brasil)
        start_local = to_local(comp.data_hora)
        
        # Como o modelo Compromisso não tem hora de fim, vamos assumir 1 hora de duração
        end_local = start_local + timedelta(hours=1)

        agenda_itens.append({
            "id": comp.id,
            "title": comp.titulo,
            # Formatando para ISO 8601 usando o horário LOCAL corrigido
            "start_time": start_local.isoformat(),
            "end_time": end_local.isoformat(),
            "location": comp.local if comp.local else "Não especificado",
            "description": comp.descricao,
            "status": comp.status, 
            "category": "geral", 
            "priority": "media"
        })

    # 4. Dados de contexto para a IA (Também em Local Time)
    local_now = now_local()

    # 5. Executa o Orquestrador
    suggestions = await RoteiroOrchestrator.analyze_schedule(
        data_atual=local_now.strftime("%Y-%m-%d"),
        dia_semana=local_now.strftime("%A").capitalize(),
        data_inicio=local_now.strftime("%Y-%m-%d"),
        data_fim=(local_now + timedelta(days=30)).strftime("%Y-%m-%d"),
        agenda_itens=agenda_itens,
        preferences={} 
    )
    
    # 6. Retorna
    return RitmoAnalysisResponse(suggestions=suggestions)

# ==============================================================================
# FINANÇAS (CFO Digital)
# ==============================================================================
@router.get("/financas/insight", response_model=RitmoAnalysisResponse)
async def get_financas_ai_insight(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
) -> Any:
    """
    Gera insights financeiros baseados em:
    - Passado: Anomalias de gastos (Spending Detective).
    - Presente: Burn Rate e metas (Budget Sentinel).
    - Futuro: Fluxo de caixa e Provisões (Oracle & Architect).
    """
    
    # --- 1. DEFINIÇÃO TEMPORAL (UTC para Banco, Local para IA) ---
    utc_agora = now_utc()
    local_agora = now_local()
    
    # Mês Atual (Inicio e Fim) - Para BudgetSentinel e Transações Recentes
    inicio_mes_utc = utc_agora.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    # Gambiarra segura para fim do mês: dia 1 do próximo mês - 1 segundo
    proximo_mes = (inicio_mes_utc.replace(day=28) + timedelta(days=4)).replace(day=1)
    fim_mes_utc = proximo_mes - timedelta(seconds=1)

    # Janela de Histórico (90 dias para trás) - Para SpendingDetective (Médias)
    inicio_historico_utc = inicio_mes_utc - timedelta(days=90)

    # Janela Futura (30 dias para frente) - Para CashFlowOracle
    fim_projecao_utc = utc_agora + timedelta(days=30)

    # --- 2. COLETA DE DADOS (QUERIES) ---
    
    # Mapeamento de Categorias (Crucial para saber o que é Receita e o que é Despesa)
    categorias = db.query(Categoria).filter(Categoria.user_id == current_user.id).all()
    mapa_cat_obj = {c.id: c for c in categorias}
    mapa_categorias_nome = {c.id: c.nome for c in categorias}

    # A. Transações do Mês Atual (Presente)
    # Usado para calcular o gasto corrente e burn rate
    transacoes_mes = db.query(Transacao).filter(
        Transacao.user_id == current_user.id,
        Transacao.data >= inicio_mes_utc,
        Transacao.data <= fim_mes_utc
    ).all()

    # B. Histórico de Gastos (Passado) - Agregado por Categoria
    # Busca na tabela de cache 'HistoricoGastoMensal' para performance, ou calcula bruto
    # Aqui vamos calcular bruto da tabela Transacao para garantir precisão de 90 dias
    historico_raw = db.query(
        Transacao.categoria_id,
        func.sum(Transacao.valor).label("total")
    ).filter(
        Transacao.user_id == current_user.id,
        Transacao.data >= inicio_historico_utc,
        Transacao.data < inicio_mes_utc, # Estritamente anterior ao mês atual
        Transacao.tipo_recorrencia != 'ignorar' # Exemplo de filtro opcional
    ).group_by(Transacao.categoria_id).all()

    # D. Transações Futuras / Recorrentes (Futuro)
    # Aqui simplificamos: pegamos transações agendadas (se houver lógica de agendamento)
    # ou simulamos recorrentes baseadas no padrão 'mensal'.
    # Para este MVP, vamos buscar transações com data futura já lançadas (parcelas, agendamentos)
    transacoes_futuras = db.query(Transacao).filter(
        Transacao.user_id == current_user.id,
        Transacao.data > utc_agora,
        Transacao.data <= fim_projecao_utc
    ).all()

    # --- 3. CÁLCULO DE CAPACIDADE DE POUPANÇA (REAL) ---
    # Aqui a mágica acontece. Calculamos a sobra média REAL dos últimos 90 dias.
    
    total_receita_90d = 0.0
    total_despesa_90d = 0.0
    
    lista_historico_medias = []
    
    for cat_id, total in historico_raw:
        cat = mapa_cat_obj.get(cat_id)
        if not cat: continue
        
        # Separa para cálculo global de sobra
        if cat.tipo == 'receita':
            total_receita_90d += total
        else:
            total_despesa_90d += total
            
        # Prepara lista para o SpendingDetective (apenas média mensal por categoria)
        lista_historico_medias.append({
            "categoria": cat.nome,
            "valor_media": round(total / 3.0, 2)
        })
        
    # Cálculo da Sobra Média Mensal Real (Receita - Despesa) / 3 meses
    media_receita_mensal = total_receita_90d / 3.0
    media_despesa_mensal = total_despesa_90d / 3.0
    sobra_mensal_real = media_receita_mensal - media_despesa_mensal

    # --- 4. FORMATAÇÃO DO CONTEXTO ---

    # Formatar Transações Mês
    lista_transacoes_mes = []
    saldo_atual_estimado = 0.0 
    
    for t in transacoes_mes:
        data_local = to_local(t.data)
        cat = mapa_cat_obj.get(t.categoria_id)
        tipo = cat.tipo if cat else 'despesa'
        
        if tipo == 'receita':
            saldo_atual_estimado += t.valor
        else:
            saldo_atual_estimado -= t.valor

        lista_transacoes_mes.append({
            "data": data_local.strftime("%Y-%m-%d"),
            "descricao": t.descricao,
            "valor": t.valor,
            "categoria": cat.nome if cat else "Outros",
            "tipo": tipo
        })

    # Formatar Metas de Orçamento
    lista_metas_orcamento = []
    for c in categorias:
        if c.meta_limite > 0: # Inclui Receita e Despesa para o StrategyArchitect analisar
            lista_metas_orcamento.append({
                "categoria": c.nome,
                "valor_limite": c.meta_limite,
                "tipo": c.tipo # Importante para o Architect diferenciar Teto de Alvo
            })

    # Formatar Transações Futuras
    lista_transacoes_futuras = []
    for t in transacoes_futuras:
        data_local = to_local(t.data)
        cat = mapa_cat_obj.get(t.categoria_id)
        lista_transacoes_futuras.append({
            "data": data_local.strftime("%Y-%m-%d"),
            "descricao": t.descricao,
            "valor": t.valor,
            "tipo": cat.tipo if cat else 'despesa'
        })

    # [Sem Mocks] - O StrategyArchitect usará a sobra_mensal_real e as metas das categorias
    lista_metas_provisoes = []

    # --- 5. EXECUÇÃO DO ORQUESTRADOR ---
    
    suggestions = await FinancasOrchestrator.analyze_finances(
        data_atual=local_agora.strftime("%Y-%m-%d"),
        periodo_label=local_agora.strftime("%B %Y"), 
        data_fim_projecao=(local_agora + timedelta(days=30)).strftime("%Y-%m-%d"),
        saldo_atual=round(saldo_atual_estimado, 2), 
        transacoes_mes=lista_transacoes_mes,
        historico_medias=lista_historico_medias,
        transacoes_futuras=lista_transacoes_futuras,
        metas_orcamento=lista_metas_orcamento,
        metas_provisoes=lista_metas_provisoes,
        media_sobra=round(sobra_mensal_real, 2) 
    )

    return RitmoAnalysisResponse(suggestions=suggestions)