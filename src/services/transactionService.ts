import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  runTransaction,
  Timestamp,
  orderBy,
  setDoc,
  type FirestoreDataConverter,
  QueryDocumentSnapshot,
  type WithFieldValue,
  type DocumentData,
} from "firebase/firestore";
import { db } from "../firebase.config";

/** ——— Tipos base ——— */
export type TipoTransaccion = "RECARGA" | "DESCUENTO" | "DONACION";
export type EstadoTransaccion = "Exitoso" | "Fallido";

/** Historial almacenado en /transactions */
export interface TransactionHistory {
  id: string; // doc id
  // claves de búsqueda
  celular: string;
  idUser: string;

  // datos descriptivos
  nombreUsuario: string;
  tipoTransaccion: TipoTransaccion;

  idExperiencia?: string;
  nombreExperiencia?: string;

  idProducto?: string;
  nombreProducto?: string;

  valor: number;

  estado: EstadoTransaccion; // Exitoso | Fallido
  mensajeError?: string; // ← Campo opcional para detallar errores
  createdAt: Timestamp;
}

// Documento en Firestore (sin 'id')
type TransactionDoc = Omit<TransactionHistory, "id">;

// modelos mínimos de otras colecciones
interface AppUserDoc {
  nombre: string;
  celular: string;
  saldo: number;
}
interface ProductoDoc {
  nombre: string;
  valor: number;
  cantidad: number; // ← Campo de inventario
}
interface ExperienciaDoc {
  nombre: string;
  valor: number;
}

/** Converter tipado para transactions */
const txConverter: FirestoreDataConverter<TransactionHistory> = {
  toFirestore(model: WithFieldValue<TransactionHistory>): DocumentData {
    const { id, ...docData } = model;
    void id;
    return docData;
  },
  fromFirestore(snap: QueryDocumentSnapshot): TransactionHistory {
    return { id: snap.id, ...(snap.data() as TransactionDoc) };
  },
};

const txCol = () => collection(db, "transactions").withConverter(txConverter);

/** Utils */
const findUserByCelular = async (celular: string) => {
  const qUsers = query(
    collection(db, "users"),
    where("celular", "==", celular)
  );
  const snap = await getDocs(qUsers);
  if (snap.empty) return null;
  // si hay más de uno, tomamos el primero (idealmente celular debe ser único)
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as AppUserDoc) };
};

