import httpx
from typing import List, Dict, Any

class ExternalRitmoService:
    WGER_URL = "https://wger.de/api/v2"
    # Usando o endpoint global para maior estabilidade
    OFF_URL = "https://world.openfoodfacts.org/cgi/search.pl"

    # Essencial: APIs públicas bloqueiam requisições sem User-Agent identificado
    HEADERS = {
        "User-Agent": "BussolaApp/2.0 (marcos.rodrigues; personal-project)"
    }

    @staticmethod
    async def search_exercises(query: str) -> List[Dict[str, Any]]:
        """Busca exercícios na Wger."""
        async with httpx.AsyncClient(headers=ExternalRitmoService.HEADERS, timeout=15.0) as client:
            try:
                response = await client.get(
                    f"{ExternalRitmoService.WGER_URL}/exercise/search/",
                    params={"term": query}
                )
                response.raise_for_status()
                data = response.json()
                
                results = []
                for item in data.get("suggestions", []):
                    ex_data = item.get("data", {})
                    results.append({
                        "nome": item.get("value"),
                        "grupo_sugerido": ex_data.get("category", "Outros"),
                        "id_externo": ex_data.get("id")
                    })
                return results
            except Exception as e:
                print(f"Erro Wger: {str(e)}")
                return []

    @staticmethod
    async def search_foods(query: str) -> List[Dict[str, Any]]:
        """Busca alimentos na OpenFoodFacts com suporte a Português."""
        async with httpx.AsyncClient(headers=ExternalRitmoService.HEADERS, timeout=15.0) as client:
            try:
                params = {
                    "search_terms": query,
                    "search_simple": 1,
                    "action": "process",
                    "json": 1,
                    "page_size": 20,
                    "lc": "pt"  # Prioriza resultados em português
                }
                response = await client.get(ExternalRitmoService.OFF_URL, params=params)
                response.raise_for_status()
                data = response.json()

                results = []
                for p in data.get("products", []):
                    # Ignora itens sem nome ou informações básicas
                    if not p.get("product_name"): continue
                    
                    n = p.get("nutriments", {})
                    # Pega kcal de 100g (padrão OFF)
                    calorias = n.get("energy-kcal_100g") or n.get("energy-kcal") or 0
                    
                    results.append({
                        "nome": p.get("product_name", "Desconhecido"),
                        "marca": p.get("brands", "Genérica").split(',')[0],
                        "calorias": round(float(calorias), 1),
                        "proteina": round(float(n.get("proteins_100g", 0)), 1),
                        "carbo": round(float(n.get("carbohydrates_100g", 0)), 1),
                        "gordura": round(float(n.get("fat_100g", 0)), 1)
                    })
                return results
            except Exception as e:
                print(f"Erro detalhado OpenFoodFacts: {str(e)}")
                return []