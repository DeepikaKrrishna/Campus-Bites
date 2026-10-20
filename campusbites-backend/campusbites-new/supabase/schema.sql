-- =========================================================
-- CampusBites Database Schema
-- Run this in Supabase SQL Editor (supabase.com → SQL Editor)
-- =========================================================

-- 1. Menu items (admin can manage via Supabase dashboard)
create table if not exists menu_items (
  id          serial primary key,
  name        text not null,
  counter     text not null default 'Main counter',
  time        text not null default '10 min',
  description text not null default '',
  price       integer not null,
  rating      numeric(2,1) not null default 4.0,
  rating_count integer not null default 0,
  image       text not null default '',
  badge       text,                            -- NULL or 'SPECIAL'
  category    text not null default 'Snacks',  -- Breakfast, Snacks, Lunch
  available   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- 2. Orders
create table if not exists orders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id),
  order_number text not null unique,           -- e.g. CB12345
  items       jsonb not null,                  -- cart snapshot
  subtotal    integer not null,
  tax         integer not null,
  packing     integer not null default 10,
  total       integer not null,
  payment     text not null default 'cash',    -- cash, upi, card
  stage       integer not null default 0,      -- 0=placed, 1=confirmed, 2=preparing, 3=ready
  rating      integer,                         -- 1–5 or NULL
  eta_minutes integer not null default 15,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 3. User profiles (extends Supabase auth.users)
create table if not exists profiles (
  id         uuid primary key references auth.users(id),
  name       text not null default '',
  email      text not null default '',
  created_at timestamptz not null default now()
);

-- =========================================================
-- Row Level Security (RLS) — users see only their own data
-- =========================================================

alter table menu_items enable row level security;
alter table orders enable row level security;
alter table profiles enable row level security;

-- Everyone can read the menu
create policy "Menu is public" on menu_items
  for select using (true);

-- Users can only see + create their own orders
create policy "Users read own orders" on orders
  for select using (auth.uid() = user_id);

create policy "Users create own orders" on orders
  for insert with check (auth.uid() = user_id);

create policy "Users update own orders" on orders
  for update using (auth.uid() = user_id);

-- Profile: users read/write their own row
create policy "Users read own profile" on profiles
  for select using (auth.uid() = id);

create policy "Users upsert own profile" on profiles
  for insert with check (auth.uid() = id);

create policy "Users update own profile" on profiles
  for update using (auth.uid() = id);

-- =========================================================
-- Auto-create a profile when a user signs up
-- =========================================================

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =========================================================
-- Enable Realtime on orders (for live tracking)
-- =========================================================

alter publication supabase_realtime add table orders;

-- =========================================================
-- Seed data — insert the menu items
-- =========================================================

insert into menu_items (id, name, counter, time, description, price, rating, rating_count, image, badge, category) values
(1, 'Hot & Cheesy Omelette', 'Tiffin counter', '8 min', 'Three-egg omelette folded over molten cheese, onion and fresh herbs.', 70, 4.7, 126, 'https://images.unsplash.com/photo-1510693206972-df098062cb71?w=400&h=300&fit=crop&auto=format', 'SPECIAL', 'Breakfast'),
(2, 'Masala Dosa', 'Tiffin counter', '10 min', 'Crisp golden crepe with soft potato masala, coconut chutney and sambar.', 60, 4.8, 312, 'https://images.unsplash.com/photo-1694849789325-914b71ab4075?w=400&h=300&fit=crop&auto=format', NULL, 'Breakfast'),
(3, 'Idli Sambar', 'Tiffin counter', '8 min', 'Soft steamed rice cakes with piping hot sambar and coconut chutney.', 45, 4.6, 204, 'https://images.unsplash.com/photo-1668236499396-a62d2d1cb0cf?w=400&h=300&fit=crop&auto=format', NULL, 'Breakfast'),
(4, 'Filter Coffee', 'Beverages', '3 min', 'Strong south Indian filter coffee pulled the proper way.', 25, 4.9, 456, 'https://images.unsplash.com/photo-1758387941825-a6ecaec9c14d?w=400&h=300&fit=crop&auto=format', NULL, 'Snacks'),
(5, 'Chicken Biryani', 'Main counter', '15 min', 'Aromatic seeraga samba rice layered with tender marinated chicken.', 160, 4.9, 478, 'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=400&h=300&fit=crop&auto=format', 'SPECIAL', 'Lunch'),
(6, 'Paneer Butter Masala', 'Main counter', '12 min', 'Creamy tomato-cashew gravy with soft paneer cubes.', 150, 4.7, 289, 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&h=300&fit=crop&auto=format', NULL, 'Lunch'),
(7, 'Cheese Burger', 'Snacks counter', '10 min', 'Loaded with double cheese, onion and fresh lettuce.', 130, 4.8, 167, 'https://images.unsplash.com/photo-1499028344343-cd173ffc68a9?w=400&h=300&fit=crop&auto=format', 'SPECIAL', 'Snacks'),
(8, 'Chicken Burger', 'Snacks counter', '10 min', 'Crispy chicken fillet with house sauce and pickles.', 120, 4.6, 143, 'https://images.unsplash.com/photo-1460306855393-0410f61241c7?w=400&h=300&fit=crop&auto=format', NULL, 'Snacks'),
(9, 'Grilled Veg Sandwich', 'Snacks counter', '7 min', 'Crunchy grilled sandwich with fresh veggies and cheese.', 55, 4.3, 98, 'https://images.unsplash.com/photo-1655279562015-047c3da9a271?w=400&h=300&fit=crop&auto=format', NULL, 'Snacks')
on conflict (id) do nothing;

select setval('menu_items_id_seq', (select max(id) from menu_items));
