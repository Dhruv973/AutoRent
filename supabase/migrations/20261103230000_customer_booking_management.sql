-- Customer booking management: own-booking vehicle details and safe cancellation.
begin;

-- A customer can see the vehicle attached to their own booking even if that
-- vehicle is no longer publicly available for new rentals.
create policy vehicles_customer_read_own_booking on public.vehicles
for select to authenticated
using (
  exists (
    select 1 from public.bookings b
    where b.vehicle_id = vehicles.id and b.user_id = (select auth.uid())
  )
);

-- Customer updates are restricted by RLS to a pending -> cancelled transition
-- on an owned booking. The trigger below also prevents changing any other field
-- in that same update. Admin updates continue to use the existing admin policy.
grant update on public.bookings to authenticated;

create policy bookings_customer_cancel_own_pending on public.bookings
for update to authenticated
using (
  user_id = (select auth.uid())
  and booking_status = 'pending'
)
with check (
  user_id = (select auth.uid())
  and booking_status = 'cancelled'
);

create or replace function public.guard_customer_booking_cancellation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if auth.uid() is null
     or old.user_id is distinct from (select auth.uid())
     or old.booking_status <> 'pending'
     or new.booking_status <> 'cancelled' then
    raise exception 'Customers may only cancel their own pending bookings';
  end if;

  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.vehicle_id is distinct from old.vehicle_id
     or new.pickup_date is distinct from old.pickup_date
     or new.return_date is distinct from old.return_date
     or new.actual_return_at is distinct from old.actual_return_at
     or new.total_price is distinct from old.total_price
     or new.created_at is distinct from old.created_at then
    raise exception 'Customers may only change the booking status when cancelling';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_customer_booking_cancellation()
  from public, anon, authenticated;

create trigger bookings_guard_customer_cancellation
before update on public.bookings
for each row execute function public.guard_customer_booking_cancellation();

comment on policy vehicles_customer_read_own_booking on public.vehicles is
  'Allows customers to see vehicle details only for vehicles referenced by their own bookings, including unavailable vehicles.';
comment on policy bookings_customer_cancel_own_pending on public.bookings is
  'Allows an owner to update a pending booking only into cancelled state; trigger restricts changed data to booking_status.';
comment on function public.guard_customer_booking_cancellation() is
  'Allows customers to change only booking_status from pending to cancelled on their own booking; admins retain the existing update path.';

commit;
