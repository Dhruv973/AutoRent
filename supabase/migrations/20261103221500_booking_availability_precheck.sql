-- Booking availability precheck for the customer booking form.
-- The function returns only a boolean and does not reveal other customers'
-- booking dates or identities. The exclusion constraint remains authoritative
-- if two customers submit at nearly the same time.
begin;

create or replace function public.check_vehicle_availability(
  p_vehicle_id uuid,
  p_pickup_date date,
  p_return_date date
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    auth.uid() is not null
    and p_vehicle_id is not null
    and p_pickup_date is not null
    and p_return_date is not null
    and p_pickup_date >= current_date
    and p_return_date > p_pickup_date
    and exists (
      select 1 from public.vehicles v
      where v.id = p_vehicle_id and v.status = 'available'
    )
    and not exists (
      select 1 from public.bookings b
      where b.vehicle_id = p_vehicle_id
        and b.booking_status in ('pending', 'confirmed')
        and daterange(b.pickup_date, b.return_date, '[)')
          && daterange(p_pickup_date, p_return_date, '[)')
    ),
    false
  );
$$;

revoke all on function public.check_vehicle_availability(uuid, date, date)
  from public, anon;
grant execute on function public.check_vehicle_availability(uuid, date, date)
  to authenticated;
comment on function public.check_vehicle_availability(uuid, date, date) is
  'Returns only whether a vehicle is available for a date range; the bookings exclusion constraint protects concurrent submissions.';

-- Enforce customer-only booking creation in the database as well as the UI.
drop policy if exists bookings_customer_create_pending on public.bookings;
create policy bookings_customer_create_pending on public.bookings
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and booking_status = 'pending'
  and pickup_date >= current_date
  and exists (
    select 1 from public.users u
    where u.id = (select auth.uid()) and u.role = 'customer'
  )
  and exists (
    select 1 from public.vehicles v
    where v.id = vehicle_id and v.status = 'available'
  )
);

commit;
