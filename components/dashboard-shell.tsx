"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, apiAll, readSession, rpc, signOut, signInRedirect } from "@/lib/supabase";
import { Booking, Business, BookingStatus, Payment, PaymentMethod, Role, STATUS_LABELS, PAYMENT_LABELS } from "@/lib/types";

type Tab = "overview" | "bookings" | "schedule" | "payments" | "settings";
type MembershipRow = { role: Role; business_id: string; businesses: Business | Business[] };
const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "⌂" },
  { id: "bookings", label: "Bookings", icon: "▦" },
  { id: "schedule", label: "Schedule", icon: "◷" },
  { id: "payments", label: "Payments", icon: "₹" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

function localDateValue(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function dateInTimezone(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return part("year") + "-" + part("month") + "-" + part("day");
}

function studioDateTimeToIso(date: string, time: string, timezone: string) {
  const desiredUtc = Date.parse(date + "T" + time + ":00Z");
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(desiredUtc));
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value ?? 0);
  const displayedAsUtc = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
  const offset = displayedAsUtc - desiredUtc;
  return new Date(desiredUtc - offset).toISOString();
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function prettyDate(value: string, timezone: string, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", ...options, timeZone: timezone }).format(new Date(value));
}

function prettyTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: timezone }).format(new Date(value));
}

function balanceFor(booking: Booking, payments: Payment[]) {
  const paid = payments.filter((entry) => entry.booking_id === booking.id).reduce((sum, entry) => sum + Number(entry.amount), 0);
  return Math.max(0, Number(booking.quoted_total) - paid);
}

function initials(value: string) {
  return value.trim().split(/\s+/).slice(0, 2).map((part) => part.slice(0, 1)).join("").toUpperCase() || "?";
}

