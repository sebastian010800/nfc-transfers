import { useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Container,
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
  SegmentedControl,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconCheck,
  IconQrcode,
  IconUserPlus,
  IconRefresh,
} from "@tabler/icons-react";
import QRCode from "react-qr-code";
import { Scanner } from "@yudiel/react-qr-scanner";
import type { ComponentType } from "react";

const ScannerComponent = Scanner as unknown as ComponentType<{
  onDecode?: (value?: string) => void;
  onError?: (err?: unknown) => void;
  components?: { finder?: boolean };
}>;

import {
  type AppUser,
  getUser,
  getUsersOnce,
  addContact,
} from "../services/userService";
import {
  type TransactionHistory,
  getTransactionsByCelular,
  formatTransactionForList,
} from "../services/transactionService";

/** Extrae userId desde un QR que apunta a /host?userId=... (o variantes). */
function extractUserIdFromQr(value: string): string | null {
  try {
    if (/^https?:\/\//i.test(value)) {
      const url = new URL(value);
      const uid = url.searchParams.get("userId");
      return uid;
    }
    const m = value.match(/userId=([^&]+)/i);
    if (m) return decodeURIComponent(m[1]);
    if (value.length >= 20 && value.length <= 40) return value;
    return null;
  } catch {
    return null;
  }
}

