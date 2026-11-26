-- Fase de pitch separada del mercado y reinicios manuales.
--
-- Flujo de la ronda: PROGRAMADA → PITCH (mercado cerrado, cronómetro del pitch) → ABIERTA (toma
-- y dame, mercado abierto solo para el público) → ULTIMA_LLAMADA → CERRADA → EN_VOTACION →
-- LIQUIDADA. El conductor pasa del pitch al toma y dame con ABRIR_MERCADO cuando quiera, aunque
-- el cronómetro del pitch no haya llegado a 0:00.
--
-- Reinicios:
--   REINICIAR_FASE   vuelve a poner el cronómetro de la fase actual en su duración completa.
--   REINICIAR_RONDA  devuelve la ronda a PROGRAMADA: reintegra lo invertido, borra inversiones,
--                    notas, borradores y su corte de posiciones. Solo si ninguna ronda posterior
--                    empezó. Exige motivo.
--   fn_reiniciar_evento  reinicio total: borra movimientos y log, saldos al capital inicial y
--                    banderas del evento en falso.

alter table ronda drop constraint if exists ronda_estado_check;
alter table ronda add constraint ronda_estado_check
  check (estado in ('PROGRAMADA','PITCH','ABIERTA','ULTIMA_LLAMADA','CERRADA','EN_VOTACION','LIQUIDADA','ANULADA'));

-- El jurado califica en borrador desde el pitch.
create or replace function fn_guardar_borrador(
  p_jurado bigint,
  p_ronda bigint,
  p_criterio bigint,
  p_valor integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado_ronda varchar;
begin
  if p_valor is null or p_valor < 1 or p_valor > 5 then
    return jsonb_build_object('ok', false, 'error', 'NOTA_INVALIDA');
  end if;

  if not exists (select 1 from jurado j where j.id_jurado = p_jurado) then
    return jsonb_build_object('ok', false, 'error', 'JURADO_NO_EXISTE');
  end if;

  if not exists (select 1 from criterio c where c.id_criterio = p_criterio) then
    return jsonb_build_object('ok', false, 'error', 'CRITERIO_NO_EXISTE');
  end if;

  select r.estado into v_estado_ronda from ronda r where r.id_ronda = p_ronda for share;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'RONDA_NO_EXISTE');
  end if;

  if v_estado_ronda not in ('PITCH', 'ABIERTA', 'ULTIMA_LLAMADA', 'CERRADA', 'EN_VOTACION') then
    return jsonb_build_object('ok', false, 'error', 'RONDA_NO_CALIFICABLE');
  end if;

  if exists (select 1 from veredicto v where v.id_jurado = p_jurado and v.id_ronda = p_ronda) then
    return jsonb_build_object('ok', false, 'error', 'YA_ENVIO');
  end if;

  insert into borrador_nota (id_jurado, id_ronda, id_criterio, valor)
  values (p_jurado, p_ronda, p_criterio, p_valor)
  on conflict (id_jurado, id_ronda, id_criterio) do update set valor = excluded.valor;

  return jsonb_build_object('ok', true);
end;
$$;

-- Duración configurada de la fase de un estado. Null si el estado no tiene cronómetro.
create or replace function fn_duracion_fase(p_estado varchar)
returns integer
language sql
stable
set search_path = public
as $$
  select case p_estado
    when 'PITCH' then fn_config_num('duracion_pitch_s', 300)
    when 'ABIERTA' then fn_config_num('duracion_toma_y_dame_s', 600)
    when 'ULTIMA_LLAMADA' then fn_config_num('duracion_ultima_llamada_s', 60)
    when 'EN_VOTACION' then fn_config_num('duracion_votacion_s', 150)
  end::integer;
$$;

