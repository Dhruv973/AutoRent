import React, { useCallback, useEffect, useState } from 'react';
import { AuthActions, BrandMark } from './AuthNavigation.jsx';
import { supabase, supabaseConfigurationError } from './supabaseClient.js';

function formatDate(value) {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(year, month - 1, day));
}

function bookingDays(booking) {
  const [py, pm, pd] = booking.pickup_date.split('-').map(Number);
  const [ry, rm, rd] = booking.return_date.split('-').map(Number);
  return Math.round((Date.UTC(ry, rm - 1, rd) - Date.UTC(py, pm - 1, pd)) / 86400000);
}

function displayCategory(category = '') {
  return category.toLowerCase() === 'suv' ? 'SUV' : category ? `${category[0].toUpperCase()}${category.slice(1)}` : 'Vehicle';
}

function StatusPill({ status }) {
  return <span className={`booking-status booking-status-${status}`}>{status?.replaceAll('_', ' ') || 'Unknown'}</span>;
}

function DemoPaymentDialog({ booking, onClose, onPay, busy, result, error }) {
  const [method, setMethod] = useState('UPI');
  const vehicle = booking.vehicle;
  return (
    <div className="details-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="details-dialog demo-payment-dialog" role="dialog" aria-modal="true" aria-labelledby="demo-payment-title" aria-describedby="demo-payment-note">
        <button className="details-close" type="button" onClick={onClose} aria-label="Close demo payment" disabled={busy}>×</button>
        <div className="details-content">
          <p className="eyebrow">AUTORENT DEMO CHECKOUT</p>
          <h2 id="demo-payment-title">Pay for {vehicle?.name || 'your booking'}</h2>
          <p className="details-meta">Booking {booking.id}</p>
          <div className="demo-payment-summary"><span>Booking total from database</span><strong>₹{Number(booking.total_price).toLocaleString('en-IN')}</strong></div>
          <p className="demo-payment-date">{formatDate(booking.pickup_date)} – {formatDate(booking.return_date)} (return date exclusive)</p>
          {!result ? <fieldset className="demo-payment-methods"><legend>Choose a simulated method</legend>{['UPI', 'Card', 'Cash'].map((option) => <label className="demo-method-option" key={option}><input type="radio" name="demo-payment-method" value={option} checked={method === option} onChange={() => setMethod(option)} /><span><strong>{option}</strong><small>{option === 'Cash' ? 'Demo cash record' : `Simulated ${option}`}</small></span></label>)}</fieldset> : null}
          <p className="demo-payment-note" id="demo-payment-note">This is a classroom demo only. No card, UPI, or other payment credentials are collected, and no money is charged.</p>
          {error && <p className="booking-error" role="alert">{error}</p>}
          {result && <div className={`demo-payment-receipt demo-receipt-${result.payment?.payment_status || 'pending'}`} role="status" aria-live="polite">
            <p className="eyebrow">DEMO PAYMENT RECEIPT</p>
            <div className="demo-receipt-status"><span>Status</span><StatusPill status={result.payment?.payment_status || 'pending'} /></div>
            <dl><div><dt>Amount</dt><dd>₹{Number(result.payment?.amount ?? booking.total_price).toLocaleString('en-IN')}</dd></div><div><dt>Method</dt><dd>{result.payment?.payment_method || method}</dd></div><div><dt>Transaction ID</dt><dd className="demo-transaction-id">{result.payment?.transaction_id || 'Pending assignment'}</dd></div><div><dt>Booking ID</dt><dd className="demo-transaction-id">{booking.id}</dd></div></dl>
            <p>{result.payment?.payment_status === 'successful' ? 'Demo payment successful. No money was collected.' : result.payment?.payment_status === 'failed' ? 'Demo payment failed. No money was collected; you can try again.' : 'Demo payment is pending. No money was collected.'}</p>
          </div>}
          <div className="demo-payment-actions">
            {result ? <button type="button" className="button button-primary booking-submit" onClick={onClose}>Done</button> : <button type="button" className="button button-primary booking-submit" onClick={() => onPay(booking, method)} disabled={busy}>{busy ? 'Simulating…' : 'Simulate demo payment'}</button>}
            {!busy && !result && <button type="button" className="demo-payment-back" onClick={onClose}>Back to bookings</button>}
          </div>
        </div>
      </section>
    </div>
  );
}

