from sqlalchemy.orm import Session
from sqlalchemy import extract, and_
from datetime import datetime, timedelta
from collections import defaultdict
import locale
from app.models.agenda import Compromisso
from app.schemas.agenda import CompromissoCreate, CompromissoUpdate

# Tenta configurar locale para PT-BR para nomes de meses/dias
try:
    locale.setlocale(locale.LC_TIME, 'pt_BR.UTF-8')
except:
    pass # Fallback se o sistema não tiver o locale

class AgendaService:
    
    def get_dashboard(self, db: Session):
        # 1. Buscar Compromissos Futuros (para a lista da esquerda)
        agora = datetime.now()
        # Pega tudo do início do mês atual para frente
        inicio_mes = agora.replace(day=1, hour=0, minute=0, second=0)
        
        todos = db.query(Compromisso).filter(Compromisso.data_hora >= inicio_mes)\
            .order_by(Compromisso.data_hora.asc()).all()

        # Agrupar por Mês (Ex: "Dezembro/2025")
        por_mes = defaultdict(list)
        meses_pt = {1:"Janeiro", 2:"Fevereiro", 3:"Março", 4:"Abril", 5:"Maio", 6:"Junho",
                    7:"Julho", 8:"Agosto", 9:"Setembro", 10:"Outubro", 11:"Novembro", 12:"Dezembro"}
        
        for comp in todos:
            # Atualiza status se estiver atrasado e ainda for "Pendente"
            if comp.data_hora < agora and comp.status == 'Pendente':
                comp.status = 'Perdido'
                db.add(comp) # Marca para salvar atualização
            
            key = f"{meses_pt[comp.data_hora.month]}/{comp.data_hora.year}"
            por_mes[key].append(comp)
        
        db.commit() # Salva as atualizações de status "Perdido"

        # 2. Gerar Dados do Calendário (para a grade da direita) - Próximos 60 dias
        calendar_days = []
        current_iter_date = agora
        end_date = agora + timedelta(days=60)
        
        # Variável para controlar quando inserir o divisor de mês
        last_month = -1

        while current_iter_date <= end_date:
            # Verifica se mudou o mês para inserir divisor
            if current_iter_date.month != last_month:
                calendar_days.append({
                    "type": "month_divider",
                    "month_name": meses_pt[current_iter_date.month],
                    "year": current_iter_date.year
                })
                last_month = current_iter_date.month

            # Busca compromissos deste dia específico
            day_start = current_iter_date.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = current_iter_date.replace(hour=23, minute=59, second=59, microsecond=999)
            
            # Filtra na memória os compromissos do dia (já buscamos 'todos' acima, mais eficiente filtrar a lista)
            comps_do_dia = [c for c in todos if day_start <= c.data_hora <= day_end]
            comps_json = [{"titulo": c.titulo, "hora": c.data_hora.strftime("%H:%M")} for c in comps_do_dia]

            dias_semana = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
            
            calendar_days.append({
                "type": "day",
                "full_date": current_iter_date.strftime("%Y-%m-%d"),
                "day_number": str(current_iter_date.day),
                "weekday_short": dias_semana[current_iter_date.weekday()],
                "is_today": (current_iter_date.date() == agora.date()),
                "compromissos": comps_json
            })

            current_iter_date += timedelta(days=1)

        return {
            "compromissos_por_mes": por_mes,
            "calendar_days": calendar_days
        }

    def create(self, db: Session, dados: CompromissoCreate):
        novo = Compromisso(**dados.model_dump())
        db.add(novo)
        db.commit()
        db.refresh(novo)
        return novo

    def update(self, db: Session, id: int, dados: CompromissoUpdate):
        comp = db.query(Compromisso).get(id)
        if not comp: return None
        
        update_data = dados.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(comp, key, value)
            
        db.commit()
        db.refresh(comp)
        return comp

    def toggle_status(self, db: Session, id: int):
        comp = db.query(Compromisso).get(id)
        if comp:
            if comp.status == 'Realizado': comp.status = 'Pendente'
            else: comp.status = 'Realizado'
            db.commit()
        return comp

    def delete(self, db: Session, id: int):
        comp = db.query(Compromisso).get(id)
        if comp:
            db.delete(comp)
            db.commit()
            return True
        return False

agenda_service = AgendaService()