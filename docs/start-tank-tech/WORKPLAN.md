# Start Tank: plan de trabajo

Este documento orienta el trabajo del equipo: cómo queda el repositorio, qué fases se ejecutan, quién hace cada tarea y cuándo una tarea está lista para empezar y para darse por terminada. Se basa en [BASES.md](BASES.md), [ARCHITECTURE.md](ARCHITECTURE.md), [DATABASE.md](DATABASE.md) y [SRS.md](SRS.md).

Equipo: **Renato**, **Jhon**, **Ilia** y **Leonel**.

---

## 1. Estructura del repositorio

El repositorio es `start-tank-app` (Next.js 15, React 19, TypeScript, Neon Postgres, pnpm). Las marcas indican el estado de cada archivo: **(nuevo)**, **(modifica)** y sin marca cuando ya existe y no cambia.

```
start-tank-app/
├── .env.example                       (modifica) documenta las variables que cada fase necesite
├── .github/
│   ├── workflows/ci.yml, codeql.yml, pr-title.yml
│   ├── dependabot.yml
│   └── pull_request_template.md
├── README.md                          (modifica) instalación con pnpm y enlace a docs/
├── package.json                       (modifica) scripts batch:* y loadtest
├── scripts/
│   └── batch.ts                       (nuevo) ejecuta los procesos batch: pnpm batch <proceso>
├── loadtest/
│   └── polling-100.js                 (nuevo) prueba de carga con k6
├── batch-out/                         (nuevo) archivos UNLOAD y respaldos, ignorada por git
├── docs/
│   └── start-tank-tech/               BASES.md, ARCHITECTURE.md, DATABASE.md, SRS.md, WORKPLAN.md y diagrams/
├── db/
│   ├── README.md                      (modifica) orden de aplicación de las migraciones
│   ├── seed.sql                       (modifica) criterios, configuración, logos, roles de operador
│   ├── migrations/
│   │   ├── 20261108000000 a 20261110000000   (7 existentes, no se editan)
│   │   ├── 20261124000000_nuevas_tablas.sql          (nuevo) criterio, nota_criterio, borrador_nota, configuracion
│   │   ├── 20261124000100_ajustes_columnas.sql       (nuevo) columnas nuevas y retiradas, clave alterna de inversion
│   │   ├── 20261124000200_fn_registrar_inversion_v2.sql   (nuevo)
│   │   ├── 20261124000300_fn_borrador_y_voto.sql     (nuevo)
│   │   ├── 20261124000400_fn_veredicto_continuo.sql  (nuevo) liquidación con multiplicador continuo
│   │   ├── 20261124000500_fn_accion_operador_v2.sql  (nuevo) pausa, +1 min, motivo, rol
│   │   └── 20261124000600_fn_ajustar_saldo.sql       (nuevo)
│   └── tests/
│       ├── helpers/database.ts, fixtures.ts          (modifica fixtures)
│       ├── invest, votes, verdict, settlement, operator, manual-settlement   (*.itest.ts, modifican)
│       ├── draft.itest.ts, balance.itest.ts          (nuevo)
│       └── cierre-evento.itest.ts                    (nuevo)
├── e2e/
│   ├── access-control, jury-voting, operator-round, screen-public, settlement   (*.spec.ts, modifican)
│   ├── investment.spec.ts, pause-and-rescue.spec.ts, reveal-sync.spec.ts, close-event.spec.ts   (nuevo)
│   ├── support/round-flow.ts          (modifica)
│   └── docker-compose.yml, setup-db.ts
├── public/brand/                      logos de Start Tank
└── src/
    ├── middleware.ts                  (modifica) guardia por rol
    ├── app/
    │   ├── page.tsx, layout.tsx, globals.css
    │   ├── participant/, jury/, operator/, screen/, design/   páginas
    │   └── api/
    │       ├── auth/[...path]/                       Neon Auth
    │       ├── participant/invest, state             (modifican)
    │       ├── jury/login, logout, state, vote       (modifican)
    │       ├── jury/draft                            (nuevo)
    │       ├── operator/action, export, login, logout, manual-settlement, state   (modifican)
    │       ├── operator/config, balance, attendees, health, preflight, manual-mode   (nuevo)
    │       ├── operator/close-event, rehearsal       (nuevo)
    │       └── screen/                               (modifica)
    ├── server/
    │   ├── auth/code-session.ts, access-code.ts, neon-auth.ts   (modifican) cookie por rol, solo Google
    │   ├── db/client.ts, rounds.ts, staff.ts, values.ts, test-support.ts   (rounds y staff modifican)
    │   ├── db/config.ts               (nuevo) lectura de la tabla configuracion
    │   ├── http/responses.ts          (modifica) agrega la hora del servidor a cada respuesta de estado
    │   └── batch/                     (nuevo) cierre-evento.ts, carga-inicial.ts, reinicio-ensayo.ts, exportar-posiciones.ts, respaldo.ts, reconstruir-leaderboard.ts, estadisticas.ts, index.ts
    ├── shared/
    │   ├── domain/                    config, scoring, verdict, investment, settlement, round-machine, types   (modifican con sus tests)
    │   ├── lib/api-routes.ts, http-client.ts, env.ts   (modifican)
    │   ├── lib/use-server-clock.ts, use-polling.ts, use-animated-number.ts   (nuevo)
    │   └── ui/                        kit existente (Button, Dialog, BottomSheet, Badge, Toast y los demás)
    ├── styles/                        colors.css, shape.css, typography.css
    └── features/
        ├── landing/                   (modifica) content.ts y las secciones
        ├── participant/               vista de usuario
        │   ├── components/InvestModal, InvestPreview, InvestConfirm, RankingWindow   (nuevo)
        │   ├── components/LoginScreen, MarketScreen, ScheduledScreen, ResultScreen, FinalScreen, RankingPanel   (modifican)
        │   ├── hooks/useOptimisticBalance, useRevealDelay                           (nuevo)
        │   └── hooks/useParticipantState, useInvestForm                              (modifican)
        ├── jury/                      vista del jurado
        │   ├── components/ScoreScale, ScoreSummary, AbstainSheet, ConfirmSendSheet   (nuevo)
        │   ├── components/CriteriaCard, VotePanel, JuryShell, RoundStatus, ResultPanel   (modifican)
        │   ├── hooks/useDraft                                                        (nuevo)
        │   └── criteria.ts, server/handlers, queries, mappers                         (modifican)
        ├── operator/                  vista del admin
        │   ├── components/MainActionButton, PhaseTimer, HealthBar, AlertBanner, PreflightChecklist, ConfigPanel, AttendeeSearch, BalanceAdjustDialog, RescueRevealDialog, ManualModePanel, CloseEventPanel   (nuevo)
        │   ├── components/ActionsPanel, ControlsPanel, JurorVotesPanel, MarketPanel, ActionLogPanel, OperatorSidebar, OperatorConsole   (modifican)
        │   └── server/handlers, queries, mappers                                      (modifican)
        └── screen/                    escenario
            ├── components/InvestmentChart, InvestorTable, StartupTicker, JurySeats, EventFeed, RevealSequence   (nuevo)
            ├── components/MarketPhase, LastCallPhase, VotingPhase, SettlementPhase, BetweenRoundsPhase, ClosingPhase   (modifican)
            └── hooks/useScreenState, server/queries, mappers                         (modifican)
```