-- Devuelve una ronda a PROGRAMADA y deshace su efecto en saldos y tablas. Uso interno.
create or replace function fn_reiniciar_ronda(p_ronda bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Neto de la ronda por asistente: lo invertido menos lo que ya recibió al liquidar o anular.
  update usuario u
     set saldo_actual = u.saldo_actual + t.neto
    from (
      select i.id_usuario, sum(i.monto - coalesce(i.retorno, 0)) as neto
        from inversion i
       where i.id_ronda = p_ronda
       group by i.id_usuario
    ) t
   where u.id_usuario = t.id_usuario;

  delete from nota_criterio
   where id_veredicto in (select v.id_veredicto from veredicto v where v.id_ronda = p_ronda);
  delete from veredicto where id_ronda = p_ronda;
  delete from borrador_nota where id_ronda = p_ronda;
  delete from leaderboard where id_ronda = p_ronda;
  delete from inversion where id_ronda = p_ronda;

  update startup_leaderboard
     set monto_acumulado = 0, inversores_unicos = 0, precio_vivo = 100,
         puntaje_jurado = null, puntaje = null
   where id_ronda = p_ronda;

  -- Si el evento ya estaba cerrado, su resultado deja de valer.
  update startup_leaderboard set puntaje = null;
  delete from configuracion where clave = 'evento_cerrado';

  update ronda
     set estado = 'PROGRAMADA', multiplicador = null, abierta_en = null,
         ultima_llamada_en = null, cerrada_en = null, liquidada_en = null,
         fase_termina_en = null, segundos_restantes_pausa = null
   where id_ronda = p_ronda;
end;
$$;

revoke all on function fn_reiniciar_ronda(bigint) from public;

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

    if exists (
      select 1 from ronda r2
       where r2.id_ronda <> p_ronda
         and r2.estado in ('PITCH', 'ABIERTA', 'ULTIMA_LLAMADA', 'CERRADA', 'EN_VOTACION')
    ) then
      return jsonb_build_object('ok', false, 'error', 'OTRA_RONDA_ACTIVA');
    end if;

    if exists (
      select 1 from ronda r3
       where r3.numero < v_numero and r3.estado not in ('LIQUIDADA', 'ANULADA')
    ) then
      return jsonb_build_object('ok', false, 'error', 'RONDA_ANTERIOR_PENDIENTE');
    end if;

    -- La ronda empieza con el pitch; el mercado sigue cerrado.
    update ronda
       set estado = 'PITCH',
           abierta_en = now(),
           fase_termina_en = now() + make_interval(secs => fn_duracion_fase('PITCH')),
           segundos_restantes_pausa = null
     where id_ronda = p_ronda;
    v_estado_nuevo := 'PITCH';

  elsif p_accion = 'ABRIR_MERCADO' then
    if v_estado_ronda <> 'PITCH' then
      return jsonb_build_object('ok', false, 'error', 'TRANSICION_NO_PERMITIDA');
    end if;

    update ronda
       set estado = 'ABIERTA',
           fase_termina_en = now() + make_interval(secs => fn_duracion_fase('ABIERTA')),
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
           fase_termina_en = now() + make_interval(secs => fn_duracion_fase('ULTIMA_LLAMADA')),
           segundos_restantes_pausa = null
     where id_ronda = p_ronda;
    v_estado_nuevo := 'ULTIMA_LLAMADA';

  elsif p_accion = 'CERRAR' then
    if v_estado_ronda not in ('ABIERTA', 'ULTIMA_LLAMADA') then
      return jsonb_build_object('ok', false, 'error', 'TRANSICION_NO_PERMITIDA');
    end if;

    update ronda
       set estado = 'CERRADA', cerrada_en = now(),
           fase_termina_en = null, segundos_restantes_pausa = null
     where id_ronda = p_ronda;
    v_estado_nuevo := 'CERRADA';

  elsif p_accion = 'HABILITAR_VOTO' then
    if v_estado_ronda <> 'CERRADA' then
      return jsonb_build_object('ok', false, 'error', 'TRANSICION_NO_PERMITIDA');
    end if;

    update ronda
       set estado = 'EN_VOTACION',
           fase_termina_en = now() + make_interval(secs => fn_duracion_fase('EN_VOTACION')),
           segundos_restantes_pausa = null
     where id_ronda = p_ronda;
    v_estado_nuevo := 'EN_VOTACION';

  elsif p_accion = 'PAUSAR' then
    if v_estado_ronda not in ('PITCH', 'ABIERTA', 'ULTIMA_LLAMADA', 'EN_VOTACION') then
      return jsonb_build_object('ok', false, 'error', 'TRANSICION_NO_PERMITIDA');
    end if;
    if v_pausa is not null then
      return jsonb_build_object('ok', false, 'error', 'YA_EN_PAUSA');
    end if;
    if v_fin is null then
      return jsonb_build_object('ok', false, 'error', 'SIN_CRONOMETRO');
    end if;

    v_segundos := greatest(0, ceil(extract(epoch from (v_fin - now())))::integer);
    update ronda set fase_termina_en = null, segundos_restantes_pausa = v_segundos
     where id_ronda = p_ronda;

  elsif p_accion = 'REANUDAR' then
    if v_pausa is null then
      return jsonb_build_object('ok', false, 'error', 'NO_ESTA_EN_PAUSA');
    end if;

    update ronda
       set fase_termina_en = now() + make_interval(secs => v_pausa), segundos_restantes_pausa = null
     where id_ronda = p_ronda;

  elsif p_accion = 'MAS_UN_MINUTO' then
    if v_estado_ronda not in ('PITCH', 'ABIERTA', 'ULTIMA_LLAMADA', 'EN_VOTACION') then
      return jsonb_build_object('ok', false, 'error', 'TRANSICION_NO_PERMITIDA');
    end if;

    if v_pausa is not null then
      update ronda set segundos_restantes_pausa = v_pausa + 60 where id_ronda = p_ronda;
    elsif v_fin is not null then
      update ronda set fase_termina_en = v_fin + interval '60 seconds' where id_ronda = p_ronda;
    else
      return jsonb_build_object('ok', false, 'error', 'SIN_CRONOMETRO');
    end if;

  elsif p_accion = 'REINICIAR_FASE' then
    if v_estado_ronda not in ('PITCH', 'ABIERTA', 'ULTIMA_LLAMADA', 'EN_VOTACION') then
      return jsonb_build_object('ok', false, 'error', 'TRANSICION_NO_PERMITIDA');
    end if;

    update ronda
       set fase_termina_en = now() + make_interval(secs => fn_duracion_fase(v_estado_ronda)),
           segundos_restantes_pausa = null
     where id_ronda = p_ronda;

  elsif p_accion = 'REINICIAR_RONDA' then
    if v_estado_ronda = 'PROGRAMADA' then
      return jsonb_build_object('ok', false, 'error', 'TRANSICION_NO_PERMITIDA');
    end if;
    if p_motivo is null or btrim(p_motivo) = '' then
      return jsonb_build_object('ok', false, 'error', 'MOTIVO_REQUERIDO');
    end if;
    -- Reiniciar una ronda con otra posterior ya jugada dejaría saldos y posiciones incoherentes.
    if exists (select 1 from ronda r4 where r4.numero > v_numero and r4.estado <> 'PROGRAMADA') then
      return jsonb_build_object('ok', false, 'error', 'RONDA_POSTERIOR_INICIADA');
    end if;

    perform fn_reiniciar_ronda(p_ronda);
    v_estado_nuevo := 'PROGRAMADA';

  elsif p_accion in ('ANULAR_DEVOLVER', 'ANULAR_LIQUIDAR_1X') then
    if v_estado_ronda not in ('PITCH', 'ABIERTA', 'ULTIMA_LLAMADA', 'CERRADA', 'EN_VOTACION') then
      return jsonb_build_object('ok', false, 'error', 'TRANSICION_NO_PERMITIDA');
    end if;
    if p_motivo is null or btrim(p_motivo) = '' then
      return jsonb_build_object('ok', false, 'error', 'MOTIVO_REQUERIDO');
    end if;

    if p_accion = 'ANULAR_DEVOLVER' then
      v_estado_nuevo := 'ANULADA';
    else
      v_estado_nuevo := 'LIQUIDADA';
    end if;

    perform fn_liquidar_ronda(p_ronda, 1.000, v_estado_nuevo);

  else
    return jsonb_build_object('ok', false, 'error', 'ACCION_INVALIDA');
  end if;

  insert into accion_ronda (id_operador, id_ronda, accion, motivo)
  values (p_operador, p_ronda, p_accion, p_motivo);

  return jsonb_build_object('ok', true, 'estado', v_estado_nuevo);
end;
$$;

revoke all on function fn_accion_operador(bigint, bigint, varchar, varchar) from public;

-- Reinicio total del evento: el día del evento, en caso extremo. Borra movimientos y log, deja
-- las rondas programadas, los saldos en el capital inicial y las banderas del evento en falso.
-- Conserva usuarios, startups, jurados, operadores, criterios y configuración.
create or replace function fn_reiniciar_evento(p_operador bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol varchar;
begin
  perform pg_advisory_xact_lock(hashtext('start_tank_operator_action'));

  select o.rol into v_rol from operador o where o.id_operador = p_operador;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'OPERADOR_NO_EXISTE');
  end if;
  if v_rol <> 'CONDUCTOR' then
    return jsonb_build_object('ok', false, 'error', 'SIN_PERMISO');
  end if;

  delete from nota_criterio;
  delete from borrador_nota;
  delete from veredicto;
  delete from leaderboard;
  delete from inversion;
  delete from accion_ronda;

  update startup_leaderboard
     set monto_acumulado = 0, inversores_unicos = 0, precio_vivo = 100,
         puntaje = null, puntaje_jurado = null;

  update ronda
     set estado = 'PROGRAMADA', multiplicador = null, abierta_en = null,
         ultima_llamada_en = null, cerrada_en = null, liquidada_en = null,
         fase_termina_en = null, segundos_restantes_pausa = null;

  update usuario set saldo_actual = fn_config_num('capital_inicial', 10000);

  delete from configuracion where clave = 'evento_cerrado';
  update configuracion set valor = 'false' where clave in ('evento_iniciado', 'modo_manual');

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function fn_reiniciar_evento(bigint) from public;

-- El ensayo es el mismo reinicio, bloqueado una vez iniciado el evento.
create or replace function fn_reiniciar_ensayo(p_operador bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from configuracion where clave = 'evento_iniciado' and valor = 'true') then
    return jsonb_build_object('ok', false, 'error', 'EVENTO_INICIADO');
  end if;
  return fn_reiniciar_evento(p_operador);
end;
$$;
