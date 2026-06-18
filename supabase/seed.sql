-- Shared exercise catalog (owner is null = visible to everyone).
insert into public.exercises (owner, name, primary_muscle, equipment, is_compound) values
  (null, 'Back Squat',       'quads',      'barbell',   true),
  (null, 'Bench Press',      'chest',      'barbell',   true),
  (null, 'Deadlift',         'back',       'barbell',   true),
  (null, 'Overhead Press',   'shoulders',  'barbell',   true),
  (null, 'Barbell Row',      'back',       'barbell',   true),
  (null, 'Pull-up',          'back',       'bodyweight',true),
  (null, 'Romanian Deadlift','hamstrings', 'barbell',   true),
  (null, 'Lat Pulldown',     'back',       'cable',     false),
  (null, 'Dumbbell Curl',    'biceps',     'dumbbell',  false),
  (null, 'Triceps Pushdown', 'triceps',    'cable',     false),
  (null, 'Leg Press',        'quads',      'machine',   true),
  (null, 'Lateral Raise',    'shoulders',  'dumbbell',  false)
on conflict do nothing;
