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

export interface Experience {
  id: string;
  nombre: string;
  valor: number;
  createdAt: Timestamp;
}
type ExperienceDoc = Omit<Experience, "id">;

const experienceConverter: FirestoreDataConverter<Experience> = {
  toFirestore(model: WithFieldValue<Experience>): DocumentData {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...rest } = model;
    return rest;
  },
  fromFirestore(snap: QueryDocumentSnapshot): Experience {
    return { id: snap.id, ...(snap.data() as ExperienceDoc) };
  },
};

const experiencesCol = () =>
  collection(db, "experiencias").withConverter(experienceConverter);

export async function createExperience(data: {
  nombre: string;
  valor: number;
}): Promise<string> {
  const ref = doc(collection(db, "experiencias")).withConverter(
    experienceConverter
  );
  const payload: WithFieldValue<ExperienceDoc> = {
    nombre: data.nombre,
    valor: data.valor,
    createdAt: Timestamp.now(),
  };
  await setDoc(ref, payload);
  return ref.id;
}

export async function updateExperience(
  id: string,
  data: Partial<Pick<Experience, "nombre" | "valor">>
) {
  await updateDoc(doc(db, "experiencias", id), data);
}

export async function deleteExperience(id: string) {
  await deleteDoc(doc(db, "experiencias", id));
}

export async function getExperiencesOnce(): Promise<Experience[]> {
  const q = query(experiencesCol(), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

export function subscribeExperiences(cb: (items: Experience[]) => void) {
  const q = query(experiencesCol(), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => d.data())));
}
