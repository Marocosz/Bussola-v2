"""
=======================================================================================
ARQUIVO: agenda.py (Serviço de Domínio - Agenda)
=======================================================================================

OBJETIVO:
    Encapsular a regra de negócio para gestão de compromissos e geração do calendário
    visual. Responsável por garantir integridade de dados por usuário.

PARTE DO SISTEMA:
    Backend / Service Layer.

RESPONSABILIDADES:
    1. Operações CRUD de compromissos com filtro de segurança (user_id).
    2. Geração da grade visual de calendário (mês atual + próximo mês).
    3. Atualização automática de status de compromissos vencidos ('Pendente' -> 'Perdido').

COMUNICAÇÃO:
    - Utiliza Models: app.models.agenda.Compromisso.
    - Utilizado por: app.api.endpoints.agenda.
    - Dependências: datetime, dateutil (cálculos de datas).

MELHORIAS IMPLEMENTADAS (v2.1):
    - [FIX] Performance O(1) no grid: Uso de Dicionário em vez de Lista para buscar eventos do dia.
    - [FIX] Histórico Completo: A lista lateral agora retorna TODOS os compromissos (passado e futuro),
            sem restrições de data, conforme solicitado.
    - [FIX] Timezone/Data: Lógica aprimorada para comparação de "Hoje" usando date() e não datetime().
=======================================================================================
"""

from sqlalchemy.orm import Session
from datetime import datetime, timedelta, date
from dateutil.relativedelta import relativedelta
from collections import defaultdict
import locale
from app.models.agenda import Compromisso
from app.schemas.agenda import CompromissoCreate, CompromissoUpdate

# Configuração de Localização para nomes de meses (Fallback seguro se o sistema não suportar)
try:
    locale.setlocale(locale.LC_TIME, 'pt_BR.UTF-8')
except:
    pass 

