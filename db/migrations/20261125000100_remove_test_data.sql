-- Elimina los datos de ejemplo de seed.sql (JUR-EJ-*, OPE-EJ-*, AgroSense...) y deja los reales.
--
-- Se borra también todo lo que cuelga de los datos de ejemplo (veredictos, notas, inversiones,
-- acciones, rondas). Los jurados y operadores reales que aún no tienen actividad se borran y se
-- reinsertan al final, para que, si la tabla quedó sin filas, sus ids vuelvan a empezar en 1 y no
-- queden como jurado 5, 6... Los que ya tienen actividad se conservan. Repetible.

-- Startups de ejemplo y todo lo que depende de sus rondas.
drop table if exists _ronda_prueba;
create temp table _ronda_prueba as
select r.id_ronda, r.id_startup
  from ronda r
  join startup s using (id_startup)
 where s.nombre in ('AgroSense', 'AguaClara', 'EduRuta', 'SolRed', 'SaludCerca');

delete from veredicto where id_ronda in (select id_ronda from _ronda_prueba); -- arrastra nota_criterio
delete from borrador_nota where id_ronda in (select id_ronda from _ronda_prueba);
delete from accion_ronda where id_ronda in (select id_ronda from _ronda_prueba);
delete from inversion where id_ronda in (select id_ronda from _ronda_prueba);
delete from leaderboard where id_ronda in (select id_ronda from _ronda_prueba);
delete from startup_leaderboard where id_ronda in (select id_ronda from _ronda_prueba);
delete from ronda where id_ronda in (select id_ronda from _ronda_prueba);
delete from startup where id_startup in (select id_startup from _ronda_prueba);
drop table _ronda_prueba;

-- Jurados: los de ejemplo con su actividad, y los reales sin actividad.
delete from veredicto where id_jurado in (select id_jurado from jurado where codigo_acceso like 'JUR-EJ-%');
delete from borrador_nota where id_jurado in (select id_jurado from jurado where codigo_acceso like 'JUR-EJ-%');
delete from jurado j
 where j.codigo_acceso like 'JUR-EJ-%'
    or (not exists (select 1 from veredicto v where v.id_jurado = j.id_jurado)
        and not exists (select 1 from borrador_nota b where b.id_jurado = j.id_jurado));

-- Operadores: igual.
delete from accion_ronda where id_operador in (select id_operador from operador where codigo_acceso like 'OPE-EJ-%');
delete from operador o
 where o.codigo_acceso like 'OPE-EJ-%'
    or not exists (select 1 from accion_ronda a where a.id_operador = o.id_operador);

-- Reinicia los ids solo en las tablas que quedaron vacías (así los reales parten en 1).
do $$
declare t record;
begin
  for t in select * from (values ('startup', 'id_startup'), ('ronda', 'id_ronda'),
                                 ('startup_leaderboard', 'id_startup_leaderboard'),
                                 ('jurado', 'id_jurado'), ('operador', 'id_operador')) as x(tabla, col)
  loop
    execute format(
      'select setval(pg_get_serial_sequence(%L, %L), 1, false) where not exists (select 1 from %I)',
      t.tabla, t.col, t.tabla);
  end loop;
end $$;

-- Data real (la misma de 20261125000000_insert_real_data.sql).
insert into startup (nombre, orden_presentacion) values
  ('Monedita', 1),
  ('Rockie OS', 2),
  ('Provdu', 3),
  ('Agrolif', 4),
  ('Tracta', 5)
on conflict (orden_presentacion) do nothing;

insert into ronda (id_startup, numero)
select s.id_startup, s.orden_presentacion from startup s
on conflict do nothing;

insert into startup_leaderboard (id_ronda, id_startup)
select r.id_ronda, r.id_startup from ronda r
on conflict (id_ronda) do nothing;

insert into jurado (codigo_acceso, nombre) values
  ('GABRIELLE', 'Gabrielle Peñavasquez'),
  ('PAUL', 'Paul Mendoza'),
  ('ALONSO', 'Alonso Palacios'),
  ('EMANOEL', 'Emanoel Palacios')
on conflict (codigo_acceso) do nothing;

insert into operador (codigo_acceso, nombre) values
  ('ELISEO', 'Eliseo'),
  ('RENATO', 'Renato')
on conflict (codigo_acceso) do nothing;