---

## 2. Fases y tareas

### 2.1 Resumen

| Fase | Nombre | Responsable | Depende de | Habilita | Tamaño |
|---|---|---|---|---|---|
| F0 | Entorno y repositorio | Renato | Ninguna | F1 | S |
| F1 | Base de datos y migraciones | Renato | F0 | F2 | L |
| F2 | Núcleo compartido y contratos | Renato | F1 | F3 a F8 | M |
| F3 | Vista de usuario | Renato | F2 | F9 | L |
| F4 | Vista del jurado | Jhon | F2 | F9 | M |
| F5 | Vista del admin | Ilia | F2 | F9 | L |
| F6 | Escenario | Leonel | F2 | F9 | M |
| F7 | Procesos batch | Leonel | F2 | F9 | M |
| F8 | Landing | Jhon | F2 | F9 | S |
| F9 | Integración y pruebas | Todos | F3 a F8 | Evento | M |

Las fases F0 a F2 son de Renato y se ejecutan primero. Al cerrar F2, Jhon, Ilia y Leonel trabajan en paralelo y sin depender de nadie más: la base de datos, las funciones, las rutas, los tipos, las sesiones y los hooks compartidos ya existen. Las rutas nuevas quedan creadas en F2 con su contrato y datos de muestra (`NEXT_PUBLIC_USE_MOCKS=true`), así cada persona desarrolla su vista contra ese contrato.

