import { useEffect, useState } from "react";
import {
  Button,
  Container,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  Alert,
  Loader,
  Badge,
  Paper,
} from "@mantine/core";
import {
  IconShoppingCart,
  IconCurrencyDollar,
  IconCheck,
  IconAlertCircle,
} from "@tabler/icons-react";
import { type Product, subscribeProducts } from "../services/productService";
import {
  createDescuentoByCelular,
  formatTransactionForList,
} from "../services/transactionService";

export default function BarmanPage() {
  const [celular, setCelular] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    title: string;
    message: string;
    color: "red" | "green";
  } | null>(null);

  useEffect(() => {
    const unsub = subscribeProducts((items) => {
      setProducts(items);
      setLoadingList(false);
    });
    return () => unsub();
  }, []);

  const onSubmit = async () => {
    setResult(null);
    if (!celular || !productId) {
      setResult({
        ok: false,
        title: "Faltan datos",
        message: "Ingresa el celular y selecciona un producto.",
        color: "red",
      });
      return;
    }
    try {
      setSubmitting(true);
      const tx = await createDescuentoByCelular({
        celular,
        idProducto: productId,
      });
      const fmt = formatTransactionForList(tx);
      setResult({
        ok: tx.estado === "Exitoso",
        title: fmt.subtitulo,
        message: fmt.detalle,
        color: fmt.color,
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      setResult({
        ok: false,
        title: "Error",
        message: "No se pudo procesar la transacción.",
        color: "red",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container size="sm" mt="xl">
      <Title order={2} mb="xs">
        Vista Barman
      </Title>
      <Text c="dimmed" mb="lg">
        Descuento de saldo por producto
      </Text>

      <Stack gap="md">
        <TextInput
          label="Celular del usuario"
          placeholder="3101234567"
          value={celular}
          onChange={(e) => setCelular(e.currentTarget.value)}
          leftSection={<IconCurrencyDollar size={16} />}
        />

        <div>
          <Group mb={6} justify="space-between">
            <Text fw={500}>Producto</Text>
            {loadingList && <Loader size="xs" />}
          </Group>
          <Select
            placeholder="Selecciona un producto"
            data={products.map((p) => ({
              value: p.id,
              label: `${p.nombre} ( ${p.valor} )`,
            }))}
            value={productId}
            onChange={setProductId}
            leftSection={<IconShoppingCart size={16} />}
            searchable
            nothingFoundMessage="Sin productos"
          />
        </div>

        <Group>
          <Button
            onClick={onSubmit}
            loading={submitting}
            disabled={loadingList}
          >
            Descontar saldo
          </Button>
        </Group>

        {result && (
          <Alert
            color={result.color}
            title={result.ok ? "Transacción realizada" : "Transacción fallida"}
            icon={result.ok ? <IconCheck /> : <IconAlertCircle />}
          >
            <Paper p="xs" withBorder radius="md">
              <Text fw={600}>{result.title}</Text>
              <Text size="sm" style={{ whiteSpace: "pre-line" }}>
                {result.message}
              </Text>
              <Group gap="xs" mt="xs">
                <Badge variant="light" color={result.color}>
                  {result.ok ? "Exitoso" : "Fallido"}
                </Badge>
              </Group>
            </Paper>
          </Alert>
        )}
      </Stack>
    </Container>
  );
}
