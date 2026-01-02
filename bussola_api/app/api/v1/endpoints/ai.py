"""
=======================================================================================
ARQUIVO: ai.py (Endpoints de Inteligência Artificial)
=======================================================================================

OBJETIVO:
    Atuar como a camada de CONTROLADOR (Controller) para os recursos de IA do sistema.
    Este arquivo é responsável por coletar dados brutos do banco de dados (SQLAlchemy),
    formatá-los em contextos estruturados e enviá-los para os "Orchestrators" (camada de serviço de IA).

RESPONSABILIDADES:
    1. Definição de janelas temporais (Passado, Presente, Futuro) com tratamento de Fuso Horário.
    2. Agregação de dados de diferentes domínios (Saúde, Tarefas, Agenda, Finanças).
    3. Pré-processamento matemático (ex: cálculo de médias financeiras) antes de chamar a IA.
    4. Roteamento da resposta da IA de volta para o Frontend.

INTEGRAÇÕES:
    - Services: RitmoService (Dados de saúde)
    - Orchestrators: Ritmo, Registros, Roteiro e Finanças (Lógica de Agentes)
    - Core: Timezone Authority (Padronização UTC vs Local)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Any, List, Dict
from datetime import datetime, timedelta, time
import locale
import pytz 

# Imports de Dependências e Core
from app.api import deps
from app.core.timezone import to_local, now_local, now_utc 

# --- DOMÍNIO RITMO (Saúde) ---
from app.services.ritmo import RitmoService
from app.services.ai.ritmo.orchestrator import RitmoOrchestrator
from app.services.ai.ritmo.schema import RitmoAnalysisResponse

# --- DOMÍNIO REGISTROS (Tarefas) ---
from app.services.ai.registros.orchestrator import RegistrosOrchestrator
from app.services.ai.registros.context import RegistrosContext, TaskItemContext
from app.models.registros import Tarefa

# --- DOMÍNIO ROTEIRO (Agenda) ---
from app.services.ai.roteiro.orchestrator import RoteiroOrchestrator
from app.models.agenda import Compromisso 

# --- DOMÍNIO FINANÇAS (CFO Digital) ---
from app.services.ai.financas.orchestrator import FinancasOrchestrator
from app.models.financas import Transacao, Categoria, HistoricoGastoMensal

router = APIRouter()

# Configuração de locale para formatação de datas em PT-BR (segurança caso o sistema host não tenha)
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
    """
    Coleta dados biométricos, nutricionais e de treino para gerar insights de saúde.
    Alimenta os agentes: Coach (Treino) e Nutri (Alimentação).
    """
    # Coleta de dados mais recentes do usuário
    bio = RitmoService.get_latest_bio(db, current_user.id)
    if not bio:
        # Sem biometria, a IA não tem contexto para analisar
        return RitmoAnalysisResponse(suggestions=[])
        
    dieta_ativa = RitmoService.get_dieta_ativa(db, current_user.id)
    plano_treino_ativo = RitmoService.get_plano_ativo(db, current_user.id)
    
    # Delegação para o Orquestrador
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
    """
    Analisa a lista de tarefas do usuário para sugerir priorização e quebra de tarefas.
    """
    # 1. Coleta Bruta
    db_tasks = db.query(Tarefa).filter(Tarefa.user_id == current_user.id).all()
    
    # Timezone: Garante que a data de referência seja a local do usuário
    now = now_local()
    
    # 2. Transformação de Modelo (SQLAlchemy -> Contexto Pydantic)
    # Necessário para limpar os dados e formatar datas antes de enviar para a LLM
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

    # 3. Montagem do Contexto Rico
    registros_context = RegistrosContext(
        user_id=current_user.id,
        data_atual=now.strftime("%Y-%m-%d"),
        hora_atual=now.strftime("%H:%M"),
        dia_semana=now.strftime("%A").capitalize(),
        tarefas=tasks_context_list
    )

    # 4. Execução da IA
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
    Gera insights sobre a AGENDA (conflitos, tempo de deslocamento, densidade).
    IMPORTANTE: Lida intensivamente com conversão de Timezone (UTC no Banco vs Local na IA).
    """
    # 1. Definições Temporais (Janela de 30 dias)
    # O banco armazena em UTC. Precisamos calcular a janela de busca em UTC.
    utc_now = now_utc()
    
    start_db = utc_now.replace(hour=0, minute=0, second=0, microsecond=0)
    end_db = start_db + timedelta(days=30)

    # 2. Busca Otimizada no Banco (Range de datas)
    compromissos_db = db.query(Compromisso).filter(
        Compromisso.user_id == current_user.id,
        Compromisso.data_hora >= start_db,
        Compromisso.data_hora <= end_db
    ).all()
    
    # 3. Normalização de Timezone
    # A IA precisa "pensar" no horário local do usuário (ex: 14:00 Brasil), 
    # não no horário UTC do servidor (ex: 17:00 UTC).
    agenda_itens: List[Dict[str, Any]] = []
    
    for comp in compromissos_db:
        # Converte UTC -> Local Time
        start_local = to_local(comp.data_hora)
        
        # Assume duração padrão de 1h caso não especificado (fallback)
        end_local = start_local + timedelta(hours=1)

        agenda_itens.append({
            "id": comp.id,
            "title": comp.titulo,
            "start_time": start_local.isoformat(),
            "end_time": end_local.isoformat(),
            "location": comp.local if comp.local else "Não especificado",
            "description": comp.descricao,
            "status": comp.status, 
            "category": "geral", 
            "priority": "media"
        })

    # Data de referência para a IA também deve ser Local
    local_now = now_local()

    # 4. Execução do Orquestrador
    suggestions = await RoteiroOrchestrator.analyze_schedule(
        data_atual=local_now.strftime("%Y-%m-%d"),
        dia_semana=local_now.strftime("%A").capitalize(),
        data_inicio=local_now.strftime("%Y-%m-%d"),
        data_fim=(local_now + timedelta(days=30)).strftime("%Y-%m-%d"),
        agenda_itens=agenda_itens,
        preferences={} 
    )
    
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
    Endpoint Mestre de Finanças (CFO Digital).
    Coleta dados de Passado, Presente e Futuro para alimentar 4 agentes especialistas:
    1. SpendingDetective (Passado/Anomalias)
    2. BudgetSentinel (Presente/Execução)
    3. CashFlowOracle (Futuro Curto/Liquidez)
    4. StrategyArchitect (Futuro Longo/Estratégia)
    """
    
    # --- 1. DEFINIÇÃO DE JANELAS TEMPORAIS ---
    # Usamos UTC para consultas no banco e Local para labels de exibição
    utc_agora = now_utc()
    local_agora = now_local()
    
    # Definição precisa do Mês Atual (para BudgetSentinel)
    inicio_mes_utc = utc_agora.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    # Lógica para encontrar o primeiro dia do próximo mês
    proximo_mes = (inicio_mes_utc.replace(day=28) + timedelta(days=4)).replace(day=1)
    fim_mes_utc = proximo_mes - timedelta(seconds=1)

    # Janela de Histórico (90 dias) -> Essencial para StrategyArchitect calcular médias
    inicio_historico_utc = inicio_mes_utc - timedelta(days=90)

    # Janela de Projeção (30 dias) -> Essencial para CashFlowOracle prever quebras
    fim_projecao_utc = utc_agora + timedelta(days=30)

    # --- 2. COLETA DE DADOS (QUERIES) ---
    
    # Mapeamento de Categorias
    # Necessário para distinguir Receita vs Despesa e associar IDs a Nomes
    categorias = db.query(Categoria).filter(Categoria.user_id == current_user.id).all()
    mapa_cat_obj = {c.id: c for c in categorias}
    mapa_categorias_nome = {c.id: c.nome for c in categorias}

    # Query A: Transações do Mês Atual (Foco no BudgetSentinel)
    transacoes_mes = db.query(Transacao).filter(
        Transacao.user_id == current_user.id,
        Transacao.data >= inicio_mes_utc,
        Transacao.data <= fim_mes_utc
    ).all()

    # Query B: Histórico Agregado de 90 Dias (Foco no SpendingDetective e StrategyArchitect)
    # Agrupa por categoria para performance, em vez de buscar milhares de linhas
    historico_raw = db.query(
        Transacao.categoria_id,
        func.sum(Transacao.valor).label("total")
    ).filter(
        Transacao.user_id == current_user.id,
        Transacao.data >= inicio_historico_utc,
        Transacao.data < inicio_mes_utc, # Estritamente anterior ao mês atual
        Transacao.tipo_recorrencia != 'ignorar' 
    ).group_by(Transacao.categoria_id).all()

    # Query C: Transações Futuras (Foco no CashFlowOracle)
    transacoes_futuras = db.query(Transacao).filter(
        Transacao.user_id == current_user.id,
        Transacao.data > utc_agora,
        Transacao.data <= fim_projecao_utc
    ).all()

    # --- 3. PRÉ-PROCESSAMENTO: CÁLCULO DE CAPACIDADE DE POUPANÇA ---
    # O StrategyArchitect (modo Wealth Builder) precisa saber se o usuário está acumulando
    # riqueza ou queimando caixa. Calculamos isso matematicamente aqui para evitar
    # alucinação da IA.
    
    total_receita_90d = 0.0
    total_despesa_90d = 0.0
    
    lista_historico_medias = []
    
    for cat_id, total in historico_raw:
        cat = mapa_cat_obj.get(cat_id)
        if not cat: continue
        
        # Separação contábil para cálculo global
        if cat.tipo == 'receita':
            total_receita_90d += total
        else:
            total_despesa_90d += total
            
        # Formata média mensal por categoria para análise de anomalias
        lista_historico_medias.append({
            "categoria": cat.nome,
            "valor_media": round(total / 3.0, 2) # Média de 3 meses
        })
        
    # Cálculo da "Sobra Real" Média Mensal (Receita - Despesa)
    media_receita_mensal = total_receita_90d / 3.0
    media_despesa_mensal = total_despesa_90d / 3.0
    sobra_mensal_real = media_receita_mensal - media_despesa_mensal

    # --- 4. FORMATAÇÃO DO CONTEXTO PARA O ORCHESTRATOR ---

    # Formatação: Transações do Mês (inclui cálculo estimado de saldo corrente)
    lista_transacoes_mes = []
    saldo_atual_estimado = 0.0 
    
    for t in transacoes_mes:
        data_local = to_local(t.data)
        cat = mapa_cat_obj.get(t.categoria_id)
        tipo = cat.tipo if cat else 'despesa'
        
        # Atualização simples do saldo (Receita +, Despesa -)
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

    # Formatação: Metas de Orçamento (StrategyArchitect usa isso para comparar Meta vs Real)
    lista_metas_orcamento = []
    for c in categorias:
        if c.meta_limite > 0: 
            # Inclui tanto Receitas (Alvos) quanto Despesas (Tetos)
            lista_metas_orcamento.append({
                "categoria": c.nome,
                "valor_limite": c.meta_limite,
                "tipo": c.tipo 
            })

    # Formatação: Transações Futuras
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

    # Lista vazia intencional: StrategyArchitect usará 'sobra_mensal_real' na ausência de metas específicas
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
        media_sobra=round(sobra_mensal_real, 2) # Passa o cálculo real para análise estratégica
    )

    return RitmoAnalysisResponse(suggestions=suggestions)