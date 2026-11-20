-- Liquidación manual de rondas (modo manual del operador).
--
-- Permite liquidar una ronda cuando el voto digital falla. El operador indica la cantidad de
-- respaldos (0 a la cantidad de jurados) y la función deriva el multiplicador con la misma regla
-- que fn_revelar_veredicto:
--   fracción de respaldo = respaldos / jurados
--   multiplicador        = 0.2 + 1.6 x fracción de respaldo
--
-- La liquidación delega en fn_liquidar_ronda y no modifica esa función. Solo admite rondas en
-- estado CERRADA o EN_VOTACION.
--
-- Devuelve jsonb con las claves ok, error (solo en caso de fallo), multiplicador y
-- fraccion_respaldo. La acción se registra en accion_ronda como REVELAR_MANUAL.

create or replace function fn_liquidar_manual(
  p_operador bigint,
  p_ronda bigint,
  p_respaldos integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado_ronda varchar;
  v_jurados integer;
  v_fraccion numeric;
  v_multiplicador numeric(6,3);
  v_activos integer;
  v_inversores integer;
begin
  if not exists (select 1 from operador o where o.id_operador = p_operador) then
    return jsonb_build_object('ok', false, 'error', 'OPERADOR_NO_EXISTE');
  end if;

  -- Bloqueo exclusivo de la ronda durante toda la liquidación.
  select r.estado
    into v_estado_ronda
    from ronda r
   where r.id_ronda = p_ronda
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'RONDA_NO_EXISTE');
  end if;

  if v_estado_ronda = 'LIQUIDADA' then
    return jsonb_build_object('ok', false, 'error', 'RONDA_YA_LIQUIDADA');
  end if;

  if v_estado_ronda not in ('CERRADA', 'EN_VOTACION') then
    return jsonb_build_object('ok', false, 'error', 'RONDA_NO_DISPONIBLE');
  end if;

  select count(*) into v_jurados from jurado;

  -- La cantidad de respaldos debe estar entre 0 y el número de jurados. Sin jurados no existe
  -- fracción de respaldo que calcular.
  if p_respaldos is null or p_respaldos < 0 or v_jurados = 0 or p_respaldos > v_jurados then
    return jsonb_build_object('ok', false, 'error', 'RESPALDOS_INVALIDOS');
  end if;

  v_fraccion := p_respaldos::numeric / v_jurados;
  v_multiplicador := round(0.2 + 1.6 * v_fraccion, 3);

  -- Liquidación de inversiones, saldos, leaderboard y estado de la ronda.
  perform fn_liquidar_ronda(p_ronda, v_multiplicador, 'LIQUIDADA', p_respaldos >= 3);

  -- Fila de la startup, si aún no existe, y actualización de su fracción de respaldo y puntaje.
  insert into startup_leaderboard (id_ronda, id_startup)
  select r.id_ronda, r.id_startup
    from ronda r
   where r.id_ronda = p_ronda
  on conflict (id_ronda) do nothing;

  select count(*) into v_activos from usuario u where u.estado = 'ACTIVO';

  select sl.inversores_unicos
    into v_inversores
    from startup_leaderboard sl
   where sl.id_ronda = p_ronda;

  update startup_leaderboard sl
     set fraccion_respaldo = round(v_fraccion, 4),
         puntaje = round(
           0.6 * v_fraccion
           + 0.4 * (case when v_activos > 0 then v_inversores::numeric / v_activos else 0 end),
           4),
         actualizado_en = now()
   where sl.id_ronda = p_ronda;

  insert into accion_ronda (id_operador, id_ronda, accion)
  values (p_operador, p_ronda, 'REVELAR_MANUAL');

  return jsonb_build_object(
    'ok', true,
    'multiplicador', v_multiplicador,
    'fraccion_respaldo', round(v_fraccion, 4)
  );
end;
$$;

-- Acceso restringido: la función la invoca el servidor de la aplicación con el rol propietario,
-- que valida la sesión del operador antes de llamarla.
revoke all on function fn_liquidar_manual(bigint, bigint, integer) from public;
