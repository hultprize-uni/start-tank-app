import type { ReactNode } from "react";
import { AnimatedBackground } from "@/shared/ui";
import styles from "./JuryShell.module.css";

interface JuryShellProps {
  children: ReactNode;
}

/** Marco del portal del jurado: fondo animado de marca y área de contenido sobre él. */
export function JuryShell({ children }: JuryShellProps) {
  return (
    <div className={styles.shell}>
      <AnimatedBackground />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
