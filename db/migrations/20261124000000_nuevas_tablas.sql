-- Tablas nuevas del rediseño (BASES.md y DATABASE.md, sección 2).
--
--   criterio       Los criterios con que el jurado califica, con su peso y las frases de referencia
--                  de la nota 1 y de la nota 5.
--   nota_criterio  La nota de 1 a 5 que un jurado dio a un criterio al enviar su veredicto.
--   borrador_nota  La última nota que un jurado puso en cada criterio antes de enviar. Cada nota
--                  nueva reemplaza a la anterior.
--   configuracion  Parámetros del evento (límites del dinero, duración de las fases) y banderas del
--                  sistema (evento_iniciado, modo_manual).

-- Todas las sentencias omiten lo que ya existe, de modo que la migración puede repetirse si una
-- ejecución anterior quedó a medias.

create table if not exists criterio (
  id_criterio bigint generated always as identity primary key,
  nombre varchar not null unique,
  peso numeric(4,3) not null check (peso > 0 and peso <= 1),
  ancla_min varchar not null,
  ancla_max varchar not null
);

create table if not exists configuracion (
  clave varchar primary key,
  valor varchar not null
);

create table if not exists nota_criterio (
  id_veredicto bigint not null references veredicto on delete cascade,
  id_criterio bigint not null references criterio,
  valor smallint not null check (valor between 1 and 5),
  primary key (id_veredicto, id_criterio)
);

create table if not exists borrador_nota (
  id_jurado bigint not null references jurado,
  id_ronda bigint not null references ronda,
  id_criterio bigint not null references criterio,
  valor smallint not null check (valor between 1 and 5),
  primary key (id_jurado, id_ronda, id_criterio)
);

-- Lee un parámetro numérico de configuracion. Si la clave no existe, devuelve el valor por
-- omisión, de modo que las funciones operan aunque el seed no se haya aplicado.
create or replace function fn_config_num(p_clave varchar, p_defecto numeric)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(
    (select c.valor::numeric from configuracion c where c.clave = p_clave),
    p_defecto
  )
$$;
