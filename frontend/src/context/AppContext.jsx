import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createSeed } from '../data/seed.js'
import { api } from '../api.js'
import { now, todayStr } from '../utils/date.js'
import { canCancel, isActive } from '../utils/bookings.js'
import { getSlots, toMin } from '../utils/slots.js'
import { OPENING } from '../config.js'
import { clerkDay, defaultSchedule, fitsSchedule, isUpcomingActive, WORKDAYS } from '../utils/availability.js'

const DATA_KEY = 'to-idopontfoglalo:data:v2'
const SESSION_KEY = 'to-idopontfoglalo:session:v1'

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function save(key, value) {
  try {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
  }
}

//régebbi mentett adatok kiegészítése az újabb mezőkkel
function normalize(d) {
  if (!d) return null
  const seed = createSeed()
  const seedUser = (id) => seed.users.find((u) => u.id === id)
  return {
    ...d,
    users: d.users.map((u) =>
      u.role === 'clerk' && !u.schedule ? { ...u, schedule: seedUser(u.id)?.schedule ?? defaultSchedule() } : u,
    ),
    closedDays: d.closedDays ?? seed.closedDays,
    clerkAbsences: d.clerkAbsences ?? seed.clerkAbsences,
  }
}

/**foglalások elutasítása értesítéssel*/
function rejectWhere(bookings, pred, reason, decidedBy, stamp) {
  return bookings.map((b) =>
    pred(b) ? { ...b, status: 'rejected', rejectReason: reason, studentNotified: false, decidedBy, decidedAt: stamp } : b,
  )
}

const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

