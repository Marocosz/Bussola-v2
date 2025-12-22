from sqlalchemy.orm import Session
from datetime import datetime, timedelta, date
from dateutil.relativedelta import relativedelta
from collections import defaultdict
import locale
from app.models.agenda import Compromisso
from app.schemas.agenda import CompromissoCreate, CompromissoUpdate

# Tenta configurar locale para PT-BR
try:
    locale.setlocale(locale.LC_TIME, 'pt_BR.UTF-8')
except:
    pass 

class AgendaService:

    def _generate_month_grid(self, year: int, month: int, todos: list, agora: datetime):
        """
        Gera o grid garantindo início no Domingo e término no Sábado.
        Marca dias fora do mês alvo como is_padding=True.
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
        
        while iter_date <= grid_end_date:
            # Identifica padding (dia não pertence ao mês alvo)
            is_padding = (iter_date.month != month)

            # Filtra compromissos do dia
            comps = [c for c in todos if c.data_hora.date() == iter_date]
            comps_json = [{"titulo": c.titulo, "hora": c.data_hora.strftime("%H:%M")} for c in comps]
            
            # Índice para nome da semana (0=Dom ... 6=Sáb)
            w_idx = (iter_date.weekday() + 1) % 7

            grid_days.append({
                "type": "day",
                "day_number": str(iter_date.day),
                "weekday_short": dias_semana_curto[w_idx],
                "is_today": (iter_date == agora.date()),
                "is_padding": is_padding, # Flag essencial para o Frontend
                "compromissos": comps_json
            })
            
            iter_date += timedelta(days=1)
            
        return grid_days
    
    def get_dashboard(self, db: Session, user_id: int):
        agora = datetime.now()
        
        # Busca dados (com margem de segurança de 15 dias antes para pegar paddings do inicio)
        inicio_busca = agora.replace(day=1) - timedelta(days=15)
        
        # [SEGURANÇA] Filtra por user_id
        todos = db.query(Compromisso).filter(
            Compromisso.user_id == user_id,
            Compromisso.data_hora >= inicio_busca
        ).order_by(Compromisso.data_hora.asc()).all()

        # Agrupamento da Esquerda (Lista)
        por_mes = defaultdict(list)
        meses_pt = {1:"Janeiro", 2:"Fevereiro", 3:"Março", 4:"Abril", 5:"Maio", 6:"Junho",
                    7:"Julho", 8:"Agosto", 9:"Setembro", 10:"Outubro", 11:"Novembro", 12:"Dezembro"}
        
        inicio_mes_real = agora.replace(day=1, hour=0, minute=0, second=0)
        
        for comp in todos:
            # Atualiza status de pendentes vencidos
            if comp.data_hora < agora and comp.status == 'Pendente':
                comp.status = 'Perdido'
                db.add(comp)
            
            # Agrupa apenas do mês atual para frente na lista
            if comp.data_hora >= inicio_mes_real:
                key = f"{meses_pt[comp.data_hora.month]}/{comp.data_hora.year}"
                por_mes[key].append(comp)
        
        db.commit()

        # Geração do Calendário (Direita)
        calendar_days = []
        
        # 1. Mês Atual
        calendar_days.append({
            "type": "month_divider",
            "month_name": meses_pt[agora.month],
            "year": agora.year
        })
        calendar_days.extend(self._generate_month_grid(agora.year, agora.month, todos, agora))

        # 2. Próximo Mês
        prox = agora + relativedelta(months=1)
        calendar_days.append({
            "type": "month_divider",
            "month_name": meses_pt[prox.month],
            "year": prox.year
        })
        calendar_days.extend(self._generate_month_grid(prox.year, prox.month, todos, agora))

        return {
            "compromissos_por_mes": por_mes,
            "calendar_days": calendar_days
        }

    # --- CRUD Básico Mantido ---
    def create(self, db: Session, dados: CompromissoCreate, user_id: int):
        # [SEGURANÇA] Adiciona user_id na criação
        novo = Compromisso(**dados.model_dump(), user_id=user_id)
        db.add(novo); db.commit(); db.refresh(novo)
        return novo

    def update(self, db: Session, id: int, dados: CompromissoUpdate, user_id: int):
        # [SEGURANÇA] Filtra por id e user_id
        comp = db.query(Compromisso).filter(Compromisso.id == id, Compromisso.user_id == user_id).first()
        if not comp: return None
        for k, v in dados.model_dump(exclude_unset=True).items(): setattr(comp, k, v)
        db.commit(); db.refresh(comp)
        return comp

    def toggle_status(self, db: Session, id: int, user_id: int):
        # [SEGURANÇA] Filtra por id e user_id
        comp = db.query(Compromisso).filter(Compromisso.id == id, Compromisso.user_id == user_id).first()
        if comp:
            comp.status = 'Pendente' if comp.status == 'Realizado' else 'Realizado'
            db.commit()
        return comp

    def delete(self, db: Session, id: int, user_id: int):
        # [SEGURANÇA] Filtra por id e user_id
        comp = db.query(Compromisso).filter(Compromisso.id == id, Compromisso.user_id == user_id).first()
        if comp: db.delete(comp); db.commit(); return True
        return False

agenda_service = AgendaService()