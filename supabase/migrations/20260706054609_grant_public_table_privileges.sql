-- Tables created through SQL need explicit privileges in addition to RLS.
-- Without these grants, PostgREST returns "permission denied for table ...".

grant usage on schema public to anon, authenticated, service_role;

grant select on public.photos to anon, authenticated;
grant select on public.about to anon, authenticated;

grant insert, update, delete on public.photos to authenticated;
grant insert, update, delete on public.about to authenticated;

grant all on public.photos to service_role;
grant all on public.about to service_role;
