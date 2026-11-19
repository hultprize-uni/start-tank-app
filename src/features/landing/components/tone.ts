import type { LandingTone } from "../content";
import styles from "./landing.module.css";

/** Clase de color de la portada para cada tono de contenido. Los colores provienen de tokens. */
const TONE_CLASS: Record<LandingTone, string> = {
  cyan: styles.toneCyan,
  cyanLight: styles.toneCyanLight,
  pink: styles.tonePink,
  orchid: styles.toneOrchid,
  yellow: styles.toneYellow,
  muted: styles.toneMuted,
};

/** Devuelve la clase de color asociada a un tono de contenido. */
export function toneClass(tone: LandingTone): string {
  return TONE_CLASS[tone];
}
