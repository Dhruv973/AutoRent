import React, { useEffect, useMemo, useState } from 'react';
import { AuthActions } from './AuthNavigation.jsx';
import { supabase, supabaseConfigurationError } from './supabaseClient.js';

const filters = [
  { label: 'All', value: 'all' },
  { label: 'Cars', value: 'car' },
  { label: 'Bikes', value: 'bike' },
  { label: 'Scooters', value: 'scooter' },
  { label: 'SUVs', value: 'suv' },
  // The database stores vans as the singular, lowercase category "van".
  { label: 'Vans', value: 'van' },
];

function displayCategory(category = '') {
  return category.toLowerCase() === 'suv' ? 'SUV' : category.charAt(0).toUpperCase() + category.slice(1);
}

function ArrowIcon({ diagonal = false }) {
  return diagonal ? (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="M5 15 15 5M6 5h9v9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="M3.5 10h12m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
  );
}

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M5 19.5 7.5 12a3 3 0 0 1 2.8-2h11.4a3 3 0 0 1 2.8 2l2.5 7.5v6h-3v-3H8v3H5v-6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M8 18h16M10 22h.1m11.8 0h.1" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg></span>;
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addCalendarDays(dateString, days) {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return localDateString(date);
}

function rentalDays(pickupDate, returnDate) {
  if (!pickupDate || !returnDate) return 0;
  const [py, pm, pd] = pickupDate.split('-').map(Number);
  const [ry, rm, rd] = returnDate.split('-').map(Number);
  return Math.round((Date.UTC(ry, rm - 1, rd) - Date.UTC(py, pm - 1, pd)) / 86400000);
}