export function DashboardShell() {
  const [tab, setTab] = useState<Tab>("overview");
  const [userEmail, setUserEmail] = useState("");
  const [business, setBusiness] = useState<Business | null>(null);
  const [role, setRole] = useState<Role>("staff");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [members, setMembers] = useState<{ email: string; role: Role; created_at: string }[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [scheduleDay, setScheduleDay] = useState(localDateValue());
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [modal, setModal] = useState<"new" | "payment" | null>(null);
  const [toast, setToast] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newProduct, setNewProduct] = useState("Custom T-shirts");
  const [newQuantity, setNewQuantity] = useState("1");
  const [newDate, setNewDate] = useState(localDateValue());
  const [newTime, setNewTime] = useState("10:00");
  const [newNotes, setNewNotes] = useState("");
  const [paymentBookingId, setPaymentBookingId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("upi");
  const [paymentReference, setPaymentReference] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessCurrency, setBusinessCurrency] = useState("INR");
  const [businessTimezone, setBusinessTimezone] = useState("Asia/Kolkata");
  const [publicEnabled, setPublicEnabled] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [setupName, setSetupName] = useState("");
  const [setupSlug, setSetupSlug] = useState("");
  const [working, setWorking] = useState(false);
  const businessRef = useRef<Business | null>(null);

  const refreshRecords = useCallback(async (currentBusiness: Business) => {
    const [bookingRows, paymentRows, memberRows] = await Promise.all([
      apiAll<Booking>("bookings?select=*&business_id=eq." + currentBusiness.id + "&order=scheduled_for.asc"),
      apiAll<Payment>("payments?select=id,business_id,booking_id,amount,method,reference,paid_at,created_at,booking:bookings(booking_code,customer_name)&business_id=eq." + currentBusiness.id + "&order=paid_at.desc"),
      api("business_members?select=email,role,created_at&business_id=eq." + currentBusiness.id + "&order=created_at.asc") as Promise<{ email: string; role: Role; created_at: string }[]>,
    ]);
    setBookings(bookingRows);
    setPayments(paymentRows);
    setMembers(memberRows);
    setActiveBooking((current) => current ? bookingRows.find((booking) => booking.id === current.id) ?? current : null);
  }, []);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    const session = readSession();
    if (!session) {
      signInRedirect();
      return;
    }
    setUserEmail(session.user.email ?? "");
    try {
      const membershipRows = await api("business_members?select=role,business_id,businesses(id,name,slug,currency,timezone,public_bookings_enabled)&user_id=eq." + encodeURIComponent(session.user.id) + "&limit=1") as MembershipRow[];
      const row = membershipRows[0];
      if (!row) {
        businessRef.current = null;
        setBusiness(null);
        return;
      }
      const currentBusiness = Array.isArray(row.businesses) ? row.businesses[0] : row.businesses;
      if (!currentBusiness) throw new Error("Your studio workspace could not be loaded.");
      businessRef.current = currentBusiness;
      setRole(row.role);
      setBusiness(currentBusiness);
      setBusinessName(currentBusiness.name);
      setBusinessCurrency(currentBusiness.currency);
      setBusinessTimezone(currentBusiness.timezone);
      setPublicEnabled(currentBusiness.public_bookings_enabled);
      setSetupName(currentBusiness.name);
      setSetupSlug(currentBusiness.slug);
      setScheduleDay(dateInTimezone(new Date(), currentBusiness.timezone));
      setNewDate(dateInTimezone(new Date(), currentBusiness.timezone));
      await refreshRecords(currentBusiness);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not load the workspace.");
    } finally {
      setBusy(false);
    }
  }, [refreshRecords]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const currentBusiness = businessRef.current;
      if (currentBusiness) void refreshRecords(currentBusiness).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not sync recent updates."));
    }, 20000);
    return () => window.clearInterval(timer);
  }, [refreshRecords]);
  useEffect(() => {
    const onStorage = () => { if (!readSession()) signInRedirect(); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const currency = business?.currency ?? "INR";
  const timezone = business?.timezone ?? "Asia/Kolkata";
  const today = dateInTimezone(new Date(), timezone);
  const todaysBookings = bookings.filter((booking) => dateInTimezone(new Date(booking.scheduled_for), timezone) === today && booking.status !== "cancelled");
  const openBookings = bookings.filter((booking) => !["completed", "cancelled"].includes(booking.status));
  const outstanding = bookings.reduce((sum, booking) => sum + balanceFor(booking, payments), 0);
  const pendingCount = bookings.filter((booking) => booking.status === "new").length;
  const filteredBookings = useMemo(() => bookings.filter((booking) => {
    const matchesSearch = (booking.customer_name + " " + booking.customer_phone + " " + booking.booking_code + " " + booking.product_type).toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (statusFilter === "all" || booking.status === statusFilter);
  }), [bookings, search, statusFilter]);
  const scheduledBookings = bookings.filter((booking) => dateInTimezone(new Date(booking.scheduled_for), timezone) === scheduleDay && booking.status !== "cancelled").sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for));

  async function runAction(action: () => Promise<void>, success?: string) {
    setWorking(true);
    setError("");
    try {
      await action();
      if (success) setToast(success);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That action could not be completed.");
    } finally {
      setWorking(false);
    }
  }

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(async () => {
      await rpc("create_business", { p_name: setupName.trim(), p_slug: setupSlug });
      await load();
    }, "Your workspace is ready.");
  }

  async function addBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!business) return;
    await runAction(async () => {
      const scheduledFor = studioDateTimeToIso(newDate, newTime, business?.timezone ?? "Asia/Kolkata");
      await api("bookings?select=id", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          business_id: business.id,
          customer_name: newName.trim(),
          customer_phone: newPhone.trim(),
          product_type: newProduct,
          quantity: Number(newQuantity),
          design_notes: newNotes.trim() || null,
          scheduled_for: scheduledFor,
          status: "confirmed",
          quoted_total: 0,
        }),
      });
      setModal(null);
      setNewName(""); setNewPhone(""); setNewNotes("");
    }, "Booking added to the schedule.");
  }

  async function saveBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeBooking || !business) return;
    const form = new FormData(event.currentTarget);
    await runAction(async () => {
      await api("bookings?id=eq." + activeBooking.id + "&business_id=eq." + business.id, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: form.get("status"), quoted_total: Number(form.get("quoted_total")), updated_at: new Date().toISOString() }),
      });
      setActiveBooking(null);
    }, "Booking updated.");
  }

  async function addPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paymentBookingId) return;
    await runAction(async () => {
      await rpc("record_manual_payment", {
        p_booking_id: paymentBookingId,
        p_amount: Number(paymentAmount),
        p_method: paymentMethod,
        p_reference: paymentReference.trim() || null,
        p_paid_at: new Date().toISOString(),
      });
      setModal(null);
      setPaymentAmount(""); setPaymentReference("");
    }, "Payment recorded.");
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!business) return;
    await runAction(async () => {
      await api("businesses?id=eq." + business.id, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ name: businessName.trim(), currency: businessCurrency, timezone: businessTimezone, public_bookings_enabled: publicEnabled }),
      });
    }, "Settings saved.");
  }

  async function inviteStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!business) return;
    await runAction(async () => {
      const rows = await api("staff_invites?select=invite_token", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ business_id: business.id, email: inviteEmail.trim().toLowerCase() }),
      }) as { invite_token: string }[];
      const token = rows[0]?.invite_token;
      if (!token) throw new Error("The invite was created but its link was not returned.");
      setInviteLink(window.location.origin + "/login?invite=" + token);
      setInviteEmail("");
    }, "Team invite created.");
  }

  function copyInvite() {
    if (!inviteLink) return;
    void navigator.clipboard.writeText(inviteLink).then(() => setToast("Invite link copied."));
  }

  async function logout() {
    await signOut();
    window.location.assign("/login");
  }

  if (busy && !business) {
    return <div className="dashboard-loading"><span className="spinner" /><span>Opening your workspace…</span></div>;
  }

  if (!business && !busy) {
    return <main className="onboarding-page"><Link className="brand-lockup" href="/"><span className="brand-mark">P</span><span>printdesk</span></Link><section className="onboarding-card"><div className="auth-icon">✳</div><p className="auth-kicker">ONE LAST STEP</p><h1>Set up your print studio</h1><p className="auth-subtitle">Create a shared workspace for your bookings, team, and payment records.</p><form className="stack-form" onSubmit={createWorkspace}><label>Studio name<input required maxLength={80} value={setupName} onChange={(e) => { setSetupName(e.target.value); setSetupSlug(e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} placeholder="e.g. Sunday Print Co." /></label><label>Your public booking link<input required maxLength={48} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={setupSlug} onChange={(e) => setSetupSlug(e.target.value.toLowerCase())} placeholder="sunday-print-co" /><small>printdesk.app/book/{setupSlug || "your-studio"}</small></label>{error && <div className="form-alert form-alert-error">{error}</div>}<button className="button button-primary button-wide" disabled={working}>{working ? "Creating…" : "Create workspace →"}</button></form></section></main>;
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand-lockup" href="/"><span className="brand-mark">P</span><span>printdesk</span></Link>
        <div className="workspace-switch"><span className="workspace-badge">{business?.name.slice(0, 1).toUpperCase()}</span><span className="workspace-name"><b>{business?.name}</b><small>Print studio</small></span><span className="workspace-chevron">⌄</span></div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="side-nav">{tabs.map((item) => <button key={item.id} className={tab === item.id ? "nav-item nav-selected" : "nav-item"} onClick={() => setTab(item.id)}><span className="nav-icon">{item.icon}</span>{item.label}{item.id === "bookings" && pendingCount > 0 && <i className="nav-count">{pendingCount}</i>}</button>)}</nav>
        <div className="sidebar-promo"><div className="promo-spark">✳</div><b>Your next great print<br />starts with a booking.</b><Link href={"/book/" + business?.slug} target="_blank">Preview booking page ↗</Link></div>
        <button className="sidebar-profile" onClick={logout}><span className="profile-avatar">{initials(userEmail)}</span><span><b>{userEmail.split("@")[0] || "Your account"}</b><small>{role === "owner" ? "Studio owner" : "Team member"}</small></span><span className="profile-more">↗</span></button>
      </aside>
      <section className="main-panel">
        <header className="topbar"><div className="mobile-brand"><span className="brand-mark">P</span><b>printdesk</b></div><div className="breadcrumbs"><span>{business?.name}</span><i>/</i><b>{tabs.find((item) => item.id === tab)?.label}</b></div><div className="topbar-actions"><span className="sync-status"><i /> Team sync on</span><a className="live-link" href={"/book/" + business?.slug} target="_blank" rel="noreferrer"><span /> Booking page <span aria-hidden="true">↗</span></a><button className="topbar-avatar" onClick={logout} title="Sign out">{initials(userEmail)}</button></div></header>
        <div className="mobile-tabs">{tabs.map((item) => <button key={item.id} className={tab === item.id ? "mobile-tab active" : "mobile-tab"} onClick={() => setTab(item.id)}><span>{item.icon}</span>{item.label}</button>)}</div>
        <div className="page-content">
          {error && <div className="global-alert"><span>!</span>{error}<button onClick={() => setError("")}>×</button></div>}
          {tab === "overview" && <Overview business={business!} bookings={bookings} payments={payments} outstanding={outstanding} pendingCount={pendingCount} todaysBookings={todaysBookings} onNew={() => setModal("new")} onOpen={setActiveBooking} onTab={setTab} currency={currency} />}
          {tab === "bookings" && <BookingsPage bookings={filteredBookings} allCount={bookings.length} search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} onNew={() => setModal("new")} onOpen={setActiveBooking} onCollect={(booking) => { setPaymentBookingId(booking.id); setPaymentAmount(String(balanceFor(booking, payments))); setModal("payment"); }} payments={payments} currency={currency} timezone={business?.timezone ?? "Asia/Kolkata"} />}
          {tab === "schedule" && <SchedulePage day={scheduleDay} setDay={setScheduleDay} bookings={scheduledBookings} onOpen={setActiveBooking} onNew={() => setModal("new")} timezone={business?.timezone ?? "Asia/Kolkata"} />}
          {tab === "payments" && <PaymentsPage payments={payments} bookings={bookings} outstanding={outstanding} currency={currency} timezone={business?.timezone ?? "Asia/Kolkata"} onNew={() => { const first = bookings.find((booking) => balanceFor(booking, payments) > 0); setPaymentBookingId(first?.id ?? ""); setPaymentAmount(first ? String(balanceFor(first, payments)) : ""); setModal("payment"); }} />}
          {tab === "settings" && <SettingsPage business={business!} role={role} userEmail={userEmail} businessName={businessName} setBusinessName={setBusinessName} businessCurrency={businessCurrency} setBusinessCurrency={setBusinessCurrency} businessTimezone={businessTimezone} setBusinessTimezone={setBusinessTimezone} preferencesLocked={bookings.length > 0} publicEnabled={publicEnabled} setPublicEnabled={setPublicEnabled} onSave={saveSettings} members={members} inviteEmail={inviteEmail} setInviteEmail={setInviteEmail} inviteLink={inviteLink} onInvite={inviteStaff} onCopy={copyInvite} />}
        </div>
      </section>
      {modal === "new" && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}><section className="modal-card"><button className="modal-close" onClick={() => setModal(null)} aria-label="Close">×</button><p className="auth-kicker">ADD TO THE WORKSHOP</p><h2>New booking</h2><p className="modal-subtitle">Add a customer order and preferred production slot.</p><form className="stack-form" onSubmit={addBooking}><label>Customer name<input required maxLength={100} value={newName} onChange={(e) => setNewName(e.target.value)} /></label><label>Phone number<input required type="tel" maxLength={24} value={newPhone} onChange={(e) => setNewPhone(e.target.value)} /></label><div className="form-grid"><label>Product<select value={newProduct} onChange={(e) => setNewProduct(e.target.value)}><option>Custom T-shirts</option><option>Hoodies & sweatshirts</option><option>Team uniforms</option><option>Tote bags</option><option>Other custom print</option></select></label><label>Quantity<input required type="number" min="1" max="10000" value={newQuantity} onChange={(e) => setNewQuantity(e.target.value)} /></label><label>Date<input required type="date" min={today} value={newDate} onChange={(e) => setNewDate(e.target.value)} /></label><label>Time<input required type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} /></label></div><label>Design / order notes<textarea rows={3} maxLength={1200} value={newNotes} onChange={(e) => setNewNotes(e.target.value)} /></label><div className="modal-actions"><button type="button" className="button button-light" onClick={() => setModal(null)}>Cancel</button><button className="button button-primary" disabled={working}>{working ? "Saving…" : "Add booking →"}</button></div></form></section></div>}
      {modal === "payment" && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}><section className="modal-card"><button className="modal-close" onClick={() => setModal(null)} aria-label="Close">×</button><p className="auth-kicker">MANUAL PAYMENT ENTRY</p><h2>Record a payment</h2><p className="modal-subtitle">Log cash, UPI, or a bank transfer already received by the studio.</p><form className="stack-form" onSubmit={addPayment}><label>Booking<select required value={paymentBookingId} onChange={(e) => { const target = bookings.find((booking) => booking.id === e.target.value); setPaymentBookingId(e.target.value); if (target) setPaymentAmount(String(balanceFor(target, payments))); }}><option value="">Choose an open balance</option>{bookings.filter((booking) => balanceFor(booking, payments) > 0 && booking.status !== "cancelled").map((booking) => <option key={booking.id} value={booking.id}>{booking.booking_code} · {booking.customer_name} · due {formatMoney(balanceFor(booking, payments), currency)}</option>)}</select></label><div className="form-grid"><label>Amount ({currency})<input required type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} /></label><label>Method<select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}><option value="upi">UPI</option><option value="cash">Cash</option><option value="bank">Bank transfer</option></select></label></div><label>Reference / note <small>(optional)</small><input maxLength={160} value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="UPI reference, receipt note, etc." /></label><div className="payment-security-note"><span>✓</span> This only records a payment you have already received. No money is collected here.</div><div className="modal-actions"><button type="button" className="button button-light" onClick={() => setModal(null)}>Cancel</button><button className="button button-primary" disabled={working || !paymentBookingId}>{working ? "Recording…" : "Save payment →"}</button></div></form></section></div>}
      {activeBooking && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveBooking(null); }}><section className="modal-card"><button className="modal-close" onClick={() => setActiveBooking(null)} aria-label="Close">×</button><p className="auth-kicker">BOOKING {activeBooking.booking_code}</p><h2>{activeBooking.customer_name}</h2><p className="modal-subtitle">{activeBooking.product_type} · {activeBooking.quantity} pcs · {activeBooking.customer_phone}</p><div className="booking-detail-note"><b>Design / order notes</b><p>{activeBooking.design_notes || "No additional notes."}</p><span>{prettyDate(activeBooking.scheduled_for, business?.timezone ?? "Asia/Kolkata", { weekday: "long", year: "numeric" })} · {prettyTime(activeBooking.scheduled_for, business?.timezone ?? "Asia/Kolkata")}</span></div><form className="stack-form" onSubmit={saveBooking}><div className="form-grid"><label>Order status<select name="status" defaultValue={activeBooking.status}>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Quoted total ({currency})<input name="quoted_total" type="number" required min="0" step="0.01" defaultValue={activeBooking.quoted_total} /></label></div><div className="payment-security-note"><span>₹</span> Balance due: <b>{formatMoney(balanceFor(activeBooking, payments), currency)}</b></div><div className="modal-actions"><button type="button" className="button button-light" onClick={() => setActiveBooking(null)}>Close</button><button className="button button-primary" disabled={working}>{working ? "Saving…" : "Save changes →"}</button></div></form></section></div>}
      {toast && <div className="toast"><span>✓</span>{toast}</div>}
    </main>
  );
}

