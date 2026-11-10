"""Ügyintézői végpontok: foglalások (lista, elfogadás, elutasítás), munkarend és távollét."""
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .auth import csak_ugyintezo
from .db import get_conn
from .foglalasok import FOGLALAS_LEKERDEZES, foglalas_valasz

router = APIRouter(prefix="/api/ugyintezo", tags=["Ügyintéző"])


@router.get("/foglalasok")
def ugyintezo_foglalasai(ugyintezo: dict = Depends(csak_ugyintezo)):
    """A bejelentkezett ügyintézőhöz tartozó összes foglalás, időrendben."""
    with get_conn() as conn:
        sorok = conn.execute(
            FOGLALAS_LEKERDEZES + " WHERE f.ugyintezo_id = %s ORDER BY f.datum, f.kezdes",
            (ugyintezo["db_id"],),
        ).fetchall()
    return [foglalas_valasz(s) for s in sorok]


def _fuggo_foglalas_zarolasa(conn, foglalas_id: int, ugyintezo_db_id: int) -> None:
    """Ellenőrzi, hogy a foglalás az ügyintézőé és függőben van; közben zárolja a sort."""
    sor = conn.execute(
        """
        SELECT allapot::text AS allapot FROM foglalasok
        WHERE foglalas_id = %s AND ugyintezo_id = %s
        FOR UPDATE
        """,
        (foglalas_id, ugyintezo_db_id),
    ).fetchone()
    if not sor:
        raise HTTPException(404, "A foglalás nem található.")
    if sor["allapot"] != "fuggoben":
        raise HTTPException(409, "Ez a foglalás már el van bírálva, vagy a hallgató lemondta.")


@router.post("/foglalasok/{foglalas_id}/elfogadas")
def foglalas_elfogadasa(foglalas_id: int, ugyintezo: dict = Depends(csak_ugyintezo)):
    """Függőben lévő foglalás megerősítése."""
    with get_conn() as conn:
        _fuggo_foglalas_zarolasa(conn, foglalas_id, ugyintezo["db_id"])
        conn.execute(
            "UPDATE foglalasok SET allapot = 'megerositve' WHERE foglalas_id = %s",
            (foglalas_id,),
        )
        sor = conn.execute(FOGLALAS_LEKERDEZES + " WHERE f.foglalas_id = %s", (foglalas_id,)).fetchone()
    return foglalas_valasz(sor)


class Elutasitas(BaseModel):
    indoklas: str


@router.post("/foglalasok/{foglalas_id}/elutasitas")
def foglalas_elutasitasa(foglalas_id: int, adatok: Elutasitas, ugyintezo: dict = Depends(csak_ugyintezo)):
    """Függőben lévő foglalás elutasítása indoklással; a hallgató értesítést kap."""
    indoklas = adatok.indoklas.strip()
    if len(indoklas) < 5:
        raise HTTPException(400, "Írd le röviden az elutasítás okát.")
    if len(indoklas) > 500:
        raise HTTPException(400, "Az indoklás legfeljebb 500 karakter lehet.")

    with get_conn() as conn:
        _fuggo_foglalas_zarolasa(conn, foglalas_id, ugyintezo["db_id"])
        conn.execute(
            """
            UPDATE foglalasok
            SET allapot = 'elutasitva', elutasitas_oka = %s, ertesites_olvasva = false
            WHERE foglalas_id = %s
            """,
            (indoklas, foglalas_id),
        )
        sor = conn.execute(FOGLALAS_LEKERDEZES + " WHERE f.foglalas_id = %s", (foglalas_id,)).fetchone()
    return foglalas_valasz(sor)


# ---------- Munkarend ----------

HETNAPOK = [1, 2, 3, 4, 5]  # hétfő ... péntek


@router.get("/munkarend")
def sajat_munkarend(ugyintezo: dict = Depends(csak_ugyintezo)):
    """A bejelentkezett ügyintéző heti beosztása; ahol nincs sor, ott None (nem dolgozik)."""
    with get_conn() as conn:
        sorok = conn.execute(
            "SELECT het_napja, kezdes, befejezes FROM munkarend WHERE ugyintezo_id = %s",
            (ugyintezo["db_id"],),
        ).fetchall()

    beosztas = {str(nap): None for nap in HETNAPOK}
    for s in sorok:
        beosztas[str(s["het_napja"])] = {
            "start": s["kezdes"].strftime("%H:%M"),
            "end": s["befejezes"].strftime("%H:%M"),
        }
    return beosztas


# ---------- Távollét ----------

TAVOLLET_INDOKLAS = (
    "Az ügyintéző ezen a napon nem elérhető. Kérjük, foglalj másik időpontot vagy válassz másik ügyintézőt."
)


