# Pega a Base do arquivo neutro
from app.db.base_class import Base

# Importa os modelos para registrá-los no metadata da Base
from app.models.user import User
from app.models.financas import Categoria, Transacao
from app.models.registros import Anotacao, Link
from app.models.cofre import Segredo
from app.models.agenda import Compromisso

# --- NOVO: Módulo Ritmo ---
from app.models.ritmo import (
    RitmoBio, 
    RitmoPlanoTreino, 
    RitmoDiaTreino, 
    RitmoExercicioItem, 
    RitmoDietaConfig, 
    RitmoRefeicao, 
    RitmoAlimentoItem
)