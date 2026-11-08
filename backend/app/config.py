import os
from pathlib import Path

from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(ENV_PATH)

def _kotelezo(nev: str) -> str:
    ertek = os.getenv(nev)
    if not ertek:
        raise RuntimeError(f"Hiányzik a {nev}. Keresett fájl: {ENV_PATH}")
    return ertek

DATABASE_URL = _kotelezo("DATABASE_URL")
JWT_SECRET = _kotelezo("JWT_SECRET")

COOKIE_NAME = "to_session"
SESSION_HOURS = 8