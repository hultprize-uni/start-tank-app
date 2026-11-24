-- Procesos batch (DATABASE.md, sección 4; WORKPLAN F7).
--
--   fn_cargar_resultados        LOAD del cierre del evento: guarda el puntaje final de cada startup.
--   fn_reiniciar_ensayo         Borra los movimientos del ensayo y devuelve el evento a su inicio.
--   fn_respaldo                 UNLOAD de todas las tablas en un jsonb.
--   fn_restaurar                RESTORE de un respaldo de fn_respaldo.
--   fn_reconstruir_leaderboard  Recalcula leaderboard y startup_leaderboard desde los movimientos.
--
-- El cálculo del puntaje final (60 % jurado, 40 % asistentes) vive en src/server/batch/results.ts;
-- aquí solo se carga, en una transacción. Todas las funciones son repetibles.

-- Tablas en orden de dependencia: padres primero. Lo usan el respaldo y la restauración.
create or replace function fn_tablas_respaldo()
returns text[]
language sql
immutable
as $$
  select array[
    'configuracion', 'criterio', 'operador', 'jurado', 'usuario', 'startup', 'ronda',
    'startup_leaderboard', 'inversion', 'veredicto', 'nota_criterio', 'borrador_nota',
    'accion_ronda', 'leaderboard'
  ]
$$;

-- LOAD del cierre. p_resultados: [{"id_ronda": "1", "puntaje": 0.8123}, ...]. Exige el rol
-- CONDUCTOR y todas las rondas liquidadas o anuladas.
create or replace function fn_cargar_resultados(p_operador bigint, p_resultados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol varchar;
  v_ultima bigint;
begin
  select o.rol into v_rol from operador o where o.id_operador = p_operador;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'OPERADOR_NO_EXISTE');
  end if;
  if v_rol <> 'CONDUCTOR' then
    return jsonb_build_object('ok', false, 'error', 'SIN_PERMISO');
  end if;

  if not exists (select 1 from ronda)
     or exists (select 1 from ronda where estado not in ('LIQUIDADA', 'ANULADA')) then
    return jsonb_build_object('ok', false, 'error', 'RONDAS_PENDIENTES');
  end if;

  update startup_leaderboard sl
     set puntaje = round((r.value ->> 'puntaje')::numeric, 4)
    from jsonb_array_elements(p_resultados) r
   where sl.id_ronda = (r.value ->> 'id_ronda')::bigint;

  select id_ronda into v_ultima from ronda order by numero desc limit 1;
  insert into accion_ronda (id_operador, id_ronda, accion, motivo)
  values (p_operador, v_ultima, 'CERRAR_EVENTO', null);

  insert into configuracion (clave, valor) values ('evento_cerrado', 'true')
  on conflict (clave) do update set valor = excluded.valor;

  return jsonb_build_object('ok', true);
end;
$$;

-- Reinicio del ensayo (RF-29): borra inversiones, notas, posiciones y acciones; devuelve las
-- rondas a PROGRAMADA y los saldos al capital inicial. Se bloquea con el evento iniciado.
create or replace function fn_reiniciar_ensayo(p_operador bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol varchar;
begin
  select o.rol into v_rol from operador o where o.id_operador = p_operador;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'OPERADOR_NO_EXISTE');
  end if;
  if v_rol <> 'CONDUCTOR' then
    return jsonb_build_object('ok', false, 'error', 'SIN_PERMISO');
  end if;
  if exists (select 1 from configuracion where clave = 'evento_iniciado' and valor = 'true') then
    return jsonb_build_object('ok', false, 'error', 'EVENTO_INICIADO');
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

  return jsonb_build_object('ok', true);
end;
$$;

-- UNLOAD de todas las tablas: {"usuario": [...], "ronda": [...], ...}.
create or replace function fn_respaldo()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tabla text;
  v_filas jsonb;
  v_datos jsonb := '{}'::jsonb;
begin
  foreach v_tabla in array fn_tablas_respaldo() loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from %I t', v_tabla)
      into v_filas;
    v_datos := v_datos || jsonb_build_object(v_tabla, v_filas);
  end loop;
  return v_datos;
end;
$$;

