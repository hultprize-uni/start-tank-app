-- Registro de inversiones, versión 2 (RF-12 y RF-13, DATABASE.md sección 3, paso 4).
--
-- Cambios respecto a la versión anterior:
--   - Una sola inversión por asistente y ronda (error YA_INVIRTIO).
--   - Rechaza inversiones con la ronda en pausa (error MERCADO_EN_PAUSA) o con la última llamada
--     vencida, aunque nadie haya cerrado todavía la ronda.
--   - El mínimo, el tope y el rango de precio salen de la tabla configuracion.
--   - El tope se calcula sobre el saldo con que el asistente abrió la ronda. Como solo puede
--     invertir una vez, ese saldo es su saldo actual.
--
-- Orden de bloqueos: primero la ronda (FOR SHARE), luego el usuario (FOR UPDATE) y por último
-- la fila de startup_leaderboard (FOR UPDATE). Las liquidaciones siguen el mismo orden.
--
-- Las validaciones se ejecutan antes de cualquier escritura. Si una falla, la función devuelve
-- ok = false y ninguna fila cambia.
--
-- Devuelve jsonb con las claves ok, error (solo en caso de fallo), saldo y, cuando se supera el
-- tope, tope.

create or replace function fn_registrar_inversion(
  p_usuario bigint,
  p_ronda bigint,
  p_monto numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado_ronda varchar;
  v_pausa integer;
  v_fin timestamptz;
  v_id_startup bigint;
  v_saldo numeric(14,2);
  v_tope numeric(14,2);
  v_precio_vivo numeric(8,2);
  v_inversores integer;
  v_saldo_final numeric(14,2);
begin
  if p_monto is null or p_monto < fn_config_num('compra_minima', 250) then
    return jsonb_build_object('ok', false, 'error', 'MONTO_MINIMO', 'saldo', null);
  end if;

  -- Se bloquea la ronda en modo compartido para impedir que se cierre durante el registro.
  select r.estado, r.segundos_restantes_pausa, r.fase_termina_en, r.id_startup
    into v_estado_ronda, v_pausa, v_fin, v_id_startup
    from ronda r
   where r.id_ronda = p_ronda
     for share;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'RONDA_NO_EXISTE', 'saldo', null);
  end if;

  if v_estado_ronda not in ('ABIERTA', 'ULTIMA_LLAMADA') then
    return jsonb_build_object('ok', false, 'error', 'RONDA_NO_ABIERTA', 'saldo', null);
  end if;

  if v_pausa is not null then
    return jsonb_build_object('ok', false, 'error', 'MERCADO_EN_PAUSA', 'saldo', null);
  end if;

  -- Última llamada vencida: el mercado ya cerró aunque el estado aún no se haya actualizado.
  if v_estado_ronda = 'ULTIMA_LLAMADA' and v_fin is not null and v_fin <= now() then
    return jsonb_build_object('ok', false, 'error', 'RONDA_NO_ABIERTA', 'saldo', null);
  end if;

  -- Bloqueo del usuario. Evita el doble gasto cuando una persona pulsa Invertir dos veces.
  select u.saldo_actual
    into v_saldo
    from usuario u
   where u.id_usuario = p_usuario
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'USUARIO_NO_EXISTE', 'saldo', null);
  end if;

  if exists (
    select 1 from inversion i where i.id_usuario = p_usuario and i.id_ronda = p_ronda
  ) then
    return jsonb_build_object('ok', false, 'error', 'YA_INVIRTIO', 'saldo', v_saldo);
  end if;

  v_tope := round(v_saldo * fn_config_num('tope_ronda', 0.30), 2);
  if p_monto > v_tope then
    return jsonb_build_object('ok', false, 'error', 'TOPE_RONDA_SUPERADO', 'saldo', v_saldo, 'tope', v_tope);
  end if;

  if p_monto > v_saldo then
    return jsonb_build_object('ok', false, 'error', 'SALDO_INSUFICIENTE', 'saldo', v_saldo);
  end if;

  -- Fila de precio vivo de la ronda. Se crea si no existe y luego se bloquea.
  insert into startup_leaderboard (id_ronda, id_startup)
  values (p_ronda, v_id_startup)
  on conflict (id_ronda) do nothing;

  select sl.precio_vivo
    into v_precio_vivo
    from startup_leaderboard sl
   where sl.id_ronda = p_ronda
     for update;

  insert into inversion (id_usuario, id_ronda, monto, precio_momento)
  values (p_usuario, p_ronda, p_monto, v_precio_vivo);

  update usuario
     set saldo_actual = saldo_actual - p_monto
   where id_usuario = p_usuario
  returning saldo_actual into v_saldo_final;

  -- El precio depende del monto acumulado, no del número de operaciones, y se acota al rango
  -- configurado.
  select count(distinct i.id_usuario)
    into v_inversores
    from inversion i
   where i.id_ronda = p_ronda;

  update startup_leaderboard sl
     set monto_acumulado = sl.monto_acumulado + p_monto,
         inversores_unicos = v_inversores,
         precio_vivo = least(
           fn_config_num('precio_max', 200),
           greatest(
             fn_config_num('precio_min', 50),
             round(100 + (sl.monto_acumulado + p_monto) / 2000, 2)
           )
         )
   where sl.id_ronda = p_ronda;

  return jsonb_build_object('ok', true, 'saldo', v_saldo_final);
exception
  when unique_violation then
    -- Cubre dos inversiones simultáneas del mismo asistente: la restricción única rechaza la segunda.
    return jsonb_build_object('ok', false, 'error', 'YA_INVIRTIO', 'saldo', null);
end;
$$;

-- Acceso restringido: la función la invoca el servidor de la aplicación con el rol propietario,
-- que valida la identidad del asistente antes de llamarla.
revoke all on function fn_registrar_inversion(bigint, bigint, numeric) from public;

-- Latido de conexión. Actualiza ultima_conexion como máximo una vez cada 15 segundos por fila,
-- para que las consultas periódicas no generen una escritura por solicitud.
create or replace function fn_latido_usuario(p_usuario bigint)
returns void
language sql
security definer
set search_path = public
as $$
  update usuario
     set ultima_conexion = now()
   where id_usuario = p_usuario
     and (ultima_conexion is null or ultima_conexion < now() - interval '15 seconds')
$$;

create or replace function fn_latido_jurado(p_jurado bigint)
returns void
language sql
security definer
set search_path = public
as $$
  update jurado
     set ultima_conexion = now()
   where id_jurado = p_jurado
     and (ultima_conexion is null or ultima_conexion < now() - interval '15 seconds')
$$;

revoke all on function fn_latido_usuario(bigint) from public;
revoke all on function fn_latido_jurado(bigint) from public;