export default function UserProfilePage() {
  const [celularInput, setCelularInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingTx, setLoadingTx] = useState(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const [transactions, setTransactions] = useState<TransactionHistory[]>([]);
  const [contacts, setContacts] = useState<AppUser[]>([]);

  const loadUser = async () => {
    setLoading(true);
    setUser(null);
    setTransactions([]);
    setContacts([]);

    try {
      const all = await getUsersOnce();
      const u = all.find((x) => x.celular === celularInput.trim()) ?? null;

      if (!u) {
        setUser(null);
        return;
      }

      setUser(u);

      // Cargar transacciones usando el celular
      await loadTransactions(u.celular);

      // Resolver contactos
      const resolved: AppUser[] = [];
      for (const cid of u.contactos ?? []) {
        const c = await getUser(cid);
        if (c) resolved.push(c);
      }
      setContacts(resolved);
    } catch (error) {
      console.error("Error al cargar usuario:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async (celular: string) => {
    setLoadingTx(true);
    try {
      console.log("Buscando transacciones para celular:", celular);
      const txs = await getTransactionsByCelular(celular);
      console.log("Transacciones encontradas:", txs);
      setTransactions(txs);
    } catch (error) {
      console.error("Error al cargar transacciones:", error);
      setTransactions([]);
    } finally {
      setLoadingTx(false);
    }
  };

  const refreshTransactions = async () => {
    if (!user) return;
    await loadTransactions(user.celular);
  };

  // Modal Agregar contacto
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<"scan" | "celular">("scan");
  const [scanActive, setScanActive] = useState(true);
  const [addError, setAddError] = useState("");
  const [pendingContact, setPendingContact] = useState<AppUser | null>(null);
  const [celularToAdd, setCelularToAdd] = useState("");

  const openAdd = () => {
    setAddError("");
    setPendingContact(null);
    setAddMode("scan");
    setScanActive(true);
    setAddOpen(true);
  };

  const closeAdd = () => {
    setAddOpen(false);
    setScanActive(false);
    setAddError("");
    setPendingContact(null);
    setCelularToAdd("");
  };

  const handleScan = async (decoded: string) => {
    if (!user) return;
    setScanActive(false);
    setAddError("");
    const uid = extractUserIdFromQr(decoded);
    if (!uid) {
      setAddError("No se pudo leer un userId válido en el QR.");
      return;
    }
    if (uid === user.id) {
      setAddError("No puedes agregarte a ti mismo como contacto.");
      return;
    }
    const contact = await getUser(uid);
    if (!contact) {
      setAddError("El usuario del QR no existe.");
      return;
    }
    setPendingContact(contact);
  };

  const scannerOnDecode = (val: string | undefined) => {
    if (typeof val === "string") void handleScan(val);
  };

  const scannerOnError = (err: unknown) => {
    setAddError(`Error de cámara: ${String(err)}`);
  };

  const handleFindByCel = async () => {
    if (!user) return;
    setAddError("");
    setPendingContact(null);

    const all = await getUsersOnce();
    const found = all.find((x) => x.celular === celularToAdd.trim()) ?? null;

    if (!found) {
      setAddError("No existe un usuario con ese celular.");
      return;
    }
    if (found.id === user.id) {
      setAddError("No puedes agregarte a ti mismo como contacto.");
      return;
    }
    setPendingContact(found);
  };

  const confirmAddContact = async () => {
    if (!user || !pendingContact) return;
    try {
      await addContact(user.id, pendingContact.id);

      const updated: AppUser[] = [];
      for (const cid of [...(user.contactos ?? []), pendingContact.id]) {
        const c = await getUser(cid);
        if (c) updated.push(c);
      }
      setContacts(updated);

      setUser({
        ...user,
        contactos: [...(user.contactos ?? []), pendingContact.id],
      });

      closeAdd();
    } catch {
      setAddError("No se pudo agregar el contacto.");
    }
  };

  const txRows = useMemo(() => {
    return transactions.map((t) => {
      const { titulo, subtitulo, detalle, color } = formatTransactionForList(t);
      return { id: t.id, titulo, subtitulo, detalle, color };
    });
  }, [transactions]);

  return (
    <Container size="lg" mt="xl">
      <Title order={2}>Perfil de Usuario</Title>
      <Text c="dimmed" mb="lg">
        Consulta por celular, visualiza datos, historial, QR y contactos.
      </Text>

      <Group align="flex-end" mb="md">
        <TextInput
          label="Celular"
          placeholder="3101234567"
          value={celularInput}
          onChange={(e) => setCelularInput(e.currentTarget.value)}
          style={{ minWidth: 260 }}
        />
        <Button
          onClick={loadUser}
          disabled={!celularInput.trim()}
          loading={loading}
        >
          Buscar
        </Button>
      </Group>

      {loading && (
        <Paper withBorder p="md" radius="md">
          <Group justify="center">
            <Loader />
            <Text>Cargando información del usuario...</Text>
          </Group>
        </Paper>
      )}

      {!loading && !user && celularInput && (
        <Alert color="red" icon={<IconAlertCircle />}>
          No se encontró ningún usuario con el celular ingresado.
        </Alert>
      )}

      {user && (
        <>
          {/* Datos del usuario */}
          <Paper withBorder p="md" radius="md" mb="md">
            <Group justify="space-between" align="flex-start">
              <div>
                <Title order={3} mb={4}>
                  {user.nombre}
                </Title>
                <Text>Celular: {user.celular}</Text>
                <Group mt="xs">
                  <Badge variant="dot" color="teal" size="lg">
                    Saldo: {user.saldo}
                  </Badge>
                </Group>
              </div>
              <Stack align="center">
                <Text size="sm" c="dimmed">
                  Mi QR
                </Text>
                <QRCode value={user.qrCodeValue} size={128} />
              </Stack>
            </Group>
          </Paper>

          {/* Historial de transacciones */}
          <Paper withBorder p="md" radius="md" mb="md">
            <Group justify="space-between" mb="xs">
              <Group>
                <Title order={4}>Historial de transacciones</Title>
                <Badge variant="light">{transactions.length}</Badge>
              </Group>
              <Button
                variant="light"
                size="sm"
                leftSection={<IconRefresh size={16} />}
                onClick={refreshTransactions}
                loading={loadingTx}
              >
                Actualizar
              </Button>
            </Group>
            <Divider mb="sm" />

            {loadingTx ? (
              <Group justify="center" p="md">
                <Loader size="sm" />
                <Text size="sm" c="dimmed">
                  Cargando transacciones...
                </Text>
              </Group>
            ) : transactions.length === 0 ? (
              <Alert color="blue" icon={<IconAlertCircle />}>
                Sin transacciones registradas para este usuario.
              </Alert>
            ) : (
              <Table withRowBorders highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Resumen</Table.Th>
                    <Table.Th>Detalle</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {txRows.map((r) => (
                    <Table.Tr key={r.id}>
                      <Table.Td width="35%">
                        <Stack gap={2}>
                          <Text fw={600}>{r.titulo}</Text>
                          <Text c={r.color === "red" ? "red" : "green"}>
                            {r.subtitulo}
                          </Text>
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Text style={{ whiteSpace: "pre-line" }}>
                          {r.detalle}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Paper>

          {/* Contactos */}
          <Paper withBorder p="md" radius="md">
            <Group justify="space-between" mb="xs">
              <Title order={4}>Contactos</Title>
              <Button
                leftSection={<IconUserPlus size={16} />}
                onClick={openAdd}
              >
                Agregar contacto
              </Button>
            </Group>
            <Divider mb="sm" />
            {contacts.length === 0 ? (
              <Text c="dimmed">Aún no tienes contactos.</Text>
            ) : (
              <Table withRowBorders highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Nombre</Table.Th>
                    <Table.Th>Celular</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {contacts.map((c) => (
                    <Table.Tr key={c.id}>
                      <Table.Td>{c.nombre}</Table.Td>
                      <Table.Td>{c.celular}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Paper>
        </>
      )}

      {/* Modal Agregar contacto */}
      <Modal
        opened={addOpen}
        onClose={closeAdd}
        title="Agregar contacto"
        size="lg"
        centered
      >
        {!user ? (
          <Alert color="red" icon={<IconAlertCircle />}>
            Debes cargar primero un usuario (buscando por celular) para poder
            agregar contactos.
          </Alert>
        ) : (
          <Stack>
            <SegmentedControl
              value={addMode}
              onChange={(v) => {
                setAddMode(v as "scan" | "celular");
                setAddError("");
                setPendingContact(null);
                setScanActive(v === "scan");
              }}
              data={[
                { label: "Escanear QR", value: "scan" },
                { label: "Ingresar celular", value: "celular" },
              ]}
            />

            {addMode === "scan" && (
              <Stack>
                <Text size="sm" c="dimmed">
                  Apunta la cámara al QR del otro usuario
                </Text>
                {scanActive && (
                  <ScannerComponent
                    onDecode={scannerOnDecode}
                    onError={scannerOnError}
                    components={{ finder: true }}
                  />
                )}
              </Stack>
            )}

            {addMode === "celular" && (
              <Group align="end">
                <TextInput
                  label="Celular del contacto"
                  placeholder="3130001122"
                  value={celularToAdd}
                  onChange={(e) => setCelularToAdd(e.currentTarget.value)}
                  leftSection={<IconQrcode size={16} />}
                  style={{ flex: 1 }}
                />
                <Button variant="light" onClick={handleFindByCel}>
                  Buscar
                </Button>
              </Group>
            )}

            {addError && (
              <Alert color="red" icon={<IconAlertCircle />}>
                {addError}
              </Alert>
            )}

            {pendingContact && (
              <Paper withBorder p="sm" radius="md">
                <Group justify="space-between" align="center">
                  <div>
                    <Text fw={600}>{pendingContact.nombre}</Text>
                    <Text size="sm" c="dimmed">
                      {pendingContact.celular}
                    </Text>
                  </div>
                  <Button
                    leftSection={<IconCheck size={16} />}
                    onClick={confirmAddContact}
                  >
                    Confirmar agregar
                  </Button>
                </Group>
              </Paper>
            )}
          </Stack>
        )}
      </Modal>
    </Container>
  );
}
