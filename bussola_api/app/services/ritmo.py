"""
=======================================================================================
ARQUIVO: ritmo.py (Serviço de Saúde e Performance)
=======================================================================================

OBJETIVO:
    Gerenciar toda a lógica do módulo "Ritmo", que engloba Biometria, Treinos e Nutrição.
    Este serviço atua como o motor de cálculo metabólico e gerenciador de estruturas
    complexas de dados (Planos de Treino e Dietas).

PARTE DO SISTEMA:
    Backend / Service Layer.

RESPONSABILIDADES:
    1. Biometria: Calcular TMB, GET e divisão de macros baseada no perfil do usuário.
    2. Treino: Gerenciar ciclo de vida de planos (Ativar/Desativar) e estrutura hierárquica (Plano -> Dia -> Exercício).
    3. Nutrição: Gerenciar dietas e calcular somatórios calóricos automáticos.
    4. Integração: Buscar dados nutricionais na tabela TACO (arquivo local).

COMUNICAÇÃO:
    - Models: Módulo app.models.ritmo (todas as tabelas).
    - Config: Acessa settings.DATA_DIR para ler o JSON da TACO.

=======================================================================================
"""

from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.ritmo import (
    RitmoBio, RitmoPlanoTreino, RitmoDiaTreino, RitmoExercicioItem,
    RitmoDietaConfig, RitmoRefeicao, RitmoAlimentoItem
)
from app.schemas.ritmo import (
    BioCreate, PlanoTreinoCreate, DietaConfigCreate
)
from app.core.config import settings
from datetime import datetime
import json
import os

