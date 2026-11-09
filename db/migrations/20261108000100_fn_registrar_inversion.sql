-- Función transaccional de registro de inversiones (especificación, secciones 2.1, 2.2 y 7.3).
--
-- Orden de bloqueos: primero la ronda (FOR SHARE), luego el usuario (FOR UPDATE) y por último
-- la fila de startup_leaderboard (FOR UPDATE). Las liquidaciones bloquean la ronda en modo
-- exclusivo antes que los usuarios, de modo que ambos flujos siguen el mismo orden y no
-- producen interbloqueos.
--
-- Las validaciones se ejecutan antes de cualquier escritura. Si una validación falla, la
-- función devuelve ok = false y ninguna fila cambia.
--
-- Devuelve jsonb con las claves ok, error (solo en caso de fallo) y saldo.

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
  v_id_startup bigint;
  v_estado_usuario varchar;
  v_saldo numeric(14,2);
  v_invertido_ronda numeric(14,2);
  v_saldo_apertura numeric(14,2);
  v_precio_vivo numeric(8,2);
  v_inversores integer;
  v_saldo_final numeric(14,2);
begin
  -- Monto mínimo de compra.
  if p_monto is null or p_monto < 250 then
    return jsonb_build_object('ok', false, 'error', 'MONTO_MINIMO', 'saldo', null);
  end if;

  -- Estado de la ronda. Se bloquea en modo compartido para impedir que la ronda se cierre
  -- durante el registro.
  select r.estado, r.id_startup
    into v_estado_ronda, v_id_startup
    from ronda r
   where r.id_ronda = p_ronda
     for share;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'RONDA_NO_EXISTE', 'saldo', null);
  end if;

  if v_estado_ronda not in ('ABIERTA', 'ULTIMA_LLAMADA') then
    return jsonb_build_object('ok', false, 'error', 'RONDA_NO_ABIERTA', 'saldo', null);
  end if;

  -- Bloqueo del usuario. Evita el doble gasto cuando una persona pulsa Invertir dos veces.
  select u.saldo_actual, u.estado
    into v_saldo, v_estado_usuario
    from usuario u
   where u.id_usuario = p_usuario
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'USUARIO_NO_EXISTE', 'saldo', null);
  end if;

  if v_estado_usuario <> 'ACTIVO' then
    return jsonb_build_object('ok', false, 'error', 'USUARIO_INACTIVO', 'saldo', v_saldo);
  end if;

  -- Monto ya invertido por el usuario en esta ronda. El saldo al abrir la ronda equivale al
  -- saldo actual más lo invertido en ella.
  select coalesce(sum(i.monto), 0)
    into v_invertido_ronda
    from inversion i
   where i.id_usuario = p_usuario
     and i.id_ronda = p_ronda;

  v_saldo_apertura := v_saldo + v_invertido_ronda;

  -- Tope de la ronda: 30 % del saldo al abrir la ronda.
  if v_invertido_ronda + p_monto > round(v_saldo_apertura * 0.30, 2) then
    return jsonb_build_object('ok', false, 'error', 'TOPE_RONDA_SUPERADO', 'saldo', v_saldo);
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

  -- Registro de la inversión al precio vigente en el momento de la compra.
  insert into inversion (id_usuario, id_ronda, monto, precio_momento)
  values (p_usuario, p_ronda, p_monto, v_precio_vivo);

  update usuario
     set saldo_actual = saldo_actual - p_monto
   where id_usuario = p_usuario
  returning saldo_actual into v_saldo_final;

  -- Actualización del acumulado, del número de inversores únicos y del precio vivo.
  -- El precio se acota entre 50 y 200 y depende del monto acumulado, no del número de operaciones.
  select count(distinct i.id_usuario)
    into v_inversores
    from inversion i
   where i.id_ronda = p_ronda;

  update startup_leaderboard sl
     set monto_acumulado = sl.monto_acumulado + p_monto,
         inversores_unicos = v_inversores,
         precio_vivo = least(200, greatest(50, round(100 + (sl.monto_acumulado + p_monto) / 2000, 2))),
         actualizado_en = now()
   where sl.id_ronda = p_ronda;

  return jsonb_build_object('ok', true, 'saldo', v_saldo_final);
end;
$$;

-- Acceso restringido: la función la invoca el servidor de la aplicación con el rol service_role,
-- que valida la identidad del asistente antes de llamarla.
revoke all on function fn_registrar_inversion(bigint, bigint, numeric) from public, anon, authenticated;
grant execute on function fn_registrar_inversion(bigint, bigint, numeric) to service_role;
