from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.ritmo import (
    RitmoBio, RitmoPlanoTreino, RitmoDiaTreino, RitmoExercicioItem,
    RitmoDietaConfig, RitmoRefeicao, RitmoAlimentoItem
)
from app.schemas.ritmo import (
    BioCreate, PlanoTreinoCreate, DietaConfigCreate
)
from datetime import datetime

class RitmoService:
    
    # ==========================================================
    # 1. BIO & CÁLCULOS METABÓLICOS
    # ==========================================================

    @staticmethod
    def get_latest_bio(db: Session, user_id: int):
        """Retorna o registro bio mais recente do usuário."""
        return db.query(RitmoBio).filter(RitmoBio.user_id == user_id)\
            .order_by(desc(RitmoBio.data_registro)).first()

    @staticmethod
    def create_bio(db: Session, user_id: int, bio_in: BioCreate):
        """
        Cria um registro bio e realiza TODOS os cálculos automáticos:
        - TMB (Harris-Benedict)
        - GET (Gasto Energético Total)
        - Divisão de Macros (Prot/Carb/Gord) baseada no objetivo
        """
        
        # 1. Cálculo da TMB (Fórmula de Harris-Benedict Revisada)
        if bio_in.genero.upper() == 'M':
            tmb = 88.36 + (13.4 * bio_in.peso) + (4.8 * bio_in.altura) - (5.7 * bio_in.idade)
        else:
            tmb = 447.6 + (9.2 * bio_in.peso) + (3.1 * bio_in.altura) - (4.3 * bio_in.idade)

        # 2. Definição do Fator de Atividade
        fatores = {
            'sedentario': 1.2,
            'leve': 1.375,
            'moderado': 1.55,
            'alto': 1.725,
            'atleta': 1.9
        }
        fator = fatores.get(bio_in.nivel_atividade, 1.2)
        get_basal = tmb * fator

        # 3. Ajuste pelo Objetivo (Déficit ou Superávit)
        gasto_total_alvo = get_basal
        if bio_in.objetivo == 'perda_peso':
            gasto_total_alvo -= 500  # Déficit padrão de 500kcal
        elif bio_in.objetivo == 'ganho_massa':
            gasto_total_alvo += 300  # Superávit leve

        # 4. Cálculo de Macros (Estratégia Padrão)
        # Proteína: 2g/kg (Base sólida para hipertrofia/manutenção)
        # Gordura: 1g/kg (Saúde hormonal)
        # Carbo: O que sobrar das calorias
        
        meta_proteina = bio_in.peso * 2.0
        meta_gordura = bio_in.peso * 1.0
        
        calorias_prot_gord = (meta_proteina * 4) + (meta_gordura * 9)
        calorias_restantes = gasto_total_alvo - calorias_prot_gord
        
        # Evitar carboidrato negativo se o déficit for muito agressivo
        if calorias_restantes < 0: calorias_restantes = 0
        meta_carbo = calorias_restantes / 4

        # 5. Meta de Água (35ml a 50ml por kg)
        meta_agua = bio_in.peso * 0.045 # 45ml/kg média atleta

        # Criação do Objeto
        db_obj = RitmoBio(
            user_id=user_id,
            peso=bio_in.peso,
            altura=bio_in.altura,
            idade=bio_in.idade,
            genero=bio_in.genero,
            bf_estimado=bio_in.bf_estimado,
            nivel_atividade=bio_in.nivel_atividade,
            objetivo=bio_in.objetivo,
            # Calculados
            tmb=round(tmb, 2),
            gasto_calorico_total=round(gasto_total_alvo, 2),
            meta_proteina=round(meta_proteina, 1),
            meta_carbo=round(meta_carbo, 1),
            meta_gordura=round(meta_gordura, 1),
            meta_agua=round(meta_agua, 1)
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
        """
        Cria a árvore completa: Plano -> Dias -> Exercícios
        """
        # Se este plano for ativo, desativa os anteriores
        if plano_in.ativo:
            RitmoService._desativar_outros_planos(db, user_id)

        # 1. Cria o Plano
        db_plano = RitmoPlanoTreino(
            user_id=user_id,
            nome=plano_in.nome,
            descricao=plano_in.descricao,
            ativo=plano_in.ativo
        )
        db.add(db_plano)
        db.commit()
        db.refresh(db_plano)

        # 2. Cria os Dias e Exercícios (Iteração aninhada)
        for dia_in in plano_in.dias:
            db_dia = RitmoDiaTreino(
                plano_id=db_plano.id,
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
                    carga_prevista=ex_in.carga_prevista,
                    descanso_segundos=ex_in.descanso_segundos,
                    observacao=ex_in.observacao
                )
                db.add(db_ex)
            
            db.commit() # Commit dos exercícios deste dia

        db.refresh(db_plano)
        return db_plano

    @staticmethod
    def toggle_plano_ativo(db: Session, user_id: int, plano_id: int):
        """Ativa um plano e desativa todos os outros"""
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
        """Helper interno para garantir unicidade de ativo"""
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
        """
        Cria a árvore completa: Dieta -> Refeições -> Alimentos
        E calcula o total calórico automaticamente.
        """
        if dieta_in.ativo:
            RitmoService._desativar_outras_dietas(db, user_id)

        # 1. Cria a Dieta (Header)
        db_dieta = RitmoDietaConfig(
            user_id=user_id,
            nome=dieta_in.nome,
            ativo=dieta_in.ativo,
            calorias_calculadas=0 # Será atualizado no final
        )
        db.add(db_dieta)
        db.commit()
        db.refresh(db_dieta)

        total_calorias = 0

        # 2. Cria Refeições e Alimentos
        for ref_in in dieta_in.refeicoes:
            db_ref = RitmoRefeicao(
                dieta_id=db_dieta.id,
                nome=ref_in.nome,
                horario=ref_in.horario,
                ordem=ref_in.ordem
            )
            db.add(db_ref)
            db.commit()
            db.refresh(db_ref)

            for ali_in in ref_in.alimentos:
                # Cria alimento
                db_ali = RitmoAlimentoItem(
                    refeicao_id=db_ref.id,
                    nome=ali_in.nome,
                    quantidade=ali_in.quantidade,
                    unidade=ali_in.unidade,
                    calorias=ali_in.calorias,
                    proteina=ali_in.proteina,
                    carbo=ali_in.carbo,
                    gordura=ali_in.gordura
                )
                db.add(db_ali)
                
                # Soma calorias
                total_calorias += ali_in.calorias
            
            db.commit()

        # 3. Atualiza o total da dieta
        db_dieta.calorias_calculadas = total_calorias
        db.commit()
        db.refresh(db_dieta)
        
        return db_dieta

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
        """
        Calcula a soma de séries por grupo muscular do plano ATIVO.
        """
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
                # Soma as séries do exercício ao grupo correspondente
                volume[grupo] = volume.get(grupo, 0) + (ex.series or 0)
        
        return volume