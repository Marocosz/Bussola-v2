from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.registros import GrupoAnotacao, Anotacao, Link, Tarefa, Subtarefa
from datetime import datetime

class RegistrosService:
    
    # --- GRUPOS ---
    def get_grupos(self, db: Session):
        return db.query(GrupoAnotacao).all()

    def create_grupo(self, db: Session, grupo_data):
        db_grupo = GrupoAnotacao(nome=grupo_data.nome, cor=grupo_data.cor)
        db.add(db_grupo)
        db.commit()
        db.refresh(db_grupo)
        return db_grupo

    # [NOVO] Atualizar Grupo
    def update_grupo(self, db: Session, grupo_id: int, grupo_data):
        grupo = db.query(GrupoAnotacao).filter(GrupoAnotacao.id == grupo_id).first()
        if not grupo:
            return None
        
        grupo.nome = grupo_data.nome
        if grupo_data.cor:
            grupo.cor = grupo_data.cor
            
        db.commit()
        db.refresh(grupo)
        return grupo

    # [NOVO] Deletar Grupo
    def delete_grupo(self, db: Session, grupo_id: int):
        grupo = db.query(GrupoAnotacao).filter(GrupoAnotacao.id == grupo_id).first()
        if not grupo:
            return None
        
        # Lógica: Mover anotações para NULL (Indefinido) ou deletar?
        # Geralmente movemos para null para não perder dados
        anotacoes = db.query(Anotacao).filter(Anotacao.grupo_id == grupo_id).all()
        for nota in anotacoes:
            nota.grupo_id = None
            
        db.delete(grupo)
        db.commit()
        return True

    # --- ANOTAÇÕES ---
    def create_anotacao(self, db: Session, nota_data):
        # Cria a anotação
        nova_nota = Anotacao(
            titulo=nota_data.titulo,
            conteudo=nota_data.conteudo,
            fixado=nota_data.fixado,
            grupo_id=nota_data.grupo_id if nota_data.grupo_id else None
        )
        db.add(nova_nota)
        db.flush() # Gera o ID para usar nos links

        # Cria Links
        if nota_data.links:
            for link_url in nota_data.links:
                if link_url.strip():
                    novo_link = Link(url=link_url, anotacao_id=nova_nota.id)
                    db.add(novo_link)
        
        db.commit()
        db.refresh(nova_nota)
        return nova_nota

    def update_anotacao(self, db: Session, nota_id: int, nota_data):
        nota = db.query(Anotacao).filter(Anotacao.id == nota_id).first()
        if not nota:
            return None
        
        nota.titulo = nota_data.titulo
        nota.conteudo = nota_data.conteudo
        nota.fixado = nota_data.fixado
        nota.grupo_id = nota_data.grupo_id

        # Atualizar Links (Remove todos e cria novos - estratégia simples)
        db.query(Link).filter(Link.anotacao_id == nota.id).delete()
        if nota_data.links:
            for link_url in nota_data.links:
                if link_url.strip():
                    db.add(Link(url=link_url, anotacao_id=nota.id))

        db.commit()
        db.refresh(nota)
        return nota

    def delete_anotacao(self, db: Session, nota_id: int):
        nota = db.query(Anotacao).filter(Anotacao.id == nota_id).first()
        if not nota:
            return None
        db.delete(nota)
        db.commit()
        return True

    # [CORREÇÃO DO ERRO] Função que faltava
    def toggle_fixar(self, db: Session, nota_id: int):
        nota = db.query(Anotacao).filter(Anotacao.id == nota_id).first()
        if not nota:
            return None
        
        nota.fixado = not nota.fixado
        db.commit()
        db.refresh(nota)
        return nota

    # --- TAREFAS ---
    def create_tarefa(self, db: Session, tarefa_data):
        nova_tarefa = Tarefa(
            titulo=tarefa_data.titulo,
            descricao=tarefa_data.descricao,
            fixado=tarefa_data.fixado,
            prioridade=tarefa_data.prioridade, # NOVO
            prazo=tarefa_data.prazo            # NOVO
        )
        db.add(nova_tarefa)
        db.commit()
        db.refresh(nova_tarefa)
        return nova_tarefa

    # [NOVO] Função para atualização completa da tarefa (Titulo, Prioridade, Prazo, etc)
    def update_tarefa(self, db: Session, tarefa_id: int, tarefa_data):
        tarefa = db.query(Tarefa).filter(Tarefa.id == tarefa_id).first()
        if not tarefa:
            return None
        
        # Atualiza campos se eles vierem no payload
        if tarefa_data.titulo is not None:
            tarefa.titulo = tarefa_data.titulo
        if tarefa_data.descricao is not None:
            tarefa.descricao = tarefa_data.descricao
        if tarefa_data.prioridade is not None:
            tarefa.prioridade = tarefa_data.prioridade
        if tarefa_data.prazo is not None:
            tarefa.prazo = tarefa_data.prazo
        if tarefa_data.fixado is not None:
            tarefa.fixado = tarefa_data.fixado
        if tarefa_data.status is not None:
            tarefa.status = tarefa_data.status
            if tarefa_data.status == "Concluído":
                tarefa.data_conclusao = datetime.now()
            else:
                tarefa.data_conclusao = None

        db.commit()
        db.refresh(tarefa)
        return tarefa

    def update_status_tarefa(self, db: Session, tarefa_id: int, status: str):
        tarefa = db.query(Tarefa).filter(Tarefa.id == tarefa_id).first()
        if not tarefa:
            return None
        
        tarefa.status = status
        if status == "Concluído":
            tarefa.data_conclusao = datetime.now()
        else:
            tarefa.data_conclusao = None
            
        db.commit()
        db.refresh(tarefa)
        return tarefa

    def delete_tarefa(self, db: Session, tarefa_id: int):
        tarefa = db.query(Tarefa).filter(Tarefa.id == tarefa_id).first()
        if not tarefa:
            return None
        db.delete(tarefa)
        db.commit()
        return True

    # --- SUBTAREFAS ---
    def add_subtarefa(self, db: Session, tarefa_id: int, titulo: str):
        nova_sub = Subtarefa(titulo=titulo, tarefa_id=tarefa_id)
        db.add(nova_sub)
        db.commit()
        db.refresh(nova_sub)
        return nova_sub

    def toggle_subtarefa(self, db: Session, sub_id: int):
        sub = db.query(Subtarefa).filter(Subtarefa.id == sub_id).first()
        if not sub:
            return None
        sub.concluido = not sub.concluido
        db.commit()
        db.refresh(sub)
        return sub

    # --- DASHBOARD ---
    def get_dashboard_data(self, db: Session):
        # 1. Fixadas
        fixadas = db.query(Anotacao).filter(Anotacao.fixado == True).all()
        
        # 2. Por Mês (Não fixadas)
        nao_fixadas = db.query(Anotacao).filter(Anotacao.fixado == False).order_by(Anotacao.data_criacao.desc()).all()
        
        # Agrupamento por Mês
        por_mes = {}
        for nota in nao_fixadas:
            mes_ano = nota.data_criacao.strftime("%B %Y").capitalize() # Ex: Outubro 2023
            # Tradução simples manual
            meses_pt = {
                'January': 'Janeiro', 'February': 'Fevereiro', 'March': 'Março', 'April': 'Abril',
                'May': 'Maio', 'June': 'Junho', 'July': 'Julho', 'August': 'Agosto',
                'September': 'Setembro', 'October': 'Outubro', 'November': 'Novembro', 'December': 'Dezembro'
            }
            for eng, pt in meses_pt.items():
                if eng in mes_ano:
                    mes_ano = mes_ano.replace(eng, pt)
                    break
            
            if mes_ano not in por_mes:
                por_mes[mes_ano] = []
            por_mes[mes_ano].append(nota)

        # 3. Tarefas
        t_pendentes = db.query(Tarefa).filter(Tarefa.status != 'Concluído').all()
        t_concluidas = db.query(Tarefa).filter(Tarefa.status == 'Concluído').order_by(Tarefa.data_conclusao.desc()).limit(10).all()

        # 4. Grupos
        grupos = db.query(GrupoAnotacao).all()

        return {
            "anotacoes_fixadas": fixadas,
            "anotacoes_por_mes": por_mes,
            "tarefas_pendentes": t_pendentes,
            "tarefas_concluidas": t_concluidas,
            "grupos_disponiveis": grupos
        }

registros_service = RegistrosService()