### 2.2 Reglas de trabajo

- Se crea una rama por fase con el nombre `feat/f<número>-<tema>` y se abre un PR hacia `main` con título semántico, como exige `pr-title.yml`.
- Cada persona edita solo la carpeta de su fase: `features/participant` (Renato), `features/jury` y `features/landing` (Jhon), `features/operator` (Ilia), `features/screen` y `server/batch` (Leonel).
- `db/migrations`, `src/shared/domain`, `src/shared/lib`, `src/shared/ui`, `src/server/auth` y `src/middleware.ts` los edita Renato en F0 a F2. Después de F2, un cambio en esas carpetas se hace en un PR pequeño propio, revisado por Renato.
- Si una vista necesita un componente nuevo, lo crea dentro de su carpeta de feature.
- Todo PR sigue la lista de `pull_request_template.md`: `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build`.

### 2.3 F0: Entorno y repositorio (Renato)

| Tarea | Archivos | Requisitos |
|---|---|---|
| 0.1 Activar pnpm con corepack e instalar dependencias con `pnpm install`. | `package.json` | |
| 0.2 Completar `.env` con `DATABASE_URL` de Neon, `SESSION_SECRET` de 32 caracteres o más, `NEON_AUTH_BASE_URL` y `NEON_AUTH_COOKIE_SECRET`, y compartirlo con el equipo por un canal privado. El `.env` no se sube al repositorio. | `.env`, `.env.example` | RNF-09 |
| 0.3 Verificar en Neon Auth que solo el proveedor Google está habilitado. El ingreso con Google ya funciona en local. | Neon Auth | RF-01 |
| 0.4 Crear la rama de Neon para staging y aplicar las migraciones existentes. | `db/README.md` | |
| 0.5 Confirmar que `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build` pasan sobre `main`. | `.github/workflows/ci.yml` | |
| 0.6 Subir `docs/start-tank-tech/` al repositorio y actualizar el README con la instalación y el enlace a los documentos. | `docs/`, `README.md` | |

### 2.4 F1: Base de datos y migraciones (Renato)

