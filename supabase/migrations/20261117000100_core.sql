-- BALANCE core schema
-- Content is stored as typed, localized JSON documents (validated by the app with zod).
-- One document per entity (no RU/EN duplication). Drafts live in `documents`,
-- the public snapshot lives in `publications`, every save/publish is kept in `document_versions`.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('member', 'reviewer', 'editor', 'owner');
create type public.doc_type as enum ('pose', 'program', 'exercise', 'page');
create type public.review_status as enum ('draft', 'editorial_review', 'expert_review', 'approved');
create type public.practice_status as enum ('not_started', 'in_progress', 'learned');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles and roles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 80),
  locale text not null default 'ru' check (locale in ('ru', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- A user may hold several staff roles (e.g. editor + reviewer). Absence of rows = member.
create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null check (role <> 'member'),
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create or replace function public.has_role(p_role public.app_role) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = (select auth.uid()) and r.role = p_role
  );
$$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_role('owner');
$$;

create or replace function public.can_edit() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_role('editor') or public.has_role('owner');
$$;

-- Expert review is a separate responsibility: only an explicit reviewer can approve.
create or replace function public.can_review() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_role('reviewer');
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()));
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_locale text := coalesce(new.raw_user_meta_data ->> 'locale', 'ru');
begin
  if v_locale not in ('ru', 'en') then
    v_locale := 'ru';
  end if;
  insert into public.profiles (id, display_name, locale)
  values (new.id, nullif(left(new.raw_user_meta_data ->> 'display_name', 80), ''), v_locale)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Taxonomies (editable in admin)
-- ---------------------------------------------------------------------------
create table public.levels (
  key text primary key check (key ~ '^[a-z0-9-]+$'),
  position int not null,
  label jsonb not null,          -- {"ru": "...", "en": "..."}; e.g. Expert label configurable to "Pro"
  description jsonb not null default '{}'::jsonb,
  rank int not null check (rank between 1 and 4)
);

create table public.categories (
  key text primary key check (key ~ '^[a-z0-9-]+$'),
  position int not null,
  name jsonb not null,
  description jsonb not null default '{}'::jsonb
);

create table public.skills (
  key text primary key check (key ~ '^[a-z0-9-]+$'),
  position int not null,
  name jsonb not null,
  quick_filter boolean not null default false
);

-- ---------------------------------------------------------------------------
-- Site settings (single row)
-- ---------------------------------------------------------------------------
create table public.site_settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  -- publishing policy: when false, only expert-approved documents can be published
  allow_unreviewed_publish boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
insert into public.site_settings (id) values (1);
create trigger site_settings_touch before update on public.site_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Documents (drafts), publications (public snapshot), versions, reviews
-- ---------------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  type public.doc_type not null,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  review_status public.review_status not null default 'draft',
  draft jsonb not null default '{}'::jsonb,
  category_key text references public.categories (key) on update cascade,
  level_key text references public.levels (key) on update cascade,
  skill_keys text[] not null default '{}',
  sort_weight int not null default 0,
  revision int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  unique (type, slug)
);
create index documents_type_idx on public.documents (type);

-- Editing the content after approval invalidates the approval.
create or replace function public.documents_before_update() returns trigger
language plpgsql as $$
begin
  -- Review status can only change through set_review_status()/restore_version(), never by a direct UPDATE.
  if new.review_status is distinct from old.review_status
     and coalesce(current_setting('balance.status_change', true), '') <> 'on' then
    raise exception 'review_status must be changed through set_review_status()' using errcode = '42501';
  end if;
  if new.draft is distinct from old.draft
     or new.category_key is distinct from old.category_key
     or new.level_key is distinct from old.level_key
     or new.skill_keys is distinct from old.skill_keys then
    new.revision := old.revision + 1;
    if old.review_status in ('expert_review', 'approved') and new.review_status = old.review_status then
      new.review_status := 'draft';
    end if;
  end if;
  new.updated_at := now();
  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  return new;
end $$;
create trigger documents_before_update before update on public.documents
  for each row execute function public.documents_before_update();

create table public.publications (
  document_id uuid primary key references public.documents (id) on delete cascade,
  type public.doc_type not null,
  slug text not null,
  doc jsonb not null,
  category_key text,
  level_key text,
  skill_keys text[] not null default '{}',
  sort_weight int not null default 0,
  version_no int not null,
  source_revision int not null,
  expert_approved boolean not null,
  published_at timestamptz not null default now(),
  published_by uuid references auth.users (id) on delete set null,
  unique (type, slug)
);
create index publications_type_idx on public.publications (type);

