-- Liquidación con multiplicador continuo (RF-18 a RF-21, DATABASE.md sección 3, paso 10).
--
-- Reglas:
--   puntaje de la startup = promedio de los puntajes de los jurados que votaron (sin abstenciones)
--   multiplicador         = 0.2 + 1.6 x ((puntaje - 1) / 4)
--   retorno               = monto x multiplicador
--   acierto               = invertir en una startup con multiplicador mayor que 1.0
--
-- Contiene tres funciones:
--   fn_liquidar_ronda     función interna que aplica un multiplicador a las inversiones de una
--                         ronda, acredita los saldos, genera el corte de leaderboard y fija el
--                         estado final.
--   fn_revelar_veredicto  revela el veredicto: exige los 4 envíos, o permite revelar con los
--                         presentes con motivo.
--   fn_liquidar_manual    liquida con un puntaje indicado por el conductor (modo manual).
--
-- La liquidación bloquea la ronda en modo exclusivo y es una única unidad atómica. Si la ronda
-- ya figura como LIQUIDADA, devuelve el resultado vigente sin modificar ninguna fila.
-- Solo el rol CONDUCTOR puede revelar o liquidar.

-- Función interna de liquidación. Se invoca desde las demás funciones; no es invocable desde el
-- cliente.
--
-- Parámetros:
--   p_ronda          identificador de la ronda.
--   p_multiplicador  multiplicador aplicado a cada inversión.
--   p_estado         estado final de la ronda: LIQUIDADA o ANULADA.
create or replace function fn_liquidar_ronda(
  p_ronda bigint,
  p_multiplicador numeric,
  p_estado varchar
)
returns void
language plpgsql
set search_path = public
as $$
begin
  -- Retorno de cada inversión.
  update inversion i
     set retorno = round(i.monto * p_multiplicador, 2),
         estado = p_estado
   where i.id_ronda = p_ronda;

  -- Acreditación del retorno en el saldo de cada asistente.
  update usuario u
     set saldo_actual = u.saldo_actual + t.total_retorno
    from (
      select i.id_usuario, sum(i.retorno) as total_retorno
        from inversion i
       where i.id_ronda = p_ronda
       group by i.id_usuario
    ) t
   where u.id_usuario = t.id_usuario;

  -- Estado final, multiplicador, hora de la liquidación y fin de la fase de resultado. La ronda
  -- sale de la pausa si estaba en ella.
  update ronda r
     set estado = p_estado,
         multiplicador = p_multiplicador,
         liquidada_en = now(),
         fase_termina_en = now() + make_interval(secs => fn_config_num('duracion_resultado_s', 90)),
         segundos_restantes_pausa = null
   where r.id_ronda = p_ronda;

  -- Corte del leaderboard. Al liquidar, todo el dinero invertido ya volvió al saldo, así que el
  -- patrimonio de cada asistente es su saldo. La ganancia de la ronda es el retorno menos el monto
  -- invertido. Los aciertos acumulados parten de la ronda anterior registrada en el leaderboard.
  insert into leaderboard (id_ronda, id_usuario, posicion, saldo, ganancia_ronda, aciertos)
  select p_ronda,
         u.id_usuario,
         row_number() over (order by u.saldo_actual desc, u.id_usuario),
         u.saldo_actual,
         coalesce(g.total_retorno, 0) - coalesce(g.total_monto, 0),
         coalesce(previo.aciertos, 0)
           + (case when p_estado = 'LIQUIDADA' and p_multiplicador > 1 and g.id_usuario is not null
                   then 1 else 0 end)
    from usuario u
    left join (
      select i.id_usuario,
             sum(i.retorno) as total_retorno,
             sum(i.monto) as total_monto
        from inversion i
       where i.id_ronda = p_ronda
       group by i.id_usuario
    ) g on g.id_usuario = u.id_usuario
    left join lateral (
      select l.aciertos
        from leaderboard l
        join ronda r2 on r2.id_ronda = l.id_ronda
       where l.id_usuario = u.id_usuario
         and r2.numero < (select r0.numero from ronda r0 where r0.id_ronda = p_ronda)
       order by r2.numero desc
       limit 1
    ) previo on true;
end;
$$;

revoke all on function fn_liquidar_ronda(bigint, numeric, varchar) from public;

