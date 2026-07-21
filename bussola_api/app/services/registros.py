"""
=======================================================================================
ARQUIVO: registros.py (Serviço de Produtividade - Notas e Tarefas)
=======================================================================================

OBJETIVO:
    Gerenciar a lógica de negócios para o módulo de produtividade, incluindo:
    - Gestão de Grupos de Anotações (Pastas).
    - CRUD de Anotações com suporte a Links e Fixação.
    - Gestão de Tarefas (To-Do) com suporte a Subtarefas aninhadas (Árvore).
    - Montagem do Dashboard de Registros (Agrupamentos temporais e por prioridade).

PARTE DO SISTEMA:
    Backend / Service Layer.

RESPONSABILIDADES:
    1. Garantir isolamento de dados por usuário (Multi-tenancy).
    2. Manipular estruturas de dados recursivas (Tarefas -> Subtarefas -> Subtarefas).
    3. Aplicar regras de cascata (ex: Completar pai completa filhos).
    4. Gerenciar integridade referencial (ex: Validar se o Grupo pertence ao usuário ao criar nota).

COMUNICAÇÃO:
    - Models: GrupoAnotacao, Anotacao, Link, Tarefa, Subtarefa.
    - Utilizado por: app.api.endpoints.registros.

=======================================================================================
"""

from sqlalchemy.orm import Session
from sqlalchemy import func, case
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from app.models.registros import GrupoAnotacao, Anotacao, Link, Tarefa, Subtarefa, Habito, HabitoRegistro
from datetime import datetime, date, timedelta

