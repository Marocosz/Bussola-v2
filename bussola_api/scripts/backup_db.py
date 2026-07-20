"""
=======================================================================================
ARQUIVO: backup_db.py (Backup do SQLite)
=======================================================================================
OBJETIVO:
    Gerar um snapshot CONSISTENTE do banco SQLite (finanças + cofre cifrado) usando
    `VACUUM INTO` (backup online seguro, não corrompe mesmo com o app escrevendo),
    mantendo os últimos N backups e podando os mais antigos.

USO:
    python scripts/backup_db.py

    Variáveis de ambiente (opcionais):
      DATABASE_FILE  caminho do .db            (default: data/bussola.db)
      BACKUP_DIR     pasta dos backups         (default: data/backups)
      BACKUP_KEEP    quantos manter            (default: 14)

AGENDAMENTO (produção / Coolify):
    Registrar um "Scheduled Task" no app apontando para este comando (ex.: diário
    `0 3 * * *`). Ideal: replicar os backups pra fora do volume (off-site) — este
    script cobre o snapshot local; o off-site é o próximo passo de governança.
=======================================================================================
"""

import os
import glob
import sqlite3
from datetime import datetime, timezone

DB_FILE = os.getenv("DATABASE_FILE", "data/bussola.db")
BACKUP_DIR = os.getenv("BACKUP_DIR", "data/backups")
KEEP = int(os.getenv("BACKUP_KEEP", "14"))


def main() -> None:
    if not os.path.exists(DB_FILE):
        raise SystemExit(f"[backup] banco não encontrado: {DB_FILE}")

    os.makedirs(BACKUP_DIR, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    dest = os.path.join(BACKUP_DIR, f"bussola-{ts}.db")

    con = sqlite3.connect(DB_FILE)
    try:
        # VACUUM INTO gera uma cópia consistente mesmo com conexões ativas.
        con.execute("VACUUM INTO ?", (dest,))
    finally:
        con.close()

    # Poda: mantém apenas os KEEP mais recentes.
    backups = sorted(glob.glob(os.path.join(BACKUP_DIR, "bussola-*.db")))
    removed = 0
    for old in backups[:-KEEP] if KEEP > 0 else []:
        os.remove(old)
        removed += 1

    print(f"[backup] criado: {dest} | mantidos: {min(len(backups), KEEP)} | removidos: {removed}")


if __name__ == "__main__":
    main()
