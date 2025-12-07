from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from dateutil.relativedelta import relativedelta

# Importa modelos de diferentes módulos
from app.models.financas import Transacao, Categoria
# from app.models.agenda import Compromisso (Futuramente)
# from app.models.cofre import Segredo (Futuramente)

class PanoramaService:
    
    def get_dashboard_data(self, db: Session):
        today = datetime.now()
        start_of_month = today.replace(day=1, hour=0, minute=0, second=0)
        next_month = start_of_month + relativedelta(months=1)

        # --- DADOS DE FINANÇAS ---
        receita = db.query(func.sum(Transacao.valor)).join(Categoria).filter(
            Categoria.tipo == 'receita', 
            Transacao.data >= start_of_month, Transacao.data < next_month,
            Transacao.status == 'Efetivada'
        ).scalar() or 0.0

        despesa = db.query(func.sum(Transacao.valor)).join(Categoria).filter(
            Categoria.tipo == 'despesa',
            Transacao.data >= start_of_month, Transacao.data < next_month,
            Transacao.status == 'Efetivada'
        ).scalar() or 0.0

        # Gráfico Rosca
        gastos_cat = db.query(Categoria.nome, Categoria.cor, func.sum(Transacao.valor))\
            .join(Transacao).filter(
                Categoria.tipo == 'despesa',
                Transacao.data >= start_of_month,
                Transacao.status == 'Efetivada'
            ).group_by(Categoria.id).all()
        
        rosca_labels = [g[0] for g in gastos_cat]
        rosca_colors = [g[1] for g in gastos_cat]
        rosca_data = [g[2] for g in gastos_cat]

        # Evolução Mensal
        evolucao_labels, evol_rec, evol_desp = [], [], []
        for i in range(5, -1, -1):
            mes_alvo = today - relativedelta(months=i)
            ini = mes_alvo.replace(day=1, hour=0, minute=0, second=0)
            fim = ini + relativedelta(months=1)
            
            meses_pt = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
            evolucao_labels.append(f"{meses_pt[ini.month-1]}/{ini.year % 100}")

            r = db.query(func.sum(Transacao.valor)).join(Categoria).filter(
                Categoria.tipo == 'receita', Transacao.data >= ini, Transacao.data < fim, Transacao.status == 'Efetivada'
            ).scalar() or 0.0
            d = db.query(func.sum(Transacao.valor)).join(Categoria).filter(
                Categoria.tipo == 'despesa', Transacao.data >= ini, Transacao.data < fim, Transacao.status == 'Efetivada'
            ).scalar() or 0.0
            
            evol_rec.append(r)
            evol_desp.append(d)

        # Gasto Semanal (Placeholder por enquanto)
        semanal_labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
        semanal_data = [0, 0, 0, 0, 0, 0, 0] 

        # --- DADOS DE AGENDA E COFRE (Placeholders) ---
        # Quando criar os models, basta descomentar e ajustar as queries aqui
        kpis = {
            "receita_mes": receita,
            "despesa_mes": despesa,
            "balanco_mes": receita - despesa,
            "compromissos_realizados": 0, 
            "compromissos_pendentes": 0,
            "compromissos_perdidos": 0,
            "chaves_ativas": 0,
            "chaves_expiradas": 0,
            "proximo_compromisso": None
        }

        # Dropdown de filtro (usa Categorias)
        cats_filtro = db.query(Categoria).filter(Categoria.tipo == 'despesa').all()

        return {
            "kpis": kpis,
            "gastos_por_categoria": {"labels": rosca_labels, "data": rosca_data, "colors": rosca_colors},
            "evolucao_mensal_receita": evol_rec,
            "evolucao_mensal_despesa": evol_desp,
            "evolucao_labels": evolucao_labels,
            "gasto_semanal": {"labels": semanal_labels, "data": semanal_data},
            "categorias_para_filtro": cats_filtro
        }

    # --- NOVO MÉTODO PARA O GRÁFICO DINÂMICO ---
    def get_category_history(self, db: Session, category_id: int):
        labels = []
        data = []
        today = datetime.now()

        for i in range(5, -1, -1):
            mes_alvo = today - relativedelta(months=i)
            ini = mes_alvo.replace(day=1, hour=0, minute=0, second=0)
            fim = ini + relativedelta(months=1)
            
            meses_pt = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
            labels.append(f"{meses_pt[ini.month-1]}/{ini.year % 100}")

            total = db.query(func.sum(Transacao.valor)).filter(
                Transacao.categoria_id == category_id,
                Transacao.data >= ini,
                Transacao.data < fim,
                Transacao.status == 'Efetivada'
            ).scalar() or 0.0
            
            data.append(total)
            
        return {"labels": labels, "data": data}

panorama_service = PanoramaService()