insert into public.categories (name, slug, sort_order)
values
  ('People', 'people', 0),
  ('Landscape', 'landscape', 1),
  ('Birds', 'birds', 2),
  ('Animals', 'animals', 3),
  ('Sailing', 'sailing', 4),
  ('City', 'city', 5),
  ('Plants', 'plants', 6),
  ('Other', 'other', 7)
on conflict (slug) do update
set name = excluded.name,
    sort_order = excluded.sort_order;
