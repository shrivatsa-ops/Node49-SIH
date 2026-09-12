-- KrishiSetu demo schema. Run this once in Supabase: SQL Editor > New query.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key,
  full_name text not null,
  role text not null check (role in ('farmer', 'buyer')),
  district text,
  mobile_last4 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crop_lots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null,
  owner_name text,
  crop_name text not null,
  variety text,
  quantity numeric not null check (quantity > 0),
  unit text not null default 'Quintals',
  location text not null,
  quality_grade text,
  quality_score integer check (quality_score between 0 and 100),
  list_price numeric not null check (list_price >= 0),
  status text not null default 'available' check (status in ('available', 'reserved', 'sold')),
  created_at timestamptz not null default now()
);

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid references public.crop_lots(id) on delete set null,
  buyer_id uuid references public.profiles(id) on delete set null,
  farmer_id uuid references public.profiles(id) on delete set null,
  amount numeric not null check (amount >= 0),
  note text,
  status text not null default 'sent' check (status in ('sent', 'countered', 'accepted', 'declined')),
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid references public.offers(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  conversation_key text not null default 'default',
  sender_name text,
  sender_role text check (sender_role in ('farmer', 'buyer')),
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid references public.crop_lots(id) on delete set null,
  buyer_id uuid references public.profiles(id) on delete set null,
  farmer_id uuid references public.profiles(id) on delete set null,
  quantity numeric not null check (quantity > 0),
  total_amount numeric not null check (total_amount >= 0),
  status text not null default 'confirmed' check (status in ('confirmed', 'picked_up', 'in_transit', 'delivered')),
  delivery_location text,
  created_at timestamptz not null default now()
);

-- Demo-only policies. They deliberately allow anonymous visitors to read/write.
-- Replace these with Supabase Auth-based row-level policies before production.
alter table public.profiles enable row level security;
alter table public.crop_lots enable row level security;
alter table public.offers enable row level security;
alter table public.messages enable row level security;
alter table public.orders enable row level security;

drop policy if exists "demo profiles" on public.profiles;
drop policy if exists "demo crop lots" on public.crop_lots;
drop policy if exists "demo offers" on public.offers;
drop policy if exists "demo messages" on public.messages;
drop policy if exists "demo orders" on public.orders;
create policy "demo profiles" on public.profiles for all to anon using (true) with check (true);
create policy "demo crop lots" on public.crop_lots for all to anon using (true) with check (true);
create policy "demo offers" on public.offers for all to anon using (true) with check (true);
create policy "demo messages" on public.messages for all to anon using (true) with check (true);
create policy "demo orders" on public.orders for all to anon using (true) with check (true);