| Tarea | Archivos | Requisitos |
|---|---|---|
| 1.1 Crear las tablas `criterio`, `nota_criterio`, `borrador_nota` y `configuracion`. | `20261124000000_nuevas_tablas.sql` | RF-14, RF-16, RF-28 |
| 1.2 Ajustar columnas: `veredicto` (`se_abstiene` y `puntaje` reemplazan a `decision`), `inversion` (clave alterna usuario y ronda), `startup_leaderboard` (`puntaje_jurado` reemplaza a `fraccion_respaldo`), `usuario` y `jurado` (`ultima_conexion`), `operador` (`rol`), `startup` (`logo_url`), `ronda` (`fase_termina_en`, `segundos_restantes_pausa`), `accion_ronda` (`motivo`). Retirar `usuario.rubro`, `usuario.estado`, los `creado_en` y los `actualizado_en` indicados en DATABASE.md. | `20261124000100_ajustes_columnas.sql` | RF-03, RF-07, RF-09, RF-12, RF-15 |
| 1.3 Reescribir `fn_registrar_inversion`: una inversión por ronda, rechazo con mercado cerrado o en pausa, tope del 30% del saldo con que abrió la ronda, y actualización de monto, inversores y precio. | `20261124000200_fn_registrar_inversion_v2.sql` | RF-12, RF-13, RNF-06 |
| 1.4 Crear `fn_guardar_borrador` (guarda cada nota) y reescribir `fn_registrar_voto`: 4 notas de 1 a 5, abstención, un envío por jurado y ronda, puntaje ponderado y borrado del borrador. | `20261124000300_fn_borrador_y_voto.sql` | RF-14, RF-15, RF-16 |
| 1.5 Reescribir `fn_liquidar_ronda` y `fn_revelar_veredicto`: puntaje promedio sin abstenciones, multiplicador continuo, retorno, saldos, posiciones por patrimonio, aciertos con multiplicador mayor que 1.0, `liquidada_en` con la hora del servidor, y revelación con los jurados presentes. | `20261124000400_fn_veredicto_continuo.sql` | RF-18 a RF-21, RNF-05, RNF-06 |
| 1.6 Reescribir `fn_accion_operador`: pausa y reanudación con `segundos_restantes_pausa`, +1 minuto sobre `fase_termina_en`, cierre automático de la última llamada vencida, motivo y validación de rol. | `20261124000500_fn_accion_operador_v2.sql` | RF-06 a RF-09 |
| 1.7 Crear `fn_ajustar_saldo` con motivo obligatorio y revisar `fn_liquidar_manual`. | `20261124000600_fn_ajustar_saldo.sql` | RF-10, RF-11 |
| 1.8 Actualizar `seed.sql`: 4 criterios con peso 25% y sus frases de referencia, parámetros por defecto en `configuracion` (capital 10,000, mínimo 250, tope 30%, precio 50 a 200, fases 5, 10, 1, 2.5 y 1.5 minutos, retraso de teléfonos 3 s, `evento_iniciado` y `modo_manual` en falso), 5 startups con logo, 4 jurados y 2 operadores (conductor y soporte). | `db/seed.sql` | RF-28, RF-29 |
| 1.9 Actualizar las pruebas de integración existentes y crear `draft.itest.ts` y `balance.itest.ts`. | `db/tests/` | RNF-05, RNF-06 |
| 1.10 Aplicar migraciones y seed en Neon staging y documentar el orden en `db/README.md`. | `db/README.md` | |

### 2.5 F2: Núcleo compartido y contratos (Renato)

| Tarea | Archivos | Requisitos |
|---|---|---|
| 2.1 Actualizar el dominio puro: multiplicador continuo, puntaje de la startup, puntaje final 60/40, una inversión por ronda, aciertos con multiplicador mayor que 1.0, máquina de estados con pausa y cierre automático de la última llamada, y valores por defecto de duraciones y de consulta (3 s, 2 s y 1 s). Cada archivo con sus pruebas. | `shared/domain/*` | RF-06 a RF-08, RF-12, RF-19 a RF-21, RF-30 |
| 2.2 Definir los tipos de estado de cada vista con `serverTime`, `phaseEndsAt`, `paused` y los tipos de cierre de evento. | `shared/domain/types.ts` | RF-07, RNF-15 |
| 2.3 Leer `configuracion` desde el servidor y agregar la hora del servidor a cada respuesta de estado. | `server/db/config.ts`, `server/http/responses.ts` | RF-28, RNF-15 |
| 2.4 Registrar en `api-routes.ts` todas las rutas nuevas y actualizar el cliente HTTP para leer la hora del servidor. | `shared/lib/api-routes.ts`, `http-client.ts` | |
| 2.5 Sesiones por cookie: asistentes 2 horas, jurados 3 horas, operadores 4 horas, solo con Google, con el rol dentro de la sesión. Guardia por rol en `middleware.ts`. | `server/auth/*`, `middleware.ts` | RF-03 a RF-05, RNF-09, RNF-10 |
| 2.6 Registrar `ultima_conexion` de asistentes y jurados como máximo una vez cada 15 segundos por sesión. | `participant/state` y `jury/state` | RF-26, RNF-01 |
| 2.7 Crear los hooks compartidos `use-server-clock`, `use-polling` y `use-animated-number`. | `shared/lib/` | RF-07, RF-22, RNF-15 |
| 2.8 Crear las rutas nuevas (`jury/draft`, `operator/config`, `balance`, `attendees`, `health`, `preflight`, `manual-mode`, `close-event`, `rehearsal`) con su contrato y datos de muestra. | `app/api/**` | |
| 2.9 Pruebas unitarias del dominio, del middleware y de las sesiones. | `*.test.ts` | RNF-09, RNF-10 |

