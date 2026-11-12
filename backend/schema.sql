create table if not exists users(
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  name text not null,
  created_at timestamptz not null default now()
);
create table if not exists refresh_tokens(
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null
);
create table if not exists medicines(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  note text,
  time_of_day text not null,
  active boolean not null default true
);
create table if not exists med_logs(
  medicine_id uuid not null references medicines(id) on delete cascade,
  day date not null default ((now() at time zone 'Asia/Kolkata')::date),
  taken_at timestamptz not null default now(),
  primary key(medicine_id, day)
);
create table if not exists appointments(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  doctor text not null,
  at timestamptz not null,
  note text
);
create table if not exists readings(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('bp','sugar','weight')),
  value text not null,
  taken_at timestamptz not null default now()
);
create table if not exists sos_contacts(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  phone text not null
);
create table if not exists caregiver_links(
  id uuid primary key default gen_random_uuid(),
  elder_id uuid not null references users(id) on delete cascade,
  caregiver_id uuid references users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','active','revoked')),
  view_meds boolean not null default false,
  view_appts boolean not null default false,
  code_hash text,
  code_expires timestamptz
);
create table if not exists sos_events(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);
create table if not exists audit_log(
  id bigserial primary key,
  owner_id uuid not null,
  actor_id uuid not null,
  action text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_meds_user on medicines(user_id);
create index if not exists idx_appts_user on appointments(user_id, at);
create index if not exists idx_links_elder on caregiver_links(elder_id);
create index if not exists idx_links_care on caregiver_links(caregiver_id);
create table if not exists missed_alerts(
  medicine_id uuid not null references medicines(id) on delete cascade,
  day date not null,
  primary key(medicine_id, day)
);
