import { handleOperatorPreflight, handleOperatorStartEvent } from "@/features/operator";

/** Checklist previo al evento (GET) e Iniciar evento (POST, solo con todo en verde). */
export const GET = handleOperatorPreflight;
export const POST = handleOperatorStartEvent;
