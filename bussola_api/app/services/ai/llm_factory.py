from langchain_core.language_models.chat_models import BaseChatModel
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
# from langchain_openai import ChatOpenAI 
from app.core.config import settings
from functools import lru_cache

class LLMFactory:
    @staticmethod
    def create_llm(temperature: float = 0.3) -> BaseChatModel:
        """
        Cria e retorna uma instância de Chat Model do LangChain
        baseado na configuração do projeto.
        """
        # Garante que provider não seja None antes de chamar lower()
        provider = (settings.LLM_PROVIDER or "groq").lower()
        
        if provider == "groq":
            if not settings.GROQ_API_KEY:
                raise ValueError("GROQ_API_KEY não configurada.")
            return ChatGroq(
                groq_api_key=settings.GROQ_API_KEY,
                model_name=settings.LLM_MODEL_NAME or "llama-3.1-8b-instant",
                temperature=temperature
            )
            
        elif provider == "gemini":
            if not settings.GEMINI_API_KEY:
                raise ValueError("GEMINI_API_KEY não configurada.")
            return ChatGoogleGenerativeAI(
                google_api_key=settings.GEMINI_API_KEY,
                model=settings.LLM_MODEL_NAME or "gemini-1.5-flash",
                temperature=temperature,
                convert_system_message_to_human=True 
            )
            
        # elif provider == "openai":
        #     return ChatOpenAI(...)

        else:
            raise ValueError(f"Provedor de LLM '{provider}' não suportado.")

# [CORREÇÃO] Renomeado de get_llm_instance para get_llm para bater com os imports
@lru_cache()
def get_llm(temperature: float = 0.3) -> BaseChatModel:
    return LLMFactory.create_llm(temperature)