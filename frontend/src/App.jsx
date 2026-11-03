import React, { useEffect, useState } from 'react';
import { supabase, supabaseConfigurationError } from './supabaseClient.js';
import BrowseVehicles from './BrowseVehicles.jsx';
import MyBookings from './MyBookings.jsx';
import AuthPage from './AuthPage.jsx';
import { AuthActions } from './AuthNavigation.jsx';

const validCategories = new Set(['all', 'car', 'bike', 'scooter', 'suv', 'van']);

function readRoute() {
  const params = new URLSearchParams(window.location.search);
  const requestedCategory = (params.get('category') || 'all').toLowerCase();
  const pathname = window.location.pathname.replace(/\/$/, '') || '/';
  return {
    page: pathname === '/vehicles' ? 'vehicles' : pathname === '/bookings' ? 'bookings' : pathname === '/login' || pathname === '/register' ? 'auth' : 'home',
    authMode: pathname === '/register' ? 'register' : 'login',
    next: params.get('next') === '/bookings' ? '/bookings' : '/',
    category: validCategories.has(requestedCategory) ? requestedCategory : 'all',
  };
}

const categories = [
  {
    name: 'Cars',
    detail: 'Easy city drives',
    image:
      'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=760&q=85',
    alt: 'Sporty car on a mountain road',
    filter: 'Car',
  },
  {
    name: 'Bikes',
    detail: 'Take the scenic route',
    image:
      'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=760&q=85',
    alt: 'Motorcycle parked outdoors',
    filter: 'Bike',
  },
  {
    name: 'Scooters',
    detail: 'Small rides, big plans',
    image:
      'https://images.unsplash.com/photo-1591637333184-19aa84b3e01f?auto=format&fit=crop&w=760&q=85',
    alt: 'Scooter for a convenient city trip',
    filter: 'Scooter',
  },
  {
    name: 'SUVs',
    detail: 'Room for every plan',
    image:
      'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=760&q=85',
    alt: 'Spacious SUV ready for a road trip',
    filter: 'SUV',
  },
  {
    name: 'Vans',
    detail: 'Bring everyone along',
    image:
      'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=760&q=85',
    alt: 'Passenger van parked on a roadside',
    filter: 'Van',
  },
];