/** ——— Crear RECARGA por celular + idExperiencia ——— */
export async function createRecargaByCelular(params: {
  celular: string;
  idExperiencia: string;
}): Promise<TransactionHistory> {
  const user = await findUserByCelular(params.celular);
  const txRef = doc(collection(db, "transactions")).withConverter(txConverter);

  if (!user) {
    const payload: WithFieldValue<TransactionDoc> = {
      celular: params.celular,
      idUser: "",
      nombreUsuario: "",
      tipoTransaccion: "RECARGA",
      idExperiencia: params.idExperiencia,
      valor: 0,
      estado: "Fallido",
      mensajeError: "Usuario no encontrado",
      createdAt: Timestamp.now(),
    };
    await setDoc(txRef, payload);
    return {
      id: txRef.id,
      ...(payload as unknown as TransactionDoc),
    } as TransactionHistory;
  }

  await runTransaction(db, async (trx) => {
    const userRef = doc(db, "users", user.id);
    const expRef = doc(db, "experiencias", params.idExperiencia);

    const [userSnap, expSnap] = await Promise.all([
      trx.get(userRef),
      trx.get(expRef),
    ]);

    if (!userSnap.exists() || !expSnap.exists()) {
      const nombreExp = expSnap.exists()
        ? (expSnap.data() as ExperienciaDoc).nombre
        : "";
      const payload: WithFieldValue<TransactionDoc> = {
        celular: user.celular,
        idUser: user.id,
        nombreUsuario: user.nombre,
        tipoTransaccion: "RECARGA",
        idExperiencia: params.idExperiencia,
        nombreExperiencia: nombreExp,
        valor: 0,
        estado: "Fallido",
        mensajeError: !expSnap.exists()
          ? "Experiencia no encontrada"
          : "Usuario no encontrado",
        createdAt: Timestamp.now(),
      };
      trx.set(txRef, payload);
      return;
    }

    const u = userSnap.data() as AppUserDoc;
    const exp = expSnap.data() as ExperienciaDoc;
    const amount = Math.max(0, Number(exp.valor || 0));

    // sumar
    const newSaldo = (Number(u.saldo) || 0) + amount;
    trx.update(userRef, { saldo: newSaldo });

    const payload: WithFieldValue<TransactionDoc> = {
      celular: u.celular,
      idUser: userSnap.id,
      nombreUsuario: u.nombre,
      tipoTransaccion: "RECARGA",
      idExperiencia: params.idExperiencia,
      nombreExperiencia: exp.nombre,
      valor: amount,
      estado: "Exitoso",
      createdAt: Timestamp.now(),
    };
    trx.set(txRef, payload);
  });

  const final = await getDoc(txRef);
  return final.data()!;
}
export async function createDonacionByCelular(params: {
  celular: string;
  monto: number;
  idObra?: string; // ← NUEVO (opcional)
  nombreObra?: string; // ← NUEVO (opcional)
}): Promise<TransactionHistory> {
  const user = await findUserByCelular(params.celular);
  const txRef = doc(collection(db, "transactions")).withConverter(txConverter);

  if (!user) {
    const payload: WithFieldValue<TransactionDoc> = {
      celular: params.celular,
      idUser: "",
      nombreUsuario: "",
      tipoTransaccion: "DONACION",
      // Guardamos la obra en los campos existentes de "experiencia" para no cambiar esquema
      idExperiencia: params.idObra,
      nombreExperiencia: params.nombreObra,
      valor: params.monto,
      estado: "Fallido",
      mensajeError: "Usuario no encontrado",
      createdAt: Timestamp.now(),
    };
    await setDoc(txRef, payload);
    return {
      id: txRef.id,
      ...(payload as unknown as TransactionDoc),
    } as TransactionHistory;
  }

  await runTransaction(db, async (trx) => {
    const userRef = doc(db, "users", user.id);
    const userSnap = await trx.get(userRef);

    if (!userSnap.exists()) {
      const payload: WithFieldValue<TransactionDoc> = {
        celular: user.celular,
        idUser: user.id,
        nombreUsuario: user.nombre,
        tipoTransaccion: "DONACION",
        idExperiencia: params.idObra,
        nombreExperiencia: params.nombreObra,
        valor: params.monto,
        estado: "Fallido",
        mensajeError: "Usuario no encontrado",
        createdAt: Timestamp.now(),
      };
      trx.set(txRef, payload);
      return;
    }

    const u = userSnap.data() as AppUserDoc;
    const amount = Math.max(0, Number(params.monto || 0));
    const saldoActual = Number(u.saldo || 0);

    if (amount <= 0) {
      const payload: WithFieldValue<TransactionDoc> = {
        celular: u.celular,
        idUser: userSnap.id,
        nombreUsuario: u.nombre,
        tipoTransaccion: "DONACION",
        idExperiencia: params.idObra,
        nombreExperiencia: params.nombreObra,
        valor: amount,
        estado: "Fallido",
        mensajeError: "Monto de donación inválido",
        createdAt: Timestamp.now(),
      };
      trx.set(txRef, payload);
      return;
    }

    if (saldoActual < amount) {
      const payload: WithFieldValue<TransactionDoc> = {
        celular: u.celular,
        idUser: userSnap.id,
        nombreUsuario: u.nombre,
        tipoTransaccion: "DONACION",
        idExperiencia: params.idObra,
        nombreExperiencia: params.nombreObra,
        valor: amount,
        estado: "Fallido",
        mensajeError: `Saldo insuficiente (disponible: ${saldoActual}, requerido: ${amount})`,
        createdAt: Timestamp.now(),
      };
      trx.set(txRef, payload);
      return;
    }

    // ——— Éxito: descontar saldo ———
    const newSaldo = saldoActual - amount;
    trx.update(userRef, { saldo: newSaldo });

    const payload: WithFieldValue<TransactionDoc> = {
      celular: u.celular,
      idUser: userSnap.id,
      nombreUsuario: u.nombre,
      tipoTransaccion: "DONACION",
      idExperiencia: params.idObra,
      nombreExperiencia: params.nombreObra,
      valor: amount,
      estado: "Exitoso",
      createdAt: Timestamp.now(),
    };
    trx.set(txRef, payload);
  });

  const final = await getDoc(txRef);
  return final.data()!;
}

