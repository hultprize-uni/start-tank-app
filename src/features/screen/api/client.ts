import { API_ROUTES } from "@/shared/lib/api-routes";
import { syncServerClock } from "@/shared/lib/use-server-clock";
import type { ScreenViewModel } from "../types";

export type ScreenFetch =
  | { status: "ok"; vm: ScreenViewModel }
  | { status: "empty" }
  | { status: "offline" };

/** Lee el estado del escenario. 404 significa que el evento aún no tiene rondas. */
export async function fetchScreen(fetchFn: typeof fetch = fetch): Promise<ScreenFetch> {
  try {
    const response = await fetchFn(API_ROUTES.screen.state, { cache: "no-store" });
    if (response.status === 404) return { status: "empty" };
    if (!response.ok) return { status: "offline" };
    const vm = (await response.json()) as ScreenViewModel;
    syncServerClock(vm.serverTime);
    return { status: "ok", vm };
  } catch {
    return { status: "offline" };
  }
}
