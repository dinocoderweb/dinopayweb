-- Print Desk booking manager: shared workspaces, public booking requests,
-- row-level security, and a manual payment ledger.

create schema if not exists private;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 48),
  currency text not null default 'INR' check (currency in ('INR', 'USD', 'LKR', 'SGD', 'AED', 'GBP', 'EUR')),
  timezone text not null default 'Asia/Kolkata' check (timezone in ('Asia/Kolkata', 'Asia/Colombo', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles', 'UTC')),
  public_bookings_enabled boolean not null default true,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

create unique index if not exists business_members_business_email_unique
  on public.business_members (business_id, lower(email));

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  booking_code text not null default ('PD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 7))),
  customer_name text not null check (char_length(trim(customer_name)) between 2 and 100),
  customer_phone text not null check (char_length(trim(customer_phone)) between 5 and 24),
  customer_email text check (customer_email is null or char_length(customer_email) <= 254),
  product_type text not null check (char_length(trim(product_type)) between 2 and 80),
  quantity integer not null check (quantity between 1 and 10000),
  design_notes text check (design_notes is null or char_length(design_notes) <= 1200),
  scheduled_for timestamptz not null,
  status text not null default 'new' check (status in ('new', 'confirmed', 'in_progress', 'ready', 'completed', 'cancelled')),
  quoted_total numeric(12, 2) not null default 0 check (quoted_total >= 0),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, booking_code)
);

create index if not exists bookings_business_schedule_idx
  on public.bookings (business_id, scheduled_for);
create index if not exists bookings_business_status_idx
  on public.bookings (business_id, status);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  method text not null check (method in ('cash', 'upi', 'bank')),
  reference text check (reference is null or char_length(reference) <= 160),
  paid_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists payments_business_paid_at_idx
  on public.payments (business_id, paid_at desc);
create index if not exists payments_booking_idx
  on public.payments (booking_id);

create table if not exists public.staff_invites (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  email text not null check (char_length(trim(email)) between 3 and 254),
  invite_token uuid not null unique default gen_random_uuid(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz
);

create or replace function private.is_business_member(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members as member
    where member.business_id = p_business_id
      and member.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_business_owner(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members as member
    where member.business_id = p_business_id
      and member.user_id = (select auth.uid())
      and member.role = 'owner'
  );
$$;

revoke all on function private.is_business_member(uuid) from public, anon, authenticated;
revoke all on function private.is_business_owner(uuid) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant usage on schema private to anon;
grant execute on function private.is_business_member(uuid) to authenticated;
grant execute on function private.is_business_member(uuid) to anon;
grant execute on function private.is_business_owner(uuid) to authenticated;

alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.staff_invites enable row level security;

drop policy if exists "businesses visible to members or public booking visitors" on public.businesses;
create policy "businesses visible to members or public booking visitors"
  on public.businesses for select
  to anon, authenticated
  using (
    public_bookings_enabled
    or (select private.is_business_member(id))
  );

drop policy if exists "owners update their business" on public.businesses;
create policy "owners update their business"
  on public.businesses for update
  to authenticated
  using ((select private.is_business_owner(id)))
  with check ((select private.is_business_owner(id)));

drop policy if exists "members can read their shared team" on public.business_members;
create policy "members can read their shared team"
  on public.business_members for select
  to authenticated
  using ((select private.is_business_member(business_id)));

drop policy if exists "members can read bookings" on public.bookings;
create policy "members can read bookings"
  on public.bookings for select
  to authenticated
  using ((select private.is_business_member(business_id)));

drop policy if exists "members can add staff bookings" on public.bookings;
create policy "members can add staff bookings"
  on public.bookings for insert
  to authenticated
  with check (
    (select private.is_business_member(business_id))
    and created_by = (select auth.uid())
  );

drop policy if exists "members can update bookings" on public.bookings;
create policy "members can update bookings"
  on public.bookings for update
  to authenticated
  using ((select private.is_business_member(business_id)))
  with check ((select private.is_business_member(business_id)));

drop policy if exists "members can read payment ledger" on public.payments;
create policy "members can read payment ledger"
  on public.payments for select
  to authenticated
  using ((select private.is_business_member(business_id)));

drop policy if exists "owners can read team invitations" on public.staff_invites;
create policy "owners can read team invitations"
  on public.staff_invites for select
  to authenticated
  using ((select private.is_business_owner(business_id)));

drop policy if exists "owners can create team invitations" on public.staff_invites;
create policy "owners can create team invitations"
  on public.staff_invites for insert
  to authenticated
  with check (
    (select private.is_business_owner(business_id))
    and created_by = (select auth.uid())
    and lower(email) <> ''
  );

create or replace function private.guard_booking_quote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paid numeric(12, 2);
begin
  if new.quoted_total is distinct from old.quoted_total then
    select coalesce(sum(payment.amount), 0)
      into v_paid
      from public.payments as payment
      where payment.booking_id = old.id;

    if new.quoted_total < v_paid then
      raise exception 'The quote cannot be lower than payments already recorded.';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.guard_booking_quote() from public, anon, authenticated;

create or replace function private.guard_business_preferences()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.currency is distinct from old.currency or new.timezone is distinct from old.timezone)
    and exists (select 1 from public.bookings where business_id = old.id) then
    raise exception 'Currency and time zone cannot change after the first booking.';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_business_preferences() from public, anon, authenticated;

drop trigger if exists businesses_guard_preferences on public.businesses;
create trigger businesses_guard_preferences
  before update of currency, timezone on public.businesses
  for each row execute function private.guard_business_preferences();

drop trigger if exists bookings_guard_quote on public.bookings;
create trigger bookings_guard_quote
  before update of quoted_total on public.bookings
  for each row execute function private.guard_booking_quote();

create or replace function private.create_business(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_business_id uuid;
  v_slug text := lower(trim(p_slug));
begin
  if v_user is null then
    raise exception 'Sign in before creating a workspace.';
  end if;
  if char_length(trim(p_name)) not between 2 and 80 then
    raise exception 'Studio name must be between 2 and 80 characters.';
  end if;
  if char_length(v_slug) not between 2 and 48 or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Booking link must use lowercase letters, numbers, and single hyphens.';
  end if;
  if exists (select 1 from public.business_members where user_id = v_user) then
    raise exception 'Your account already belongs to a workspace. Ask its owner for an invitation.';
  end if;

  insert into public.businesses (name, slug, created_by)
    values (trim(p_name), v_slug, v_user)
    returning id into v_business_id;

  insert into public.business_members (business_id, user_id, email, role)
    values (v_business_id, v_user, coalesce(nullif(v_email, ''), 'owner@unknown.invalid'), 'owner');
  return v_business_id;
end;
$$;

create or replace function private.create_public_booking(
  p_slug text,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_product_type text,
  p_quantity integer,
  p_design_notes text,
  p_scheduled_for timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
  v_booking_code text;
begin
  select business.id into v_business_id
    from public.businesses as business
    where business.slug = lower(trim(p_slug))
      and business.public_bookings_enabled = true;
  if v_business_id is null then
    raise exception 'This studio is not accepting booking requests right now.';
  end if;
  if char_length(trim(p_customer_name)) not between 2 and 100 then
    raise exception 'Enter your name (2 to 100 characters).';
  end if;
  if char_length(trim(p_customer_phone)) not between 5 and 24 then
    raise exception 'Enter a valid phone number.';
  end if;
  if p_customer_email is not null and char_length(trim(p_customer_email)) > 254 then
    raise exception 'Email address is too long.';
  end if;
  if char_length(trim(p_product_type)) not between 2 and 80 then
    raise exception 'Choose the product you would like printed.';
  end if;
  if p_quantity not between 1 and 10000 then
    raise exception 'Quantity must be between 1 and 10,000.';
  end if;
  if p_design_notes is not null and char_length(p_design_notes) > 1200 then
    raise exception 'Order notes must be 1,200 characters or fewer.';
  end if;
  if p_scheduled_for is null or p_scheduled_for < now() then
    raise exception 'Choose a future date and time.';
  end if;

  insert into public.bookings (
    business_id, customer_name, customer_phone, customer_email,
    product_type, quantity, design_notes, scheduled_for, status,
    quoted_total, created_by
  )
  values (
    v_business_id, trim(p_customer_name), trim(p_customer_phone),
    nullif(lower(trim(p_customer_email)), ''), trim(p_product_type),
    p_quantity, nullif(trim(p_design_notes), ''), p_scheduled_for,
    'new', 0, null
  )
  returning booking_code into v_booking_code;
  return jsonb_build_object('booking_code', v_booking_code);
end;
$$;

create or replace function private.record_manual_payment(
  p_booking_id uuid,
  p_amount numeric,
  p_method text,
  p_reference text,
  p_paid_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_paid numeric(12, 2);
  v_amount numeric(12, 2) := p_amount;
  v_payment_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to record a payment.';
  end if;
  select * into v_booking
    from public.bookings as booking
    where booking.id = p_booking_id
    for update;
  if not found then
    raise exception 'Booking not found.';
  end if;
  if not (select private.is_business_member(v_booking.business_id)) then
    raise exception 'You do not have access to this booking.';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'Payment amount must be greater than zero.';
  end if;
  if p_method not in ('cash', 'upi', 'bank') then
    raise exception 'Choose cash, UPI, or bank transfer.';
  end if;
  if p_reference is not null and char_length(p_reference) > 160 then
    raise exception 'Reference must be 160 characters or fewer.';
  end if;

  select coalesce(sum(payment.amount), 0)
    into v_paid
    from public.payments as payment
    where payment.booking_id = p_booking_id;
  if v_amount > v_booking.quoted_total - v_paid then
    raise exception 'Payment is more than the remaining quoted balance.';
  end if;

  insert into public.payments (
    business_id, booking_id, amount, method, reference, paid_at, created_by
  )
  values (
    v_booking.business_id, p_booking_id, v_amount, p_method,
    nullif(trim(p_reference), ''), coalesce(p_paid_at, now()), (select auth.uid())
  )
  returning id into v_payment_id;
  return v_payment_id;
end;
$$;

create or replace function private.accept_staff_invite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_invite public.staff_invites%rowtype;
begin
  if v_user is null or v_email = '' then
    raise exception 'Sign in with the email address that received this invitation.';
  end if;
  select * into v_invite
    from public.staff_invites as invitation
    where invitation.invite_token = p_token
      and lower(invitation.email) = v_email
      and invitation.accepted_at is null
      and invitation.expires_at > now()
    for update;
  if not found then
    raise exception 'This invite has expired, was already used, or belongs to another email address.';
  end if;
  if exists (
    select 1 from public.business_members as member
    where member.business_id = v_invite.business_id and member.user_id = v_user
  ) then
    raise exception 'You already have access to this studio.';
  end if;
  insert into public.business_members (business_id, user_id, email, role)
    values (v_invite.business_id, v_user, v_email, 'staff');
  update public.staff_invites
    set accepted_at = now()
    where id = v_invite.id;
  return v_invite.business_id;
end;
$$;

-- PostgREST exposes only these invoker wrappers. Privileged implementations live
-- in the unexposed private schema and are granted only to the matching API roles.
create or replace function public.create_business(p_name text, p_slug text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.create_business(p_name, p_slug);
$$;

create or replace function public.create_public_booking(
  p_slug text,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_product_type text,
  p_quantity integer,
  p_design_notes text,
  p_scheduled_for timestamptz
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.create_public_booking(
    p_slug, p_customer_name, p_customer_phone, p_customer_email,
    p_product_type, p_quantity, p_design_notes, p_scheduled_for
  );
$$;

create or replace function public.record_manual_payment(
  p_booking_id uuid,
  p_amount numeric,
  p_method text,
  p_reference text,
  p_paid_at timestamptz
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.record_manual_payment(p_booking_id, p_amount, p_method, p_reference, p_paid_at);
$$;

create or replace function public.accept_staff_invite(p_token uuid)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.accept_staff_invite(p_token);
$$;

revoke all on function private.create_business(text, text) from public, anon, authenticated;
revoke all on function private.create_public_booking(text, text, text, text, text, integer, text, timestamptz) from public, anon, authenticated;
revoke all on function private.record_manual_payment(uuid, numeric, text, text, timestamptz) from public, anon, authenticated;
revoke all on function private.accept_staff_invite(uuid) from public, anon, authenticated;
grant execute on function private.create_business(text, text) to authenticated;
grant execute on function private.create_public_booking(text, text, text, text, text, integer, text, timestamptz) to anon, authenticated;
grant execute on function private.record_manual_payment(uuid, numeric, text, text, timestamptz) to authenticated;
grant execute on function private.accept_staff_invite(uuid) to authenticated;

revoke all on function public.create_business(text, text) from public, anon, authenticated;
revoke all on function public.create_public_booking(text, text, text, text, text, integer, text, timestamptz) from public, anon, authenticated;
revoke all on function public.record_manual_payment(uuid, numeric, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.accept_staff_invite(uuid) from public, anon, authenticated;
grant execute on function public.create_business(text, text) to authenticated;
grant execute on function public.create_public_booking(text, text, text, text, text, integer, text, timestamptz) to anon, authenticated;
grant execute on function public.record_manual_payment(uuid, numeric, text, text, timestamptz) to authenticated;
grant execute on function public.accept_staff_invite(uuid) to authenticated;

revoke all on public.businesses, public.business_members, public.bookings, public.payments, public.staff_invites from anon, authenticated;
grant select (id, name, slug, currency, timezone, public_bookings_enabled) on public.businesses to anon;
grant select on public.businesses to authenticated;
grant update (name, slug, currency, timezone, public_bookings_enabled) on public.businesses to authenticated;
grant select on public.business_members to authenticated;
grant select, insert, update on public.bookings to authenticated;
grant select on public.payments to authenticated;
grant select, insert on public.staff_invites to authenticated;