/** ——— Crear DESCUENTO por celular + idProducto ——— */
export async function createDescuentoByCelular(params: {
  celular: string;
  idProducto: string;
}): Promise<TransactionHistory> {
  const user = await findUserByCelular(params.celular);
  const txRef = doc(collection(db, "transactions")).withConverter(txConverter);

  if (!user) {
    const payload: WithFieldValue<TransactionDoc> = {
      celular: params.celular,
      idUser: "",
      nombreUsuario: "",
      tipoTransaccion: "DESCUENTO",
      idProducto: params.idProducto,
      valor: 0,
      estado: "Fallido",
      mensajeError: "Usuario no encontrado",
      createdAt: Timestamp.now(),
    };
    await setDoc(txRef, payload);
    return {
      id: txRef.id,
      ...(payload as unknown as TransactionDoc),
    } as TransactionHistory;
  }

  await runTransaction(db, async (trx) => {
    const userRef = doc(db, "users", user.id);
    const prodRef = doc(db, "productos", params.idProducto);

    const [userSnap, prodSnap] = await Promise.all([
      trx.get(userRef),
      trx.get(prodRef),
    ]);

    if (!userSnap.exists() || !prodSnap.exists()) {
      const nombreProd = prodSnap.exists()
        ? (prodSnap.data() as ProductoDoc).nombre
        : "";
      const payload: WithFieldValue<TransactionDoc> = {
        celular: user.celular,
        idUser: user.id,
        nombreUsuario: user.nombre,
        tipoTransaccion: "DESCUENTO",
        idProducto: params.idProducto,
        nombreProducto: nombreProd,
        valor: 0,
        estado: "Fallido",
        mensajeError: !prodSnap.exists()
          ? "Producto no encontrado"
          : "Usuario no encontrado",
        createdAt: Timestamp.now(),
      };
      trx.set(txRef, payload);
      return;
    }

    const u = userSnap.data() as AppUserDoc;
    const prod = prodSnap.data() as ProductoDoc;
    const amount = Math.max(0, Number(prod.valor || 0));
    const saldoActual = Number(u.saldo || 0);
    const cantidadDisponible = Number(prod.cantidad || 0);

    // ——— VALIDACIÓN DE INVENTARIO ———
    if (cantidadDisponible < 1) {
      const payload: WithFieldValue<TransactionDoc> = {
        celular: u.celular,
        idUser: userSnap.id,
        nombreUsuario: u.nombre,
        tipoTransaccion: "DESCUENTO",
        idProducto: params.idProducto,
        nombreProducto: prod.nombre,
        valor: amount,
        estado: "Fallido",
        mensajeError: "Producto sin inventario disponible",
        createdAt: Timestamp.now(),
      };
      trx.set(txRef, payload);
      return;
    }

    // Validación de valor y saldo
    if (amount <= 0) {
      const payload: WithFieldValue<TransactionDoc> = {
        celular: u.celular,
        idUser: userSnap.id,
        nombreUsuario: u.nombre,
        tipoTransaccion: "DESCUENTO",
        idProducto: params.idProducto,
        nombreProducto: prod.nombre,
        valor: amount,
        estado: "Fallido",
        mensajeError: "Valor del producto inválido",
        createdAt: Timestamp.now(),
      };
      trx.set(txRef, payload);
      return;
    }

    if (saldoActual < amount) {
      const payload: WithFieldValue<TransactionDoc> = {
        celular: u.celular,
        idUser: userSnap.id,
        nombreUsuario: u.nombre,
        tipoTransaccion: "DESCUENTO",
        idProducto: params.idProducto,
        nombreProducto: prod.nombre,
        valor: amount,
        estado: "Fallido",
        mensajeError: `Saldo insuficiente (disponible: ${saldoActual}, requerido: ${amount})`,
        createdAt: Timestamp.now(),
      };
      trx.set(txRef, payload);
      return;
    }

    // ——— TRANSACCIÓN EXITOSA: descontar saldo Y cantidad ———
    const newSaldo = saldoActual - amount;
    const newCantidad = cantidadDisponible - 1;

    trx.update(userRef, { saldo: newSaldo });
    trx.update(prodRef, { cantidad: newCantidad }); // ← Decrementar inventario

    const payload: WithFieldValue<TransactionDoc> = {
      celular: u.celular,
      idUser: userSnap.id,
      nombreUsuario: u.nombre,
      tipoTransaccion: "DESCUENTO",
      idProducto: params.idProducto,
      nombreProducto: prod.nombre,
      valor: amount,
      estado: "Exitoso",
      createdAt: Timestamp.now(),
    };
    trx.set(txRef, payload);
  });

  const final = await getDoc(txRef);
  return final.data()!;
}

