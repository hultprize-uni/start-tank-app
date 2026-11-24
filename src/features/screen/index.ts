/** API pública del escenario: cliente del proyector, manejador de la API y tipos. */
export { ScreenClient } from "./components/ScreenClient";
export { parsePhase } from "./api/mock";
export { handleGetScreen } from "./server/handler";
export type { StagePhase, ScreenViewModel } from "./types";