function BookingDetailsDialog({ booking, onClose, onCancel }) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelMessage, setCancelMessage] = useState('');
  const vehicle = booking.vehicle;
  const days = bookingDays(booking);

  useEffect(() => {
    function onKeyDown(event) { if (event.key === 'Escape' && !cancelBusy) onClose(); }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, cancelBusy]);

  async function confirmCancellation() {
    setCancelBusy(true);
    setCancelError('');
    try {
      const message = await onCancel(booking);
      setCancelMessage(message || 'Booking cancelled.');
      setConfirmCancel(false);
    } catch (error) {
      setCancelError(error.message || 'Could not cancel this booking. Please try again.');
    } finally {
      setCancelBusy(false);
    }
  }

  return (
    <div className="details-backdrop booking-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !cancelBusy) onClose(); }}>
      <section className="details-dialog booking-details-dialog" role="dialog" aria-modal="true" aria-labelledby="booking-dialog-title">
        <button className="details-close" type="button" onClick={onClose} aria-label="Close booking details" disabled={cancelBusy}>×</button>
        {vehicle?.image_url ? <img className="details-image" src={vehicle.image_url} alt={`${vehicle.name} rental vehicle`} /> : <div className="details-image vehicle-image-placeholder" role="img" aria-label="Vehicle image unavailable"><span>AutoRent vehicle</span></div>}
        <div className="details-content">
          <p className="eyebrow">BOOKING DETAILS</p>
          <h2 id="booking-dialog-title">{vehicle?.name || 'Vehicle details unavailable'}</h2>
          <p className="details-meta">{[vehicle?.brand, vehicle?.model, displayCategory(vehicle?.category)].filter(Boolean).join(' · ')}</p>
          <div className="booking-detail-status"><span>Status</span><StatusPill status={booking.booking_status} /></div>
          <dl className="booking-detail-grid">
            <div><dt>Booking ID</dt><dd className="booking-id-value">{booking.id}</dd></div>
            <div><dt>Vehicle category</dt><dd>{displayCategory(vehicle?.category)}</dd></div>
            {vehicle?.registration_number && <div><dt>Registration</dt><dd>{vehicle.registration_number}</dd></div>}
            <div><dt>Pickup location</dt><dd>Manipal, Karnataka</dd></div>
            <div><dt>Pickup date</dt><dd>{formatDate(booking.pickup_date)}</dd></div>
            <div><dt>Return date <span>(exclusive)</span></dt><dd>{formatDate(booking.return_date)}</dd></div>
            <div><dt>Rental duration</dt><dd>{days} {days === 1 ? 'day' : 'days'}</dd></div>
            <div><dt>Total rental price</dt><dd>₹{Number(booking.total_price).toLocaleString('en-IN')}</dd></div>
            <div><dt>Booked on</dt><dd>{formatDate(booking.created_at)}</dd></div>
            {booking.actual_return_at && <div><dt>Actual return</dt><dd>{new Date(booking.actual_return_at).toLocaleString('en-IN')}</dd></div>}
          </dl>
          {cancelMessage && <p className="booking-inline-success" role="status">{cancelMessage}</p>}
          {cancelError && <p className="booking-error" role="alert">{cancelError}</p>}
          {booking.booking_status === 'pending' && !confirmCancel && !cancelMessage && (
            <button className="booking-cancel-button" type="button" onClick={() => { setCancelError(''); setConfirmCancel(true); }}>Cancel pending booking</button>
          )}
          {confirmCancel && (
            <div className="booking-cancel-confirm" role="alertdialog" aria-labelledby="cancel-confirm-title" aria-describedby="cancel-confirm-description">
              <strong id="cancel-confirm-title">Cancel this booking?</strong>
              <p id="cancel-confirm-description">This will cancel your pending reservation. This action cannot be undone here.</p>
              <div><button type="button" className="booking-cancel-button" onClick={() => setConfirmCancel(false)} disabled={cancelBusy}>Keep booking</button><button type="button" className="booking-confirm-button" onClick={confirmCancellation} disabled={cancelBusy}>{cancelBusy ? 'Cancelling…' : 'Confirm cancellation'}</button></div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default function MyBookings({ user, profile, authLoading, profileLoading, onLogout, onNavigate }) {
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [paymentHistoryError, setPaymentHistoryError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadCount, setReloadCount] = useState(0);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [paymentBooking, setPaymentBooking] = useState(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentResult, setPaymentResult] = useState(null);
  const [paymentActionError, setPaymentActionError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const loadBookings = useCallback(async (isCurrent) => {
    setLoading(true);
    setError('');
    if (!supabase) {
      setBookings([]);
      setError(supabaseConfigurationError || 'Supabase is not configured.');
      setLoading(false);
      return;
    }
    try {
      const { data, error: queryError } = await supabase
        .from('bookings')
        .select('id,user_id,vehicle_id,pickup_date,return_date,actual_return_at,total_price,booking_status,created_at,vehicle:vehicles(id,name,brand,model,category,registration_number,image_url,description,status)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (queryError) throw queryError;
      const customerBookings = data ?? [];
      if (isCurrent()) setBookings(customerBookings);

      if (customerBookings.length === 0) {
        if (isCurrent()) { setPayments([]); setPaymentHistoryError(''); }
      } else {
        const { data: paymentRows, error: paymentQueryError } = await supabase
          .from('payments')
          .select('id,booking_id,amount,payment_method,payment_status,transaction_id,created_at')
          .in('booking_id', customerBookings.map((booking) => booking.id))
          .order('created_at', { ascending: false });
        if (isCurrent()) {
          setPayments(paymentQueryError ? [] : paymentRows ?? []);
          setPaymentHistoryError(paymentQueryError ? `Payment history is unavailable: ${paymentQueryError.message}` : '');
        }
      }
    } catch (queryError) {
      if (isCurrent()) {
        setBookings([]);
        setError(`Could not load your bookings: ${queryError.message || 'Please try again.'}`);
      }
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    let active = true;
    loadBookings(() => active);
    return () => { active = false; };
  }, [loadBookings, reloadCount]);

  async function cancelBooking(booking) {
    if (!supabase) throw new Error(supabaseConfigurationError || 'Supabase is not configured.');
    const { data, error: updateError } = await supabase
      .from('bookings')
      .update({ booking_status: 'cancelled' })
      .eq('id', booking.id)
      .eq('user_id', user.id)
      .eq('booking_status', 'pending')
      .select('id')
      .maybeSingle();
    if (updateError) {
      if (updateError.code === '42501' || /permission|row-level security/i.test(updateError.message || '')) {
        throw new Error('Customer cancellation is not enabled in the database yet. Apply the customer booking management migration, then try again.');
      }
      throw new Error(`Could not cancel booking: ${updateError.message || 'Please try again.'}`);
    }
    if (!data) throw new Error('This booking is no longer pending, or it does not belong to your account. Refresh the page to see its latest status.');
    setBookings((current) => current.map((item) => item.id === booking.id ? { ...item, booking_status: 'cancelled' } : item));
    setSelectedBooking((current) => current?.id === booking.id ? { ...current, booking_status: 'cancelled' } : current);
    return 'Your booking has been cancelled.';
  }

  async function submitDemoPayment(booking, paymentMethod) {
    setPaymentBusy(true);
    setPaymentActionError('');
    setPaymentResult(null);
    try {
      if (!supabase) throw new Error(supabaseConfigurationError || 'Supabase is not configured.');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) throw new Error('Your login session is unavailable. Please sign in again.');
      const apiBase = (import.meta.env.VITE_API_URL?.trim() || 'http://localhost:3004').replace(/\/$/, '');
      const response = await fetch(`${apiBase}/api/payments/demo`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ bookingId: booking.id, paymentMethod }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (result.payment) setPayments((current) => [result.payment, ...current.filter((item) => item.id !== result.payment.id)]);
        throw new Error(result.error || 'AutoRent could not complete the demo payment. Please try again.');
      }
      setPaymentResult(result);
      if (result.payment) setPayments((current) => [result.payment, ...current.filter((item) => item.id !== result.payment.id)]);
    } catch (error) {
      setPaymentActionError(error.message || 'AutoRent could not complete the demo payment. Please try again.');
      if (/already has a successful payment/i.test(error.message || '')) setReloadCount((value) => value + 1);
    } finally {
      setPaymentBusy(false);
    }
  }

  return (
    <div className="site-shell bookings-page">
      <header className="site-header">
        <a className="brand" href="/" onClick={(event) => { event.preventDefault(); onNavigate('/'); }} aria-label="AutoRent home"><BrandMark /><span>auto<span className="brand-accent">rent</span></span></a>
        <button className="menu-toggle" type="button" aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}><span /><span /></button>
        <nav className={`main-nav${menuOpen ? ' is-open' : ''}`} aria-label="Main navigation">
          <a className="nav-link" href="/" onClick={(event) => { event.preventDefault(); onNavigate('/'); }}>Home</a>
          <a className="nav-link" href="/vehicles" onClick={(event) => { event.preventDefault(); onNavigate('/vehicles'); }}>Browse Vehicles</a>
          <a className="nav-link is-active" href="/bookings" aria-current="page">My Bookings</a>
        </nav>
        <AuthActions user={user} profile={profile} loading={authLoading || profileLoading} onLogout={onLogout} onNavigate={onNavigate} />
      </header>

      <main className="bookings-main" aria-labelledby="my-bookings-title">
        <div className="browse-breadcrumb"><a href="/" onClick={(event) => { event.preventDefault(); onNavigate('/'); }}>Home</a><span>/</span><strong>My bookings</strong></div>
        <section className="bookings-intro"><div><p className="eyebrow">YOUR AUTORENT JOURNEYS</p><h1 id="my-bookings-title">My <em>bookings.</em></h1><p>Keep track of your rides and reservation details.</p></div><button className="details-button" type="button" onClick={() => setReloadCount((value) => value + 1)} disabled={loading}>Refresh bookings</button></section>

        {loading ? <div className="vehicle-status bookings-state" role="status" aria-live="polite"><span className="loading-spinner" aria-hidden="true" /><span>Loading your bookings…</span></div>
          : error ? <div className="vehicle-status vehicle-status-error bookings-state" role="alert"><p>{error}</p><button className="text-link" type="button" onClick={() => setReloadCount((value) => value + 1)}>Try again <span aria-hidden="true">→</span></button></div>
            : bookings.length === 0 ? <div className="vehicle-status bookings-state" role="status"><span className="empty-fleet-mark" aria-hidden="true">✳</span><p>You don’t have any bookings yet.</p><button className="text-link" type="button" onClick={() => onNavigate('/vehicles')}>Browse vehicles <span aria-hidden="true">→</span></button></div>
              : <>{paymentHistoryError && <p className="booking-history-error" role="alert">{paymentHistoryError} Apply the demo payment history migration to enable this section.</p>}<section className="booking-list" aria-label="Your bookings" aria-live="polite">{bookings.map((booking) => {
                const vehicle = booking.vehicle;
                const days = bookingDays(booking);
                const bookingPayments = payments.filter((payment) => payment.booking_id === booking.id);
                const alreadySuccessful = bookingPayments.some((payment) => payment.payment_status === 'successful');
                return <article className="customer-booking-card" key={booking.id}>
                  <div className="customer-booking-image">{vehicle?.image_url ? <img src={vehicle.image_url} alt={`${vehicle.name} rental vehicle`} loading="lazy" /> : <div className="vehicle-image-placeholder" role="img" aria-label="Vehicle image unavailable"><span>AutoRent vehicle</span></div>}</div>
                  <div className="customer-booking-content">
                    <div className="customer-booking-heading"><div><p className="eyebrow">{displayCategory(vehicle?.category)}</p><h2>{vehicle?.name || 'Vehicle details unavailable'}</h2><p>{[vehicle?.brand, vehicle?.model].filter(Boolean).join(' · ') || 'Vehicle information'}</p></div><StatusPill status={booking.booking_status} /></div>
                    <div className="customer-booking-facts"><div><span>Pickup</span><strong>{formatDate(booking.pickup_date)}</strong></div><div><span>Return <small>(exclusive)</small></span><strong>{formatDate(booking.return_date)}</strong></div><div><span>Duration</span><strong>{days} {days === 1 ? 'day' : 'days'}</strong></div><div><span>Total</span><strong>₹{Number(booking.total_price).toLocaleString('en-IN')}</strong></div></div>
                    <div className="customer-booking-bottom"><span>Pickup: Manipal, Karnataka</span><div className="customer-booking-actions"><button className="details-button" type="button" onClick={() => setSelectedBooking(booking)}>View booking details</button>{booking.booking_status === 'pending' && !alreadySuccessful && <button className="demo-pay-now" type="button" onClick={() => { setPaymentBooking(booking); setPaymentResult(null); setPaymentActionError(''); }}>Pay now</button>}</div></div>
                    {bookingPayments.length > 0 && <div className="booking-payment-history"><strong>Payment history</strong>{bookingPayments.map((payment) => <div className="booking-payment-history-row" key={payment.id}><span><StatusPill status={payment.payment_status} /> <span>{payment.payment_method}</span></span><span>₹{Number(payment.amount).toLocaleString('en-IN')}</span><small>Transaction: {payment.transaction_id || 'Pending assignment'} · {formatDate(payment.created_at)}</small></div>)}</div>}
                  </div>
                </article>;
              })}</section></>}
      </main>

      <footer className="browse-footer"><a className="brand brand-footer" href="/" onClick={(event) => { event.preventDefault(); onNavigate('/'); }}><BrandMark /><span>auto<span className="brand-accent">rent</span></span></a><span>Good rides. Great stories.</span><a href="#my-bookings-title" className="browse-back-top">Back to top ↑</a></footer>
      {selectedBooking && <BookingDetailsDialog booking={selectedBooking} onClose={() => setSelectedBooking(null)} onCancel={cancelBooking} />}
      {paymentBooking && <DemoPaymentDialog booking={paymentBooking} onClose={() => { if (!paymentBusy) { setPaymentBooking(null); setPaymentResult(null); setPaymentActionError(''); } }} onPay={submitDemoPayment} busy={paymentBusy} result={paymentResult} error={paymentActionError} />}
    </div>
  );
}
