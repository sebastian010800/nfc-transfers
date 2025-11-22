// helper dentro de admin.tsx o en un hook aparte

export type CellValue = string | number | boolean | null;

interface XlsxWorkerMessage {
  buffer: ArrayBuffer;
  maxRows?: number;
  maxCols?: number;
}

export type WorkerResponse =
  | { ok: true; rows: Array<Record<string, CellValue>> }
  | { ok: false; error: string };

export async function parseXlsxSafely(
  file: File,
  { maxSizeMB = 2, maxRows = 2000, maxCols = 20, timeoutMs = 8000 } = {}
): Promise<WorkerResponse> {
  // 1) extensión
  const extOk = /\.(xlsx|xlsm)$/i.test(file.name);
  if (!extOk)
    return { ok: false, error: "Extensión no permitida. Usa .xlsx o .xlsm" };

  // 2) límite de tamaño
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > maxSizeMB) {
    return {
      ok: false,
      error: `Archivo muy grande (${sizeMB.toFixed(
        1
      )} MB). Máx ${maxSizeMB} MB`,
    };
  }

  // 3) “magic number” ZIP (XLSX es un zip: "PK")
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const isZip = head[0] === 0x50 && head[1] === 0x4b; // 'P''K'
  if (!isZip)
    return { ok: false, error: "El archivo no parece un XLSX válido" };

  const buffer = await file.arrayBuffer();

  // 4) Worker + timeout
  const worker = new Worker(
    new URL("../workers/xlsxWorker.ts", import.meta.url),
    { type: "module" }
  );

  const p = new Promise<WorkerResponse>((resolve) => {
    const timer = setTimeout(() => {
      worker.terminate();
      resolve({ ok: false, error: "Tiempo excedido al procesar el XLSX" });
    }, timeoutMs);

    worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      clearTimeout(timer);
      worker.terminate();
      // ev.data ya coincide con nuestro tipo esperado
      resolve(ev.data);
    };

    const msg: XlsxWorkerMessage = { buffer, maxRows, maxCols };
    worker.postMessage(msg);
  });

  return p;
}