create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  version_no int not null,
  kind text not null check (kind in ('publish', 'unpublish', 'restore', 'snapshot')),
  doc jsonb not null,
  meta jsonb not null default '{}'::jsonb,
  review_status public.review_status not null,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (document_id, version_no)
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  revision int not null,
  reviewer_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('editorial', 'expert')),
  decision text not null check (decision in ('approved', 'changes_requested', 'comment')),
  checklist jsonb not null default '{}'::jsonb,
  comment text check (comment is null or char_length(comment) <= 4000),
  created_at timestamptz not null default now()
);
create index reviews_document_idx on public.reviews (document_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Media
-- ---------------------------------------------------------------------------
create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.documents (id) on delete set null,
  kind text not null check (kind in ('animation', 'poster', 'keyframe', 'card', 'image', 'illustration')),
  url text not null,                 -- root-relative (/media/...) or absolute storage URL
  storage_path text,                 -- set when stored in Supabase Storage
  mime text not null,
  width int,
  height int,
  duration_ms int,
  frame_count int,
  fps numeric,
  bytes bigint,
  sha256 text,
  alt jsonb not null default '{}'::jsonb,
  position int not null default 0,
  version int not null default 1,
  check_status text not null default 'unchecked'
    check (check_status in ('unchecked', 'auto_passed', 'auto_failed', 'visual_ok', 'expert_approved')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);
create index media_assets_document_idx on public.media_assets (document_id, kind, position);

-- ---------------------------------------------------------------------------
-- Member data (always scoped to auth.uid())
-- ---------------------------------------------------------------------------
create table public.favorites (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pose_id uuid not null references public.documents (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, pose_id)
);

create table public.pose_progress (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pose_id uuid not null references public.documents (id) on delete cascade,
  status public.practice_status not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, pose_id)
);
create trigger pose_progress_touch before update on public.pose_progress
  for each row execute function public.touch_updated_at();

-- Completion is bound to the permanent step key (UUID), never to the step position.
create table public.step_completions (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  program_id uuid not null references public.documents (id) on delete cascade,
  step_key uuid not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, program_id, step_key)
);

create table public.practice_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  practiced_on date not null default current_date,
  pose_id uuid references public.documents (id) on delete set null,
  program_id uuid references public.documents (id) on delete set null,
  duration_min int check (duration_min is null or duration_min between 1 and 600),
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now()
);
create index practice_log_user_idx on public.practice_log (user_id, practiced_on desc);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  pose_id uuid references public.documents (id) on delete set null,
  target_date date,
  achieved_at timestamptz,
  created_at timestamptz not null default now()
);
create index goals_user_idx on public.goals (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);

