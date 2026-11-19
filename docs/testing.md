# Pruebas de la aplicación

Este documento describe las capas de prueba del proyecto, el entorno local de pruebas end-to-end y su ejecución en CI. La base de datos de las pruebas end-to-end es un Postgres 17 local, accedido mediante el proxy HTTP de Neon. Las pruebas no requieren la base de datos de Neon.

## Capas de prueba

| Capa | Comando | Ubicación | Requisitos |
|---|---|---|---|
| Unitarias | `pnpm test` | `src/**/*.test.ts` | Ninguno |
| Integración SQL | `pnpm test:db` | `db/tests/*.itest.ts` | Postgres 17 con `TEST_DATABASE_URL` |
| End-to-end | `pnpm e2e` | `e2e/*.spec.ts` | Postgres 17, proxy HTTP de Neon y Chromium |

## Proxy HTTP local de Neon

El driver `@neondatabase/serverless` envía las consultas por HTTP al endpoint de Neon. Con la variable `NEON_LOCAL_PROXY_URL` definida, `src/server/db/client.ts` dirige el driver al proxy local:

- `neonConfig.fetchEndpoint` apunta a `<NEON_LOCAL_PROXY_URL>/sql`.
- `neonConfig.useSecureWebSocket` se establece en `false`.
- `neonConfig.poolQueryViaFetch` se establece en `true`.

La variable `DATABASE_URL` conserva el formato habitual de Neon. El host `db.localtest.me` identifica el endpoint ante el proxy; el proxy usa como destino el Postgres indicado en su variable `PG_CONNECTION_STRING`. Sin `NEON_LOCAL_PROXY_URL`, el cliente no modifica la configuración del driver, de modo que el comportamiento de producción no cambia. La rama se verifica en `src/server/db/client.local-proxy.test.ts`.

## Entorno local con Docker Compose

El archivo `e2e/docker-compose.yml` define dos servicios:

| Servicio | Imagen | Puerto del host por omisión |
|---|---|---|
| `db` | `postgres:17`, base `startank` | 55433 |
| `proxy` | `ghcr.io/timowilhelm/local-neon-http-proxy:main` | 55434 |

Los puertos se modifican con las variables `E2E_DB_PORT` y `E2E_PROXY_PORT`.

### Procedimiento

1. Iniciar los servicios: `docker compose -f e2e/docker-compose.yml up -d`.
2. Instalar las dependencias y Chromium: `pnpm install` y `pnpm e2e:install`.
3. Aplicar las migraciones y el seed: `pnpm e2e:db`. El script recrea el esquema público de la base local, aplica `db/migrations/*.sql` en orden y ejecuta `db/seed.sql`. Solo acepta hosts locales.
4. Ejecutar las pruebas: `pnpm e2e`.
5. Detener y eliminar los servicios y sus volúmenes: `docker compose -f e2e/docker-compose.yml down -v`.

Con puertos distintos a los de omisión, se definen las variables antes de los pasos 1 y 4. En bash:

```
E2E_DB_PORT=55433 E2E_PROXY_PORT=55434 pnpm e2e
```

En PowerShell:

```
$env:E2E_DB_PORT = "55433"; $env:E2E_PROXY_PORT = "55434"; pnpm e2e
```

### Variables del entorno de pruebas

| Variable | Uso | Valor por omisión |
|---|---|---|
| `E2E_DATABASE_URL` | Conexión directa a Postgres para migraciones y restablecimiento de datos | `postgres://postgres:postgres@localhost:55433/startank` |
| `E2E_DB_PORT` | Puerto de Postgres usado por la aplicación y por las pruebas | `55433` |
| `E2E_PROXY_PORT` | Puerto del proxy usado por `NEON_LOCAL_PROXY_URL` | `55434` |
| `E2E_SKIP_BUILD` | Con valor `1` y un build existente, se inicia la aplicación sin compilarla | Sin definir |

Las variables `DATABASE_URL`, `NEON_LOCAL_PROXY_URL`, `SESSION_SECRET`, `NEON_AUTH_BASE_URL` y `NEON_AUTH_COOKIE_SECRET` las define `playwright.config.ts` para el servidor de la aplicación. Los valores son ficticios.

## Pruebas end-to-end

La configuración `playwright.config.ts` usa un único proyecto de Chromium y ejecuta las pruebas en serie, porque comparten la base de datos. El servidor de la aplicación se inicia en el puerto 3200 con `pnpm build && pnpm start`. Cada prueba restablece las tablas de negocio y vuelve a cargar el seed mediante `resetDatabase` de `e2e/setup-db.ts`.

| Archivo | Caso |
|---|---|
| `e2e/screen-public.spec.ts` | La pantalla pública responde sin autenticación y muestra la fase de espera |
| `e2e/operator-round.spec.ts` | El operador abre el mercado, declara la última llamada y cierra, con la votación habilitada; el veredicto permanece bloqueado |
| `e2e/jury-voting.spec.ts` | Cuatro jurados votan desde contextos separados y un segundo voto se rechaza con `DUPLICATE_VOTE` |
| `e2e/settlement.spec.ts` | El operador revela el veredicto y la pantalla muestra la liquidación con multiplicador 1.40 x |
| `e2e/access-control.spec.ts` | Una sesión de jurado recibe 401 en las rutas del operador; `/participant` muestra el ingreso y su estado requiere sesión |

Los selectores usan roles y texto accesible. Los flujos de la ronda se encuentran en `e2e/support/round-flow.ts`.

### Limitaciones conocidas

- El formulario de acceso del jurado acepta solo cuatro dígitos, y los códigos de `db/seed.sql` (`JUR-EJ-001` a `JUR-EJ-004`) no cumplen ese formato. Las pruebas ingresan a los jurados mediante `POST /api/jury/login` en el contexto del navegador, y los votos se emiten mediante la API.
- La pantalla del jurado no restaura la sesión al cargar la página: tras `/jury`, el formulario de acceso se muestra aunque la cookie sea válida.
- La consola del operador exige ingresar el código tras recargar la página, aunque la cookie de sesión siga vigente.
- Tras revelar una ronda, la consola del operador pasa a la siguiente ronda.
- El multiplicador se muestra en la pantalla con dos decimales y el sufijo "x" separado (por ejemplo "1.40 x"); las pruebas verifican ese formato.
- Con la fase de espera, la pantalla muestra la fase "Entre rondas" y no un texto específico de espera.

## Integración continua

El job `e2e` de `.github/workflows/ci.yml` se ejecuta en `ubuntu-latest` con un límite de 20 minutos. Declara dos servicios: `postgres:17` en el puerto 5432 y el proxy de Neon en el puerto 4444. El proxy llega al Postgres del host mediante `host.docker.internal`, por lo que el servicio se crea con `--add-host=host.docker.internal:host-gateway`. El job instala Chromium con `pnpm e2e:install`, aplica el esquema con `pnpm e2e:db`, ejecuta `pnpm e2e` y sube `playwright-report` como artefacto durante siete días. Las pruebas se reintentan una vez en CI y registran la traza en el primer reintento.
