-- Datos base del sistema: criterios de calificación y configuración por defecto.
--
-- Las funciones SQL leen estas filas para operar (límites de dinero, duración de las fases, pesos
-- de los criterios), por lo que no son datos de ejemplo. Cada inserción omite las filas existentes.

-- Criterios de calificación: cuatro criterios con peso igual (suma 1.0).
insert into criterio (nombre, peso, ancla_min, ancla_max) values
  ('Problema y mercado', 0.250, 'Problema difuso, sin mercado claro', 'Problema real y mercado grande bien definido'),
  ('Modelo de negocio', 0.250, 'No explica cómo genera ingresos', 'Ingresos claros, escalables y con costos controlados'),
  ('Impacto ODS', 0.250, 'Impacto social o ambiental marginal', 'Impacto medible y alineado a un ODS'),
  ('Equipo y pitch', 0.250, 'Equipo sin experiencia, pitch confuso', 'Equipo sólido y pitch convincente')
on conflict (nombre) do nothing;

-- Configuración por defecto. Los tiempos están en segundos.
insert into configuracion (clave, valor) values
  ('capital_inicial', '10000'),
  ('compra_minima', '250'),
  ('tope_ronda', '0.30'),
  ('precio_min', '50'),
  ('precio_max', '200'),
  ('duracion_pitch_s', '300'),
  ('duracion_toma_y_dame_s', '600'),
  ('duracion_ultima_llamada_s', '60'),
  ('duracion_votacion_s', '150'),
  ('duracion_resultado_s', '90'),
  ('retraso_telefono_s', '3'),
  ('evento_iniciado', 'false'),
  ('modo_manual', 'false')
on conflict (clave) do nothing;
