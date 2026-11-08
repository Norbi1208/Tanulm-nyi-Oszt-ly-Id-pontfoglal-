"""Foglalások végpontjai: a hallgató saját foglalásai és új foglalás létrehozása."""
from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .auth import csak_hallgato
from .db import get_conn
from .idopontok import nap_idopontjai

router = APIRouter(prefix="/api/foglalasok", tags=["Foglalások"])

# Az adatbázisban használt állapotok -> a front-end által várt állapotok
FRONTEND_ALLAPOT = {
    "fuggoben": "pending",
    "megerositve": "confirmed",
    "elutasitva": "rejected",
    "lemondva": "cancelled",
}


def foglalas_valasz(s: dict) -> dict:
    """Egy adatbázis-sor átalakítása a front-end által várt formára."""
    return {
        "id": str(s["foglalas_id"]),
        "studentId": s["hallgato_azonosito"],
        "clerkId": s["ugyintezo_azonosito"],
        "clerkName": s["ugyintezo_nev"],
        "caseTypeId": str(s["ugytipus_id"]),
        "caseTypeName": s["ugytipus_nev"],
        "date": s["datum"].isoformat(),
        "time": s["kezdes"].strftime("%H:%M"),
        "duration": s["perc"],
        "status": FRONTEND_ALLAPOT.get(s["allapot"], s["allapot"]),
        "rejectReason": s["elutasitas_oka"],
        "studentNotified": s["ertesites_olvasva"],
        "createdAt": s["letrehozva"].isoformat() if s["letrehozva"] else None,
        "fromDb": True,  # a front-end ebből tudja, hogy az adatbázisból jött
    }


# A foglalás minden adata a kapcsolódó nevekkel együtt; a WHERE részt a végpont teszi hozzá
FOGLALAS_LEKERDEZES = """
    SELECT
        f.foglalas_id,
        h.azonosito AS hallgato_azonosito,
        u.azonosito AS ugyintezo_azonosito,
        u.nev       AS ugyintezo_nev,
        f.ugytipus_id,
        t.megnevezes AS ugytipus_nev,
        f.datum,
        f.kezdes,
        (EXTRACT(EPOCH FROM (f.befejezes - f.kezdes)) / 60)::int AS perc,
        f.allapot::text AS allapot,
        f.elutasitas_oka,
        f.ertesites_olvasva,
        f.letrehozva
    FROM foglalasok f
    JOIN hallgatok  h ON h.hallgato_id  = f.hallgato_id
    JOIN ugyintezok u ON u.ugyintezo_id = f.ugyintezo_id
    JOIN ugytipusok t ON t.ugytipus_id  = f.ugytipus_id
"""


@router.get("/sajat")
def sajat_foglalasok(hallgato: dict = Depends(csak_hallgato)):
    """A bejelentkezett hallgató összes foglalása, időrendben."""
    with get_conn() as conn:
        sorok = conn.execute(
            FOGLALAS_LEKERDEZES + " WHERE f.hallgato_id = %s ORDER BY f.datum, f.kezdes",
            (hallgato["db_id"],),
        ).fetchall()
    return [foglalas_valasz(s) for s in sorok]


class UjFoglalas(BaseModel):
    ugyintezo: str   # az ügyintéző azonosítója, pl. "UGY-001"
    ugytipus: int    # az ügytípus azonosítója
    datum: date      # "2026-11-12"
    kezdes: time     # "09:15"


