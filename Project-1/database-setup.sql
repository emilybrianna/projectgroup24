create table if not exists public.users (
  id uuid not null default gen_random_uuid (),
  name text not null,
  email text not null,
  password text not null,
  role text not null default 'customer'::text,
  created_at timestamp with time zone not null default now(),
  constraint users_pkey primary key (id),
  constraint users_email_key unique (email),
  constraint users_role_check check (
    (
      role = any (
        array['customer'::text, 'admin'::text, 'staff'::text]
      )
    )
  )
) TABLESPACE pg_default;

alter table public.users
add column if not exists role text not null default 'customer'::text;

alter table public.users
add column if not exists created_at timestamp with time zone not null default now();

do $$
declare
  role_constraint record;
begin
  for role_constraint in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'users'
      and con.contype = 'c'
      and (
        con.conname ilike '%role%'
        or pg_get_constraintdef(con.oid) ilike '%role%'
      )
  loop
    execute format('alter table public.users drop constraint if exists %I', role_constraint.conname);
  end loop;
end $$;

alter table public.users
drop constraint if exists users_role_check;

update public.users
set role = lower(role)
where role is not null
  and lower(role) in ('customer', 'admin', 'staff');

update public.users
set role = 'customer'
where role is null
  or role not in ('customer', 'admin', 'staff');

alter table public.users
add constraint users_role_check check (
  role = any (
    array['customer'::text, 'admin'::text, 'staff'::text]
  )
);

create unique index if not exists users_email_key
on public.users (email);

alter table public.users disable row level security;

create table if not exists public.categories (
  id uuid not null default gen_random_uuid(),
  name text not null,
  type text not null,
  created_at timestamp with time zone not null default now(),
  constraint categories_pkey primary key (id),
  constraint categories_type_key unique (type)
) TABLESPACE pg_default;

alter table public.categories
add column if not exists type text;

update public.categories
set type = name
where type is null;

alter table public.categories
alter column type set not null;

create unique index if not exists categories_type_key
on public.categories (type);

alter table public.categories disable row level security;

insert into public.categories (name, type)
values
  ('Men', 'Men'),
  ('Women', 'Women'),
  ('Kids', 'Kids')
on conflict (type) do update set
  name = excluded.name;

create table if not exists public.profiles (
  id uuid not null,
  name text not null,
  email text not null,
  role text not null default 'customer'::text,
  updated_at timestamp with time zone not null default now(),
  constraint profiles_pkey primary key (id),
  constraint profiles_email_key unique (email),
  constraint profiles_id_fkey foreign key (id) references public.users (id) on delete cascade,
  constraint profiles_role_check check (
    (
      role = any (
        array['customer'::text, 'admin'::text, 'staff'::text]
      )
    )
  )
) TABLESPACE pg_default;

alter table public.profiles
add column if not exists name text;

alter table public.profiles
add column if not exists email text;

alter table public.profiles
add column if not exists role text not null default 'customer'::text;

alter table public.profiles
add column if not exists updated_at timestamp with time zone not null default now();

do $$
declare
  role_constraint record;
begin
  for role_constraint in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'profiles'
      and con.contype = 'c'
      and (
        con.conname ilike '%role%'
        or pg_get_constraintdef(con.oid) ilike '%role%'
      )
  loop
    execute format('alter table public.profiles drop constraint if exists %I', role_constraint.conname);
  end loop;
end $$;

alter table public.profiles
drop constraint if exists profiles_role_check;

update public.profiles
set role = lower(role)
where role is not null
  and lower(role) in ('customer', 'admin', 'staff');

update public.profiles
set role = 'customer'
where role is null
  or role not in ('customer', 'admin', 'staff');

alter table public.profiles
add constraint profiles_role_check check (
  role = any (
    array['customer'::text, 'admin'::text, 'staff'::text]
  )
);

create unique index if not exists profiles_email_key
on public.profiles (email);

alter table public.profiles disable row level security;

create or replace function public.sync_user_profile()
returns trigger
language plpgsql
as $$
begin
  insert into public.profiles (id, name, email, role, updated_at)
  values (new.id, new.name, new.email, new.role, now())
  on conflict (id) do update set
    name = excluded.name,
    email = excluded.email,
    role = excluded.role,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists sync_user_profile_after_write on public.users;

create trigger sync_user_profile_after_write
after insert or update of name, email, role on public.users
for each row
execute function public.sync_user_profile();

