import { useMemo, useState, useEffect } from "react";
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
  IconTrash,
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

// Constante para la clave de localStorage
const STORAGE_KEY = "user_profile_celular";

export default function UserProfilePage() {
  const [celularInput, setCelularInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingTx, setLoadingTx] = useState(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const [transactions, setTransactions] = useState<TransactionHistory[]>([]);
  const [contacts, setContacts] = useState<AppUser[]>([]);
  const [qrModalOpened, setQrModalOpened] = useState(false);

  // Cargar celular desde localStorage al montar el componente
  useEffect(() => {
    const savedCelular = localStorage.getItem(STORAGE_KEY);
    if (savedCelular) {
      setCelularInput(savedCelular);
      // Auto-cargar los datos del usuario guardado
      loadUserByCelular(savedCelular);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUserByCelular = async (celular: string) => {
    setLoading(true);
    setUser(null);
    setTransactions([]);
    setContacts([]);

    try {
      const all = await getUsersOnce();
      const u = all.find((x) => x.celular === celular.trim()) ?? null;

      if (!u) {
        setUser(null);
        // Si no se encuentra, limpiar localStorage
        localStorage.removeItem(STORAGE_KEY);
        return;
      }

      setUser(u);

      // Guardar en localStorage solo si se encontró el usuario
      localStorage.setItem(STORAGE_KEY, celular.trim());

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
      // En caso de error, también limpiar localStorage
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  };

  const loadUser = async () => {
    await loadUserByCelular(celularInput);
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

  const clearSavedUser = () => {
    localStorage.removeItem(STORAGE_KEY);
    setCelularInput("");
    setUser(null);
    setTransactions([]);
    setContacts([]);
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
    console.log("Contacto escaneado:", contact);
    setPendingContact(contact);
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

      {!user ? (
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
      ) : (
        <Group justify="space-between" align="center" mb="md">
          <Alert color="blue" style={{ flex: 1 }}>
            <Group justify="space-between" align="center">
              <div>
                <Text size="sm" fw={500}>
                  Sesión activa
                </Text>
                <Text size="xs" c="dimmed">
                  Viendo perfil de: {user.celular}
                </Text>
              </div>
              <Button
                variant="light"
                color="red"
                size="sm"
                leftSection={<IconTrash size={16} />}
                onClick={clearSavedUser}
              >
                Cerrar sesión
              </Button>
            </Group>
          </Alert>
        </Group>
      )}

      {loading && (
        <Paper withBorder p="md" radius="md">
          <Group justify="center">
            <Loader />
            <Text>Cargando información del usuario...</Text>
          </Group>
        </Paper>
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
                <div
                  onClick={() => setQrModalOpened(true)}
                  style={{ cursor: "pointer" }}
                  title="Click para ampliar"
                >
                  <div
                    style={{
                      padding: 20,
                      background: "white",
                      borderRadius: 16,
                      display: "inline-block",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                    }}
                  >
                    <QRCode
                      value={user.qrCodeValue} // ← Usa SOLO el ID (no URL larga)
                      size={140}
                      level="H" // ← ESTO ES LO QUE FALLABA
                      fgColor="#000000"
                      bgColor="#ffffff"
                    />
                  </div>
                  <Text size="xs" c="dimmed" ta="center" mt={8}>
                    Toca para ampliar
                  </Text>
                </div>
              </Stack>
            </Group>
          </Paper>

          {/* Historial de transacciones */}
          <Paper withBorder p="md"  radius="md" mb="md">
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
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <Table withRowBorders highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Resumen</Table.Th>
                    <Table.Th>Detalle</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody >
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
              </div>
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
              <Stack align="center">
                <Text size="sm" c="dimmed" mb="md">
                  Apunta la cámara al QR del otro usuario
                </Text>

                {/* Contenedor fijo para evitar glitches en Xiaomi */}
                <div
                  style={{
                    width: "100%",
                    maxWidth: 400,
                    height: 400,
                    borderRadius: 12,
                    overflow: "hidden",
                    border: "2px solid #e9ecef",
                  }}
                >
                  {scanActive ? (
                    <ScannerComponent
                      onScan={(detectedCodes) => {
                        // ← CAMBIO CLAVE: Usa onScan, NO onDecode
                        if (
                          detectedCodes.length > 0 &&
                          detectedCodes[0]?.rawValue
                        ) {
                          void handleScan(detectedCodes[0].rawValue);
                          setScanActive(false); // Detiene después de leer
                        }
                      }}
                      onError={(error) => {
                        console.error("Error de scanner:", error);
                        setAddError(
                          `Error de cámara: ${error?.message || String(error)}`
                        );
                        // En Xiaomi, reinicia si falla
                        if (
                          error?.name === "NotAllowedError" ||
                          error?.name === "NotFoundError"
                        ) {
                          setTimeout(() => setScanActive(false), 1000);
                        }
                      }}
                      // ← SOLO estas props básicas (sin formats ni focusMode que causan el error)
                      components={{
                        finder: true, // Cuadro de detección
                        torch: false, // Desactiva flash para evitar crashes en Redmi viejo
                      }}
                      // ← NO uses constraints complejos aquí, causan el "t2 is not a function"
                      // En su lugar, usa defaults de la librería
                    />
                  ) : (
                    <Paper withBorder p="xl" ta="center" bg="gray.1">
                      <IconQrcode size={48} c="dimmed" />
                      <Text c="dimmed" mt="xs">
                        Escaneo completado o pausado
                      </Text>
                      <Button
                        mt="md"
                        onClick={() => setScanActive(true)}
                        leftSection={<IconQrcode size={16} />}
                        variant="light"
                      >
                        Reanudar escaneo
                      </Button>
                    </Paper>
                  )}
                </div>

                {/* Botón de reinicio manual (útil en MIUI) */}
                <Button
                  variant="subtle"
                  size="sm"
                  mt="sm"
                  onClick={() => {
                    setScanActive(false);
                    setTimeout(() => setScanActive(true), 500); // Reinicio forzado
                  }}
                  disabled={scanActive}
                >
                  Reiniciar cámara
                </Button>
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

      {/* Modal QR ampliado */}
      <Modal
        opened={qrModalOpened}
        onClose={() => setQrModalOpened(false)}
        title={`QR de ${user?.nombre || ""}`}
        size="auto"
        centered
      >
        {user && (
          <Stack align="center" p="xl">
            <div
              style={{
                padding: 30,
                background: "white",
                borderRadius: 24,
                boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
              }}
            >
              <QRCode
                value={user.qrCodeValue} // ← solo el ID
                size={280}
                level="H" // ← imprescindible
                fgColor="#000000"
                bgColor="#ffffff"
              />
            </div>
            <Text size="lg" fw={600} ta="center" mt="md">
              {user.nombre}
            </Text>
            <Text size="sm" c="dimmed" ta="center">
              {user.celular}
            </Text>
          </Stack>
        )}
      </Modal>
    </Container>
  );
}
