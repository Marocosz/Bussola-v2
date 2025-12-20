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
import json
import os

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
        meta_proteina = bio_in.peso * 2.0
        meta_gordura = bio_in.peso * 1.0
        
        calorias_prot_gord = (meta_proteina * 4) + (meta_gordura * 9)
        calorias_restantes = gasto_total_alvo - calorias_prot_gord
        
        if calorias_restantes < 0: calorias_restantes = 0
        meta_carbo = calorias_restantes / 4

        # 5. Meta de Água (45ml por kg)
        meta_agua = bio_in.peso * 0.045 

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
        if plano_in.ativo:
            RitmoService._desativar_outros_planos(db, user_id)

        db_plano = RitmoPlanoTreino(
            user_id=user_id,
            nome=plano_in.nome,
            # REMOVIDO: descricao
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
        """Atualiza um plano de treino existente: limpa a estrutura antiga e reconstrói."""
        db_plano = db.query(RitmoPlanoTreino).filter(
            RitmoPlanoTreino.id == plano_id, 
            RitmoPlanoTreino.user_id == user_id
        ).first()
        
        if not db_plano:
            return None

        if plano_in.ativo:
            RitmoService._desativar_outros_planos(db, user_id)

        db_plano.nome = plano_in.nome
        # REMOVIDO: descricao
        db_plano.ativo = plano_in.ativo

        # Deletar via sessão para garantir o cascade correto
        for dia in list(db_plano.dias):
            db.delete(dia)
        
        db.flush()

        RitmoService._adicionar_dias_plano(db, db_plano.id, plano_in.dias)

        db.commit()
        db.refresh(db_plano)
        return db_plano

    @staticmethod
    def _adicionar_dias_plano(db: Session, plano_id: int, dias_in: list):
        """Helper privado para adicionar dias e exercícios a um plano."""
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
                    # REMOVIDO: carga_prevista
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
        """Atualiza uma dieta existente (remove refeições antigas e recria com as novas)."""
        db_dieta = db.query(RitmoDietaConfig).filter(
            RitmoDietaConfig.id == dieta_id, 
            RitmoDietaConfig.user_id == user_id
        ).first()
        
        if not db_dieta:
            return None

        if dieta_in.ativo:
            RitmoService._desativar_outras_dietas(db, user_id)

        db_dieta.nome = dieta_in.nome
        db_dieta.ativo = dieta_in.ativo

        for ref in list(db_dieta.refeicoes):
            db.delete(ref)
        
        db.flush()

        total_calorias = RitmoService._adicionar_refeicoes_dieta(db, db_dieta.id, dieta_in.refeicoes)

        db_dieta.calorias_calculadas = total_calorias
        db.commit()
        db.refresh(db_dieta)
        return db_dieta

    @staticmethod
    def _adicionar_refeicoes_dieta(db: Session, dieta_id: int, refeicoes_in: list):
        """Helper privado para adicionar refeições e alimentos."""
        total_calorias = 0
        for ref_in in refeicoes_in:
            db_ref = RitmoRefeicao(
                dieta_id=dieta_id,
                nome=ref_in.nome,
                # REMOVIDO: horario
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
                    calorias=ali_in.calorias,
                    proteina=ali_in.proteina,
                    carbo=ali_in.carbo,
                    gordura=ali_in.gordura
                )
                db.add(db_ali)
                total_calorias += ali_in.calorias
            
            db.commit()
        return total_calorias

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
        """Calcula a soma de séries por grupo muscular do plano ATIVO."""
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
        """Busca alimentos no arquivo taco.json com diagnóstico aprimorado."""
        current_dir = os.path.dirname(os.path.abspath(__file__)) 
        api_root = os.path.abspath(os.path.join(current_dir, "..", "..")) 
        file_path = os.path.join(api_root, "data", "taco.json")
        
        if not os.path.exists(file_path):
            print(f"ERRO: Arquivo taco.json NÃO encontrado no caminho especificado!")
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