### 2.6 F3: Vista de usuario (Renato)

| Tarea | Archivos | Requisitos |
|---|---|---|
| 3.1 Ingreso solo con Google: ya implementado en `LoginScreen` y `auth-client`. Se verifica que la billetera se crea una sola vez por cuenta y que la sesión vence a las 2 horas (F2.5). | `LoginScreen`, `auth-client`, `provisioning.ts` | RF-01, RF-02 |
| 3.2 Modal de inversión de tamaño medio con el logo, el ODS y la descripción de la startup, y el campo de monto con los atajos `250`, `25%` y `Máx`. | `InvestModal`, `InvestForm`, `useInvestForm` | RF-12, RNF-13 |
| 3.3 Vista previa de lo que recibiría con puntajes de 1 a 5 y confirmación en dos pasos. | `InvestPreview`, `InvestConfirm` | RF-24 |
| 3.4 Estado "Ya invertiste en esta ronda" y bloqueo con el mensaje "Mercado en pausa" o con el mercado cerrado. | `MarketScreen`, `InvestPanel` | RF-07, RF-12 |
| 3.5 Saldo optimista al invertir, con reversión y aviso si el servidor rechaza. | `useOptimisticBalance` | RF-13, RNF-03 |
| 3.6 Mercado con precio en vivo, saldo y cronómetro con la hora del servidor. | `MarketScreen`, `useParticipantState` | RF-23, RNF-02, RNF-15 |
| 3.7 Tabla de posiciones con el usuario, 2 vecinos por arriba y por abajo, distancia al primero y al podio, y flechas de movimiento. | `RankingWindow`, `RankingPanel`, `participant/server/queries` | RF-23 |
| 3.8 Espera entre rondas con la siguiente startup, el saldo y la racha de mejor ojo. | `ScheduledScreen` | RF-23 |
| 3.9 Veredicto: multiplicador con el puntaje en porcentaje, conteo animado del saldo (verde si sube, ámbar si baja), sin vibración, mostrado 3 segundos después de `liquidada_en` según la hora del servidor. | `ResultScreen`, `useRevealDelay` | RF-21, RF-22, RNF-04 |
| 3.10 Resultado final con posición, aciertos y startup ganadora. | `FinalScreen` | RF-30 |
| 3.11 Handlers, consultas y mapeos de `participant/invest` y `participant/state`. | `participant/server/*` | RF-12, RF-13 |
| 3.12 Diseño de teléfono (390 px) y escritorio (1440 px) según Figma, con foco visible, contraste y movimiento reducido. | CSS de los componentes | RNF-12 |
| 3.13 Pruebas unitarias, de componentes y `investment.spec.ts`. | `*.test.tsx`, `e2e/` | RNF-13 |

### 2.7 F4: Vista del jurado (Jhon)

