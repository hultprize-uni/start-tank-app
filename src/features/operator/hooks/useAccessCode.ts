import { useCallback, useState } from "react";

/** Estado del formulario de acceso con código del operador. */
export interface AccessCodeState {
  code: string;
  /** Mensaje de error de la última validación. Es null cuando no hay error. */
  error: string | null;
  /** Indica que la validación está en curso. */
  sending: boolean;
  /** Indica si el envío está permitido: hay código y no hay una validación en curso. */
  canSubmit: boolean;
  changeCode: (value: string) => void;
  submit: () => Promise<void>;
}

/**
 * Formulario de acceso con código. Limpia el error al editar el código y evita envíos repetidos
 * mientras la validación está en curso. La validación real la recibe por parámetro.
 */
export function useAccessCode(
  validate: (code: string) => Promise<string | null>,
): AccessCodeState {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const changeCode = useCallback((value: string) => {
    setCode(value);
    setError(null);
  }, []);

  const submit = useCallback(async () => {
    if (sending || code.trim().length === 0) return;
    setSending(true);
    const message = await validate(code);
    setSending(false);
    setError(message);
  }, [code, sending, validate]);

  return {
    code,
    error,
    sending,
    canSubmit: code.trim().length > 0 && !sending,
    changeCode,
    submit,
  };
}