function VehicleDetailsDialog({ vehicle, onClose, onNavigate, user, profile, authLoading, profileLoading }) {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [pickupDate, setPickupDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState('');
  const days = rentalDays(pickupDate, returnDate);
  const estimate = days > 0 ? days * Number(vehicle.price_per_day) : 0;
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="details-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="details-dialog" role="dialog" aria-modal="true" aria-labelledby="vehicle-details-title" aria-describedby={vehicle.description ? 'vehicle-details-description' : undefined}>
        <button className="details-close" type="button" onClick={onClose} aria-label="Close vehicle details">×</button>
        {vehicle.image_url ? (
          <img className="details-image" src={vehicle.image_url} alt={`${vehicle.name} rental vehicle`} />
        ) : (
          <div className="details-image vehicle-image-placeholder" role="img" aria-label={`Photo unavailable for ${vehicle.name}`}><span>{vehicle.name}</span></div>
        )}
        <div className="details-content">
          <span className="vehicle-tag details-status">{displayCategory(vehicle.category)} · {displayCategory(vehicle.status)}</span>
          <p className="eyebrow">AUTORENT VEHICLE</p>
          <h2 id="vehicle-details-title">{vehicle.name}</h2>
          <p className="details-meta">{[vehicle.brand, vehicle.model, displayCategory(vehicle.category)].filter(Boolean).join(' · ')}</p>
          {vehicle.description && <p className="details-description" id="vehicle-details-description">{vehicle.description}</p>}
          <div className="details-price"><strong>₹{Number(vehicle.price_per_day).toLocaleString('en-IN')}</strong><span> / day</span></div>
          <p className="booking-location"><strong>Pickup location</strong><span>Manipal, Karnataka</span></p>
          <p className="details-availability"><span /> {displayCategory(vehicle.status)} for rental</p>
          {bookingSuccess ? <div className="booking-success" role="status" aria-live="polite">{bookingSuccess}</div> : null}
          {!bookingOpen ? (
            <button className="button button-primary booking-submit" type="button" onClick={() => {
              setBookingError('');
              if (authLoading || profileLoading) return;
              if (!user) { onClose(); onNavigate('/login'); return; }
              if (profile?.role !== 'customer') { setBookingError('Only customer accounts can create bookings.'); return; }
              setBookingOpen(true);
            }} disabled={authLoading || profileLoading || vehicle.status !== 'available'}>
              {authLoading || profileLoading ? 'Checking account…' : !user ? 'Log in to book' : 'Book now'}
            </button>
          ) : null}
          {bookingError && !bookingOpen ? <p className="booking-error" role="alert">{bookingError}</p> : null}
          {bookingOpen && !bookingSuccess ? (
            <form className="booking-panel" onSubmit={async (event) => {
              event.preventDefault();
              setBookingError('');
              if (!user?.id || profile?.role !== 'customer') { setBookingError('Please sign in with a customer account to book.'); return; }
              if (!pickupDate || !returnDate || pickupDate < localDateString() || returnDate <= pickupDate) { setBookingError('Choose a pickup date from today and a return date at least one day later.'); return; }
              if (!supabase) { setBookingError(supabaseConfigurationError || 'Booking is temporarily unavailable.'); return; }
              setBookingBusy(true);
              try {
                const { data: available, error: availabilityError } = await supabase.rpc('check_vehicle_availability', {
                  p_vehicle_id: vehicle.id, p_pickup_date: pickupDate, p_return_date: returnDate,
                });
                if (availabilityError) throw availabilityError;
                if (!available) { setBookingError('This vehicle is already reserved for some or all of those dates. Choose different dates.'); return; }
                // total_price is deliberately omitted: the database trigger calculates it from its current daily rate.
                const { data, error } = await supabase.from('bookings').insert({
                  user_id: user.id, vehicle_id: vehicle.id, pickup_date: pickupDate, return_date: returnDate,
                }).select('id,total_price,booking_status').single();
                if (error) throw error;
                setBookingSuccess(`Your booking is pending. Booking reference: ${data.id}. Database total: ₹${Number(data.total_price).toLocaleString('en-IN')}.`);
              } catch (error) {
                const detail = `${error?.message || ''} ${error?.details || ''} ${error?.code || ''}`;
                if (error?.code === '23P01' || /bookings_no_active_overlap|exclusion constraint/i.test(detail)) {
                  setBookingError('Those dates were just reserved by someone else. Please choose different dates.');
                } else if (error?.code === '42501' || /permission|row-level security/i.test(detail)) {
                  setBookingError('Your account does not have permission to create this booking. Sign in with a customer account or contact an administrator.');
                } else if (/check_vehicle_availability|function .* does not exist/i.test(detail)) {
                  setBookingError('Booking availability setup is not installed yet. Ask the project administrator to apply the booking migration in Supabase.');
                } else {
                  setBookingError(`Could not create booking: ${error?.message || 'Please try again.'}`);
                }
              } finally { setBookingBusy(false); }
            }}>
              <h3>Reserve this vehicle</h3>
              <div className="booking-grid">
                <div className="booking-field"><label htmlFor="booking-pickup">Pickup date</label><input id="booking-pickup" type="date" required min={localDateString()} value={pickupDate} onChange={(event) => { const next = event.target.value; setPickupDate(next); if (returnDate && returnDate <= next) setReturnDate(''); setBookingError(''); }} /></div>
                <div className="booking-field"><label htmlFor="booking-return">Return date <span>(exclusive)</span></label><input id="booking-return" type="date" required min={addCalendarDays(pickupDate || localDateString(), 1)} value={returnDate} onChange={(event) => { setReturnDate(event.target.value); setBookingError(''); }} /></div>
              </div>
              <div className="booking-summary" aria-live="polite"><span>{days > 0 ? `${days} rental ${days === 1 ? 'day' : 'days'}` : 'Select your dates'}</span><strong>{days > 0 ? `₹${estimate.toLocaleString('en-IN')}` : '—'}</strong></div>
              <p className="booking-estimate">Estimate at ₹{Number(vehicle.price_per_day).toLocaleString('en-IN')} per day. The database calculates the final booking total.</p>
              {bookingError && <p className="booking-error" role="alert">{bookingError}</p>}
              <button className="button button-primary booking-submit" type="submit" disabled={bookingBusy || days < 1}>{bookingBusy ? 'Checking dates…' : 'Check availability & book'}</button>
            </form>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function BrowseVehicleCard({ vehicle, onViewDetails }) {
  const category = displayCategory(vehicle.category);
  return (
    <article className="vehicle-card browse-vehicle-card">
      <div className="vehicle-image-wrap">
        {vehicle.image_url ? (
          <img className="vehicle-image" src={vehicle.image_url} alt={`${vehicle.name} rental vehicle`} loading="lazy" />
        ) : (
          <div className="vehicle-image-placeholder" role="img" aria-label={`Photo unavailable for ${vehicle.name}`}><span>{vehicle.name}</span></div>
        )}
        <span className="vehicle-tag">{category}</span>
      </div>
      <div className="vehicle-card-content">
        <div className="browse-card-title">
          <div><p className="vehicle-type">{vehicle.brand || category}</p><h2>{vehicle.name}</h2></div>
          <span className="availability-pill"><i /> {displayCategory(vehicle.status)}</span>
        </div>
        <p className="browse-card-category">{category}{vehicle.model ? <><span> · </span>{vehicle.model}</> : null}</p>
        {vehicle.description && <p className="vehicle-description">{vehicle.description}</p>}
        <div className="browse-card-bottom">
          <p><strong>₹{Number(vehicle.price_per_day).toLocaleString('en-IN')}</strong><span> / day</span></p>
          <button className="details-button" type="button" onClick={() => onViewDetails(vehicle)}>View details <ArrowIcon diagonal /></button>
        </div>
      </div>
    </article>
  );
}

export default function BrowseVehicles({
  vehicles,
  loading,
  error,
  onRetry,
  initialCategory,
  onNavigate,
  onFilterChange,
  user,
  profile,
  authLoading,
  profileLoading,
  onLogout,
  authActionError,
}) {
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [search, setSearch] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setActiveCategory(initialCategory), [initialCategory]);

  const visibleVehicles = useMemo(() => {
    const term = search.trim().toLowerCase();
    return vehicles.filter((vehicle) => {
      const matchesCategory = activeCategory === 'all' || vehicle.category?.toLowerCase() === activeCategory;
      const matchesSearch = !term || `${vehicle.name || ''} ${vehicle.brand || ''}`.toLowerCase().includes(term);
      return matchesCategory && matchesSearch;
    });
  }, [vehicles, activeCategory, search]);

  function chooseFilter(value) {
    setActiveCategory(value);
    onFilterChange(value);
  }

  return (
    <div className="site-shell browse-page">
      <header className="site-header">
        <a className="brand" href="/" onClick={(event) => { event.preventDefault(); onNavigate('/'); }} aria-label="AutoRent home">
          <BrandMark /><span>auto<span className="brand-accent">rent</span></span>
        </a>
        <button className="menu-toggle" type="button" aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          <span /><span />
        </button>
        <nav className={`main-nav browse-nav${menuOpen ? ' is-open' : ''}`} aria-label="Main navigation">
          <a className="nav-link" href="/" onClick={(event) => { event.preventDefault(); setMenuOpen(false); onNavigate('/'); }}>Home</a>
          <a className="nav-link is-active" href="/vehicles" aria-current="page" onClick={() => setMenuOpen(false)}>Browse Vehicles</a>
          <a className="nav-link" href={user?.id ? '/bookings' : '/login?next=%2Fbookings'} onClick={(event) => { event.preventDefault(); setMenuOpen(false); onNavigate(user?.id ? '/bookings' : '/login?next=%2Fbookings'); }}>My Bookings</a>
        </nav>
        <AuthActions user={user} profile={profile} loading={authLoading} onLogout={onLogout} onNavigate={onNavigate} />
      </header>

      {authActionError && <p className="auth-global-error" role="alert">{authActionError}</p>}

      <main className="browse-main">
        <div className="browse-breadcrumb"><a href="/" onClick={(event) => { event.preventDefault(); onNavigate('/'); }}>Home</a><span>/</span><strong>Browse vehicles</strong></div>
        <section className="browse-intro" aria-labelledby="browse-title">
          <div><p className="eyebrow">THE AUTORENT COLLECTION</p><h1 id="browse-title">Find your next <em>ride.</em></h1><p>Choose your wheels, then take the day wherever you like.</p></div>
          <span className="browse-total">{loading ? 'Loading fleet…' : `${vehicles.length} available ${vehicles.length === 1 ? 'vehicle' : 'vehicles'}`}</span>
        </section>

        <section className="browse-controls" aria-label="Search and filter vehicles">
          <label className="vehicle-search">
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><circle cx="8.8" cy="8.8" r="5.6" stroke="currentColor" strokeWidth="1.6" /><path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            <span className="visually-hidden">Search vehicles by name or brand</span>
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by vehicle or brand" autoComplete="off" />
            {search && <button className="clear-search" type="button" onClick={() => setSearch('')} aria-label="Clear search">×</button>}
          </label>
          <div className="filter-row browse-filters" role="group" aria-label="Filter by vehicle category">
            {filters.map((filter) => (
              <button key={filter.value} className={`filter-chip${activeCategory === filter.value ? ' selected' : ''}`} type="button" aria-pressed={activeCategory === filter.value} onClick={() => chooseFilter(filter.value)}>{filter.label}</button>
            ))}
          </div>
        </section>

        {loading ? (
          <div className="vehicle-status browse-state" role="status" aria-live="polite"><span className="loading-spinner" aria-hidden="true" /><span>Finding available rides for you…</span></div>
        ) : error ? (
          <div className="vehicle-status vehicle-status-error browse-state" role="alert"><p>{error}</p><button className="text-link" type="button" onClick={onRetry}>Try again <ArrowIcon /></button></div>
        ) : vehicles.length === 0 ? (
          <div className="vehicle-status browse-state" role="status"><span className="empty-fleet-mark" aria-hidden="true">✳</span><p>No available vehicles right now. Please check back soon.</p></div>
        ) : visibleVehicles.length === 0 ? (
          <div className="vehicle-status browse-state" role="status"><span className="empty-fleet-mark" aria-hidden="true">✳</span><p>{search ? `No vehicles match “${search}”.` : `No available ${filters.find((item) => item.value === activeCategory)?.label.toLowerCase()} right now.`}</p><button className="text-link" type="button" onClick={() => { setSearch(''); chooseFilter('all'); }}>Clear search and filters <ArrowIcon /></button></div>
        ) : (
          <div className="browse-results" aria-live="polite" aria-label="Available vehicles">
            <p className="browse-result-count">Showing <strong>{visibleVehicles.length}</strong> {visibleVehicles.length === 1 ? 'vehicle' : 'vehicles'}</p>
            <div className="browse-vehicle-grid">{visibleVehicles.map((vehicle) => <BrowseVehicleCard key={vehicle.id} vehicle={vehicle} onViewDetails={setSelectedVehicle} />)}</div>
          </div>
        )}
      </main>

      <footer className="browse-footer"><a className="brand brand-footer" href="/" onClick={(event) => { event.preventDefault(); onNavigate('/'); }}><BrandMark /><span>auto<span className="brand-accent">rent</span></span></a><span>Good rides. Great stories.</span><a href="#browse-title" className="browse-back-top">Back to top ↑</a></footer>
      {selectedVehicle && <VehicleDetailsDialog vehicle={selectedVehicle} onClose={() => setSelectedVehicle(null)} onNavigate={onNavigate} user={user} profile={profile} authLoading={authLoading} profileLoading={profileLoading} />}
    </div>
  );
}
