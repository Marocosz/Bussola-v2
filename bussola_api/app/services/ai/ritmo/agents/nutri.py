from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from app.services.ai.base import BaseAgent, AgentOutput
from app.services.ai.llm_factory import get_llm
import json
from datetime import datetime

class NutriAgent(BaseAgent):
    def __init__(self):
        # Temperatura ajustada para permitir análise crítica detalhada
        self.llm = get_llm(temperature=0.15)
        self.parser = PydanticOutputParser(pydantic_object=AgentOutput)

    async def analyze(self, data: dict) -> AgentOutput:
        if not data or not data.get('dieta'):
            return AgentOutput(
                urgencia=6,
                status="atencao",
                insight="Dieta não configurada detalhadamente.",
                acao="Cadastre suas refeições para análise de macros."
            )

        data['data_hoje'] = datetime.now().strftime("%Y-%m-%d")

        template = """
        Você é o 'NutriSmart_Pro', um algoritmo de nutrição esportiva de alta precisão (JSON Output Only).

        SUA MISSÃO:
        Analisar a composição da dieta, a distribuição de macronutrientes ao longo do dia e a qualidade das escolhas em relação à meta biológica.

        ENTRADA (DADOS DA DIETA):
        {dados_nutri}

        DIRETRIZES DE ANÁLISE PROFUNDA:

        1. **Análise de Distribuição Intradia (Refeição por Refeição):**
           - Analise a lista de refeições. Existe alguma refeição desproporcional? (Ex: Jantar com 60% das calorias totais).
           - **Proteína:** Verifique se há proteína adequada no Café da Manhã e Pós-Treino. Se o café da manhã for apenas carboidrato (pão/fruta), gere um alerta de "Pico glicêmico / Baixa saciedade".
           - **Jejum:** Se houver poucas refeições (< 3), verifique se as calorias estão sendo batidas ou se há déficit não intencional.

        2. **Qualidade dos Macros vs Meta:**
           - **Hipertrofia:** A proteína está acima de 1.6g/kg? Há superávit calórico? Se houver déficit, alerte que "ganho de massa será comprometido".
           - **Emagrecimento:** Há déficit calórico? A gordura não está muito alta (> 1g/kg) roubando espaço dos carboidratos necessários para treino?
           - **Proteína Baixa:** Se a proteína total for baixa, isso é status 'critico' para qualquer objetivo estético.

        3. **Variabilidade e Tédio:**
           - Se a dieta é antiga (> 60 dias) e monótona, sugira rotação de alimentos (ex: trocar frango por peixe, arroz por batata) para melhorar a adesão e perfil de micronutrientes.

        REGRA DE RETORNO (PRIORIDADE):
        - Seja específico. Não diga "Melhore a dieta". Diga "Seu café da manhã tem pouca proteína (apenas 5g). Tente adicionar ovos ou whey."
        - Se houver inconsistência matemática grave (Meta diz Cutting, Dieta diz Bulking), prioridade máxima.
        - NÃO repita os dados de entrada.

        OUTPUT OBRIGATÓRIO (JSON):
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
            return AgentOutput(
                urgencia=0, 
                status="ok",
                insight="Não foi possível ler os detalhes das refeições.", 
                acao="Verifique o cadastro dos alimentos."
            )