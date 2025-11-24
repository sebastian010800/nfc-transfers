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
} from "@mantine/core";
import { useDebouncedValue, useDisclosure } from "@mantine/hooks";
import {
  IconEdit,
  IconTrash,
  IconPlus,
  IconUpload,
  IconDownload,
} from "@tabler/icons-react";
import {
  type Product,
  createProduct,
  deleteProduct,
  subscribeProducts,
  updateProduct,
} from "../../services/productService";

import { parseXlsxSafely } from "../../hooks/useSafeXlsx";
import type { CellValue } from "../../hooks/useSafeXlsx";

const TEMPLATE_URL = "/plantilla_productos.xlsx"; // Asegúrate de crear esta plantilla

type BulkRow = { nombre: string; valor: number, tipo: string };
type BulkError = { row: number; reason: string };

export default function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  useEffect(() => {
    const u = subscribeProducts(setItems);
    return () => u();
  }, []);

  // search
  const [query, setQuery] = useState("");
  const [q] = useDebouncedValue(query.trim().toLowerCase(), 250);
  const filtered = useMemo(
    () =>
      !q ? items : items.filter((i) => i.nombre.toLowerCase().includes(q)),
    [items, q]
  );

  // pagination
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [pageSize, q]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSlice = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  // create modal
  const [createOpen, { open: openCreate, close: closeCreate }] =
    useDisclosure(false);
  const [newItem, setNewItem] = useState<{ nombre: string; valor: number, tipo: string }>({
    nombre: "",
    valor: 0,
    tipo: "BAR",
  });
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newItem.nombre) return;
    setCreating(true);
    try {
      await createProduct(newItem);
      setNewItem({ nombre: "", valor: 0 , tipo: "BAR"});
      closeCreate();
    } finally {
      setCreating(false);
    }
  };

  // edit modal
  const [editOpen, { open: openEdit, close: closeEdit }] = useDisclosure(false);
  const [editItem, setEditItem] = useState<Product | null>(null);

  const onEdit = (p: Product) => {
    setEditItem(p);
    openEdit();
  };

  const handleSaveEdit = async () => {
    if (!editItem) return;
    await updateProduct(editItem.id, {
      nombre: editItem.nombre,
      valor: editItem.valor,
    });
    closeEdit();
  };

  const onDelete = async (id: string) => {
    if (!confirm("¿Eliminar producto?")) return;
    await deleteProduct(id);
  };

  // ======== BULK UPLOAD ========
  const [bulkOpened, { open: openBulk, close: closeBulk }] = useDisclosure(false);
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
      const nombre = String(r["nombre"] ?? "").trim();
      const tipo = String(r["nombre"] ?? "").trim();
      const valorRaw = r["valor"] ?? r["precio"];
      const valor = valorRaw == null || valorRaw === "" ? 0 : Number(valorRaw);

      if (!nombre) {
        errors.push({ row: rowNum, reason: "Nombre requerido" });
      }
      if (isNaN(valor) || valor < 0) {
        errors.push({ row: rowNum, reason: "Valor inválido (debe ser número ≥ 0)" });
      }
      if (!tipo) {
        errors.push({ row: rowNum, reason: "Tipo requerido" });
      }
      if (nombre && !isNaN(valor) && valor >= 0) {
        parsed.push({ nombre, valor, tipo });
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
    if (bulkRows.length === 0) return;
    setProcessingBulk(true);

    let okCount = 0;
    const errors: BulkError[] = [];

    for (let i = 0; i < bulkRows.length; i++) {
      const row = bulkRows[i];
      const rowNum = i + 2;
      try {
        await createProduct(row);
        okCount++;
      } catch (err) {
        errors.push({ row: rowNum, reason: "Error al crear (posible duplicado o fallo de red)" });
      }
    }

    setBulkReport((prev) => ({
      ...prev,
      okCount,
      errorCount: errors.length,
      errors: [...prev.errors, ...errors],
    }));

    setProcessingBulk(false);

    if (okCount > 0) {
      // Opcional: cerrar modal si todo salió bien o casi todo
      // closeBulk();
    }
  };

  return (
    <Container size="xl" mt="xl">
      {/* Header */}
      <Group justify="space-between" align="end" mb="md">
        <div>
          <Title order={2}>Productos</Title>
          <Text c="dimmed" size="sm">
            Gestiona el catálogo de productos
          </Text>
        </div>

        <Group>
          <TextInput
            placeholder="Buscar por nombre"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            style={{ minWidth: 280 }}
          />
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Nuevo
          </Button>
          <Button
            variant="light"
            leftSection={<IconUpload size={16} />}
            onClick={openBulk}
          >
            Carga masiva
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
              <Table.Th>Valor</Table.Th>
              <Table.Th>Tipo</Table.Th>
              <Table.Th ta="center">Acciones</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {pageSlice.map((p) => (
              <Table.Tr key={p.id}>
                <Table.Td>{p.nombre}</Table.Td>
                <Table.Td>
                  <Badge variant="light">${p.valor.toLocaleString("es-CO")}</Badge>
                </Table.Td>
                <Table.Td>{p.tipo}</Table.Td>
                <Table.Td>
                  <Group gap="xs" justify="center">
                    <ActionIcon variant="subtle" onClick={() => onEdit(p)}>
                      <IconEdit size={18} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => onDelete(p.id)}
                    >
                      <IconTrash size={18} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {pageSlice.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={3}>
                  <Text c="dimmed" ta="center">
                    Sin resultados
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>

        <Group justify="center" mt="sm">
          <Pagination value={page} onChange={setPage} total={totalPages} size="sm" />
        </Group>
      </Paper>

      {/* Modal Crear */}
      <Modal opened={createOpen} onClose={closeCreate} title="Nuevo producto" centered>
        <Stack>
          <TextInput
            label="Nombre"
            value={newItem.nombre}
            onChange={(e) => setNewItem({ ...newItem, nombre: e.currentTarget.value })}
            required
          />
          <NumberInput
            label="Valor"
            value={newItem.valor}
            onChange={(v) => setNewItem({ ...newItem, valor: Number(v ?? 0) })}
            min={0}
            thousandSeparator="."
            decimalSeparator=","
          />
        <Select
  label="Tipo"
  value={newItem.tipo}
  onChange={(value) => setNewItem({ ...newItem, tipo: value || '' })}
  data={['BAR', 'MERCH']}
  required
/>
          <Group justify="end">
            <Button onClick={handleCreate} loading={creating}>
              Crear
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal Editar */}
      <Modal opened={editOpen} onClose={closeEdit} title="Editar producto" centered>
        {editItem && (
          <Stack>
            <TextInput
              label="Nombre"
              value={editItem.nombre}
              onChange={(e) => setEditItem({ ...editItem, nombre: e.currentTarget.value })}
            />
            <NumberInput
              label="Valor"
              value={editItem.valor}
              onChange={(v) => setEditItem({ ...editItem, valor: Number(v ?? 0) })}
              min={0}
              thousandSeparator="."
              decimalSeparator=","
            />
            <Group justify="end">
              <Button onClick={handleSaveEdit}>Guardar</Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Modal Carga Masiva */}
      <Modal
        opened={bulkOpened}
        onClose={() => {
          setBulkRows([]);
          setBulkReport({ okCount: 0, errorCount: 0, errors: [] });
          closeBulk();
        }}
        title="Carga masiva de productos"
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
              variant="light"
              leftSection={<IconDownload size={16} />}
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
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0] || null;
                  if (file) void parseExcel(file);
                };
                input.click();
              }}
            >
              Seleccionar archivo
            </Button>
          </Group>

          <Divider />

          <Stack gap={4}>
            <Text size="sm" fw={600}>
              Resumen del archivo
            </Text>
            <Text size="sm">Válidos: <strong>{bulkReport.okCount}</strong></Text>
            <Text size="sm">Con errores: <strong>{bulkReport.errorCount}</strong></Text>

            {bulkReport.errors.length > 0 && (
              <>
                {bulkReport.errors.slice(0, 20).map((e, i) => (
                  <Text key={i} size="xs" c="red">
                    Fila {e.row}: {e.reason}
                  </Text>
                ))}
                {bulkReport.errors.length > 20 && (
                  <Text size="xs" c="dimmed">
                    ... y {bulkReport.errors.length - 20} errores más
                  </Text>
                )}
              </>
            )}
          </Stack>

          <Group justify="end" mt="md">
            <Button
              onClick={processBulkCreate}
              disabled={bulkRows.length === 0}
              loading={processingBulk}
              color="green"
            >
              {processingBulk
                ? "Procesando..."
                : `Crear ${bulkRows.length} productos`}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}