create or replace function public.write_audit(p_action text, p_entity_type text, p_entity_id text, p_meta jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_log (actor, action, entity_type, entity_id, meta)
  values ((select auth.uid()), p_action, p_entity_type, p_entity_id, coalesce(p_meta, '{}'::jsonb));
$$;
revoke all on function public.write_audit(text, text, text, jsonb) from public, anon, authenticated;

create or replace function public.audit_documents() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit('create', new.type::text, new.id::text, jsonb_build_object('slug', new.slug));
    return new;
  elsif tg_op = 'UPDATE' then
    if new.revision <> old.revision then
      perform public.write_audit('update', new.type::text, new.id::text,
        jsonb_build_object('slug', new.slug, 'revision', new.revision));
    end if;
    if new.review_status <> old.review_status then
      perform public.write_audit('status', new.type::text, new.id::text,
        jsonb_build_object('from', old.review_status, 'to', new.review_status));
    end if;
    return new;
  else
    perform public.write_audit('delete', old.type::text, old.id::text, jsonb_build_object('slug', old.slug));
    return old;
  end if;
end $$;
create trigger documents_audit after insert or update or delete on public.documents
  for each row execute function public.audit_documents();

create or replace function public.audit_roles() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit('grant_role', 'user', new.user_id::text, jsonb_build_object('role', new.role));
    return new;
  else
    perform public.write_audit('revoke_role', 'user', old.user_id::text, jsonb_build_object('role', old.role));
    return old;
  end if;
end $$;
create trigger user_roles_audit after insert or delete on public.user_roles
  for each row execute function public.audit_roles();

-- ---------------------------------------------------------------------------
-- Workflow functions
-- ---------------------------------------------------------------------------

-- Step keys of a program document must be unique UUIDs.
create or replace function public.program_step_keys(p_doc jsonb) returns uuid[]
language sql immutable as $$
  select coalesce(array_agg((s ->> 'key')::uuid), '{}')
  from jsonb_array_elements(coalesce(p_doc -> 'steps', '[]'::jsonb)) s;
$$;

create or replace function public.next_version_no(p_document_id uuid) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce(max(version_no), 0) + 1 from public.document_versions where document_id = p_document_id;
$$;

create or replace function public.set_review_status(p_document_id uuid, p_status public.review_status, p_comment text default null)
returns public.review_status
language plpgsql security definer set search_path = '' as $$
declare
  v_doc public.documents;
begin
  select * into v_doc from public.documents where id = p_document_id for update;
  if not found then raise exception 'document not found' using errcode = 'P0002'; end if;

  if p_status = 'approved' then
    -- Only an explicit reviewer may declare expert approval.
    if not public.can_review() then
      raise exception 'only a reviewer can approve' using errcode = '42501';
    end if;
    if v_doc.review_status <> 'expert_review' then
      raise exception 'document must be in expert_review before approval' using errcode = '22023';
    end if;
    insert into public.reviews (document_id, revision, reviewer_id, kind, decision, comment)
    values (p_document_id, v_doc.revision, (select auth.uid()), 'expert', 'approved', p_comment);
  elsif p_status = 'draft' and public.can_review() and not public.can_edit() then
    -- reviewer requesting changes
    insert into public.reviews (document_id, revision, reviewer_id, kind, decision, comment)
    values (p_document_id, v_doc.revision, (select auth.uid()), 'expert', 'changes_requested', p_comment);
  else
    if not public.can_edit() then
      raise exception 'insufficient privileges' using errcode = '42501';
    end if;
    if p_status = 'expert_review' then
      insert into public.reviews (document_id, revision, reviewer_id, kind, decision, comment)
      values (p_document_id, v_doc.revision, (select auth.uid()), 'editorial', 'approved', p_comment);
    end if;
  end if;

  perform set_config('balance.status_change', 'on', true);
  update public.documents set review_status = p_status where id = p_document_id;
  perform set_config('balance.status_change', '', true);
  return p_status;
end $$;

create or replace function public.publish_document(p_document_id uuid, p_note text default null)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_doc public.documents;
  v_allow boolean;
  v_version int;
  v_keys uuid[];
begin
  if not public.can_edit() then
    raise exception 'insufficient privileges' using errcode = '42501';
  end if;
  select * into v_doc from public.documents where id = p_document_id for update;
  if not found then raise exception 'document not found' using errcode = 'P0002'; end if;

  select allow_unreviewed_publish into v_allow from public.site_settings where id = 1;
  if v_doc.type in ('pose', 'program', 'exercise') and v_doc.review_status <> 'approved' and not coalesce(v_allow, false) then
    raise exception 'expert approval required before publishing' using errcode = '22023';
  end if;

  if jsonb_typeof(v_doc.draft -> 'title') is distinct from 'object'
     and jsonb_typeof(v_doc.draft -> 'name') is distinct from 'object' then
    raise exception 'document has no localized title' using errcode = '22023';
  end if;

  if v_doc.type = 'program' then
    v_keys := public.program_step_keys(v_doc.draft);
    if cardinality(v_keys) <> (select count(distinct k) from unnest(v_keys) k) then
      raise exception 'duplicate step keys' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.publications p, unnest(public.program_step_keys(p.doc)) k
      where p.type = 'program' and p.document_id <> v_doc.id and k = any (v_keys)
    ) then
      raise exception 'step key already used by another program' using errcode = '22023';
    end if;
  end if;

  v_version := public.next_version_no(v_doc.id);
  insert into public.document_versions (document_id, version_no, kind, doc, meta, review_status, note, created_by)
  values (v_doc.id, v_version, 'publish', v_doc.draft,
          jsonb_build_object('category_key', v_doc.category_key, 'level_key', v_doc.level_key,
                             'skill_keys', v_doc.skill_keys, 'sort_weight', v_doc.sort_weight, 'slug', v_doc.slug,
                             'revision', v_doc.revision),
          v_doc.review_status, p_note, (select auth.uid()));

  insert into public.publications (document_id, type, slug, doc, category_key, level_key, skill_keys, sort_weight,
                                   version_no, source_revision, expert_approved, published_at, published_by)
  values (v_doc.id, v_doc.type, v_doc.slug, v_doc.draft, v_doc.category_key, v_doc.level_key, v_doc.skill_keys,
          v_doc.sort_weight, v_version, v_doc.revision, v_doc.review_status = 'approved', now(), (select auth.uid()))
  on conflict (document_id) do update set
    slug = excluded.slug, doc = excluded.doc, category_key = excluded.category_key, level_key = excluded.level_key,
    skill_keys = excluded.skill_keys, sort_weight = excluded.sort_weight, version_no = excluded.version_no,
    source_revision = excluded.source_revision, expert_approved = excluded.expert_approved,
    published_at = excluded.published_at, published_by = excluded.published_by;

  perform public.write_audit('publish', v_doc.type::text, v_doc.id::text,
    jsonb_build_object('version', v_version, 'expert_approved', v_doc.review_status = 'approved'));
  return v_version;
