from sqlalchemy.orm import Session
from sqlalchemy import desc
from collections import defaultdict
from datetime import datetime
from app.models.registros import Anotacao, Link, GrupoAnotacao, Tarefa, Subtarefa, StatusTarefa
from app.schemas.registros import AnotacaoCreate, AnotacaoUpdate, TarefaCreate, TarefaUpdate, GrupoCreate

class RegistrosService:
    
    # ==========================
    # DASHBOARD & GRUPOS
    # ==========================
    def get_dashboard(self, db: Session):
        # 1. Busca Anotações
        notas_db = db.query(Anotacao).order_by(Anotacao.fixado.desc(), Anotacao.data_criacao.desc()).all()
        
        fixadas = []
        por_mes = defaultdict(list)
        meses_traducao = {
            1: "Janeiro", 2: "Fevereiro", 3: "Março", 4: "Abril", 5: "Maio", 6: "Junho",
            7: "Julho", 8: "Agosto", 9: "Setembro", 10: "Outubro", 11: "Novembro", 12: "Dezembro"
        }

        for nota in notas_db:
            if nota.fixado:
                fixadas.append(nota)
            else:
                mes_key = f"{meses_traducao[nota.data_criacao.month]}/{nota.data_criacao.year}"
                por_mes[mes_key].append(nota)
        
        # 2. Busca Tarefas
        tarefas_db = db.query(Tarefa).order_by(Tarefa.fixado.desc(), Tarefa.data_criacao.desc()).all()
        pendentes = [t for t in tarefas_db if t.status != StatusTarefa.CONCLUIDO.value]
        concluidas = [t for t in tarefas_db if t.status == StatusTarefa.CONCLUIDO.value]

        # 3. Busca Grupos
        grupos = db.query(GrupoAnotacao).all()

        return {
            "anotacoes_fixadas": fixadas,
            "anotacoes_por_mes": por_mes,
            "tarefas_pendentes": pendentes,
            "tarefas_concluidas": concluidas,
            "grupos_disponiveis": grupos
        }

    def create_grupo(self, db: Session, dados: GrupoCreate):
        grupo = GrupoAnotacao(nome=dados.nome, cor=dados.cor)
        db.add(grupo)
        db.commit()
        db.refresh(grupo)
        return grupo

    # ==========================
    # ANOTAÇÕES
    # ==========================
    def create_anotacao(self, db: Session, dados: AnotacaoCreate):
        nova = Anotacao(
            titulo=dados.titulo,
            conteudo=dados.conteudo,
            fixado=dados.fixado,
            grupo_id=dados.grupo_id
        )
        db.add(nova)
        db.flush()

        if dados.links:
            for url in dados.links:
                if url.strip():
                    db.add(Link(url=url, anotacao_id=nova.id))
        
        db.commit()
        db.refresh(nova)
        return nova

    def update_anotacao(self, db: Session, id: int, dados: AnotacaoUpdate):
        nota = db.query(Anotacao).get(id)
        if not nota: return None

        if dados.titulo is not None: nota.titulo = dados.titulo
        if dados.conteudo is not None: nota.conteudo = dados.conteudo
        if dados.fixado is not None: nota.fixado = dados.fixado
        if dados.grupo_id is not None: nota.grupo_id = dados.grupo_id

        if dados.links is not None:
            db.query(Link).filter(Link.anotacao_id == id).delete()
            for url in dados.links:
                if url.strip():
                    db.add(Link(url=url, anotacao_id=id))
        
        db.commit()
        db.refresh(nota)
        return nota

    def delete_anotacao(self, db: Session, id: int):
        nota = db.query(Anotacao).get(id)
        if nota:
            db.delete(nota)
            db.commit()
            return True
        return False

    # ==========================
    # TAREFAS
    # ==========================
    def create_tarefa(self, db: Session, dados: TarefaCreate):
        nova_tarefa = Tarefa(
            titulo=dados.titulo,
            descricao=dados.descricao,
            status=dados.status,
            fixado=dados.fixado
        )
        db.add(nova_tarefa)
        db.flush()

        if dados.subtarefas:
            for sub in dados.subtarefas:
                db.add(Subtarefa(
                    titulo=sub.titulo,
                    concluido=sub.concluido,
                    tarefa_id=nova_tarefa.id
                ))
        
        db.commit()
        db.refresh(nova_tarefa)
        return nova_tarefa

    def update_tarefa_status(self, db: Session, id: int, novo_status: str):
        tarefa = db.query(Tarefa).get(id)
        if not tarefa: return None
        
        tarefa.status = novo_status
        if novo_status == StatusTarefa.CONCLUIDO.value:
            tarefa.data_conclusao = datetime.utcnow()
        else:
            tarefa.data_conclusao = None
            
        db.commit()
        return tarefa

    def add_subtarefa(self, db: Session, tarefa_id: int, titulo: str):
        sub = Subtarefa(titulo=titulo, tarefa_id=tarefa_id, concluido=False)
        db.add(sub)
        db.commit()
        db.refresh(sub)
        return sub

    def toggle_subtarefa(self, db: Session, sub_id: int):
        sub = db.query(Subtarefa).get(sub_id)
        if sub:
            sub.concluido = not sub.concluido
            db.commit()
            # Opcional: Aqui você pode verificar se todas estão concluídas e fechar a tarefa pai
            # self.check_auto_complete(db, sub.tarefa_id) 
        return sub

    def delete_tarefa(self, db: Session, id: int):
        tarefa = db.query(Tarefa).get(id)
        if tarefa:
            db.delete(tarefa)
            db.commit()
            return True
        return False

registros_service = RegistrosService()