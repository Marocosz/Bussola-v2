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
        
        LÓGICA DE NEGÓCIO (CÁLCULO AUTOMÁTICO):
        1. TMB (Taxa Metabólica Basal): Usa a fórmula de Harris-Benedict Revisada.
        2. GET (Gasto Energético Total): Multiplica TMB pelo nível de atividade.
        3. Objetivo: Ajusta o GET aplicando déficit (para secar) ou superávit (para massa).
        4. Macros: Define Proteína e Gordura por kg corporal e joga o resto em Carboidratos.
        
        

        Retorno:
            O objeto RitmoBio persistido com todos os campos calculados preenchidos.
        """
        
        # 1. Cálculo da TMB (Fórmula de Harris-Benedict Revisada)
        # Diferenciação biológica obrigatória para precisão.
        if bio_in.genero.upper() == 'M':
            tmb = 88.36 + (13.4 * bio_in.peso) + (4.8 * bio_in.altura) - (5.7 * bio_in.idade)
        else:
            tmb = 447.6 + (9.2 * bio_in.peso) + (3.1 * bio_in.altura) - (4.3 * bio_in.idade)

        # 2. Definição do Fator de Atividade (Multiplicador do TMB)
        fatores = {
            'sedentario': 1.2,
            'leve': 1.375,
            'moderado': 1.55,
            'alto': 1.725,
            'atleta': 1.9
        }
        fator = fatores.get(bio_in.nivel_atividade, 1.2)
        get_basal = tmb * fator

        # 3. Ajuste pelo Objetivo (Regra de Negócio)
        gasto_total_alvo = get_basal
        if bio_in.objetivo == 'perda_peso':
            gasto_total_alvo -= 500  # Déficit padrão conservador (safe range)
        elif bio_in.objetivo == 'ganho_massa':
            gasto_total_alvo += 300  # Superávit leve para evitar ganho excessivo de gordura

        # 4. Distribuição de Macros (Estratégia Flexível)
        # Regra: Proteína e Gordura são essenciais e fixos por KG. Carbo é energético e variável.
        meta_proteina = bio_in.peso * 2.0  # 2g/kg (Padrão hipertrofia)
        meta_gordura = bio_in.peso * 1.0   # 1g/kg (Saúde hormonal)
        
        # Conversão para Calorias (Prot/Carb = 4kcal, Gord = 9kcal)
        calorias_prot_gord = (meta_proteina * 4) + (meta_gordura * 9)
        calorias_restantes = gasto_total_alvo - calorias_prot_gord
        
        # Garante que não haja carbo negativo em dietas muito restritivas
        if calorias_restantes < 0: calorias_restantes = 0
        meta_carbo = calorias_restantes / 4

        # 5. Meta de Hidratação (45ml por kg - levemente acima da média de 35ml para ativos)
        meta_agua = bio_in.peso * 0.045 

        # Persistência dos Dados Calculados (Snapshot)
        db_obj = RitmoBio(
            user_id=user_id,
            peso=bio_in.peso,
            altura=bio_in.altura,
            idade=bio_in.idade,
            genero=bio_in.genero,
            bf_estimado=bio_in.bf_estimado,
            nivel_atividade=bio_in.nivel_atividade,
            objetivo=bio_in.objetivo,
            # Arredondamentos para UI limpa
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
        """Retorna o plano marcado como 'ativo' (o que aparece no Dashboard)."""
        return db.query(RitmoPlanoTreino).filter(
            RitmoPlanoTreino.user_id == user_id, 
            RitmoPlanoTreino.ativo == True
        ).first()

    @staticmethod
    def create_plano_completo(db: Session, user_id: int, plano_in: PlanoTreinoCreate):
        """
        Cria um plano de treino com toda a sua árvore de dependências (Dias -> Exercícios).
        
        Regra de Negócio:
            Se o novo plano for 'ativo', desativa automaticamente todos os outros planos
            do usuário para manter a consistência de "apenas 1 plano vigente".
        """
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

        # Delega a criação dos filhos para função auxiliar
        RitmoService._adicionar_dias_plano(db, db_plano.id, plano_in.dias)

        db.refresh(db_plano)
        return db_plano

    @staticmethod
    def update_plano_completo(db: Session, user_id: int, plano_id: int, plano_in: PlanoTreinoCreate):
        """
        Atualiza um plano existente.
        
        ESTRATÉGIA DE ATUALIZAÇÃO (DESTRUTIVA):
        Para simplificar a lógica de diff (saber qual exercício mudou, qual dia foi removido),
        removemos TODOS os dias e exercícios antigos e recriamos do zero baseados no payload.
        Isso garante integridade total da estrutura.
        """
        # [SEGURANÇA] Filtra por user_id
        db_plano = db.query(RitmoPlanoTreino).filter(
            RitmoPlanoTreino.id == plano_id, 
            RitmoPlanoTreino.user_id == user_id
        ).first()
        
        if not db_plano:
            return None

        if plano_in.ativo:
            RitmoService._desativar_outros_planos(db, user_id)

        db_plano.nome = plano_in.nome
        db_plano.ativo = plano_in.ativo

        # Limpeza da estrutura antiga (Cascade delete cuidará dos exercícios se configurado, 
        # mas deletamos os dias explicitamente para garantir).
        for dia in list(db_plano.dias):
            db.delete(dia)
        
        db.flush() # Aplica as deleções antes de inserir novos

        RitmoService._adicionar_dias_plano(db, db_plano.id, plano_in.dias)

        db.commit()
        db.refresh(db_plano)
        return db_plano

    @staticmethod
    def _adicionar_dias_plano(db: Session, plano_id: int, dias_in: list):
        """
        Helper privado para persistir a hierarquia Dia -> Exercícios.
        """
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
                    api_id=ex_in.api_id, # Link opcional com API externa de exercícios
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
        """Alterna qual plano é o principal, garantindo unicidade."""
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
        """Helper para manter a regra de 'apenas um ativo'."""
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
        Cria uma dieta completa e calcula o total calórico automaticamente.
        """
        if dieta_in.ativo:
            RitmoService._desativar_outras_dietas(db, user_id)

        db_dieta = RitmoDietaConfig(
            user_id=user_id,
            nome=dieta_in.nome,
            ativo=dieta_in.ativo,
            calorias_calculadas=0 # Será atualizado após inserir alimentos
        )
        db.add(db_dieta)
        db.commit()
        db.refresh(db_dieta)

        # Insere alimentos e recebe o somatório calórico
        total_calorias = RitmoService._adicionar_refeicoes_dieta(db, db_dieta.id, dieta_in.refeicoes)

        # Cache do total na tabela pai para evitar queries pesadas na leitura
        db_dieta.calorias_calculadas = total_calorias
        db.commit()
        db.refresh(db_dieta)
        return db_dieta

    @staticmethod
    def update_dieta_completa(db: Session, user_id: int, dieta_id: int, dieta_in: DietaConfigCreate):
        """
        Atualiza dieta usando a mesma estratégia destrutiva (Apaga Refeições -> Recria).
        """
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

        # Remove estrutura antiga
        for ref in list(db_dieta.refeicoes):
            db.delete(ref)
        
        db.flush()

        # Recria estrutura nova e recalcula calorias
        total_calorias = RitmoService._adicionar_refeicoes_dieta(db, db_dieta.id, dieta_in.refeicoes)

        db_dieta.calorias_calculadas = total_calorias
        db.commit()
        db.refresh(db_dieta)
        return db_dieta

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
        Analisa o plano ATIVO e soma as séries por grupo muscular.
        Retorna: Dict { 'Peito': 12, 'Costas': 16 ... }
        """
        plano = db.query(RitmoPlanoTreino).filter(
            RitmoPlanoTreino.user_id == user_id, 
            RitmoPlanoTreino.ativo == True
        ).first()

        if not plano:
            return {}

        volume = {}
        # Itera sobre a estrutura ORM em memória (evita queries N+1 complexas)
        for dia in plano.dias:
            for ex in dia.exercicios:
                grupo = ex.grupo_muscular or "Outros"
                volume[grupo] = volume.get(grupo, 0) + (ex.series or 0)
        return volume

    @staticmethod
    def search_taco_foods(query: str):
        """
        Busca alimentos na Tabela TACO (Tabela Brasileira de Composição de Alimentos).
        
        Integração Externa (Arquivo Local):
            Lê o arquivo 'taco.json' localizado em settings.DATA_DIR.
            Não usa banco de dados para evitar poluição com dados estáticos de terceiros.
        """
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
        
        # Busca linear simples no JSON (Suficiente para < 1000 itens)
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
            
            # Limita resultados para performance do frontend
            if len(results) >= 20:
                break
        
        return results