class RitmoService:
    
    # ==========================================================
    # 1. BIO & CÁLCULOS METABÓLICOS
    # ==========================================================

    @staticmethod
    def get_latest_bio(db: Session, user_id: int):
        """Retorna o registro bio mais recente (snapshot atual do corpo do usuário)."""
        return db.query(RitmoBio).filter(RitmoBio.user_id == user_id)\
            .order_by(desc(RitmoBio.data_registro)).first()

    @staticmethod
    def create_bio(db: Session, user_id: int, bio_in: BioCreate):
        """
        Registra uma nova avaliação física e executa o motor de cálculo nutricional.
        Permite override manual das metas se fornecidas no payload.
        """
        
        # 1. Cálculo da TMB (Fórmula de Harris-Benedict Revisada)
        if bio_in.genero.upper() == 'M':
            tmb = 88.36 + (13.4 * bio_in.peso) + (4.8 * bio_in.altura) - (5.7 * bio_in.idade)
        else:
            tmb = 447.6 + (9.2 * bio_in.peso) + (3.1 * bio_in.altura) - (4.3 * bio_in.idade)

        # 2. Definição do Fator de Atividade
        fatores = {'sedentario': 1.2, 'leve': 1.375, 'moderado': 1.55, 'alto': 1.725, 'atleta': 1.9}
        fator = fatores.get(bio_in.nivel_atividade, 1.2)
        get_basal = tmb * fator

        # 3. Ajuste pelo Objetivo (Sugestão do Sistema)
        gasto_total_sugestao = get_basal
        if bio_in.objetivo == 'perda_peso':
            gasto_total_sugestao -= 500
        elif bio_in.objetivo == 'ganho_massa':
            gasto_total_sugestao += 300

        # 4. Distribuição de Macros (Sugestão do Sistema)
        meta_prot_sugestao = bio_in.peso * 2.0
        meta_gord_sugestao = bio_in.peso * 1.0
        
        calorias_prot_gord = (meta_prot_sugestao * 4) + (meta_gord_sugestao * 9)
        calorias_restantes = gasto_total_sugestao - calorias_prot_gord
        if calorias_restantes < 0: calorias_restantes = 0
        meta_carb_sugestao = calorias_restantes / 4

        meta_agua_sugestao = bio_in.peso * 0.045 

        # 5. Aplicação Final (Override se o usuário enviou customizado)
        # Se o campo veio no payload (não é None), usa ele. Senão usa a sugestão.
        final_gasto = bio_in.gasto_calorico_total if bio_in.gasto_calorico_total is not None else gasto_total_sugestao
        final_prot = bio_in.meta_proteina if bio_in.meta_proteina is not None else meta_prot_sugestao
        final_carb = bio_in.meta_carbo if bio_in.meta_carbo is not None else meta_carb_sugestao
        final_gord = bio_in.meta_gordura if bio_in.meta_gordura is not None else meta_gord_sugestao
        final_agua = bio_in.meta_agua if bio_in.meta_agua is not None else meta_agua_sugestao

        # Persistência
        db_obj = RitmoBio(
            user_id=user_id,
            peso=bio_in.peso,
            altura=bio_in.altura,
            idade=bio_in.idade,
            genero=bio_in.genero,
            bf_estimado=bio_in.bf_estimado,
            nivel_atividade=bio_in.nivel_atividade,
            objetivo=bio_in.objetivo,
            
            tmb=round(tmb, 2),
            gasto_calorico_total=round(final_gasto, 2),
            meta_proteina=round(final_prot, 1),
            meta_carbo=round(final_carb, 1),
            meta_gordura=round(final_gord, 1),
            meta_agua=round(final_agua, 1)
        )
        
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    # ==========================================================
    # 2. TREINO (PLANOS, DIAS, EXERCÍCIOS)
    # ==========================================================

    @staticmethod
    def get_planos(db: Session, user_id: int):
        return db.query(RitmoPlanoTreino).filter(RitmoPlanoTreino.user_id == user_id).all()

    @staticmethod
    def get_plano_ativo(db: Session, user_id: int):
        return db.query(RitmoPlanoTreino).filter(
            RitmoPlanoTreino.user_id == user_id, 
            RitmoPlanoTreino.ativo == True
        ).first()

    @staticmethod
    def create_plano_completo(db: Session, user_id: int, plano_in: PlanoTreinoCreate):
        if plano_in.ativo:
            RitmoService._desativar_outros_planos(db, user_id)

        db_plano = RitmoPlanoTreino(
            user_id=user_id,
            nome=plano_in.nome,
            ativo=plano_in.ativo
        )
        db.add(db_plano)
        db.commit()
        db.refresh(db_plano)

        RitmoService._adicionar_dias_plano(db, db_plano.id, plano_in.dias)

        db.refresh(db_plano)
        return db_plano

    @staticmethod
    def update_plano_completo(db: Session, user_id: int, plano_id: int, plano_in: PlanoTreinoCreate):
        """
        Atualiza um plano existente usando Reconciliação (Smart Diff).
        Preserva IDs de dias e exercícios para manter histórico.
        """
        db_plano = db.query(RitmoPlanoTreino).filter(
            RitmoPlanoTreino.id == plano_id, 
            RitmoPlanoTreino.user_id == user_id
        ).first()
        
        if not db_plano:
            return None

        if plano_in.ativo and not db_plano.ativo:
            RitmoService._desativar_outros_planos(db, user_id)

        db_plano.nome = plano_in.nome
        db_plano.ativo = plano_in.ativo

        # Reconciliação de DIAS
        # Mapa dos itens atuais no banco
        dias_existentes = {dia.id: dia for dia in db_plano.dias}
        ids_dias_processados = []

        for dia_in in plano_in.dias:
            if dia_in.id and dia_in.id in dias_existentes:
                # UPDATE DIA
                db_dia = dias_existentes[dia_in.id]
                db_dia.nome = dia_in.nome
                db_dia.ordem = dia_in.ordem
                ids_dias_processados.append(dia_in.id)
                
                # Reconcilia Exercícios (Recursivo)
                RitmoService._reconciliar_exercicios(db, db_dia, dia_in.exercicios)
            else:
                # CREATE DIA
                novo_dia = RitmoDiaTreino(
                    plano_id=db_plano.id,
                    nome=dia_in.nome,
                    ordem=dia_in.ordem
                )
                db.add(novo_dia)
                db.commit()
                db.refresh(novo_dia)
                
                # Adiciona exercícios do novo dia
                for ex_in in dia_in.exercicios:
                    novo_ex = RitmoExercicioItem(
                        dia_treino_id=novo_dia.id,
                        nome_exercicio=ex_in.nome_exercicio,
                        api_id=ex_in.api_id,
                        grupo_muscular=ex_in.grupo_muscular,
                        series=ex_in.series,
                        repeticoes_min=ex_in.repeticoes_min,
                        repeticoes_max=ex_in.repeticoes_max,
                        descanso_segundos=ex_in.descanso_segundos,
                        observacao=ex_in.observacao
                    )
                    db.add(novo_ex)

        # DELETE ORPHANS (Dias que sumiram)
        for dia_id, dia_obj in dias_existentes.items():
            if dia_id not in ids_dias_processados:
                db.delete(dia_obj)

        db.commit()
        db.refresh(db_plano)
        return db_plano

    @staticmethod
    def _reconciliar_exercicios(db: Session, db_dia: RitmoDiaTreino, exercicios_in: list):
        """Helper para diff inteligente de exercícios."""
        ex_existentes = {ex.id: ex for ex in db_dia.exercicios}
        ids_ex_processados = []

        for ex_in in exercicios_in:
            if ex_in.id and ex_in.id in ex_existentes:
                # UPDATE
                db_ex = ex_existentes[ex_in.id]
                db_ex.nome_exercicio = ex_in.nome_exercicio
                db_ex.api_id = ex_in.api_id
                db_ex.grupo_muscular = ex_in.grupo_muscular
                db_ex.series = ex_in.series
                db_ex.repeticoes_min = ex_in.repeticoes_min
                db_ex.repeticoes_max = ex_in.repeticoes_max
                db_ex.descanso_segundos = ex_in.descanso_segundos
                db_ex.observacao = ex_in.observacao
                ids_ex_processados.append(ex_in.id)
            else:
                # CREATE
                novo_ex = RitmoExercicioItem(
                    dia_treino_id=db_dia.id,
                    nome_exercicio=ex_in.nome_exercicio,
                    api_id=ex_in.api_id,
                    grupo_muscular=ex_in.grupo_muscular,
                    series=ex_in.series,
                    repeticoes_min=ex_in.repeticoes_min,
                    repeticoes_max=ex_in.repeticoes_max,
                    descanso_segundos=ex_in.descanso_segundos,
                    observacao=ex_in.observacao
                )
                db.add(novo_ex)
        
        # DELETE
        for ex_id, ex_obj in ex_existentes.items():
            if ex_id not in ids_ex_processados:
                db.delete(ex_obj)

    @staticmethod
    def _adicionar_dias_plano(db: Session, plano_id: int, dias_in: list):
        # ... (Mantido igual para criação inicial) ...
        for dia_in in dias_in:
            db_dia = RitmoDiaTreino(
                plano_id=plano_id,
                nome=dia_in.nome,
                ordem=dia_in.ordem
            )
            db.add(db_dia)
            db.commit()
            db.refresh(db_dia)

            for ex_in in dia_in.exercicios:
                db_ex = RitmoExercicioItem(
                    dia_treino_id=db_dia.id,
                    nome_exercicio=ex_in.nome_exercicio,
                    api_id=ex_in.api_id, 
                    grupo_muscular=ex_in.grupo_muscular,
                    series=ex_in.series,
                    repeticoes_min=ex_in.repeticoes_min,
                    repeticoes_max=ex_in.repeticoes_max,
                    descanso_segundos=ex_in.descanso_segundos,
                    observacao=ex_in.observacao
                )
                db.add(db_ex)
            
            db.commit()

    @staticmethod
    def toggle_plano_ativo(db: Session, user_id: int, plano_id: int):
        RitmoService._desativar_outros_planos(db, user_id)
        plano = db.query(RitmoPlanoTreino).filter(RitmoPlanoTreino.id == plano_id, RitmoPlanoTreino.user_id == user_id).first()
        if plano:
            plano.ativo = True
            db.commit()
            db.refresh(plano)
        return plano

    @staticmethod
    def delete_plano(db: Session, user_id: int, plano_id: int):
        plano = db.query(RitmoPlanoTreino).filter(RitmoPlanoTreino.id == plano_id, RitmoPlanoTreino.user_id == user_id).first()
        if plano:
            db.delete(plano)
            db.commit()
            return True
        return False

    @staticmethod
    def _desativar_outros_planos(db: Session, user_id: int):
        planos_ativos = db.query(RitmoPlanoTreino).filter(
            RitmoPlanoTreino.user_id == user_id, 
            RitmoPlanoTreino.ativo == True
        ).all()
        for p in planos_ativos:
            p.ativo = False
        db.commit()

    # ==========================================================
    # 3. NUTRIÇÃO (DIETAS, REFEIÇÕES, ALIMENTOS)
    # ==========================================================

    @staticmethod
    def get_dietas(db: Session, user_id: int):
        return db.query(RitmoDietaConfig).filter(RitmoDietaConfig.user_id == user_id).all()
    
    @staticmethod
    def get_dieta_ativa(db: Session, user_id: int):
        return db.query(RitmoDietaConfig).filter(
            RitmoDietaConfig.user_id == user_id, 
            RitmoDietaConfig.ativo == True
        ).first()

    @staticmethod
    def create_dieta_completa(db: Session, user_id: int, dieta_in: DietaConfigCreate):
        if dieta_in.ativo:
            RitmoService._desativar_outras_dietas(db, user_id)

        db_dieta = RitmoDietaConfig(
            user_id=user_id,
            nome=dieta_in.nome,
            ativo=dieta_in.ativo,
            calorias_calculadas=0 
        )
        db.add(db_dieta)
        db.commit()
        db.refresh(db_dieta)

        total_calorias = RitmoService._adicionar_refeicoes_dieta(db, db_dieta.id, dieta_in.refeicoes)

        db_dieta.calorias_calculadas = total_calorias
        db.commit()
        db.refresh(db_dieta)
        return db_dieta

    @staticmethod
    def update_dieta_completa(db: Session, user_id: int, dieta_id: int, dieta_in: DietaConfigCreate):
        """
        Atualiza dieta preservando IDs (Smart Diff).
        """
        db_dieta = db.query(RitmoDietaConfig).filter(
            RitmoDietaConfig.id == dieta_id, 
            RitmoDietaConfig.user_id == user_id
        ).first()
        
        if not db_dieta:
            return None

        if dieta_in.ativo and not db_dieta.ativo:
            RitmoService._desativar_outras_dietas(db, user_id)

        db_dieta.nome = dieta_in.nome
        db_dieta.ativo = dieta_in.ativo

        # Reconciliação Refeições
        ref_existentes = {r.id: r for r in db_dieta.refeicoes}
        ids_ref_processados = []
        total_calorias_acumulado = 0

        for ref_in in dieta_in.refeicoes:
            if ref_in.id and ref_in.id in ref_existentes:
                # UPDATE
                db_ref = ref_existentes[ref_in.id]
                db_ref.nome = ref_in.nome
                db_ref.ordem = ref_in.ordem
                ids_ref_processados.append(ref_in.id)
                
                calorias_ref = RitmoService._reconciliar_alimentos(db, db_ref, ref_in.alimentos)
                total_calorias_acumulado += calorias_ref
            else:
                # CREATE
                nova_ref = RitmoRefeicao(
                    dieta_id=db_dieta.id,
                    nome=ref_in.nome,
                    ordem=ref_in.ordem
                )
                db.add(nova_ref)
                db.commit()
                db.refresh(nova_ref)
                
                for ali_in in ref_in.alimentos:
                    novo_ali = RitmoAlimentoItem(
                        refeicao_id=nova_ref.id,
                        nome=ali_in.nome,
                        quantidade=ali_in.quantidade,
                        unidade=ali_in.unidade,
                        calorias=ali_in.calorias,
                        proteina=ali_in.proteina,
                        carbo=ali_in.carbo,
                        gordura=ali_in.gordura
                    )
                    db.add(novo_ali)
                    total_calorias_acumulado += ali_in.calorias

        # DELETE ORPHANS
        for ref_id, ref_obj in ref_existentes.items():
            if ref_id not in ids_ref_processados:
                db.delete(ref_obj)

        db_dieta.calorias_calculadas = total_calorias_acumulado
        db.commit()
        db.refresh(db_dieta)
        return db_dieta

    @staticmethod
    def _reconciliar_alimentos(db: Session, db_ref: RitmoRefeicao, alimentos_in: list) -> float:
        ali_existentes = {a.id: a for a in db_ref.alimentos}
        ids_ali_proc = []
        soma_calorias = 0

        for ali_in in alimentos_in:
            soma_calorias += ali_in.calorias
            
            if ali_in.id and ali_in.id in ali_existentes:
                # UPDATE
                db_ali = ali_existentes[ali_in.id]
                db_ali.nome = ali_in.nome
                db_ali.quantidade = ali_in.quantidade
                db_ali.unidade = ali_in.unidade
                db_ali.calorias = ali_in.calorias
                db_ali.proteina = ali_in.proteina
                db_ali.carbo = ali_in.carbo
                db_ali.gordura = ali_in.gordura
                ids_ali_proc.append(ali_in.id)
            else:
                # CREATE
                novo = RitmoAlimentoItem(
                    refeicao_id=db_ref.id,
                    nome=ali_in.nome,
                    quantidade=ali_in.quantidade,
                    unidade=ali_in.unidade,
                    calorias=ali_in.calorias,
                    proteina=ali_in.proteina,
                    carbo=ali_in.carbo,
                    gordura=ali_in.gordura
                )
                db.add(novo)
        
        # DELETE
        for ali_id, ali_obj in ali_existentes.items():
            if ali_id not in ids_ali_proc:
                db.delete(ali_obj)
        
        return soma_calorias

    @staticmethod
    def _adicionar_refeicoes_dieta(db: Session, dieta_id: int, refeicoes_in: list):
        """Helper privado para adicionar refeições e alimentos, retornando o total calórico."""
        total_calorias = 0
        for ref_in in refeicoes_in:
            db_ref = RitmoRefeicao(
                dieta_id=dieta_id,
                nome=ref_in.nome,
                ordem=ref_in.ordem
            )
            db.add(db_ref)
            db.commit()
            db.refresh(db_ref)

            for ali_in in ref_in.alimentos:
                db_ali = RitmoAlimentoItem(
                    refeicao_id=db_ref.id,
                    nome=ali_in.nome,
                    quantidade=ali_in.quantidade,
                    unidade=ali_in.unidade,
                    # Salva os macros calculados (recebidos do front ou calculados antes)
                    calorias=ali_in.calorias,
                    proteina=ali_in.proteina,
                    carbo=ali_in.carbo,
                    gordura=ali_in.gordura
                )
                db.add(db_ali)
                total_calorias += ali_in.calorias
            
            db.commit()
        return total_calorias

    # ... (Resto dos métodos: toggle_dieta_ativa, delete_dieta, _desativar_outras_dietas, get_volume_semanal, search_taco_foods mantidos iguais) ...
    @staticmethod
    def toggle_dieta_ativa(db: Session, user_id: int, dieta_id: int):
        RitmoService._desativar_outras_dietas(db, user_id)
        dieta = db.query(RitmoDietaConfig).filter(RitmoDietaConfig.id == dieta_id, RitmoDietaConfig.user_id == user_id).first()
        if dieta:
            dieta.ativo = True
            db.commit()
            db.refresh(dieta)
        return dieta

    @staticmethod
    def delete_dieta(db: Session, user_id: int, dieta_id: int):
        dieta = db.query(RitmoDietaConfig).filter(RitmoDietaConfig.id == dieta_id, RitmoDietaConfig.user_id == user_id).first()
        if dieta:
            db.delete(dieta)
            db.commit()
            return True
        return False

    @staticmethod
    def _desativar_outras_dietas(db: Session, user_id: int):
        ativas = db.query(RitmoDietaConfig).filter(
            RitmoDietaConfig.user_id == user_id, 
            RitmoDietaConfig.ativo == True
        ).all()
        for d in ativas:
            d.ativo = False
        db.commit()
        
    @staticmethod
    def get_volume_semanal(db: Session, user_id: int):
        plano = db.query(RitmoPlanoTreino).filter(
            RitmoPlanoTreino.user_id == user_id, 
            RitmoPlanoTreino.ativo == True
        ).first()

        if not plano:
            return {}

        volume = {}
        for dia in plano.dias:
            for ex in dia.exercicios:
                grupo = ex.grupo_muscular or "Outros"
                volume[grupo] = volume.get(grupo, 0) + (ex.series or 0)
        return volume

    @staticmethod
    def search_taco_foods(query: str):
        file_path = os.path.join(settings.DATA_DIR, "taco.json")
        
        if not os.path.exists(file_path):
            print(f"ERRO: Arquivo taco.json NÃO encontrado em: {file_path}")
            return []
            
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                taco_data = json.load(f)
        except Exception as e:
            print(f"ERRO CRÍTICO ao abrir/ler o JSON: {str(e)}")
            return []

        query_norm = query.lower()
        results = []
        
        for item in taco_data:
            nome_alimento = item.get("nome", "")
            if query_norm in nome_alimento.lower():
                comp = item.get("composicao", {})
                energia = comp.get("energia", {})
                
                results.append({
                    "nome": nome_alimento,
                    "calorias_100g": energia.get("kcal") or 0,
                    "proteina_100g": comp.get("proteina") or 0,
                    "carbo_100g": comp.get("carboidrato") or 0,
                    "gordura_100g": comp.get("lipideos") or 0,
                })
            if len(results) >= 20:
                break
        
        return results