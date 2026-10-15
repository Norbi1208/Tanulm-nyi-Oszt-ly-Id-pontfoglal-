import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv
from fastapi import FastAPI

# A .env mindig a backend mappából töltődik be, bárhonnan indítod
ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(ENV_PATH)

if not os.getenv("DATABASE_URL"):
    raise RuntimeError(f"Hiányzik a DATABASE_URL. Keresett fájl: {ENV_PATH}")
app = FastAPI()

@app.get("/api/health")
def health():
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
        db_time = conn.execute("SELECT now()").fetchone()[0]
    return {"ok": True, "db_time": str(db_time)}