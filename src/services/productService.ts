import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  type FirestoreDataConverter,
  QueryDocumentSnapshot,
  type WithFieldValue,
  type DocumentData,
} from "firebase/firestore";
import { db } from "../firebase.config";

export interface Product {
  id: string;
  nombre: string;
  valor: number;
  createdAt: Timestamp;
}
type ProductDoc = Omit<Product, "id">;

const productConverter: FirestoreDataConverter<Product> = {
  toFirestore(model: WithFieldValue<Product>): DocumentData {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...rest } = model;
    return rest;
  },
  fromFirestore(snap: QueryDocumentSnapshot): Product {
    return { id: snap.id, ...(snap.data() as ProductDoc) };
  },
};

const productsCol = () =>
  collection(db, "productos").withConverter(productConverter);

export async function createProduct(data: {
  nombre: string;
  valor: number;
}): Promise<string> {
  const ref = doc(collection(db, "productos")).withConverter(productConverter);
  const payload: WithFieldValue<ProductDoc> = {
    nombre: data.nombre,
    valor: data.valor,
    createdAt: Timestamp.now(),
  };
  await setDoc(ref, payload);
  return ref.id;
}

export async function updateProduct(
  id: string,
  data: Partial<Pick<Product, "nombre" | "valor">>
) {
  await updateDoc(doc(db, "productos", id), data);
}

export async function deleteProduct(id: string) {
  await deleteDoc(doc(db, "productos", id));
}

export async function getProductsOnce(): Promise<Product[]> {
  const q = query(productsCol(), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

export function subscribeProducts(cb: (items: Product[]) => void) {
  const q = query(productsCol(), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => d.data())));
}
