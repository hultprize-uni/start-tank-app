/*
 * Selección del origen de datos de los portales. Con NEXT_PUBLIC_USE_MOCKS=true los hooks usan los
 * datos de muestra; en cualquier otro caso consumen las rutas de la API. La variable se resuelve en
 * tiempo de compilación, de modo que cada build usa un único origen.
 */

/** Indica si los portales del jurado y del operador usan los datos de muestra. */
export const USA_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";
