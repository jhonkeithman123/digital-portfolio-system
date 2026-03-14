-- Supabase/Postgres bootstrap migration derived from MySQL schema

create type notification_type as enum ('invite', 'quiz', 'system', 'grade');

create table if not exists users (
  id bigint generated always as identity primary key,
  email text not null unique,
  username text not null,
  section varchar(64),
  student_number text,
  grade varchar(2),
  password text not null,
  role varchar(50) not null,
  verification_code varchar(6),
  verification_expiry timestamptz,
  is_verified boolean default false
);

create table if not exists classrooms (
  id bigint generated always as identity primary key,
  name varchar(100) not null,
  section varchar(64),
  grade varchar(64),
  code varchar(10) not null,
  teacher_id bigint not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  school_year varchar(20) not null,
  updated_at timestamptz
);

create table if not exists activities (
  id bigint generated always as identity primary key,
  classroom_id bigint not null references classrooms(id) on delete cascade,
  teacher_id bigint not null references users(id) on delete cascade,
  title varchar(150) not null,
  file_path text,
  original_name text,
  mime_type varchar(100),
  max_score integer default 100,
  created_at timestamptz not null default now(),
  due_date timestamptz
);

create table if not exists activity_instructions (
  id bigint generated always as identity primary key,
  activity_id bigint not null references activities(id) on delete cascade,
  teacher_id bigint not null references users(id) on delete cascade,
  instruction_text varchar(2000) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists activity_submissions (
  id bigint generated always as identity primary key,
  activity_id bigint not null references activities(id) on delete cascade,
  student_id bigint not null references users(id) on delete cascade,
  file_path text,
  original_name text,
  mime_type varchar(100),
  score numeric(5,2),
  graded_at timestamptz,
  graded_by bigint references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists comments (
  id bigint generated always as identity primary key,
  classroom_id bigint not null references classrooms(id) on delete cascade,
  activity_id bigint not null references activities(id) on delete cascade,
  user_id bigint not null references users(id) on delete cascade,
  comment varchar(255) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited boolean default false
);

create table if not exists comment_replies (
  id bigint generated always as identity primary key,
  user_id bigint not null references users(id) on delete cascade,
  comment_id bigint not null references comments(id) on delete cascade,
  reply varchar(255) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited boolean default false
);

create table if not exists classroom_members (
  id bigint generated always as identity primary key,
  classroom_id bigint not null references classrooms(id) on delete cascade,
  student_id bigint not null references users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  status varchar(20) not null,
  code varchar(10) not null,
  name varchar(30) not null
);

create table if not exists notifications (
  id bigint generated always as identity primary key,
  recipient_id bigint not null,
  sender_id bigint,
  type notification_type default 'system',
  message text not null,
  link text,
  is_read boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists session (
  id bigint generated always as identity primary key,
  user_id bigint not null references users(id) on delete cascade,
  token text not null,
  expires_at timestamptz not null
);

create index if not exists idx_users_section on users(section);
create index if not exists idx_classrooms_section on classrooms(section);
create index if not exists idx_activities_due_date on activities(due_date);
create index if not exists idx_submissions_graded on activity_submissions(graded_at);