end $$;

create or replace function public.unpublish_document(p_document_id uuid, p_note text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_doc public.documents;
begin
  if not public.can_edit() then
    raise exception 'insufficient privileges' using errcode = '42501';
  end if;
  select * into v_doc from public.documents where id = p_document_id;
  if not found then raise exception 'document not found' using errcode = 'P0002'; end if;
  delete from public.publications where document_id = p_document_id;
  insert into public.document_versions (document_id, version_no, kind, doc, meta, review_status, note, created_by)
  values (v_doc.id, public.next_version_no(v_doc.id), 'unpublish', v_doc.draft, '{}'::jsonb,
          v_doc.review_status, p_note, (select auth.uid()));
  perform public.write_audit('unpublish', v_doc.type::text, v_doc.id::text, '{}'::jsonb);
end $$;

-- Restoring a version copies its content into the draft; step keys inside the content are preserved,
-- so member progress bound to those keys becomes visible again once the program is republished.
create or replace function public.restore_version(p_document_id uuid, p_version_no int)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_ver public.document_versions;
begin
  if not public.can_edit() then
    raise exception 'insufficient privileges' using errcode = '42501';
  end if;
  select * into v_ver from public.document_versions where document_id = p_document_id and version_no = p_version_no;
  if not found then raise exception 'version not found' using errcode = 'P0002'; end if;
  perform set_config('balance.status_change', 'on', true);
  update public.documents set draft = v_ver.doc, review_status = 'draft' where id = p_document_id;
  perform set_config('balance.status_change', '', true);
  insert into public.document_versions (document_id, version_no, kind, doc, meta, review_status, note, created_by)
  values (p_document_id, public.next_version_no(p_document_id), 'restore', v_ver.doc,
          jsonb_build_object('restored_from', p_version_no), 'draft', null, (select auth.uid()));
  perform public.write_audit('restore', 'document', p_document_id::text, jsonb_build_object('from', p_version_no));
end $$;

-- Aggregated (non-personal) completion counts per step, so editors see the impact of changes.
create or replace function public.step_completion_counts(p_program_id uuid)
returns table (step_key uuid, completions bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff() then
    raise exception 'insufficient privileges' using errcode = '42501';
  end if;
  return query
    select c.step_key, count(*)::bigint from public.step_completions c
    where c.program_id = p_program_id group by c.step_key;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.levels enable row level security;
alter table public.categories enable row level security;
alter table public.skills enable row level security;
alter table public.site_settings enable row level security;
alter table public.documents enable row level security;
alter table public.publications enable row level security;
alter table public.document_versions enable row level security;
alter table public.reviews enable row level security;
alter table public.media_assets enable row level security;
alter table public.favorites enable row level security;
alter table public.pose_progress enable row level security;
alter table public.step_completions enable row level security;
alter table public.practice_log enable row level security;
alter table public.goals enable row level security;
alter table public.audit_log enable row level security;

-- profiles
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_owner()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- roles: visible to self; managed only by owner
create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_owner()));
create policy user_roles_insert on public.user_roles for insert to authenticated
  with check ((select public.is_owner()));
create policy user_roles_delete on public.user_roles for delete to authenticated
  using ((select public.is_owner()) and not (user_id = (select auth.uid()) and role = 'owner'));

-- taxonomies: public read, editor write
create policy levels_read on public.levels for select to anon, authenticated using (true);
create policy levels_write on public.levels for all to authenticated
  using ((select public.can_edit())) with check ((select public.can_edit()));
create policy categories_read on public.categories for select to anon, authenticated using (true);
create policy categories_write on public.categories for all to authenticated
  using ((select public.can_edit())) with check ((select public.can_edit()));
create policy skills_read on public.skills for select to anon, authenticated using (true);
create policy skills_write on public.skills for all to authenticated
  using ((select public.can_edit())) with check ((select public.can_edit()));

-- settings: public read, owner write
create policy settings_read on public.site_settings for select to anon, authenticated using (true);
create policy settings_write on public.site_settings for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

