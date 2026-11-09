# Autenticación del inversionista

Este documento describe la integración de Neon Auth en el portal del inversionista. El acceso se realiza únicamente con Google mediante OAuth. El sistema no almacena contraseñas.

## Componentes

| Archivo | Función |
|---|---|
| `src/lib/auth/neon-auth.ts` | Instancia del servidor de Neon Auth, creada de forma perezosa. |
| `src/lib/auth/neon-auth-client.ts` | Cliente de Neon Auth para componentes de cliente. |
| `src/app/api/auth/[...path]/route.ts` | Ruta que reenvía las solicitudes de autenticación al servicio. |
| `src/lib/auth/investor.ts` | Función `getInvestorSession`, que lee la sesión y aprovisiona la billetera. |
| `src/lib/db/investor-db.ts` | Consulta de aprovisionamiento sobre la tabla `usuario`. |

## Variables de entorno

| Variable | Descripción |
|---|---|
| `NEON_AUTH_BASE_URL` | URL pública del servicio Neon Auth del proyecto. Se obtiene en la consola de Neon, en Settings > Better Auth > Project Info. |
| `NEON_AUTH_COOKIE_SECRET` | Secreto de al menos 32 caracteres para firmar las cookies de sesión. Se genera con `openssl rand -base64 32`. |
| `DATABASE_URL` | Cadena de conexión a la base de datos Postgres de Neon. Se obtiene en la consola de Neon. |

Las variables se definen en `.env.local` para el desarrollo y en la configuración de entorno del proveedor de despliegue para producción. El archivo `.env.example` documenta los nombres sin valores secretos.

## Configuración

### Configurar el proveedor Google

1. Activar Google como proveedor en la sección de Better Auth de la consola de Neon.
2. Verificar que los correos y las contraseñas permanezcan desactivados.

### Configurar los orígenes de confianza

Neon Auth solo redirige a los orígenes registrados como confiables. Para el entorno de producción se registran los siguientes orígenes:

1. Registrar el origen de producción, con protocolo y sin ruta, por ejemplo `https://inversionistas.ejemplo.edu`.
2. Registrar `http://localhost:3000` solo en el proyecto de desarrollo.
3. Mantener `NEON_AUTH_BASE_URL` apuntando al proyecto de Neon correspondiente a cada entorno.

### Configurar las variables

1. Copiar `.env.example` a `.env.local`.
2. Completar `NEON_AUTH_COOKIE_SECRET` y `DATABASE_URL`.
3. Verificar que `NEON_AUTH_BASE_URL` coincida con la URL del proyecto.

## Flujo de ingreso

1. El botón Ingresar con mi cuenta invoca `authClient.signIn.social({ provider: "google" })`.
2. Neon Auth redirige al proveedor Google y devuelve el control a la ruta `/`.
3. `getInvestorSession` lee la sesión y obtiene el identificador externo y el correo.
4. `provisionInvestor` ejecuta una inserción con `ON CONFLICT (proveedor_oauth, id_externo)`. El primer ingreso crea la fila con saldo inicial de 10,000 Impact Coins. Los ingresos posteriores reanudan la misma fila sin duplicarla y reactivan su estado a `ACTIVO`.

## Cierre de sesión

El encabezado del portal incluye el botón Cerrar sesión, que invoca `authClient.signOut()` y redirige a la ruta `/`.

## Pruebas

Ejecutar `pnpm test` para verificar el aprovisionamiento con una consulta simulada. Las pruebas comprueban la creación en el primer ingreso y la reanudación sin duplicados en los siguientes.

## Restricciones

- No habilitar el ingreso con correo y contraseña.
- No registrar secretos en el repositorio ni en la documentación.
- No reutilizar `NEON_AUTH_COOKIE_SECRET` entre entornos.
