import { Dialog, type DialogProps } from "../Dialog";
import styles from "./BottomSheet.module.css";

export type BottomSheetProps = Omit<DialogProps, "placement" | "lead">;

/**
 * Panel inferior para uso móvil. Se construye sobre Dialog: conserva el foco atrapado,
 * el cierre con Escape y la semántica role="dialog" con aria-modal.
 */
export function BottomSheet(props: BottomSheetProps) {
  return (
    <Dialog
      {...props}
      placement="bottom"
      lead={<div aria-hidden="true" className={styles.handle} />}
    />
  );
}
