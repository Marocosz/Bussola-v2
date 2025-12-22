from sqlalchemy.orm import Session
from sqlalchemy import func, case
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from app.models.registros import GrupoAnotacao, Anotacao, Link, Tarefa, Subtarefa
from datetime import datetime

class RegistrosService:
    
    # --- GRUPOS ---
    def get_grupos(self, db: Session, user_id: int):
        # [SEGURANÇA]
        return db.query(GrupoAnotacao).filter(GrupoAnotacao.user_id == user_id).all()

    def create_grupo(self, db: Session, grupo_data, user_id: int):
        # Valida duplicidade apenas para esse usuário
        existe = db.query(GrupoAnotacao).filter(
            GrupoAnotacao.nome == grupo_data.nome, 
            GrupoAnotacao.user_id == user_id
        ).first()

        if existe:
             raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Já existe um grupo com o nome '{grupo_data.nome}'."
            )

        db_grupo = GrupoAnotacao(
            nome=grupo_data.nome, 
            cor=grupo_data.cor, 
            user_id=user_id # [SEGURANÇA]
        )
        db.add(db_grupo)
        db.commit()
        db.refresh(db_grupo)
        return db_grupo

    def update_grupo(self, db: Session, grupo_id: int, grupo_data, user_id: int):
        # [SEGURANÇA]
        grupo = db.query(GrupoAnotacao).filter(GrupoAnotacao.id == grupo_id, GrupoAnotacao.user_id == user_id).first()
        if not grupo: return None
        grupo.nome = grupo_data.nome
        if grupo_data.cor: grupo.cor = grupo_data.cor
        db.commit()
        db.refresh(grupo)
        return grupo

    def delete_grupo(self, db: Session, grupo_id: int, user_id: int):
        # [SEGURANÇA]
        grupo = db.query(GrupoAnotacao).filter(GrupoAnotacao.id == grupo_id, GrupoAnotacao.user_id == user_id).first()
        if not grupo: return None
        
        # Desvincula anotações do usuário (segurança reforçada)
        anotacoes = db.query(Anotacao).filter(Anotacao.grupo_id == grupo_id, Anotacao.user_id == user_id).all()
        for nota in anotacoes: nota.grupo_id = None
        
        db.delete(grupo)
        db.commit()
        return True

    # --- ANOTAÇÕES ---
    def create_anotacao(self, db: Session, nota_data, user_id: int):
        # Verifica se o grupo pertence ao usuário
        if nota_data.grupo_id:
            grupo = db.query(GrupoAnotacao).filter(
                GrupoAnotacao.id == nota_data.grupo_id, 
                GrupoAnotacao.user_id == user_id
            ).first()
            if not grupo: raise HTTPException(status_code=400, detail="Grupo inválido ou não pertence a você.")

        nova_nota = Anotacao(
            titulo=nota_data.titulo, conteudo=nota_data.conteudo,
            fixado=nota_data.fixado, grupo_id=nota_data.grupo_id if nota_data.grupo_id else None,
            user_id=user_id # [SEGURANÇA]
        )
        db.add(nova_nota)
        db.flush()
        if nota_data.links:
            for link_url in nota_data.links:
                if link_url.strip(): db.add(Link(url=link_url, anotacao_id=nova_nota.id))
        db.commit()
        db.refresh(nova_nota)
        return nova_nota

    def update_anotacao(self, db: Session, nota_id: int, nota_data, user_id: int):
        # [SEGURANÇA]
        nota = db.query(Anotacao).filter(Anotacao.id == nota_id, Anotacao.user_id == user_id).first()
        if not nota: return None
        
        # Verifica se o novo grupo pertence ao usuário
        if nota_data.grupo_id:
            grupo = db.query(GrupoAnotacao).filter(
                GrupoAnotacao.id == nota_data.grupo_id, 
                GrupoAnotacao.user_id == user_id
            ).first()
            if not grupo: raise HTTPException(status_code=400, detail="Grupo inválido ou não pertence a você.")

        nota.titulo = nota_data.titulo
        nota.conteudo = nota_data.conteudo
        nota.fixado = nota_data.fixado
        nota.grupo_id = nota_data.grupo_id
        db.query(Link).filter(Link.anotacao_id == nota.id).delete()
        if nota_data.links:
            for link_url in nota_data.links:
                if link_url.strip(): db.add(Link(url=link_url, anotacao_id=nota.id))
        db.commit()
        db.refresh(nota)
        return nota

    def delete_anotacao(self, db: Session, nota_id: int, user_id: int):
        # [SEGURANÇA]
        nota = db.query(Anotacao).filter(Anotacao.id == nota_id, Anotacao.user_id == user_id).first()
        if not nota: return None
        db.delete(nota)
        db.commit()
        return True

    def toggle_fixar(self, db: Session, nota_id: int, user_id: int):
        # [SEGURANÇA]
        nota = db.query(Anotacao).filter(Anotacao.id == nota_id, Anotacao.user_id == user_id).first()
        if not nota: return None
        nota.fixado = not nota.fixado
        db.commit()
        db.refresh(nota)
        return nota

    # --- TAREFAS (COM RECURSIVIDADE) ---
    
    # Função auxiliar recursiva para salvar árvore de subtarefas
    # (Mantém igual pois é chamada internamente por métodos já seguros)
    def _create_subtarefas_recursivo(self, db: Session, lista_subs, tarefa_id, parent_id=None):
        for sub_data in lista_subs:
            nova_sub = Subtarefa(
                titulo=sub_data.titulo,
                concluido=sub_data.concluido,
                tarefa_id=tarefa_id,
                parent_id=parent_id
            )
            db.add(nova_sub)
            db.flush() # Preciso do ID gerado para os filhos
            
            if sub_data.subtarefas:
                self._create_subtarefas_recursivo(db, sub_data.subtarefas, tarefa_id, nova_sub.id)

    def create_tarefa(self, db: Session, tarefa_data, user_id: int):
        nova_tarefa = Tarefa(
            titulo=tarefa_data.titulo,
            descricao=tarefa_data.descricao,
            fixado=tarefa_data.fixado,
            prioridade=tarefa_data.prioridade,
            prazo=tarefa_data.prazo,
            user_id=user_id # [SEGURANÇA]
        )
        db.add(nova_tarefa)
        db.flush() # ID para subtarefas

        # Criação Recursiva
        if tarefa_data.subtarefas:
            self._create_subtarefas_recursivo(db, tarefa_data.subtarefas, nova_tarefa.id, None)

        db.commit()
        db.refresh(nova_tarefa)
        return nova_tarefa

    def update_tarefa(self, db: Session, tarefa_id: int, tarefa_data, user_id: int):
        # [SEGURANÇA]
        tarefa = db.query(Tarefa).filter(Tarefa.id == tarefa_id, Tarefa.user_id == user_id).first()
        if not tarefa: return None
        
        # Atualiza campos básicos
        if tarefa_data.titulo is not None: tarefa.titulo = tarefa_data.titulo
        if tarefa_data.descricao is not None: tarefa.descricao = tarefa_data.descricao
        if tarefa_data.prioridade is not None: tarefa.prioridade = tarefa_data.prioridade
        if tarefa_data.prazo is not None: tarefa.prazo = tarefa_data.prazo
        if tarefa_data.fixado is not None: tarefa.fixado = tarefa_data.fixado
        if tarefa_data.status is not None: 
            tarefa.status = tarefa_data.status
            tarefa.data_conclusao = datetime.now() if tarefa.status == "Concluído" else None

        # Estratégia de Atualização de Subtarefas
        if tarefa_data.subtarefas is not None:
            # 1. Remove todas as subtarefas antigas desta tarefa
            db.query(Subtarefa).filter(Subtarefa.tarefa_id == tarefa.id).delete()
            # 2. Recria a árvore baseada no payload
            self._create_subtarefas_recursivo(db, tarefa_data.subtarefas, tarefa.id, None)

        db.commit()
        db.refresh(tarefa)
        return tarefa

    def update_status_tarefa(self, db: Session, tarefa_id: int, status: str, user_id: int):
        # [SEGURANÇA]
        tarefa = db.query(Tarefa).filter(Tarefa.id == tarefa_id, Tarefa.user_id == user_id).first()
        if not tarefa: return None
        tarefa.status = status
        tarefa.data_conclusao = datetime.now() if status == "Concluído" else None
        db.commit()
        db.refresh(tarefa)
        return tarefa

    def delete_tarefa(self, db: Session, tarefa_id: int, user_id: int):
        # [SEGURANÇA]
        tarefa = db.query(Tarefa).filter(Tarefa.id == tarefa_id, Tarefa.user_id == user_id).first()
        if not tarefa: return None
        db.delete(tarefa)
        db.commit()
        return True

    # --- SUBTAREFAS ---
    def add_subtarefa(self, db: Session, tarefa_id: int, titulo: str, user_id: int, parent_id: int = None):
        # [SEGURANÇA] Verifica se a tarefa pai pertence ao usuário
        tarefa = db.query(Tarefa).filter(Tarefa.id == tarefa_id, Tarefa.user_id == user_id).first()
        if not tarefa: raise HTTPException(status_code=404, detail="Tarefa não encontrada ou não pertence a você.")

        nova_sub = Subtarefa(titulo=titulo, tarefa_id=tarefa_id, parent_id=parent_id)
        db.add(nova_sub)
        db.commit()
        db.refresh(nova_sub)
        return nova_sub

    # [NOVO] Toggle com Cascata
    def toggle_subtarefa(self, db: Session, sub_id: int, user_id: int):
        # [SEGURANÇA] Join com Tarefa para garantir que a subtarefa pertence a uma tarefa do usuário
        sub = db.query(Subtarefa).join(Tarefa).filter(
            Subtarefa.id == sub_id, 
            Tarefa.user_id == user_id
        ).first()
        
        if not sub: return None
        
        novo_status = not sub.concluido
        sub.concluido = novo_status
        
        # Função interna para atualizar filhos recursivamente
        def update_children(parent_sub):
            for child in parent_sub.subtarefas:
                child.concluido = novo_status
                update_children(child)
        
        update_children(sub)

        db.commit()
        db.refresh(sub)
        return sub

    # --- DASHBOARD ---
    def get_dashboard_data(self, db: Session, user_id: int):
        # 1. Anotações (Filtro por user_id)
        fixadas = db.query(Anotacao).filter(Anotacao.fixado == True, Anotacao.user_id == user_id).all()
        nao_fixadas = db.query(Anotacao).filter(Anotacao.fixado == False, Anotacao.user_id == user_id).order_by(Anotacao.data_criacao.desc()).all()
        
        por_mes = {}
        for nota in nao_fixadas:
            mes_ano = nota.data_criacao.strftime("%B %Y").capitalize()
            meses_pt = {'January': 'Janeiro', 'February': 'Fevereiro', 'March': 'Março', 'April': 'Abril', 'May': 'Maio', 'June': 'Junho', 'July': 'Julho', 'August': 'Agosto', 'September': 'Setembro', 'October': 'Outubro', 'November': 'Novembro', 'December': 'Dezembro'}
            for eng, pt in meses_pt.items():
                if eng in mes_ano:
                    mes_ano = mes_ano.replace(eng, pt)
                    break
            if mes_ano not in por_mes: por_mes[mes_ano] = []
            por_mes[mes_ano].append(nota)

        # 2. Tarefas Pendentes (Filtro por user_id)
        ordenacao_prioridade = case(
            (Tarefa.prioridade == 'Crítica', 1),
            (Tarefa.prioridade == 'Alta', 2),
            (Tarefa.prioridade == 'Média', 3),
            (Tarefa.prioridade == 'Baixa', 4),
            else_=5
        )

        t_pendentes = db.query(Tarefa)\
            .filter(Tarefa.status != 'Concluído', Tarefa.user_id == user_id)\
            .order_by(ordenacao_prioridade.asc(), Tarefa.prazo.asc().nullslast(), Tarefa.id.desc())\
            .all()

        t_concluidas = db.query(Tarefa).filter(Tarefa.status == 'Concluído', Tarefa.user_id == user_id).order_by(Tarefa.data_conclusao.desc()).limit(10).all()
        
        grupos = db.query(GrupoAnotacao).filter(GrupoAnotacao.user_id == user_id).all()

        return {
            "anotacoes_fixadas": fixadas, "anotacoes_por_mes": por_mes,
            "tarefas_pendentes": t_pendentes, "tarefas_concluidas": t_concluidas,
            "grupos_disponiveis": grupos
        }

registros_service = RegistrosService()