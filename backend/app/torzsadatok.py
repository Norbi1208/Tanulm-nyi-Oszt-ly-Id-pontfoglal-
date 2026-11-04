from fastapi import APIRouter, Depends

from .auth import aktualis_felhasznalo
from .db import get_conn

router = APIRouter(prefix="/api", tags=["Törzsadatok"])


@router.get("/ugytipusok")
def ugytipusok(_: dict = Depends(aktualis_felhasznalo)):
    """Az aktív ügytípusok, mindegyiknél az aktív ügyintézők azonosítóival."""
    with get_conn() as conn:
        sorok = conn.execute(
            """
            SELECT
                t.ugytipus_id,
                t.megnevezes,
                t.idotartam_perc,
                COALESCE(
                    array_agg(u.azonosito ORDER BY u.azonosito)
                        FILTER (WHERE u.ugyintezo_id IS NOT NULL),
                    '{}'
                ) AS ugyintezok
            FROM ugytipusok t
            LEFT JOIN ugyintezo_ugytipusok uu ON uu.ugytipus_id = t.ugytipus_id
            LEFT JOIN ugyintezok u
                   ON u.ugyintezo_id = uu.ugyintezo_id
                  AND u.aktiv
                  AND u.szerepkor = 'ugyintezo'
            WHERE t.aktiv
            GROUP BY t.ugytipus_id, t.megnevezes, t.idotartam_perc
            ORDER BY t.megnevezes
            """
        ).fetchall()

    # A front-end ezeket a mezőneveket várja. Az id szövegként megy, mert a
    # legördülő lista is szövegként adja vissza a kiválasztott értéket.
    return [
        {
            "id": str(s["ugytipus_id"]),
            "name": s["megnevezes"],
            "duration": s["idotartam_perc"],
            "clerkIds": list(s["ugyintezok"]),
        }
        for s in sorok
    ]


@router.get("/naptari-napok")
def lezart_napok(_: dict = Depends(aktualis_felhasznalo)):
    """A lezárt napok (nyitva = false), dátum szerint rendezve."""
    with get_conn() as conn:
        sorok = conn.execute(
            """
            SELECT datum, megjegyzes
            FROM naptari_napok
            WHERE NOT nyitva
            ORDER BY datum
            """
        ).fetchall()

    return [
        {
            "id": s["datum"].isoformat(),
            "date": s["datum"].isoformat(),
            "reason": s["megjegyzes"] or "Zárva",
        }
        for s in sorok
    ]