# Contexto de desarrollo de Start Tank

Resumen operativo para quienes implementan la aplicación. La especificación completa está en `docs/especificacion.md`.

## Stack

Next.js 15 (App Router) con TypeScript, Neon Postgres como base de datos, Neon Auth para el ingreso del asistente mediante OAuth, pnpm y Vitest. El acceso a datos se realiza desde el servidor con `@neondatabase/serverless`. Sin Tailwind: los estilos usan los tokens CSS de `src/styles` (variables `--st-*`, `--fg-*`, `--accent`, `--r-*`). Fuentes Archivo y Manrope ya cargadas en el layout.

## Estructura y propiedad de archivos

El código se organiza por funcionalidad, con nombres en inglés. El detalle de capas y reglas de dependencia está en `docs/architecture.md`.

| Área | Ruta | Contenido |
|---|---|---|
| Rutas | `src/app/` | Páginas y route handlers delgados. Solo importan el `index.ts` de cada funcionalidad. |
| Participante | `src/features/participant/` | Móvil. Ingreso OAuth, inversión, resultado. Página en `/participant`. |
| Jurado | `src/features/jury/` | Laptop. Acceso con código y voto. Página en `/jury`. |
| Operador | `src/features/operator/` | Laptop. Consola de ronda. Página en `/operator`. |
| Pantalla | `src/features/screen/` | Proyector 16:9, pública y de solo lectura. Página en `/screen`. |
| Dominio | `src/shared/domain/` | Funciones puras y pruebas. Contrato en `config.ts` y `types.ts`. |
| Utilidades compartidas | `src/shared/lib/` | Cliente HTTP, rutas de la API (`api-routes.ts`) y selección de datos simulados. |
| Servidor común | `src/server/` | Cliente SQL y traducción de valores de la base (`db/`), sesión por código y Neon Auth (`auth/`), helpers de respuesta (`http/`). |
| Base de datos | `db/migrations/`, `db/seed.sql` | Esquema y funciones SQL transaccionales. Ver `db/README.md`. |

Cada funcionalidad contiene `components/`, `hooks/`, `api/` (clientes y datos simulados), `server/` (consultas, mapeadores y manejadores de rutas), `types.ts` e `index.ts`. Cada tarea modifica únicamente los archivos de su área. Los cambios en archivos compartidos se limitan a lo indispensable.

## Reglas de negocio esenciales

- Capital inicial 10,000 Impact Coins; compra mínima 250; tope por ronda 30 % del saldo al abrir la ronda; solo compra.
- Precio inicial 100, entre 50 y 200, según monto acumulado (no según número de operaciones). No interviene en el retorno.
- Multiplicador = 0.2 + 1.6 x fracción de respaldo (respaldos / votos emitidos; las abstenciones se excluyen).
- Liquidación: retorno = monto x multiplicador. Debe ser idempotente.
- Puntaje de startup = 0.6 x fracción de respaldo + 0.4 x porcentaje de asistentes que invirtieron. Desempate por mayor fracción de respaldo.
- Acierto = inversión en startup con 3 o 4 respaldos; "mejor ojo" = mayor número de aciertos.
- Estados de ronda: PROGRAMADA, ABIERTA, ULTIMA_LLAMADA (60 s, cierre automático), CERRADA, EN_VOTACION, LIQUIDADA, ANULADA. Son los valores de la base de datos; el código usa SCHEDULED, OPEN, LAST_CALL, CLOSED, VOTING, SETTLED y CANCELLED, traducidos en `src/server/db/values.ts`.
- Inversión: transacción con `SELECT ... FOR UPDATE` sobre el usuario. Liquidación: transacción con bloqueo de la ronda.

## Decisiones acordadas sobre los wireframes

- Ingreso del asistente solo por OAuth, sin contraseñas ni código.
- Jurado: acceso con código propio; voto definitivo, un voto por ronda; los cuatro votos se publican a la vez.
- Operador: cinco acciones (abrir, última llamada, cerrar, revelar, siguiente) más anular, modo manual, exportar y deshacer. Revelar permanece bloqueado hasta que voten todos los jurados. Anular ofrece devolver lo invertido o liquidar a 1.0x, con confirmación en dos pasos. Deshacer solo antes de revelar. Congelar resultado (RF29) queda fuera de esta fase.
- Participante (inversionista): tras cada ronda se muestra el top 3 y la posición propia. Invertir en tres toques como máximo.
- Pantalla: seis fases (mercado, última llamada, votación, liquidación, entre rondas, cierre); consulta cada 2 s; sin escrituras.
- Listas y leaderboards dimensionados para hasta 100 filas. El campo `rubro` se omite en la interfaz.
- Textos de interfaz en español, tuteo, oraciones directas, sin emojis.

## Convenciones de trabajo

- Un commit por cambio atómico, en inglés, en minúsculas, con ámbito, modo imperativo y sin punto final (por ejemplo `feat(domain): add verdict multiplier`).
- Un pull request acotado por tarea, contra `main`, con rama `feat/<area>-<tema>`.
- Sin emojis ni líneas de coautoría en commits, código o documentación.
- Identificadores, nombres de archivo, rutas de la API y códigos de error en inglés. Comentarios y documentación en español formal, sin segunda persona. Textos de interfaz en español.
- Antes de cerrar una tarea ejecutar `pnpm lint`, `pnpm typecheck` y `pnpm test`.
