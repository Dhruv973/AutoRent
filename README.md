# AutoRent – Smart Automobile Rental System

AutoRent is a college full-stack project for browsing and renting vehicles. Customers can create an account, check vehicle availability, make bookings, manage reservations, and try a simulated checkout. The React frontend reads vehicle and booking data through Supabase; an Express backend handles demo payment requests.

## Features

- Customer registration and login with Supabase Auth, including email confirmation.
- Browse available vehicles with name/brand search and category filters.
- Check availability for a requested date range before creating a booking.
- Create pending bookings. The database calculates the daily rental total; the return date is exclusive.
- My Bookings displays the signed-in customer's reservations and details, newest first.
- Cancel your own pending bookings.
- Demo checkout using UPI, Card, or Cash selections. The backend verifies the customer and booking, reads the amount from the database, and records a simulated result and receipt.
- Supabase Row Level Security policies restrict customer data access; SQL migrations also enforce booking overlap and payment safeguards.

## Technologies

- React 19, JavaScript (ES modules), Vite 6
- Node.js, Express 4
- Supabase PostgreSQL, Supabase Auth, Supabase JavaScript client
- Git and GitHub for version control and collaboration

## Project structure

```text
AutoRent/
├── backend/
│   ├── src/
│   │   ├── index.js             # Express server setup
│   │   ├── paymentApi.js        # Health and demo payment routes
│   │   └── paymentLogic.js      # Demo payment validation and simulation
│   ├── test/
│   │   └── paymentApi.test.js   # Backend payment tests
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── AuthPage.jsx
│   │   ├── AuthNavigation.jsx
│   │   ├── BrowseVehicles.jsx
│   │   ├── MyBookings.jsx
│   │   ├── supabaseClient.js
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── .env.example
│   └── package.json
├── supabase/
    ├── migrations/
    └── seed.sql
├── screenshots/
│   ├── 01-registration.png
│   ├── 02-login.png
│   ├── 03-vehicle-listing.png
│   ├── 04-search-filter.png
│   ├── 05-availability.png
│   ├── 06-booking-price.png
│   ├── 07-payment-success.png
│   └── 08-my-bookings.png
└── AutoRent_Project_Report.docx
```

The `screenshots/` folder contains the application captures used in the project report. The final report is `AutoRent_Project_Report.docx` at the project root.

## Prerequisites

- Node.js with npm. The backend uses Node's `--env-file` option, so use a current Node.js release that supports it.
- A Supabase project and permission to use its SQL Editor.
- Git (optional for running locally; required to collaborate through GitHub).

## Install dependencies

In PowerShell, open a terminal in the `AutoRent` project folder and install each app's dependencies in its own folder:

```powershell
cd frontend
npm install
cd ..\backend
npm install
cd ..
```

## Configure environment variables

Copy each example file, then fill in values from your Supabase project. Do not commit the resulting environment files.

```powershell
Copy-Item frontend/.env.example frontend/.env.local
Copy-Item backend/.env.example backend/.env
```

### `frontend/.env.local`

Set the following variables:

```dotenv
VITE_SUPABASE_URL=your-Supabase-project-URL
VITE_SUPABASE_PUBLISHABLE_KEY=your-Supabase-publishable-key
VITE_API_URL=http://localhost:3004
```

The frontend must use only the publishable key. Never put a Supabase secret/service-role key in a `VITE_` variable or frontend file.

### `backend/.env`

Set the following variables:

```dotenv
PORT=3004
FRONTEND_ORIGIN=http://localhost:5173
SUPABASE_URL=your-Supabase-project-URL
SUPABASE_PUBLISHABLE_KEY=your-Supabase-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-Supabase-server-secret-or-legacy-service-role-key
```

The service-role/secret key is for the backend only. Keep `backend/.env` private and do not share it. The backend validates the caller's Auth token and booking ownership before using its elevated key.

## Set up the Supabase database

In the Supabase Dashboard, select the correct project and open **SQL Editor**. Run the migration files in timestamp order, each once:

1. `supabase/migrations/20261103200000_create_autorent_schema.sql`
2. `supabase/migrations/20261103221500_booking_availability_precheck.sql`
3. `supabase/migrations/20261103230000_customer_booking_management.sql`
4. `supabase/migrations/20261104090000_demo_payment_history.sql`
5. `supabase/migrations/20261104110000_fix_booking_rls_recursion.sql`

The migrations create the tables, constraints, triggers, indexes, RLS policies and helper functions needed by the app. The last migration fixes the circular booking/vehicle RLS policy evaluation.

After the migrations, you may run `supabase/seed.sql` in the SQL Editor to add the 10 sample vehicles. The seed only inserts or updates those sample vehicle records using registration numbers as the match key; it does not create users, bookings, payments, or fines.

The database's first-admin bootstrap helper is documented in the schema migration. Registration creates customer profiles, not admins.

## Run AutoRent locally

Open two PowerShell terminals at the `AutoRent` root.

**Terminal 1 — backend:**

```powershell
cd backend
npm run dev
```

The backend listens on port 3004 by default. Its health route is `http://localhost:3004/api/health`.

**Terminal 2 — frontend:**

```powershell
cd frontend
npm run dev
```

Open the local URL printed by Vite (typically `http://localhost:5173`). If you change frontend environment variables, restart the Vite server.

## Backend checks

Run these from the `backend` folder:

```powershell
npm test
npm run build
```

## Team contributions

| Team member | Contribution |
| --- | --- |
| Member 1: Dhruv Sharma | User registration,User login and authentication,Vehicle listing & Vehicle search and filtering |
| Member 2: Harish Raj | Vehicle availability checking,Booking creation,Automatic price calculation & Demo payment processing |

## Payment note

AutoRent checkout is a **simulation for demonstration only**. UPI, Card, and Cash are method choices in the demo flow; the application does not collect real payment credentials, contact a payment gateway, or charge real money.
