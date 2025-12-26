import json
import re
from datetime import datetime
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from app.services.ai.base import BaseAgent, AgentOutput
from app.services.ai.llm_factory import get_llm

class CoachAgent(BaseAgent):
    def __init__(self):
        # Aumentei levemente a temperatura para permitir correlações mais complexas
        self.llm = get_llm(temperature=0.15)
        self.parser = PydanticOutputParser(pydantic_object=AgentOutput)

    def _clean_json_string(self, text: str) -> str:
        """Limpa a string para garantir que apenas o JSON seja processado."""
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        
        start = text.find('{')
        end = text.rfind('}') + 1
        if start != -1 and end != -1:
            return text[start:end]
        return text.strip()

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

        CONTEXTO DOS DADOS:
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

        --------------------------------------------------
        EXEMPLO DE RACIOCÍNIO (FEW-SHOT) - SIGA ESTE NÍVEL DE PROFUNDIDADE:
        
        *Cenário:* Usuário busca Hipertrofia. Treino A (Peito/Tríceps - 15 séries totais), Treino B (Costas/Bíceps - 15 séries totais), Treino C (Ombro - 10 séries). Perna não consta ou tem apenas 3 séries de Agachamento.
        
        *Análise Esperada no campo 'insight':*
        "Visão Geral: Sua divisão de treino superior está bem estruturada, mas existe um desequilíbrio crítico nos membros inferiores.
        
        Análise Estrutural:
        - Volume Superior: Adequado (15 séries). Boa relação agonista/antagonista.
        - Volume Inferior: Crítico (apenas 3 séries). Isso gera assimetria estética e funcional. Pernas exigem maior volume para hipertrofia.
        
        Pontos Fortes: A divisão Peito/Tríceps e Costas/Bíceps aproveita bem a sinergia muscular.
        
        Recomendação: Adicione urgentemente exercícios isolados para Quadríceps e Posterior no dia C ou crie um dia D exclusivo para Pernas."
        --------------------------------------------------

        REGRAS DE RETORNO (PRIORIDADE):
        - Se encontrar um erro grave (risco de lesão, desequilíbrio severo), status='critico' ou 'atencao'.
        - Se a estrutura estiver sólida, elogie um ponto específico (ex: "Ótima proporção entre empurrar e puxar").
        - NÃO repita os dados de entrada.

        OUTPUT OBRIGATÓRIO (JSON):
        {format_instructions}
        """

        prompt = ChatPromptTemplate.from_template(template)
        # Removemos o parser da chain para fazer o parse manual seguro
        chain = prompt | self.llm 

        try:
            raw_response = await chain.ainvoke({
                "dados_treino": json.dumps(data, default=str),
                "format_instructions": self.parser.get_format_instructions()
            })

            text_response = raw_response.content if hasattr(raw_response, 'content') else str(raw_response)
            clean_json = self._clean_json_string(text_response)
            parsed_data = json.loads(clean_json)
            
            return AgentOutput(**parsed_data)

        except Exception as e:
            print(f"Erro CoachAgent: {e}")
            return AgentOutput(
                urgencia=0, 
                status="ok",
                insight="Não foi possível processar a estrutura detalhada do treino.", 
                acao="Continue treinando com constância."
            )