import json
import re
from datetime import datetime
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from app.services.ai.base import BaseAgent, AgentOutput
from app.services.ai.llm_factory import get_llm

class BioAgent(BaseAgent):
    def __init__(self):
        # Temperatura baixa para análise de dados precisa
        self.llm = get_llm(temperature=0.1)
        self.parser = PydanticOutputParser(pydantic_object=AgentOutput)

    def _clean_json_string(self, text: str) -> str:
        """Limpa a string para garantir que apenas o JSON seja processado."""
        # Remove blocos de código markdown se existirem
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        
        # Tenta encontrar o início e fim do JSON
        start = text.find('{')
        end = text.rfind('}') + 1
        if start != -1 and end != -1:
            return text[start:end]
        return text.strip()

    async def analyze(self, data: dict) -> AgentOutput:
        if not data:
            return AgentOutput(
                urgencia=5,
                status="atencao",
                insight="Perfil biométrico incompleto.",
                acao="Preencha seus dados de peso e altura."
            )

        # Adiciona data de hoje para o LLM calcular delta dias
        data['data_hoje'] = datetime.now().strftime("%Y-%m-%d")

        template = """
        Você é o 'BioAnalyst', um algoritmo especializado em fisiologia e biometria (JSON Output Only).
        
        SUA MISSÃO:
        Monitorar a consistência dos dados do usuário e garantir que o perfil físico esteja atualizado para que os cálculos de dieta/treino não fiquem obsoletos.

        ENTRADA (DADOS DO USUÁRIO):
        {dados_usuario}

        REGRAS DE ANÁLISE RÍGIDAS:
        1. **Atualização (Recência):** - Se 'data_registro' > 30 dias atrás: Sugira uma atualização de peso para recalcular a TMB. (Status: atencao, Urgencia: 6).
           - Se 'data_registro' < 7 dias: Dados frescos. (Status: otimo, Urgencia: 1).
        
        2. **Coerência TMB vs Objetivo:**
           - Verifique se o 'objetivo' (ex: emagrecer, hipertrofia) faz sentido com o peso atual e BF (se houver).
           - Se tudo parecer normal, retorne um feedback positivo de manutenção.

        3. **Sem Alarmismo:**
           - Evite linguagem de pânico. Use tom profissional, clínico e direto.
           - Se estiver tudo bem, o insight deve ser: "Dados atualizados e consistentes. TMB calculada com precisão."
        
        4. **Formato:**
           - NÃO repita os dados de entrada.
           - Retorne APENAS o JSON válido.

        OUTPUT OBRIGATÓRIO (JSON):
        {format_instructions}
        """

        prompt = ChatPromptTemplate.from_template(template)
        # Removemos o parser da chain para fazer o parse manual seguro
        chain = prompt | self.llm 

        try:
            raw_response = await chain.ainvoke({
                "dados_usuario": json.dumps(data, default=str),
                "format_instructions": self.parser.get_format_instructions()
            })

            # Extração segura do texto
            text_response = raw_response.content if hasattr(raw_response, 'content') else str(raw_response)
            
            # Limpeza e Parse
            clean_json = self._clean_json_string(text_response)
            parsed_data = json.loads(clean_json)
            
            return AgentOutput(**parsed_data)

        except Exception as e:
            print(f"Erro BioAgent: {e}")
            return AgentOutput(
                urgencia=0, 
                status="ok", 
                insight="Análise biométrica indisponível no momento.", 
                acao="Tente novamente mais tarde."
            )