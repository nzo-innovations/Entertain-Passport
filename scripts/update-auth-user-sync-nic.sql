begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  first_name text := nullif(btrim(metadata->>'firstName'), '');
  last_name text := nullif(btrim(metadata->>'lastName'), '');
  metadata_name text := nullif(btrim(metadata->>'name'), '');
  identity_type text := upper(coalesce(nullif(btrim(metadata->>'idType'), ''), 'NIC'));
  identity_number text;
  nic_value text;
begin
  if identity_type not in ('NIC', 'PASSPORT') then
    identity_type := 'NIC';
  end if;

  identity_number := nullif(
    upper(
      regexp_replace(
        coalesce(
          case when identity_type = 'NIC' then metadata->>'nic' end,
          metadata->>'idNumber',
          case when identity_type = 'PASSPORT' then metadata->>'passportNumber' end,
          ''
        ),
        '[-[:space:]]+',
        '',
        'g'
      )
    ),
    ''
  );
  nic_value := case when identity_type = 'NIC' then identity_number end;

  insert into public."User" (
    id,
    email,
    "firstName",
    "lastName",
    nic,
    name,
    role,
    "idType",
    "idNumber",
    "loyaltyPoints",
    "createdAt",
    "updatedAt"
  )
  values (
    new.id::text,
    new.email,
    first_name,
    last_name,
    nic_value,
    coalesce(metadata_name, nullif(concat_ws(' ', first_name, last_name), ''), split_part(new.email, '@', 1)),
    coalesce(nullif(btrim(metadata->>'role'), ''), 'CUSTOMER'),
    identity_type,
    identity_number,
    0,
    now(),
    now()
  )
  on conflict (id) do update set
    email = excluded.email,
    "firstName" = coalesce(excluded."firstName", "User"."firstName"),
    "lastName" = coalesce(excluded."lastName", "User"."lastName"),
    nic = case
      when excluded."idType" = 'PASSPORT' and excluded."idNumber" is not null then null
      else coalesce(excluded.nic, "User".nic)
    end,
    name = coalesce(excluded.name, "User".name),
    role = coalesce(excluded.role, "User".role),
    "idType" = coalesce(excluded."idType", "User"."idType", 'NIC'),
    "idNumber" = coalesce(excluded."idNumber", "User"."idNumber"),
    "updatedAt" = now();

  return new;
end;
$$;

create or replace function public.handle_user_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  first_name text := nullif(btrim(metadata->>'firstName'), '');
  last_name text := nullif(btrim(metadata->>'lastName'), '');
  metadata_name text := nullif(btrim(metadata->>'name'), '');
  identity_type text := upper(coalesce(nullif(btrim(metadata->>'idType'), ''), 'NIC'));
  identity_number text;
  nic_value text;
begin
  if identity_type not in ('NIC', 'PASSPORT') then
    identity_type := 'NIC';
  end if;

  identity_number := nullif(
    upper(
      regexp_replace(
        coalesce(
          case when identity_type = 'NIC' then metadata->>'nic' end,
          metadata->>'idNumber',
          case when identity_type = 'PASSPORT' then metadata->>'passportNumber' end,
          ''
        ),
        '[-[:space:]]+',
        '',
        'g'
      )
    ),
    ''
  );
  nic_value := case when identity_type = 'NIC' then identity_number end;

  update public."User"
     set email = new.email,
         role = coalesce(nullif(btrim(metadata->>'role'), ''), role),
         "firstName" = coalesce(first_name, "firstName"),
         "lastName" = coalesce(last_name, "lastName"),
         name = coalesce(
           metadata_name,
           nullif(concat_ws(' ', coalesce(first_name, "firstName"), coalesce(last_name, "lastName")), ''),
           name
         ),
         nic = case
           when identity_type = 'PASSPORT' and identity_number is not null then null
           else coalesce(nic_value, nic)
         end,
         "idType" = coalesce(identity_type, "idType", 'NIC'),
         "idNumber" = coalesce(identity_number, "idNumber"),
         "updatedAt" = now()
   where id = new.id::text;

  return new;
end;
$$;

commit;
