/*
 * Rutas de la API y de las páginas de la aplicación. Todos los clientes y los redireccionamientos
 * consumen estas constantes: ningún módulo escribe la URL de forma literal.
 */

/** Rutas de los route handlers bajo /api, agrupadas por funcionalidad. */
export const API_ROUTES = {
  participant: {
    state: "/api/participant/state",
    invest: "/api/participant/invest",
  },
  jury: {
    login: "/api/jury/login",
    state: "/api/jury/state",
    vote: "/api/jury/vote",
    logout: "/api/jury/logout",
  },
  operator: {
    login: "/api/operator/login",
    state: "/api/operator/state",
    action: "/api/operator/action",
    export: "/api/operator/export",
    logout: "/api/operator/logout",
  },
  screen: {
    state: "/api/screen",
  },
} as const;

/** Rutas de las páginas de cada portal. */
export const PAGE_ROUTES = {
  participant: "/participant",
  jury: "/jury",
  operator: "/operator",
  screen: "/screen",
} as const;