-- documents (drafts): staff only
create policy documents_select on public.documents for select to authenticated
  using ((select public.is_staff()));
create policy documents_insert on public.documents for insert to authenticated
  with check ((select public.can_edit()) and review_status = 'draft');
create policy documents_update on public.documents for update to authenticated
  using ((select public.can_edit())) with check ((select public.can_edit()));
create policy documents_delete on public.documents for delete to authenticated
  using ((select public.is_owner()));

-- publications: public read; writes only through security definer functions
create policy publications_read on public.publications for select to anon, authenticated using (true);

-- versions and reviews: staff read only
create policy versions_select on public.document_versions for select to authenticated
  using ((select public.is_staff()));
create policy reviews_select on public.reviews for select to authenticated
  using ((select public.is_staff()));
create policy reviews_comment on public.reviews for insert to authenticated
  with check ((select public.is_staff()) and reviewer_id = (select auth.uid()) and decision = 'comment');

-- media metadata: public read for media attached to published documents; staff read all; editor write
create policy media_read_public on public.media_assets for select to anon, authenticated
  using (document_id is null or exists (select 1 from public.publications p where p.document_id = media_assets.document_id));
create policy media_read_staff on public.media_assets for select to authenticated
  using ((select public.is_staff()));
create policy media_write on public.media_assets for all to authenticated
  using ((select public.can_edit())) with check ((select public.can_edit()));

-- member data: own rows only; references must point to published documents of the right type
create policy favorites_select on public.favorites for select to authenticated
  using (user_id = (select auth.uid()));
create policy favorites_insert on public.favorites for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.publications p where p.document_id = pose_id and p.type = 'pose'));
create policy favorites_delete on public.favorites for delete to authenticated
  using (user_id = (select auth.uid()));

create policy pose_progress_select on public.pose_progress for select to authenticated
  using (user_id = (select auth.uid()));
create policy pose_progress_insert on public.pose_progress for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.publications p where p.document_id = pose_id and p.type = 'pose'));
create policy pose_progress_update on public.pose_progress for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy pose_progress_delete on public.pose_progress for delete to authenticated
  using (user_id = (select auth.uid()));

create policy step_completions_select on public.step_completions for select to authenticated
  using (user_id = (select auth.uid()));
create policy step_completions_insert on public.step_completions for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.publications p
    where p.document_id = program_id and p.type = 'program'
      and step_key = any (public.program_step_keys(p.doc))));
create policy step_completions_delete on public.step_completions for delete to authenticated
  using (user_id = (select auth.uid()));

create policy practice_log_all on public.practice_log for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy goals_all on public.goals for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy audit_select on public.audit_log for select to authenticated
  using ((select public.is_owner()) or (select public.can_edit()));

-- ---------------------------------------------------------------------------
-- Grants (explicit; do not rely on default exposure)
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
grant select on public.levels, public.categories, public.skills, public.site_settings, public.publications,
  public.media_assets to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, delete on public.user_roles to authenticated;
grant insert, update, delete on public.levels, public.categories, public.skills to authenticated;
grant update on public.site_settings to authenticated;
grant select, insert, update, delete on public.documents to authenticated;
grant select on public.document_versions to authenticated;
grant select, insert on public.reviews to authenticated;
grant insert, update, delete on public.media_assets to authenticated;
grant select, insert, delete on public.favorites to authenticated;
grant select, insert, update, delete on public.pose_progress to authenticated;
grant select, insert, delete on public.step_completions to authenticated;
grant select, insert, update, delete on public.practice_log, public.goals to authenticated;
grant select on public.audit_log to authenticated;

revoke all on function public.publish_document(uuid, text) from public, anon;
revoke all on function public.unpublish_document(uuid, text) from public, anon;
revoke all on function public.restore_version(uuid, int) from public, anon;
revoke all on function public.set_review_status(uuid, public.review_status, text) from public, anon;
revoke all on function public.step_completion_counts(uuid) from public, anon;
grant execute on function public.publish_document(uuid, text) to authenticated;
grant execute on function public.unpublish_document(uuid, text) to authenticated;
grant execute on function public.restore_version(uuid, int) to authenticated;
grant execute on function public.set_review_status(uuid, public.review_status, text) to authenticated;
grant execute on function public.step_completion_counts(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: public media bucket, editor-only writes
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 52428800,
        array['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'video/mp4', 'video/webm'])
on conflict (id) do nothing;

create policy media_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (select public.can_edit()));
create policy media_objects_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and (select public.can_edit()))
  with check (bucket_id = 'media' and (select public.can_edit()));
create policy media_objects_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (select public.can_edit()));
