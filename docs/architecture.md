# Arquitectura de Start Tank

Este documento describe la organización del código por funcionalidad, las reglas de dependencia entre módulos y las convenciones de nombres. El resumen operativo del proyecto está en `docs/contexto.md`.

## Estructura de directorios

```text
src/
  app/                          Rutas finas: solo importan el index.ts de cada funcionalidad
    layout.tsx, globals.css
    page.tsx                    Redirige a /participant (provisional hasta que exista la landing)
    participant/page.tsx        Portal del participante
    jury/page.tsx               Portal del jurado
    operator/page.tsx           Consola del operador
    screen/page.tsx             Pantalla del proyector
    api/
      auth/[...path]/route.ts   Reenvío a Neon Auth
      participant/{state,invest}/route.ts
      jury/{login,state,vote}/route.ts
      operator/{login,state,action,export}/route.ts
      screen/route.ts
  middleware.ts                 Canje del verificador de sesión de Neon Auth en /participant
  features/
    participant/  jury/  operator/  screen/
      components/               Componentes de interfaz y sus estilos
      hooks/                    Hooks de estado (API real o datos simulados)
      api/                      Clientes fetch y datos simulados
      server/                   Consultas, mapeadores y manejadores de rutas
      types.ts                  Contrato del view model
      index.ts                  API pública de la funcionalidad
  shared/
    domain/                     Reglas de negocio puras y sus pruebas
    lib/                        Cliente HTTP, rutas de la API (api-routes.ts), selección de datos simulados
    ui/                         Componentes compartidos (reservado)
  server/
    db/                         Cliente SQL, rondas compartidas y traducción de valores de la base
    auth/                       Sesión por código (jurado y operador), Neon Auth y lectura del código de acceso
    http/                       Helpers de respuesta de los route handlers
  styles/                       Tokens CSS globales
```

## Reglas de dependencia

La dependencia fluye en un solo sentido: `app` depende de `features`, y `features` depende de `shared` y de `server`.

1. Las páginas y los route handlers de `src/app` importan únicamente el `index.ts` de cada funcionalidad. Los route handlers solo exportan el manejador de la funcionalidad (`export const POST = handleJuryVote`), sin lógica propia.
2. Las funcionalidades no dependen entre sí, salvo por sus tipos (`@/features/<nombre>/types`). El código común se traslada a `src/shared` o `src/server`.
3. Dentro de una funcionalidad, los módulos se importan con rutas relativas. Fuera de ella, nunca se importan archivos internos: solo el `index.ts` y `types.ts`.
4. `src/shared` y `src/server` no importan de `src/features` ni de `src/app`.
5. El código de `server/` de una funcionalidad no se importa desde sus `components/` ni `hooks/`, de modo que el cliente no incorpora acceso a la base de datos.

La regla `no-restricted-imports` de `eslint.config.mjs` impone los puntos 1 a 4. Las infracciones se reportan como error en `pnpm lint`.

## Flujo de una petición

1. Un componente o hook de `features/<nombre>` llama a un cliente de `api/`, que usa las constantes de `shared/lib/api-routes.ts`. Ningún cliente escribe la URL de forma literal.
2. El route handler de `src/app/api/...` delega en `features/<nombre>/server/handlers.ts`, que valida la entrada y la sesión.
3. `server/queries.ts` ejecuta SQL mediante `server/db/client.ts` y entrega las filas a `server/mappers.ts`, que arma el view model definido en `types.ts`.

## Capa de traducción de la base de datos

La base de datos conserva sus nombres: tablas, columnas, funciones SQL y valores de estado como `ABIERTA`. La traducción al inglés ocurre únicamente en el servidor:

- `src/server/db/values.ts` convierte estados de ronda, decisiones, acciones del operador y códigos de error de las funciones SQL en los valores del dominio (`OPEN`, `BACK`, `DUPLICATE_VOTE`, etc.), y viceversa para los parámetros de las funciones.
- Las consultas leen y escriben con los nombres de la base (por ejemplo `id_ronda`, `monto_acumulado`). Esos nombres solo aparecen en las filas de las consultas y en las cadenas SQL; los view models usan nombres en inglés.
- Los códigos de error de la API son estables y están en inglés (`DUPLICATE_VOTE`, `INVALID_SESSION`, `ROUND_CAP_EXCEEDED`).

## Convención de nombres

- El código usa inglés: funciones, variables, parámetros, tipos, constantes, archivos, clases CSS locales, rutas de la API y códigos de error.
- Los textos de interfaz visibles al usuario permanecen en español.
- Los comentarios, docstrings y la documentación se redactan en español formal, en tercera persona o con formas impersonales, sin segunda persona.
- Los archivos de componentes usan `PascalCase`; los demás, `kebab-case` o `camelCase` según el contenido (por ejemplo `api-routes.ts`, `useJuryState.ts`).
- Las pruebas se ubican junto al módulo que verifican, con el sufijo `.test.ts`.