class AgendaService:

    def _generate_month_grid(self, year: int, month: int, map_compromissos: dict, agora: datetime):
        """
        Gera a estrutura de dias para renderização do grid de calendário no frontend.
        
        Otimização de Performance (N+1 Fix):
        - Recebe um dicionário `map_compromissos` onde a chave é `date` e o valor é a lista de eventos.
        - Isso elimina a necessidade de iterar a lista inteira de compromissos para cada dia do grid.
        
        Retorno:
            Lista de dicionários contendo metadados do dia e resumo dos compromissos.
        """
        # 1. Definir limites do mês alvo
        first_date_of_month = date(year, month, 1)
        # Último dia do mês: (Primeiro dia do próximo mês) - 1 dia
        last_date_of_month = (first_date_of_month + relativedelta(months=1)) - timedelta(days=1)

        # 2. Calcular o início do Grid (Domingo anterior ou o próprio dia 1)
        days_to_retreat = (first_date_of_month.weekday() + 1) % 7
        grid_start_date = first_date_of_month - timedelta(days=days_to_retreat)

        # 3. Calcular o fim do Grid (Sábado posterior ou o próprio último dia)
        last_weekday_idx = (last_date_of_month.weekday() + 1) % 7 # 0(Dom) a 6(Sab)
        days_to_add = 6 - last_weekday_idx
        grid_end_date = last_date_of_month + timedelta(days=days_to_add)

        grid_days = []
        iter_date = grid_start_date
        dias_semana_curto = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
        
        # Loop para preencher todos os dias do grid calculado
        while iter_date <= grid_end_date:
            # Regra de Visualização: Padding se o mês não for o alvo
            is_padding = (iter_date.month != month)

            # [OTIMIZAÇÃO] Busca direta no dicionário (O(1)) em vez de filtrar lista (O(N))
            comps = map_compromissos.get(iter_date, [])
            
            # Minificação de dados para o tooltip do calendário
            comps_json = [{"titulo": c.titulo, "hora": c.data_hora.strftime("%H:%M")} for c in comps]
            
            # Índice para nome da semana (0=Dom ... 6=Sáb)
            w_idx = (iter_date.weekday() + 1) % 7

            grid_days.append({
                "type": "day",
                "day_number": str(iter_date.day),
                "weekday_short": dias_semana_curto[w_idx],
                "is_today": (iter_date == agora.date()), # Comparação segura date vs date
                "is_padding": is_padding, 
                "compromissos": comps_json
            })
            
            iter_date += timedelta(days=1)
            
        return grid_days
    
    def get_dashboard(self, db: Session, user_id: int, mes: int = None, ano: int = None):
        """
        Monta o painel principal da agenda.
        
        [LÓGICA ALTERADA - FULL HISTORY]
        - Lista Lateral (Esquerda): Busca TODOS os compromissos do usuário, sem filtro de data.
        - Calendário (Direita): Usa os dados carregados para desenhar apenas o mês solicitado via navegação.
        """
        agora = datetime.now() 
        
        # 1. Definição do Mês de Referência para o CALENDÁRIO (Navegação)
        if mes and ano:
            ref_date_calendar = datetime(ano, mes, 1)
        else:
            ref_date_calendar = agora.replace(day=1)

        # 2. Busca GLOBAL (Full Scan por User)
        # Removemos filtros de data_hora para garantir que a lista lateral mostre 
        # todo o histórico (passado) e todo o futuro.
        
        # [SEGURANÇA / MULTI-TENANT] 
        # Apenas filtra pelo usuário logado.
        todos = db.query(Compromisso).filter(
            Compromisso.user_id == user_id
        ).order_by(Compromisso.data_hora.asc()).all()

        # 3. Processamento em Memória
        por_mes = defaultdict(list)
        map_compromissos_por_data = defaultdict(list) 

        meses_pt = {1:"Janeiro", 2:"Fevereiro", 3:"Março", 4:"Abril", 5:"Maio", 6:"Junho",
                    7:"Julho", 8:"Agosto", 9:"Setembro", 10:"Outubro", 11:"Novembro", 12:"Dezembro"}
        
        for comp in todos:
            # REGRA DE NEGÓCIO: Atualização de Status
            # Se a data já passou e ainda está pendente, marca como 'Perdido' automaticamente.
            if comp.data_hora < agora and comp.status == 'Pendente':
                comp.status = 'Perdido'
                db.add(comp)
            
            # Popula dicionário otimizado para o grid (chave = data pura)
            # Usado para desenhar o calendário na direita
            map_compromissos_por_data[comp.data_hora.date()].append(comp)

            # Popula lista lateral
            # [ALTERADO] Removemos o 'if' que filtrava o passado. Agora entra tudo.
            key = f"{meses_pt[comp.data_hora.month]}/{comp.data_hora.year}"
            por_mes[key].append(comp)
        
        # Persiste alterações de status (Perdido)
        db.commit()

        # 4. Geração do Grid de Calendário (Apenas Mês Selecionado na Navegação)
        calendar_days = []
        
        # Mês Solicitado
        calendar_days.append({
            "type": "month_divider",
            "month_name": meses_pt[ref_date_calendar.month],
            "year": ref_date_calendar.year
        })
        calendar_days.extend(self._generate_month_grid(ref_date_calendar.year, ref_date_calendar.month, map_compromissos_por_data, agora))

        return {
            "compromissos_por_mes": por_mes,
            "calendar_days": calendar_days
        }

    # ----------------------------------------------------------------------------------
    # OPERAÇÕES CRUD (CREATE, UPDATE, DELETE)
    # ----------------------------------------------------------------------------------
    
    def create(self, db: Session, dados: CompromissoCreate, user_id: int):
        # [SEGURANÇA] Vincula explicitamente o ID do usuário logado na criação.
        novo = Compromisso(**dados.model_dump(), user_id=user_id)
        db.add(novo); db.commit(); db.refresh(novo)
        return novo

    def update(self, db: Session, id: int, dados: CompromissoUpdate, user_id: int):
        # [SEGURANÇA] Where clause inclui user_id para impedir edição de dados alheios.
        comp = db.query(Compromisso).filter(Compromisso.id == id, Compromisso.user_id == user_id).first()
        if not comp: return None
        for k, v in dados.model_dump(exclude_unset=True).items(): setattr(comp, k, v)
        db.commit(); db.refresh(comp)
        return comp

    def toggle_status(self, db: Session, id: int, user_id: int):
        """Alterna status entre 'Realizado' e 'Pendente'."""
        comp = db.query(Compromisso).filter(Compromisso.id == id, Compromisso.user_id == user_id).first()
        if comp:
            comp.status = 'Pendente' if comp.status == 'Realizado' else 'Realizado'
            db.commit()
        return comp

    def delete(self, db: Session, id: int, user_id: int):
        comp = db.query(Compromisso).filter(Compromisso.id == id, Compromisso.user_id == user_id).first()
        if comp: db.delete(comp); db.commit(); return True
        return False

agenda_service = AgendaService()