function PageHeading({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return <div className="page-heading"><div><p className="auth-kicker">{eyebrow}</p><h1>{title}</h1></div>{children}</div>;
}

function Overview({ business, bookings, payments, outstanding, pendingCount, todaysBookings, onNew, onOpen, onTab, currency }: { business: Business; bookings: Booking[]; payments: Payment[]; outstanding: number; pendingCount: number; todaysBookings: Booking[]; onNew: () => void; onOpen: (booking: Booking) => void; onTab: (tab: Tab) => void; currency: string }) {
  const nextUp = bookings.filter((booking) => new Date(booking.scheduled_for) >= new Date() && !["cancelled", "completed"].includes(booking.status)).sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for)).slice(0, 5);
  const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  return <><PageHeading eyebrow={new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" }).format(new Date()).toUpperCase()} title={<>Good morning, team <span className="heading-spark">✳</span></>}><button className="button button-primary" onClick={onNew}>＋ New booking</button></PageHeading><div className="welcome-strip"><div><span className="welcome-icon">✳</span><p><b>{business.name}</b><small>Your print desk is ready for the next great order.</small></p></div><Link href={"/book/" + business.slug} target="_blank">Share booking page ↗</Link></div><div className="metric-grid"><Metric icon="✳" label="New requests" value={String(pendingCount).padStart(2, "0")} note={pendingCount ? "Need your review" : "You're all caught up"} tone="peach" onClick={() => onTab("bookings")} /><Metric icon="▦" label="Open orders" value={String(bookings.filter((booking) => !["completed", "cancelled"].includes(booking.status)).length).padStart(2, "0")} note="Across production stages" tone="lavender" onClick={() => onTab("bookings")} /><Metric icon="◷" label="Today's schedule" value={String(todaysBookings.length).padStart(2, "0")} note={todaysBookings.length ? "Bookings on the calendar" : "No bookings today"} tone="mint" onClick={() => onTab("schedule")} /><Metric icon="₹" label="Outstanding" value={formatMoney(outstanding, currency)} note="Remaining customer balances" tone="yellow" onClick={() => onTab("payments")} /></div><div className="dashboard-columns"><section className="panel-card schedule-card"><div className="panel-heading"><div><p className="auth-kicker">UP NEXT</p><h2>On the schedule</h2></div><button className="link-button" onClick={() => onTab("schedule")}>Full schedule ↗</button></div>{nextUp.length ? <div className="schedule-list">{nextUp.map((booking) => <button className="schedule-row" key={booking.id} onClick={() => onOpen(booking)}><span className="schedule-date"><b>{prettyDate(booking.scheduled_for, business.timezone, { day: "2-digit" })}</b><small>{prettyDate(booking.scheduled_for, business.timezone, { month: "short" })}</small></span><span className="schedule-time">{prettyTime(booking.scheduled_for, business.timezone)}</span><span className="customer-avatar">{initials(booking.customer_name)}</span><span className="schedule-customer"><b>{booking.customer_name}</b><small>{booking.product_type} · {booking.quantity} pcs</small></span><span className={"status-pill status-" + booking.status}>{STATUS_LABELS[booking.status]}</span><span className="row-arrow">↗</span></button>)}</div> : <EmptyState title="Your schedule is clear" note="New bookings will show here as soon as they arrive." />}<div className="panel-footer"><span><i className="sync-dot" /> {bookings.length} bookings in your studio</span><button onClick={() => onTab("bookings")}>Manage bookings →</button></div></section><section className="panel-card snapshot-card"><div className="panel-heading"><div><p className="auth-kicker">PAYMENT SNAPSHOT</p><h2>Money, marked clearly.</h2></div><span className="snapshot-mark">₹</span></div><div className="snapshot-total"><span>Recorded payments</span><b>{formatMoney(totalPaid, currency)}</b><small>Manual entries from your team</small></div><div className="snapshot-rule" /><div className="snapshot-line"><span><i className="legend-paid" /> Collected</span><b>{formatMoney(totalPaid, currency)}</b></div><div className="snapshot-line"><span><i className="legend-due" /> Still due</span><b>{formatMoney(outstanding, currency)}</b></div><button className="button button-dark button-wide snapshot-button" onClick={() => onTab("payments")}>Open payment ledger <span>→</span></button></section></div><div className="bottom-tip"><span>✳</span><p><b>One shared view for the whole team.</b> Bookings and payment updates sync to everyone in your studio.</p><span className="tip-right">PRINT DESK</span></div></>;
}

