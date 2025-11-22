import { useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
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
  Container,
} from "@mantine/core";
import { useDebouncedValue, useDisclosure } from "@mantine/hooks";
import { IconEdit, IconTrash, IconPlus } from "@tabler/icons-react";
import {
  type Experience,
  createExperience,
  deleteExperience,
  subscribeExperiences,
  updateExperience,
} from "../../services/experienceService";

export default function ExperiencesPage() {
  const [items, setItems] = useState<Experience[]>([]);
  useEffect(() => {
    const u = subscribeExperiences(setItems);
    return () => u();
  }, []);

  const [query, setQuery] = useState("");
  const [q] = useDebouncedValue(query.trim().toLowerCase(), 250);
  const filtered = useMemo(
    () =>
      !q ? items : items.filter((i) => i.nombre.toLowerCase().includes(q)),
    [items, q]
  );

  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [pageSize, q]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSlice = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const [createOpen, { open: openCreate, close: closeCreate }] =
    useDisclosure(false);
  const [newItem, setNewItem] = useState<{ nombre: string; valor: number }>({
    nombre: "",
    valor: 0,
  });
  const [creating, setCreating] = useState(false);
  const handleCreate = async () => {
    if (!newItem.nombre) return;
    setCreating(true);
    try {
      await createExperience(newItem);
      setNewItem({ nombre: "", valor: 0 });
      closeCreate();
    } finally {
      setCreating(false);
    }
  };

  const [editOpen, { open: openEdit, close: closeEdit }] = useDisclosure(false);
  const [editItem, setEditItem] = useState<Experience | null>(null);
  const onEdit = (e: Experience) => {
    setEditItem(e);
    openEdit();
  };
  const handleSaveEdit = async () => {
    if (!editItem) return;
    await updateExperience(editItem.id, {
      nombre: editItem.nombre,
      valor: editItem.valor,
    });
    closeEdit();
  };

  const onDelete = async (id: string) => {
    if (!confirm("¿Eliminar experiencia?")) return;
    await deleteExperience(id);
  };

  return (
    <Container size="xl" mt="xl">
      <Group justify="space-between" mb="md">
        <div>
          <Title order={2}>Experiencias</Title>
          <Text c="dimmed" size="sm">
            Gestiona el catálogo de experiencias
          </Text>
        </div>
        <Group>
          <TextInput
            placeholder="Buscar por nombre"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Nueva
          </Button>
        </Group>
      </Group>

      <Paper withBorder p="sm" radius="md">
        <Group justify="space-between" mb="sm">
          <Text size="sm" c="dimmed">
            {filtered.length} resultado(s)
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
              <Table.Th ta="center">Acciones</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {pageSlice.map((e) => (
              <Table.Tr key={e.id}>
                <Table.Td>{e.nombre}</Table.Td>
                <Table.Td>
                  <Badge variant="light">{e.valor}</Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs" justify="center">
                    <ActionIcon
                      variant="subtle"
                      onClick={() => onEdit(e)}
                      aria-label="Editar"
                    >
                      <IconEdit size={18} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => onDelete(e.id)}
                      aria-label="Eliminar"
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
          <Pagination value={page} onChange={setPage} total={totalPages} />
        </Group>
      </Paper>

      <Modal
        opened={createOpen}
        onClose={closeCreate}
        title="Nueva experiencia"
        centered
      >
        <Stack>
          <TextInput
            label="Nombre"
            value={newItem.nombre}
            onChange={(e) =>
              setNewItem({ ...newItem, nombre: e.currentTarget.value })
            }
            required
          />
          <NumberInput
            label="Valor"
            value={newItem.valor}
            onChange={(v) => setNewItem({ ...newItem, valor: Number(v ?? 0) })}
            min={0}
          />
          <Group justify="end">
            <Button onClick={handleCreate} loading={creating}>
              Crear
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={editOpen}
        onClose={closeEdit}
        title="Editar experiencia"
        centered
      >
        {editItem && (
          <Stack>
            <TextInput
              label="Nombre"
              value={editItem.nombre}
              onChange={(e) =>
                setEditItem({ ...editItem!, nombre: e.currentTarget.value })
              }
            />
            <NumberInput
              label="Valor"
              value={editItem.valor}
              onChange={(v) =>
                setEditItem({ ...editItem!, valor: Number(v ?? 0) })
              }
              min={0}
            />
            <Group justify="end">
              <Button onClick={handleSaveEdit}>Guardar</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Container>
  );
}
