"""Szabad időpontok számítása.

Ugyanazt a logikát valósítja meg, mint a front-endben a utils/slots.js és a
utils/availability.js, de az adatbázis adataiból: munkarend, távollét,
lezárt napok és a már meglévő foglalások.
"""
from datetime import date, datetime, time

from fastapi import APIRouter, Depends, HTTPException, Query

from .auth import csak_hallgato
from .db import get_conn

router = APIRouter(prefix="/api", tags=["Időpontok"])

LEPES_PERC = 15                              # az időpontrács lépésköze
AKTIV_ALLAPOTOK = ["fuggoben", "megerositve"]  # ezek foglalják az idősávot


def _perc(t: time) -> int:
    """08:30 -> 510 (az éjféltől eltelt percek)."""
    return t.hour * 60 + t.minute


def _ido(perc: int) -> str:
    """510 -> "08:30"."""
    return f"{perc // 60:02d}:{perc % 60:02d}"


def _atfed(a_kezd: int, a_veg: int, b_kezd: int, b_veg: int) -> bool:
    """Igaz, ha a két időintervallum átfedi egymást."""
    return a_kezd < b_veg and b_kezd < a_veg


def nap_idopontjai(conn, ugyintezo_azonosito: str, ugytipus_id: int, datum: date,
                   hallgato_db_id: int | None = None) -> dict:
    """Egy ügyintéző egy napjának idősávjai, mindegyiknél: foglalható-e, és ha nem, miért.

    A foglalás mentése (következő lépés) is ezt fogja használni az ellenőrzéshez.
    """

    def nincs_idopont(uzenet: str) -> dict:
        return {"date": datum.isoformat(), "available": False, "message": uzenet,
                "start": None, "end": None, "duration": None, "slots": []}

    # 1. Az ügyintéző és az ügytípus ellenőrzése
    ugyintezo = conn.execute(
        """
        SELECT ugyintezo_id, nev, aktiv FROM ugyintezok
        WHERE upper(azonosito) = %s AND szerepkor = 'ugyintezo'
        """,
        (ugyintezo_azonosito,),
    ).fetchone()
    if not ugyintezo or not ugyintezo["aktiv"]:
        raise HTTPException(404, "Az ügyintéző nem található, vagy nem aktív.")

    ugytipus = conn.execute(
        """
        SELECT t.idotartam_perc
        FROM ugytipusok t
        JOIN ugyintezo_ugytipusok uu ON uu.ugytipus_id = t.ugytipus_id
        WHERE t.ugytipus_id = %s AND t.aktiv AND uu.ugyintezo_id = %s
        """,
        (ugytipus_id, ugyintezo["ugyintezo_id"]),
    ).fetchone()
    if not ugytipus:
        raise HTTPException(404, "Ez az ügyintéző nem intézi a kiválasztott ügytípust.")
    hossz = ugytipus["idotartam_perc"]
    nev = ugyintezo["nev"]

    # 2. Egész napra vonatkozó akadályok
    most = datetime.now()
    if datum < most.date():
        return nincs_idopont("Múltbeli napra nem lehet foglalni.")
    if datum.isoweekday() > 5:
        return nincs_idopont("Hétvégén nincs ügyfélfogadás. Válassz egy hétköznapot.")

    lezart = conn.execute(
        "SELECT megjegyzes FROM naptari_napok WHERE datum = %s AND NOT nyitva", (datum,)
    ).fetchone()
    if lezart:
        ok = lezart["megjegyzes"] or "zárva"
        return nincs_idopont(f"Ezen a napon a Tanulmányi Osztály zárva tart ({ok}). Válassz másik napot.")

    tavol = conn.execute(
        "SELECT 1 FROM tavollet WHERE ugyintezo_id = %s AND datum = %s",
        (ugyintezo["ugyintezo_id"], datum),
    ).fetchone()
    if tavol:
        return nincs_idopont(f"{nev} ezen a napon nem elérhető. Válassz másik napot vagy ügyintézőt.")

    beosztas = conn.execute(
        "SELECT kezdes, befejezes FROM munkarend WHERE ugyintezo_id = %s AND het_napja = %s",
        (ugyintezo["ugyintezo_id"], datum.isoweekday()),
    ).fetchone()
    if not beosztas:
        return nincs_idopont(f"{nev} ezen a napon nem fogad hallgatókat. Válassz másik napot vagy ügyintézőt.")

    # 3. A már foglalt idősávok: az ügyintézőé, és a hallgató saját foglalásai aznap
    ugyintezo_foglalt = [
        (_perc(f["kezdes"]), _perc(f["befejezes"]))
        for f in conn.execute(
            """
            SELECT kezdes, befejezes FROM foglalasok
            WHERE ugyintezo_id = %s AND datum = %s AND allapot::text = ANY(%s)
            """,
            (ugyintezo["ugyintezo_id"], datum, AKTIV_ALLAPOTOK),
        ).fetchall()
    ]
    hallgato_foglalt = []
    if hallgato_db_id is not None:
        hallgato_foglalt = [
            (_perc(f["kezdes"]), _perc(f["befejezes"]))
            for f in conn.execute(
                """
                SELECT kezdes, befejezes FROM foglalasok
                WHERE hallgato_id = %s AND datum = %s AND allapot::text = ANY(%s)
                """,
                (hallgato_db_id, datum, AKTIV_ALLAPOTOK),
            ).fetchall()
        ]

    # 4. Az idősávok végigjárása a munkaidőn belül
    nyitas, zaras = _perc(beosztas["kezdes"]), _perc(beosztas["befejezes"])
    most_perc = most.hour * 60 + most.minute
    idopontok = []
    for kezd in range(nyitas, zaras, LEPES_PERC):
        veg = kezd + hossz
        ok = None
        if datum == most.date() and kezd <= most_perc:
            ok = "Elmúlt időpont"
        elif any(a <= kezd < b for a, b in ugyintezo_foglalt):
            ok = "Foglalt"
        elif any(_atfed(kezd, veg, a, b) for a, b in ugyintezo_foglalt):
            ok = "Az ügyintézés nem fér el a következő foglalás előtt"
        elif veg > zaras:
            ok = "Az ügyintézés túlnyúlna az ügyintéző munkaidején"
        elif any(_atfed(kezd, veg, a, b) for a, b in hallgato_foglalt):
            ok = "Erre az időre már van foglalásod"
        idopontok.append({"time": _ido(kezd), "available": ok is None, "reason": ok})

    van_szabad = any(i["available"] for i in idopontok)
    return {
        "date": datum.isoformat(),
        "available": van_szabad,
        "message": None if van_szabad else f"Erre a napra {nev} ügyintézőnél nincs szabad időpont.",
        "start": _ido(nyitas),
        "end": _ido(zaras),
        "duration": hossz,
        "slots": idopontok,
    }


@router.get("/szabad-idopontok")
def szabad_idopontok(
    ugyintezo: str = Query(..., description="Az ügyintéző azonosítója, pl. UGY-001"),
    ugytipus: int = Query(..., description="Az ügytípus azonosítója"),
    datum: date = Query(..., description="A nap, ÉÉÉÉ-HH-NN formában"),
    hallgato: dict = Depends(csak_hallgato),
):
    with get_conn() as conn:
        return nap_idopontjai(conn, ugyintezo.strip().upper(), ugytipus, datum, hallgato["db_id"])