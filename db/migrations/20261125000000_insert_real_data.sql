-- Inserción de data real para los jurados y las startups correspondientes
--
-- Cada inserción omite las filas existentes, de modo que la migración puede repetirse.

-- Startups en orden de pitcheo.
insert into startup (nombre, orden_presentacion) values
  ('Monedita', 1),
  ('Rockie OS', 2),
  ('Provdu', 3),
  ('Agrolif', 4),
  ('Tracta', 5)
on conflict (orden_presentacion) do nothing;

-- Una ronda por startup. El número de ronda coincide con el orden de presentación.
insert into ronda (id_startup, numero)
select s.id_startup, s.orden_presentacion
  from startup s
on conflict do nothing;

-- Fila de precio vivo inicial de cada ronda.
insert into startup_leaderboard (id_ronda, id_startup)
select r.id_ronda, r.id_startup
  from ronda r
on conflict (id_ronda) do nothing;

-- Jurados.
insert into jurado (codigo_acceso, nombre) values
  ('GABRIELLE', 'Gabrielle Peñavasquez'),
  ('PAUL', 'Paul Mendoza'),
  ('ALONSO', 'Alonso Palacios'),
  ('EMANOEL', 'Emanoel Palacios')
on conflict (codigo_acceso) do nothing;

-- Operadores (rol CONDUCTOR por defecto).
insert into operador (codigo_acceso, nombre) values
  ('ELISEO', 'Eliseo'),
  ('RENATO', 'Renato')
on conflict (codigo_acceso) do nothing;
