-- Recovered verbatim (2026-11-11) from the applied migration history.
-- handle_new_user() is a trigger function only; nothing should be able to
-- call it over the REST RPC surface. Revoke EXECUTE from the API roles
-- (the trigger itself still fires). Closes Supabase advisor 0028/0029.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Same treatment for the platform-provided event-trigger helper that ships
-- in this project's public schema.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

-- set_updated_at() is SECURITY INVOKER but is likewise only ever a trigger.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
