-- =========================================================
-- ระบบประเมินมาตรฐานปั๊มน้ำมัน : รันไฟล์นี้ใน Supabase > SQL Editor
-- =========================================================
create extension if not exists "pgcrypto";

-- รายชื่อพนักงาน (พร้อมรูปประจำตัว)
create table if not exists public.employees (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  nickname    text,
  position    text,
  photo_url   text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- หัวรายการประเมินแต่ละกะ
create table if not exists public.inspections (
  id                      uuid primary key default gen_random_uuid(),
  station_name            text,
  shift                   text not null check (shift in ('morning','afternoon','night')),
  evaluator_role          text not null check (evaluator_role in ('shift_manager','captain','cashier')),
  evaluator_line_user_id  text,
  evaluator_name          text,
  employee_count          int  not null,
  employee_failed_count   int  not null default 0,
  area_score              int  not null,
  area_items              jsonb not null,
  area_photo_url          text,
  result                  text not null check (result in ('PASS','FAIL')),
  notify_status           text,
  notify_error            text,
  created_at              timestamptz not null default now()
);

-- ผลประเมินรายคน
create table if not exists public.inspection_employees (
  id             uuid primary key default gen_random_uuid(),
  inspection_id  uuid not null references public.inspections(id) on delete cascade,
  employee_id    uuid references public.employees(id) on delete set null,
  employee_name  text not null,
  items          jsonb not null,
  score          int  not null,
  passed         boolean not null,
  photo_url      text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_inspections_created on public.inspections(created_at desc);
create index if not exists idx_insp_emp_inspection on public.inspection_employees(inspection_id);

-- เปิด RLS โดยไม่สร้าง policy = ไม่มีใครเข้าถึงด้วย anon key ได้
-- ระบบเข้าถึงผ่าน Backend ที่ใช้ service_role key เท่านั้น
alter table public.employees            enable row level security;
alter table public.inspections          enable row level security;
alter table public.inspection_employees enable row level security;

-- Bucket เก็บรูป (ต้อง public เพราะ LINE Flex Message ต้องโหลดรูปผ่าน URL ได้)
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do update set public = true;