insert into public.users (name, email, password, role)
values
  (
    'Admin',
    'admin@smartfash.com',
    '$2b$10$il/FsFKGt3KuOSG1LFrrauiLKS8GmKk3tHFN735Gey28UMxAD7RSu',
    'admin'
  ),
  (
    'Staff',
    'staff@smartfash.com',
    '$2b$10$VOSn1vdIkLtj.oDz/oRgBuPcAYhckZYdiwqI51VIpI3jc4agZV/x.',
    'staff'
  )
on conflict (email) do update set
  name = excluded.name,
  password = excluded.password,
  role = excluded.role;

create table if not exists public.password_resets (
  id uuid not null default gen_random_uuid(),
  email text not null,
  otp_code text not null,
  expires_at timestamp with time zone not null,
  used_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  constraint password_resets_pkey primary key (id),
  constraint password_resets_email_fkey foreign key (email) references public.users (email) on delete cascade
) TABLESPACE pg_default;

create index if not exists password_resets_email_created_at_idx
on public.password_resets (email, created_at desc);

alter table public.password_resets disable row level security;

create table if not exists public.products (
  id bigint generated by default as identity not null,
  name text not null,
  type text null,
  category text null,
  description text null,
  price numeric not null,
  image_url text null,
  stock integer not null default 0,
  low_stock_limit integer not null default 5,
  rating numeric not null default 0,
  color text null,
  size text null,
  occasion text null,
  material text null,
  weather_tag text null,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  constraint products_pkey primary key (id),
  constraint products_price_check check (price >= 0),
  constraint products_stock_check check (stock >= 0),
  constraint products_rating_check check (rating >= 0 and rating <= 5)
) TABLESPACE pg_default;

alter table public.products
add column if not exists category text null;

alter table public.products
add column if not exists type text null;

alter table public.products
add column if not exists description text null;

alter table public.products
add column if not exists price numeric not null default 0;

alter table public.products
add column if not exists image_url text null;

alter table public.products
add column if not exists stock integer not null default 0;

alter table public.products
add column if not exists low_stock_limit integer not null default 5;

alter table public.products
add column if not exists rating numeric not null default 0;

alter table public.products
add column if not exists color text null;

alter table public.products
drop constraint if exists products_rating_check;

alter table public.products
add constraint products_rating_check check (rating >= 0 and rating <= 5);

alter table public.products
add column if not exists size text null;

alter table public.products
add column if not exists occasion text null;

alter table public.products
add column if not exists material text null;

alter table public.products
add column if not exists weather_tag text null;

alter table public.products
add column if not exists is_featured boolean not null default false;

alter table public.products
add column if not exists is_active boolean not null default true;

alter table public.products
add column if not exists created_at timestamp with time zone not null default now();

alter table public.products
drop constraint if exists products_weather_tag_check;

alter table public.products
add constraint products_weather_tag_check check (
  weather_tag is null
  or weather_tag = any (
    array[
      'All weather'::text,
      'Warm'::text,
      'Warm weather'::text,
      'Cool'::text,
      'Cool weather'::text,
      'Cold'::text,
      'Cold weather'::text,
      'Rainy'::text,
      'Sunny'::text,
      'Hot'::text,
      'Hot weather'::text,
      'Outdoor'::text
    ]
  )
);

update public.products
set category = split_part(type, ' ', 1)
where category is null and type is not null;

create index if not exists products_filter_idx
on public.products (is_active, size, color, occasion, price);

alter table public.products disable row level security;

create table if not exists public.user_style_preferences (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  preferred_style text null,
  preferred_color text null,
  preferred_occasion text null,
  updated_at timestamp with time zone not null default now(),
  constraint user_style_preferences_pkey primary key (id),
  constraint user_style_preferences_user_id_key unique (user_id),
  constraint user_style_preferences_user_id_fkey foreign key (user_id) references public.users (id) on delete cascade
) TABLESPACE pg_default;

alter table public.user_style_preferences
add column if not exists user_id uuid;

alter table public.user_style_preferences
add column if not exists preferred_style text null;

alter table public.user_style_preferences
add column if not exists preferred_color text null;

alter table public.user_style_preferences
add column if not exists preferred_occasion text null;

alter table public.user_style_preferences
add column if not exists updated_at timestamp with time zone not null default now();

alter table public.user_style_preferences disable row level security;

do $$
declare
  weather_constraint record;
begin
  for weather_constraint in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'products'
      and con.contype = 'c'
      and (
        con.conname ilike '%weather%'
        or pg_get_constraintdef(con.oid) ilike '%weather_tag%'
      )
  loop
    execute format('alter table public.products drop constraint if exists %I', weather_constraint.conname);
  end loop;
end $$;