-- RESTORE de un respaldo: vacía las tablas y las vuelve a llenar en una transacción, con los
-- mismos identificadores, y ajusta las secuencias de identidad para los siguientes registros.
create or replace function fn_restaurar(p_datos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tabla text;
  v_secuencia text;
  v_columna text;
begin
  execute 'truncate table ' || (
    select string_agg(format('%I', t), ', ') from unnest(fn_tablas_respaldo()) t
  );

  foreach v_tabla in array fn_tablas_respaldo() loop
    execute format(
      'insert into %I overriding system value select * from jsonb_populate_recordset(null::%I, $1)',
      v_tabla, v_tabla
    ) using coalesce(p_datos -> v_tabla, '[]'::jsonb);

    select a.attname into v_columna
      from pg_attribute a
     where a.attrelid = v_tabla::regclass and a.attidentity <> '' and not a.attisdropped;
    if v_columna is not null then
      v_secuencia := pg_get_serial_sequence(v_tabla, v_columna);
      execute format(
        'select setval(%L, coalesce((select max(%I) from %I), 0) + 1, false)',
        v_secuencia, v_columna, v_tabla
      );
    end if;
    v_columna := null;
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;

-- Reconstrucción (RNF-08). startup_leaderboard sale de inversion y veredicto; leaderboard se
-- recalcula ronda por ronda: saldo = capital inicial + retornos − montos de las rondas terminadas
-- hasta esa ronda. shortcut: no incluye los ajustes manuales de saldo (fn_ajustar_saldo), que solo
-- quedan en el texto de accion_ronda; aplicarlos a mano si hubo alguno.
create or replace function fn_reconstruir_leaderboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capital numeric := fn_config_num('capital_inicial', 10000);
  v_filas integer;
begin
  update startup_leaderboard sl
     set monto_acumulado = coalesce(i.total, 0),
         inversores_unicos = coalesce(i.inversores, 0),
         precio_vivo = least(fn_config_num('precio_max', 200),
                             greatest(fn_config_num('precio_min', 50),
                                      round(100 + coalesce(i.total, 0) / 2000, 2))),
         puntaje_jurado = v.puntaje
    from ronda r
    left join (
      select id_ronda, sum(monto) as total, count(distinct id_usuario)::int as inversores
        from inversion group by id_ronda
    ) i on i.id_ronda = r.id_ronda
    left join (
      select id_ronda, round(avg(puntaje), 4) as puntaje
        from veredicto where not se_abstiene group by id_ronda
    ) v on v.id_ronda = r.id_ronda
   where sl.id_ronda = r.id_ronda;

  delete from leaderboard;

  insert into leaderboard (id_ronda, id_usuario, posicion, saldo, ganancia_ronda, aciertos)
  select corte.id_ronda,
         corte.id_usuario,
         row_number() over (partition by corte.id_ronda order by corte.saldo desc, corte.id_usuario),
         corte.saldo,
         corte.ganancia,
         corte.aciertos
    from (
      select k.id_ronda,
             u.id_usuario,
             v_capital + coalesce(sum(coalesce(i.retorno, 0) - i.monto)
                                    filter (where r.numero <= k.numero), 0) as saldo,
             coalesce(sum(coalesce(i.retorno, 0) - i.monto) filter (where r.numero = k.numero), 0) as ganancia,
             count(*) filter (where r.numero <= k.numero and r.estado = 'LIQUIDADA'
                                and r.multiplicador > 1)::int as aciertos
        from ronda k
       cross join usuario u
        left join inversion i on i.id_usuario = u.id_usuario
        left join ronda r on r.id_ronda = i.id_ronda and r.estado in ('LIQUIDADA', 'ANULADA')
       where k.estado in ('LIQUIDADA', 'ANULADA')
       group by k.id_ronda, k.numero, u.id_usuario
    ) corte;

  get diagnostics v_filas = row_count;
  return jsonb_build_object('ok', true, 'filas', v_filas);
end;
$$;

revoke all on function fn_tablas_respaldo() from public;
revoke all on function fn_cargar_resultados(bigint, jsonb) from public;
revoke all on function fn_reiniciar_ensayo(bigint) from public;
revoke all on function fn_respaldo() from public;
revoke all on function fn_restaurar(jsonb) from public;
revoke all on function fn_reconstruir_leaderboard() from public;
