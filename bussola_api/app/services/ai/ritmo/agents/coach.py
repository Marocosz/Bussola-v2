from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from app.services.ai.base import BaseAgent, AgentOutput
from app.services.ai.llm_factory import get_llm
import json
from datetime import datetime

class CoachAgent(BaseAgent):
    def __init__(self):
        # Aumentei levemente a temperatura para permitir correlações mais complexas
        self.llm = get_llm(temperature=0.15)
        self.parser = PydanticOutputParser(pydantic_object=AgentOutput)

    async def analyze(self, data: dict) -> AgentOutput:
        if not data or not data.get('plano_ativo'):
            return AgentOutput(
                urgencia=7,
                status="atencao",
                insight="Nenhum ciclo de treino ativo detectado para análise detalhada.",
                acao="Crie um novo plano de treino para receber métricas de performance."
            )

        data['data_hoje'] = datetime.now().strftime("%Y-%m-%d")

        template = """
        Você é o 'PerformanceCoach_Pro', um algoritmo especialista em biomecânica e periodização avançada (JSON Output Only).
        
        SUA MISSÃO:
        Realizar uma auditoria técnica profunda no plano de treino do usuário, identificando falhas estruturais, desequilíbrios musculares e desalinhamento com o objetivo.

        ENTRADA (DADOS DO TREINO):
        {dados_treino}

        DIRETRIZES DE ANÁLISE PROFUNDA:

        1. **Auditoria de Volume por Grupo Muscular (Séries Semanais):**
           - Analise o objeto 'volume' (se disponível) ou conte as séries no plano.
           - **Cenário Junk Volume:** Se algum músculo pequeno (ex: Bíceps/Tríceps) tem mais séries que músculos grandes (ex: Costas/Pernas), isso é um erro de prioridade.
           - **Cenário Negligência:** Se 'Pernas' (Quadríceps/Posterior) somam menos de 10 séries semanais e o objetivo é estético/hipertrofia -> Alerta de desequilíbrio inferior.
           - **Cenário Excesso:** Qualquer grupo acima de 25 séries semanais requer alerta de risco de overtraining/lesão, a menos que o usuário seja avançado.

        2. **Análise de Divisão e Frequência:**
           - Verifique a distribuição dos dias. Existe descanso suficiente?
           - Se o treino for ABC ou superior, verifique se há conflito de sinergistas (ex: Treinar Peito no dia A e Tríceps/Ombro isolado no dia B logo em seguida).

        3. **Alinhamento com Objetivo (Meta):**
           - Se Objetivo = "Força": O foco deve ser exercícios compostos com volume moderado.
           - Se Objetivo = "Hipertrofia": O volume deve ser predominante.
           - Se Objetivo = "Emagrecimento": A densidade/frequência é crucial.
           - Aponte se o treino atual contradiz o objetivo declarado.

        4. **Estagnação Temporal:**
           - Planos com > 12 semanas sem alteração perdem eficiência (platô).

        REGRA DE RETORNO (PRIORIDADE):
        - Se encontrar um erro grave (risco de lesão, desequilíbrio severo), status='critico' ou 'atencao'.
        - Se a estrutura estiver sólida, elogie um ponto específico (ex: "Ótima proporção entre empurrar e puxar").
        - NÃO repita os dados de entrada.

        OUTPUT OBRIGATÓRIO (JSON):
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
            return AgentOutput(
                urgencia=0, 
                status="ok",
                insight="Não foi possível processar a estrutura detalhada do treino.", 
                acao="Continue treinando com constância."
            )