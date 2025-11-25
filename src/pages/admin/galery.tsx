// GaleriaAdmin.mantine.tsx
// Administrador de "galeria" con Mantine: listar, buscar, paginar, crear (con .mp4), editar, sumar donaciones y eliminar.
// Requiere @mantine/core, @mantine/hooks y @tabler/icons-react instalados.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Container,
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
  Textarea,
  Title,
  Divider,
} from "@mantine/core";
import { useDebouncedValue, useDisclosure } from "@mantine/hooks";
import {
  IconEdit,
  IconPlus,
  IconTrash,
  IconUpload,
  IconPlayerPlay,
  IconCurrencyDollar,
  IconRefresh,
} from "@tabler/icons-react";

import type {
  Galeria,
  GaleriaCreateInput,
  GaleriaUpdateInput,
} from "../../services/galeryService";
import {
  consultarGalerias,
  crearGaleria,
  editarGaleria,
  editarDonacionesSumando,
  eliminarGaleria,
} from "../../services/galeryService";

// Tipo para Firestore Timestamp
interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
  toDate: () => Date;
}

function formatDate(v: unknown): string {
  if (!v) return "";
  try {
    // Verificar si es un Timestamp de Firestore
    const timestamp = v as FirestoreTimestamp;
    if (timestamp && typeof timestamp.toDate === "function") {
      return timestamp.toDate().toLocaleString();
    }
    // Si es una fecha
    if (v instanceof Date) {
      return v.toLocaleString();
    }
  } catch (error) {
    console.error("Error al formatear fecha:", error);
  }
  return String(v);
}

