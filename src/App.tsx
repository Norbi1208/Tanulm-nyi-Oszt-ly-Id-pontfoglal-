import { useState, useEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type AppView = "login" | "app";
type Role = "student" | "clerk" | "admin";
type BookingStatus = "pending" | "confirmed" | "cancelled";

interface Booking {
  id: string;
  student: string;
  neptun: string;
  caseType: string;
  date: string;
  time: string;
  status: BookingStatus;
  clerk?: string;
  rejectionReason?: string;
}

interface CaseType {
  id: string;
  name: string;
  duration: number;
}

interface Clerk {
  id: string;
  name: string;
  neptun: string;
  active: boolean;
}

type ModalId =
  | "studentBooking"
  | "studentCancel"
  | "clerkConfirm"
  | "adminAddClerk"
  | "adminAddCase"
  | "rejectionDetail"
  | null;

// ─── Initial data ─────────────────────────────────────────────────────────────
const INITIAL_BOOKINGS: Booking[] = [
  { id: "1", student: "Teszt Elek", neptun: "ABC123", caseType: "Diákigazolvány matricázás", date: "2026-10-08", time: "09:00", status: "confirmed", clerk: "Minta Péter" },
  { id: "2", student: "Kovács Béla", neptun: "KOV456", caseType: "Szakdolgozat leadás", date: "2026-10-10", time: "10:30", status: "pending", clerk: "Minta Péter" },
  { id: "3", student: "Nagy Anna", neptun: "NAG789", caseType: "Általános ügyintézés", date: "2026-10-11", time: "14:00", status: "pending", clerk: "Kovács Anna" },
  { id: "4", student: "Szabó Péter", neptun: "SZA321", caseType: "Beiratkozás", date: "2026-10-07", time: "11:15", status: "cancelled", clerk: "Kovács Anna" },
  { id: "5", student: "Horváth Kata", neptun: "HOR654", caseType: "Diákigazolvány matricázás", date: "2026-10-13", time: "09:30", status: "confirmed", clerk: "Kovács Anna" },
];

const INITIAL_CASES: CaseType[] = [
  { id: "1", name: "Diákigazolvány matricázás", duration: 10 },
  { id: "2", name: "Szakdolgozat leadás", duration: 20 },
  { id: "3", name: "Általános ügyintézés", duration: 15 },
  { id: "4", name: "Beiratkozás", duration: 30 },
];

const INITIAL_CLERKS: Clerk[] = [
  { id: "1", name: "Minta Péter", neptun: "UGY-001", active: true },
  { id: "2", name: "Kovács Anna", neptun: "UGY-002", active: true },
  { id: "3", name: "Tóth Gábor", neptun: "UGY-003", active: false },
];

const TIME_SLOTS = [
  "08:00", "08:15", "08:30", "08:45",
  "09:00", "09:15", "09:30", "09:45",
  "10:00", "10:15", "10:30", "10:45",
  "11:00", "11:15", "11:30", "11:45",
  "13:00", "13:15", "13:30", "13:45",
  "14:00", "14:15", "14:30", "14:45",
];

const TAKEN_SLOTS = ["08:15", "09:00", "10:30", "11:15", "13:45", "14:00"];

// ─── Toast ───────────────────────────────────────────────────────────────────
interface ToastProps {
  message: string;
  type: "success" | "error" | "info";
  onDone: () => void;
}
function Toast({ message, type, onDone }: ToastProps) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), 2700);
    const t2 = setTimeout(onDone, 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);
  const colors: Record<string, string> = {
    success: "bg-emerald-500",
    error: "bg-red-500",
    info: "bg-[#00bcd4]",
  };
  const icons: Record<string, string> = { success: "✓", error: "✕", info: "i" };
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-white shadow-xl text-sm font-medium ${colors[type]} ${leaving ? "toast-out" : "toast-in"}`}>
      <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">{icons[type]}</span>
      {message}
    </div>
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────
function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay-enter"
      style={{ backgroundColor: "rgba(15,23,42,0.5)", backdropFilter: "blur(2px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-content-enter w-full max-w-lg">
        {children}
      </div>
    </div>
  );
}

// ─── Student Booking Modal ────────────────────────────────────────────────────
function StudentBookingModal({ open, onClose, cases, clerks, onSave }: {
  open: boolean; onClose: () => void; cases: CaseType[]; clerks: Clerk[];
  onSave: (b: { caseType: string; date: string; time: string; clerkName: string }) => void;
}) {
  const activeClerk = clerks.filter(c => c.active);
  const [caseType, setCaseType] = useState(cases[0]?.name ?? "");
  const [date, setDate] = useState("2026-10-15");
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedClerk, setSelectedClerk] = useState(activeClerk[0]?.name ?? "");
  const today = new Date().toISOString().split("T")[0];

  const canSave = selectedTime && selectedClerk;

  return (
    <Modal open={open} onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-[#00bcd4] to-[#0097a7]" />
        <div className="p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Időpont foglalása</h2>
              <p className="text-xs text-slate-400 mt-0.5">Válassz ügyet, ügyintézőt, dátumot és időpontot</p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors text-xl leading-none mt-0.5">×</button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="form-label">Elintézendő ügy</label>
              <select className="form-input" value={caseType} onChange={e => setCaseType(e.target.value)}>
                {cases.map(c => <option key={c.id}>{c.name} ({c.duration} perc)</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Ügyintéző kiválasztása</label>
              <div className="grid grid-cols-2 gap-2">
                {activeClerk.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedClerk(c.name)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all ${selectedClerk === c.name ? "border-[#00bcd4] bg-[#e0f7fa]" : "border-slate-200 bg-white hover:border-slate-300"}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${selectedClerk === c.name ? "bg-[#00bcd4] text-white" : "bg-slate-100 text-slate-500"}`}>
                      {c.name.charAt(0)}
                    </div>
                    <div>
                      <div className={`text-sm font-semibold ${selectedClerk === c.name ? "text-[#0097a7]" : "text-slate-700"}`}>{c.name}</div>
                      <div className="text-xs text-slate-400 font-mono">{c.neptun}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="form-label">Dátum</label>
              <input type="date" className="form-input" value={date} min={today} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Elérhető időpontok</label>
              <div className="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto pr-1">
                {TIME_SLOTS.map(t => (
                  <button
                    key={t}
                    className={`time-slot ${TAKEN_SLOTS.includes(t) ? "taken" : ""} ${selectedTime === t ? "selected" : ""}`}
                    onClick={() => { if (!TAKEN_SLOTS.includes(t)) setSelectedTime(t); }}
                  >{t}</button>
                ))}
              </div>
              {!selectedTime && <p className="text-xs text-slate-400 mt-2">Kattints egy szabad időpontra</p>}
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
            <button className="btn-outline" onClick={onClose}>Mégsem</button>
            <button
              className="btn-primary"
              onClick={() => {
                if (!canSave) return;
                onSave({ caseType, date, time: selectedTime, clerkName: selectedClerk });
                onClose();
              }}
              style={{ opacity: canSave ? 1 : 0.5 }}
            >
              Foglalás mentése
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Student Cancel Modal ─────────────────────────────────────────────────────
function StudentCancelModal({ open, onClose, booking, onConfirm }: {
  open: boolean; onClose: () => void; booking: Booking | null; onConfirm: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="h-1 bg-red-500" />
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Időpont lemondása</h2>
              <p className="text-xs text-slate-400 mt-0.5">Ez a művelet nem vonható vissza</p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors text-xl leading-none mt-0.5">×</button>
          </div>
          {booking && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-red-500 text-lg">⚠</span>
                <span className="font-semibold text-red-700 text-sm">Lemondásra kerülő időpont</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-slate-500">Ügy:</div>
                <div className="font-medium text-slate-800">{booking.caseType}</div>
                <div className="text-slate-500">Dátum:</div>
                <div className="font-medium text-slate-800 font-mono">{booking.date}</div>
                <div className="text-slate-500">Időpont:</div>
                <div className="font-medium text-slate-800 font-mono">{booking.time}</div>
              </div>
            </div>
          )}
          <p className="text-sm text-slate-600">Biztosan le szeretnéd mondani a foglalást? A lemondott időpont más hallgatók számára elérhetővé válik.</p>
          <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
            <button className="btn-outline" onClick={onClose}>Nem, megtartom</button>
            <button className="btn-danger" onClick={() => { onConfirm(); onClose(); }}>Igen, lemondom</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Clerk Reject Reason Modal ────────────────────────────────────────────────
function ClerkRejectModal({ open, onClose, onConfirm }: {
  open: boolean; onClose: () => void; onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const reset = () => setReason("");
  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="h-1 bg-red-500" />
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Elutasítás oka</h2>
              <p className="text-xs text-slate-400 mt-0.5">A hallgató értesítést kap az elutasítás okáról</p>
            </div>
            <button onClick={() => { reset(); onClose(); }} className="text-slate-400 hover:text-slate-600 transition-colors text-xl leading-none mt-0.5">×</button>
          </div>
          <div>
            <label className="form-label">Elutasítás indoklása</label>
            <textarea
              className="form-input resize-none"
              rows={4}
              placeholder="Pl.: A megadott időpontban nem áll rendelkezésre ügyintéző. Kérjük, foglaljon másik időpontot."
              value={reason}
              onChange={e => setReason(e.target.value)}
              style={{ fontFamily: "inherit" }}
            />
          </div>
          <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
            <button className="btn-outline" onClick={() => { reset(); onClose(); }}>Vissza</button>
            <button
              className="btn-danger"
              style={{ opacity: reason.trim() ? 1 : 0.5 }}
              onClick={() => {
                if (!reason.trim()) return;
                onConfirm(reason.trim());
                reset();
              }}
            >
              Elutasítás véglegesítése
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Clerk Confirm Modal ──────────────────────────────────────────────────────
function ClerkConfirmModal({ open, onClose, booking, onAccept, onReject }: {
  open: boolean; onClose: () => void; booking: Booking | null;
  onAccept: () => void; onReject: (reason: string) => void;
}) {
  const [showReject, setShowReject] = useState(false);
  return (
    <>
      <Modal open={open && !showReject} onClose={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-[#00bcd4] to-[#0097a7]" />
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Foglalás kezelése</h2>
                <p className="text-xs text-slate-400 mt-0.5">Ügyintézői megerősítés</p>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors text-xl leading-none mt-0.5">×</button>
            </div>
            {booking && (
              <div className="bg-slate-50 rounded-xl p-4 mb-5 border border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-[#e0f7fa] flex items-center justify-center text-[#00bcd4] font-bold text-sm">
                    {booking.student.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800 text-sm">{booking.student}</div>
                    <div className="text-xs text-slate-400 font-mono">{booking.neptun}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                  <span className="text-slate-500">Ügy:</span>
                  <span className="font-medium text-slate-700">{booking.caseType}</span>
                  <span className="text-slate-500">Foglalt időpont:</span>
                  <span className="font-medium text-slate-700 font-mono">{booking.date} {booking.time}</span>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button className="btn-outline" onClick={onClose}>Mégsem</button>
              <button
                className="btn-danger"
                onClick={() => setShowReject(true)}
              >
                ✕  Elutasítás
              </button>
              <button
                className="btn-primary"
                onClick={() => { onAccept(); onClose(); }}
              >
                ✓  Elfogadás
              </button>
            </div>
          </div>
        </div>
      </Modal>
      <ClerkRejectModal
        open={showReject}
        onClose={() => setShowReject(false)}
        onConfirm={(reason) => {
          setShowReject(false);
          onReject(reason);
          onClose();
        }}
      />
    </>
  );
}

// ─── Admin Add Clerk Modal ────────────────────────────────────────────────────
function AdminAddClerkModal({ open, onClose, onSave }: {
  open: boolean; onClose: () => void; onSave: (c: Omit<Clerk, "id" | "active">) => void;
}) {
  const [name, setName] = useState("");
  const [neptun, setNeptun] = useState("");
  const [pass, setPass] = useState("");
  const reset = () => { setName(""); setNeptun(""); setPass(""); };
  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-[#00bcd4] to-[#0097a7]" />
        <div className="p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Új ügyintéző hozzáadása</h2>
              <p className="text-xs text-slate-400 mt-0.5">Az ügyintéző azonnal aktívvá válik</p>
            </div>
            <button onClick={() => { reset(); onClose(); }} className="text-slate-400 hover:text-slate-600 transition-colors text-xl leading-none mt-0.5">×</button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="form-label">Teljes név</label>
              <input type="text" className="form-input" placeholder="Pl.: Minta Péter" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Egyedi azonosító</label>
              <input type="text" className="form-input font-mono uppercase" placeholder="Pl.: UGY-004" value={neptun} onChange={e => setNeptun(e.target.value.toUpperCase())} />
            </div>
            <div>
              <label className="form-label">Ideiglenes jelszó</label>
              <input type="password" className="form-input" placeholder="Min. 8 karakter" value={pass} onChange={e => setPass(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
            <button className="btn-outline" onClick={() => { reset(); onClose(); }}>Mégsem</button>
            <button
              className="btn-primary"
              style={{ opacity: name && neptun && pass.length >= 4 ? 1 : 0.5 }}
              onClick={() => {
                if (!name || !neptun || pass.length < 4) return;
                onSave({ name, neptun });
                reset();
                onClose();
              }}
            >
              Ügyintéző hozzáadása
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Admin Add Case Modal ─────────────────────────────────────────────────────
function AdminAddCaseModal({ open, onClose, clerks, onSave }: {
  open: boolean; onClose: () => void; clerks: Clerk[];
  onSave: (c: Omit<CaseType, "id">) => void;
}) {
  const [caseName, setCaseName] = useState("");
  const [duration, setDuration] = useState(15);
  const reset = () => { setCaseName(""); setDuration(15); };
  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-[#00bcd4] to-[#0097a7]" />
        <div className="p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Új ügytípus felvétele</h2>
              <p className="text-xs text-slate-400 mt-0.5">Azonnal elérhetővé válik a foglalási rendszerben</p>
            </div>
            <button onClick={() => { reset(); onClose(); }} className="text-slate-400 hover:text-slate-600 transition-colors text-xl leading-none mt-0.5">×</button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="form-label">Ügytípus megnevezése</label>
              <input type="text" className="form-input" placeholder="Pl.: Diákigazolvány matricázás" value={caseName} onChange={e => setCaseName(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Becsült ügyintézési idő</label>
              <div className="flex items-center gap-3">
                <input
                  type="range" min={5} max={60} step={5} value={duration}
                  onChange={e => setDuration(Number(e.target.value))}
                  className="flex-1 accent-[#00bcd4]"
                />
                <span className="font-mono font-semibold text-[#00bcd4] w-16 text-center bg-[#e0f7fa] rounded-lg py-1.5 text-sm">
                  {duration} p
                </span>
              </div>
            </div>
            <div>
              <label className="form-label">Hozzárendelt ügyintézők (opcionális)</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {clerks.map(c => (
                  <label key={c.id} className="flex items-center gap-1.5 text-xs cursor-pointer bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 hover:border-[#00bcd4] transition-colors">
                    <input type="checkbox" className="accent-[#00bcd4]" defaultChecked={c.active} />
                    <span className="font-medium text-slate-700">{c.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
            <button className="btn-outline" onClick={() => { reset(); onClose(); }}>Mégsem</button>
            <button
              className="btn-primary"
              style={{ opacity: caseName ? 1 : 0.5 }}
              onClick={() => {
                if (!caseName) return;
                onSave({ name: caseName, duration });
                reset();
                onClose();
              }}
            >
              Ügytípus mentése
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: BookingStatus }) {
  const map: Record<BookingStatus, { cls: string; label: string }> = {
    pending: { cls: "badge-pending", label: "Függőben" },
    confirmed: { cls: "badge-confirmed", label: "Megerősítve" },
    cancelled: { cls: "badge-cancelled", label: "Lemondva" },
  };
  const { cls, label } = map[status];
  return <span className={`badge ${cls}`}><span className="badge-dot" />{label}</span>;
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: number; sub: string; color: string }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm card-animate">
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</div>
      <div className="stat-number text-3xl font-bold" style={{ color }}>{value}</div>
      <div className="text-xs text-slate-400 mt-1">{sub}</div>
    </div>
  );
}

// ─── Rejection Detail Modal ───────────────────────────────────────────────────
function RejectionDetailModal({ open, onClose, booking }: {
  open: boolean; onClose: () => void; booking: Booking | null;
}) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="h-1 bg-red-500" />
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Elutasítás részletei</h2>
              <p className="text-xs text-slate-400 mt-0.5">Az ügyintéző által megadott indoklás</p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors text-xl leading-none mt-0.5">×</button>
          </div>
          {booking && (
            <>
              <div className="bg-slate-50 rounded-xl p-4 mb-4 border border-slate-100">
                <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                  <span className="text-slate-500">Hallgató:</span>
                  <span className="font-medium text-slate-700">{booking.student}</span>
                  <span className="text-slate-500">Ügy:</span>
                  <span className="font-medium text-slate-700">{booking.caseType}</span>
                  <span className="text-slate-500">Időpont:</span>
                  <span className="font-medium text-slate-700 font-mono">{booking.date} {booking.time}</span>
                </div>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-red-500 text-base">⚠</span>
                  <span className="text-xs font-semibold text-red-700">Elutasítás oka</span>
                </div>
                <p className="text-sm text-red-800 leading-relaxed">
                  {booking.rejectionReason ?? "Nincs megadott indoklás."}
                </p>
              </div>
            </>
          )}
          <div className="flex justify-end mt-5 pt-4 border-t border-slate-100">
            <button className="btn-outline" onClick={onClose}>Bezárás</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Student View ─────────────────────────────────────────────────────────────
function StudentView({ bookings, cases, openModal, myNeptun, onCancelBooking, onViewRejection }: {
  bookings: Booking[]; cases: CaseType[];
  openModal: (id: ModalId) => void; myNeptun: string;
  onCancelBooking: (b: Booking) => void;
  onViewRejection: (b: Booking) => void;
}) {
  const myBookings = bookings.filter(b => b.neptun === myNeptun);
  const upcoming = myBookings.filter(b => b.status !== "cancelled");
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Összes foglalás" value={myBookings.length} sub="saját fiók" color="#00bcd4" />
        <StatCard label="Közelgő" value={upcoming.length} sub="aktív időpont" color="#0097a7" />
        <StatCard label="Lemondott" value={myBookings.filter(b => b.status === "cancelled").length} sub="ebben a félévben" color="#ef4444" />
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-800 text-sm" style={{ borderLeft: "3px solid #00bcd4", paddingLeft: 10 }}>
            Foglalásaim
          </h2>
          <button className="btn-primary text-xs" style={{ padding: "6px 14px" }} onClick={() => openModal("studentBooking")}>
            + Új foglalás
          </button>
        </div>
        {myBookings.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            <div className="text-3xl mb-2">📅</div>
            Nincs aktív foglalásod.
            <br />
            <button className="text-[#00bcd4] font-medium mt-2 hover:underline" onClick={() => openModal("studentBooking")}>
              Foglalj időpontot most!
            </button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Ügy</th><th>Dátum</th><th>Időpont</th><th>Ügyintéző</th><th>Állapot</th><th></th>
              </tr>
            </thead>
            <tbody>
              {myBookings.map(b => (
                <tr key={b.id}>
                  <td className="font-medium text-slate-800">{b.caseType}</td>
                  <td className="font-mono text-slate-600">{b.date}</td>
                  <td className="font-mono text-slate-600">{b.time}</td>
                  <td className="text-slate-500">{b.clerk ?? "—"}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={b.status} />
                      {b.status === "cancelled" && b.rejectionReason && (
                        <button
                          className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors underline underline-offset-2"
                          onClick={() => onViewRejection(b)}
                        >
                          Ok megtekintése
                        </button>
                      )}
                    </div>
                  </td>
                  <td>
                    {b.status !== "cancelled" && (
                      <button
                        className="text-xs font-semibold text-red-400 hover:text-red-600 transition-colors"
                        onClick={() => onCancelBooking(b)}
                      >
                        Lemondás
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-[#e0f7fa] border border-[#b2ebf2] rounded-xl p-4 text-sm text-[#006064]">
        <strong className="block mb-1">Tájékoztató</strong>
        Időpontot legkésőbb 24 órával a tervezett időpont előtt lehet lemondani.
      </div>
    </div>
  );
}

// ─── Clerk View ───────────────────────────────────────────────────────────────
function ClerkView({ bookings, openModal, setTargetBooking, onViewRejection, clerkName }: {
  bookings: Booking[];
  openModal: (id: ModalId) => void;
  setTargetBooking: (b: Booking) => void;
  onViewRejection: (b: Booking) => void;
  clerkName: string;
}) {
  const myBookings = bookings.filter(b => b.clerk === clerkName);
  const pending = myBookings.filter(b => b.status === "pending");
  const today = "2026-10-08";
  const todayBookings = myBookings.filter(b => b.date === today);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Függőben" value={pending.length} sub="megerősítésre vár" color="#f59e0b" />
        <StatCard label="Ma" value={todayBookings.length} sub="mai időpont" color="#00bcd4" />
        <StatCard label="Megerősítve" value={bookings.filter(b => b.status === "confirmed").length} sub="összes" color="#22c55e" />
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-800 text-sm" style={{ borderLeft: "3px solid #00bcd4", paddingLeft: 10 }}>
            Megerősítésre váró foglalások
          </h2>
        </div>
        {pending.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            <div className="text-3xl mb-2">✓</div>
            Nincs függőben lévő foglalás.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Hallgató</th><th>Neptun</th><th>Ügy</th><th>Dátum</th><th>Idő</th><th>Műveletek</th></tr>
            </thead>
            <tbody>
              {pending.map(b => (
                <tr key={b.id}>
                  <td className="font-medium text-slate-800">{b.student}</td>
                  <td className="font-mono text-slate-500 text-xs">{b.neptun}</td>
                  <td className="text-slate-600">{b.caseType}</td>
                  <td className="font-mono text-slate-600">{b.date}</td>
                  <td className="font-mono text-slate-600">{b.time}</td>
                  <td>
                    <button
                      className="text-xs font-semibold text-[#00bcd4] hover:text-[#0097a7] transition-colors"
                      onClick={() => { setTargetBooking(b); openModal("clerkConfirm"); }}
                    >
                      Kezelés →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-800 text-sm" style={{ borderLeft: "3px solid #00bcd4", paddingLeft: 10 }}>
            Összes foglalás
          </h2>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>Hallgató</th><th>Ügy</th><th>Dátum</th><th>Idő</th><th>Állapot</th></tr>
          </thead>
          <tbody>
            {myBookings.filter(b => b.status !== "pending").map(b => (
              <tr key={b.id}>
                <td>
                  <div className="font-medium text-slate-800 text-sm">{b.student}</div>
                  <div className="text-xs text-slate-400 font-mono">{b.neptun}</div>
                </td>
                <td className="text-slate-600">{b.caseType}</td>
                <td className="font-mono text-slate-600">{b.date}</td>
                <td className="font-mono text-slate-600">{b.time}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={b.status} />
                    {b.status === "cancelled" && b.rejectionReason && (
                      <button
                        className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors underline underline-offset-2"
                        onClick={() => onViewRejection(b)}
                      >
                        Ok megtekintése
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Admin View ───────────────────────────────────────────────────────────────
function AdminView({ bookings, cases, clerks, openModal }: {
  bookings: Booking[]; cases: CaseType[]; clerks: Clerk[];
  openModal: (id: ModalId) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Összes foglalás" value={bookings.length} sub="ebben a hónapban" color="#00bcd4" />
        <StatCard label="Ügyintézők" value={clerks.filter(c => c.active).length} sub="aktív" color="#22c55e" />
        <StatCard label="Ügytípusok" value={cases.length} sub="aktív" color="#f59e0b" />
        <StatCard label="Lemondások" value={bookings.filter(b => b.status === "cancelled").length} sub="ebben a hónapban" color="#ef4444" />
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-800 text-sm" style={{ borderLeft: "3px solid #00bcd4", paddingLeft: 10 }}>
              Ügyintézők
            </h2>
            <button className="btn-primary text-xs" style={{ padding: "6px 14px" }} onClick={() => openModal("adminAddClerk")}>
              + Hozzáadás
            </button>
          </div>
          <table className="data-table">
            <thead><tr><th>Név</th><th>Azonosító</th><th>Státusz</th></tr></thead>
            <tbody>
              {clerks.map(c => (
                <tr key={c.id}>
                  <td className="font-medium text-slate-800">{c.name}</td>
                  <td className="font-mono text-slate-500 text-xs">{c.neptun}</td>
                  <td>
                    <span className={`badge ${c.active ? "badge-confirmed" : "badge-cancelled"}`}>
                      <span className="badge-dot" />{c.active ? "Aktív" : "Inaktív"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-800 text-sm" style={{ borderLeft: "3px solid #00bcd4", paddingLeft: 10 }}>
              Ügytípusok
            </h2>
            <button className="btn-primary text-xs" style={{ padding: "6px 14px" }} onClick={() => openModal("adminAddCase")}>
              + Felvétel
            </button>
          </div>
          <table className="data-table">
            <thead><tr><th>Megnevezés</th><th>Időtartam</th></tr></thead>
            <tbody>
              {cases.map(c => (
                <tr key={c.id}>
                  <td className="font-medium text-slate-800">{c.name}</td>
                  <td>
                    <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                      {c.duration} perc
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-800 text-sm" style={{ borderLeft: "3px solid #00bcd4", paddingLeft: 10 }}>
            Összes foglalás áttekintése
          </h2>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>Hallgató</th><th>Neptun</th><th>Ügy</th><th>Dátum</th><th>Idő</th><th>Ügyintéző</th><th>Állapot</th></tr>
          </thead>
          <tbody>
            {bookings.map(b => (
              <tr key={b.id}>
                <td className="font-medium text-slate-800">{b.student}</td>
                <td className="font-mono text-slate-500 text-xs">{b.neptun}</td>
                <td className="text-slate-600">{b.caseType}</td>
                <td className="font-mono text-slate-600">{b.date}</td>
                <td className="font-mono text-slate-600">{b.time}</td>
                <td className="text-slate-500">{b.clerk ?? "—"}</td>
                <td><StatusBadge status={b.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Login View ───────────────────────────────────────────────────────────────
const DEMO_USERS: Record<string, { password: string; role: Role; name: string; neptun: string }> = {
  ABC123: { password: "hallgato", role: "student", name: "Teszt Elek", neptun: "ABC123" },
  "UGY-001": { password: "ugyintező", role: "clerk", name: "Minta Péter", neptun: "UGY-001" },
  "ADM-001": { password: "admin", role: "admin", name: "Rendszer Admin", neptun: "ADM-001" },
};

function LoginView({ onLogin }: { onLogin: (role: Role, name: string, neptun: string) => void }) {
  const [neptun, setNeptun] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setTimeout(() => {
      const key = neptun.toUpperCase().trim();
      const user = DEMO_USERS[key];
      if (user && user.password === password) {
        onLogin(user.role, user.name, user.neptun);
      } else {
        setError("Hibás azonosító vagy jelszó. Próbálj újra.");
        setLoading(false);
      }
    }, 700);
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(135deg, #e0f7fa 0%, #f0f4f8 50%, #e8f5e9 100%)" }}
    >
      {/* Top bar */}
      <div style={{ background: "linear-gradient(135deg, #00bcd4 0%, #0097a7 100%)" }} className="shadow-md">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-4">
          <div className="bg-white rounded-lg px-3 py-1.5 flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-sm bg-[#00bcd4]" />
            <span className="font-black text-slate-800 text-sm tracking-tight">SZE</span>
          </div>
          <div>
            <h1 className="text-white font-bold text-sm tracking-wide uppercase">
              Tanulmányi Osztály Időpontfoglaló
            </h1>
            <p className="text-[#b2ebf2] text-xs">Széchenyi István Egyetem</p>
          </div>
        </div>
      </div>

      {/* Login card */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          {/* SZE emblem */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-[#00bcd4] shadow-lg flex items-center justify-center mb-3" style={{ boxShadow: "0 8px 24px rgba(0,188,212,0.35)" }}>
              <span className="text-white font-black text-2xl tracking-tight">SZE</span>
            </div>
            <h2 className="text-xl font-bold text-slate-800">Bejelentkezés</h2>
            <p className="text-sm text-slate-400 mt-1">Azonosítóddal és jelszóddal</p>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-7 space-y-4 border border-slate-100">
            <div>
              <label className="form-label">Azonosító (Neptun-kód / Egyedi azonosító)</label>
              <input
                type="text"
                className="form-input font-mono uppercase"
                placeholder="Pl.: ABC123 vagy UGY-001"
                value={neptun}
                onChange={e => { setNeptun(e.target.value); setError(""); }}
                autoFocus
                required
              />
            </div>
            <div>
              <label className="form-label">Jelszó</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  className="form-input pr-10"
                  placeholder="Jelszó"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(""); }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPass ? "Jelszó elrejtése" : "Jelszó megjelenítése"}
                >
                  {showPass ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 slide-in-left">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
              style={{ padding: "12px 20px" }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
                  Bejelentkezés...
                </>
              ) : "Bejelentkezés"}
            </button>
          </form>

          {/* Demo hint */}
          <div className="mt-5 bg-white/70 border border-slate-200 rounded-xl p-4 text-xs text-slate-500 space-y-1.5">
            <p className="font-semibold text-slate-600 mb-2">Demo fiókok:</p>
            {Object.entries(DEMO_USERS).map(([key, u]) => (
              <div key={key} className="flex items-center justify-between gap-2">
                <span className="font-mono bg-slate-100 rounded px-1.5 py-0.5 text-slate-700">{key}</span>
                <span className="text-slate-400">·</span>
                <span className="font-mono text-slate-500">{u.password}</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500">{u.role === "student" ? "Hallgató" : u.role === "clerk" ? "Ügyintéző" : "Admin"}</span>
                <button
                  type="button"
                  className="ml-auto text-[#00bcd4] hover:text-[#0097a7] font-semibold transition-colors"
                  onClick={() => { setNeptun(key); setPassword(u.password); setError(""); }}
                >
                  Kitöltés
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState<AppView>("login");
  const [role, setRole] = useState<Role>("student");
  const [loggedUser, setLoggedUser] = useState<{ name: string; neptun: string } | null>(null);
  const [activeModal, setActiveModal] = useState<ModalId>(null);
  const [bookings, setBookings] = useState<Booking[]>(INITIAL_BOOKINGS);
  const [cases, setCases] = useState<CaseType[]>(INITIAL_CASES);
  const [clerks, setClerks] = useState<Clerk[]>(INITIAL_CLERKS);
  const [targetBooking, setTargetBooking] = useState<Booking | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [rejectionTarget, setRejectionTarget] = useState<Booking | null>(null);
  const [toasts, setToasts] = useState<{ id: number; message: string; type: "success" | "error" | "info" }[]>([]);
  const toastId = useRef(0);

  if (view === "login") {
    return (
      <LoginView
        onLogin={(r, name, neptun) => {
          setRole(r);
          setLoggedUser({ name, neptun });
          setView("app");
        }}
      />
    );
  }

  const toast = (message: string, type: "success" | "error" | "info" = "success") => {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const openModal = (id: ModalId) => setActiveModal(id);
  const closeModal = () => setActiveModal(null);

  const roleUser: Record<Role, { name: string; neptun: string }> = {
    student: { name: "Teszt Elek", neptun: "ABC123" },
    clerk: { name: "Minta Péter", neptun: "MINTA123" },
    admin: { name: "Rendszer Admin", neptun: "ADMIN001" },
  };
  const user = loggedUser ?? roleUser[role];

  const roleLabel: Record<Role, string> = {
    student: "Hallgató",
    clerk: "Ügyintéző",
    admin: "Adminisztrátor",
  };

  return (
    <div className="min-h-screen" style={{ background: "#f0f4f8" }}>
      {/* Header */}
      <header style={{ background: "linear-gradient(135deg, #00bcd4 0%, #0097a7 100%)" }} className="shadow-md">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* SZE Logo placeholder */}
            <div className="bg-white rounded-lg px-3 py-1.5 flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-sm bg-[#00bcd4]" />
              <span className="font-black text-slate-800 text-sm tracking-tight">SZE</span>
            </div>
            <div>
              <h1 className="text-white font-bold text-sm tracking-wide uppercase">
                Tanulmányi Osztály Időpontfoglaló
              </h1>
              <p className="text-[#b2ebf2] text-xs">Széchenyi István Egyetem</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-white text-xs font-semibold">{user.name}</div>
                <div className="text-[#b2ebf2] text-xs font-mono">{user.neptun}</div>
              </div>
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">
                {user.name.charAt(0)}
              </div>
              <button
                className="bg-red-500 hover:bg-red-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                onClick={() => {
                  setView("login");
                  setLoggedUser(null);
                  toast("Sikeres kijelentkezés.", "info");
                }}
              >
                Kilépés
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-6 py-6">
        {/* Page header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {roleLabel[role]} nézet
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {role === "student" && "Foglalj időpontot a Tanulmányi Osztályra"}
              {role === "clerk" && "Kezelj és erősíts meg hallgatói foglalásokat"}
              {role === "admin" && "Rendszer áttekintése és konfigurálás"}
            </p>
          </div>
          <div className="text-xs text-slate-400 font-mono bg-white border border-slate-200 rounded-lg px-3 py-1.5">
            2026-10-08 · Őszi félév
          </div>
        </div>

        {role === "student" && (
          <StudentView
            bookings={bookings}
            cases={cases}
            openModal={openModal}
            myNeptun={user.neptun}
            onCancelBooking={(b) => { setCancelTarget(b); openModal("studentCancel"); }}
            onViewRejection={(b) => { setRejectionTarget(b); openModal("rejectionDetail"); }}
          />
        )}
        {role === "clerk" && (
          <ClerkView
            bookings={bookings}
            openModal={openModal}
            setTargetBooking={setTargetBooking}
            onViewRejection={(b) => { setRejectionTarget(b); openModal("rejectionDetail"); }}
            clerkName={user.name}
          />
        )}
        {role === "admin" && (
          <AdminView
            bookings={bookings}
            cases={cases}
            clerks={clerks}
            openModal={openModal}
          />
        )}
      </main>

      {/* Modals */}
      <StudentBookingModal
        open={activeModal === "studentBooking"}
        onClose={closeModal}
        cases={cases}
        clerks={clerks}
        onSave={({ caseType, date, time, clerkName }) => {
          const newBooking: Booking = {
            id: String(Date.now()),
            student: user.name,
            neptun: user.neptun,
            caseType,
            date,
            time,
            status: "pending",
            clerk: clerkName,
          };
          setBookings(prev => [...prev, newBooking]);
          toast(`Foglalás rögzítve: ${date} ${time} — ${clerkName}`, "success");
        }}
      />

      <StudentCancelModal
        open={activeModal === "studentCancel"}
        onClose={closeModal}
        booking={cancelTarget}
        onConfirm={() => {
          if (!cancelTarget) return;
          setBookings(prev => prev.map(b =>
            b.id === cancelTarget.id ? { ...b, status: "cancelled" } : b
          ));
          setCancelTarget(null);
          toast("Időpont lemondva.", "info");
        }}
      />

      <ClerkConfirmModal
        open={activeModal === "clerkConfirm"}
        onClose={closeModal}
        booking={targetBooking}
        onAccept={() => {
          if (!targetBooking) return;
          setBookings(prev => prev.map(b =>
            b.id === targetBooking.id
              ? { ...b, status: "confirmed", clerk: user.name }
              : b
          ));
          toast("Foglalás elfogadva és megerősítve.", "success");
        }}
        onReject={(reason) => {
          if (!targetBooking) return;
          setBookings(prev => prev.map(b =>
            b.id === targetBooking.id
              ? { ...b, status: "cancelled", rejectionReason: reason }
              : b
          ));
          toast("Foglalás elutasítva.", "error");
        }}
      />

      <RejectionDetailModal
        open={activeModal === "rejectionDetail"}
        onClose={closeModal}
        booking={rejectionTarget}
      />

      <AdminAddClerkModal
        open={activeModal === "adminAddClerk"}
        onClose={closeModal}
        onSave={({ name, neptun }) => {
          setClerks(prev => [...prev, { id: String(Date.now()), name, neptun, active: true }]);
          toast(`${name} hozzáadva ügyintézőként.`, "success");
        }}
      />

      <AdminAddCaseModal
        open={activeModal === "adminAddCase"}
        onClose={closeModal}
        clerks={clerks}
        onSave={({ name, duration }) => {
          setCases(prev => [...prev, { id: String(Date.now()), name, duration }]);
          toast(`„${name}" ügytípus rögzítve.`, "success");
        }}
      />

      {/* Toast container */}
      <div className="fixed bottom-5 right-5 flex flex-col gap-2 z-[100]">
        {toasts.map(t => (
          <Toast
            key={t.id}
            message={t.message}
            type={t.type}
            onDone={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
          />
        ))}
      </div>
    </div>
  );
}
