import { errorResponse, jsonResponse } from "@/server/http/responses";
import { readScreen } from "./queries";

/** Devuelve el view model de la pantalla o 404 cuando el evento aún no tiene rondas. */
export async function handleGetScreen(): Promise<Response> {
  const screen = await readScreen();
  if (screen === null) {
    return errorResponse(404, "NO_ROUNDS");
  }
  return jsonResponse(screen);
}