export default function GaleriaAdminMantine() {
  // datos
  const [items, setItems] = useState<Galeria[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const rows = await consultarGalerias();
      const ordered = rows.slice().sort((a, b) => {
        const aTimestamp = (a as unknown as { createdAt?: FirestoreTimestamp })
          .createdAt;
        const bTimestamp = (b as unknown as { createdAt?: FirestoreTimestamp })
          .createdAt;
        const ax = aTimestamp?.seconds ?? 0;
        const bx = bTimestamp?.seconds ?? 0;
        return bx - ax;
      });
      setItems(ordered);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Error al cargar";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  // búsqueda
  const [query, setQuery] = useState("");
  const [q] = useDebouncedValue(query.trim().toLowerCase(), 250);
  const filtered = useMemo(() => {
    if (!q) return items;
    return items.filter((g) =>
      `${g.nombre}\n${g.descripcion}`.toLowerCase().includes(q)
    );
  }, [items, q]);

  // paginación (cliente)
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [pageSize, q]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSlice = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  // ===== Crear =====
  const [createOpen, { open: openCreate, close: closeCreate }] =
    useDisclosure(false);
  const [creating, setCreating] = useState(false);
  const [newNombre, setNewNombre] = useState("");
  const [newDescripcion, setNewDescripcion] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const handleCreate = async () => {
    try {
      const file = fileRef.current?.files?.[0];
      if (!newNombre.trim()) throw new Error("Nombre requerido");
      if (!newDescripcion.trim()) throw new Error("Descripción requerida");
      if (!file) throw new Error("Adjunta un archivo .mp4");
      if (file.type !== "video/mp4")
        throw new Error("El archivo debe ser .mp4");

      setCreating(true);
      const input: GaleriaCreateInput = {
        nombre: newNombre.trim(),
        descripcion: newDescripcion.trim(),
        videoFile: file,
        videoFilename: file.name,
      };
      await crearGaleria(input);
      setNewNombre("");
      setNewDescripcion("");
      if (fileRef.current) fileRef.current.value = "";
      closeCreate();
      await load();
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "No se pudo crear";
      alert(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  // ===== Editar =====
  const [editOpen, { open: _openEdit, close: closeEdit }] =
    useDisclosure(false);
  const [editItem, setEditItem] = useState<Galeria | null>(null);
  const editFileRef = useRef<HTMLInputElement | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const openEdit = (g: Galeria) => {
    setEditItem(g);
    _openEdit();
  };

  const handleSaveEdit = async () => {
    if (!editItem) return;
    try {
      setSavingEdit(true);
      const payload: GaleriaUpdateInput = {
        nombre: editItem.nombre?.trim(),
        descripcion: editItem.descripcion?.trim(),
      };
      const file = editFileRef.current?.files?.[0];
      if (file) {
        if (file.type !== "video/mp4")
          throw new Error("El archivo debe ser .mp4");
        payload.newVideoFile = file;
        payload.newVideoFilename = file.name;
      }
      await editarGaleria(editItem.id, payload);
      closeEdit();
      if (editFileRef.current) editFileRef.current.value = "";
      await load();
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e.message : "No se pudo guardar";
      alert(errorMessage);
    } finally {
      setSavingEdit(false);
    }
  };

  // ===== Donaciones (sumar) =====
  const [donateOpen, { open: openDonate, close: closeDonate }] =
    useDisclosure(false);
  const [donateItem, setDonateItem] = useState<Galeria | null>(null);
  const [donateAmount, setDonateAmount] = useState<number | "">(0);
  const [savingDonate, setSavingDonate] = useState(false);

  const onOpenDonate = (g: Galeria) => {
    setDonateItem(g);
    setDonateAmount(0);
    openDonate();
  };

  const handleDonate = async () => {
    if (!donateItem) return;
    const m = typeof donateAmount === "number" ? donateAmount : 0;
    if (!isFinite(m) || m <= 0) {
      alert("Ingresa un monto válido (> 0)");
      return;
    }
    try {
      setSavingDonate(true);
      await editarDonacionesSumando(donateItem.id, m);
      closeDonate();
      await load();
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e.message : "No se pudo actualizar donaciones";
      alert(errorMessage);
    } finally {
      setSavingDonate(false);
    }
  };

  // ===== Eliminar =====
  const onDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta galería? Esta acción no se puede deshacer."))
      return;
    try {
      await eliminarGaleria(id);
      await load();
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e.message : "No se pudo eliminar";
      alert(errorMessage);
    }
  };

  return (
    <Container size="xl" mt="xl">
      {/* Header */}
      <Group justify="space-between" align="end" mb="md">
        <div>
          <Title order={2}>Galería</Title>
          <Text c="dimmed" size="sm">
            Administra obras: crea, edita, suma donaciones y elimina
          </Text>
        </div>

        <Group>
          <TextInput
            placeholder="Buscar por nombre o descripción"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            style={{ minWidth: 280 }}
          />
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Nueva obra
          </Button>
          <Button
            variant="light"
            leftSection={<IconRefresh size={16} />}
            onClick={() => void load()}
          >
            Recargar
          </Button>
        </Group>
      </Group>

      {/* Tabla */}
      <Paper withBorder p="sm" radius="md">
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
                { value: "5", label: "5" },
                { value: "10", label: "10" },
                { value: "25", label: "25" },
                { value: "50", label: "50" },
              ]}
              w={90}
            />
          </Group>
        </Group>

        <Table highlightOnHover withRowBorders stickyHeader>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nombre</Table.Th>
              <Table.Th>Descripción</Table.Th>
              <Table.Th>Donaciones</Table.Th>
              <Table.Th>Creado</Table.Th>
              <Table.Th>Video</Table.Th>
              <Table.Th ta="center">Acciones</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {pageSlice.map((g) => (
              <Table.Tr key={g.id}>
                <Table.Td>{g.nombre}</Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed" lineClamp={2} maw={420}>
                    {g.descripcion}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge
                    variant="light"
                    leftSection={<IconCurrencyDollar size={14} />}
                  >
                    {g.donaciones.toLocaleString("es-CO")}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {formatDate(
                    (g as unknown as { createdAt?: FirestoreTimestamp })
                      .createdAt
                  )}
                </Table.Td>
                <Table.Td>
                  {g.videoURL ? (
                    <Button
                      component="a"
                      href={g.videoURL}
                      target="_blank"
                      rel="noreferrer"
                      size="xs"
                      variant="light"
                      leftSection={<IconPlayerPlay size={14} />}
                    >
                      Ver
                    </Button>
                  ) : (
                    <Text size="sm" c="dimmed">
                      —
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Group gap="xs" justify="center">
                    <ActionIcon
                      variant="subtle"
                      onClick={() => onOpenDonate(g)}
                      title="Sumar donación"
                    >
                      <IconCurrencyDollar size={18} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      onClick={() => openEdit(g)}
                      title="Editar"
                    >
                      <IconEdit size={18} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => onDelete(g.id)}
                      title="Eliminar"
                    >
                      <IconTrash size={18} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {pageSlice.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text c="dimmed" ta="center">
                    {loading ? "Cargando..." : error || "Sin resultados"}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>

        <Group justify="center" mt="sm">
          <Pagination
            value={page}
            onChange={setPage}
            total={totalPages}
            size="sm"
          />
        </Group>
      </Paper>

      {/* Modal Crear */}
      <Modal
        opened={createOpen}
        onClose={closeCreate}
        title="Nueva obra"
        centered
      >
        <Stack>
          <TextInput
            label="Nombre"
            value={newNombre}
            onChange={(e) => setNewNombre(e.currentTarget.value)}
            required
          />
          <Textarea
            label="Descripción"
            value={newDescripcion}
            onChange={(e) => setNewDescripcion(e.currentTarget.value)}
            minRows={3}
            required
          />

          <Divider label="Video .mp4" labelPosition="left" />
          <Group>
            <input ref={fileRef} type="file" accept="video/mp4" />
          </Group>

          <Group justify="end">
            <Button
              onClick={handleCreate}
              loading={creating}
              leftSection={<IconUpload size={16} />}
            >
              Crear
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal Editar */}
      <Modal opened={editOpen} onClose={closeEdit} title="Editar obra" centered>
        {editItem && (
          <Stack>
            <TextInput
              label="Nombre"
              value={editItem.nombre}
              onChange={(e) =>
                setEditItem({ ...editItem, nombre: e.currentTarget.value })
              }
            />
            <Textarea
              label="Descripción"
              value={editItem.descripcion}
              onChange={(e) =>
                setEditItem({ ...editItem, descripcion: e.currentTarget.value })
              }
              minRows={3}
            />

            <Divider
              label="Reemplazar video (.mp4) — opcional"
              labelPosition="left"
            />
            <input ref={editFileRef} type="file" accept="video/mp4" />

            <Group justify="end">
              <Button onClick={handleSaveEdit} loading={savingEdit}>
                Guardar
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Modal Donar */}
      <Modal
        opened={donateOpen}
        onClose={closeDonate}
        title="Sumar donación"
        centered
      >
        <Stack>
          <NumberInput
            label="Monto a sumar"
            value={donateAmount}
            onChange={(v) => setDonateAmount(typeof v === "number" ? v : 0)}
            min={1}
            thousandSeparator="."
            decimalSeparator=","
            placeholder="Ej: 5000"
            withAsterisk
          />
          <Group justify="end">
            <Button onClick={handleDonate} loading={savingDonate}>
              Aplicar
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
