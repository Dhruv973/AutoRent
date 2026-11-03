-- AutoRent schema for Supabase PostgreSQL.
-- Apply this migration once in the Supabase SQL Editor or with the Supabase CLI.

begin;

-- Needed to combine vehicle equality with a date-range GiST exclusion constraint.
create extension if not exists btree_gist with schema extensions;

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (length(btrim(full_name)) > 0),
  email text not null unique check (length(btrim(email)) > 0),
  phone text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  brand text not null check (length(btrim(brand)) > 0),
  model text not null check (length(btrim(model)) > 0),
  category text not null check (category in ('car', 'bike', 'scooter', 'SUV', 'van', 'other')),
  registration_number text not null unique check (length(btrim(registration_number)) > 0),
  price_per_day numeric(10,2) not null check (price_per_day > 0),
  image_url text,
  description text,
  status text not null default 'available' check (status in ('available', 'unavailable', 'maintenance')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete restrict,
  vehicle_id uuid not null references public.vehicles (id) on delete restrict,
  pickup_date date not null,
  return_date date not null,
  actual_return_at timestamptz,
  total_price numeric(12,2) not null check (total_price >= 0),
  booking_status text not null default 'pending' check (booking_status in ('pending', 'confirmed', 'cancelled', 'completed')),
  created_at timestamptz not null default now(),
  constraint bookings_valid_dates check (return_date > pickup_date),
  -- Date ranges are half-open [pickup, return): adjacent rentals are allowed.
  -- Pending and confirmed reservations cannot overlap for the same vehicle.
  constraint bookings_no_active_overlap exclude using gist (
    vehicle_id with =,
    daterange(pickup_date, return_date, '[)') with &&
  ) where (booking_status in ('pending', 'confirmed'))
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null check (length(btrim(payment_method)) > 0),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'successful', 'failed')),
  transaction_id text unique,
  created_at timestamptz not null default now()
);

create table public.fines (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  fine_type text not null check (fine_type in ('late_return', 'damage')),
  description text not null check (length(btrim(description)) > 0),
  amount numeric(12,2) not null check (amount > 0),
  evidence_url text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'disputed')),
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete restrict,
  vehicle_id uuid not null references public.vehicles (id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  constraint reviews_one_per_user_vehicle unique (user_id, vehicle_id)
);

-- Index all referencing columns used for joins and ownership checks.
create index bookings_user_id_idx on public.bookings (user_id);
create index bookings_vehicle_id_idx on public.bookings (vehicle_id);
create index bookings_status_dates_idx on public.bookings (booking_status, pickup_date, return_date);
create index payments_booking_id_idx on public.payments (booking_id);
create index fines_booking_id_idx on public.fines (booking_id);
create index reviews_vehicle_id_idx on public.reviews (vehicle_id);
create index reviews_user_id_idx on public.reviews (user_id);

-- Keep updated_at in sync on vehicle edits.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger vehicles_set_updated_at
before update on public.vehicles
for each row execute function public.set_updated_at();

-- Charge per calendar day rented (return date is exclusive). The database
-- computes the amount so a client cannot submit an arbitrary booking price.
create or replace function public.calculate_booking_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  daily_rate numeric(10,2);
begin
  select v.price_per_day into daily_rate
  from public.vehicles v
  where v.id = new.vehicle_id;
  if daily_rate is null then
    raise exception 'Vehicle does not exist';
  end if;
  if new.return_date <= new.pickup_date then
    raise exception 'Return date must be after pickup date';
  end if;
  new.total_price := daily_rate * (new.return_date - new.pickup_date);
  return new;
end;
$$;

create trigger bookings_calculate_total
before insert on public.bookings
for each row execute function public.calculate_booking_total();

-- Profile creation is bound to the authenticated auth.users row; role is never
-- copied from user metadata, so a signup request cannot self-assign admin.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, full_name, email, phone, role)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), 'New user'),
    new.email,
    nullif(btrim(new.raw_user_meta_data ->> 'phone'), ''),
    'customer'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- RLS policies use this narrowly scoped helper to check administrator status.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.users u
    where u.id = (select auth.uid()) and u.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
-- Anon needs execute permission because the vehicle SELECT policy includes an
-- admin branch; for anonymous requests this helper safely returns false.
grant execute on function public.is_admin() to anon, authenticated;