def _tavollet_valasz(s: dict, ugyintezo_azonosito: str) -> dict:
    return {
        "id": str(s["tavollet_id"]),
        "clerkId": ugyintezo_azonosito,
        "date": s["datum"].isoformat(),
        "note": s["megjegyzes"] or "",
    }


@router.get("/tavollet")
def sajat_tavollet(ugyintezo: dict = Depends(csak_ugyintezo)):
    """A bejelentkezett ügyintéző mai és jövőbeli távollétei."""
    with get_conn() as conn:
        sorok = conn.execute(
            """
            SELECT tavollet_id, datum, megjegyzes FROM tavollet
            WHERE ugyintezo_id = %s AND datum >= %s
            ORDER BY datum
            """,
            (ugyintezo["db_id"], date.today()),
        ).fetchall()
    return [_tavollet_valasz(s, ugyintezo["azonosito"]) for s in sorok]


class UjTavollet(BaseModel):
    datum: date
    megjegyzes: str = ""
    foglalasok_elutasitasa: bool = True  # az aznapi foglalások elutasítása értesítéssel


@router.post("/tavollet", status_code=201)
def tavollet_felvetele(adatok: UjTavollet, ugyintezo: dict = Depends(csak_ugyintezo)):
    """Az ügyintéző jelzi, hogy egy napon nem dolgozik; kérésre elutasítja az aznapi foglalásait."""
    megjegyzes = adatok.megjegyzes.strip()
    if len(megjegyzes) > 120:
        raise HTTPException(400, "A megjegyzés legfeljebb 120 karakter lehet.")
    if adatok.datum < date.today():
        raise HTTPException(400, "Múltbeli napra nem jelezhető távollét.")

    with get_conn() as conn:
        beosztva = conn.execute(
            "SELECT 1 FROM munkarend WHERE ugyintezo_id = %s AND het_napja = %s",
            (ugyintezo["db_id"], adatok.datum.isoweekday()),
        ).fetchone()
        if not beosztva:
            raise HTTPException(409, "Ezen a napon egyébként sem vagy beosztva.")

        mar_van = conn.execute(
            "SELECT 1 FROM tavollet WHERE ugyintezo_id = %s AND datum = %s",
            (ugyintezo["db_id"], adatok.datum),
        ).fetchone()
        if mar_van:
            raise HTTPException(409, "Erre a napra már jelezted, hogy nem dolgozol.")

        uj = conn.execute(
            """
            INSERT INTO tavollet (ugyintezo_id, datum, megjegyzes)
            VALUES (%s, %s, %s)
            RETURNING tavollet_id, datum, megjegyzes
            """,
            (ugyintezo["db_id"], adatok.datum, megjegyzes),
        ).fetchone()

        # Ugyanebben a tranzakcióban: az aznapi, még előttünk álló aktív foglalások elutasítása
        elutasitott = []
        if adatok.foglalasok_elutasitasa:
            azonositok = conn.execute(
                """
                UPDATE foglalasok
                SET allapot = 'elutasitva', elutasitas_oka = %s, ertesites_olvasva = false
                WHERE ugyintezo_id = %s
                  AND datum = %s
                  AND allapot IN ('fuggoben', 'megerositve')
                  AND (datum + kezdes) > %s
                RETURNING foglalas_id
                """,
                (TAVOLLET_INDOKLAS, ugyintezo["db_id"], adatok.datum, datetime.now()),
            ).fetchall()
            if azonositok:
                sorok = conn.execute(
                    FOGLALAS_LEKERDEZES + " WHERE f.foglalas_id = ANY(%s)",
                    ([a["foglalas_id"] for a in azonositok],),
                ).fetchall()
                elutasitott = [foglalas_valasz(s) for s in sorok]

    return {"absence": _tavollet_valasz(uj, ugyintezo["azonosito"]), "rejectedBookings": elutasitott}


@router.delete("/tavollet/{tavollet_id}")
def tavollet_visszavonasa(tavollet_id: int, ugyintezo: dict = Depends(csak_ugyintezo)):
    """Egy mai vagy jövőbeli távollét visszavonása; utána a hallgatók újra foglalhatnak arra a napra."""
    with get_conn() as conn:
        torolt = conn.execute(
            """
            DELETE FROM tavollet
            WHERE tavollet_id = %s AND ugyintezo_id = %s AND datum >= %s
            RETURNING tavollet_id
            """,
            (tavollet_id, ugyintezo["db_id"], date.today()),
        ).fetchone()
    if not torolt:
        raise HTTPException(404, "A távollét nem található, vagy már elmúlt.")
    return {"ok": True}