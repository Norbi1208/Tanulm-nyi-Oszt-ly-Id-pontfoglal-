// Kiinduló demó adatok. A futó alkalmazás ezeket a böngésző localStorage-ába
// menti, a bejelentkező oldalon a „Demó adatok visszaállítása” gomb tölti újra.

const ALL_CLERKS = ['UGY-001', 'UGY-002']

// Heti munkarend: kulcs = hét napja (1 = hétfő … 5 = péntek), null = nem dolgozik
const FULL_WEEK = {
  1: { start: '08:00', end: '16:00' },
  2: { start: '08:00', end: '16:00' },
  3: { start: '08:00', end: '16:00' },
  4: { start: '08:00', end: '16:00' },
  5: { start: '08:00', end: '16:00' },
}
const ANNA_WEEK = {
  1: { start: '09:00', end: '15:00' },
  2: { start: '09:00', end: '15:00' },
  3: { start: '09:00', end: '15:00' },
  4: { start: '09:00', end: '15:00' },
  5: { start: '08:00', end: '12:00' },
}

export function createSeed() {
  return {
    users: [
      // Hallgatók (Neptun-kód)
      { id: 'ABC123', name: 'Teszt Elek', role: 'student', password: 'hallgato' },
      { id: 'KOV456', name: 'Kovács Béla', role: 'student', password: 'hallgato' },
      { id: 'NAG789', name: 'Nagy Anna', role: 'student', password: 'hallgato' },
      { id: 'SZA321', name: 'Szabó Péter', role: 'student', password: 'hallgato' },
      { id: 'HOR654', name: 'Horváth Kata', role: 'student', password: 'hallgato' },
      // Ügyintézők
      { id: 'UGY-001', name: 'Minta Péter', role: 'clerk', password: 'ugyintező', active: true, schedule: FULL_WEEK },
      { id: 'UGY-002', name: 'Kovács Anna', role: 'clerk', password: 'ugyintező', active: true, schedule: ANNA_WEEK },
      { id: 'UGY-003', name: 'Tóth Gábor', role: 'clerk', password: 'ugyintező', active: false, schedule: FULL_WEEK },
      // Adminisztrátor
      { id: 'ADM-001', name: 'Rendszer Admin', role: 'admin', password: 'admin' },
    ],
    caseTypes: [
      { id: 'ct-1', name: 'Diákigazolvány matricázás', duration: 10, clerkIds: ALL_CLERKS },
      { id: 'ct-2', name: 'Szakdolgozat leadás', duration: 20, clerkIds: ALL_CLERKS },
      { id: 'ct-3', name: 'Általános ügyintézés', duration: 15, clerkIds: ALL_CLERKS },
      { id: 'ct-4', name: 'Beiratkozás', duration: 30, clerkIds: ALL_CLERKS },
    ],
    // Lezárt napok: ezekre a hallgatók nem foglalhatnak
    closedDays: [
      { id: 'cd-1', date: '2026-10-16', reason: 'Belső képzés', createdBy: 'ADM-001', createdAt: '2026-10-01T10:00:00' },
      { id: 'cd-2', date: '2026-10-23', reason: 'Nemzeti ünnep', createdBy: 'ADM-001', createdAt: '2026-10-01T10:00:00' },
    ],
    // Ügyintézők által jelzett távollétek (egész nap)
    clerkAbsences: [
      { id: 'ab-1', clerkId: 'UGY-002', date: '2026-10-14', note: 'Szabadság', createdAt: '2026-10-01T10:00:00' },
    ],
    bookings: [
      booking('b-1', 'ABC123', 'ct-1', 10, 'UGY-001', '2026-10-08', '09:00', 'confirmed'),
      booking('b-2', 'KOV456', 'ct-2', 20, 'UGY-001', '2026-10-12', '10:30', 'pending'),
      booking('b-3', 'NAG789', 'ct-3', 15, 'UGY-002', '2026-10-13', '14:00', 'pending'),
      booking('b-4', 'SZA321', 'ct-4', 30, 'UGY-002', '2026-10-07', '11:15', 'cancelled'),
      booking('b-5', 'HOR654', 'ct-1', 10, 'UGY-002', '2026-10-13', '09:30', 'confirmed'),
    ],
  }
}

function booking(id, studentId, caseTypeId, duration, clerkId, date, time, status) {
  return {
    id,
    studentId,
    caseTypeId,
    duration,
    clerkId,
    date,
    time,
    status, // 'pending' | 'confirmed' | 'rejected' | 'cancelled'
    rejectReason: null,
    studentNotified: false,
    createdAt: '2026-10-01T10:00:00',
  }
}