-- First-admin bootstrap. Run this from the Supabase SQL Editor while connected
-- as its privileged database owner (normally postgres), after the target user
-- has signed up. This can only succeed while no admin profile exists.
-- Example: select public.promote_first_user_to_admin('AUTH_USER_UUID'::uuid);
-- The function is deliberately not executable by anon/authenticated clients.
create or replace function public.promote_first_user_to_admin(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Run this procedure from the privileged Supabase SQL Editor';
  end if;
  -- Serialize simultaneous bootstrap attempts so two users cannot both become
  -- the first administrator.
  lock table public.users in exclusive mode;
  if exists (select 1 from public.users where role = 'admin') then
    raise exception 'An administrator already exists';
  end if;
  update public.users set role = 'admin' where id = target_user_id;
  if not found then
    raise exception 'No profile exists for user %', target_user_id;
  end if;
end;
$$;
revoke all on function public.promote_first_user_to_admin(uuid) from public, anon, authenticated;
comment on function public.promote_first_user_to_admin(uuid) is
  'One-time first-admin bootstrap. Call from the privileged Supabase SQL Editor after signup; refuses if an admin already exists.';

-- Defense in depth: even a permissive policy cannot let a user update their
-- own role. Admins can manage roles; service-role maintenance can also do so.
create or replace function public.protect_user_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and coalesce(current_setting('role', true), '') <> 'service_role'
     and session_user not in ('postgres', 'supabase_admin')
     and not public.is_admin() then
    raise exception 'Only an administrator can change a user role';
  end if;
  return new;
end;
$$;

create trigger users_protect_role
before update of role on public.users
for each row execute function public.protect_user_role();

alter table public.users enable row level security;
alter table public.vehicles enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.fines enable row level security;
alter table public.reviews enable row level security;

-- Profiles: users see/edit their own profile; admins manage all profiles.
create policy users_select_self_or_admin on public.users
for select to authenticated using (id = (select auth.uid()) or (select public.is_admin()));
create policy users_update_self_or_admin on public.users
for update to authenticated using (id = (select auth.uid()) or (select public.is_admin()))
with check (id = (select auth.uid()) or (select public.is_admin()));
create policy users_admin_insert on public.users
for insert to authenticated with check ((select public.is_admin()));
create policy users_admin_delete on public.users
for delete to authenticated using ((select public.is_admin()));

-- Anonymous visitors and customers can browse available inventory. RLS still
-- limits admins' full inventory visibility to authenticated administrators.
create policy vehicles_customer_read_available on public.vehicles
for select to anon, authenticated using (status = 'available' or (select public.is_admin()));
create policy vehicles_admin_insert on public.vehicles
for insert to authenticated with check ((select public.is_admin()));
create policy vehicles_admin_update on public.vehicles
for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy vehicles_admin_delete on public.vehicles
for delete to authenticated using ((select public.is_admin()));
-- Table privileges are required in addition to RLS policies. Policies continue
-- to restrict writes to admins even though authenticated users have SQL grants.
grant select on public.vehicles to anon, authenticated;
grant insert, update, delete on public.vehicles to authenticated;

-- Customers may create pending bookings for themselves and read their own.
-- Changes to status and prices are reserved for admins/trusted server code.
create policy bookings_select_owner_or_admin on public.bookings
for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy bookings_customer_create_pending on public.bookings
for insert to authenticated with check (
  user_id = (select auth.uid()) and booking_status = 'pending'
  and exists (select 1 from public.vehicles v where v.id = vehicle_id and v.status = 'available')
);
create policy bookings_admin_update on public.bookings
for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy bookings_admin_delete on public.bookings
for delete to authenticated using ((select public.is_admin()));

-- Payment state is written by trusted server code (service role), not clients.
create policy payments_select_owner_or_admin on public.payments
for select to authenticated using (
  (select public.is_admin()) or exists (
    select 1 from public.bookings b where b.id = booking_id and b.user_id = (select auth.uid())
  )
);

-- Fine records are admin-created/reviewed; customers can view their own fines.
create policy fines_select_owner_or_admin on public.fines
for select to authenticated using (
  (select public.is_admin()) or exists (
    select 1 from public.bookings b where b.id = booking_id and b.user_id = (select auth.uid())
  )
);
create policy fines_admin_insert on public.fines
for insert to authenticated with check ((select public.is_admin()));
create policy fines_admin_update on public.fines
for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy fines_admin_delete on public.fines
for delete to authenticated using ((select public.is_admin()));

-- Reviews are readable by signed-in users; customers own their review rows.
create policy reviews_authenticated_read on public.reviews
for select to anon, authenticated using (true);
create policy reviews_customer_insert on public.reviews
for insert to authenticated with check (user_id = (select auth.uid()));
create policy reviews_owner_or_admin_update on public.reviews
for update to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()))
with check (user_id = (select auth.uid()) or (select public.is_admin()));
create policy reviews_owner_or_admin_delete on public.reviews
for delete to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));

comment on table public.bookings is 'Rental date ranges use [pickup_date, return_date); pending and confirmed bookings cannot overlap for a vehicle.';
comment on table public.fines is 'Late-return and damage charges; creation and review are admin controlled, including damage evidence review.';
comment on function public.handle_new_auth_user() is 'Creates a customer profile for each Supabase Auth user; role is hard-coded to customer.';
comment on function public.protect_user_role() is 'Blocks non-admin users from changing role, independent of client-side behavior.';

commit;
