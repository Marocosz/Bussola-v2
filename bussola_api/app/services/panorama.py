from sqlalchemy.orm import Session
from sqlalchemy import func, case, and_, or_
from datetime import datetime
from dateutil.relativedelta import relativedelta

# Importação dos Models
from app.models.financas import Transacao, Categoria
from app.models.agenda import Compromisso 
from app.models.registros import Anotacao, Tarefa, GrupoAnotacao
from app.models.cofre import Segredo 

class PanoramaService:
    
    def get_dashboard_data(self, db: Session):
        today = datetime.now()
        start_of_month = today.replace(day=1, hour=0, minute=0, second=0)
        next_month = start_of_month + relativedelta(months=1)

        # ==========================================
        # 1. FINANÇAS
        # ==========================================
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

        # ==========================================
        # 2. AGENDA (Compromissos) - CORRIGIDO: data_hora
        # ==========================================
        # Realizados: Passados e não cancelados
        comp_realizados = db.query(func.count(Compromisso.id)).filter(
            Compromisso.data_hora < today,
            Compromisso.status != 'Cancelado' 
        ).scalar() or 0

        # Pendentes: Futuros a partir de agora
        comp_pendentes = db.query(func.count(Compromisso.id)).filter(
            Compromisso.data_hora >= today,
            Compromisso.status != 'Cancelado'
        ).scalar() or 0

        # Perdidos: Passados com status Pendente
        comp_perdidos = db.query(func.count(Compromisso.id)).filter(
            Compromisso.data_hora < today,
            Compromisso.status == 'Pendente' 
        ).scalar() or 0
        
        # Próximo Compromisso
        proximo_comp_obj = db.query(Compromisso).filter(
            Compromisso.data_hora >= today,
            Compromisso.status != 'Cancelado'
        ).order_by(Compromisso.data_hora.asc()).first()
        
        proximo_comp = None
        if proximo_comp_obj:
            proximo_comp = {
                "titulo": proximo_comp_obj.titulo,
                "data": proximo_comp_obj.data_hora, # Corrigido
                "cor": getattr(proximo_comp_obj, 'cor', '#3b82f6') # Fallback se não tiver cor
            }

        # ==========================================
        # 3. REGISTROS (Anotações e Tarefas)
        # ==========================================
        total_anotacoes = db.query(func.count(Anotacao.id)).scalar() or 0
        
        # Tarefas Pendentes Detalhadas
        tarefas_stats = db.query(
            Tarefa.prioridade, 
            func.count(Tarefa.id)
        ).filter(
            Tarefa.status != 'Concluído'
        ).group_by(Tarefa.prioridade).all()
        
        # Converte lista de tuplas em dict
        t_dict = {prioridade: count for prioridade, count in tarefas_stats}
        
        tarefas_pendentes_detalhe = {
            "critica": t_dict.get('Crítica', 0),
            "alta": t_dict.get('Alta', 0),
            "media": t_dict.get('Média', 0),
            "baixa": t_dict.get('Baixa', 0)
        }
        
        total_tarefas_concluidas = db.query(func.count(Tarefa.id)).filter(Tarefa.status == 'Concluído').scalar() or 0

        # ==========================================
        # 4. COFRE (Segredos)
        # ==========================================
        # Se não tiver campo de validade, conta todos como ativos
        # Verifique no seu model Segredo se existe 'data_expiracao'
        try:
            chaves_ativas = db.query(func.count(Segredo.id)).filter(or_(Segredo.data_expiracao == None, Segredo.data_expiracao >= today)).scalar() or 0
            chaves_expiradas = db.query(func.count(Segredo.id)).filter(Segredo.data_expiracao < today).scalar() or 0
        except:
            # Fallback caso o campo não exista no banco ainda
            chaves_ativas = db.query(func.count(Segredo.id)).scalar() or 0
            chaves_expiradas = 0

        # ==========================================
        # MONTAGEM KPIS
        # ==========================================
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

        # ==========================================
        # GRÁFICOS
        # ==========================================
        
        # Gráfico Rosca (Gastos por Categoria)
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

        # Gasto Semanal (Placeholder - implementar lógica de dias da semana se necessário)
        semanal_labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
        semanal_data = [0, 0, 0, 0, 0, 0, 0]
        
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

    # ==========================================
    # NOVOS MÉTODOS PARA OS MODAIS
    # ==========================================

    def get_provisoes_data(self, db: Session):
        """ Retorna transações futuras (Status = Pendente ou Data > Hoje). """
        today = datetime.now()
        
        transacoes = db.query(Transacao).join(Categoria).filter(
            or_(Transacao.status == 'Pendente', Transacao.data > today)
        ).order_by(Transacao.data.asc()).all()
        
        resultado = []
        for t in transacoes:
            tipo = "Pontual"
            if hasattr(t, 'recorrente') and t.recorrente:
                tipo = "Recorrente"
            elif hasattr(t, 'parcela_atual') and t.parcela_atual:
                tipo = f"Parcela {t.parcela_atual}/{t.parcela_total}"
            
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

    def get_roteiro_data(self, db: Session):
        """ Retorna compromissos futuros. CORRIGIDO: data_hora """
        today = datetime.now()
        compromissos = db.query(Compromisso).filter(
            Compromisso.data_hora >= today,
            Compromisso.status != 'Cancelado'
        ).order_by(Compromisso.data_hora.asc()).all()

        res = []
        for c in compromissos:
            res.append({
                "id": c.id,
                "titulo": c.titulo,
                "data_inicio": c.data_hora, # Mapeia data_hora do banco para data_inicio do schema
                "data_fim": c.data_hora, # Se não tiver fim, usa inicio como placeholder
                "tipo": "Compromisso",
                "cor": getattr(c, 'cor', '#ccc'),
                "status": c.status
            })
        return res

    def get_registros_resumo_data(self, db: Session):
        """ Retorna resumo de tarefas e anotações. """
        # Últimas 10 Anotações
        notas = db.query(Anotacao).join(GrupoAnotacao, isouter=True).order_by(Anotacao.data_criacao.desc()).limit(10).all()
        
        # Tarefas Pendentes
        ordenacao_prio = case(
            (Tarefa.prioridade == 'Crítica', 1),
            (Tarefa.prioridade == 'Alta', 2),
            (Tarefa.prioridade == 'Média', 3),
            (Tarefa.prioridade == 'Baixa', 4),
            else_=5
        )
        tarefas = db.query(Tarefa).filter(Tarefa.status != 'Concluído').order_by(ordenacao_prio.asc()).limit(15).all()
        
        res = []
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