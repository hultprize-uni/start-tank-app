import { errorResponse, stateResponse } from "@/server/http/responses";
import { readScreen } from "./queries";

/** Devuelve el modelo del escenario, o 404 cuando el evento aún no tiene rondas. */
export async function handleGetScreen(): Promise<Response> {
  const screen = await readScreen();
  return screen === null ? errorResponse(404, "NO_ROUNDS") : stateResponse(screen);
}
