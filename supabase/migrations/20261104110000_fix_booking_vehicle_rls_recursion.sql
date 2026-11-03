-- Break the bookings <-> vehicles RLS policy cycle.
-- The vehicle policy must check whether the caller owns a booking for that
-- vehicle, but it must do so without re-entering bookings RLS.
begin;

create or replace function public.customer_has_booking_for_vehicle(p_vehicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(
    (select auth.uid()) is not null
    and p_vehicle_id is not null
    and exists (
      select 1
      from public.bookings b
      where b.vehicle_id = p_vehicle_id
        and b.user_id = (select auth.uid())
    ),
    false
  );
$$;

revoke all on function public.customer_has_booking_for_vehicle(uuid)
  from public, anon;
grant execute on function public.customer_has_booking_for_vehicle(uuid)
  to authenticated;

drop policy if exists vehicles_customer_read_own_booking on public.vehicles;
create policy vehicles_customer_read_own_booking on public.vehicles
for select to authenticated
using ((select public.customer_has_booking_for_vehicle(id)));

comment on function public.customer_has_booking_for_vehicle(uuid) is
  'RLS helper for vehicle visibility: checks only whether the current authenticated user owns a booking for the given vehicle. SECURITY DEFINER avoids recursive bookings/vehicles RLS evaluation; no booking details are returned.';
comment on policy vehicles_customer_read_own_booking on public.vehicles is
  'Allows a customer to read vehicle details for their own bookings, including vehicles that are no longer publicly available, without recursively invoking bookings RLS.';

commit;
