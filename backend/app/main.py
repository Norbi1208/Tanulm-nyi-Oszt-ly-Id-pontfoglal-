from fastapi import FastAPI
from fastapi.responses import RedirectResponse

from . import config 
from .auth import router as auth_router
from .db import get_conn

app = FastAPI(title="TO Időpontfoglaló API")
app.include_router(auth_router)


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse("/docs")


@app.get("/api/health")
def health():
    with get_conn() as conn:
        db_time = conn.execute("SELECT now() AS ido").fetchone()["ido"]
    return {"ok": True, "db_time": str(db_time)}