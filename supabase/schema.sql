-- Chạy trong Supabase Dashboard → SQL Editor

-- Profiles (liên kết auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Danh sách TLG (người được đặt lịch)
create table if not exists public.tlg_names (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Bookings (thêm cột chi_dinh_cls)
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_date date not null,
  time_slot text not null,                        -- định dạng 24h: "HH:MM"
  customer_name text not null,
  chi_dinh_cls text check (chi_dinh_cls in ('WISC', 'NEMI', 'Can thiệp tâm lý') or chi_dinh_cls is null),
  tlg_name text not null,
  entered_by text not null,
  entered_by_id uuid references public.profiles(id),
  status text not null default 'pending' check (status in ('pending', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Lịch sử thao tác
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  username text not null,
  action text not null check (action in ('create', 'update', 'delete', 'complete')),
  booking_id uuid,
  description text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Seed TLG mẫu
insert into public.tlg_names (name, sort_order) values
  ('TLG A', 1),
  ('TLG B', 2),
  ('TLG C', 3)
on conflict (name) do nothing;

-- Helper tránh lỗi RLS đệ quy
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- RLS
alter table public.profiles     enable row level security;
alter table public.tlg_names    enable row level security;
alter table public.bookings     enable row level security;
alter table public.activity_logs enable row level security;

-- Profiles policies
create policy "profiles_select" on public.profiles for select to authenticated using (true);
create policy "profiles_insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update to authenticated using (auth.uid() = id or public.is_admin());

-- TLG policies
create policy "tlg_select" on public.tlg_names for select to authenticated using (true);
create policy "tlg_insert" on public.tlg_names for insert to authenticated with check (public.is_admin());
create policy "tlg_update" on public.tlg_names for update to authenticated using (public.is_admin());
create policy "tlg_delete" on public.tlg_names for delete to authenticated using (public.is_admin());

-- Bookings policies
create policy "bookings_select" on public.bookings for select to authenticated using (true);
create policy "bookings_insert" on public.bookings for insert to authenticated with check (true);
create policy "bookings_update" on public.bookings for update to authenticated using (true);
create policy "bookings_delete" on public.bookings for delete to authenticated using (true);

-- Activity logs policies
create policy "logs_select" on public.activity_logs for select to authenticated using (true);
create policy "logs_insert" on public.activity_logs for insert to authenticated with check (auth.uid() = user_id);

-- Trigger: tạo profile khi user đăng ký
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, is_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'is_admin')::boolean, false)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger: updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bookings_updated_at on public.bookings;
create trigger bookings_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

-- Realtime (bật trong Dashboard → Database → Replication nếu cần)
alter table public.bookings      replica identity full;
alter table public.activity_logs replica identity full;

-- Migration: thêm cột chi_dinh_cls nếu bảng bookings đã tồn tại
-- (Chạy riêng nếu đã có dữ liệu cũ)
-- alter table public.bookings add column if not exists chi_dinh_cls text
--   check (chi_dinh_cls in ('WISC', 'NEMI', 'Can thiệp tâm lý') or chi_dinh_cls is null);