| Tarea | Archivos | Requisitos |
|---|---|---|
| 4.1 Acceso con código y mensaje claro cuando el código no existe. | `AccessForm`, `jury/login` | RF-03, RF-04 |
| 4.2 Criterios leídos desde `criterio`, con una escala del 1 al 5 y las frases de referencia en cada nota. | `criteria.ts`, `ScoreScale`, `CriteriaCard` | RF-14 |
| 4.3 Borrador guardado en la base a medida que el jurado pone cada nota, con el indicador "Borrador guardado". | `useDraft`, `jury/draft` | RF-14 |
| 4.4 Puntaje en vivo y resumen fijo al fondo con el botón Enviar notas bloqueado hasta que se habilite la votación. | `ScoreSummary`, `VotePanel` | RF-16 |
| 4.5 Abstención por conflicto de interés con diálogo de confirmación. El motivo se elige en el diálogo y no se almacena. | `AbstainSheet` | RF-15 |
| 4.6 Envío único con resumen y confirmación. | `ConfirmSendSheet`, `jury/vote` | RF-16, RF-17 |
| 4.7 Veredicto revelado con el puntaje, el multiplicador y las notas de los 4 jurados. | `ResultPanel` | RF-19 |
| 4.8 Barra de fase con la startup en escena y el cronómetro con la hora del servidor. | `JuryShell`, `RoundStatus` | RF-07, RNF-15 |
| 4.9 Diseño de laptop (1280 px) y teléfono (390 px). | CSS de los componentes | RNF-12 |
| 4.10 Handlers y consultas de `jury/state`, `jury/vote` y `jury/draft`, sin exponer notas ajenas antes del veredicto. | `jury/server/*` | RF-17, RNF-11 |
| 4.11 Pruebas unitarias, de componentes y actualización de `jury-voting.spec.ts`. | `*.test.tsx`, `e2e/` | |

### 2.8 F5: Vista del admin (Ilia)

| Tarea | Archivos | Requisitos |
|---|---|---|
| 5.1 Acceso por rol: el conductor ejecuta acciones y el soporte solo lee. | `OperatorSidebar`, `AccessGate`, handlers | RF-03, RF-05, RNF-10 |
| 5.2 Botón principal contextual que muestra solo el paso válido de la ronda. | `MainActionButton`, `ControlsPanel` | RF-06 |
| 5.3 Cronómetro por fase con `+1 min`, `pausa` e indicador de adelanto o atraso del evento. | `PhaseTimer` | RF-07, RNF-15 |
| 5.4 Lectura en vivo del mercado, de los jurados (conectado, pendiente, enviado, sin notas) y de los asistentes conectados. | `MarketPanel`, `JurorVotesPanel` | RF-17, RF-26, RNF-11 |
| 5.5 Revelar veredicto bloqueado hasta los 4 envíos, con rescate para revelar con los presentes con confirmación y motivo. | `RescueRevealDialog`, `ActionsPanel` | RF-18 |
| 5.6 Anulación de ronda con motivo, liquidación manual y exportación. | `CancelRoundDialog`, `ManualSettlementPanel` | RF-10, RF-31 |
| 5.7 Ajuste manual de saldo con motivo obligatorio. | `BalanceAdjustDialog`, `operator/balance` | RF-11 |
| 5.8 Buscador de asistentes con su saldo y su posición. | `AttendeeSearch`, `operator/attendees` | RF-26 |
| 5.9 Semáforo y alertas con banner rojo, sonido y acción sugerida: base de datos, jurados y teléfonos. | `HealthBar`, `AlertBanner`, `operator/health` | RF-26, RNF-07 |
| 5.10 Modo manual que congela el ranking en el último corte liquidado. | `ManualModePanel`, `operator/manual-mode` | RF-27, RNF-08 |
| 5.11 Configuración de límites, duraciones, startups, jurados y criterios, bloqueada con una ronda abierta. | `ConfigPanel`, `operator/config` | RF-28, RNF-14 |
| 5.12 Checklist previo, botón Iniciar evento y modo ensayo, que llama a la ruta `rehearsal`. | `PreflightChecklist`, `operator/preflight` | RF-29 |
| 5.13 Cierre del evento, que llama a la ruta `close-event`. | `CloseEventPanel` | RF-30 |
| 5.14 Log de acciones con operador, hora y motivo. | `ActionLogPanel` | RF-09 |
| 5.15 Handlers y consultas de las rutas `operator/*`, y pruebas con actualización de `operator-round.spec.ts` y `access-control.spec.ts`. | `operator/server/*`, `e2e/` | RNF-10 |

