"""
=======================================================================================
ARQUIVO: types.py (Tipos de coluna customizados)
=======================================================================================
OBJETIVO:
    `MoneyCents` — armazena valores monetários como CENTAVOS INTEIROS no banco
    (exato, sem erro de ponto flutuante tipo 0.1 + 0.2), mas expõe/aceita REAIS
    (float) no lado Python. Assim o código de aplicação e a API continuam em reais
    e o armazenamento/arredondamento fica exato.

    Observações:
    - `func.sum(coluna)` no SQLAlchemy herda este tipo → volta em REAIS automaticamente.
    - `func.avg(coluna)` NÃO herda o tipo → volta em CENTAVOS (dividir por 100 no uso).
=======================================================================================
"""
from sqlalchemy import Integer
from sqlalchemy.types import TypeDecorator


class MoneyCents(TypeDecorator):
    """Dinheiro: centavos inteiros no banco, reais (float) no Python."""
    impl = Integer
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return int(round(float(value) * 100))

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return value / 100.0
