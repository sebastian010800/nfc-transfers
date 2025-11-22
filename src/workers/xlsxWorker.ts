// src/workers/xlsxWorker.ts
// Worker para parsear XLSX en un hilo separado

import type { WorkBook, WorkSheet } from "xlsx";

type CellValue = string | number | boolean | null;

interface XlsxWorkerMessage {
  buffer: ArrayBuffer;
  maxRows?: number;
  maxCols?: number;
}

// Respuestas del worker: { ok: true, rows } | { ok: false, error }

self.onmessage = async (e: MessageEvent<XlsxWorkerMessage>) => {
  try {
    const { buffer, maxRows = 0, maxCols = 0 } = e.data;

    // Import dinámico dentro del worker (runtime)
    const XLSX = await import("xlsx");

    // parseo mínimo necesario, sin fórmulas ni fechas complejas
    const wb = (
      XLSX as unknown as {
        read: (data: ArrayBuffer, opts: Record<string, unknown>) => WorkBook;
      }
    ).read(buffer, {
      type: "array",
      cellDates: false,
      cellFormula: false,
      cellHTML: false,
      // evitar parses adicionales que usen regex intensivo
      // (mitigación del advisory)
    });

    // Tomar la primera hoja
    const first = wb.SheetNames?.[0];
    if (!first) {
      postMessage({ ok: false, error: "Archivo sin hojas" });
      return;
    }

    const ws = wb.Sheets[first] as WorkSheet;

    // Limitar rango de lectura (mitigación de ReDoS y memory)
    const opts = { defval: "", raw: true } as const;

    const rows = (
      XLSX.utils.sheet_to_json<Record<string, CellValue>>(ws, opts) as Array<
        Record<string, CellValue>
      >
    ).slice(0, maxRows || undefined);

    const finalRows =
      maxCols && maxCols > 0
        ? rows.map((r) => {
            const picked: Record<string, CellValue> = {};
            const keys = Object.keys(r).slice(0, maxCols);
            keys.forEach((k) => {
              picked[k] = r[k];
            });
            return picked;
          })
        : rows;

    postMessage({ ok: true, rows: finalRows });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    postMessage({ ok: false, error: message || "Error al procesar XLSX" });
  }
};

export {};
