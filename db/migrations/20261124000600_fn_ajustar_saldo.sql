-- Ajuste manual de saldo (RF-11).
--
-- Permite al conductor corregir el saldo de un asistente. El motivo es obligatorio y el ajuste
-- queda en accion_ronda con la acción AJUSTE_SALDO. Como esa tabla siempre referencia una ronda,
-- se usa la ronda activa; si no hay ninguna, la última ronda iniciada, y si ninguna se inició, la
-- primera. El detalle del ajuste (asistente y monto) se guarda dentro del motivo.
--
-- Parámetros:
--   p_monto  cantidad a sumar al saldo. Un valor negativo lo reduce. No puede ser cero ni dejar
--            el saldo por debajo de cero.
--
-- Devuelve jsonb con las claves ok, error (solo en caso de fallo) y saldo.

create or replace function fn_ajustar_saldo(
  p_operador bigint,
  p_usuario bigint,
  p_monto numeric,
  p_motivo varchar
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol varchar;
  v_saldo numeric(14,2);
  v_saldo_nuevo numeric(14,2);
  v_ronda bigint;
begin
  select o.rol into v_rol from operador o where o.id_operador = p_operador;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'OPERADOR_NO_EXISTE');
  end if;

  if v_rol <> 'CONDUCTOR' then
    return jsonb_build_object('ok', false, 'error', 'SIN_PERMISO');
  end if;

  if p_motivo is null or btrim(p_motivo) = '' then
    return jsonb_build_object('ok', false, 'error', 'MOTIVO_REQUERIDO');
  end if;

  if p_monto is null or p_monto = 0 then
    return jsonb_build_object('ok', false, 'error', 'MONTO_INVALIDO');
  end if;

  select u.saldo_actual
    into v_saldo
    from usuario u
   where u.id_usuario = p_usuario
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'USUARIO_NO_EXISTE');
  end if;

  v_saldo_nuevo := v_saldo + p_monto;

  if v_saldo_nuevo < 0 then
    return jsonb_build_object('ok', false, 'error', 'SALDO_NEGATIVO', 'saldo', v_saldo);
  end if;

  update usuario set saldo_actual = v_saldo_nuevo where id_usuario = p_usuario;

  select r.id_ronda
    into v_ronda
    from ronda r
   order by (r.estado in ('ABIERTA', 'ULTIMA_LLAMADA', 'CERRADA', 'EN_VOTACION')) desc,
            (r.estado <> 'PROGRAMADA') desc,
            case when r.estado <> 'PROGRAMADA' then -r.numero else r.numero end
   limit 1;

  insert into accion_ronda (id_operador, id_ronda, accion, motivo)
  values (
    p_operador,
    v_ronda,
    'AJUSTE_SALDO',
    format('usuario %s, %s IC: %s', p_usuario, p_monto, p_motivo)
  );

  return jsonb_build_object('ok', true, 'saldo', v_saldo_nuevo);
end;
$$;

revoke all on function fn_ajustar_saldo(bigint, bigint, numeric, varchar) from public;
