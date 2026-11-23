-- Acciones del conductor, versión 2 (RF-06 a RF-09, DATABASE.md sección 3, pasos 1, 5, 6 y 7).
--
-- Acciones: ABRIR, ULTIMA_LLAMADA, CERRAR, HABILITAR_VOTO, PAUSAR, REANUDAR, MAS_UN_MINUTO,
-- ANULAR_DEVOLVER y ANULAR_LIQUIDAR_1X.
--
-- Cambios respecto a la versión anterior:
--   - Solo el rol CONDUCTOR ejecuta acciones (error SIN_PERMISO para el soporte).
--   - Cada fase con cronómetro guarda su hora de fin en ronda.fase_termina_en. La duración sale de
--     la tabla configuracion.
--   - PAUSAR congela el cronómetro: guarda los segundos restantes en segundos_restantes_pausa y
--     deja fase_termina_en vacío. REANUDAR calcula una hora de fin nueva con esos segundos.
--   - MAS_UN_MINUTO suma 60 segundos a la fase actual, esté o no en pausa.
--   - ABRIR exige que las rondas anteriores estén liquidadas o anuladas.
--   - Las anulaciones exigen motivo.
--
-- La función serializa todas las acciones con un bloqueo asesor de transacción, para que dos
-- aperturas simultáneas de rondas distintas no dejen dos rondas activas.