alter table public.products
add constraint products_weather_tag_check check (
  weather_tag is null
  or weather_tag = any (
    array[
      'All weather'::text,
      'Warm'::text,
      'Warm weather'::text,
      'Cool'::text,
      'Cool weather'::text,
      'Cold'::text,
      'Cold weather'::text,
      'Rainy'::text,
      'Sunny'::text,
      'Hot'::text,
      'Hot weather'::text,
      'Outdoor'::text
    ]
  )
);

-- Clear the old sample product catalogue. Add the new product set after this
-- block so AI Outfit, Product List, and customer pages no longer show old items.
delete from public.products;

insert into public.products (
  name,
  type,
  category,
  description,
  price,
  image_url,
  stock,
  low_stock_limit,
  rating,
  color,
  size,
  occasion,
  material,
  weather_tag,
  is_featured,
  is_active
)
values (
  'AIRism Cotton Oversized Crew Neck T-Shirt | Half Sleeve',
  'Unisex Tops',
  'Unisex',
  'Smooth oversized crew neck T-shirt for breathable everyday styling.',
  59.90,
  null,                         
  45,
  5,
  4.8,
  'Black',
  'M',
  'Casual',
  'AIRism cotton',
  'Warm',
  true,
  true
),
(
  'AIRism Cotton Pique Polo Shirt',
  'Men Tops',
  'Men',
  'Clean pique polo shirt for smart casual outfits and warm daily wear.',
  79.90,
  null,
  35,
  5,
  4.8,
  'Navy',
  'M',
  'Smart Casual',
  'AIRism cotton pique',
  'Warm',
  true,
  true
),
(
  'Ultra Stretch AIRism UV Protection Full-Zip Hoodie',
  'Women Hoodies',
  'Women',
  'Light stretch full-zip hoodie with UV protection for outdoor layering.',
  129.90,
  null,
  28,
  5,
  4.9,
  'Gray',
  'M',
  'Outdoor',
  'Ultra stretch AIRism',
  'Sunny',
  true,
  true
),
(
  'Sweat Pullover Hoodie',
  'Unisex Hoodies',
  'Unisex',
  'Soft pullover hoodie for casual layering and cooler surroundings.',
  149.90,
  null,
  30,
  5,
  4.9,
  'Navy',
  'M',
  'Casual',
  'Sweat cotton blend',
  'Cold',
  true,
  true
),
(
  'Drape Long Shirt | Long Sleeve',
  'Women Tops',
  'Women',
  'Relaxed long sleeve shirt with a soft drape for polished daily outfits.',
  99.90,
  null,
  25,
  5,
  4.9,
  'White',
  'M',
  'Smart Casual',
  'Drape fabric',
  'All weather',
  true,
  true
),
(
  'KIDS AIRism Cotton T-Shirt',
  'Kids Tops',
  'Kids',
  'Soft AIRism cotton T-shirt for breathable everyday comfort.',
  39.90,
  null,
  45,
  5,
  4.8,
  'White',
  '130',
  'Casual',
  'AIRism Cotton',
  'Hot',
  true,
  true
),
(
  'KIDS Cotton Crew Neck T-Shirt',
  'Kids Tops',
  'Kids',
  'Classic cotton crew neck T-shirt for simple daily styling.',
  29.90,
  null,
  50,
  5,
  4.7,
  'Black',
  '130',
  'Casual',
  'Cotton',
  'Warm',
  true,
  true
),
(
  'KIDS Dry Pique Short Sleeve Polo Shirt',
  'Kids Tops',
  'Kids',
  'Smart polo shirt with dry fabric for school and casual wear.',
  49.90,
  null,
  35,
  5,
  4.8,
  'Navy',
  '130',
  'Smart Casual',
  'Dry Pique',
  'Hot',
  true,
  true
),
(
  'KIDS Striped T-Shirt',
  'Kids Tops',
  'Kids',
  'Comfortable striped T-shirt for playful everyday outfits.',
  39.90,
  null,
  40,
  5,
  4.6,
  'Blue',
  '130',
  'Casual',
  'Cotton Blend',
  'Warm',
  true,
  true
),
(
  'KIDS Graphic T-Shirt',
  'Kids Tops',
  'Kids',
  'Fun graphic T-shirt that adds personality to casual looks.',
  39.90,
  null,
  42,
  5,
  4.8,
  'Green',
  '130',
  'Casual',
  'Cotton',
  'Warm',
  true,
  true
),
(
  'KIDS UT Graphic T-Shirt',
  'Kids Tops',
  'Kids',
  'Trendy UT graphic T-shirt with soft fabric for daily comfort.',
  49.90,
  null,
  38,
  5,
  4.7,
  'White',
  '130',
  'Casual',
  'Cotton',
  'Warm',
  true,
  true
),
(
  'KIDS AIRism UV Protection Mesh Hoodie',
  'Kids Tops',
  'Kids',
  'Lightweight mesh hoodie with UV protection for outdoor activities.',
  79.90,
  null,
  30,
  5,
  4.8,
  'Light Blue',
  '130',
  'Outdoor',
  'AIRism Mesh',
  'Hot',
  true,
  true
),
(
  'KIDS Sweat Hoodie',
  'Kids Tops',
  'Kids',
  'Cozy sweat hoodie for comfortable layering in cooler weather.',
  79.90,
  null,
  28,
  5,
  4.7,
  'Grey',
  '130',
  'Loungewear',
  'Sweat Fabric',
  'Cold',
  true,
  true
),
(
  'KIDS Sweat Pullover Hoodie',
  'Kids Tops',
  'Kids',
  'Soft pullover hoodie designed for relaxed and warm everyday wear.',
  89.90,
  null,
  25,
  5,
  4.8,
  'Pink',
  '130',
  'Casual',
  'Sweat Fabric',
  'Cold',
  true,
  true
),
(
  'KIDS Sweat Full-Zip Hoodie',
  'Kids Tops',
  'Kids',
  'Full-zip hoodie for easy layering and comfortable casual styling.',
  89.90,
  null,
  27,
  5,
  4.7,
  'Navy',
  '130',
  'Casual',
  'Sweat Fabric',
  'Cold',
  true,
  true
),
(
  'KIDS Dry-EX T-Shirt',
  'Kids Tops',
  'Kids',
  'Quick-dry T-shirt suitable for sports, playtime, and active days.',
  49.90,
  null,
  44,
  5,
  4.8,
  'Black',
  '130',
  'Active',
  'Dry-EX Fabric',
  'Hot',
  true,
  true
),
(
  'KIDS AIRism Cotton Sleeveless T-Shirt',
  'Kids Tops',
  'Kids',
  'Sleeveless AIRism cotton top for cool comfort in hot weather.',
  29.90,
  null,
  48,
  5,
  4.7,
  'Yellow',
  '130',
  'Summer',
  'AIRism Cotton',
  'Hot',
  true,
  true
),
(
  'KIDS Cotton Long Sleeve T-Shirt',
  'Kids Tops',
  'Kids',
  'Soft long sleeve cotton T-shirt for simple layering and comfort.',
  39.90,
  null,
  36,
  5,
  4.6,
  'Cream',
  '130',
  'Casual',
  'Cotton',
  'Cool',
  true,
  true
),
(
  'KIDS Flannel Checked Long Sleeve Shirt',
  'Kids Tops',
  'Kids',
  'Classic checked flannel shirt for warm and stylish casual outfits.',
  79.90,
  null,
  24,
  5,
  4.7,
  'Red',
  '130',
  'Casual',
  'Flannel',
  'Cold',
  true,
  true
),
(
  'KIDS Oxford Long Sleeve Shirt',
  'Kids Tops',
  'Kids',
  'Neat oxford shirt suitable for smart casual and family outings.',
  69.90,
  null,
  26,
  5,
  4.8,
  'White',
  '130',
  'Smart Casual',
  'Cotton Oxford',
  'Cool',
  true,
  true
),
(
  'KIDS Broadcloth Shirt',
  'Kids Tops',
  'Kids',
  'Lightweight broadcloth shirt with a clean look for polished outfits.',
  69.90,
  null,
  22,
  5,
  4.6,
  'Light Blue',
  '130',
  'Smart Casual',
  'Cotton Blend',
  'Cool',
  true,
  true
),
(
  'KIDS Printed Short Sleeve Shirt',
  'Kids Tops',
  'Kids',
  'Playful printed shirt perfect for cheerful casual styling.',
  59.90,
  null,
  33,
  5,
  4.7,
  'Orange',
  '130',
  'Casual',
  'Cotton',
  'Hot',
  true,
  true
),
(
  'KIDS Linen Blend Short Sleeve Shirt',
  'Kids Tops',
  'Kids',
  'Breathable linen blend shirt for breezy summer comfort.',
  69.90,
  null,
  29,
  5,
  4.6,
  'Natural',
  '130',
  'Summer',
  'Linen Blend',
  'Hot',
  true,
  true
),
(
  'KIDS Fleece Full-Zip Jacket',
  'Kids Tops',
  'Kids',
  'Warm fleece jacket for cozy layering during colder days.',
  79.90,
  null,
  31,
  5,
  4.8,
  'Brown',
  '130',
  'Outdoor',
  'Fleece',
  'Cold',
  true,
  true
),
(
  'KIDS Light Cotton Cardigan',
  'Kids Tops',
  'Kids',
  'Light cotton cardigan for comfortable layering and neat styling.',
  69.90,
  null,
  23,
  5,
  4.7,
  'Beige',
  '130',
  'Casual',
  'Cotton Knit',
  'Cool',
  true,
  true
),
(
  'KIDS Ribbed T-Shirt',
  'Kids Tops',
  'Kids',
  'Ribbed T-shirt with a soft texture for cute everyday looks.',
  39.90,
  null,
  37,
  5,
  4.7,
  'Pink',
  '130',
  'Casual',
  'Ribbed Cotton',
  'Warm',
  true,
  true
),
(
  'KIDS Waffle T-Shirt',
  'Kids Tops',
  'Kids',
  'Textured waffle T-shirt that gives a relaxed and cozy feel.',
  49.90,
  null,
  34,
  5,
  4.6,
  'Olive',
  '130',
  'Casual',
  'Waffle Cotton',
  'Warm',
  true,
  true
),
(
  'KIDS Pocket T-Shirt',
  'Kids Tops',
  'Kids',
  'Simple pocket T-shirt with soft fabric for everyday wear.',
  39.90,
  null,
  41,
  5,
  4.8,
  'Grey',
  '130',
  'Casual',
  'Cotton',
  'Warm',
  true,
  true
),
(
  'KIDS AIRism Cotton Oversized T-Shirt',
  'Kids Tops',
  'Kids',
  'Oversized AIRism cotton T-shirt for relaxed breathable styling.',
  49.90,
  null,
  32,
  5,
  4.8,
  'Purple',
  '130',
  'Streetwear',
  'AIRism Cotton',
  'Hot',
  true,
  true
),
(
  'KIDS UV Protection Cardigan',
  'Kids Tops',
  'Kids',
  'Light cardigan with UV protection for outdoor comfort and layering.',
  79.90,
  null,
  27,
  5,
  4.7,
  'Light Grey',
  '130',
  'Outdoor',
  'UV Protection Fabric',
  'Hot',
  true,
  true
);

