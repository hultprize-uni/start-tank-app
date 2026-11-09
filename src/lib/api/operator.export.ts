import type { OperatorViewModel } from "./operator.types";

/** Marca de orden de bytes para que Excel reconozca la codificación UTF-8. */
const UTF8_BOM = "﻿";

/** Escapa un valor según RFC 4180. */
function escapeCsvValue(value: string | number | null): string {
  if (value === null) {
    return "";
  }
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsvLine(values: (string | number | null)[]): string {
  return values.map(escapeCsvValue).join(",");
}

/**
 * Genera el CSV de saldos y posiciones a partir del view model.
 * El archivo contiene dos bloques separados por una línea vacía.
 */
export function buildSettlementCsv(viewModel: OperatorViewModel): string {
  const lines: string[] = [
    toCsvLine(["Saldos por asistente"]),
    toCsvLine(["asistente_id", "asistente", "saldo_coins"]),
    ...viewModel.balances.map((row) =>
      toCsvLine([row.attendeeId, row.attendeeName, row.balance]),
    ),
    "",
    toCsvLine(["Posiciones"]),
    toCsvLine([
      "ronda",
      "startup",
      "asistente_id",
      "asistente",
      "monto_coins",
      "retorno_coins",
      "estado",
    ]),
    ...viewModel.positions.map((row) =>
      toCsvLine([
        row.round,
        row.startupName,
        row.attendeeId,
        row.attendeeName,
        row.amount,
        row.returnAmount,
        row.returnAmount === null ? "Pendiente" : "Liquidada",
      ]),
    ),
  ];
  return `${lines.join("\r\n")}\r\n`;
}

/** Descarga un texto como archivo CSV desde el navegador. Se invoca solo desde manejadores de eventos. */
export function downloadCsv(fileName: string, content: string): void {
  const blob = new Blob([UTF8_BOM + content], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