/** ——— Obtener historial de un usuario por CELULAR ——— */
export async function getTransactionsByCelular(
  celular: string
): Promise<TransactionHistory[]> {
  try {
    // Primero intentamos con el índice compuesto (si existe)
    const qTx = query(
      txCol(),
      where("celular", "==", celular),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(qTx);
    return snap.docs.map((d) => d.data());
  } catch (error) {
    // Si falla (no hay índice), hacemos la consulta simple y ordenamos en memoria
    console.warn(
      "Usando consulta sin orderBy. Considera crear un índice compuesto en Firestore:",
      error
    );
    const qTx = query(txCol(), where("celular", "==", celular));
    const snap = await getDocs(qTx);
    const transactions = snap.docs.map((d) => d.data());

    // Ordenar en memoria por createdAt descendente
    return transactions.sort((a, b) => {
      const timeA = a.createdAt.toMillis();
      const timeB = b.createdAt.toMillis();
      return timeB - timeA; // desc
    });
  }
}

/** ——— Obtener todas las transacciones (para admin) ——— */
export async function getAllTransactions(): Promise<TransactionHistory[]> {
  try {
    const qTx = query(txCol(), orderBy("createdAt", "desc"));
    const snap = await getDocs(qTx);
    return snap.docs.map((d) => d.data());
  } catch (error) {
    console.warn("Error al obtener transacciones:", error);
    const snap = await getDocs(txCol());
    const transactions = snap.docs.map((d) => d.data());
    return transactions.sort(
      (a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()
    );
  }
}

/** ——— Helper para formateo del historial (colores/strings) ——— */
export function formatTransactionForList(t: TransactionHistory): {
  titulo: string;
  subtitulo: string;
  detalle: string;
  color: "red" | "green";
} {
  const esDescuento = t.tipoTransaccion === "DESCUENTO";
  const color: "red" | "green" = esDescuento ? "red" : "green";
  const fecha = t.createdAt.toDate().toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });

  const titulo = `Nombre del usuario: ${t.nombreUsuario}`;
  const subtipo = esDescuento ? "Descuento" : "Recarga";
  const productoOExp = esDescuento
    ? `Nombre del producto: ${t.nombreProducto ?? "-"}`
    : `Nombre de la experiencia: ${t.nombreExperiencia ?? "-"}`;
  const valorLinea = `Valor: ${t.valor}`;
  const estadoLinea = `Estado: ${t.estado}`;
  const errorLinea = t.mensajeError ? `\nError: ${t.mensajeError}` : "";
  const fechaLinea = `Fecha y hora: ${fecha}`;

  return {
    titulo,
    subtitulo: `Tipo de transacción: ${subtipo}`,
    detalle: `${productoOExp}\n${valorLinea}\n${estadoLinea}${errorLinea}\n${fechaLinea}`,
    color,
  };
}
