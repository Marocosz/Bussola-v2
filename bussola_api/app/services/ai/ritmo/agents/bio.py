from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from app.services.ai.base import BaseAgent, AgentOutput
from app.services.ai.llm_factory import get_llm
import json

class BioAgent(BaseAgent):
    def __init__(self):
        self.llm = get_llm(temperature=0.1)
        self.parser = PydanticOutputParser(pydantic_object=AgentOutput)

    async def analyze(self, data: dict) -> AgentOutput:
        if not data:
            return AgentOutput(
                urgencia=10,
                insight="Não tenho dados corporais seus registrados.",
                acao="Registre seu peso e altura para começarmos."
            )

        template = """
        Você é um algoritmo JSON estrito de análise biométrica.

        DADOS DO USUÁRIO:
        {dados_usuario}

        REGRAS:
        1. Se 'data_registro' for antiga (>15 dias), urgência alta (8-10).
        2. Analise coerência entre TMB e Objetivo.

        OUTPUT OBRIGATÓRIO:
        Retorne APENAS um JSON válido. Sem markdown, sem texto extra.

        FORMATO DO JSON:
        {format_instructions}
        """

        prompt = ChatPromptTemplate.from_template(template)
        chain = prompt | self.llm | self.parser

        try:
            return await chain.ainvoke({
                "dados_usuario": json.dumps(data, default=str),
                "format_instructions": self.parser.get_format_instructions()
            })
        except Exception as e:
            print(f"Erro BioAgent: {e}")
            return AgentOutput(urgencia=0, insight="Erro ao analisar bio.", acao="Tente novamente.")