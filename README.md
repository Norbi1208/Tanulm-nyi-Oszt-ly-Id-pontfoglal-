# Tanulmányi Osztály Időpontfoglaló – front-end

React + Vite alapú, önállóan futtatható front-end a Széchenyi István Egyetem Tanulmányi Osztályának időpontfoglaló rendszeréhez. Háttérszerver nélkül is teljesen működik: az adatokat a böngésző `localStorage`-ában tárolja, így a foglalások, elbírálások és admin módosítások oldalfrissítés után is megmaradnak.

## Indítás

```bash
npm install
npm run dev        # fejlesztői szerver: http://localhost:5173
npm run build      # éles build a dist/ mappába
npm run preview    # a build kipróbálása
```

Node.js 18 vagy újabb szükséges.

## Demó fiókok

| Szerepkör  | Azonosító | Jelszó      |
|------------|-----------|-------------|
| Hallgató   | ABC123    | hallgato    |
| Ügyintéző  | UGY-001   | ugyintező   |
| Admin      | ADM-001   | admin       |

A többi demó hallgató (KOV456, NAG789, SZA321, HOR654) jelszava szintén `hallgato`, a UGY-002 ügyintézőé `ugyintező`. A UGY-003 inaktív, ezért nem tud belépni. A bejelentkező oldalon a „Demó adatok visszaállítása” gomb visszatölti a kiinduló adatokat.

## Funkciók

**Hallgató:** saját foglalások listája és statisztikái; új foglalás ügytípus, ügyintéző, dátum és szabad idősáv kiválasztásával; lemondás megerősítő ablakkal (legkésőbb 24 órával az időpont előtt); elutasított foglalás esetén értesítés az ügyintéző indoklásával.

**Ügyintéző:** megerősítésre váró foglalások; elfogadás vagy elutasítás kötelező indoklással; elbírált foglalások listája; napi és összesítő számlálók; saját heti beosztás megtekintése; távollét jelzése egy napra („Ma mégsem dolgozom” gyorsgombbal), és annak visszavonása.

**Adminisztrátor:** havi statisztikák; ügyintézők felvétele (egyedi azonosító, ideiglenes jelszó) és aktiválása/inaktiválása a státuszcímkére kattintva; ügyintézőnként heti munkarend beállítása (mely napokon, mettől meddig fogad), a közelgő távollétek áttekintése; új ügytípus felvétele becsült időtartammal és hozzárendelt ügyintézőkkel; napok vagy időszakok lezárása (pl. ünnep, belső képzés), amelyekre a hallgatók nem foglalhatnak; az összes foglalás áttekintése állapot szerinti szűréssel.

## Foglalási szabályok

Az ügyfélfogadás hétköznap 08:00–16:00, 15 perces rácsban (`src/config.js`); ezen belül minden ügyintézőnek saját heti munkarendje van. Egy idősáv akkor foglalható, ha az ügyintéző aznap be van osztva és nem jelzett távollétet, az ügytípus teljes időtartama elfér a meglévő foglalásai között és a munkaideje végéig, nem múltbeli, és a hallgatónak sincs ütköző foglalása. A függőben lévő és a megerősített foglalás is lefoglalja a sávot; a lemondott és az elutasított felszabadítja. Csak olyan ügytípus választható, amelyhez van aktív ügyintéző.

Az admin által lezárt napokra nem lehet foglalni: a foglalási ablak jelzi a lezárás okát, és a közelgő zárt napokat a dátummező alatt is listázza. Lezáráskor, ha a napra már van aktív foglalás, az admin választhat: a rendszer elutasítja ezeket (a hallgató értesítést kap az okkal), vagy megmaradnak az ügyintézőknek. Ugyanez a választás jelenik meg, ha az admin úgy módosítja egy ügyintéző munkarendjét, hogy közelgő foglalások kívül esnek rajta, vagy ha az ügyintéző olyan napra jelez távollétet, amelyre már van foglalása.

## Dátum a demóban

A `src/config.js` fájlban a `DEMO_NOW` a „mostani” időpontot 2026-10-08 08:00-ra rögzíti, hogy a képernyőtervekkel egyező állapot látszódjon. Éles használathoz állítsd `null`-ra, ekkor a valós rendszeridő számít.

## Mappaszerkezet

```
src/
  config.js                 nyitvatartás, lemondási határidő, demó dátum
  context/AppContext.jsx    állapot, műveletek, localStorage-mentés
  data/seed.js              kiinduló demó adatok
  utils/                    dátum-, foglalás- és idősáv-logika
  components/               fejléc, kártyák, táblázat, modal, toast
  components/modals/        foglalás, lemondás, kezelés, elutasítás, admin ablakok
  pages/                    bejelentkezés, hallgató, ügyintéző, admin nézet
  styles.css                teljes stíluslap (CSS-változókkal)
```

## Backend bekötése

Minden adatművelet az `AppContext.jsx`-ben van (`login`, `createBooking`, `cancelBooking`, `acceptBooking`, `rejectBooking`, `addClerk`, `toggleClerk`, `addCaseType`, `addClosedDays`, `removeClosedDays`, `updateClerkSchedule`, `addAbsence`, `removeAbsence`). Ezeket kell API-hívásokra cserélni; a komponenseknek nem kell tudniuk róla. A jelszavak most a böngészőben, titkosítás nélkül vannak – ez csak demóra alkalmas, éles rendszerben a hitelesítést és a jogosultság-ellenőrzést a szervernek kell végeznie.