create table if not exists public.orders (
  id uuid not null default gen_random_uuid(),
  customer_id uuid null,
  customer_name text null,
  customer_email text null,
  status text not null default 'pending',
  total_amount numeric not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint orders_pkey primary key (id),
  constraint orders_customer_id_fkey foreign key (customer_id) references public.users (id) on delete set null,
  constraint orders_status_check check (
    status = any (
      array['pending'::text, 'processing'::text, 'completed'::text, 'cancelled'::text]
    )
  ),
  constraint orders_total_amount_check check (total_amount >= 0)
) TABLESPACE pg_default;

alter table public.orders
add column if not exists customer_id uuid null;

alter table public.orders
add column if not exists customer_name text null;

alter table public.orders
add column if not exists customer_email text null;

alter table public.orders
add column if not exists status text not null default 'pending';

alter table public.orders
add column if not exists order_status text not null default 'pending';

alter table public.orders
add column if not exists payment_status text not null default 'unpaid';

alter table public.orders
add column if not exists total_amount numeric not null default 0;

alter table public.orders
add column if not exists created_at timestamp with time zone not null default now();

alter table public.orders
add column if not exists updated_at timestamp with time zone not null default now();

create index if not exists orders_status_created_at_idx
on public.orders (status, created_at desc);

create index if not exists orders_payment_status_idx
on public.orders (payment_status);