function ArrowIcon({ diagonal = false }) {
  return diagonal ? (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
      <path d="M5 15 15 5M6 5h9v9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
      <path d="M3.5 10h12m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
      <path d="M16 8.3c0 4.2-6 9.1-6 9.1S4 12.5 4 8.3a6 6 0 1 1 12 0Z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function VehicleCard({ vehicle }) {
  const category = vehicle.category || 'Vehicle';
  const model = [vehicle.brand, vehicle.model].filter(Boolean).join(' ');

  return (
    <article className="vehicle-card">
      <div className="vehicle-image-wrap">
        {vehicle.image_url ? (
          <img className="vehicle-image" src={vehicle.image_url} alt={`${vehicle.name} rental vehicle`} loading="lazy" />
        ) : (
          <div className="vehicle-image-placeholder" role="img" aria-label={`Photo unavailable for ${vehicle.name}`}>
            <span>{vehicle.name}</span>
          </div>
        )}
        <span className="vehicle-tag">Available</span>
        <button className="save-button" type="button" aria-label={`Save ${vehicle.name} to favourites`}>
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
            <path d="M16.5 7.2c0 4.2-6.5 8.1-6.5 8.1S3.5 11.4 3.5 7.2A3.7 3.7 0 0 1 10 5a3.7 3.7 0 0 1 6.5 2.2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div className="vehicle-card-content">
        <div className="vehicle-title-line">
          <div>
            <p className="vehicle-type">{vehicle.brand || category} <span>·</span> {category}</p>
            <h3>{vehicle.name}</h3>
          </div>
          <span className="vehicle-model">{vehicle.model}</span>
        </div>
        {vehicle.description && <p className="vehicle-description">{vehicle.description}</p>}
        <div className="vehicle-card-bottom">
          <p><strong>₹{Number(vehicle.price_per_day).toLocaleString('en-IN')}</strong><span> / day</span></p>
          <a className="card-link" href="#login" aria-label={`View ${vehicle.name} details`}><ArrowIcon diagonal /></a>
        </div>
      </div>
    </article>
  );
}

export default function App() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [menuOpen, setMenuOpen] = useState(false);
  const [route, setRoute] = useState(readRoute);
  const [vehicles, setVehicles] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [vehiclesError, setVehiclesError] = useState('');
  const [reloadVehicles, setReloadVehicles] = useState(0);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [authActionError, setAuthActionError] = useState('');

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return undefined;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
      setProfileLoading(Boolean(nextSession?.user?.id));
      setAuthActionError('');
      if (!nextSession) setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user?.id) {
      setProfile(null);
      setProfileLoading(false);
      return undefined;
    }

    let isCurrent = true;
    setProfileLoading(true);
    supabase
      .from('users')
      .select('full_name, phone, role')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (isCurrent) {
          setProfile(error ? null : data ?? null);
          setProfileLoading(false);
        }
      })
      .catch(() => {
        // The Auth metadata name remains available as a navigation fallback.
        if (isCurrent) setProfileLoading(false);
      });

    return () => { isCurrent = false; };
  }, [session?.user?.id]);

  useEffect(() => {
    let isCurrent = true;

    async function loadVehicles() {
      setLoadingVehicles(true);
      setVehiclesError('');

      if (!supabase) {
        if (isCurrent) {
          setVehiclesError(supabaseConfigurationError);
          setLoadingVehicles(false);
        }
        return;
      }

      try {
        const { data, error } = await supabase
          .from('vehicles')
          .select('id, name, brand, model, category, price_per_day, image_url, description, status, created_at')
          .eq('status', 'available')
          .order('created_at', { ascending: false });

        if (!isCurrent) return;
        if (error) {
          setVehiclesError(`Could not load vehicles: ${error.message}`);
          setVehicles([]);
        } else {
          setVehicles(data ?? []);
        }
      } catch (error) {
        if (isCurrent) {
          setVehiclesError(`Could not load vehicles: ${error.message || 'Please try again.'}`);
          setVehicles([]);
        }
      } finally {
        if (isCurrent) setLoadingVehicles(false);
      }
    }

    loadVehicles();
    return () => { isCurrent = false; };
  }, [reloadVehicles]);

  useEffect(() => {
    function handlePopState() {
      setRoute(readRoute());
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (route.page === 'bookings' && !authLoading && !session?.user?.id) {
      navigate('/login?next=%2Fbookings');
    }
  }, [route.page, authLoading, session?.user?.id]);

  const visibleVehicles = activeCategory === 'All'
    ? vehicles
    : vehicles.filter((vehicle) => vehicle.category?.toLowerCase() === activeCategory.toLowerCase());
  const vehicleCounts = vehicles.reduce((counts, vehicle) => {
    const category = vehicle.category?.toLowerCase();
    if (category) counts[category] = (counts[category] || 0) + 1;
    return counts;
  }, {});

  function chooseCategory(category) {
    setActiveCategory(category);
    document.getElementById('fleet')?.scrollIntoView({ behavior: 'smooth' });
  }

  function navigate(path) {
    window.history.pushState({}, '', path);
    setRoute(readRoute());
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function logout() {
    setAuthActionError('');
    if (!supabase) {
      setAuthActionError(supabaseConfigurationError || 'Supabase is not configured.');
      return;
    }
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setAuthActionError(`Could not log out: ${error.message}`);
        return;
      }
      navigate('/');
    } catch (error) {
      setAuthActionError(`Could not log out: ${error.message || 'Please try again.'}`);
    }
  }

  function browseVehicles(category = 'all') {
    const value = category.toLowerCase();
    navigate(value === 'all' ? '/vehicles' : `/vehicles?category=${encodeURIComponent(value)}`);
  }

  function openBookings() {
    navigate(session?.user?.id ? '/bookings' : '/login?next=%2Fbookings');
  }

  function updateBrowseFilter(category) {
    const url = new URL(window.location.href);
    if (category === 'all') url.searchParams.delete('category');
    else url.searchParams.set('category', category);
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    setRoute(readRoute());
  }

  const authProps = {
    user: session?.user ?? null,
    profile,
    profileLoading,
    authLoading,
    onLogout: logout,
    onNavigate: navigate,
  };

  if (route.page === 'auth') {
    return (
      <AuthPage
        {...authProps}
        mode={route.authMode}
        actionError={authActionError}
        onAuthSuccess={() => navigate(route.next)}
      />
    );
  }

  if (route.page === 'bookings') {
    if (authLoading || !session?.user?.id) {
      return <main className="bookings-auth-check" role="status" aria-live="polite">Checking your account…</main>;
    }
    return <MyBookings {...authProps} onNavigate={navigate} />;
  }

  if (route.page === 'vehicles') {
    return (
      <BrowseVehicles
        vehicles={vehicles}
        loading={loadingVehicles}
        error={vehiclesError}
        onRetry={() => setReloadVehicles((value) => value + 1)}
        initialCategory={route.category}
        onNavigate={navigate}
        onFilterChange={updateBrowseFilter}
        {...authProps}
        authActionError={authActionError}
      />
    );
  }

  return (
    <div className="site-shell" id="home">
      <header className="site-header">
        <a className="brand" href="#home" aria-label="AutoRent home">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none"><path d="M5 19.5 7.5 12a3 3 0 0 1 2.8-2h11.4a3 3 0 0 1 2.8 2l2.5 7.5v6h-3v-3H8v3H5v-6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M8 18h16M10 22h.1m11.8 0h.1" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /><path d="M11 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </span>
          <span>auto<span className="brand-accent">rent</span></span>
        </a>
        <button className="menu-toggle" type="button" aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          <span /><span />
        </button>
        <nav className={`main-nav${menuOpen ? ' is-open' : ''}`} aria-label="Main navigation">
          <a className="nav-link is-active" href="#home" onClick={() => setMenuOpen(false)}>Home</a>
          <a className="nav-link" href="/vehicles" onClick={(event) => { event.preventDefault(); browseVehicles(); }}>Browse Vehicles</a>
          <a className="nav-link" href={session?.user?.id ? '/bookings' : '/login?next=%2Fbookings'} onClick={(event) => { event.preventDefault(); setMenuOpen(false); openBookings(); }}>My Bookings</a>
        </nav>
        <AuthActions {...authProps} />
      </header>

      {authActionError && <p className="auth-global-error" role="alert">{authActionError}</p>}

      <main>
        <section className="hero-section" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-dot" /> YOUR NEXT RIDE STARTS HERE</p>
            <h1 id="hero-title">The road is<br />yours to <span>discover.</span></h1>
            <p className="hero-description">Find the right wheels for wherever life takes you. Simple bookings, trusted rides, and the freedom to go your own way.</p>
            <div className="hero-actions">
              <a className="button button-primary" href="/vehicles" onClick={(event) => { event.preventDefault(); browseVehicles(); }}>Browse vehicles <ArrowIcon /></a>
              <div className="hero-trust"><span className="trust-avatars" aria-hidden="true"><i>A</i><i>R</i><i>M</i></span><span><strong>2,000+</strong><small>happy journeys</small></span></div>
            </div>
            <div className="hero-perks">
              <span><b aria-hidden="true">✓</b> Verified vehicles</span>
              <span><b aria-hidden="true">✓</b> Clear daily pricing</span>
            </div>
          </div>
          <div className="hero-visual">
            <img src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1600&q=90" alt="A sports car on an open mountain road at sunset" />
            <div className="hero-image-shade" />
            <div className="hero-image-caption"><span className="caption-line" /><span>FIND YOUR<br /><strong>WAY OUT THERE</strong></span></div>
            <div className="floating-note"><span className="note-icon"><PinIcon /></span><span><small>START YOUR JOURNEY</small><strong>Pick a place. Go.</strong></span><ArrowIcon diagonal /></div>
            <span className="hero-index">01 <i /> 05</span>
          </div>
          <div className="hero-bottom-line"><span>MADE FOR THE WAY YOU MOVE</span><span>SCROLL TO EXPLORE <b>↓</b></span></div>
        </section>

        <section className="categories-section section-pad" id="categories" aria-labelledby="categories-title">
          <div className="section-heading">
            <div><p className="eyebrow">PICK YOUR RIDE</p><h2 id="categories-title">A ride for every <em>kind of day.</em></h2></div>
            <a className="text-link" href="/vehicles" onClick={(event) => { event.preventDefault(); browseVehicles(); }}>Explore all vehicles <ArrowIcon /></a>
          </div>
          <div className="category-grid">
            {categories.map((category, index) => (
              <button className={`category-card category-card-${index + 1}`} key={category.name} type="button" onClick={() => browseVehicles(category.filter)} aria-label={`Browse ${category.name}`}>
                <img src={category.image} alt={category.alt} loading="lazy" />
                <span className="category-overlay" />
                <span className="category-count">
                  {loadingVehicles ? 'Loading fleet' : `${vehicleCounts[category.filter.toLowerCase()] || 0} ${(vehicleCounts[category.filter.toLowerCase()] || 0) === 1 ? 'vehicle' : 'vehicles'}`}
                </span>
                <span className="category-info"><span><strong>{category.name}</strong><small>{category.detail}</small></span><i><ArrowIcon diagonal /></i></span>
              </button>
            ))}
          </div>
        </section>

        <section className="fleet-section section-pad" id="fleet" aria-labelledby="fleet-title">
          <div className="section-heading fleet-heading">
            <div><p className="eyebrow">A FEW GOOD RIDES</p><h2 id="fleet-title">Made for the <em>long way.</em></h2><p className="section-subtitle">A handpicked few to get your plans moving.</p></div>
            <a className="text-link" href="/vehicles" onClick={(event) => { event.preventDefault(); browseVehicles(); }}>View all vehicles <ArrowIcon /></a>
          </div>
          <div className="filter-row" aria-label="Filter featured vehicles">
            {['All', 'Cars', 'Bikes', 'Scooters', 'SUVs', 'Vans'].map((label) => {
              const value = label === 'All' ? 'All' : label === 'Cars' ? 'Car' : label === 'SUVs' ? 'SUV' : label === 'Vans' ? 'Van' : label.slice(0, -1);
              return <button key={label} className={`filter-chip${activeCategory === value ? ' selected' : ''}`} type="button" aria-pressed={activeCategory === value} onClick={() => setActiveCategory(value)}>{label}</button>;
            })}
          </div>
          {loadingVehicles ? (
            <div className="vehicle-status" role="status" aria-live="polite">
              <span className="loading-spinner" aria-hidden="true" />
              <span>Finding available rides for you…</span>
            </div>
          ) : vehiclesError ? (
            <div className="vehicle-status vehicle-status-error" role="alert">
              <p>{vehiclesError}</p>
              <button className="text-link" type="button" onClick={() => setReloadVehicles((value) => value + 1)}>Try again <ArrowIcon /></button>
            </div>
          ) : vehicles.length === 0 ? (
            <div className="vehicle-status" role="status">
              <span className="empty-fleet-mark" aria-hidden="true">✳</span>
              <p>No available vehicles right now. Please check back soon.</p>
            </div>
          ) : visibleVehicles.length > 0 ? (
            <div className="vehicle-grid">{visibleVehicles.map((vehicle) => <VehicleCard key={vehicle.id} vehicle={vehicle} />)}</div>
          ) : (
            <div className="vehicle-status" role="status"><span className="empty-fleet-mark" aria-hidden="true">✳</span><p>No available {activeCategory.toLowerCase()} right now.</p><button type="button" className="text-link" onClick={() => setActiveCategory('All')}>See all available rides <ArrowIcon /></button></div>
          )}
          <div className="fleet-note"><span className="note-star">✳</span><p><strong>Every ride is checked before it hits the road.</strong><br />Because the best journeys start with peace of mind.</p><a href="#categories" aria-label="Explore vehicle categories"><ArrowIcon /></a></div>
        </section>

        <section className="closing-banner" id="bookings">
          <div><p className="eyebrow">GO ON, TAKE THE LONG WAY</p><h2>Your next story<br />starts with a <em>ride.</em></h2></div>
          <a className="button button-light" href="#categories">Find your vehicle <ArrowIcon /></a>
          <span className="banner-orbit orbit-one" /><span className="banner-orbit orbit-two" />
        </section>
      </main>

      <footer className="site-footer" id="login">
        <div className="footer-main">
          <div className="footer-brand-column">
            <a className="brand brand-footer" href="#home"><span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M5 19.5 7.5 12a3 3 0 0 1 2.8-2h11.4a3 3 0 0 1 2.8 2l2.5 7.5v6h-3v-3H8v3H5v-6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M8 18h16M10 22h.1m11.8 0h.1" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg></span><span>auto<span className="brand-accent">rent</span></span></a>
            <p>Good rides. Great stories.<br />Where will yours take you?</p>
          </div>
          <div className="footer-links"><div><strong>Explore</strong><a href="#categories">Browse vehicles</a><a href="#fleet">Featured rides</a><a href={session?.user?.id ? '/bookings' : '/login?next=%2Fbookings'} onClick={(event) => { event.preventDefault(); openBookings(); }}>My bookings</a></div><div><strong>Say hello</strong><a href="mailto:hello@autorent.example">hello@autorent.example</a><a href="/login" onClick={(event) => { event.preventDefault(); navigate('/login'); }}>Log in to AutoRent <ArrowIcon diagonal /></a></div></div>
          <a href="#home" className="back-top">BACK TO TOP <span>↑</span></a>
        </div>
        <div className="footer-bottom"><span>© 2026 AUTORENT. MADE FOR THE WAY YOU MOVE.</span><span>BUILT FOR THE OPEN ROAD <i>✳</i></span></div>
      </footer>
    </div>
  );
}
