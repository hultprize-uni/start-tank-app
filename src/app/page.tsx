import { redirect } from "next/navigation";
import { PAGE_ROUTES } from "@/shared/lib/api-routes";

/** Página de inicio provisional: redirige al portal del participante hasta que exista la landing. */
export default function Page() {
  redirect(PAGE_ROUTES.participant);
}