class RegistrosService:
    
    # ==============================================================================
    # 1. GESTÃO DE GRUPOS (Pastas/Categorias de Notas)
    # ==============================================================================
    
    def get_grupos(self, db: Session, user_id: int):
        """Retorna todos os grupos pertencentes ao usuário."""
        return db.query(GrupoAnotacao).filter(GrupoAnotacao.user_id == user_id).all()

    def create_grupo(self, db: Session, grupo_data, user_id: int):
        """
        Cria um novo grupo validando duplicidade de nome.
        
        Regra de Negócio:
            Nomes de grupos não precisam ser únicos globalmente, apenas únicos
            dentro do escopo do usuário (user_id).
        """
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
            user_id=user_id
        )
        db.add(db_grupo)
        db.commit()
        db.refresh(db_grupo)
        return db_grupo

    def update_grupo(self, db: Session, grupo_id: int, grupo_data, user_id: int):
        # Busca segura filtrando por ID e Dono
        grupo = db.query(GrupoAnotacao).filter(GrupoAnotacao.id == grupo_id, GrupoAnotacao.user_id == user_id).first()
        if not grupo: return None
        
        grupo.nome = grupo_data.nome
        if grupo_data.cor: grupo.cor = grupo_data.cor
        
        db.commit()
        db.refresh(grupo)
        return grupo

    def delete_grupo(self, db: Session, grupo_id: int, user_id: int):
        """
        Remove um grupo.
        
        Regra de Negócio (Soft Detach):
            Ao deletar um grupo, as anotações dentro dele NÃO são deletadas.
            Elas apenas perdem o vínculo (grupo_id = None) e vão para "Sem Grupo".
        """
        grupo = db.query(GrupoAnotacao).filter(GrupoAnotacao.id == grupo_id, GrupoAnotacao.user_id == user_id).first()
        if not grupo: return None
        
        # Desvincula anotações antes de apagar o grupo
        anotacoes = db.query(Anotacao).filter(Anotacao.grupo_id == grupo_id, Anotacao.user_id == user_id).all()
        for nota in anotacoes: nota.grupo_id = None
        
        db.delete(grupo)
        db.commit()
        return True

    # ==============================================================================
    # 2. GESTÃO DE ANOTAÇÕES (Notas & Links)
    # ==============================================================================

    def create_anotacao(self, db: Session, nota_data, user_id: int):
        """
        Cria uma nota e seus links associados.
        
        Validação de Segurança:
            Impede que o usuário vincule a nota a um grupo que não lhe pertence
            (tentativa de IDOR - Insecure Direct Object Reference).
        """
        # Verifica propriedade do grupo
        if nota_data.grupo_id:
            grupo = db.query(GrupoAnotacao).filter(
                GrupoAnotacao.id == nota_data.grupo_id, 
                GrupoAnotacao.user_id == user_id
            ).first()
            if not grupo: raise HTTPException(status_code=400, detail="Grupo inválido ou não pertence a você.")

        nova_nota = Anotacao(
            titulo=nota_data.titulo, conteudo=nota_data.conteudo,
            fixado=nota_data.fixado, grupo_id=nota_data.grupo_id if nota_data.grupo_id else None,
            user_id=user_id
        )
        db.add(nova_nota)
        
        # Flush gera o ID da nota sem comitar a transação, permitindo salvar os links
        db.flush() 
        
        if nota_data.links:
            for link_url in nota_data.links:
                if link_url.strip(): db.add(Link(url=link_url, anotacao_id=nova_nota.id))
        
        db.commit()
        db.refresh(nova_nota)
        return nova_nota

    def update_anotacao(self, db: Session, nota_id: int, nota_data, user_id: int):
        """
        Atualiza nota e substitui os links.
        
        Estratégia de Atualização de Links:
            Remove TODOS os links antigos e recria os novos enviados no payload.
            Isso simplifica a lógica de diff (saber qual editou/removeu/criou).
        """
        nota = db.query(Anotacao).filter(Anotacao.id == nota_id, Anotacao.user_id == user_id).first()
        if not nota: return None
        
        # Validação de segurança do novo grupo
        if nota_data.grupo_id:
            grupo = db.query(GrupoAnotacao).filter(
                GrupoAnotacao.id == nota_data.grupo_id, 
                GrupoAnotacao.user_id == user_id
            ).first()
            if not grupo: raise HTTPException(status_code=400, detail="Grupo inválido ou não pertence a você.")

        # Atualização de campos simples
        nota.titulo = nota_data.titulo
        nota.conteudo = nota_data.conteudo
        nota.fixado = nota_data.fixado
        nota.grupo_id = nota_data.grupo_id
        
        # Substituição de Links (Wipe & Recreate)
        db.query(Link).filter(Link.anotacao_id == nota.id).delete()
        if nota_data.links:
            for link_url in nota_data.links:
                if link_url.strip(): db.add(Link(url=link_url, anotacao_id=nota.id))
                
        db.commit()
        db.refresh(nota)
        return nota

    def delete_anotacao(self, db: Session, nota_id: int, user_id: int):
        nota = db.query(Anotacao).filter(Anotacao.id == nota_id, Anotacao.user_id == user_id).first()
        if not nota: return None
        db.delete(nota) # Cascade no banco deve deletar links
        db.commit()
        return True

    def toggle_fixar(self, db: Session, nota_id: int, user_id: int):
        """Alterna o estado de fixação (Pin) da nota."""
        nota = db.query(Anotacao).filter(Anotacao.id == nota_id, Anotacao.user_id == user_id).first()
        if not nota: return None
        nota.fixado = not nota.fixado
        db.commit()
        db.refresh(nota)
        return nota

    # ==============================================================================
    # 3. GESTÃO DE TAREFAS (Árvore Recursiva de Subtarefas)
    # ==============================================================================
    
    def _create_subtarefas_recursivo(self, db: Session, lista_subs, tarefa_id, parent_id=None):
        """
        Helper recursivo para salvar a árvore de subtarefas.
        
        Como funciona:
        1. Salva a subtarefa atual.
        2. Executa db.flush() para obter o ID gerado pelo banco.
        3. Se houver filhos ('subtarefas' no payload), chama a si mesma passando o novo ID como parent_id.
        """
        for sub_data in lista_subs:
            nova_sub = Subtarefa(
                titulo=sub_data.titulo,
                concluido=sub_data.concluido,
                tarefa_id=tarefa_id,
                parent_id=parent_id
            )
            db.add(nova_sub)
            db.flush() # CRÍTICO: Garante que nova_sub.id exista para ser usado como parent dos filhos
            
            if sub_data.subtarefas:
                self._create_subtarefas_recursivo(db, sub_data.subtarefas, tarefa_id, nova_sub.id)

    def create_tarefa(self, db: Session, tarefa_data, user_id: int):
        """Cria a Tarefa Raiz e dispara a criação recursiva das subtarefas."""
        # Nova tarefa entra no fim da coluna do seu status.
        status_novo = tarefa_data.status or "Pendente"
        max_ordem = (
            db.query(func.max(Tarefa.ordem))
            .filter(Tarefa.user_id == user_id, Tarefa.status == status_novo)
            .scalar()
        )
        proxima_ordem = (max_ordem + 1) if max_ordem is not None else 0

        nova_tarefa = Tarefa(
            titulo=tarefa_data.titulo,
            descricao=tarefa_data.descricao,
            fixado=tarefa_data.fixado,
            prioridade=tarefa_data.prioridade,
            prazo=tarefa_data.prazo,
            status=status_novo,
            ordem=proxima_ordem,
            user_id=user_id
        )
        db.add(nova_tarefa)
        db.flush() # ID para subtarefas

        # Início da recursão
        if tarefa_data.subtarefas:
            self._create_subtarefas_recursivo(db, tarefa_data.subtarefas, nova_tarefa.id, None)

        db.commit()
        db.refresh(nova_tarefa)
        return nova_tarefa

    def update_tarefa(self, db: Session, tarefa_id: int, tarefa_data, user_id: int):
        """
        Atualiza a tarefa e REESTRUTURA a árvore de subtarefas.
        
        Estratégia Destrutiva (Simplificação):
            Para lidar com a complexidade de mover nós, deletar e adicionar em uma árvore,
            optamos por DELETAR todas as subtarefas antigas e RECRIAR a estrutura nova.
            Isso garante consistência com o estado enviado pelo frontend.
        """
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
            # Define data de conclusão automática
            tarefa.data_conclusao = datetime.now() if tarefa.status == "Concluído" else None

        # Reconstrução da Árvore
        if tarefa_data.subtarefas is not None:
            # 1. Limpeza total dos filhos
            db.query(Subtarefa).filter(Subtarefa.tarefa_id == tarefa.id).delete()
            # 2. Recriação baseada no payload atual
            self._create_subtarefas_recursivo(db, tarefa_data.subtarefas, tarefa.id, None)

        db.commit()
        db.refresh(tarefa)
        return tarefa

    def update_status_tarefa(self, db: Session, tarefa_id: int, status: str, user_id: int):
        """Atualização rápida de status (Kanban drag-and-drop)."""
        tarefa = db.query(Tarefa).filter(Tarefa.id == tarefa_id, Tarefa.user_id == user_id).first()
        if not tarefa: return None
        tarefa.status = status
        tarefa.data_conclusao = datetime.now() if status == "Concluído" else None
        db.commit()
        db.refresh(tarefa)
        return tarefa

    def reordenar_tarefas(self, db: Session, user_id: int, status: str, tarefa_ids: list):
        """
        Persiste a nova ordem/coluna de um drop do board.

        Para cada id (na ordem recebida) que pertença ao usuário: grava `ordem = índice`,
        aplica o `status` destino e ajusta `data_conclusao` (seta se virou 'Concluído',
        limpa caso contrário). Ids alheios são ignorados.
        """
        tarefas = (
            db.query(Tarefa)
            .filter(Tarefa.id.in_(tarefa_ids), Tarefa.user_id == user_id)
            .all()
        )
        por_id = {t.id: t for t in tarefas}

        for indice, tid in enumerate(tarefa_ids):
            tarefa = por_id.get(tid)
            if tarefa is None:
                continue
            tarefa.ordem = indice
            tarefa.status = status
            if status == "Concluído":
                if tarefa.data_conclusao is None:
                    tarefa.data_conclusao = datetime.now()
            else:
                tarefa.data_conclusao = None

        db.commit()

    def delete_tarefa(self, db: Session, tarefa_id: int, user_id: int):
        # O banco deve ter cascade configurado, senão precisaria deletar subtarefas manualmente
        tarefa = db.query(Tarefa).filter(Tarefa.id == tarefa_id, Tarefa.user_id == user_id).first()
        if not tarefa: return None
        db.delete(tarefa)
        db.commit()
        return True

    # ==============================================================================
    # 4. OPERAÇÕES EM SUBTAREFAS (Nós da Árvore)
    # ==============================================================================

    def add_subtarefa(self, db: Session, tarefa_id: int, titulo: str, user_id: int, parent_id: int = None):
        """Adiciona um nó avulso na árvore."""
        # [SEGURANÇA] Verifica se a tarefa RAIZ pertence ao usuário
        tarefa = db.query(Tarefa).filter(Tarefa.id == tarefa_id, Tarefa.user_id == user_id).first()
        if not tarefa: raise HTTPException(status_code=404, detail="Tarefa não encontrada ou não pertence a você.")

        nova_sub = Subtarefa(titulo=titulo, tarefa_id=tarefa_id, parent_id=parent_id)
        db.add(nova_sub)
        db.commit()
        db.refresh(nova_sub)
        return nova_sub

    def toggle_subtarefa(self, db: Session, sub_id: int, user_id: int):
        """
        Alterna status (Concluído/Não Concluído) com EFEITO CASCATA.
        
        Regra de Negócio:
            Se eu marcar um pai como concluído, todos os filhos também devem ser marcados.
            Isso facilita a UX de checklists grandes.
        """
        # Join garante que a subtarefa pertence a uma tarefa do usuário
        sub = db.query(Subtarefa).join(Tarefa).filter(
            Subtarefa.id == sub_id, 
            Tarefa.user_id == user_id
        ).first()
        
        if not sub: return None
        
        novo_status = not sub.concluido
        sub.concluido = novo_status
        
        # Função interna recursiva para propagar status aos filhos
        def update_children(parent_sub):
            for child in parent_sub.subtarefas:
                child.concluido = novo_status
                update_children(child)
        
        update_children(sub)

        db.commit()
        db.refresh(sub)
        return sub

    # ==============================================================================
    # 5. DASHBOARD AGREGADO (Home de Registros)
    # ==============================================================================
    def get_dashboard_data(self, db: Session, user_id: int):
        """
        Prepara os dados para a tela principal de Registros.
        
        Processamento:
        1. Anotações: Separa em Fixadas vs Normais. Normais são agrupadas por Mês.
        2. Tarefas: Ordenação complexa personalizada por prioridade (Crítica > Alta > Média...).
        """
        
        # 1. Busca e Agrupamento de Anotações
        fixadas = db.query(Anotacao).filter(Anotacao.fixado == True, Anotacao.user_id == user_id).all()
        nao_fixadas = db.query(Anotacao).filter(Anotacao.fixado == False, Anotacao.user_id == user_id).order_by(Anotacao.data_criacao.desc()).all()
        
        # [CORREÇÃO PONTO 1] Formatação de data robusta (Locale-safe)
        meses_pt = [
            '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ]
        
        por_mes = {}
        for nota in nao_fixadas:
            # Extrai mês e ano diretamente do objeto datetime (Inteiros)
            # Evita strftime dependente de locale do SO
            nome_mes = meses_pt[nota.data_criacao.month]
            ano = nota.data_criacao.year
            mes_ano = f"{nome_mes} {ano}"
            
            if mes_ano not in por_mes: por_mes[mes_ano] = []
            por_mes[mes_ano].append(nota)

        # 2. Busca e Ordenação de Tarefas
        # Define a ordem de relevância no SQL
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

        habitos = self.get_habitos_com_contexto(db, user_id)

        return {
            "anotacoes_fixadas": fixadas, "anotacoes_por_mes": por_mes,
            "tarefas_pendentes": t_pendentes, "tarefas_concluidas": t_concluidas,
            "grupos_disponiveis": grupos,
            "habitos": habitos,
        }

    # ==============================================================================
    # 5b. BOARD KANBAN (Tarefas agrupadas por coluna)
    # ==============================================================================
    def get_board_data(self, db: Session, user_id: int):
        """
        Monta as 4 colunas do board.

        Colunas abertas (Pendente / Em andamento): ordenadas por `ordem` (reordenação
        manual). Colunas fechadas (Concluído / Cancelado): mais recentes no topo
        (data_conclusao desc), limitadas a 200 — reordenar dentro delas não governa a
        exibição (o `ordem` ainda é gravado no drop, mas ignorado aqui).
        """
        base = db.query(Tarefa).filter(Tarefa.user_id == user_id)

        a_fazer = base.filter(Tarefa.status == "Pendente") \
            .order_by(Tarefa.ordem.asc(), Tarefa.id.desc()).all()
        em_andamento = base.filter(Tarefa.status == "Em andamento") \
            .order_by(Tarefa.ordem.asc(), Tarefa.id.desc()).all()
        bloqueado = base.filter(Tarefa.status == "Bloqueado") \
            .order_by(Tarefa.ordem.asc(), Tarefa.id.desc()).all()
        concluido = base.filter(Tarefa.status == "Concluído") \
            .order_by(Tarefa.data_conclusao.desc().nullslast(), Tarefa.id.desc()).limit(200).all()
        cancelado = base.filter(Tarefa.status == "Cancelado") \
            .order_by(Tarefa.data_conclusao.desc().nullslast(), Tarefa.id.desc()).limit(200).all()

        return {
            "a_fazer": a_fazer,
            "em_andamento": em_andamento,
            "bloqueado": bloqueado,
            "concluido": concluido,
            "cancelado": cancelado,
        }

    # ==============================================================================
    # 6. GESTÃO DE HÁBITOS (JORNADA)
    # ==============================================================================

    def _calcular_streak(self, db: Session, habito_id: int) -> int:
        """
        Calcula a sequência atual (streak) de dias consecutivos concluídos.

        Lógica:
            Percorre os registros de conclusão do mais recente ao mais antigo.
            Para cada dia esperado, verifica se há um check-in concluído.
            Quebra assim que encontrar um gap.
        """
        hoje = date.today()
        registros = (
            db.query(HabitoRegistro)
            .filter(
                HabitoRegistro.habito_id == habito_id,
                HabitoRegistro.concluido == True,
            )
            .order_by(HabitoRegistro.data.desc())
            .all()
        )
        if not registros:
            return 0

        datas_concluidas = {r.data for r in registros}
        streak = 0
        dia_verificar = hoje

        while dia_verificar in datas_concluidas:
            streak += 1
            dia_verificar -= timedelta(days=1)

        return streak

    def get_habitos_com_contexto(self, db: Session, user_id: int):
        """
        Retorna todos os hábitos ativos/pausados do usuário enriquecidos com:
        - registro_hoje: check-in do dia corrente (se existir)
        - streak: sequência de dias consecutivos concluídos
        Ordenados por horário do dia.
        """
        hoje = date.today()
        habitos = (
            db.query(Habito)
            .filter(
                Habito.user_id == user_id,
                Habito.status != "arquivado",
            )
            .order_by(Habito.horario)
            .all()
        )

        resultado = []
        for h in habitos:
            registro_hoje = (
                db.query(HabitoRegistro)
                .filter(
                    HabitoRegistro.habito_id == h.id,
                    HabitoRegistro.data == hoje,
                )
                .first()
            )
            streak = self._calcular_streak(db, h.id)

            # Injeta atributos computados diretamente no objeto ORM
            # para que o schema Pydantic os capture via from_attributes.
            h.registro_hoje = registro_hoje
            h.streak = streak
            resultado.append(h)

        return resultado

    def get_habitos(self, db: Session, user_id: int):
        return self.get_habitos_com_contexto(db, user_id)

    def create_habito(self, db: Session, habito_data, user_id: int) -> Habito:
        novo = Habito(
            titulo=habito_data.titulo,
            descricao=habito_data.descricao,
            horario=habito_data.horario,
            frequencia=habito_data.frequencia,
            duracao_min=habito_data.duracao_min,
            cor=habito_data.cor,
            user_id=user_id,
        )
        db.add(novo)
        db.commit()
        db.refresh(novo)
        novo.registro_hoje = None
        novo.streak = 0
        return novo

    def update_habito(self, db: Session, habito_id: int, habito_data, user_id: int):
        habito = db.query(Habito).filter(Habito.id == habito_id, Habito.user_id == user_id).first()
        if not habito:
            return None

        if habito_data.titulo is not None:      habito.titulo = habito_data.titulo
        if habito_data.descricao is not None:   habito.descricao = habito_data.descricao
        if habito_data.horario is not None:     habito.horario = habito_data.horario
        if habito_data.frequencia is not None:  habito.frequencia = habito_data.frequencia
        if habito_data.duracao_min is not None: habito.duracao_min = habito_data.duracao_min
        if habito_data.cor is not None:         habito.cor = habito_data.cor
        if habito_data.status is not None:      habito.status = habito_data.status

        db.commit()
        db.refresh(habito)

        hoje = date.today()
        habito.registro_hoje = (
            db.query(HabitoRegistro)
            .filter(HabitoRegistro.habito_id == habito.id, HabitoRegistro.data == hoje)
            .first()
        )
        habito.streak = self._calcular_streak(db, habito.id)
        return habito

    def toggle_status_habito(self, db: Session, habito_id: int, user_id: int):
        """Alterna entre ativo e pausado."""
        habito = db.query(Habito).filter(Habito.id == habito_id, Habito.user_id == user_id).first()
        if not habito:
            return None
        habito.status = "pausado" if habito.status == "ativo" else "ativo"
        db.commit()
        db.refresh(habito)
        hoje = date.today()
        habito.registro_hoje = (
            db.query(HabitoRegistro)
            .filter(HabitoRegistro.habito_id == habito.id, HabitoRegistro.data == hoje)
            .first()
        )
        habito.streak = self._calcular_streak(db, habito.id)
        return habito

    def delete_habito(self, db: Session, habito_id: int, user_id: int) -> bool:
        habito = db.query(Habito).filter(Habito.id == habito_id, Habito.user_id == user_id).first()
        if not habito:
            return False
        db.delete(habito)
        db.commit()
        return True

    def toggle_checkin(self, db: Session, habito_id: int, user_id: int, data_checkin: date):
        """
        Cria ou alterna o check-in de um hábito em uma data específica.

        Regra de Idempotência:
            Se já existe registro para aquela data, alterna 'concluido'.
            Se não existe, cria como concluido=True.
        """
        # Verifica propriedade do hábito
        habito = db.query(Habito).filter(Habito.id == habito_id, Habito.user_id == user_id).first()
        if not habito:
            raise HTTPException(status_code=404, detail="Hábito não encontrado.")

        registro = (
            db.query(HabitoRegistro)
            .filter(HabitoRegistro.habito_id == habito_id, HabitoRegistro.data == data_checkin)
            .first()
        )

        if registro:
            registro.concluido = not registro.concluido
        else:
            registro = HabitoRegistro(habito_id=habito_id, data=data_checkin, concluido=True)
            db.add(registro)

        db.commit()
        db.refresh(registro)
        return registro

    def get_historico_habito(self, db: Session, habito_id: int, user_id: int, dias: int = 90):
        """
        Retorna os registros de check-in dos últimos N dias.
        Usado para o heatmap/histórico na UI.
        """
        habito = db.query(Habito).filter(Habito.id == habito_id, Habito.user_id == user_id).first()
        if not habito:
            raise HTTPException(status_code=404, detail="Hábito não encontrado.")

        data_inicio = date.today() - timedelta(days=dias)
        registros = (
            db.query(HabitoRegistro)
            .filter(
                HabitoRegistro.habito_id == habito_id,
                HabitoRegistro.data >= data_inicio,
            )
            .order_by(HabitoRegistro.data.asc())
            .all()
        )
        return registros


registros_service = RegistrosService()