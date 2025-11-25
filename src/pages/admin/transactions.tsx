/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Container,
  Group,
  Pagination,
  Paper,
  Select,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import {
  type TransactionHistory,
  getAllTransactions,
} from "../../services/transactionService";

export default function TransactionsPage() {
  const [items, setItems] = useState<TransactionHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      try {
        const data = await getAllTransactions();
        setItems(data);
      } catch (error) {
        console.error("Error al cargar transacciones:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, []);

  const [query, setQuery] = useState("");
  const [q] = useDebouncedValue(query.trim().toLowerCase(), 250);

  const [tipoFilter, setTipoFilter] = useState<string | null>("TODOS");
  const [estadoFilter, setEstadoFilter] = useState<string | null>("TODOS");

  const filtered = useMemo(() => {
    let result = items;

    // Filtro por búsqueda (nombre usuario, celular, producto, experiencia/obra)
    if (q) {
      result = result.filter(
        (i) =>
          i.nombreUsuario.toLowerCase().includes(q) ||
          i.celular.includes(q) ||
          i.nombreProducto?.toLowerCase().includes(q) ||
          i.nombreExperiencia?.toLowerCase().includes(q)
      );
    }

    // Filtro por tipo
    if (tipoFilter && tipoFilter !== "TODOS") {
      result = result.filter((i) => i.tipoTransaccion === tipoFilter);
    }

    // Filtro por estado
    if (estadoFilter && estadoFilter !== "TODOS") {
      result = result.filter((i) => i.estado === estadoFilter);
    }

    return result;
  }, [items, q, tipoFilter, estadoFilter]);

  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [pageSize, q, tipoFilter, estadoFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSlice = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const formatDate = (timestamp: any) => {
    return timestamp.toDate().toLocaleString("es-CO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getBadgeColor = (tipo: string, estado: string) => {
    if (estado === "Fallido") return "red";
    // Verde/teal para RECARGA, naranja para DONACION/DESCUENTO (egresos)
    return tipo === "RECARGA" ? "green" : "orange";
  };

  return (
    <Container size="xl" mt="xl">
      <Group justify="space-between" mb="md">
        <div>
          <Title order={2}>Historial de Transacciones</Title>
          <Text c="dimmed" size="sm">
            Visualiza todas las transacciones del sistema
          </Text>
        </div>
      </Group>

      <Paper withBorder p="sm" radius="md" mb="md">
        <Group>
          <TextInput
            placeholder="Buscar por usuario, celular, producto u obra…"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
            style={{ flex: 1 }}
          />
          <Select
            placeholder="Tipo"
            value={tipoFilter}
            onChange={setTipoFilter}
            data={[
              { value: "TODOS", label: "Todos los tipos" },
              { value: "RECARGA", label: "Recarga" },
              { value: "DESCUENTO", label: "Descuento" },
              { value: "DONACION", label: "Donación" }, // ← añadido
            ]}
            w={180}
          />
          <Select
            placeholder="Estado"
            value={estadoFilter}
            onChange={setEstadoFilter}
            data={[
              { value: "TODOS", label: "Todos los estados" },
              { value: "Exitoso", label: "Exitoso" },
              { value: "Fallido", label: "Fallido" },
            ]}
            w={180}
          />
        </Group>
      </Paper>

      <Paper withBorder p="sm" radius="md">
        <Group justify="space-between" mb="sm">
          <Text size="sm" c="dimmed">
            {filtered.length} transacción(es)
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
                { value: "100", label: "100" },
              ]}
              w={90}
            />
          </Group>
        </Group>

        <Table highlightOnHover withRowBorders stickyHeader>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Fecha</Table.Th>
              <Table.Th>Usuario</Table.Th>
              <Table.Th>Celular</Table.Th>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>Producto/Experiencia/Obra</Table.Th>
              {/* ← renombrado */}
              <Table.Th>Valor</Table.Th>
              <Table.Th>Estado</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading ? (
              <Table.Tr>
                <Table.Td colSpan={7}>
                  <Text c="dimmed" ta="center">
                    Cargando...
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : pageSlice.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={7}>
                  <Text c="dimmed" ta="center">
                    Sin resultados
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              pageSlice.map((tx) => {
                // Mostrar nombre según tipo: RECARGA → experiencia, DONACION → obra (nombreExperiencia), DESCUENTO → producto
                const displayName =
                  tx.tipoTransaccion === "RECARGA"
                    ? tx.nombreExperiencia || "-"
                    : tx.tipoTransaccion === "DONACION"
                    ? tx.nombreExperiencia || "-" // ← obra
                    : tx.nombreProducto || "-";

                return (
                  <Table.Tr key={tx.id}>
                    <Table.Td>
                      <Text size="sm">{formatDate(tx.createdAt)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {tx.nombreUsuario || "-"}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{tx.celular}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        variant="light"
                        color={
                          getBadgeColor(tx.tipoTransaccion, tx.estado).includes(
                            "green"
                          )
                            ? "teal"
                            : "orange"
                        }
                      >
                        {tx.tipoTransaccion}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Tooltip label={displayName}>
                        <Text size="sm" lineClamp={1}>
                          {displayName}
                        </Text>
                      </Tooltip>
                    </Table.Td>
                    <Table.Td>
                      <Text
                        size="sm"
                        fw={600}
                        c={tx.tipoTransaccion === "RECARGA" ? "teal" : "orange"}
                      >
                        {tx.tipoTransaccion === "RECARGA" ? "+" : "-"}$
                        {tx.valor.toLocaleString()}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        variant="dot"
                        color={tx.estado === "Exitoso" ? "green" : "red"}
                      >
                        {tx.estado}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                );
              })
            )}
          </Table.Tbody>
        </Table>

        <Group justify="center" mt="sm">
          <Pagination value={page} onChange={setPage} total={totalPages} />
        </Group>
      </Paper>
    </Container>
  );
}
