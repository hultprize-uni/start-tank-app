-- Políticas de seguridad a nivel de fila (especificación, sección 6).
--
-- Las tablas de lectura pública (ronda, startup, startup_leaderboard y leaderboard) admiten
-- lectura para los roles anon y authenticated. Las demás tablas no tienen políticas para
-- estos roles, de modo que quedan inaccesibles desde el cliente.
--
-- Las escrituras se realizan exclusivamente mediante funciones con SECURITY DEFINER, que
-- se invocan con el rol service_role. Por ese motivo se retiran los privilegios de escritura
-- directa a los roles anon y authenticated.

-- Activación de RLS en todas las tablas del esquema.
alter table usuario enable row level security;
alter table jurado enable row level security;
alter table operador enable row level security;
alter table startup enable row level security;
alter table ronda enable row level security;
alter table inversion enable row level security;
alter table veredicto enable row level security;
alter table accion_ronda enable row level security;
alter table leaderboard enable row level security;
alter table startup_leaderboard enable row level security;

-- Lectura pública de las tablas de exhibición.
create policy ronda_lectura_publica
  on ronda for select
  to anon, authenticated
  using (true);

create policy startup_lectura_publica
  on startup for select
  to anon, authenticated
  using (true);

create policy startup_leaderboard_lectura_publica
  on startup_leaderboard for select
  to anon, authenticated
  using (true);

create policy leaderboard_lectura_publica
  on leaderboard for select
  to anon, authenticated
  using (true);

-- Retiro de los privilegios de escritura directa para los roles de cliente.
revoke insert, update, delete, truncate on
  usuario, jurado, operador, startup, ronda, inversion, veredicto,
  accion_ronda, leaderboard, startup_leaderboard
  from anon, authenticated;