-- Revelación del veredicto.
--
-- Parámetros:
--   p_con_presentes  verdadero para revelar con los jurados que ya enviaron, sin esperar a los
--                    demás. Exige p_motivo.
--   p_motivo         motivo del rescate; queda en el log de acciones.
--
-- Devuelve jsonb con las claves ok, error (solo en caso de fallo), multiplicador, puntaje_jurado
-- y liquidada_en.
create or replace function fn_revelar_veredicto(
  p_operador bigint,
  p_ronda bigint,
  p_con_presentes boolean default false,
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
  v_multiplicador numeric(6,3);
  v_liquidada_en timestamptz;
  v_jurados integer;
  v_votos integer;
  v_emitidos integer;
  v_puntaje numeric;
  v_multiplicador_nuevo numeric(6,3);
  v_rescate boolean;
begin
  select o.rol into v_rol from operador o where o.id_operador = p_operador;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'OPERADOR_NO_EXISTE');
  end if;

  if v_rol <> 'CONDUCTOR' then
    return jsonb_build_object('ok', false, 'error', 'SIN_PERMISO');
  end if;

  -- Bloqueo exclusivo de la ronda durante toda la liquidación.
  select r.estado, r.multiplicador, r.liquidada_en
    into v_estado_ronda, v_multiplicador, v_liquidada_en
    from ronda r
   where r.id_ronda = p_ronda
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'RONDA_NO_EXISTE');
  end if;

  -- Idempotencia: una ronda ya liquidada conserva el resultado anterior.
  if v_estado_ronda = 'LIQUIDADA' then
    return jsonb_build_object(
      'ok', true,
      'multiplicador', v_multiplicador,
      'liquidada_en', v_liquidada_en,
      'idempotente', true
    );
  end if;

  if v_estado_ronda <> 'EN_VOTACION' then
    return jsonb_build_object('ok', false, 'error', 'RONDA_NO_EN_VOTACION');
  end if;

  select count(*) into v_jurados from jurado;

  if v_jurados = 0 then
    return jsonb_build_object('ok', false, 'error', 'SIN_JURADOS');
  end if;

  select count(*), count(*) filter (where not v.se_abstiene)
    into v_votos, v_emitidos
    from veredicto v
   where v.id_ronda = p_ronda;

  v_rescate := v_votos < v_jurados;

  if v_rescate then
    if not p_con_presentes then
      return jsonb_build_object('ok', false, 'error', 'VOTOS_PENDIENTES');
    end if;
    if p_motivo is null or btrim(p_motivo) = '' then
      return jsonb_build_object('ok', false, 'error', 'MOTIVO_REQUERIDO');
    end if;
  end if;

  if v_emitidos = 0 then
    return jsonb_build_object('ok', false, 'error', 'SIN_VOTOS_EMITIDOS');
  end if;

  select avg(v.puntaje)
    into v_puntaje
    from veredicto v
   where v.id_ronda = p_ronda
     and not v.se_abstiene;

  v_multiplicador_nuevo := round(0.2 + 1.6 * ((v_puntaje - 1) / 4), 3);

  perform fn_liquidar_ronda(p_ronda, v_multiplicador_nuevo, 'LIQUIDADA');

  -- Fila de la startup, si aún no existe, y su puntaje del jurado. El puntaje final, que combina
  -- jurado y participación, se calcula al cerrar el evento.
  insert into startup_leaderboard (id_ronda, id_startup)
  select r.id_ronda, r.id_startup
    from ronda r
   where r.id_ronda = p_ronda
  on conflict (id_ronda) do nothing;

  update startup_leaderboard sl
     set puntaje_jurado = round(v_puntaje, 4)
   where sl.id_ronda = p_ronda;

  insert into accion_ronda (id_operador, id_ronda, accion, motivo)
  values (p_operador, p_ronda, case when v_rescate then 'REVELAR_PRESENTES' else 'REVELAR' end, p_motivo);

  select r.liquidada_en into v_liquidada_en from ronda r where r.id_ronda = p_ronda;

  return jsonb_build_object(
    'ok', true,
    'multiplicador', v_multiplicador_nuevo,
    'puntaje_jurado', round(v_puntaje, 4),
    'liquidada_en', v_liquidada_en
  );
end;
$$;

drop function if exists fn_revelar_veredicto(bigint, bigint);
revoke all on function fn_revelar_veredicto(bigint, bigint, boolean, varchar) from public;

-- Liquidación manual (modo manual del conductor).
--
-- Permite liquidar una ronda cuando el voto digital falla. El conductor indica el puntaje de la
-- startup, de 1 a 5, contado a mano, y un motivo. Solo admite rondas en CERRADA o EN_VOTACION.
-- La acción se registra en accion_ronda como REVELAR_MANUAL.
create or replace function fn_liquidar_manual(
  p_operador bigint,
  p_ronda bigint,
  p_puntaje numeric,
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
  v_multiplicador numeric(6,3);
  v_liquidada_en timestamptz;
begin
  select o.rol into v_rol from operador o where o.id_operador = p_operador;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'OPERADOR_NO_EXISTE');
  end if;

  if v_rol <> 'CONDUCTOR' then
    return jsonb_build_object('ok', false, 'error', 'SIN_PERMISO');
  end if;

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

  if p_puntaje is null or p_puntaje < 1 or p_puntaje > 5 then
    return jsonb_build_object('ok', false, 'error', 'PUNTAJE_INVALIDO');
  end if;

  if p_motivo is null or btrim(p_motivo) = '' then
    return jsonb_build_object('ok', false, 'error', 'MOTIVO_REQUERIDO');
  end if;

  v_multiplicador := round(0.2 + 1.6 * ((p_puntaje - 1) / 4), 3);

  perform fn_liquidar_ronda(p_ronda, v_multiplicador, 'LIQUIDADA');

  insert into startup_leaderboard (id_ronda, id_startup)
  select r.id_ronda, r.id_startup
    from ronda r
   where r.id_ronda = p_ronda
  on conflict (id_ronda) do nothing;

  update startup_leaderboard sl
     set puntaje_jurado = round(p_puntaje, 4)
   where sl.id_ronda = p_ronda;

  insert into accion_ronda (id_operador, id_ronda, accion, motivo)
  values (p_operador, p_ronda, 'REVELAR_MANUAL', p_motivo);

  select r.liquidada_en into v_liquidada_en from ronda r where r.id_ronda = p_ronda;

  return jsonb_build_object(
    'ok', true,
    'multiplicador', v_multiplicador,
    'puntaje_jurado', round(p_puntaje, 4),
    'liquidada_en', v_liquidada_en
  );
end;
$$;

drop function if exists fn_liquidar_manual(bigint, bigint, integer);
revoke all on function fn_liquidar_manual(bigint, bigint, numeric, varchar) from public;

-- La versión anterior de la función interna recibía un cuarto parámetro (acierto por respaldos).
drop function if exists fn_liquidar_ronda(bigint, numeric, varchar, boolean);
