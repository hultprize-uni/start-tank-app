-- Borrador de notas y envío del jurado (RF-14, RF-15, RF-16).
--
--   fn_guardar_borrador  guarda la nota de un criterio mientras el jurado califica. Cada nota nueva
--                        reemplaza a la anterior.
--   fn_registrar_voto    registra el envío: las notas de todos los criterios o la abstención.
--                        Calcula el puntaje del jurado y borra su borrador.
--
-- Cada jurado envía una sola vez por ronda y el envío es definitivo. La ronda se bloquea en modo
-- compartido para que el envío y la liquidación no se ejecuten al mismo tiempo.

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

  select r.estado
    into v_estado_ronda
    from ronda r
   where r.id_ronda = p_ronda
     for share;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'RONDA_NO_EXISTE');
  end if;

  if v_estado_ronda not in ('ABIERTA', 'ULTIMA_LLAMADA', 'CERRADA', 'EN_VOTACION') then
    return jsonb_build_object('ok', false, 'error', 'RONDA_NO_CALIFICABLE');
  end if;

  if exists (
    select 1 from veredicto v where v.id_jurado = p_jurado and v.id_ronda = p_ronda
  ) then
    return jsonb_build_object('ok', false, 'error', 'YA_ENVIO');
  end if;

  insert into borrador_nota (id_jurado, id_ronda, id_criterio, valor)
  values (p_jurado, p_ronda, p_criterio, p_valor)
  on conflict (id_jurado, id_ronda, id_criterio) do update set valor = excluded.valor;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function fn_guardar_borrador(bigint, bigint, bigint, integer) from public;

-- Sustituye la función de votos respalda, rechaza o se abstiene.
drop function if exists fn_registrar_voto(bigint, bigint, varchar);

-- Parámetros:
--   p_se_abstiene  verdadero si el jurado declara conflicto de interés. No lleva notas.
--   p_notas        arreglo jsonb con una nota por criterio:
--                  [{"id_criterio": 1, "valor": 4}, ...]
--
-- Devuelve jsonb con las claves ok, error (solo en caso de fallo) y puntaje.
create or replace function fn_registrar_voto(
  p_jurado bigint,
  p_ronda bigint,
  p_se_abstiene boolean,
  p_notas jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado_ronda varchar;
  v_criterios integer;
  v_recibidas integer;
  v_distintas integer;
  v_validas integer;
  v_puntaje numeric(4,3);
  v_id_veredicto bigint;
begin
  if not exists (select 1 from jurado j where j.id_jurado = p_jurado) then
    return jsonb_build_object('ok', false, 'error', 'JURADO_NO_EXISTE');
  end if;

  select r.estado
    into v_estado_ronda
    from ronda r
   where r.id_ronda = p_ronda
     for share;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'RONDA_NO_EXISTE');
  end if;

  if v_estado_ronda <> 'EN_VOTACION' then
    return jsonb_build_object('ok', false, 'error', 'RONDA_NO_EN_VOTACION');
  end if;

  if exists (
    select 1 from veredicto v where v.id_jurado = p_jurado and v.id_ronda = p_ronda
  ) then
    return jsonb_build_object('ok', false, 'error', 'VOTO_DUPLICADO');
  end if;

  if p_se_abstiene then
    insert into veredicto (id_jurado, id_ronda, se_abstiene)
    values (p_jurado, p_ronda, true);

    delete from borrador_nota b where b.id_jurado = p_jurado and b.id_ronda = p_ronda;
    return jsonb_build_object('ok', true, 'puntaje', null);
  end if;

  if p_notas is null or jsonb_typeof(p_notas) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'NOTAS_INVALIDAS');
  end if;

  select count(*) into v_criterios from criterio;

  select count(*),
         count(distinct n.id_criterio),
         count(*) filter (where n.valor between 1 and 5 and c.id_criterio is not null)
    into v_recibidas, v_distintas, v_validas
    from jsonb_to_recordset(p_notas) as n(id_criterio bigint, valor integer)
    left join criterio c on c.id_criterio = n.id_criterio;

  -- Debe llegar una nota válida por cada criterio, sin repetir ninguno.
  if v_recibidas <> v_criterios or v_distintas <> v_criterios or v_validas <> v_criterios then
    return jsonb_build_object('ok', false, 'error', 'NOTAS_INCOMPLETAS');
  end if;

  -- Puntaje del jurado: promedio ponderado de sus notas.
  select round(sum(n.valor * c.peso) / sum(c.peso), 3)
    into v_puntaje
    from jsonb_to_recordset(p_notas) as n(id_criterio bigint, valor integer)
    join criterio c on c.id_criterio = n.id_criterio;

  insert into veredicto (id_jurado, id_ronda, se_abstiene, puntaje)
  values (p_jurado, p_ronda, false, v_puntaje)
  returning id_veredicto into v_id_veredicto;

  insert into nota_criterio (id_veredicto, id_criterio, valor)
  select v_id_veredicto, n.id_criterio, n.valor
    from jsonb_to_recordset(p_notas) as n(id_criterio bigint, valor integer);

  delete from borrador_nota b where b.id_jurado = p_jurado and b.id_ronda = p_ronda;

  return jsonb_build_object('ok', true, 'puntaje', v_puntaje);
exception
  when unique_violation then
    -- Cubre dos envíos simultáneos del mismo jurado: la restricción única rechaza el segundo.
    return jsonb_build_object('ok', false, 'error', 'VOTO_DUPLICADO');
end;
$$;

revoke all on function fn_registrar_voto(bigint, bigint, boolean, jsonb) from public;
