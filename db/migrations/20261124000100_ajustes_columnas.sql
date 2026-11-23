-- Ajustes de columnas del rediseño (DATABASE.md, sección 2.2).
--
-- Agrega las columnas nuevas, reemplaza las que cambian de significado y retira las que ninguna
-- vista usa. Las funciones SQL que dependen de estas columnas se reescriben en las migraciones
-- siguientes.
--
-- Todas las sentencias omiten lo que ya se aplicó, de modo que la migración puede repetirse si una
-- ejecución anterior quedó a medias.
--
-- Las reglas anteriores permitían varias compras del mismo asistente en una ronda. Antes de
-- imponer una sola inversión por asistente y ronda, esas compras se fusionan en una fila: suma de
-- montos, precio promedio ponderado por monto y suma de retornos. Los saldos no cambian, porque
-- cada compra ya se había descontado.

-- veredicto: se_abstiene y puntaje reemplazan a decision.
alter table veredicto add column if not exists se_abstiene boolean not null default false;
alter table veredicto add column if not exists puntaje numeric(4,3) check (puntaje between 1 and 5);

do $$
begin
  -- Solo si decision aún existe; después de retirarla ya no hay nada que convertir.
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'veredicto' and column_name = 'decision'
  ) then
    execute 'update veredicto set se_abstiene = (decision = ''SE_ABSTIENE'')';
  end if;

  if not exists (select 1 from pg_constraint where conname = 'veredicto_abstencion_sin_puntaje') then
    alter table veredicto add constraint veredicto_abstencion_sin_puntaje
      check (not se_abstiene or puntaje is null);
  end if;
end $$;

alter table veredicto drop column if exists decision;

-- inversion: una sola inversión por asistente y ronda.
with grupos as (
  select min(id_inversion) as id_conservada,
         id_usuario,
         id_ronda,
         sum(monto) as monto,
         round(sum(monto * precio_momento) / sum(monto), 2) as precio,
         case when count(retorno) = 0 then null else sum(retorno) end as retorno
    from inversion
   group by id_usuario, id_ronda
  having count(*) > 1
), conservadas as (
  update inversion i
     set monto = g.monto, precio_momento = g.precio, retorno = g.retorno
    from grupos g
   where i.id_inversion = g.id_conservada
  returning i.id_inversion
)
delete from inversion i
 using grupos g
 where i.id_usuario = g.id_usuario
   and i.id_ronda = g.id_ronda
   and i.id_inversion <> g.id_conservada;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'inversion_usuario_ronda_key') then
    alter table inversion add constraint inversion_usuario_ronda_key unique (id_usuario, id_ronda);
  end if;
end $$;

-- startup_leaderboard: puntaje_jurado reemplaza a fraccion_respaldo.
alter table startup_leaderboard add column if not exists puntaje_jurado numeric(5,4)
  check (puntaje_jurado between 1 and 5);
alter table startup_leaderboard drop column if exists fraccion_respaldo;
alter table startup_leaderboard drop column if exists actualizado_en;

-- leaderboard.
alter table leaderboard drop column if exists actualizado_en;

-- usuario: ultima_conexion reemplaza a estado; se retiran rubro y creado_en.
alter table usuario add column if not exists ultima_conexion timestamptz;
alter table usuario drop column if exists rubro;
alter table usuario drop column if exists estado;
alter table usuario drop column if exists creado_en;

-- jurado.
alter table jurado add column if not exists ultima_conexion timestamptz;
alter table jurado drop column if exists creado_en;

-- operador: rol del operador. Los operadores existentes pasan a ser conductores.
alter table operador add column if not exists rol varchar not null default 'CONDUCTOR'
  check (rol in ('CONDUCTOR', 'SOPORTE'));
alter table operador drop column if exists creado_en;

-- startup.
alter table startup add column if not exists logo_url varchar;

-- ronda: hora del servidor en que termina la fase actual y, si la ronda está en pausa, los
-- segundos que faltaban al pausar.
alter table ronda add column if not exists fase_termina_en timestamptz;
alter table ronda add column if not exists segundos_restantes_pausa integer
  check (segundos_restantes_pausa >= 0);

-- accion_ronda: motivo de los ajustes y de los rescates.
alter table accion_ronda add column if not exists motivo varchar;
