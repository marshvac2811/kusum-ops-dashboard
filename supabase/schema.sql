-- PM-KUSUM Ops Dashboard — Supabase Schema
-- Run this in the Supabase SQL Editor to enable live data mode.

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- States installation pipeline
create table if not exists kusum_states (
  code          text primary key,
  name          text not null,
  surveyed      int  not null default 0,
  sanctioned    int  not null default 0,
  dispatched    int  not null default 0,
  installed     int  not null default 0,
  commissioned  int  not null default 0,
  updated_at    timestamptz default now()
);

-- Subsidy claims
create table if not exists kusum_claims (
  id          serial primary key,
  state       text not null,
  component   text not null,
  amount      numeric not null,
  bucket      text not null,  -- '0-30' | '31-60' | '61-90' | '90+'
  updated_at  timestamptz default now()
);

-- Field teams
create table if not exists kusum_teams (
  id           serial primary key,
  name         text    not null,
  state        text    not null,
  installs     int     not null default 0,
  turnaround   numeric not null default 0,
  ftr          int     not null default 0,  -- first-time-right %
  updated_at   timestamptz default now()
);

-- Service tickets
create table if not exists kusum_tickets (
  id          text primary key,
  issue       text not null,
  state       text not null,
  days_open   int  not null default 0,
  sla         text not null default 'on-track',  -- 'on-track' | 'at-risk' | 'breach'
  updated_at  timestamptz default now()
);

-- ── Seed data (illustrative) ───────────────────────────────────────────────

insert into kusum_states (code, name, surveyed, sanctioned, dispatched, installed, commissioned) values
  ('MH','Maharashtra',    4200, 3850, 3400, 3100, 2890),
  ('HR','Haryana',        3100, 2900, 2600, 2450, 2380),
  ('RJ','Rajasthan',      2600, 2300, 1850, 1600, 1420),
  ('MP','Madhya Pradesh', 2100, 1950, 1500, 1180,  980),
  ('UP','Uttar Pradesh',  1800, 1600, 1100,  780,  610),
  ('GJ','Gujarat',        1500, 1420, 1300, 1240, 1190),
  ('PB','Punjab',          950,  880,  640,  510,  430),
  ('CG','Chhattisgarh',    780,  710,  580,  490,  440)
on conflict (code) do nothing;

insert into kusum_claims (state, component, amount, bucket) values
  ('MH','B', 412, '0-30'),
  ('MH','C', 138, '31-60'),
  ('HR','B', 286, '0-30'),
  ('HR','C',  94, '61-90'),
  ('RJ','B', 221, '31-60'),
  ('RJ','C', 176, '90+'),
  ('MP','B', 167, '61-90'),
  ('UP','B', 143, '90+'),
  ('GJ','C', 118, '0-30'),
  ('PB','B',  76, '31-60'),
  ('CG','B',  58, '0-30');

insert into kusum_teams (name, state, installs, turnaround, ftr) values
  ('Field Team — Nagpur',  'MH', 118, 6.2,  94),
  ('Field Team — Panipat', 'HR',  96, 5.4,  97),
  ('Field Team — Jodhpur', 'RJ',  74, 8.1,  86),
  ('Field Team — Bhopal',  'MP',  51, 9.6,  81),
  ('Field Team — Lucknow', 'UP',  33, 11.3, 74),
  ('Field Team — Rajkot',  'GJ',  62, 6.8,  92);

insert into kusum_tickets (id, issue, state, days_open, sla) values
  ('SR-4471', 'Controller fault',       'MH',  2, 'on-track'),
  ('SR-4488', 'Motor underperformance', 'RJ',  9, 'breach'),
  ('SR-4502', 'Panel misalignment',     'HR',  1, 'on-track'),
  ('SR-4517', 'Pump priming issue',     'UP', 12, 'breach'),
  ('SR-4529', 'Wiring damage',          'MP',  4, 'at-risk'),
  ('SR-4533', 'Structure corrosion',    'GJ',  3, 'on-track')
on conflict (id) do nothing;

-- ── Row Level Security (public read — update via service role) ─────────────
alter table kusum_states   enable row level security;
alter table kusum_claims   enable row level security;
alter table kusum_teams    enable row level security;
alter table kusum_tickets  enable row level security;

create policy "public read kusum_states"   on kusum_states   for select using (true);
create policy "public read kusum_claims"   on kusum_claims   for select using (true);
create policy "public read kusum_teams"    on kusum_teams    for select using (true);
create policy "public read kusum_tickets"  on kusum_tickets  for select using (true);

-- Enable realtime for live subscriptions
alter publication supabase_realtime add table kusum_states;
alter publication supabase_realtime add table kusum_tickets;
