-- Run this in Supabase SQL Editor to create a simple activities table
create table if not exists activities (
  id uuid default gen_random_uuid() primary key,
  user_id text default '' ,
  created_at timestamptz default now(),
  date date not null,
  type text not null,
  detail text not null,
  amount numeric not null,
  kg numeric not null
);

-- Optional index to speed queries by user
create index if not exists idx_activities_user_date on activities (user_id, date desc);
