select
  trigger_name,
  event_object_schema,
  event_object_table,
  action_statement
from information_schema.triggers
where event_object_schema = 'auth'
  and event_object_table = 'users';

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists handle_new_user on auth.users;
drop trigger if exists create_profile_for_user on auth.users;
drop trigger if exists sync_user_profile_after_auth_write on auth.users;
drop trigger if exists sync_user_profile_after_insert on auth.users;

drop function if exists public.handle_new_user();
drop function if exists public.create_profile_for_user();