function Metric({ icon, label, value, note, tone, onClick }: { icon: string; label: string; value: string; note: string; tone: string; onClick: () => void }) {
  return <button className={"metric-card metric-" + tone} onClick={onClick}><div className="metric-head"><span>{label}</span><i>{icon}</i></div><strong>{value}</strong><small><span>↗</span> {note}</small></button>;
}

function BookingsPage({ bookings, allCount, search, setSearch, statusFilter, setStatusFilter, onNew, onOpen, onCollect, payments, currency, timezone }: { bookings: Booking[]; allCount: number; search: string; setSearch: (v: string) => void; statusFilter: string; setStatusFilter: (v: string) => void; onNew: () => void; onOpen: (booking: Booking) => void; onCollect: (booking: Booking) => void; payments: Payment[]; currency: string; timezone: string }) {
  return <><PageHeading eyebrow="YOUR CUSTOMER ORDERS" title="Bookings"><button className="button button-primary" onClick={onNew}>＋ New booking</button></PageHeading><section className="panel-card table-card"><div className="table-toolbar"><div><h2>All bookings <span className="count-badge">{allCount}</span></h2><p>Every customer request and production order in one list.</p></div><div className="table-filters"><label className="search-box"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search orders…" /></label><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">All statuses</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></div>{bookings.length ? <div className="booking-table-wrap"><table className="booking-table"><thead><tr><th>ORDER</th><th>CUSTOMER</th><th>PRODUCT</th><th>DATE & TIME</th><th>STATUS</th><th>BALANCE</th><th /></tr></thead><tbody>{bookings.map((booking) => <tr key={booking.id}><td><button className="order-code" onClick={() => onOpen(booking)}>{booking.booking_code}</button><small>{booking.quantity} pcs</small></td><td><div className="table-customer"><span className="customer-avatar">{initials(booking.customer_name)}</span><span><b>{booking.customer_name}</b><small>{booking.customer_phone}</small></span></div></td><td>{booking.product_type}</td><td><b>{prettyDate(booking.scheduled_for, timezone, { day: "numeric", month: "short" })}</b><small>{prettyTime(booking.scheduled_for, timezone)}</small></td><td><span className={"status-pill status-" + booking.status}>{STATUS_LABELS[booking.status]}</span></td><td><b>{formatMoney(balanceFor(booking, payments), currency)}</b>{balanceFor(booking, payments) > 0 && Number(booking.quoted_total) > 0 && <small>due</small>}</td><td><button className="row-menu" title="Edit booking" onClick={() => onOpen(booking)}>•••</button></td></tr>)}</tbody></table></div> : <EmptyState title={search || statusFilter !== "all" ? "No matching bookings" : "Your first booking goes here"} note={search || statusFilter !== "all" ? "Try a different search or status." : "Add an order here or share your public booking link with customers."} />}</section></>;
}

