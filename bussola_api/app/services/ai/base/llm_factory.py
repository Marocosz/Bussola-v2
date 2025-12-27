import logging
from typing import Any, Dict, Optional

# Imports do LangChain
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.language_models.chat_models import BaseChatModel

# Imports específicos dos Provedores (LangChain community/partners)
try:
    from langchain_groq import ChatGroq
    from langchain_openai import ChatOpenAI
    from langchain_google_genai import ChatGoogleGenerativeAI
except ImportError:
    pass # Tratado no log abaixo se falhar

# Imports de Utilitários
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from app.core.config import settings

logger = logging.getLogger(__name__)

class LLMFactory:
    """
    Factory baseada em LangChain para orquestrar chamadas a LLMs.
    Suporta: Groq, OpenAI, Gemini.
    Funcionalidades: Retry automático, Forçamento de JSON e Abstração de Provider.
    """
    
    def __init__(self):
        self.provider = settings.LLM_PROVIDER.lower().strip()
        self.model_name = settings.LLM_MODEL_NAME
        self.llm: Optional[BaseChatModel] = None

        self._initialize_llm()

    def _initialize_llm(self):
        """Inicializa a instância do ChatModel do LangChain baseada no config."""
        try:
            if self.provider == "groq":
                if not settings.GROQ_API_KEY:
                    raise ValueError("GROQ_API_KEY is missing.")
                
                # Default model para Groq se não especificado
                model = self.model_name or "llama-3.1-70b-versatile"
                
                self.llm = ChatGroq(
                    api_key=settings.GROQ_API_KEY,
                    model=model,
                    temperature=0.2, # Default, sobrescrito no call_model
                    model_kwargs={"response_format": {"type": "json_object"}} # Força JSON nativo no Groq
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
                    # Gemini usa structured output de forma diferente, mas o parser resolve
                )
            
            else:
                logger.warning(f"Provider '{self.provider}' não suportado. Factory iniciada sem LLM.")

        except Exception as e:
            logger.error(f"Erro ao inicializar LangChain LLM ({self.provider}): {e}")
            # Não quebra o app na inicialização, falha apenas na chamada
            self.llm = None

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
        Executa a chain: Prompt -> LLM -> JSON Parser.
        Retorna sempre um Dicionário Python.
        """
        if not self.llm:
            raise RuntimeError("LLM não foi inicializado corretamente. Verifique as chaves de API.")

        try:
            # 1. Configurar o Parser de JSON do LangChain
            # Ele lida automaticamente com markdown strips (```json)
            parser = JsonOutputParser()

            # 2. Configurar o Template de Prompt
            prompt_template = ChatPromptTemplate.from_messages([
                ("system", system_prompt),
                ("user", "{input}")
            ])

            # 3. Criar a Chain (LCEL)
            # Usamos .bind para ajustar a temperatura dinamicamente nesta chamada específica
            chain = prompt_template | self.llm.bind(temperature=temperature) | parser

            # 4. Executar
            logger.info(f"Chamando LLM ({self.provider}) via LangChain...")
            response = await chain.ainvoke({"input": user_prompt})
            
            return response

        except Exception as e:
            logger.error(f"Erro na execução da LangChain: {e}")
            raise e

# Singleton
llm_client = LLMFactory()