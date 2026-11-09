-- Función de registro de votos del jurado (especificación, sección 2.4).
--
-- Solo acepta votos cuando la ronda se encuentra en EN_VOTACION. Cada jurado emite un único
-- voto por ronda; el voto es definitivo y no admite modificaciones.
--
-- La ronda se bloquea en modo compartido para que el registro del voto y la liquidación no
-- se ejecuten al mismo tiempo.
--
-- Devuelve jsonb con las claves ok y error (solo en caso de fallo).

create or replace function fn_registrar_voto(
  p_jurado bigint,
  p_ronda bigint,
  p_decision varchar
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado_ronda varchar;
begin
  if p_decision not in ('RESPALDA', 'RECHAZA', 'SE_ABSTIENE') then
    return jsonb_build_object('ok', false, 'error', 'DECISION_INVALIDA');
  end if;

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
    select 1
      from veredicto v
     where v.id_jurado = p_jurado
       and v.id_ronda = p_ronda
  ) then
    return jsonb_build_object('ok', false, 'error', 'VOTO_DUPLICADO');
  end if;

  insert into veredicto (id_jurado, id_ronda, decision)
  values (p_jurado, p_ronda, p_decision);

  return jsonb_build_object('ok', true);
exception
  when unique_violation then
    -- Cubre el caso de dos votos simultáneos del mismo jurado: la restricción única rechaza el segundo.
    return jsonb_build_object('ok', false, 'error', 'VOTO_DUPLICADO');
end;
$$;

-- Acceso restringido: la función la invoca el servidor de la aplicación con el rol propietario,
-- que valida el código de acceso del jurado antes de llamarla.
revoke all on function fn_registrar_voto(bigint, bigint, varchar) from public;
