from sqlalchemy.orm import Session
from sqlalchemy import desc
from collections import defaultdict
from app.models.registros import Anotacao, Link
from app.schemas.registros import AnotacaoCreate, AnotacaoUpdate

class RegistrosService:
    
    def get_dashboard(self, db: Session):
        todas = db.query(Anotacao).order_by(Anotacao.fixado.desc(), Anotacao.data_criacao.desc()).all()
        
        fixadas = []
        por_mes = defaultdict(list)
        
        meses_traducao = {
            1: "Janeiro", 2: "Fevereiro", 3: "Março", 4: "Abril", 5: "Maio", 6: "Junho",
            7: "Julho", 8: "Agosto", 9: "Setembro", 10: "Outubro", 11: "Novembro", 12: "Dezembro"
        }

        for nota in todas:
            if nota.fixado:
                fixadas.append(nota)
            else:
                mes_key = f"{meses_traducao[nota.data_criacao.month]}/{nota.data_criacao.year}"
                por_mes[mes_key].append(nota)
        
        return {
            "anotacoes_fixadas": fixadas,
            "anotacoes_por_mes": por_mes
        }

    def create(self, db: Session, dados: AnotacaoCreate):
        # Cria Anotação
        nova = Anotacao(
            titulo=dados.titulo,
            conteudo=dados.conteudo,
            tipo=dados.tipo,
            is_tarefa=dados.is_tarefa,
            status_tarefa='Pendente' if dados.is_tarefa else None
        )
        db.add(nova)
        db.flush() # Gera ID

        # Cria Links
        if dados.links:
            for url in dados.links:
                if url.strip():
                    db.add(Link(url=url, anotacao_id=nova.id))
        
        db.commit()
        db.refresh(nova)
        return nova

    def update(self, db: Session, id: int, dados: AnotacaoUpdate):
        nota = db.query(Anotacao).get(id)
        if not nota: return None

        if dados.titulo is not None: nota.titulo = dados.titulo
        if dados.conteudo is not None: nota.conteudo = dados.conteudo
        if dados.tipo is not None: nota.tipo = dados.tipo
        if dados.is_tarefa is not None: nota.is_tarefa = dados.is_tarefa

        # Atualizar Links (Remove todos e recria)
        if dados.links is not None:
            db.query(Link).filter(Link.anotacao_id == id).delete()
            for url in dados.links:
                if url.strip():
                    db.add(Link(url=url, anotacao_id=id))
        
        db.commit()
        db.refresh(nota)
        return nota

    def toggle_fixar(self, db: Session, id: int):
        nota = db.query(Anotacao).get(id)
        if nota:
            nota.fixado = not nota.fixado
            db.commit()
        return nota

    def toggle_tarefa(self, db: Session, id: int):
        nota = db.query(Anotacao).get(id)
        if nota and nota.is_tarefa:
            nota.status_tarefa = 'Concluído' if nota.status_tarefa == 'Pendente' else 'Pendente'
            db.commit()
        return nota

    def delete(self, db: Session, id: int):
        nota = db.query(Anotacao).get(id)
        if nota:
            db.delete(nota)
            db.commit()
            return True
        return False

registros_service = RegistrosService()