### 2.9 F6: Escenario (Leonel)

| Tarea | Archivos | Requisitos |
|---|---|---|
| 6.1 Estado del escenario con consulta cada 2 segundos y cada 1 segundo durante la votación, con números interpolados. | `useScreenState` | RF-25, RNF-04 |
| 6.2 Curva de monto acumulado con un pulso por inversión y el salto final al veredicto. | `InvestmentChart`, `screen/server/queries` | RF-25 |
| 6.3 Tabla de inversores por patrimonio con el nombre real y la inicial del apellido, el contador de asistentes que ya invirtieron y el reordenamiento animado al liquidar. | `InvestorTable` | RF-25 |
| 6.4 Cinta de startups con su multiplicador final a medida que cierran. | `StartupTicker` | RF-25 |
| 6.5 Asientos del jurado que se iluminan al enviar sin mostrar la nota. Las 4 notas salen a la vez al revelar. | `JurySeats` | RF-17, RF-25 |
| 6.6 Feed de eventos: apuesta grande, hitos de monto, última llamada, mercado cerrado, jurados que votaron, multiplicador y fin de ronda. | `EventFeed` | RF-25 |
| 6.7 Secuencia de revelación en menos de 1 segundo: notas, multiplicador, salto de la curva y tabla reordenada. | `RevealSequence` | RF-22, RNF-04 |
| 6.8 Fases de espera, mercado, última llamada, votación, veredicto, entre rondas y cierre con la ganadora, el top 3 y el mejor ojo. | `*Phase.tsx` | RF-25, RF-30 |
| 6.9 Aviso visible cuando el modo manual está activo. | `ScreenStage` | RF-27 |
| 6.10 Pantalla pública sin autenticación y sin escrituras. | `screen/server/*` | RF-25 |
| 6.11 Diseño de 1920×1080, movimiento reducido, pruebas y actualización de `screen-public.spec.ts`. | CSS, `e2e/` | |

### 2.10 F7: Procesos batch (Leonel)

| Tarea | Archivos | Requisitos |
|---|---|---|
| 7.1 Crear la estructura de los procesos y el comando `pnpm batch <proceso>`. Los archivos de salida van a `batch-out/`. | `scripts/batch.ts`, `server/batch/index.ts` | |
| 7.2 Carga inicial del evento con LOAD de startups, jurados, operadores, criterios y configuración desde archivo. | `carga-inicial.ts` | RF-28 |
| 7.3 Cierre del evento según DATABASE.md: evalúa rondas, UNLOAD, SORT, LOAD y RESTORE ante un fallo. Se expone en la ruta `operator/close-event`. | `cierre-evento.ts` | RF-30 |
| 7.4 Reinicio del modo ensayo con respaldo previo, borrado de movimientos, saldos de vuelta a 10,000 y rondas programadas. Se bloquea con `evento_iniciado` y se expone en la ruta `operator/rehearsal`. | `reinicio-ensayo.ts` | RF-29 |
| 7.5 Exportación de saldos y posiciones tras cada liquidación y al cierre. | `exportar-posiciones.ts` | RF-31 |
| 7.6 Respaldo con UNLOAD de todas las tablas antes del evento y tras cada ronda, y RESTORE del último respaldo. | `respaldo.ts` | RNF-08 |
| 7.7 Reconstrucción de `leaderboard` y `startup_leaderboard` desde `inversion`, `veredicto` y `nota_criterio`. | `reconstruir-leaderboard.ts` | RNF-08 |
| 7.8 Estadísticas del evento: inversión por startup, participación y notas por jurado. | `estadisticas.ts` | |
| 7.9 Mantenimiento de índices y reorganización de tablas, para ejecutar después del evento. | `scripts/batch.ts` | |
| 7.10 Pruebas unitarias y `cierre-evento.itest.ts`. | `db/tests/`, `*.test.ts` | RNF-05 |

### 2.11 F8: Landing (Jhon)