alter table public.orders disable row level security;

insert into public.orders (customer_name, customer_email, status, total_amount, created_at)
select
  seed.customer_name,
  seed.customer_email,
  seed.status,
  seed.total_amount,
  seed.created_at
from (
  values
    ('Aina Rahman', 'aina@example.com', 'pending', 219.80, now() - interval '6 hours'),
    ('Daniel Lee', 'daniel@example.com', 'completed', 149.90, now() - interval '2 days'),
    ('Nur Iman', 'iman@example.com', 'processing', 89.90, now() - interval '5 days'),
    ('Mei Tan', 'mei@example.com', 'completed', 329.70, now() - interval '18 days')
) as seed(customer_name, customer_email, status, total_amount, created_at)
where not exists (
  select 1
  from public.orders existing
  where existing.customer_email = seed.customer_email
    and existing.total_amount = seed.total_amount
);

create table if not exists public.order_items (
  id uuid not null default gen_random_uuid(),
  order_id uuid not null,
  product_id text null,
  product_name text not null,
  size text null,
  color text null,
  quantity integer not null default 1,
  price numeric not null default 0,
  unit_price numeric not null default 0,
  line_total numeric not null default 0,
  created_at timestamp with time zone not null default now(),
  constraint order_items_pkey primary key (id),
  constraint order_items_order_id_fkey foreign key (order_id) references public.orders (id) on delete cascade,
  constraint order_items_quantity_check check (quantity > 0),
  constraint order_items_price_check check (price >= 0),
  constraint order_items_unit_price_check check (unit_price >= 0),
  constraint order_items_line_total_check check (line_total >= 0)
) TABLESPACE pg_default;

