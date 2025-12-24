from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from app.services.ai.base import BaseAgent, AgentOutput
from app.services.ai.llm_factory import get_llm
import json

class NutriAgent(BaseAgent):
    def __init__(self):
        self.llm = get_llm(temperature=0.1) # Temperatura mais baixa para ser menos criativo
        self.parser = PydanticOutputParser(pydantic_object=AgentOutput)

    async def analyze(self, data: dict) -> AgentOutput:
        if not data or not data.get('dieta'):
            return AgentOutput(
                urgencia=7,
                insight="Nenhuma dieta configurada.",
                acao="Configure suas refeições."
            )

        template = """
        Você é um algoritmo JSON estrito.
        Sua tarefa: Comparar a DIETA ATIVA com as METAS (Bio).

        DADOS:
        {dados_nutri}

        REGRAS DE ANÁLISE:
        1. Compare 'calorias_calculadas' da dieta com 'gasto_calorico_total' da meta.
        2. Se a diferença for maior que 15%, urgência = 9.
        3. Se a diferença for ok, urgência = 2.

        OUTPUT OBRIGATÓRIO:
        Retorne APENAS um JSON válido. Não inclua markdown (```json), nem explicações, nem código python.
        
        FORMATO DO JSON:
        {format_instructions}
        """

        prompt = ChatPromptTemplate.from_template(template)
        chain = prompt | self.llm | self.parser

        try:
            return await chain.ainvoke({
                "dados_nutri": json.dumps(data, default=str),
                "format_instructions": self.parser.get_format_instructions()
            })
        except Exception as e:
            print(f"Erro NutriAgent: {e}")
            return AgentOutput(urgencia=0, insight="Erro ao analisar dieta.", acao="Tente novamente.")