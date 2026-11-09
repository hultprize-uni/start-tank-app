-- Datos de ejemplo para desarrollo local.
--
-- Contiene cinco startups con sus rondas, la fila inicial de precio vivo de cada ronda,
-- cuatro jurados y un operador. Los códigos de acceso son valores ficticios y no deben
-- utilizarse en un entorno productivo.
--
-- Cada inserción omite las filas existentes, de modo que el script puede ejecutarse varias veces.

-- Startups en orden de presentación.
insert into startup (nombre, ods, orden_presentacion, descripcion) values
  ('AgroSense', 'ODS 2', 1, 'Monitoreo de cultivos con sensores de bajo costo para pequeños productores.'),
  ('AguaClara', 'ODS 6', 2, 'Filtros comunitarios de agua con seguimiento de calidad en tiempo real.'),
  ('EduRuta', 'ODS 4', 3, 'Rutas de aprendizaje personalizadas para estudiantes de educación básica.'),
  ('SolRed', 'ODS 7', 4, 'Microrredes solares para comunidades sin acceso estable a la electricidad.'),
  ('SaludCerca', 'ODS 3', 5, 'Telemedicina de primer contacto para zonas rurales.')
on conflict (orden_presentacion) do nothing;

-- Una ronda por startup. El número de ronda coincide con el orden de presentación.
insert into ronda (id_startup, numero)
select s.id_startup, s.orden_presentacion
  from startup s
on conflict do nothing;

-- Fila de precio vivo inicial de cada ronda, con precio 100.
insert into startup_leaderboard (id_ronda, id_startup)
select r.id_ronda, r.id_startup
  from ronda r
on conflict (id_ronda) do nothing;

-- Jurados de ejemplo.
insert into jurado (codigo_acceso, nombre, organizacion) values
  ('JUR-EJ-001', 'Jurado de ejemplo 1', 'Organización de ejemplo A'),
  ('JUR-EJ-002', 'Jurado de ejemplo 2', 'Organización de ejemplo B'),
  ('JUR-EJ-003', 'Jurado de ejemplo 3', 'Organización de ejemplo C'),
  ('JUR-EJ-004', 'Jurado de ejemplo 4', 'Organización de ejemplo D')
on conflict (codigo_acceso) do nothing;

-- Operador de ejemplo.
insert into operador (codigo_acceso, nombre) values
  ('OPE-EJ-001', 'Operador de ejemplo')
on conflict (codigo_acceso) do nothing;