alter table public.order_items
add column if not exists order_id uuid;

alter table public.order_items
add column if not exists product_id text null;

alter table public.order_items
add column if not exists product_name text;

alter table public.order_items
add column if not exists size text null;

alter table public.order_items
add column if not exists color text null;

alter table public.order_items
add column if not exists quantity integer not null default 1;

alter table public.order_items
add column if not exists price numeric not null default 0;

alter table public.order_items
add column if not exists unit_price numeric not null default 0;

alter table public.order_items
add column if not exists line_total numeric not null default 0;

alter table public.order_items
add column if not exists created_at timestamp with time zone not null default now();

create index if not exists order_items_order_id_idx
on public.order_items (order_id);

alter table public.order_items disable row level security;

create table if not exists public.mock_payments (
  id uuid not null default gen_random_uuid(),
  order_id uuid not null,
  customer_id uuid null,
  card_holder_name text not null,
  masked_card_number text not null,
  expiry_date text not null,
  amount numeric not null default 0,
  transaction_reference text not null,
  payment_status text not null default 'paid',
  created_at timestamp with time zone not null default now(),
  constraint mock_payments_pkey primary key (id),
  constraint mock_payments_order_id_fkey foreign key (order_id) references public.orders (id) on delete cascade,
  constraint mock_payments_customer_id_fkey foreign key (customer_id) references public.users (id) on delete set null,
  constraint mock_payments_transaction_reference_key unique (transaction_reference),
  constraint mock_payments_amount_check check (amount >= 0),
  constraint mock_payments_payment_status_check check (
    payment_status = any (
      array['paid'::text, 'failed'::text, 'pending'::text, 'refunded'::text]
    )
  )
) TABLESPACE pg_default;

alter table public.mock_payments
add column if not exists order_id uuid;

alter table public.mock_payments
add column if not exists customer_id uuid null;

alter table public.mock_payments
add column if not exists card_holder_name text;

alter table public.mock_payments
add column if not exists masked_card_number text;

alter table public.mock_payments
add column if not exists expiry_date text;

alter table public.mock_payments
add column if not exists amount numeric not null default 0;

alter table public.mock_payments
add column if not exists transaction_reference text;

alter table public.mock_payments
add column if not exists payment_status text not null default 'paid';

alter table public.mock_payments
add column if not exists created_at timestamp with time zone not null default now();

create index if not exists mock_payments_order_id_idx
on public.mock_payments (order_id);

create index if not exists mock_payments_customer_created_at_idx
on public.mock_payments (customer_id, created_at desc);

alter table public.mock_payments disable row level security;

create table if not exists public.order_deletion_requests (
  id uuid not null default gen_random_uuid(),
  order_id uuid not null,
  staff_id uuid not null,
  staff_name text null,
  reason text null,
  status text not null default 'pending',
  admin_note text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint order_deletion_requests_pkey primary key (id),
  constraint order_deletion_requests_order_id_fkey foreign key (order_id) references public.orders (id) on delete cascade,
  constraint order_deletion_requests_staff_id_fkey foreign key (staff_id) references public.users (id) on delete cascade,
  constraint order_deletion_requests_status_check check (
    status = any (
      array['pending'::text, 'approved'::text, 'rejected'::text]
    )
  )
) TABLESPACE pg_default;

alter table public.order_deletion_requests
add column if not exists order_id uuid;

alter table public.order_deletion_requests
add column if not exists staff_id uuid;

alter table public.order_deletion_requests
add column if not exists staff_name text null;

alter table public.order_deletion_requests
add column if not exists reason text null;

alter table public.order_deletion_requests
add column if not exists status text not null default 'pending';

alter table public.order_deletion_requests
add column if not exists admin_note text null;

alter table public.order_deletion_requests
add column if not exists created_at timestamp with time zone not null default now();

alter table public.order_deletion_requests
add column if not exists updated_at timestamp with time zone not null default now();

create index if not exists order_deletion_requests_staff_created_at_idx
on public.order_deletion_requests (staff_id, created_at desc);

create index if not exists order_deletion_requests_status_idx
on public.order_deletion_requests (status);

alter table public.order_deletion_requests disable row level security;

