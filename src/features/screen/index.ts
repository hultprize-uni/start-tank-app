/** API pública de la funcionalidad de la pantalla: cliente del proyector, manejador de la API y tipos compartidos. */
export { ScreenClient } from "./components/ScreenClient";
export { parsePhase } from "./components/phases";
export { handleGetScreen } from "./server/handler";
export type { ScreenPhase, ScreenViewModel } from "./types";
