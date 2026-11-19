-- Corrección: serializa las acciones del operador con un bloqueo asesor de transacción.
-- Evita que dos aperturas simultáneas de rondas distintas dejen dos rondas activas.

create or replace function fn_accion_operador(
  p_operador bigint,
  p_ronda bigint,
  p_accion varchar
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado_ronda varchar;
  v_estado_nuevo varchar;
begin
  -- Serializa todas las acciones del operador. El bloqueo de la fila de la ronda no basta para
  -- la regla de una sola ronda activa, porque dos aperturas de rondas distintas no se bloquean entre sí.
  perform pg_advisory_xact_lock(hashtext('start_tank_operator_action'));

  if not exists (select 1 from operador o where o.id_operador = p_operador) then
    return jsonb_build_object('ok', false, 'error', 'OPERADOR_NO_EXISTE');
  end if;

  -- Bloqueo exclusivo de la ronda para serializar las acciones del operador.
  select r.estado
    into v_estado_ronda
    from ronda r
   where r.id_ronda = p_ronda
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'RONDA_NO_EXISTE');
  end if;

  if p_accion = 'ABRIR' then
    if v_estado_ronda <> 'PROGRAMADA' then
      return jsonb_build_object('ok', false, 'error', 'TRANSICION_NO_PERMITIDA');
    end if;

    -- Solo puede existir una ronda activa a la vez.
    if exists (
      select 1
        from ronda r2
       where r2.id_ronda <> p_ronda
         and r2.estado in ('ABIERTA', 'ULTIMA_LLAMADA', 'CERRADA', 'EN_VOTACION')
    ) then
      return jsonb_build_object('ok', false, 'error', 'OTRA_RONDA_ACTIVA');
    end if;

    update ronda
       set estado = 'ABIERTA',
           abierta_en = now()
     where id_ronda = p_ronda;
    v_estado_nuevo := 'ABIERTA';

  elsif p_accion = 'ULTIMA_LLAMADA' then
    if v_estado_ronda <> 'ABIERTA' then
      return jsonb_build_object('ok', false, 'error', 'TRANSICION_NO_PERMITIDA');
    end if;

    update ronda
       set estado = 'ULTIMA_LLAMADA',
           ultima_llamada_en = now()
     where id_ronda = p_ronda;
    v_estado_nuevo := 'ULTIMA_LLAMADA';

  elsif p_accion = 'CERRAR' then
    if v_estado_ronda not in ('ABIERTA', 'ULTIMA_LLAMADA') then
      return jsonb_build_object('ok', false, 'error', 'TRANSICION_NO_PERMITIDA');
    end if;

    update ronda
       set estado = 'CERRADA',
           cerrada_en = now()
     where id_ronda = p_ronda;
    v_estado_nuevo := 'CERRADA';

  elsif p_accion = 'HABILITAR_VOTO' then
    if v_estado_ronda <> 'CERRADA' then
      return jsonb_build_object('ok', false, 'error', 'TRANSICION_NO_PERMITIDA');
    end if;

    update ronda
       set estado = 'EN_VOTACION'
     where id_ronda = p_ronda;
    v_estado_nuevo := 'EN_VOTACION';

  elsif p_accion in ('ANULAR_DEVOLVER', 'ANULAR_LIQUIDAR_1X') then
    if v_estado_ronda not in ('ABIERTA', 'ULTIMA_LLAMADA', 'CERRADA', 'EN_VOTACION') then
      return jsonb_build_object('ok', false, 'error', 'TRANSICION_NO_PERMITIDA');
    end if;

    -- Ambas variantes devuelven lo invertido (multiplicador 1.0x). La diferencia está en el
    -- estado final de la ronda: ANULADA para la devolución y LIQUIDADA para la liquidación a 1.0x.
    if p_accion = 'ANULAR_DEVOLVER' then
      v_estado_nuevo := 'ANULADA';
    else
      v_estado_nuevo := 'LIQUIDADA';
    end if;

    -- Ninguna anulación cuenta aciertos.
    perform fn_liquidar_ronda(p_ronda, 1.000, v_estado_nuevo, false);

  else
    return jsonb_build_object('ok', false, 'error', 'ACCION_INVALIDA');
  end if;

  insert into accion_ronda (id_operador, id_ronda, accion)
  values (p_operador, p_ronda, p_accion);

  return jsonb_build_object('ok', true, 'estado', v_estado_nuevo);
end;
$$;

-- Acceso restringido: la función la invoca el servidor de la aplicación con el rol propietario,
-- que valida el código de acceso del operador antes de llamarla.
revoke all on function fn_accion_operador(bigint, bigint, varchar) from public;
