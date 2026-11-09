-- Liquidación de rondas (especificación, secciones 2.7, 2.8, 2.9, 2.10 y 7.3).
--
-- Contiene dos funciones:
--   fn_liquidar_ronda: función interna que aplica un multiplicador a las inversiones de una
--     ronda, acredita los saldos, genera el corte de leaderboard y fija el estado final.
--     No es invocable desde el cliente.
--   fn_revelar_veredicto: función pública del operador que calcula el multiplicador a partir
--     de los votos y ejecuta la liquidación.
--
-- La liquidación bloquea la ronda en modo exclusivo y se ejecuta como una única unidad atómica.
-- Si la ronda ya figura como LIQUIDADA, la función devuelve el resultado vigente sin modificar
-- ninguna fila.

-- Función interna de liquidación. Se invoca desde fn_revelar_veredicto y fn_accion_operador.
--
-- Parámetros:
--   p_ronda        identificador de la ronda.
--   p_multiplicador multiplicador aplicado a cada inversión (retorno = monto x multiplicador).
--   p_estado       estado final de la ronda: LIQUIDADA o ANULADA.
--   p_acierta      indica si la startup obtuvo 3 o 4 respaldos. Las inversiones de los
--                  asistentes en la ronda suman un acierto cuando el valor es verdadero.
create or replace function fn_liquidar_ronda(
  p_ronda bigint,
  p_multiplicador numeric,
  p_estado varchar,
  p_acierta boolean
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

  -- Acreditación del retorno en el saldo de cada asistente. Se agrupa por usuario para
  -- actualizar cada fila una sola vez.
  update usuario u
     set saldo_actual = u.saldo_actual + t.total_retorno
    from (
      select i.id_usuario, sum(i.retorno) as total_retorno
        from inversion i
       where i.id_ronda = p_ronda
       group by i.id_usuario
    ) t
   where u.id_usuario = t.id_usuario;

  -- Estado final, multiplicador y fecha de cierre contable de la ronda.
  update ronda r
     set estado = p_estado,
         multiplicador = p_multiplicador,
         liquidada_en = now()
   where r.id_ronda = p_ronda;

  -- Corte del leaderboard de asistentes. Incluye a todos los usuarios activos, ordenados por
  -- saldo final. La ganancia de la ronda es el retorno menos el monto invertido. Los aciertos
  -- acumulados se obtienen sumando el valor de la ronda anterior registrada en el leaderboard.
  insert into leaderboard (id_ronda, id_usuario, posicion, saldo, ganancia_ronda, aciertos, actualizado_en)
  select p_ronda,
         u.id_usuario,
         row_number() over (order by u.saldo_actual desc, u.id_usuario),
         u.saldo_actual,
         coalesce(g.total_retorno, 0) - coalesce(g.total_monto, 0),
         coalesce(previo.aciertos, 0)
           + (case when p_acierta and g.id_usuario is not null then 1 else 0 end),
         now()
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
    ) previo on true
   where u.estado = 'ACTIVO';
end;
$$;

-- La función interna no debe ser invocable por public; la invocan únicamente las funciones de revelación y acción del esquema.
revoke all on function fn_liquidar_ronda(bigint, numeric, varchar, boolean) from public;

-- Revelación del veredicto. Calcula el multiplicador y liquida la ronda.
--
-- Reglas:
--   - Exige que la ronda esté en EN_VOTACION y que todos los jurados hayan votado.
--   - Las abstenciones se excluyen del denominador.
--   - Multiplicador = 0.2 + 1.6 x fracción de respaldo.
--   - Puntaje de la startup = 0.6 x fracción de respaldo + 0.4 x fracción de asistentes que invirtieron.
--   - Idempotente: si la ronda ya está LIQUIDADA, devuelve el resultado vigente sin cambios.
--
-- Devuelve jsonb con las claves ok, error (solo en caso de fallo), multiplicador y fraccion_respaldo.
create or replace function fn_revelar_veredicto(
  p_operador bigint,
  p_ronda bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado_ronda varchar;
  v_multiplicador numeric(6,3);
  v_jurados integer;
  v_votos integer;
  v_respaldos integer;
  v_emitidos integer;
  v_fraccion numeric;
  v_multiplicador_nuevo numeric(6,3);
  v_activos integer;
  v_inversores integer;
begin
  if not exists (select 1 from operador o where o.id_operador = p_operador) then
    return jsonb_build_object('ok', false, 'error', 'OPERADOR_NO_EXISTE');
  end if;

  -- Bloqueo exclusivo de la ronda durante toda la liquidación.
  select r.estado, r.multiplicador
    into v_estado_ronda, v_multiplicador
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

  select count(*),
         count(*) filter (where v.decision = 'RESPALDA'),
         count(*) filter (where v.decision in ('RESPALDA', 'RECHAZA'))
    into v_votos, v_respaldos, v_emitidos
    from veredicto v
   where v.id_ronda = p_ronda;

  if v_votos < v_jurados then
    return jsonb_build_object('ok', false, 'error', 'VOTOS_PENDIENTES');
  end if;

  if v_emitidos = 0 then
    return jsonb_build_object('ok', false, 'error', 'SIN_VOTOS_EMITIDOS');
  end if;

  v_fraccion := v_respaldos::numeric / v_emitidos;
  v_multiplicador_nuevo := round(0.2 + 1.6 * v_fraccion, 3);

  -- Liquidación de inversiones, saldos, leaderboard y estado de la ronda.
  perform fn_liquidar_ronda(p_ronda, v_multiplicador_nuevo, 'LIQUIDADA', v_respaldos >= 3);

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
  values (p_operador, p_ronda, 'REVELAR');

  return jsonb_build_object(
    'ok', true,
    'multiplicador', v_multiplicador_nuevo,
    'fraccion_respaldo', round(v_fraccion, 4)
  );
end;
$$;

-- Acceso restringido: la función la invoca el servidor de la aplicación con el rol propietario,
-- que valida el código de acceso del operador antes de llamarla.
revoke all on function fn_revelar_veredicto(bigint, bigint) from public;
