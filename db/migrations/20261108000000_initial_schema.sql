-- Esquema inicial de Start Tank (10 entidades de la especificacion, seccion 6).

create table usuario (
  id_usuario bigint generated always as identity primary key,
  proveedor_oauth varchar not null,
  id_externo varchar not null,
  correo varchar,
  nombre varchar,
  rubro varchar,
  saldo_actual numeric(14,2) not null default 10000 check (saldo_actual >= 0),
  estado varchar not null default 'ACTIVO',
  creado_en timestamptz not null default now(),
  unique (proveedor_oauth, id_externo)
);

create table jurado (
  id_jurado bigint generated always as identity primary key,
  codigo_acceso varchar not null unique,
  nombre varchar not null,
  organizacion varchar,
  creado_en timestamptz not null default now()
);

create table operador (
  id_operador bigint generated always as identity primary key,
  codigo_acceso varchar not null unique,
  nombre varchar not null,
  creado_en timestamptz not null default now()
);

create table startup (
  id_startup bigint generated always as identity primary key,
  nombre varchar not null,
  ods varchar,
  orden_presentacion smallint not null unique,
  descripcion varchar
);

create table ronda (
  id_ronda bigint generated always as identity primary key,
  id_startup bigint not null unique references startup,
  numero smallint not null unique,
  estado varchar not null default 'PROGRAMADA'
    check (estado in ('PROGRAMADA','ABIERTA','ULTIMA_LLAMADA','CERRADA','EN_VOTACION','LIQUIDADA','ANULADA')),
  multiplicador numeric(6,3),
  ultima_llamada_en timestamptz,
  abierta_en timestamptz,
  cerrada_en timestamptz,
  liquidada_en timestamptz
);

create table inversion (
  id_inversion bigint generated always as identity primary key,
  id_usuario bigint not null references usuario,
  id_ronda bigint not null references ronda,
  monto numeric(14,2) not null check (monto > 0),
  precio_momento numeric(8,2) not null,
  retorno numeric(14,2),
  estado varchar not null default 'REGISTRADA',
  creada_en timestamptz not null default now()
);
create index on inversion (id_ronda, id_usuario);

create table veredicto (
  id_veredicto bigint generated always as identity primary key,
  id_jurado bigint not null references jurado,
  id_ronda bigint not null references ronda,
  decision varchar not null check (decision in ('RESPALDA','RECHAZA','SE_ABSTIENE')),
  emitido_en timestamptz not null default now(),
  unique (id_jurado, id_ronda)
);

create table accion_ronda (
  id_accion bigint generated always as identity primary key,
  id_operador bigint not null references operador,
  id_ronda bigint not null references ronda,
  accion varchar not null,
  ejecutada_en timestamptz not null default now()
);

create table leaderboard (
  id_leaderboard bigint generated always as identity primary key,
  id_ronda bigint not null references ronda,
  id_usuario bigint not null references usuario,
  posicion smallint not null,
  saldo numeric(14,2) not null,
  ganancia_ronda numeric(14,2) not null default 0,
  aciertos smallint not null default 0,
  actualizado_en timestamptz not null default now(),
  unique (id_ronda, id_usuario)
);

create table startup_leaderboard (
  id_startup_leaderboard bigint generated always as identity primary key,
  id_ronda bigint not null unique references ronda,
  id_startup bigint not null references startup,
  monto_acumulado numeric(14,2) not null default 0,
  inversores_unicos integer not null default 0,
  precio_vivo numeric(8,2) not null default 100,
  fraccion_respaldo numeric(5,4),
  puntaje numeric(5,4),
  actualizado_en timestamptz not null default now()
);