| Tarea | Archivos | Requisitos |
|---|---|---|
| 8.1 Actualizar el contenido con las reglas vigentes: ingreso con Google, una inversión por ronda, multiplicador según el puntaje del jurado, programa y fecha. | `content.ts`, `RulesSection`, `ProgramSection`, `PlatformSection` | |
| 8.2 Demo de mercado en vivo en la portada según el diseño de Figma. | `HeroMarketCard`, `market-demo.ts` | |
| 8.3 Enlaces a los portales, botón de inscripción en Luma y metadatos. | `LandingHeader`, `SignupSection`, `metadata.ts` | |
| 8.4 Diseño de escritorio y teléfono, animación de la portada con movimiento reducido y pruebas. | `landing.module.css` | RNF-12 |

### 2.12 F9: Integración y pruebas (todos)

| Tarea | Responsable | Requisitos |
|---|---|---|
| 9.1 Prueba de carga con k6: 100 sesiones simultáneas consultando cada 3 segundos y 100 asistentes invirtiendo en el último minuto de una ronda. | Renato | RNF-01 a RNF-03 |
| 9.2 Medición de la sincronía de revelación entre escenario y teléfonos, y de los cronómetros entre vistas. | Renato | RNF-04, RNF-15 |
| 9.3 `investment.spec.ts`: una inversión por ronda, rechazo por pausa o cierre y saldo optimista. | Renato | RF-12, RF-13 |
| 9.4 `jury-voting.spec.ts`: borrador recuperado al recargar, envío único, abstención, en laptop y en teléfono. | Jhon | RF-14 a RF-16 |
| 9.5 `pause-and-rescue.spec.ts`: pausa, rescate con los presentes, anulación, ajuste de saldo y permisos por rol. | Ilia | RF-05, RF-07, RF-10, RF-11, RF-18 |
| 9.6 `reveal-sync.spec.ts` y `close-event.spec.ts`: revelación, modo manual y cierre del evento. | Leonel | RF-22, RF-27, RF-30 |
| 9.7 Reemplazar los códigos de ejemplo del seed por códigos reales, desactivar `NEXT_PUBLIC_USE_MOCKS` y revisar las variables de entorno del despliegue. | Renato | RNF-09 |
| 9.8 Ensayo general de las 5 rondas con 30 teléfonos, desde el checklist hasta el cierre del evento. Los hallazgos se registran como issues y se corrigen en PRs pequeños. | Todos | |

---

## 3. Definition of Ready y Definition of Done

### 3.1 Definition of Ready

Una tarea está lista para empezar cuando:

1. Referencia sus requisitos del SRS (RF, RNF, HU o CU) y su diseño en Figma, si es de interfaz.
2. Sus dependencias de otras fases están fusionadas en `main`.
3. Las migraciones y las funciones SQL que usa están aplicadas en Neon staging.
4. Las rutas y los tipos que consume existen en el contrato de F2, con datos de muestra.
5. Tiene rama propia, con el nombre `feat/f<número>-<tema>`.
6. El `.env` local funciona y `pnpm dev` levanta la aplicación.

Una fase está lista para empezar cuando la fase de la que depende cumplió su Definition of Done.

### 3.2 Definition of Done

Una tarea está terminada cuando:

1. El código cumple los requisitos que referencia y sus ejemplos del SRS.
2. Tiene pruebas: unitarias para la lógica, de componentes para la interfaz y de integración si cambió SQL.
3. `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build` pasan, y el CI del PR está en verde.
4. Funciona contra la base de datos real de staging, sin datos de muestra en el camino de producción.
5. La interfaz coincide con el diseño de Figma en teléfono, laptop o proyector según corresponda, con contraste de 4.5:1, foco visible y movimiento reducido respetado.
6. El PR tiene título semántico, descripción de lo hecho y la lista de la plantilla completa, y fue revisado por al menos otra persona del equipo.
7. Si cambió un contrato, una regla o una tabla, se actualizó el documento correspondiente en `docs/start-tank-tech/`.

Una fase está terminada cuando todas sus tareas cumplen la Definition of Done, está fusionada en `main` y desplegada en staging.