@router.post("", status_code=201)
def foglalas_letrehozasa(adatok: UjFoglalas, hallgato: dict = Depends(csak_hallgato)):
    """Új foglalás mentése. Mentés előtt a backend újra ellenőrzi, hogy az időpont szabad-e."""
    ugyintezo_azonosito = adatok.ugyintezo.strip().upper()
    kezdes = adatok.kezdes.replace(second=0, microsecond=0)

    # A teljes blokk egyetlen tranzakció: a végén menti, hiba esetén semmit nem ment
    with get_conn() as conn:
        # Zárolás: amíg ez a tranzakció tart, ugyanennél a hallgatónál és ügyintézőnél
        # egy másik foglalás várakozik. Így két egyidejű kérés nem foglalhatja le
        # ugyanazt az időpontot. (Mindig ebben a sorrendben zárolunk.)
        conn.execute("SELECT 1 FROM hallgatok WHERE hallgato_id = %s FOR UPDATE", (hallgato["db_id"],))
        ugyintezo = conn.execute(
            "SELECT ugyintezo_id FROM ugyintezok WHERE upper(azonosito) = %s FOR UPDATE",
            (ugyintezo_azonosito,),
        ).fetchone()
        if not ugyintezo:
            raise HTTPException(404, "Az ügyintéző nem található.")

        # Ugyanaz az ellenőrzés, mint a szabad időpontok listájánál
        nap = nap_idopontjai(conn, ugyintezo_azonosito, adatok.ugytipus, adatok.datum, hallgato["db_id"])
        if not nap["slots"]:
            raise HTTPException(409, nap["message"])
        idosav = next((i for i in nap["slots"] if i["time"] == kezdes.strftime("%H:%M")), None)
        if idosav is None:
            raise HTTPException(409, "Ez az időpont nem választható.")
        if not idosav["available"]:
            raise HTTPException(409, f"Ez az időpont már nem foglalható ({idosav['reason']}). Válassz másikat.")

        befejezes = (datetime.combine(adatok.datum, kezdes) + timedelta(minutes=nap["duration"])).time()
        uj_id = conn.execute(
            """
            INSERT INTO foglalasok
                (hallgato_id, ugyintezo_id, ugytipus_id, datum, kezdes, befejezes, allapot, ertesites_olvasva)
            VALUES (%s, %s, %s, %s, %s, %s, 'fuggoben', false)
            RETURNING foglalas_id
            """,
            (hallgato["db_id"], ugyintezo["ugyintezo_id"], adatok.ugytipus, adatok.datum, kezdes, befejezes),
        ).fetchone()["foglalas_id"]

        sor = conn.execute(FOGLALAS_LEKERDEZES + " WHERE f.foglalas_id = %s", (uj_id,)).fetchone()

    return foglalas_valasz(sor)


LEMONDASI_HATAR_ORA = 24  # ennyi órával az időpont előtt lehet legkésőbb lemondani


@router.post("/{foglalas_id}/lemondas")
def foglalas_lemondasa(foglalas_id: int, hallgato: dict = Depends(csak_hallgato)):
    """A hallgató lemondja a saját, még aktív foglalását (legkésőbb 24 órával előtte)."""
    with get_conn() as conn:
        # Csak a saját foglalását találja meg; a FOR UPDATE miatt közben senki nem módosíthatja
        foglalas = conn.execute(
            """
            SELECT datum, kezdes, allapot::text AS allapot
            FROM foglalasok
            WHERE foglalas_id = %s AND hallgato_id = %s
            FOR UPDATE
            """,
            (foglalas_id, hallgato["db_id"]),
        ).fetchone()
        if not foglalas:
            raise HTTPException(404, "A foglalás nem található.")
        if foglalas["allapot"] not in ("fuggoben", "megerositve"):
            raise HTTPException(409, "Ez a foglalás már nem mondható le.")

        kezdet = datetime.combine(foglalas["datum"], foglalas["kezdes"])
        if kezdet - datetime.now() < timedelta(hours=LEMONDASI_HATAR_ORA):
            raise HTTPException(
                409, f"Időpontot legkésőbb {LEMONDASI_HATAR_ORA} órával a tervezett időpont előtt lehet lemondani."
            )

        conn.execute(
            "UPDATE foglalasok SET allapot = 'lemondva' WHERE foglalas_id = %s",
            (foglalas_id,),
        )
        sor = conn.execute(FOGLALAS_LEKERDEZES + " WHERE f.foglalas_id = %s", (foglalas_id,)).fetchone()

    return foglalas_valasz(sor)