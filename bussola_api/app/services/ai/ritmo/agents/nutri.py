import json
import re
from datetime import datetime
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from app.services.ai.base import BaseAgent, AgentOutput
from app.services.ai.llm_factory import get_llm

class NutriAgent(BaseAgent):
    def __init__(self):
        # Temperatura ajustada para permitir análise crítica detalhada
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
        # Validação básica de entrada
        if not data or not data.get('dieta'):
            return AgentOutput(
                urgencia=6,
                status="atencao",
                insight="Não encontrei uma estrutura de dieta detalhada para analisar. Para que eu possa atuar como seu nutricionista, preciso que você cadastre suas refeições e alimentos.",
                acao="Cadastre suas refeições e alimentos na aba de Nutrição."
            )

        # Adiciona contexto temporal
        data['data_hoje'] = datetime.now().strftime("%Y-%m-%d")

        template = """
        Você é o 'NutriSmart_Pro', um Nutricionista Esportivo Sênior e Algoritmo de Precisão (JSON Output Only).

        SUA MISSÃO:
        Realizar uma auditoria completa, profunda e educativa na dieta do usuário. Você deve agir como um profissional humano experiente: analítico, didático e motivador. Não seja superficial. Mergulhe nos dados.

        --------------------------------------------------
        DADOS DE ENTRADA (CONTEXTO COMPLETO):
        {dados_nutri}
        --------------------------------------------------

        DIRETRIZES DE ANÁLISE PROFUNDA (PASSO A PASSO):

        1. **Cruzamento Meta vs. Realidade:**
           - Compare o 'Objetivo' (ex: Hipertrofia) com o balanço calórico total.
           - Se Objetivo = Hipertrofia mas Calorias < Gasto Total: Aponte erro crítico (falta de substrato).
           - Se Objetivo = Perda de Peso mas Calorias > Gasto Total: Aponte erro crítico (excesso calórico).

        2. **Análise Refeição por Refeição (Micro-Análise):**
           - Identifique refeições "fracas" (ex: lanche só com carboidrato simples, jantar pobre em proteína).
           - Identifique desequilíbrios de volume (ex: Almoço com 1000kcal e Lanche da Tarde com 150kcal). Isso gera fome ou letargia? Explique.
           - Avalie a qualidade dos alimentos (ex: "Trocar pão branco por integral aumentaria a saciedade").

        3. **Análise de Macronutrientes:**
           - A proteína está bem distribuída ao longo do dia ou concentrada em uma única refeição? (Importante para síntese proteica).
           - A gordura está adequada para manutenção hormonal (>0.8g/kg)?

        4. **Psicologia e Aderência:**
           - Elogie boas escolhas! (ex: "Ótima inclusão de fibras no almoço").
           - Se a dieta é antiga (> 60 dias), pergunte sobre palatabilidade/enjoo.

        --------------------------------------------------
        EXEMPLO DE RACIOCÍNIO (FEW-SHOT) - SIGA ESTE NÍVEL DE PROFUNDIDADE:
        
        *Cenário:* Usuário quer Hipertrofia. Café da manhã: Café preto (0kcal). Almoço: Frango e Arroz (500kcal). Jantar: Pizza (1500kcal).
        
        *Análise Esperada no campo 'insight':*
        "Visão Geral: Sua dieta atual está em déficit calórico, o que contradiz seu objetivo de Hipertrofia. Você precisa de superávit para crescer.
        
        Análise por Refeição:
        - Café da Manhã: Está zerado. Isso aumenta o catabolismo matinal. Sugiro incluir ovos ou whey.
        - Jantar: Concentra 75% das suas calorias em alimentos de baixa densidade nutricional (Pizza). Isso prejudica a qualidade do sono e a digestão.
        
        Pontos Fortes: O almoço tem uma boa combinação de macro e micronutrientes.
        
        Recomendação: Redistribuir as calorias do jantar para o café da manhã e adicionar uma fonte de gordura boa (azeite/abacate)."
        --------------------------------------------------

        REGRAS RÍGIDAS DE SAÍDA (JSON):
        1. **NÃO repita os dados de entrada.**
        2. O campo `insight` deve ser um texto longo, formatado com quebras de linha (\\n) para separar as seções (Visão Geral, Análise Detalhada, Sugestões). Use bullet points.
        3. O campo `acao` deve ser a ÚNICA atitude mais importante que o usuário deve tomar agora.
        4. O campo `status` deve refletir a gravidade da análise ('otimo', 'atencao', 'critico').

        FORMATO OBRIGATÓRIO:
        {format_instructions}
        """

        prompt = ChatPromptTemplate.from_template(template)
        # Removemos o parser da chain para fazer o parse manual seguro
        chain = prompt | self.llm 

        try:
            raw_response = await chain.ainvoke({
                "dados_nutri": json.dumps(data, default=str),
                "format_instructions": self.parser.get_format_instructions()
            })

            text_response = raw_response.content if hasattr(raw_response, 'content') else str(raw_response)
            clean_json = self._clean_json_string(text_response)
            parsed_data = json.loads(clean_json)
            
            return AgentOutput(**parsed_data)

        except Exception as e:
            print(f"Erro NutriAgent: {e}")
            return AgentOutput(
                urgencia=0, 
                status="ok",
                insight="Não foi possível processar a análise detalhada dos alimentos neste momento.", 
                acao="Verifique se os alimentos estão cadastrados corretamente."
            )