const ok = (extra = {}) => ({ ok: true, ...extra })
const fail = (error) => ({ ok: false, error })

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [data, setData] = useState(() => normalize(load(DATA_KEY, null)) ?? createSeed())
  const [sessionId, setSessionId] = useState(() => load(SESSION_KEY, null))
  const [apiUser, setApiUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [apiCaseTypes, setApiCaseTypes] = useState(null)
  const [apiClosedDays, setApiClosedDays] = useState(null)
  // A bejelentkezett hallgató foglalásai az adatbázisból
  const [apiMyBookings, setApiMyBookings] = useState([])
  const [toasts, setToasts] = useState([])
  const timers = useRef([])

  useEffect(() => save(DATA_KEY, data), [data])
  useEffect(() => save(SESSION_KEY, sessionId), [sessionId])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  useEffect(() => {
    api('/auth/me')
      .then(setApiUser)
      .catch(() => setApiUser(null))
      .finally(() => setAuthReady(true))
  }, [])

  const usersById = useMemo(() => Object.fromEntries(data.users.map((u) => [u.id, u])), [data.users])
  const caseTypesById = useMemo(
    () => Object.fromEntries([...data.caseTypes, ...(apiCaseTypes ?? [])].map((c) => [c.id, c])),
    [data.caseTypes, apiCaseTypes],
  )

  const effectiveData = useMemo(
    () => ({
      ...data,
      caseTypes: apiCaseTypes ?? data.caseTypes,
      closedDays: apiClosedDays ?? data.closedDays,
      // ÁTMENETI: a demó foglalások mellett az adatbázisból jöttek is látszanak
      bookings: [...data.bookings, ...apiMyBookings],
    }),
    [data, apiCaseTypes, apiClosedDays, apiMyBookings],
  )
  
  const currentUser = useMemo(
    () => (apiUser ? { ...(usersById[apiUser.id] ?? {}), ...apiUser } : null),
    [apiUser, usersById],
  )

  /*értesítések*/

  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const toast = useCallback(
    (message, tone = 'success') => {
      const id = uid('t')
      setToasts((t) => [...t, { id, message, tone }])
      timers.current.push(setTimeout(() => dismissToast(id), 4500))
    },
    [dismissToast],
  )

   /* ---------- Törzsadatok betöltése az adatbázisból ---------- */

  useEffect(() => {
    if (!apiUser) {
      setApiCaseTypes(null)
      setApiClosedDays(null)
      return
    }
    let cancelled = false
    Promise.all([api('/ugytipusok'), api('/naptari-napok')])
      .then(([caseTypes, closedDays]) => {
        if (cancelled) return
        setApiCaseTypes(caseTypes)
        setApiClosedDays(closedDays)
      })
      .catch((e) => toast(`Nem sikerült betölteni az adatokat: ${e.message}`, 'error'))
    return () => {
      cancelled = true
    }
  }, [apiUser, toast])

  /* ---------- A hallgató saját foglalásai az adatbázisból ---------- */

  useEffect(() => {
    if (apiUser?.role !== 'student') {
      setApiMyBookings([])
      return
    }
    let cancelled = false
    api('/foglalasok/sajat')
      .then((list) => {
        if (!cancelled) setApiMyBookings(list)
      })
      .catch((e) => toast(`Nem sikerült betölteni a foglalásaidat: ${e.message}`, 'error'))
    return () => {
      cancelled = true
    }
  }, [apiUser, toast])

  /*munkamenet*/

  const login = useCallback(
    async (rawId, password) => {
      const id = rawId.trim().toUpperCase()
      if (!id || !password) return fail('Add meg az azonosítódat és a jelszavadat.')

      try {
        const user = await api('/auth/login', { method: 'POST', body: { azonosito: id, jelszo: password } })
        setSessionId(null)
        setApiUser(user)
        return ok()
      } catch (e) {
        return fail(e.message)
      }
    },
    [],
  )

  const logout = useCallback(() => {
    if (apiUser) api('/auth/logout', { method: 'POST' }).catch(() => {})
    setApiUser(null)
    setSessionId(null)
    setToasts([])
  }, [apiUser])

  const resetDemo = useCallback(() => {
    setData(createSeed())
    setSessionId(null)
    toast('A demó adatok visszaálltak az alapállapotra.')
  }, [toast])

  /*foglalások*/

  const patchBooking = (id, patch) =>
    setData((d) => ({ ...d, bookings: d.bookings.map((b) => (b.id === id ? { ...b, ...patch } : b)) }))

  const createBooking = useCallback(async ({ caseTypeId, clerkId, date, time }) => {
    if (!caseTypeId || !clerkId || !date || !time)
      return fail('Válassz ügytípust, ügyintézőt, dátumot és időpontot.')
    // Az ellenőrzést és a mentést a backend végzi, az adatbázisban
    try {
      const booking = await api('/foglalasok', {
        method: 'POST',
        body: { ugyintezo: clerkId, ugytipus: caseTypeId, datum: date, kezdes: time },
      })
      setApiMyBookings((list) => [...list, booking])
      return ok({ booking })
    } catch (e) {
      return fail(e.message)
    }
  }, [])

  const cancelBooking = useCallback(
    async (id) => {
      const b = effectiveData.bookings.find((x) => x.id === id)
      if (!b) return fail('A foglalás nem található.')

      // Adatbázisos foglalás: a backend ellenőrzi a 24 órás szabályt és menti
      if (b.fromDb) {
        try {
          const updated = await api(`/foglalasok/${id}/lemondas`, { method: 'POST' })
          setApiMyBookings((list) => list.map((x) => (x.id === id ? updated : x)))
          return ok()
        } catch (e) {
          return fail(e.message)
        }
      }

      // ÁTMENETI: a régi demó foglalások lemondása a böngészőben
      if (!canCancel(b)) return fail('Ezt az időpontot már nem lehet lemondani.')
      patchBooking(id, { status: 'cancelled', cancelledAt: now().toISOString() })
      return ok()
    },
    [effectiveData.bookings],
  )

  const acceptBooking = useCallback((id) => {
    patchBooking(id, { status: 'confirmed', decidedAt: now().toISOString() })
    return ok()
  }, [])

  const rejectBooking = useCallback((id, reason) => {
    const text = reason.trim()
    if (text.length < 5) return fail('Írd le röviden az elutasítás okát.')
    patchBooking(id, {
      status: 'rejected',
      rejectReason: text,
      studentNotified: false,
      decidedAt: now().toISOString(),
    })
    return ok()
  }, [])

  const dismissNotice = useCallback((id) => patchBooking(id, { studentNotified: true }), [])

  /*adminisztráció*/

  const addClerk = useCallback(
    ({ name, id, password }) => {
      const cleanId = id.trim().toUpperCase()
      if (name.trim().length < 3) return fail('Add meg az ügyintéző teljes nevét.')
      if (!/^[A-Z0-9-]{3,20}$/.test(cleanId))
        return fail('Az azonosító csak betűt, számot és kötőjelet tartalmazhat.')
      if (data.users.some((u) => u.id.toUpperCase() === cleanId))
        return fail('Ez az azonosító már foglalt.')
      if (password.length < 8) return fail('A jelszó legalább 8 karakter legyen.')
      const user = { id: cleanId, name: name.trim(), role: 'clerk', password, active: true, schedule: defaultSchedule() }
      setData((d) => ({ ...d, users: [...d.users, user] }))
      return ok({ user })
    },
    [data.users],
  )

  const toggleClerk = useCallback((id) => {
    setData((d) => ({
      ...d,
      users: d.users.map((u) => (u.id === id ? { ...u, active: !u.active } : u)),
    }))
  }, [])

  const addCaseType = useCallback(
    ({ name, duration, clerkIds }) => {
      const clean = name.trim()
      if (clean.length < 3) return fail('Add meg az ügytípus megnevezését.')
      if (data.caseTypes.some((c) => c.name.toLowerCase() === clean.toLowerCase()))
        return fail('Ilyen nevű ügytípus már létezik.')
      const caseType = { id: uid('ct'), name: clean, duration, clerkIds }
      setData((d) => ({ ...d, caseTypes: [...d.caseTypes, caseType] }))
      return ok({ caseType })
    },
    [data.caseTypes],
  )

  /*lezárt napok*/

  const addClosedDays = useCallback(
    ({ dates, reason, cancelAffected }) => {
      const text = reason.trim()
      if (text.length < 3) return fail('Add meg, miért zárt a nap. A hallgatók ezt látják.')
      const existing = new Set(data.closedDays.map((c) => c.date))
      const newDates = dates.filter((d) => !existing.has(d))
      if (!newDates.length) return fail('A kiválasztott napok már le vannak zárva.')

      const stamp = now().toISOString()
      const entries = newDates.map((date) => ({
        id: uid('cd'),
        date,
        reason: text,
        createdBy: currentUser?.id ?? null,
        createdAt: stamp,
      }))
      const dateSet = new Set(newDates)
      const hit = (b) => dateSet.has(b.date) && isActive(b)
      const affected = cancelAffected ? data.bookings.filter(hit).length : 0

      setData((d) => ({
        ...d,
        closedDays: [...d.closedDays, ...entries].sort((a, b) => a.date.localeCompare(b.date)),
        bookings: cancelAffected
          ? d.bookings.map((b) =>
              hit(b)
                ? {
                    ...b,
                    status: 'rejected',
                    rejectReason: `A Tanulmányi Osztály ezen a napon zárva tart (${text}). Kérjük, foglalj másik időpontot.`,
                    studentNotified: false,
                    decidedBy: currentUser?.id ?? null,
                    decidedAt: stamp,
                  }
                : b,
            )
          : d.bookings,
      }))
      return ok({ added: entries.length, affected })
    },
    [data.closedDays, data.bookings, currentUser],
  )

  const removeClosedDays = useCallback((ids) => {
    const set = new Set(ids)
    setData((d) => ({ ...d, closedDays: d.closedDays.filter((c) => !set.has(c.id)) }))
  }, [])

  /*munkarend és távollét*/

  const updateClerkSchedule = useCallback(
    (clerkId, schedule, { rejectAffected }) => {
      const open = toMin(OPENING.start)
      const close = toMin(OPENING.end)
      for (const d of WORKDAYS) {
        const h = schedule[d]
        if (!h) continue
        if (toMin(h.start) >= toMin(h.end)) return fail('A munkaidő vége legyen későbbi, mint a kezdete.')
        if (toMin(h.start) < open || toMin(h.end) > close)
          return fail(`A munkaidő ${OPENING.start} és ${OPENING.end} közé essen.`)
      }
      const hit = (b) => b.clerkId === clerkId && isUpcomingActive(b) && !fitsSchedule(b, schedule)
      const affected = rejectAffected ? data.bookings.filter(hit).length : 0
      const stamp = now().toISOString()
      setData((d) => ({
        ...d,
        users: d.users.map((u) => (u.id === clerkId ? { ...u, schedule } : u)),
        bookings: rejectAffected
          ? rejectWhere(
              d.bookings,
              hit,
              'Az ügyintéző munkarendje megváltozott, ebben az időpontban nem fogad. Kérjük, foglalj másik időpontot.',
              currentUser?.id ?? null,
              stamp,
            )
          : d.bookings,
      }))
      return ok({ affected })
    },
    [data.bookings, currentUser],
  )

  const addAbsence = useCallback(
    ({ clerkId, date, note, rejectAffected }) => {
      const clerk = usersById[clerkId]
      if (!clerk) return fail('Az ügyintéző nem található.')
      if (!date) return fail('Válaszd ki a napot.')
      if (date < todayStr()) return fail('Múltbeli napra nem jelezhető távollét.')
      const day = clerkDay(clerk, date, data.clerkAbsences)
      if (day.why === 'absent') return fail('Erre a napra már jelezted, hogy nem dolgozol.')
      if (!day.working) return fail('Ezen a napon egyébként sem vagy beosztva.')

      const hit = (b) => b.clerkId === clerkId && b.date === date && isUpcomingActive(b)
      const affected = rejectAffected ? data.bookings.filter(hit).length : 0
      const stamp = now().toISOString()
      const entry = { id: uid('ab'), clerkId, date, note: note.trim(), createdAt: stamp }
      setData((d) => ({
        ...d,
        clerkAbsences: [...d.clerkAbsences, entry].sort((a, b) => a.date.localeCompare(b.date)),
        bookings: rejectAffected
          ? rejectWhere(
              d.bookings,
              hit,
              'Az ügyintéző ezen a napon nem elérhető. Kérjük, foglalj másik időpontot vagy válassz másik ügyintézőt.',
              currentUser?.id ?? null,
              stamp,
            )
          : d.bookings,
      }))
      return ok({ affected })
    },
    [usersById, data.clerkAbsences, data.bookings, currentUser],
  )

  const removeAbsence = useCallback((id) => {
    setData((d) => ({ ...d, clerkAbsences: d.clerkAbsences.filter((a) => a.id !== id) }))
  }, [])

  const value = {
    data: effectiveData,
    currentUser,
    authReady,
    usersById,
    caseTypesById,
    userName: (id) => usersById[id]?.name ?? id,
    caseTypeName: (id) => caseTypesById[id]?.name ?? 'Törölt ügytípus',
    toasts,
    toast,
    dismissToast,
    login,
    logout,
    resetDemo,
    createBooking,
    cancelBooking,
    acceptBooking,
    rejectBooking,
    dismissNotice,
    addClerk,
    toggleClerk,
    addCaseType,
    addClosedDays,
    removeClosedDays,
    updateClerkSchedule,
    addAbsence,
    removeAbsence,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp csak AppProvider-en belül használható')
  return ctx
}