function SchedulePage({ day, setDay, bookings, onOpen, onNew, timezone }: { day: string; setDay: (v: string) => void; bookings: Booking[]; onOpen: (booking: Booking) => void; onNew: () => void; timezone: string }) {
  return <><PageHeading eyebrow="PLAN THE WORKDAY" title="Schedule"><button className="button button-primary" onClick={onNew}>＋ New booking</button></PageHeading><section className="panel-card schedule-page-card"><div className="schedule-date-control"><div><p className="auth-kicker">DAY VIEW</p><h2>{day === localDateValue() ? "Today’s bookings" : prettyDate(day + "T12:00:00", timezone, { weekday: "long", year: "numeric" })}</h2></div><label className="date-picker"><span>◷</span><input type="date" value={day} onChange={(e) => setDay(e.target.value)} /></label></div>{bookings.length ? <div className="timeline">{bookings.map((booking, index) => <button key={booking.id} className="timeline-row" onClick={() => onOpen(booking)}><span className="timeline-time">{prettyTime(booking.scheduled_for, timezone)}</span><span className="timeline-track"><i className={index === 0 ? "timeline-dot dot-active" : "timeline-dot"} /><i className="timeline-line" /></span><span className="timeline-content"><span className="customer-avatar">{initials(booking.customer_name)}</span><span className="timeline-info"><b>{booking.customer_name}</b><small>{booking.product_type} · {booking.quantity} pcs · {booking.customer_phone}</small>{booking.design_notes && <em>{booking.design_notes}</em>}</span><span className={"status-pill status-" + booking.status}>{STATUS_LABELS[booking.status]}</span><span className="row-arrow">↗</span></span></button>)}</div> : <EmptyState title="Nothing on this date" note="Pick another day or add a booking to build your schedule." />}</section></>;
}