create table if not exists public.product_change_requests (
  id uuid not null default gen_random_uuid(),
  product_id text null,
  staff_id uuid null,
  staff_name text null,
  action text not null,
  status text not null default 'pending',
  product_name text null,
  current_data jsonb null,
  requested_data jsonb null,
  admin_note text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint product_change_requests_pkey primary key (id),
  constraint product_change_requests_staff_id_fkey foreign key (staff_id) references public.users (id) on delete set null,
  constraint product_change_requests_action_check check (
    action = any (
      array['add'::text, 'edit'::text, 'delete'::text, 'status'::text]
    )
  ),
  constraint product_change_requests_status_check check (
    status = any (
      array['pending'::text, 'approved'::text, 'rejected'::text]
    )
  )
) TABLESPACE pg_default;

alter table public.product_change_requests
drop constraint if exists product_change_requests_product_id_fkey;

alter table public.product_change_requests
add column if not exists product_id text null;

alter table public.product_change_requests
alter column product_id type text using product_id::text;

alter table public.product_change_requests
add column if not exists staff_id uuid null;

alter table public.product_change_requests
add column if not exists staff_name text null;

alter table public.product_change_requests
add column if not exists action text not null default 'edit';

alter table public.product_change_requests
add column if not exists status text not null default 'pending';

alter table public.product_change_requests
add column if not exists product_name text null;

alter table public.product_change_requests
add column if not exists current_data jsonb null;

alter table public.product_change_requests
add column if not exists requested_data jsonb null;

alter table public.product_change_requests
add column if not exists admin_note text null;

alter table public.product_change_requests
add column if not exists created_at timestamp with time zone not null default now();

alter table public.product_change_requests
add column if not exists updated_at timestamp with time zone not null default now();

create index if not exists product_change_requests_status_created_at_idx
on public.product_change_requests (status, created_at desc);

alter table public.product_change_requests disable row level security;

create table if not exists public.staff_notifications (
  id uuid not null default gen_random_uuid(),
  staff_id uuid null,
  title text not null,
  message text not null,
  type text not null default 'info',
  is_read boolean not null default false,
  created_at timestamp with time zone not null default now(),
  constraint staff_notifications_pkey primary key (id),
  constraint staff_notifications_staff_id_fkey foreign key (staff_id) references public.users (id) on delete cascade
) TABLESPACE pg_default;

alter table public.staff_notifications
add column if not exists staff_id uuid null;

alter table public.staff_notifications
add column if not exists title text;

alter table public.staff_notifications
add column if not exists message text;

alter table public.staff_notifications
add column if not exists type text not null default 'info';

alter table public.staff_notifications
add column if not exists is_read boolean not null default false;

alter table public.staff_notifications
add column if not exists created_at timestamp with time zone not null default now();

create index if not exists staff_notifications_staff_created_at_idx
on public.staff_notifications (staff_id, created_at desc);

alter table public.staff_notifications disable row level security;

create table if not exists public.customer_notifications (
  id uuid not null default gen_random_uuid(),
  customer_id uuid null,
  customer_email text null,
  order_id uuid null,
  title text not null,
  message text not null,
  type text not null default 'order_update',
  is_read boolean not null default false,
  created_at timestamp with time zone not null default now(),
  constraint customer_notifications_pkey primary key (id),
  constraint customer_notifications_customer_id_fkey foreign key (customer_id) references public.users (id) on delete cascade,
  constraint customer_notifications_order_id_fkey foreign key (order_id) references public.orders (id) on delete set null
) TABLESPACE pg_default;

alter table public.customer_notifications
add column if not exists customer_id uuid null;

alter table public.customer_notifications
add column if not exists customer_email text null;

alter table public.customer_notifications
add column if not exists order_id uuid null;

alter table public.customer_notifications
add column if not exists title text;

alter table public.customer_notifications
add column if not exists message text;

alter table public.customer_notifications
add column if not exists type text not null default 'order_update';

alter table public.customer_notifications
add column if not exists is_read boolean not null default false;

alter table public.customer_notifications
add column if not exists created_at timestamp with time zone not null default now();

create index if not exists customer_notifications_customer_created_at_idx
on public.customer_notifications (customer_id, created_at desc);

create index if not exists customer_notifications_email_created_at_idx
on public.customer_notifications (customer_email, created_at desc);

alter table public.customer_notifications disable row level security;

create table if not exists public.chat_conversations (
  id uuid not null default gen_random_uuid(),
  customer_id uuid null,
  customer_name text null,
  customer_email text null,
  last_message text null,
  last_sender text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint chat_conversations_pkey primary key (id),
  constraint chat_conversations_customer_id_fkey foreign key (customer_id) references public.users (id) on delete set null
) TABLESPACE pg_default;

