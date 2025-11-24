import { useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Container,
  Divider,
  Group,
  Modal,
  NumberInput,
  Pagination,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Loader,
} from "@mantine/core";
import { useDebouncedValue, useDisclosure } from "@mantine/hooks";
import {
  IconEdit,
  IconQrcode,
  IconTrash,
  IconUpload,
  IconDownload,
} from "@tabler/icons-react";
import QRCode from "react-qr-code";

import {
  type AppUser,
  type NewUserInput,
  createUser,
  deleteUser,
  subscribeUsers,
  updateUser,
} from "../../services/userService";

import { 
  getTransactionsByCelular,
  type TransactionHistory 
} from "../../services/transactionService";

import { parseXlsxSafely } from "../../hooks/useSafeXlsx";
import type { CellValue } from "../../hooks/useSafeXlsx";

const TEMPLATE_URL = "/plantilla_usuarios.xlsx";

type BulkRow = { nombre: string; celular: string; saldo: number };
type BulkError = { row: number; reason: string };

export default function UsersPage() {
  // ======== DATA ========
  const [users, setUsers] = useState<AppUser[]>([]);
  useEffect(() => {
    const unsub = subscribeUsers(setUsers);
    return () => unsub();
  }, []);

  // ======== SEARCH ========
  const [query, setQuery] = useState("");
  const [q] = useDebouncedValue(query.trim().toLowerCase(), 250);
  const filtered = useMemo(() => {
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.nombre ?? "").toLowerCase().includes(q) ||
        (u.celular ?? "").toLowerCase().includes(q)
    );
  }, [users, q]);

  // ======== PAGINATION ========
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);
  useEffect(() => setPage(1), [pageSize, q]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSlice = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  // ======== CREATE ========
  const [createOpened, { open: openCreate, close: closeCreate }] =
    useDisclosure(false);
  const [newUser, setNewUser] = useState<NewUserInput>({
    nombre: "",
    celular: "",
    saldo: 0,
  });
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newUser.nombre || !newUser.celular) return;
    try {
      setCreating(true);
      await createUser(newUser);
      setNewUser({ nombre: "", celular: "", saldo: 0 });
      closeCreate();
    } finally {
      setCreating(false);
    }
  };

  // ======== EDIT ========
  const [editOpened, { open: openEdit, close: closeEdit }] =
    useDisclosure(false);
  const [editUser, setEditUser] = useState<AppUser | null>(null);

  const onEdit = (u: AppUser) => {
    setEditUser(u);
    openEdit();
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    await updateUser(editUser.id, {
      nombre: editUser.nombre,
      celular: editUser.celular,
      saldo: editUser.saldo,
    });
    closeEdit();
  };

  // ======== DELETE ========
  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este usuario?")) return;
    await deleteUser(id);
  };

  // ======== QR ========
  const [qrOpened, { open: openQR, close: closeQR }] = useDisclosure(false);
  const [qrUser, setQrUser] = useState<AppUser | null>(null);
  const onShowQR = (u: AppUser) => {
    setQrUser(u);
    openQR();
  };

  // ======== TRANSACTIONS ========
  const [transactionsOpened, { open: openTransactions, close: closeTransactions }] =
    useDisclosure(false);
  const [transactions, setTransactions] = useState<TransactionHistory[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);

  const handleShowTransactions = async (user: AppUser) => {
    setSelectedUser(user);
    setLoadingTransactions(true);
    openTransactions();
    
    try {
      const txs = await getTransactionsByCelular(user.celular);
      setTransactions(txs);
    } catch (error) {
      console.error("Error cargando transacciones:", error);
      setTransactions([]);
    } finally {
      setLoadingTransactions(false);
    }
  };

  // ======== BULK (XLSX) ========
  const [bulkOpened, { open: openBulk, close: closeBulk }] =
    useDisclosure(false);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkReport, setBulkReport] = useState<{
    okCount: number;
    errorCount: number;
    errors: BulkError[];
  }>({ okCount: 0, errorCount: 0, errors: [] });
  const [processingBulk, setProcessingBulk] = useState(false);

  const parseExcel = async (file?: File | null) => {
    setBulkRows([]);
    setBulkReport({ okCount: 0, errorCount: 0, errors: [] });
    if (!file) return;

    const res = await parseXlsxSafely(file, {
      maxSizeMB: 2,
      maxRows: 2000,
      maxCols: 20,
      timeoutMs: 8000,
    });

    if (!res.ok) {
      setBulkReport({
        okCount: 0,
        errorCount: 1,
        errors: [{ row: 0, reason: res.error }],
      });
      return;
    }

    const normalized = res.rows.map((r: Record<string, CellValue>) => {
      const out: Record<string, unknown> = {};
      Object.keys(r).forEach((k) => {
        out[k.trim().toLowerCase()] = r[k];
      });
      return out;
    });

    const parsed: BulkRow[] = [];
    const errors: BulkError[] = [];

    normalized.forEach((r, idx) => {
      const rowNum = idx + 2;
      const nombre = String((r["nombre"] ?? "") as string).trim();
      const celular = String((r["celular"] ?? "") as string).trim();
      const saldoVal = r["saldo"];
      const saldo =
        saldoVal === "" || saldoVal == null ? 0 : Number(saldoVal as number);

      if (!nombre) errors.push({ row: rowNum, reason: "nombre requerido" });
      if (!celular) errors.push({ row: rowNum, reason: "celular requerido" });
      if (Number.isNaN(saldo) || saldo < 0)
        errors.push({ row: rowNum, reason: "saldo inválido" });

      if (nombre && celular && !Number.isNaN(saldo) && saldo >= 0) {
        parsed.push({ nombre, celular, saldo });
      }
    });

    setBulkRows(parsed);
    setBulkReport({
      okCount: parsed.length,
      errorCount: errors.length,
      errors,
    });
  };

  const processBulkCreate = async () => {
    if (!bulkRows.length) return;
    setProcessingBulk(true);

    const errors: BulkError[] = [];
    let okCount = 0;

    for (let i = 0; i < bulkRows.length; i++) {
      const row = bulkRows[i];
      const rowNum = i + 2;
      try {
        await createUser(row);
        okCount++;
      } catch {
        errors.push({ row: rowNum, reason: "Error al crear el usuario" });
      }
    }

    setBulkReport({ okCount, errorCount: errors.length, errors });
    setProcessingBulk(false);
  };

  // ======== RENDER ========
  return (
    <Container size="xl" mt="xl">
      {/* Header */}
      <Group justify="space-between" align="end" mb="md">
        <div>
          <Title order={2}>Usuarios</Title>
          <Text c="dimmed" size="sm">
            Administra usuarios, QR y cargas masivas
          </Text>
        </div>

        <Group>
          <TextInput
            placeholder="Buscar por nombre o celular"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            style={{ minWidth: 280 }}
          />
          <Button onClick={openCreate}>Crear usuario</Button>
          <Button
            variant="light"
            onClick={openBulk}
            leftSection={<IconUpload size={16} />}
          >
            Carga masiva
          </Button>
        </Group>
      </Group>

      <Paper withBorder p="sm" radius="md">
        {/* Table controls */}
        <Group justify="space-between" mb="sm">
          <Text size="sm" c="dimmed">
            {filtered.length} resultado(s) {q ? `para "${query}"` : ""}
          </Text>
          <Group gap="xs">
            <Text size="sm">Ver:</Text>
            <Select
              value={String(pageSize)}
              onChange={(v) => v && setPageSize(Number(v))}
              data={[
                { value: "10", label: "10" },
                { value: "25", label: "25" },
                { value: "50", label: "50" },
              ]}
              w={90}
            />
          </Group>
        </Group>

        {/* Table */}
        <Table
          highlightOnHover
          stickyHeader
          stickyHeaderOffset={0}
          withRowBorders
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nombre</Table.Th>
              <Table.Th>Celular</Table.Th>
              <Table.Th>Saldo</Table.Th>
              <Table.Th ta="center">Acciones</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {pageSlice.map((u) => (
              <Table.Tr 
                key={u.id}
                style={{ cursor: 'pointer' }}
                onClick={() => handleShowTransactions(u)}
              >
                <Table.Td>{u.nombre}</Table.Td>
                <Table.Td>{u.celular}</Table.Td>
                <Table.Td>
                  <Badge variant="light">{u.saldo}</Badge>
                </Table.Td>
                <Table.Td onClick={(e) => e.stopPropagation()}>
                  <Group gap="xs" justify="center">
                    <ActionIcon
                      variant="subtle"
                      aria-label="Editar"
                      onClick={() => onEdit(u)}
                      title="Editar"
                    >
                      <IconEdit size={18} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label="Eliminar"
                      onClick={() => handleDelete(u.id)}
                      title="Eliminar"
                    >
                      <IconTrash size={18} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      aria-label="QR"
                      onClick={() => onShowQR(u)}
                      title="Ver QR"
                    >
                      <IconQrcode size={18} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {pageSlice.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text c="dimmed" ta="center">
                    Sin resultados
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>

        {/* Pagination */}
        <Group justify="center" mt="sm" mb={-4}>
          <Pagination
            value={page}
            onChange={setPage}
            total={totalPages}
            size="sm"
          />
        </Group>
      </Paper>

      {/* Modal: Create */}
      <Modal
        opened={createOpened}
        onClose={closeCreate}
        title="Crear usuario"
        centered
      >
        <Stack>
          <TextInput
            label="Nombre"
            value={newUser.nombre}
            onChange={(e) =>
              setNewUser({ ...newUser, nombre: e.currentTarget.value })
            }
            required
          />
          <TextInput
            label="Celular"
            value={newUser.celular}
            onChange={(e) =>
              setNewUser({ ...newUser, celular: e.currentTarget.value })
            }
            required
          />
          <NumberInput
            label="Saldo"
            value={newUser.saldo}
            onChange={(v) => setNewUser({ ...newUser, saldo: Number(v ?? 0) })}
            min={0}
          />
          <Group justify="end">
            <Button onClick={handleCreate} loading={creating}>
              Crear
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal: Edit */}
      <Modal
        opened={editOpened}
        onClose={closeEdit}
        title="Editar usuario"
        centered
      >
        {editUser && (
          <Stack>
            <TextInput
              label="Nombre"
              value={editUser.nombre}
              onChange={(e) =>
                setEditUser({ ...editUser, nombre: e.currentTarget.value })
              }
              required
            />
            <TextInput
              label="Celular"
              value={editUser.celular}
              onChange={(e) =>
                setEditUser({ ...editUser, celular: e.currentTarget.value })
              }
              required
            />
            <NumberInput
              label="Saldo"
              value={editUser.saldo}
              onChange={(v) =>
                setEditUser({ ...editUser, saldo: Number(v ?? 0) })
              }
              min={0}
            />
            <Group justify="end">
              <Button onClick={handleSaveEdit}>Guardar</Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Modal: QR */}
      <Modal opened={qrOpened} onClose={closeQR} title="Código QR" centered>
        {qrUser && (
          <Stack align="center">
            <QRCode value={qrUser.qrCodeValue} />
            <Group>
              <Button
                leftSection={<IconDownload size={16} />}
                onClick={() => {
                  const svg = document.querySelector("svg");
                  if (!svg) return;
                  const xml = new XMLSerializer().serializeToString(svg);
                  const svg64 = btoa(unescape(encodeURIComponent(xml)));
                  const src = `data:image/svg+xml;base64,${svg64}`;
                  const a = document.createElement("a");
                  a.href = src;
                  a.download = `qr-${qrUser.celular}.svg`;
                  a.click();
                }}
              >
                Descargar SVG
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Modal: Transactions */}
      <Modal
        opened={transactionsOpened}
        onClose={closeTransactions}
        title={`Transacciones - ${selectedUser?.nombre || ''}`}
        size="xl"
        centered
      >
        {loadingTransactions ? (
          <Group justify="center" py="xl">
            <Loader size="md" />
          </Group>
        ) : (
          <Stack>
            {transactions.length === 0 ? (
              <Text c="dimmed" ta="center" py="xl">
                No hay transacciones para este usuario
              </Text>
            ) : (
              <>
                <Text size="sm" c="dimmed">
                  Total: {transactions.length} transacciones
                </Text>
                <Table highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Fecha</Table.Th>
                      <Table.Th>Tipo</Table.Th>
                      <Table.Th>Experiencia/Producto</Table.Th>
                      <Table.Th>Valor</Table.Th>
                      <Table.Th>Estado</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {transactions.map((tx) => (
                      <Table.Tr key={tx.id}>
                        <Table.Td>
                          <Text size="sm">
                            {tx.createdAt?.toDate 
                              ? new Date(tx.createdAt.toDate()).toLocaleString('es-CO', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : '-'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge 
                            color={
                              tx.tipoTransaccion === 'RECARGA' ? 'green' : 'red'
                              
                              
                            }
                            variant="light"
                          >
                            {tx.tipoTransaccion}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Stack gap={0}>
                            {tx.nombreExperiencia && (
                              <Text size="sm" fw={500}>
                                {tx.nombreExperiencia}
                              </Text>
                            )}
                            {tx.nombreProducto && (
                              <Text size="xs" c="dimmed">
                                {tx.nombreProducto}
                              </Text>
                            )}
                            {!tx.nombreExperiencia && !tx.nombreProducto && (
                              <Text size="sm" c="dimmed">-</Text>
                            )}
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          <Text 
                            fw={500}
                            c={tx.tipoTransaccion === 'RECARGA' ? 'green' : undefined}
                          >
                            {tx.tipoTransaccion === 'RECARGA' ? '+' : '-'}
                            ${tx.valor.toLocaleString('es-CO')}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            color={tx.estado === 'Exitoso' ? 'green' : 'red'}
                            variant="dot"
                          >
                            {tx.estado}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </>
            )}
          </Stack>
        )}
      </Modal>

      {/* Modal: Bulk upload */}
      <Modal
        opened={bulkOpened}
        onClose={() => {
          setBulkRows([]);
          setBulkReport({ okCount: 0, errorCount: 0, errors: [] });
          closeBulk();
        }}
        title="Carga masiva de usuarios"
        size="lg"
        centered
      >
        <Stack>
          <Group>
            <Button
              component="a"
              href={TEMPLATE_URL}
              target="_blank"
              rel="noreferrer"
              leftSection={<IconDownload size={16} />}
              variant="light"
            >
              Descargar plantilla
            </Button>

            <Button
              variant="default"
              leftSection={<IconUpload size={16} />}
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".xlsx,.xlsm";
                input.onchange = () => {
                  const f = (input.files?.[0] as File) ?? null;
                  if (f) void parseExcel(f);
                };
                input.click();
              }}
            >
              Cargar archivo
            </Button>
          </Group>

          <Divider />

          <Stack gap={4}>
            <Text size="sm" fw={600}>
              Resumen de lectura
            </Text>
            <Text size="sm">Válidos: {bulkReport.okCount}</Text>
            <Text size="sm">Errores: {bulkReport.errorCount}</Text>
            {bulkReport.errors.slice(0, 15).map((e, i) => (
              <Text key={i} size="sm" c="red">
                Fila {e.row}: {e.reason}
              </Text>
            ))}
            {bulkReport.errors.length > 15 && (
              <Text size="sm" c="dimmed">
                … y {bulkReport.errors.length - 15} más
              </Text>
            )}
          </Stack>

          <Group justify="end">
            <Button
              onClick={processBulkCreate}
              disabled={!bulkRows.length}
              loading={processingBulk}
            >
              Crear {bulkRows.length} usuarios
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}