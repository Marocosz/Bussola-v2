"""
=======================================================================================
ARQUIVO: llm_factory.py (Fábrica de Modelos de Linguagem)
=======================================================================================

OBJETIVO:
    Centralizar e abstrair a conexão com provedores de Inteligência Artificial (LLMs)
    como OpenAI, Groq e Google Gemini. Este arquivo garante que o restante do sistema
    não precise saber qual IA está sendo usada por baixo dos panos.

CAMADA:
    Core / Infrastructure (Backend).
    É a única porta de saída para chamadas de IA.

RESPONSABILIDADES:
    1. Abstração de Provider: Trocar de 'OpenAI' para 'Groq' mudando apenas uma variável de ambiente.
    2. Resiliência (Retry): Tentar novamente automaticamente se a API da IA falhar ou der timeout.
    3. Parsing Seguro: Garantir que a resposta textual da IA seja convertida em JSON válido.
    4. LangChain Integration: Usar o framework LangChain para gerenciar prompts e templates.

INTEGRAÇÕES:
    - LangChain (Framework de Orquestração)
    - APIs Externas: OpenAI, Groq, Google Gemini
    - Config Settings (Variáveis de Ambiente)
"""

import logging
from typing import Any, Dict, Optional

# Imports do LangChain (Core)
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.language_models.chat_models import BaseChatModel

# Imports específicos dos Provedores (LangChain community/partners)
# O try/except garante que o código não quebre se faltar uma lib específica no ambiente,
# permitindo que o sistema suba mesmo se um driver não estiver instalado.
try:
    from langchain_groq import ChatGroq
    from langchain_openai import ChatOpenAI
    from langchain_google_genai import ChatGoogleGenerativeAI
except ImportError:
    pass # Falha silenciosa na importação; será logada no método _initialize_llm se necessário

# Imports de Utilitários de Resiliência
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from app.core.config import settings

logger = logging.getLogger(__name__)

class LLMFactory:
    """
    Fábrica Singleton para instanciar e gerenciar conexões com LLMs.
    
    Design Pattern: Factory + Singleton
    Por que?: Evita re-autenticar ou recriar clientes de API a cada requisição,
    mantendo uma conexão 'quente' e configurada globalmente.
    """
    
    def __init__(self):
        # Normaliza o nome do provedor para evitar erros de case (Ex: "Groq" -> "groq")
        self.provider = settings.LLM_PROVIDER.lower().strip()
        self.model_name = settings.LLM_MODEL_NAME
        self.llm: Optional[BaseChatModel] = None

        # Inicializa a conexão imediatamente na criação da instância
        self._initialize_llm()

    def _initialize_llm(self):
        """
        Configura o driver correto do LangChain baseado na variável de ambiente LLM_PROVIDER.
        
        LÓGICA DE DECISÃO:
        - Verifica qual provider foi escolhido.
        - Valida se a API KEY correspondente existe.
        - Instancia a classe específica (ChatGroq, ChatOpenAI, etc).
        - Configura para retornar JSON sempre que possível (Mode 'json_object').
        """
        try:
            if self.provider == "groq":
                if not settings.GROQ_API_KEY:
                    raise ValueError("GROQ_API_KEY is missing.")
                
                # Fallback para modelo versátil se não especificado no .env
                model = self.model_name or "llama-3.3-70b-versatile"
                
                self.llm = ChatGroq(
                    api_key=settings.GROQ_API_KEY,
                    model=model,
                    temperature=0.2, # Temperatura baixa para respostas mais determinísticas
                    model_kwargs={"response_format": {"type": "json_object"}} # Força o modelo a outputar JSON válido
                )

            elif self.provider == "openai":
                if not settings.OPENAI_API_KEY:
                    raise ValueError("OPENAI_API_KEY is missing.")
                
                model = self.model_name or "gpt-4o-mini"
                
                self.llm = ChatOpenAI(
                    api_key=settings.OPENAI_API_KEY,
                    model=model,
                    temperature=0.2,
                    model_kwargs={"response_format": {"type": "json_object"}}
                )

            elif self.provider == "gemini":
                if not settings.GEMINI_API_KEY:
                    raise ValueError("GEMINI_API_KEY is missing.")
                
                model = self.model_name or "gemini-1.5-flash"
                
                self.llm = ChatGoogleGenerativeAI(
                    google_api_key=settings.GEMINI_API_KEY,
                    model=model,
                    temperature=0.2,
                    # Gemini não usa 'response_format' igual OpenAI/Groq, 
                    # a estruturação depende mais do parser do LangChain.
                )
            
            else:
                logger.warning(f"Provider '{self.provider}' não suportado. Factory iniciada sem LLM.")

        except Exception as e:
            # Estratégia de Falha:
            # Não quebramos a inicialização do servidor (uvicorn) se a chave estiver errada.
            # O erro só será levantado quando alguém tentar usar a IA (runtime error).
            logger.error(f"Erro ao inicializar LangChain LLM ({self.provider}): {e}")
            self.llm = None

    # DECORATOR DE RETRY (Tenacity)
    # Configuração de Resiliência:
    # - Tenta até 3 vezes (stop_after_attempt)
    # - Espera exponencial (2s, 4s, 8s...) entre tentativas (wait_exponential)
    # - Retenta para qualquer Exception (retry_if_exception_type)
    @retry(
        stop=stop_after_attempt(3), 
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(Exception),
        reraise=True
    )
    async def call_model(
        self, 
        system_prompt: str, 
        user_prompt: str, 
        temperature: float = 0.2
    ) -> Dict[str, Any]:
        """
        Executa uma chamada completa à IA, encapsulando a complexidade do LangChain.

        FLUXO:
        1. Prepara o Parser JSON (para garantir que a string da IA vire um Dict Python).
        2. Monta o Prompt com as mensagens de Sistema e Usuário.
        3. Executa a Chain (Prompt -> LLM -> Parser).
        4. Retorna o objeto Python pronto para uso.

        ENTRADA:
        - system_prompt: Instruções de comportamento ("Você é um nutricionista...").
        - user_prompt: Dados ou pergunta do usuário.
        - temperature: Criatividade (0.0 = Robô, 1.0 = Poeta).

        RETORNO:
        - Dict[str, Any]: A resposta da IA já parseada como dicionário.
        """
        if not self.llm:
            raise RuntimeError("LLM não foi inicializado corretamente. Verifique as chaves de API.")

        try:
            # 1. Configurar o Parser
            # O JsonOutputParser é robusto: remove ```json e ```markdown antes de dar parse.
            parser = JsonOutputParser()

            # 2. Configurar Template
            # Define papéis claros: System (Regras) e User (Dados/Input)
            prompt_template = ChatPromptTemplate.from_messages([
                ("system", system_prompt),
                ("user", "{input}") # Placeholder para injeção dinâmica
            ])

            # 3. Construção da Chain (LCEL - LangChain Expression Language)
            # O .bind permite sobrescrever a temperatura padrão configurada no __init__
            # apenas para esta chamada específica.
            chain = prompt_template | self.llm.bind(temperature=temperature) | parser

            # 4. Execução Assíncrona
            logger.info(f"Chamando LLM ({self.provider}) via LangChain...")
            response = await chain.ainvoke({"input": user_prompt})
            
            return response

        except Exception as e:
            # Logs detalhados são cruciais aqui para debugar prompts que quebram o JSON
            logger.error(f"Erro na execução da LangChain: {e}")
            raise e

# ==============================================================================
# INSTÂNCIA GLOBAL
# ==============================================================================
# Disponibiliza uma única instância (Singleton) para ser importada em todo o projeto.
llm_client = LLMFactory()