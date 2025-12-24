import asyncio
from sqlalchemy.orm import Session
from fastapi.encoders import jsonable_encoder
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from app.services.ai.base import BaseOrchestrator
from app.services.ai.llm_factory import get_llm

from app.services.ai.ritmo.agents.bio import BioAgent
from app.services.ai.ritmo.agents.coach import CoachAgent
from app.services.ai.ritmo.agents.nutri import NutriAgent
from app.services.ritmo import RitmoService

class RitmoOrchestrator(BaseOrchestrator):
    def __init__(self, db: Session):
        self.db = db
        self.llm = get_llm(temperature=0.4) # Um pouco mais criativo para a mensagem final
        
        # Instancia os agentes
        self.bio_agent = BioAgent()
        self.coach_agent = CoachAgent()
        self.nutri_agent = NutriAgent()

    async def run(self, user_id: int) -> dict:
        # 1. Coleta de Dados (Banco)
        bio_data = RitmoService.get_latest_bio(self.db, user_id)
        
        plano_ativo = RitmoService.get_plano_ativo(self.db, user_id)
        volume = RitmoService.get_volume_semanal(self.db, user_id)
        treino_data = {"plano_ativo": plano_ativo, "volume": volume}

        dieta_ativa = RitmoService.get_dieta_ativa(self.db, user_id)
        nutri_data = {"dieta": dieta_ativa, "bio_meta": bio_data}

        # Serialização
        bio_json = jsonable_encoder(bio_data)
        treino_json = jsonable_encoder(treino_data)
        nutri_json = jsonable_encoder(nutri_data)

        # 2. Execução Paralela dos Agentes (Eles retornam objetos AgentOutput agora)
        results = await asyncio.gather(
            self.bio_agent.analyze(bio_json),
            self.coach_agent.analyze(treino_json),
            self.nutri_agent.analyze(nutri_json)
        )

        bio_res, coach_res, nutri_res = results

        # 3. Síntese com LangChain
        # Vamos passar os dicionários dos objetos Pydantic para o prompt final
        sintese_prompt = ChatPromptTemplate.from_template("""
        Você é o 'Head of Performance' pessoal.
        Recebeu estes 3 relatórios técnicos:

        1. BIO (Médico): {bio}
        2. COACH (Treino): {coach}
        3. NUTRI (Dieta): {nutri}

        MISSÃO:
        Identifique o problema com MAIOR urgência.
        Escreva um conselho curto, motivador e direto.
        Ignore problemas menores se houver algo crítico.

        Responda APENAS neste JSON:
        {{
            "titulo": "Título curto (ex: Atenção ao Volume)",
            "mensagem": "Texto conversacional explicar e sugerir.",
            "cor": "red" | "orange" | "blue" | "green",
            "origem": "Bio" | "Coach" | "Nutri"
        }}
        """)

        chain = sintese_prompt | self.llm | JsonOutputParser()

        try:
            final_insight = await chain.ainvoke({
                "bio": bio_res.model_dump_json(),
                "coach": coach_res.model_dump_json(),
                "nutri": nutri_res.model_dump_json()
            })
            return final_insight
        except Exception as e:
            print(f"Erro Orquestrador Ritmo: {e}")
            return {
                "titulo": "Erro na IA",
                "mensagem": "Não consegui processar seus dados de ritmo agora.",
                "cor": "gray",
                "origem": "System"
            }