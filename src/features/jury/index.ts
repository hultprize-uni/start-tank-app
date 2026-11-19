/** API pública de la funcionalidad del jurado: portal, manejadores de la API y tipos compartidos. */
export { JuryPortal } from "./components/JuryPortal";
export { handleJuryLogin, handleJuryState, handleJuryVote } from "./server/handlers";
export type { JuryViewModel } from "./types";
