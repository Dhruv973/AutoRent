-- AutoRent sample vehicle inventory (INR per rental day).
-- Safe to rerun: registration_number is unique and matching sample rows update.
-- This seed inserts or updates vehicle records only.

insert into public.vehicles (
  name,
  brand,
  model,
  category,
  registration_number,
  price_per_day,
  image_url,
  description,
  status
)
values
  (
    'Maruti Suzuki Swift', 'Maruti Suzuki', 'Swift', 'car', 'DL 8C AB 4821', 2200.00,
    'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=80',
    'Compact petrol hatchback with air conditioning, five seats and easy city parking. Pickup in New Delhi.', 'available'
  ),
  (
    'Hyundai i20', 'Hyundai', 'i20', 'car', 'KA 03 MN 7314', 2800.00,
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80',
    'Premium hatchback with a comfortable cabin, touchscreen infotainment and ample luggage space. Pickup in Bengaluru.', 'available'
  ),
  (
    'Honda City', 'Honda', 'City', 'car', 'MH 02 FG 9056', 3600.00,
    'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=1200&q=80',
    'Comfortable automatic sedan suited to business travel and weekend drives. Pickup in Mumbai.', 'available'
  ),
  (
    'Royal Enfield Classic 350', 'Royal Enfield', 'Classic 350', 'bike', 'RJ 14 QX 2683', 1700.00,
    'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1200&q=80',
    'Classic roadster with a relaxed riding position, ideal for city rides and scenic day trips. Pickup in Jaipur.', 'available'
  ),
  (
    'Bajaj Pulsar NS200', 'Bajaj', 'Pulsar NS200', 'bike', 'TN 09 CV 6142', 1500.00,
    'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=1200&q=80',
    'Nimble street motorcycle with sporty handling for solo city commutes and short highway rides. Pickup in Chennai.', 'available'
  ),
  (
    'Honda Activa 6G', 'Honda', 'Activa 6G', 'scooter', 'TS 09 ER 3571', 800.00,
    'https://images.unsplash.com/photo-1591637333184-19aa84b3e01f?auto=format&fit=crop&w=1200&q=80',
    'Easy-to-ride automatic scooter with under-seat storage, convenient for everyday errands. Pickup in Hyderabad.', 'available'
  ),
  (
    'TVS Jupiter', 'TVS', 'Jupiter', 'scooter', 'GJ 01 LK 8425', 850.00,
    'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1200&q=80',
    'Comfortable automatic scooter with a roomy seat and practical storage for local journeys. Pickup in Ahmedabad.', 'available'
  ),
  (
    'Tata Nexon', 'Tata', 'Nexon', 'SUV', 'UP 16 DR 5290', 3200.00,
    'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1200&q=80',
    'Compact SUV with a spacious cabin and generous boot, suited to family outings and intercity trips. Pickup in Noida.', 'available'
  ),
  (
    'Mahindra XUV700', 'Mahindra', 'XUV700', 'SUV', 'HR 26 ST 1948', 5200.00,
    'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80',
    'Seven-seat SUV with a roomy interior and highway comfort for family travel. Pickup in Gurugram.', 'available'
  ),
  (
    'Maruti Suzuki Eeco', 'Maruti Suzuki', 'Eeco', 'van', 'WB 06 PA 7832', 2600.00,
    'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=1200&q=80',
    'Practical multi-purpose van with flexible cabin space for small groups and light luggage. Pickup in Kolkata.', 'available'
  )
on conflict (registration_number) do update set
  name = excluded.name,
  brand = excluded.brand,
  model = excluded.model,
  category = excluded.category,
  price_per_day = excluded.price_per_day,
  image_url = excluded.image_url,
  description = excluded.description,
  status = excluded.status;
