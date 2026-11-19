# Base de datos

Este directorio contiene los scripts SQL del esquema de Start Tank: migraciones de esquema, funciones transaccionales y datos de desarrollo.

La base de datos es Neon Postgres. El servidor de la aplicación se conecta con el rol propietario mediante `@neondatabase/serverless` e invoca las funciones definidas en este directorio. No se definen roles de cliente ni políticas de seguridad a nivel de fila.

## Estructura

| Ruta | Contenido |
|---|---|
| `migrations/` | Migraciones numeradas en orden de aplicación. |
| `seed.sql` | Datos de ejemplo para desarrollo local. |

## Orden de aplicación

Aplicar los archivos en el orden listado. El orden coincide con el orden lexicográfico de los nombres de archivo.

1. `migrations/20261108000000_initial_schema.sql`: esquema de tablas.
2. `migrations/20261108000100_fn_registrar_inversion.sql`: función de registro de inversiones.
3. `migrations/20261108000200_fn_registrar_voto.sql`: función de registro de votos.
4. `migrations/20261108000300_fn_revelar_veredicto.sql`: función interna `fn_liquidar_ronda` y función de revelación del veredicto.
5. `migrations/20261108000400_fn_accion_operador.sql`: función de acciones del operador.
6. `seed.sql`: datos de ejemplo. Ejecutar solo en entornos de desarrollo, porque contiene códigos de acceso ficticios.

## Estado en Neon

Las migraciones `20261108000000` a `20261108000400` están aplicadas en el proyecto Neon `start-tank`. Las sentencias de permisos sobre roles de Supabase no se aplicaron en esa base, por lo que este directorio refleja su estado actual. La migración de políticas de seguridad a nivel de fila se retiró del repositorio, ya que el acceso lo gestiona el servidor de la aplicación.

## Pruebas de integración

Las pruebas de integración verifican las funciones SQL contra un servidor Postgres real. Se ubican en `db/tests/` con la extensión `*.itest.ts` y se ejecutan con el script `test:db`. No forman parte de `pnpm test`.

### Requisitos

- Dependencias instaladas con `pnpm install`.
- Un servidor Postgres 17 accesible desde el equipo. Las pruebas crean y eliminan bases de datos con el prefijo `st_`, por lo que el rol indicado requiere el privilegio `CREATEDB`.

### Ejecución con Docker

Iniciar un contenedor de prueba:

```
docker run -d --name st-pg -e POSTGRES_PASSWORD=postgres -p 5433:5432 postgres:17
```

Ejecutar las pruebas con la variable `TEST_DATABASE_URL`. En bash:

```
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/postgres pnpm test:db
```

En PowerShell:

```
$env:TEST_DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/postgres"; pnpm test:db
```

Detener y eliminar el contenedor al finalizar:

```
docker rm -f st-pg
```

### Funcionamiento

Cada archivo de prueba construye una plantilla con las migraciones de `migrations/` y con `seed.sql`. Cada prueba se ejecuta en una base de datos clonada de esa plantilla, que se elimina al terminar la prueba; la plantilla se elimina al terminar el archivo. Así, las pruebas no comparten filas.

La variable `TEST_DATABASE_URL` es independiente de `DATABASE_URL`. El helper rechaza hosts de Neon, de modo que las pruebas no se ejecutan contra la base de datos de la aplicación.

Una prueba marcada con `it.fails` documenta un defecto conocido. Esa prueba se mantiene en verde mientras el defecto exista y debe cambiarse a `it` al corregirlo.
