import Link from "next/link";

export default function Home() {
  return (
    <main className="landing">
      <nav className="landing-nav">
        <Link className="brand-lockup" href="/">
          <span className="brand-mark">P</span>
          <span>printdesk</span>
        </Link>
        <Link className="button button-dark button-small" href="/login">Staff sign in <span aria-hidden="true">↗</span></Link>
      </nav>
      <section className="landing-hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> YOUR PRINT STUDIO, IN SYNC</div>
          <h1>Every order.<br /><span>Right on schedule.</span></h1>
          <p>Take custom print bookings, keep production moving, and track every payment from one calm, clear workspace.</p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/login">Open your workspace <span aria-hidden="true">→</span></Link>
            <span className="hero-caption">Set up your studio in a few minutes</span>
          </div>
          <div className="hero-proof"><span className="proof-avatars"><i>R</i><i>M</i><i>A</i></span><span>Made for busy print teams</span><span className="proof-star">✳</span><span>Shared across devices</span></div>
        </div>
        <div className="hero-visual" aria-label="Preview of the booking and order dashboard">
          <div className="visual-glow" />
          <div className="preview-window">
            <div className="preview-top"><div className="preview-dots"><b /><b /><b /></div><span>Print Desk / Overview</span><span className="preview-user">DS</span></div>
            <div className="preview-body">
              <div className="preview-side"><div className="preview-logo">P</div><span className="side-active">▦</span><span>▣</span><span>◷</span><span>₹</span></div>
              <div className="preview-main">
                <div className="preview-greeting"><div><small>MONDAY, 14 JULY</small><h3>Good morning, team <span>✳</span></h3></div><button type="button">＋ New booking</button></div>
                <div className="preview-stats"><div><small>NEW REQUESTS</small><strong>08</strong><span className="stat-up">↗ 2 today</span></div><div><small>IN PRODUCTION</small><strong>14</strong><span className="stat-muted">Across 4 stages</span></div><div><small>TO COLLECT</small><strong>₹12,450</strong><span className="stat-warn">6 balances due</span></div></div>
                <div className="preview-orders"><div className="preview-orders-head"><b>Next on the schedule</b><span>View all →</span></div><div className="fake-order"><span className="fake-time">10:30</span><span className="fake-avatar coral">K</span><span className="fake-name"><b>Kavya R.</b><small>Custom tees · 24 pcs</small></span><span className="tag tag-violet">DESIGN REVIEW</span></div><div className="fake-order"><span className="fake-time">12:00</span><span className="fake-avatar lime">A</span><span className="fake-name"><b>Arun P.</b><small>Event hoodies · 12 pcs</small></span><span className="tag tag-green">CONFIRMED</span></div><div className="fake-order"><span className="fake-time">14:15</span><span className="fake-avatar blue">M</span><span className="fake-name"><b>Meera S.</b><small>Team jerseys · 18 pcs</small></span><span className="tag tag-orange">IN PRODUCTION</span></div></div>
                <div className="preview-footer"><span><i /> All team bookings synced</span><span>Last updated just now</span></div>
              </div>
            </div>
          </div>
          <div className="floating-note"><span>↗</span><div><b>Payment logged</b><small>₹2,400 · UPI</small></div><i>✓</i></div>
          <div className="floating-sticker">PRINT<br />WITH<br />PURPOSE <span>✳</span></div>
        </div>
      </section>
      <section className="landing-bottom">
        <span>BUILT FOR THE WAY YOUR STUDIO WORKS</span>
        <div><b>Bookings</b><i>✳</i><b>Production</b><i>✳</i><b>Payments</b><i>✳</i><b>Team sync</b></div>
      </section>
    </main>
  );
}
