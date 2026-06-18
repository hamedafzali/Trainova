-- Shared library (owner null = visible to everyone). Mirrors src/lib/seed.ts.
insert into public.devices (id, owner, name, machine_number, category, primary_muscle) values
  ('00000000-0000-0000-0000-000000000022', null, 'Leg Press',            '22', 'machine',     'quads'),
  ('00000000-0000-0000-0000-000000000025', null, 'Seated Leg Curl',      '25', 'machine',     'hamstrings'),
  ('00000000-0000-0000-0000-000000000026', null, 'Seated Leg Extension', '26', 'machine',     'quads'),
  ('00000000-0000-0000-0000-000000000004', null, 'Lat Pulldown',         '4',  'machine',     'back'),
  ('00000000-0000-0000-0000-000000000007', null, 'Seated Row',           '7',  'machine',     'back'),
  ('00000000-0000-0000-0000-000000000001', null, 'Chest Press',          '1',  'machine',     'chest'),
  ('00000000-0000-0000-0000-000000000012', null, 'Back Extension',       '12', 'machine',     'lower back'),
  ('00000000-0000-0000-0000-000000000011', null, 'Abdominal',            '11', 'machine',     'abs'),
  ('00000000-0000-0000-0000-0000000000bb', null, 'Barbell',              null, 'free_weight', null),
  ('00000000-0000-0000-0000-0000000000db', null, 'Dumbbell',             null, 'free_weight', null),
  ('00000000-0000-0000-0000-0000000000ca', null, 'Cable Tower',          null, 'cable',       null),
  ('00000000-0000-0000-0000-0000000000fe', null, 'Pull-up Bar',          null, 'bodyweight',  null)
on conflict (id) do nothing;
