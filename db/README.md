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
