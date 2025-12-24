from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from app.services.ai.base import BaseAgent, AgentOutput
from app.services.ai.llm_factory import get_llm
import json

class CoachAgent(BaseAgent):
    def __init__(self):
        self.llm = get_llm(temperature=0.1)
        self.parser = PydanticOutputParser(pydantic_object=AgentOutput)

    async def analyze(self, data: dict) -> AgentOutput:
        if not data or not data.get('plano_ativo'):
            return AgentOutput(
                urgencia=8,
                insight="Você não tem nenhum plano de treino ativo.",
                acao="Crie ou ative um plano na aba Treinos."
            )

        template = """
        Você é um algoritmo JSON estrito de análise de treino.

        DADOS DO TREINO:
        {dados_treino}

        REGRAS:
        1. Identifique se algum grupo muscular tem volume excessivo (>25 series).
        2. Identifique se falta treino de perna (Quadríceps/Posterior).
        3. Se houver risco de lesão, urgência 8-10. Se estiver bom, urgência 1-3.

        OUTPUT OBRIGATÓRIO:
        Retorne APENAS um JSON válido. Sem markdown, sem texto extra.

        FORMATO DO JSON:
        {format_instructions}
        """

        prompt = ChatPromptTemplate.from_template(template)
        chain = prompt | self.llm | self.parser

        try:
            return await chain.ainvoke({
                "dados_treino": json.dumps(data, default=str),
                "format_instructions": self.parser.get_format_instructions()
            })
        except Exception as e:
            print(f"Erro CoachAgent: {e}")
            return AgentOutput(urgencia=0, insight="Erro ao analisar treino.", acao="Tente novamente.")