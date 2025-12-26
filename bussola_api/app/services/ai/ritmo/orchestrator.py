import asyncio
from typing import List
from sqlalchemy.orm import Session
from fastapi.encoders import jsonable_encoder
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field

from app.services.ai.base import BaseOrchestrator
from app.services.ai.llm_factory import get_llm

from app.services.ai.ritmo.agents.bio import BioAgent
from app.services.ai.ritmo.agents.coach import CoachAgent
from app.services.ai.ritmo.agents.nutri import NutriAgent
from app.services.ritmo import RitmoService

# --- MODELOS DE SAÍDA ESTRITA ---
class AgenteResumo(BaseModel):
    nome: str = Field(description="Nome do agente: 'Bio', 'Nutri' ou 'Coach'")
    status: str = Field(description="Status exato: 'ok', 'atencao', 'critico' ou 'otimo'")
    resumo: str = Field(description="Resumo curto do insight em uma frase")

class RitmoResponse(BaseModel):
    titulo: str = Field(description="Manchete curta e motivadora")
    mensagem: str = Field(description="Texto explicativo curto")
    cor: str = Field(description="Cor do alerta: 'red', 'orange', 'green' ou 'blue'")
    origem: str = Field(description="Origem do insight principal (geralmente 'System')")
    agentes: List[AgenteResumo] = Field(description="Lista com o resumo dos 3 agentes")

class RitmoOrchestrator(BaseOrchestrator):
    def __init__(self, db: Session):
        self.db = db
        self.llm = get_llm(temperature=0.2) # Baixei a temperatura para reduzir alucinações
        
        self.bio_agent = BioAgent()
        self.coach_agent = CoachAgent()
        self.nutri_agent = NutriAgent()
        
        # Parser estrito
        self.parser = PydanticOutputParser(pydantic_object=RitmoResponse)

    async def run(self, user_id: int) -> dict:
        # 1. Coleta de Dados
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

        # 2. Execução Paralela dos Agentes
        results = await asyncio.gather(
            self.bio_agent.analyze(bio_json),
            self.coach_agent.analyze(treino_json),
            self.nutri_agent.analyze(nutri_json)
        )

        bio_res, coach_res, nutri_res = results

        # 3. Síntese Inteligente
        template = """
        Você é o 'Head of Performance'. Analise os relatórios recebidos:

        1. BIO: {bio}
        2. COACH: {coach}
        3. NUTRI: {nutri}

        SUA MISSÃO:
        Gerar um JSON estruturado contendo o resumo geral e os detalhes de cada área.
        
        REGRAS RÍGIDAS:
        1. NÃO escreva código, não escreva markdown, não converse.
        2. Retorne APENAS o JSON válido seguindo o formato abaixo.
        3. Para a lista 'agentes', extraia o status e crie um resumo de 1 linha baseado no insight original.

        FORMATO DE SAÍDA:
        {format_instructions}
        """

        prompt = ChatPromptTemplate.from_template(template)
        chain = prompt | self.llm | self.parser

        try:
            # Passamos os outputs dos agentes convertidos para string/dict
            final_insight = await chain.ainvoke({
                "bio": bio_res.model_dump_json(),
                "coach": coach_res.model_dump_json(),
                "nutri": nutri_res.model_dump_json(),
                "format_instructions": self.parser.get_format_instructions()
            })
            
            # Converte o objeto Pydantic para dict Python padrão para o FastAPI
            return final_insight.model_dump()

        except Exception as e:
            print(f"Erro Orquestrador Ritmo: {e}")
            # Fallback seguro que mantém a estrutura para o frontend não quebrar
            return {
                "titulo": "Análise Indisponível",
                "mensagem": "Não foi possível consolidar os dados dos agentes no momento.",
                "cor": "gray",
                "origem": "System",
                "agentes": [
                    {"nome": "Bio", "status": "ok", "resumo": bio_res.insight[:50] + "..."},
                    {"nome": "Coach", "status": "ok", "resumo": coach_res.insight[:50] + "..."},
                    {"nome": "Nutri", "status": "ok", "resumo": nutri_res.insight[:50] + "..."}
                ]
            }