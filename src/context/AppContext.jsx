import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createSeed } from '../data/seed.js'
import { now, todayStr } from '../utils/date.js'
import { canCancel, isActive } from '../utils/bookings.js'
import { getSlots, toMin } from '../utils/slots.js'
import { OPENING } from '../config.js'
import { clerkDay, defaultSchedule, fitsSchedule, isUpcomingActive, WORKDAYS } from '../utils/availability.js'

const DATA_KEY = 'to-idopontfoglalo:data:v1'
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
    /* pl. privát böngészési mód: az adatok csak a munkamenet végéig élnek */
  }
}

// Régebbi mentett adatok kiegészítése az újabb mezőkkel
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

/** Foglalások elutasítása értesítéssel (a hallgató a saját nézetében látja az okot). */
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
  const [toasts, setToasts] = useState([])
  const timers = useRef([])

  useEffect(() => save(DATA_KEY, data), [data])
  useEffect(() => save(SESSION_KEY, sessionId), [sessionId])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const usersById = useMemo(() => Object.fromEntries(data.users.map((u) => [u.id, u])), [data.users])
  const caseTypesById = useMemo(
    () => Object.fromEntries(data.caseTypes.map((c) => [c.id, c])),
    [data.caseTypes],
  )
  const currentUser = sessionId ? usersById[sessionId] ?? null : null

  /* ---------- Értesítések ---------- */

  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const toast = useCallback(
    (message, tone = 'success') => {
      const id = uid('t')
      setToasts((t) => [...t, { id, message, tone }])
      timers.current.push(setTimeout(() => dismissToast(id), 4500))
    },
    [dismissToast],
  )

  /* ---------- Munkamenet ---------- */

  const login = useCallback(
    (rawId, password) => {
      const id = rawId.trim().toUpperCase()
      const user = data.users.find((u) => u.id.toUpperCase() === id)
      if (!id || !password) return fail('Add meg az azonosítódat és a jelszavadat.')
      if (!user || user.password !== password) return fail('Hibás azonosító vagy jelszó.')
      if (user.role === 'clerk' && !user.active)
        return fail('Ez az ügyintézői fiók inaktív. Fordulj a rendszergazdához.')
      setSessionId(user.id)
      return ok()
    },
    [data.users],
  )

  const logout = useCallback(() => {
    setSessionId(null)
    setToasts([])
  }, [])

  const resetDemo = useCallback(() => {
    setData(createSeed())
    setSessionId(null)
    toast('A demó adatok visszaálltak az alapállapotra.')
  }, [toast])

  /* ---------- Foglalások ---------- */

  const patchBooking = (id, patch) =>
    setData((d) => ({ ...d, bookings: d.bookings.map((b) => (b.id === id ? { ...b, ...patch } : b)) }))

  const createBooking = useCallback(
    ({ caseTypeId, clerkId, date, time }) => {
      if (!currentUser) return fail('Nincs bejelentkezett felhasználó.')
      const caseType = caseTypesById[caseTypeId]
      const clerk = usersById[clerkId]
      if (!caseType) return fail('Válassz ügytípust.')
      if (!clerk || !clerk.active) return fail('A kiválasztott ügyintéző nem elérhető.')
      if (!date || !time) return fail('Válassz dátumot és időpontot.')
      const closed = data.closedDays.find((c) => c.date === date)
      if (closed) return fail(`Ezen a napon a Tanulmányi Osztály zárva tart (${closed.reason}).`)

      const day = clerkDay(clerk, date, data.clerkAbsences)
      if (!day.working) return fail(`${clerk.name} ezen a napon nem fogad hallgatókat.`)

      const slot = getSlots({
        bookings: data.bookings,
        clerkId,
        studentId: currentUser.id,
        date,
        duration: caseType.duration,
        hours: day,
      }).find((s) => s.time === time)
      if (!slot?.available) return fail('Ezt az időpontot közben lefoglalták. Válassz másikat.')

      const booking = {
        id: uid('b'),
        studentId: currentUser.id,
        caseTypeId,
        duration: caseType.duration,
        clerkId,
        date,
        time,
        status: 'pending',
        rejectReason: null,
        studentNotified: false,
        createdAt: now().toISOString(),
      }
      setData((d) => ({ ...d, bookings: [...d.bookings, booking] }))
      return ok({ booking })
    },
    [currentUser, caseTypesById, usersById, data.bookings, data.closedDays, data.clerkAbsences],
  )

  const cancelBooking = useCallback(
    (id) => {
      const b = data.bookings.find((x) => x.id === id)
      if (!b) return fail('A foglalás nem található.')
      if (!canCancel(b)) return fail('Ezt az időpontot már nem lehet lemondani.')
      patchBooking(id, { status: 'cancelled', cancelledAt: now().toISOString() })
      return ok()
    },
    [data.bookings],
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

  /* ---------- Adminisztráció ---------- */

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

  /* ---------- Zárt napok ---------- */

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

  /* ---------- Munkarend és távollét ---------- */

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
    data,
    currentUser,
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
