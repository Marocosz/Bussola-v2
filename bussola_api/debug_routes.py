# debug_routes.py
from app.main import app

print("="*40)
print("ROTAS REGISTRADAS NO FASTAPI:")
print("="*40)

found_agenda = False
for route in app.routes:
    if hasattr(route, "path"):
        print(f"Rota: {route.path}  [{','.join(route.methods)}]")
        if "/agenda" in route.path:
            found_agenda = True

print("="*40)
if found_agenda:
    print("✅ SUCESSO: Rotas de agenda ENCONTRADAS.")
else:
    print("❌ ERRO: O FastAPI NÃO carregou as rotas de agenda.")