alter table public.chat_conversations
add column if not exists customer_id uuid null;

alter table public.chat_conversations
add column if not exists customer_name text null;

alter table public.chat_conversations
add column if not exists customer_email text null;

alter table public.chat_conversations
add column if not exists last_message text null;

alter table public.chat_conversations
add column if not exists last_sender text null;

alter table public.chat_conversations
add column if not exists created_at timestamp with time zone not null default now();

alter table public.chat_conversations
add column if not exists updated_at timestamp with time zone not null default now();

create index if not exists chat_conversations_customer_updated_idx
on public.chat_conversations (customer_id, updated_at desc);

alter table public.chat_conversations disable row level security;

create table if not exists public.chat_messages (
  id uuid not null default gen_random_uuid(),
  conversation_id uuid not null,
  sender_id uuid null,
  sender_role text not null,
  chat_mode text not null default 'agent',
  message text not null,
  is_read boolean not null default false,
  created_at timestamp with time zone not null default now(),
  constraint chat_messages_pkey primary key (id),
  constraint chat_messages_conversation_id_fkey foreign key (conversation_id) references public.chat_conversations (id) on delete cascade,
  constraint chat_messages_sender_role_check check (
    sender_role = any (array['customer'::text, 'admin'::text, 'ai'::text])
  )
) TABLESPACE pg_default;

alter table public.chat_messages
add column if not exists conversation_id uuid;

alter table public.chat_messages
add column if not exists sender_id uuid null;

alter table public.chat_messages
add column if not exists sender_role text not null default 'customer';

alter table public.chat_messages
add column if not exists chat_mode text not null default 'agent';

alter table public.chat_messages
add column if not exists message text;

alter table public.chat_messages
add column if not exists is_read boolean not null default false;

alter table public.chat_messages
add column if not exists created_at timestamp with time zone not null default now();

do $$
declare
  chat_role_constraint record;
begin
  for chat_role_constraint in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'chat_messages'
      and con.contype = 'c'
      and (
        con.conname ilike '%sender_role%'
        or pg_get_constraintdef(con.oid) ilike '%sender_role%'
      )
  loop
    execute format('alter table public.chat_messages drop constraint if exists %I', chat_role_constraint.conname);
  end loop;
end $$;

alter table public.chat_messages
add constraint chat_messages_sender_role_check check (
  sender_role = any (array['customer'::text, 'admin'::text, 'ai'::text])
);

update public.chat_messages
set chat_mode = 'ai'
where sender_role = 'ai';

update public.chat_messages
set chat_mode = 'agent'
where chat_mode is null
  or chat_mode not in ('ai', 'agent');

do $$
declare
  chat_mode_constraint record;
begin
  for chat_mode_constraint in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'chat_messages'
      and con.contype = 'c'
      and (
        con.conname ilike '%chat_mode%'
        or pg_get_constraintdef(con.oid) ilike '%chat_mode%'
      )
  loop
    execute format('alter table public.chat_messages drop constraint if exists %I', chat_mode_constraint.conname);
  end loop;
end $$;

alter table public.chat_messages
add constraint chat_messages_chat_mode_check check (
  chat_mode = any (array['ai'::text, 'agent'::text])
);

create index if not exists chat_messages_conversation_created_idx
on public.chat_messages (conversation_id, created_at asc);

create index if not exists chat_messages_mode_created_idx
on public.chat_messages (conversation_id, chat_mode, created_at asc);

alter table public.chat_messages disable row level security;

select pg_notify('pgrst', 'reload schema');

create table if not exists public.admin_notifications (
  id uuid not null default gen_random_uuid(),
  title text not null,
  message text not null,
  type text not null default 'info',
  is_read boolean not null default false,
  created_at timestamp with time zone not null default now(),
  constraint admin_notifications_pkey primary key (id)
) TABLESPACE pg_default;

alter table public.admin_notifications
add column if not exists title text;

alter table public.admin_notifications
add column if not exists message text;

alter table public.admin_notifications
add column if not exists type text not null default 'info';

alter table public.admin_notifications
add column if not exists is_read boolean not null default false;

alter table public.admin_notifications
add column if not exists created_at timestamp with time zone not null default now();

create index if not exists admin_notifications_created_at_idx
on public.admin_notifications (created_at desc);

alter table public.admin_notifications disable row level security;

select
  'database setup complete' as status,
  exists (
    select 1
    from public.users
    where email = 'admin@smartfash.com'
      and role = 'admin'
  ) as admin_user_ready,
  exists (
    select 1
    from public.users
    where email = 'staff@smartfash.com'
      and role = 'staff'
  ) as staff_user_ready;
