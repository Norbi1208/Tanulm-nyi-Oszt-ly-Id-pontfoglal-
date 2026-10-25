from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from pydantic import BaseModel

from .config import COOKIE_NAME, JWT_SECRET, SESSION_HOURS
from .db import get_conn

router = APIRouter(prefix="/api/auth", tags=["Bejelentkezés"])

HIBAS_BELEPES = "Hibás azonosító vagy jelszó."

# Az adatbázisban használt szerepkörök -> a front-end által várt szerepkörök
FRONTEND_SZEREP = {"hallgato": "student", "ugyintezo": "clerk", "admin": "admin"}


class BelepesiAdatok(BaseModel):
    azonosito: str
    jelszo: str


def _jelszo_egyezik(jelszo: str, jelszo_hash: str) -> bool:
    try:
        return bcrypt.checkpw(jelszo.encode("utf-8"), jelszo_hash.encode("utf-8"))
    except ValueError:
        # Akkor fordul elő, ha a jelszo_hash mezőben nem bcrypt hash van (pl. sima jelszó)
        raise HTTPException(500, "A felhasználó jelszo_hash mezője nem érvényes bcrypt hash.")


def _token_keszites(felhasznalo_id: int, szerep: str) -> str:
    most = datetime.now(timezone.utc)
    adatok = {
        "sub": str(felhasznalo_id),
        "szerep": szerep,
        "iat": most,
        "exp": most + timedelta(hours=SESSION_HOURS),
    }
    return jwt.encode(adatok, JWT_SECRET, algorithm="HS256")


def _keres_azonosito_alapjan(conn, azonosito: str):
    """Előbb a hallgatók, utána az ügyintézők (és az admin) között keres."""
    sor = conn.execute(
        """
        SELECT hallgato_id AS db_id, azonosito, nev, jelszo_hash, aktiv, 'hallgato' AS szerep
        FROM hallgatok
        WHERE upper(azonosito) = %s
        """,
        (azonosito,),
    ).fetchone()
    if sor:
        return sor
    return conn.execute(
        """
        SELECT ugyintezo_id AS db_id, azonosito, nev, jelszo_hash, aktiv, szerepkor::text AS szerep
        FROM ugyintezok
        WHERE upper(azonosito) = %s
        """,
        (azonosito,),
    ).fetchone()


def _keres_id_alapjan(conn, db_id: int, szerep: str):
    """A tokenben lévő azonosító és szerep alapján tölti be a felhasználót."""
    if szerep == "hallgato":
        return conn.execute(
            """
            SELECT hallgato_id AS db_id, azonosito, nev, aktiv, 'hallgato' AS szerep
            FROM hallgatok WHERE hallgato_id = %s
            """,
            (db_id,),
        ).fetchone()
    return conn.execute(
        """
        SELECT ugyintezo_id AS db_id, azonosito, nev, aktiv, szerepkor::text AS szerep
        FROM ugyintezok WHERE ugyintezo_id = %s
        """,
        (db_id,),
    ).fetchone()


def _valasz(sor: dict) -> dict:
    # A front-end ezeket a mezőneveket várja
    return {"id": sor["azonosito"], "name": sor["nev"], "role": FRONTEND_SZEREP[sor["szerep"]]}


@router.post("/login")
def belepes(adatok: BelepesiAdatok, response: Response):
    azonosito = adatok.azonosito.strip().upper()
    if not azonosito or not adatok.jelszo:
        raise HTTPException(400, "Add meg az azonosítódat és a jelszavadat.")

    with get_conn() as conn:
        sor = _keres_azonosito_alapjan(conn, azonosito)

    # Ugyanaz az üzenet, ha nincs ilyen azonosító és ha rossz a jelszó
    if not sor or not _jelszo_egyezik(adatok.jelszo, sor["jelszo_hash"]):
        raise HTTPException(401, HIBAS_BELEPES)
    if sor["szerep"] not in FRONTEND_SZEREP:
        raise HTTPException(500, f"Ismeretlen szerepkör az adatbázisban: {sor['szerep']}")
    if not sor["aktiv"]:
        if sor["szerep"] == "hallgato":
            raise HTTPException(403, "Ez a fiók inaktív. Fordulj a Tanulmányi Osztályhoz.")
        raise HTTPException(403, "Ez az ügyintézői fiók inaktív. Fordulj a rendszergazdához.")

    token = _token_keszites(sor["db_id"], sor["szerep"])
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,       # JavaScriptből nem olvasható
        samesite="lax",
        secure=False,        # élesben (https) True legyen
        max_age=SESSION_HOURS * 3600,
        path="/",
    )
    return _valasz(sor)


@router.post("/logout")
def kilepes(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


def aktualis_felhasznalo(token: str | None = Cookie(default=None, alias=COOKIE_NAME)) -> dict:
    """A bejelentkezett felhasználó, vagy 401-es hiba."""
    if not token:
        raise HTTPException(401, "Nincs bejelentkezve.")
    try:
        adatok = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "A munkamenet lejárt, jelentkezz be újra.")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Érvénytelen munkamenet.")

    szerep = adatok.get("szerep")
    if szerep not in FRONTEND_SZEREP:
        raise HTTPException(401, "Érvénytelen munkamenet.")

    # Minden kérésnél újra lekérjük, így az inaktivált fiók azonnal kizáródik,
    # és a szerepkör változása (pl. ügyintézőből admin) is azonnal érvényes
    with get_conn() as conn:
        sor = _keres_id_alapjan(conn, int(adatok["sub"]), szerep)
    if not sor or not sor["aktiv"] or sor["szerep"] not in FRONTEND_SZEREP:
        raise HTTPException(401, "A fiók nem elérhető.")

    return {"db_id": sor["db_id"], "azonosito": sor["azonosito"], "nev": sor["nev"], "szerep": sor["szerep"]}


def _csak(*engedett_szerepek: str):
    """Függőséget készít, amely csak a megadott szerepköröket engedi tovább."""

    def ellenorzes(felhasznalo: dict = Depends(aktualis_felhasznalo)) -> dict:
        if felhasznalo["szerep"] not in engedett_szerepek:
            raise HTTPException(403, "Ehhez nincs jogosultságod.")
        return felhasznalo

    return ellenorzes


# Ezeket kell majd a többi végpontban használni, pl.:
#     def valami(felhasznalo: dict = Depends(csak_admin)): ...
csak_hallgato = _csak("hallgato")
csak_ugyintezo = _csak("ugyintezo")
csak_admin = _csak("admin")


@router.get("/me")
def en(felhasznalo: dict = Depends(aktualis_felhasznalo)):
    return {
        "id": felhasznalo["azonosito"],
        "name": felhasznalo["nev"],
        "role": FRONTEND_SZEREP[felhasznalo["szerep"]],
    }