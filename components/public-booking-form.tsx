"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, rpc } from "@/lib/supabase";
import type { Business } from "@/lib/types";

export function PublicBookingForm() {
  const params = useParams<{ slug: string }>();
  const slug = decodeURIComponent(params.slug ?? "");
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [bookingCode, setBookingCode] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [product, setProduct] = useState("Custom T-shirts");
  const [quantity, setQuantity] = useState("1");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const timezone = business?.timezone ?? "Asia/Kolkata";
  const dateInTimezone = (value: Date) => {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
    const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
    return part("year") + "-" + part("month") + "-" + part("day");
  };
  const dateTimeToIso = (day: string, hour: string) => {
    const desiredUtc = Date.parse(day + "T" + hour + ":00Z");
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(desiredUtc));
    const part = (type: string) => Number(parts.find((item) => item.type === type)?.value ?? 0);
    const shownAsUtc = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
    return new Date(desiredUtc - (shownAsUtc - desiredUtc)).toISOString();
  };
  const minDate = dateInTimezone(new Date());

  useEffect(() => {
    let alive = true;
    api("businesses?select=id,name,slug,currency,timezone,public_bookings_enabled&slug=eq." + encodeURIComponent(slug) + "&public_bookings_enabled=eq.true&limit=1", {}, false)
      .then((rows) => { if (alive) setBusiness((rows as Business[])[0] ?? null); })
      .catch((cause) => { if (alive) setError(cause instanceof Error ? cause.message : "Could not load this booking page."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [slug]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!date || !time) throw new Error("Choose a date and time for your request.");
      const scheduledFor = dateTimeToIso(date, time);
      const result = await rpc<{ booking_code: string }>("create_public_booking", {
        p_slug: slug,
        p_customer_name: name.trim(),
        p_customer_phone: phone.trim(),
        p_customer_email: email.trim() || null,
        p_product_type: product,
        p_quantity: Number(quantity),
        p_design_notes: notes.trim() || null,
        p_scheduled_for: scheduledFor,
      }, false);
      const created = Array.isArray(result) ? result[0] : result;
      setBookingCode((created as { booking_code?: string })?.booking_code ?? "received");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not send your request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="booking-page">
      <div className="booking-shell">
        <header className="booking-header"><Link className="brand-lockup" href="/"><span className="brand-mark">P</span><span>printdesk</span></Link><span className="secure-note"><i /> PRIVATE BOOKING FORM</span></header>
        {loading ? <div className="booking-state"><span className="spinner" /> Loading booking page…</div> : !business ? <div className="booking-state booking-unavailable"><div className="empty-icon">↗</div><h1>Booking page unavailable</h1><p>This studio may have paused new bookings or changed its booking link.</p><Link href="/" className="button button-dark">Go to Print Desk</Link></div> : bookingCode ? (
          <div className="booking-success"><div className="success-mark">✓</div><p className="auth-kicker">REQUEST RECEIVED</p><h1>Thanks, {name.split(" ")[0]}.</h1><p>Your request is with <b>{business.name}</b>. The studio will confirm your time and quote with you directly.</p><div className="booking-code"><span>REQUEST REFERENCE</span><b>{bookingCode}</b></div><div className="success-next"><span>01</span><p><b>We’ll review the details</b><small>Your requested slot is not confirmed until the studio replies.</small></p></div><div className="success-next"><span>02</span><p><b>Confirm the quote with the team</b><small>Payment is handled directly with the studio by cash, UPI, or bank transfer.</small></p></div><Link href="/" className="text-button">Made with Print Desk ↗</Link></div>
        ) : (
          <div className="booking-layout">
            <aside className="booking-intro"><span className="eyebrow"><span className="eyebrow-dot" /> CUSTOM PRINT ORDER</span><h1>Let’s make<br />something <em>yours.</em></h1><p>Tell us what you have in mind. We’ll get back to confirm the slot and share a quote.</p><div className="studio-pill"><span className="studio-avatar">{business.name.slice(0, 1).toUpperCase()}</span><span><small>BOOKING WITH</small><b>{business.name}</b></span><span className="verified">✓</span></div><div className="booking-benefit"><span>✳</span><p>Custom printed tees, hoodies, uniforms & more</p></div><div className="booking-benefit"><span>◷</span><p>Pick a time that works for you</p></div><div className="booking-note">Your time is a request. The studio will confirm availability before your order is locked in.</div></aside>
            <section className="booking-form-card">
              <div className="booking-form-head"><div><p className="auth-kicker">NEW REQUEST</p><h2>Order details</h2></div><span className="step-badge">01 <i /> 02</span></div>
              <form className="stack-form" onSubmit={submit}>
                <div className="form-section-title"><span>01</span><b>Your details</b></div>
                <div className="form-grid"><label className="field-span">Full name<input required maxLength={100} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name for the order" /></label><label>Phone number<input required type="tel" maxLength={24} autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" /></label><label>Email <small>(optional)</small><input type="email" maxLength={254} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label></div>
                <div className="form-section-title"><span>02</span><b>What would you like printed?</b></div>
                <div className="form-grid"><label>Product<select value={product} onChange={(e) => setProduct(e.target.value)}><option>Custom T-shirts</option><option>Hoodies & sweatshirts</option><option>Team uniforms</option><option>Tote bags</option><option>Other custom print</option></select></label><label>Quantity<input required type="number" min="1" max="10000" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label><label className="field-span">Design, size & colour notes <small>(optional)</small><textarea rows={3} maxLength={1200} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Share the idea, sizes, colours, or anything else we should know." /></label></div>
                <div className="form-section-title"><span>03</span><b>Preferred time</b></div>
              <div className="form-grid"><label>Date<input required type="date" min={minDate} value={date} onChange={(e) => setDate(e.target.value)} /></label><label>Time · {timezone}<input required type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label></div>
                {error && <div className="form-alert form-alert-error">{error}</div>}
                <button className="button button-primary button-wide booking-submit" disabled={busy}>{busy ? "Sending your request…" : "Send booking request  →"}</button>
                <p className="privacy-copy">By sending this request, you agree that the studio may contact you about this order.</p>
              </form>
            </section>
          </div>
        )}
        <footer className="booking-footer"><span>© {new Date().getFullYear()} Print Desk</span><span>Simple bookings for creative businesses</span></footer>
      </div>
    </main>
  );
}
