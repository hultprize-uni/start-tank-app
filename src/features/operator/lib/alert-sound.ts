/*
 * Sonido de la alerta crítica (tarea 5.9), generado con Web Audio: no usa archivos. Es un aviso
 * corto de dos notas descendentes para que el conductor lo note aunque esté mirando el escenario.
 * Los navegadores solo permiten reproducir audio después de una interacción con la página; el
 * conductor ya hizo clic al ingresar con su código.
 */

type AudioContextConstructor = typeof AudioContext;

let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
  if (Ctor === undefined) return null;
  if (context === null) context = new Ctor();
  return context;
}

/** Notas del aviso: frecuencia en Hz, inicio y duración en segundos. */
const NOTES = [
  { frequency: 880, start: 0, duration: 0.16 },
  { frequency: 660, start: 0.2, duration: 0.22 },
] as const;

/** Volumen máximo del aviso. */
const PEAK_GAIN = 0.18;

/** Reproduce el aviso de alerta crítica. Falla en silencio si el navegador no lo permite. */
export function playAlertTone(): void {
  const ctx = audioContext();
  if (ctx === null) return;
  try {
    if (ctx.state === "suspended") void ctx.resume();
    const t0 = ctx.currentTime + 0.01;
    for (const note of NOTES) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = note.frequency;
      const start = t0 + note.start;
      const end = start + note.duration;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(PEAK_GAIN, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(end + 0.02);
    }
  } catch {
    // Sin audio disponible: el banner sigue visible.
  }
}

const MUTE_KEY = "st-operator-alert-muted";

/** Preferencia de silencio guardada en este navegador. */
export function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === "true";
  } catch {
    return false;
  }
}

export function writeMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(MUTE_KEY, String(muted));
  } catch {
    // Sin almacenamiento: la preferencia dura lo que dure la pestaña.
  }
}
