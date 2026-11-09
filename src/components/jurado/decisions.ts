import type { Decision } from "@/lib/domain/types";

/** Textos de cada decisión de voto, usados en la votación y en su confirmación. */
export const DECISION_LABELS: Record<
  Decision,
  { title: string; description: string; hint: string | null }
> = {
  RESPALDA: {
    title: "Respalda",
    description: "Esta startup recibe tu respaldo.",
    hint: null,
  },
  RECHAZA: {
    title: "Rechaza",
    description: "Esta startup no recibe tu respaldo.",
    hint: null,
  },
  SE_ABSTIENE: {
    title: "Se abstiene",
    description: "No participas en la decisión por conflicto de interés.",
    hint: "Conflicto de interés",
  },
};

/** Orden en que se presentan las decisiones de voto. */
export const DECISION_ORDER: readonly Decision[] = [
  "RESPALDA",
  "RECHAZA",
  "SE_ABSTIENE",
];
