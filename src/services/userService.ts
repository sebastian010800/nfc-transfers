import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  writeBatch,
  QueryDocumentSnapshot,
  type FirestoreDataConverter,
  type WithFieldValue,
  type UpdateData,
  type DocumentData,
} from "firebase/firestore";
import { db } from "../firebase.config";

// ====== MODELOS ======
export interface AppUser {
  id: string;
  nombre: string;
  celular: string;
  saldo: number;
  contactos: string[];
  qrCodeValue: string;
  createdAt: Timestamp;
}
export interface NewUserInput {
  nombre: string;
  celular: string;
  saldo: number;
}

// Documento en Firestore (sin 'id')
type AppUserDoc = Omit<AppUser, "id">;

// ====== CONSTANTES ======
const BASE_URL = import.meta.env.VITE_PUBLIC_BASE_URL ?? window.location.origin;

const usersCol = () => collection(db, "users");

// ====== CONVERTER TIPADO ======
const userConverter: FirestoreDataConverter<AppUser> = {
  toFirestore(user: WithFieldValue<AppUser>): DocumentData {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...docData } = user;
    return docData;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot): AppUser {
    const data = snapshot.data() as AppUserDoc;
    return { id: snapshot.id, ...data };
  },
};

// Helpers con converter
const usersColConv = () => usersCol().withConverter(userConverter);
const userDocConv = (id: string) =>
  doc(db, "users", id).withConverter(userConverter);

// ====== CREATE ======
export async function createUser(data: NewUserInput): Promise<string> {
  const newRef = doc(usersCol());
  const id = newRef.id;
  const qrCodeValue = `${BASE_URL}/host?userId=${id}`;

  const payload: WithFieldValue<AppUserDoc> = {
    nombre: data.nombre,
    celular: data.celular,
    saldo: data.saldo,
    contactos: [],
    qrCodeValue,
    createdAt: Timestamp.now(),
  };

  await setDoc(newRef, payload);
  return id;
}

export async function createUsersBulk(
  items: NewUserInput[]
): Promise<string[]> {
  const batch = writeBatch(db);
  const ids: string[] = [];

  items.forEach((u) => {
    const ref = doc(usersCol());
    const id = ref.id;
    ids.push(id);

    const payload: WithFieldValue<AppUserDoc> = {
      nombre: u.nombre,
      celular: u.celular,
      saldo: u.saldo,
      contactos: [],
      qrCodeValue: `${BASE_URL}/host?userId=${id}`,
      createdAt: Timestamp.now(),
    };

    batch.set(ref, payload);
  });

  await batch.commit();
  return ids;
}

// ====== READ ======
export async function getUser(userId: string): Promise<AppUser | null> {
  const snap = await getDoc(userDocConv(userId));
  return snap.exists() ? snap.data() : null;
}

export async function getUsersOnce(): Promise<AppUser[]> {
  const q = query(usersColConv(), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

export function subscribeUsers(cb: (users: AppUser[]) => void) {
  const q = query(usersColConv(), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => d.data());
    cb(list);
  });
}

// ====== UPDATE / DELETE ======
export async function updateUser(
  userId: string,
  data: Partial<Pick<AppUser, "nombre" | "celular" | "saldo" | "contactos">>
): Promise<void> {
  // Tipar update sin 'any'
  const updatePayload: UpdateData<AppUserDoc> = data as UpdateData<AppUserDoc>;
  await updateDoc(doc(db, "users", userId), updatePayload);
}

export async function deleteUser(userId: string): Promise<void> {
  await deleteDoc(doc(db, "users", userId));
}

// ====== CONTACTOS ======
export async function addContact(
  userId: string,
  contactId: string
): Promise<void> {
  const snap = await getDoc(userDocConv(userId));
  if (!snap.exists()) return;

  const user = snap.data();
  if (user.contactos.includes(contactId)) return;

  const updated: UpdateData<AppUserDoc> = {
    contactos: [...user.contactos, contactId],
  };
  await updateDoc(doc(db, "users", userId), updated);
}

export async function removeContact(
  userId: string,
  contactId: string
): Promise<void> {
  const snap = await getDoc(userDocConv(userId));
  if (!snap.exists()) return;

  const user = snap.data();
  const updatedList = user.contactos.filter((c) => c !== contactId);

  const updated: UpdateData<AppUserDoc> = { contactos: updatedList };
  await updateDoc(doc(db, "users", userId), updated);
}
