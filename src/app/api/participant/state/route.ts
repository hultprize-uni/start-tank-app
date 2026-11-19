import { handleParticipantState } from "@/features/participant";

/** Estado del portal del participante. Delega en el manejador de la funcionalidad. */
export const dynamic = "force-dynamic";

export const GET = handleParticipantState;