create or replace function fn_accion_operador(
  p_operador bigint,
  p_ronda bigint,
  p_accion varchar,
  p_motivo varchar default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol varchar;
  v_estado_ronda varchar;
  v_numero smallint;
  v_pausa integer;
  v_fin timestamptz;
  v_estado_nuevo varchar;
  v_segundos integer;
begin
  perform pg_advisory_xact_lock(hashtext('start_tank_operator_action'));

  select o.rol into v_rol from operador o where o.id_operador = p_operador;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'OPERADOR_NO_EXISTE');
  end if;

  if v_rol <> 'CONDUCTOR' then
    return jsonb_build_object('ok', false, 'error', 'SIN_PERMISO');
  end if;

  -- Bloqueo exclusivo de la ronda para serializar las acciones.
  select r.estado, r.numero, r.segundos_restantes_pausa, r.fase_termina_en
    into v_estado_ronda, v_numero, v_pausa, v_fin
    from ronda r
   where r.id_ronda = p_ronda
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'RONDA_NO_EXISTE');
  end if;

  v_estado_nuevo := v_estado_ronda;

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

    -- Las rondas anteriores deben estar liquidadas o anuladas.
    if exists (
      select 1
        from ronda r3
       where r3.numero < v_numero
         and r3.estado not in ('LIQUIDADA', 'ANULADA')
    ) then
      return jsonb_build_object('ok', false, 'error', 'RONDA_ANTERIOR_PENDIENTE');
    end if;

    -- El mercado queda abierto durante el pitch y el toma y dame.
    update ronda
       set estado = 'ABIERTA',
           abierta_en = now(),
           fase_termina_en = now() + make_interval(
             secs => fn_config_num('duracion_pitch_s', 300) + fn_config_num('duracion_toma_y_dame_s', 600)
           ),
           segundos_restantes_pausa = null
     where id_ronda = p_ronda;
    v_estado_nuevo := 'ABIERTA';

  elsif p_accion = 'ULTIMA_LLAMADA' then
    if v_estado_ronda <> 'ABIERTA' then
      return jsonb_build_object('ok', false, 'error', 'TRANSICION_NO_PERMITIDA');
    end if;

    update ronda
       set estado = 'ULTIMA_LLAMADA',
           ultima_llamada_en = now(),
           fase_termina_en = now() + make_interval(secs => fn_config_num('duracion_ultima_llamada_s', 60)),
           segundos_restantes_pausa = null
     where id_ronda = p_ronda;
    v_estado_nuevo := 'ULTIMA_LLAMADA';

  elsif p_accion = 'CERRAR' then
    if v_estado_ronda not in ('ABIERTA', 'ULTIMA_LLAMADA') then
      return jsonb_build_object('ok', false, 'error', 'TRANSICION_NO_PERMITIDA');
    end if;

    update ronda
       set estado = 'CERRADA',
           cerrada_en = now(),
           fase_termina_en = null,
           segundos_restantes_pausa = null
     where id_ronda = p_ronda;
    v_estado_nuevo := 'CERRADA';

  elsif p_accion = 'HABILITAR_VOTO' then
    if v_estado_ronda <> 'CERRADA' then
      return jsonb_build_object('ok', false, 'error', 'TRANSICION_NO_PERMITIDA');
    end if;

    update ronda
       set estado = 'EN_VOTACION',
           fase_termina_en = now() + make_interval(secs => fn_config_num('duracion_votacion_s', 150)),
           segundos_restantes_pausa = null
     where id_ronda = p_ronda;
    v_estado_nuevo := 'EN_VOTACION';

  elsif p_accion = 'PAUSAR' then
    if v_estado_ronda not in ('ABIERTA', 'ULTIMA_LLAMADA', 'EN_VOTACION') then
      return jsonb_build_object('ok', false, 'error', 'TRANSICION_NO_PERMITIDA');
    end if;

    if v_pausa is not null then
      return jsonb_build_object('ok', false, 'error', 'YA_EN_PAUSA');
    end if;

    if v_fin is null then
      return jsonb_build_object('ok', false, 'error', 'SIN_CRONOMETRO');
    end if;

    v_segundos := greatest(0, ceil(extract(epoch from (v_fin - now())))::integer);

    update ronda
       set fase_termina_en = null,
           segundos_restantes_pausa = v_segundos
     where id_ronda = p_ronda;

  elsif p_accion = 'REANUDAR' then
    if v_pausa is null then
      return jsonb_build_object('ok', false, 'error', 'NO_ESTA_EN_PAUSA');
    end if;

    update ronda
       set fase_termina_en = now() + make_interval(secs => v_pausa),
           segundos_restantes_pausa = null
     where id_ronda = p_ronda;

  elsif p_accion = 'MAS_UN_MINUTO' then
    if v_estado_ronda not in ('ABIERTA', 'ULTIMA_LLAMADA', 'EN_VOTACION') then
      return jsonb_build_object('ok', false, 'error', 'TRANSICION_NO_PERMITIDA');
    end if;

    if v_pausa is not null then
      update ronda set segundos_restantes_pausa = v_pausa + 60 where id_ronda = p_ronda;
    elsif v_fin is not null then
      update ronda set fase_termina_en = v_fin + interval '60 seconds' where id_ronda = p_ronda;
    else
      return jsonb_build_object('ok', false, 'error', 'SIN_CRONOMETRO');
    end if;

  elsif p_accion in ('ANULAR_DEVOLVER', 'ANULAR_LIQUIDAR_1X') then
    if v_estado_ronda not in ('ABIERTA', 'ULTIMA_LLAMADA', 'CERRADA', 'EN_VOTACION') then
      return jsonb_build_object('ok', false, 'error', 'TRANSICION_NO_PERMITIDA');
    end if;

    if p_motivo is null or btrim(p_motivo) = '' then
      return jsonb_build_object('ok', false, 'error', 'MOTIVO_REQUERIDO');
    end if;

    -- Ambas variantes devuelven lo invertido (multiplicador 1.0x). La diferencia está en el
    -- estado final de la ronda: ANULADA para la devolución y LIQUIDADA para la liquidación a 1.0x.
    if p_accion = 'ANULAR_DEVOLVER' then
      v_estado_nuevo := 'ANULADA';
    else
      v_estado_nuevo := 'LIQUIDADA';
    end if;

    -- Ninguna anulación cuenta aciertos: con multiplicador 1.0 no hay ganancia.
    perform fn_liquidar_ronda(p_ronda, 1.000, v_estado_nuevo);

  else
    return jsonb_build_object('ok', false, 'error', 'ACCION_INVALIDA');
  end if;

  insert into accion_ronda (id_operador, id_ronda, accion, motivo)
  values (p_operador, p_ronda, p_accion, p_motivo);

  return jsonb_build_object('ok', true, 'estado', v_estado_nuevo);
end;
$$;

-- Sustituye la versión de tres parámetros para evitar llamadas ambiguas.
drop function if exists fn_accion_operador(bigint, bigint, varchar);
revoke all on function fn_accion_operador(bigint, bigint, varchar, varchar) from public;

-- Cierre automático de la última llamada (RF-08). Cierra las rondas cuya última llamada venció y
-- no están en pausa. Las consultas de estado la invocan antes de leer, de modo que el cierre no
-- depende de que alguien pulse un botón. Devuelve la cantidad de rondas cerradas.
create or replace function fn_cerrar_ultima_llamada_vencida()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cerradas integer;
begin
  perform pg_advisory_xact_lock(hashtext('start_tank_operator_action'));

  update ronda
     set estado = 'CERRADA',
         cerrada_en = fase_termina_en,
         fase_termina_en = null
   where estado = 'ULTIMA_LLAMADA'
     and segundos_restantes_pausa is null
     and fase_termina_en is not null
     and fase_termina_en <= now();

  get diagnostics v_cerradas = row_count;
  return v_cerradas;
end;
$$;

revoke all on function fn_cerrar_ultima_llamada_vencida() from public;
