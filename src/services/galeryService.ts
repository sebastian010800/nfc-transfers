/* eslint-disable no-useless-escape */
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  runTransaction,
  increment,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  listAll,
  deleteObject,
} from "firebase/storage";

// =====================
// Tipos y utilidades
// =====================
export type GaleriaCreateInput = {
  nombre: string;
  descripcion: string;
  /** Archivo de video a subir (File en web o Blob/Uint8Array en Node). */
  videoFile: Blob | Uint8Array | ArrayBuffer;
  /** Nombre de archivo opcional para el video. */
  videoFilename?: string;
};

export type GaleriaUpdateInput = {
  nombre?: string;
  descripcion?: string;
  /** Si lo incluyes, reemplaza el video existente */
  newVideoFile?: Blob | Uint8Array | ArrayBuffer;
  newVideoFilename?: string;
};

export type Galeria = {
  id: string;
  nombre: string;
  videoURL: string;
  descripcion: string;
  donaciones: number;
  createdAt?: unknown;
  updatedAt?: unknown;
  /** Ruta interna del archivo en Storage para facilitar reemplazo/borrado */
  videoPath?: string;
};

const DB = getFirestore();
const ST = getStorage();
const GALERIA_COL = collection(DB, "galeria");

function snapshotToGaleria(s: QueryDocumentSnapshot): Galeria {
  const d = s.data() as Omit<Galeria, "id">;
  return { id: s.id, ...d } as Galeria;
}

// =====================
// Crear una galería
// =====================
export async function crearGaleria(
  input: GaleriaCreateInput
): Promise<Galeria> {
  const { nombre, descripcion, videoFile } = input;
  if (!nombre?.trim()) throw new Error("nombre es requerido");
  if (!descripcion?.trim()) throw new Error("descripcion es requerida");
  if (!videoFile) throw new Error("videoFile es requerido");

  // Reservar ID de documento primero para usarlo en la ruta del Storage
  const newDocRef = doc(GALERIA_COL);
  const sanitizedName = (input.videoFilename || "video.mp4").replace(
    /[^\w.\-]/g,
    "_"
  );
  const videoPath = `galeria/${newDocRef.id}/${sanitizedName}`;
  const videoRef = ref(ST, videoPath);

  // Subir el archivo de video
  await uploadBytes(videoRef, videoFile as Blob);
  const videoURL = await getDownloadURL(videoRef);

  const payload = {
    nombre: nombre.trim(),
    descripcion: descripcion.trim(),
    videoURL,
    videoPath,
    donaciones: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } satisfies Omit<Galeria, "id">;

  await setDoc(newDocRef, payload);
  return { id: newDocRef.id, ...payload } as Galeria;
}

// =====================
// Consultar todas las galerías
// =====================
export async function consultarGalerias(): Promise<Galeria[]> {
  const snap = await getDocs(GALERIA_COL);
  return snap.docs.map(snapshotToGaleria);
}

// =====================
// Consultar una galería por ID
// =====================
export async function consultarGaleriaPorId(
  id: string
): Promise<Galeria | null> {
  const refDoc = doc(GALERIA_COL, id);
  const s = await getDoc(refDoc);
  if (!s.exists()) return null;
  return snapshotToGaleria(s as QueryDocumentSnapshot);
}

// =====================
// Editar una galería (nombre/descripcion y opcionalmente reemplazar video)
// =====================
export async function editarGaleria(
  id: string,
  input: GaleriaUpdateInput
): Promise<void> {
  const refDoc = doc(GALERIA_COL, id);
  const s = await getDoc(refDoc);
  if (!s.exists()) throw new Error("Galería no encontrada");

  const data = s.data() as Galeria;
  const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };

  if (typeof input.nombre === "string") patch["nombre"] = input.nombre.trim();
  if (typeof input.descripcion === "string")
    patch["descripcion"] = input.descripcion.trim();

  // Reemplazo de video si viene un archivo nuevo
  if (input.newVideoFile) {
    const newName = (input.newVideoFilename || "video.mp4").replace(
      /[^\w.\-]/g,
      "_"
    );
    const newVideoPath = `galeria/${id}/${newName}`;
    const newVideoRef = ref(ST, newVideoPath);

    await uploadBytes(newVideoRef, input.newVideoFile as Blob);
    const newVideoURL = await getDownloadURL(newVideoRef);

    patch["videoURL"] = newVideoURL;
    patch["videoPath"] = newVideoPath;

    // Borrar el video anterior si existía y es una ruta distinta
    if (data.videoPath && data.videoPath !== newVideoPath) {
      try {
        await deleteObject(ref(ST, data.videoPath));
      } catch {
        // Ignorar si no existe o no se puede borrar
      }
    }
  }

  await updateDoc(refDoc, patch);
}

// =====================
// Editar donaciones (solo sumar)
// =====================
export async function editarDonacionesSumando(
  id: string,
  montoASumar: number
): Promise<number> {
  if (!Number.isFinite(montoASumar) || montoASumar <= 0) {
    throw new Error("montoASumar debe ser un número > 0");
  }

  const refDoc = doc(GALERIA_COL, id);

  // Transacción para leer/validar estado y sumar de forma atómica
  const nuevoTotal = await runTransaction(DB, async (tx) => {
    const snap = await tx.get(refDoc);
    if (!snap.exists()) throw new Error("Galería no encontrada");
    const current = (snap.data().donaciones ?? 0) as number;

    // Ejemplo de validación adicional (opcional): limitar tamaño de salto
    if (montoASumar > 1_000_000) {
      throw new Error("montoASumar demasiado alto para una sola operación");
    }

    tx.update(refDoc, {
      donaciones: increment(montoASumar),
      updatedAt: serverTimestamp(),
    });

    return current + montoASumar;
  });

  return nuevoTotal;
}

// =====================
// Eliminar galería (doc + archivos de video bajo su carpeta)
// =====================
export async function eliminarGaleria(id: string): Promise<void> {
  const refDoc = doc(GALERIA_COL, id);
  const s = await getDoc(refDoc);
  if (!s.exists()) return; // idempotente

  // Borrar todos los objetos dentro de la carpeta galeria/{id}
  const folderRef = ref(ST, `galeria/${id}`);
  try {
    const all = await listAll(folderRef);
    await Promise.all(
      all.items.map(async (itemRef) => {
        try {
          await deleteObject(itemRef);
        } catch {
          // Ignorar si no se puede borrar algún objeto
        }
      })
    );
  } catch {
    // Ignorar errores al listar (p.ej., carpeta vacía)
  }

  await deleteDoc(refDoc);
}