function PaymentsPage({ payments, bookings, outstanding, currency, timezone, onNew }: { payments: Payment[]; bookings: Booking[]; outstanding: number; currency: string; timezone: string; onNew: () => void }) {
  const collected = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const openBalances = bookings.filter((booking) => balanceFor(booking, payments) > 0 && Number(booking.quoted_total) > 0).length;
  return <><PageHeading eyebrow="MANUAL PAYMENT TRACKER" title="Payments"><button className="button button-primary" onClick={onNew}>＋ Record payment</button></PageHeading><div className="payment-metrics"><div className="payment-metric"><span>Recorded this ledger</span><b>{formatMoney(collected, currency)}</b><small>Cash, UPI & bank transfers</small></div><div className="payment-metric due-metric"><span>Customer balances due</span><b>{formatMoney(outstanding, currency)}</b><small>{openBalances} orders with a balance</small></div><div className="payment-metric"><span>Payment entries</span><b>{payments.length}</b><small>All recorded transactions</small></div></div><section className="panel-card table-card"><div className="table-toolbar"><div><h2>Payment ledger <span className="count-badge">{payments.length}</span></h2><p>Manual records of payments received by your studio.</p></div></div>{payments.length ? <div className="payment-ledger">{payments.map((payment) => <div className="payment-ledger-row" key={payment.id}><div className={"payment-method-icon method-" + payment.method}>{payment.method === "cash" ? "₹" : payment.method === "upi" ? "↗" : "⇄"}</div><div className="payment-description"><b>{payment.booking?.customer_name ?? "Customer order"}</b><small>{payment.booking?.booking_code ?? "Booking"}{payment.reference ? " · " + payment.reference : ""}</small></div><span className={"method-tag method-tag-" + payment.method}>{PAYMENT_LABELS[payment.method]}</span><span className="payment-date">{prettyDate(payment.paid_at, timezone, { day: "numeric", month: "short", year: "numeric" })}</span><b className="payment-amount">+{formatMoney(Number(payment.amount), currency)}</b></div>)}</div> : <EmptyState title="No payment entries yet" note="Once you record a cash, UPI, or bank payment, it will appear in this ledger." />}</section><div className="ledger-note"><span>✓</span><p><b>Payment tracking only.</b> Print Desk records transactions your team has already received. It does not collect or process money.</p></div></>;
}

