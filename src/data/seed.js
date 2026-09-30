// Kiinduló demó adatok. A futó alkalmazás ezeket a böngésző localStorage-ába
// menti, a bejelentkező oldalon a „Demó adatok visszaállítása” gomb tölti újra.

const ALL_CLERKS = ['UGY-001', 'UGY-002']

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
      { id: 'UGY-001', name: 'Minta Péter', role: 'clerk', password: 'ugyintező', active: true },
      { id: 'UGY-002', name: 'Kovács Anna', role: 'clerk', password: 'ugyintező', active: true },
      { id: 'UGY-003', name: 'Tóth Gábor', role: 'clerk', password: 'ugyintező', active: false },
      // Adminisztrátor
      { id: 'ADM-001', name: 'Rendszer Admin', role: 'admin', password: 'admin' },
    ],
    caseTypes: [
      { id: 'ct-1', name: 'Diákigazolvány matricázás', duration: 10, clerkIds: ALL_CLERKS },
      { id: 'ct-2', name: 'Szakdolgozat leadás', duration: 20, clerkIds: ALL_CLERKS },
      { id: 'ct-3', name: 'Általános ügyintézés', duration: 15, clerkIds: ALL_CLERKS },
      { id: 'ct-4', name: 'Beiratkozás', duration: 30, clerkIds: ALL_CLERKS },
    ],
    bookings: [
      booking('b-1', 'ABC123', 'ct-1', 10, 'UGY-001', '2026-10-08', '09:00', 'confirmed'),
      booking('b-2', 'KOV456', 'ct-2', 20, 'UGY-001', '2026-10-10', '10:30', 'pending'),
      booking('b-3', 'NAG789', 'ct-3', 15, 'UGY-002', '2026-10-11', '14:00', 'pending'),
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
