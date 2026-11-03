-- Payment history visibility and one-successful-payment-per-booking safeguard.
-- Preflight aborts instead of deleting or changing any existing payment rows.
begin;

do $$
begin
  if exists (
    select 1
    from public.payments
    where payment_status = 'successful'
    group by booking_id
    having count(*) > 1
  ) then
    raise exception 'Duplicate successful payments exist; review them before creating payments_one_success_per_booking_idx';
  end if;
end;
$$;

-- Existing RLS policy payments_select_owner_or_admin limits customers to
-- payment rows linked to their own bookings; this grant only enables SELECT.
grant select on public.payments to authenticated;

create unique index payments_one_success_per_booking_idx
  on public.payments (booking_id)
  where payment_status = 'successful';

comment on index public.payments_one_success_per_booking_idx is
  'Prevents more than one successful demo payment from being recorded for a booking.';

commit;