function SettingsPage({ business, role, userEmail, businessName, setBusinessName, businessCurrency, setBusinessCurrency, businessTimezone, setBusinessTimezone, preferencesLocked, publicEnabled, setPublicEnabled, onSave, members, inviteEmail, setInviteEmail, inviteLink, onInvite, onCopy }: { business: Business; role: Role; userEmail: string; businessName: string; setBusinessName: (v: string) => void; businessCurrency: string; setBusinessCurrency: (v: string) => void; businessTimezone: string; setBusinessTimezone: (v: string) => void; preferencesLocked: boolean; publicEnabled: boolean; setPublicEnabled: (v: boolean) => void; onSave: (event: FormEvent<HTMLFormElement>) => void; members: { email: string; role: Role; created_at: string }[]; inviteEmail: string; setInviteEmail: (v: string) => void; inviteLink: string; onInvite: (event: FormEvent<HTMLFormElement>) => void; onCopy: () => void }) {
  const url = typeof window === "undefined" ? "" : window.location.origin + "/book/" + business.slug;
  return <><PageHeading eyebrow="MAKE PRINT DESK YOURS" title="Studio settings" /><div className="settings-grid"><section className="panel-card settings-card"><div className="panel-heading"><div><p className="auth-kicker">PUBLIC BOOKING PAGE</p><h2>Your customer link</h2></div><span className="settings-icon">↗</span></div><p className="settings-copy">Share this with customers so they can send an order request from any device.</p><div className="share-link"><span>{url}</span><button type="button" onClick={() => void navigator.clipboard.writeText(url)}>Copy link</button></div><a className="preview-link" href={"/book/" + business.slug} target="_blank" rel="noreferrer">Preview booking page ↗</a><div className="settings-divider" /><form className="stack-form" onSubmit={onSave}><label>Studio name<input required maxLength={80} value={businessName} onChange={(e) => setBusinessName(e.target.value)} disabled={role !== "owner"} /></label><div className="form-grid"><label>Currency<select value={businessCurrency} onChange={(e) => setBusinessCurrency(e.target.value)} disabled={role !== "owner" || preferencesLocked}><option value="INR">INR · Indian rupee</option><option value="USD">USD · US dollar</option><option value="LKR">LKR · Sri Lankan rupee</option><option value="SGD">SGD · Singapore dollar</option><option value="AED">AED · UAE dirham</option><option value="GBP">GBP · Pound sterling</option><option value="EUR">EUR · Euro</option></select></label><label>Studio time zone<select value={businessTimezone} onChange={(e) => setBusinessTimezone(e.target.value)} disabled={role !== "owner" || preferencesLocked}><option value="Asia/Kolkata">India · Kolkata</option><option value="Asia/Colombo">Sri Lanka · Colombo</option><option value="Asia/Dubai">UAE · Dubai</option><option value="Asia/Singapore">Singapore</option><option value="Europe/London">UK · London</option><option value="Europe/Paris">Central Europe · Paris</option><option value="America/New_York">US · New York</option><option value="America/Los_Angeles">US · Los Angeles</option><option value="UTC">UTC</option></select></label></div><p className="settings-hint">{preferencesLocked ? "Currency and time zone are locked after the first booking to protect existing order totals and scheduled times." : "Choose these before your first booking. They can be changed until an order is added."}</p><label className="toggle-row"><span><b>Accept new requests</b><small>Customers can submit orders from your booking page.</small></span><input type="checkbox" checked={publicEnabled} onChange={(e) => setPublicEnabled(e.target.checked)} disabled={role !== "owner"} /><i /></label>{role === "owner" && <button className="button button-primary">Save studio settings →</button>}</form></section><section className="panel-card settings-card"><div className="panel-heading"><div><p className="auth-kicker">YOUR TEAM</p><h2>People with access</h2></div><span className="member-count">{members.length} <small>members</small></span></div><p className="settings-copy">Each person gets their own sign-in. Everyone sees the same live bookings and payment records.</p><div className="member-list">{members.map((member) => <div className="member-row" key={member.email}><span className="customer-avatar">{initials(member.email)}</span><span><b>{member.email}</b><small>{member.role === "owner" ? "Studio owner" : "Team member"}</small></span>{member.email === userEmail && <span className="you-tag">YOU</span>}</div>)}</div>{role === "owner" && <form className="invite-form" onSubmit={onInvite}><label>Invite a team member<input required type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="teammate@yourstudio.com" /></label><button className="button button-dark">Create invite link →</button></form>}{inviteLink && <div className="invite-result"><span>Invite ready</span><div><input readOnly value={inviteLink} /><button type="button" onClick={onCopy}>Copy</button></div><small>Send this link to the invited email address. It expires in 7 days.</small></div>}</section><section className="panel-card settings-card settings-wide"><div className="panel-heading"><div><p className="auth-kicker">PAYMENT PREFERENCES</p><h2>Track what you receive</h2></div><span className="settings-icon">₹</span></div><p className="settings-copy">Log cash, UPI, or bank transfers after the payment reaches your studio. Print Desk never asks for card details or bank credentials.</p><div className="payment-preference-chips"><span>₹ &nbsp;Cash</span><span>↗ &nbsp;UPI</span><span>⇄ &nbsp;Bank transfer</span></div><div className="settings-footnote">Workspace currency: <b>{business.currency}</b> · Schedule time zone: <b>{business.timezone}</b>.</div></section></div></>;
}

function EmptyState({ title, note }: { title: string; note: string }) {
  return <div className="empty-state"><span className="empty-icon">✳</span><b>{title}</b><p>{note}</p></div>;
}
