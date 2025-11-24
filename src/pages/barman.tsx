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
  Divider,
  Card,
  SimpleGrid,
} from "@mantine/core";
import {
  IconShoppingCart,
  IconCurrencyDollar,
  IconCheck,
  IconAlertCircle,
  IconBeer,
  IconShirt,
  IconPackage,
} from "@tabler/icons-react";
import { type Product, subscribeProducts } from "../services/productService";
import {
  createDescuentoByCelular,
  formatTransactionForList,
} from "../services/transactionService";
import { NFCReader } from "../components/NFCReader";

const TIPO_STORAGE_KEY = "barman_tipo_seleccionado";

export default function BarmanPage() {
  const [celular, setCelular] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState<string>("1");
  const [loadingList, setLoadingList] = useState(true);
  const [tipoSeleccionado, setTipoSeleccionado] = useState<"BAR" | "MERCH" | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    title: string;
    message: string;
    color: "red" | "green";
  } | null>(null);

  // Cargar tipo seleccionado del localStorage al montar
  useEffect(() => {
    const tipoGuardado = localStorage.getItem(TIPO_STORAGE_KEY);
    if (tipoGuardado === "BAR" || tipoGuardado === "MERCH") {
      setTipoSeleccionado(tipoGuardado);
    }
  }, []);

  useEffect(() => {
    const unsub = subscribeProducts((items) => {
      setProducts(items);
      setLoadingList(false);
    });
    return () => unsub();
  }, []);

  const handleNFCRead = (celularFromNFC: string) => {
    console.log("Celular desde NFC:", celularFromNFC);
    setCelular(celularFromNFC);
    
    setResult({
      ok: true,
      title: "NFC leído exitosamente",
      message: `Celular detectado: ${celularFromNFC}`,
      color: "green",
    });

    setTimeout(() => {
      setResult(null);
    }, 3000);
  };

  const handleTipoSelect = (tipo: "BAR" | "MERCH") => {
    setTipoSeleccionado(tipo);
    localStorage.setItem(TIPO_STORAGE_KEY, tipo);
    setProductId(null); // Limpiar producto seleccionado al cambiar tipo
    setCantidad("1"); // Resetear cantidad
  };

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

    const cantidadNum = parseInt(cantidad, 10);
    if (isNaN(cantidadNum) || cantidadNum < 1) {
      setResult({
        ok: false,
        title: "Cantidad inválida",
        message: "La cantidad debe ser al menos 1.",
        color: "red",
      });
      return;
    }

    try {
      setSubmitting(true);
      
      // Procesar múltiples transacciones según la cantidad
      let exitosas = 0;
      let fallidas = 0;
      let ultimaTx = null;

      for (let i = 0; i < cantidadNum; i++) {
        const tx = await createDescuentoByCelular({
          celular,
          idProducto: productId,
        });
        ultimaTx = tx;
        
        if (tx.estado === "Exitoso") {
          exitosas++;
        } else {
          fallidas++;
          // Si falla una transacción, detener el proceso
          break;
        }
      }

      if (ultimaTx) {
        const fmt = formatTransactionForList(ultimaTx);
        
        if (cantidadNum > 1) {
          // Mensaje para múltiples items
          setResult({
            ok: exitosas > 0,
            title: fallidas > 0 ? "Transacción parcial" : "Transacciones exitosas",
            message: `Procesadas ${exitosas} de ${cantidadNum} unidades.\n${fmt.detalle}`,
            color: fallidas > 0 ? "red" : "green",
          });
        } else {
          // Mensaje para un solo item
          setResult({
            ok: ultimaTx.estado === "Exitoso",
            title: fmt.subtitulo,
            message: fmt.detalle,
            color: ultimaTx.estado === "Exitoso" ? "green" : "red",
          });
        }

        if (exitosas > 0) {
          setTimeout(() => {
            setCelular("");
            setProductId(null);
            setCantidad("1");
          }, 2000);
        }
      }
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

  // Filtrar productos por tipo seleccionado
  const productosFiltrados = products.filter(
    (p) => p.tipo === tipoSeleccionado
  );

  return (
    <Container size="sm" mt="xl">
      <Title order={2} mb="xs">
        Vista Barman
      </Title>
      <Text c="dimmed" mb="lg">
        Descuento de saldo por producto
      </Text>

      <Stack gap="md">
        {/* Selección de tipo BAR o MERCH */}
        <div>
          <Text fw={500} mb="xs">
            Selecciona el tipo de punto de venta
          </Text>
          <SimpleGrid cols={2} spacing="md">
            <Card
              padding="lg"
              radius="md"
              withBorder
              style={{
                cursor: "pointer",
                borderColor: tipoSeleccionado === "BAR" ? "var(--mantine-color-blue-6)" : undefined,
                borderWidth: tipoSeleccionado === "BAR" ? 2 : 1,
                backgroundColor: tipoSeleccionado === "BAR" ? "var(--mantine-color-blue-0)" : undefined,
              }}
              onClick={() => handleTipoSelect("BAR")}
            >
              <Stack align="center" gap="xs">
                <IconBeer size={40} stroke={1.5} />
                <Text fw={600} size="lg">
                  BAR
                </Text>
                {tipoSeleccionado === "BAR" && (
                  <Badge color="blue" variant="filled">
                    Seleccionado
                  </Badge>
                )}
              </Stack>
            </Card>

            <Card
              padding="lg"
              radius="md"
              withBorder
              style={{
                cursor: "pointer",
                borderColor: tipoSeleccionado === "MERCH" ? "var(--mantine-color-green-6)" : undefined,
                borderWidth: tipoSeleccionado === "MERCH" ? 2 : 1,
                backgroundColor: tipoSeleccionado === "MERCH" ? "var(--mantine-color-green-0)" : undefined,
              }}
              onClick={() => handleTipoSelect("MERCH")}
            >
              <Stack align="center" gap="xs">
                <IconShirt size={40} stroke={1.5} />
                <Text fw={600} size="lg">
                  MERCH
                </Text>
                {tipoSeleccionado === "MERCH" && (
                  <Badge color="green" variant="filled">
                    Seleccionado
                  </Badge>
                )}
              </Stack>
            </Card>
          </SimpleGrid>
        </div>

        {tipoSeleccionado && (
          <>
            <Divider />

            {/* Lector NFC */}
            <NFCReader 
              onCelularRead={handleNFCRead} 
              disabled={submitting}
            />

            <Divider 
              label="o ingresa manualmente" 
              labelPosition="center"
            />

            {/* Input manual de celular */}
            <TextInput
              label="Celular del usuario"
              placeholder="3101234567"
              value={celular}
              onChange={(e) => setCelular(e.currentTarget.value)}
              leftSection={<IconCurrencyDollar size={16} />}
              disabled={submitting}
            />

            <div>
              <Group mb={6} justify="space-between">
                <Text fw={500}>Producto ({tipoSeleccionado})</Text>
                {loadingList && <Loader size="xs" />}
              </Group>
              <Select
                placeholder="Selecciona un producto"
                data={productosFiltrados.map((p) => ({
                  value: p.id,
                  label: `${p.nombre} ($${p.valor.toLocaleString()})`,
                }))}
                value={productId}
                onChange={(val) => {
                  setProductId(val);
                  setCantidad("1"); // Resetear cantidad al cambiar producto
                }}
                leftSection={<IconShoppingCart size={16} />}
                searchable
                nothingFoundMessage={`Sin productos de tipo ${tipoSeleccionado}`}
                disabled={submitting}
              />
            </div>

            {/* Selector de cantidad */}
            <div>
              <Text fw={500} mb={6}>
                Cantidad
              </Text>
              <Select
                value={cantidad}
                onChange={(val) => setCantidad(val || "1")}
                data={[
                  { value: "1", label: "1 unidad" },
                  { value: "2", label: "2 unidades" },
                  { value: "3", label: "3 unidades" },
                  { value: "4", label: "4 unidades" },
                  { value: "5", label: "5 unidades" },
                ]}
                leftSection={<IconPackage size={16} />}
                disabled={submitting || !productId}
              />
            </div>

            <Group>
              <Button
                onClick={onSubmit}
                loading={submitting}
                disabled={loadingList || !celular || !productId}
              >
                Descontar saldo ({cantidad} {parseInt(cantidad) === 1 ? "unidad" : "unidades"})
              </Button>
            </Group>

            {result && (
              <Alert
                color={result.ok ? "green" : "red"}
                title={result.ok ? "Transacción realizada" : "Transacción fallida"}
                icon={result.ok ? <IconCheck /> : <IconAlertCircle />}
              >
                <Paper p="xs" withBorder radius="md">
                  <Text fw={600}>{result.title}</Text>
                  <Text size="sm" style={{ whiteSpace: "pre-line" }}>
                    {result.message}
                  </Text>
                  <Group gap="xs" mt="xs">
                    <Badge variant="light" color={result.ok ? "green" : "red"}>
                      {result.ok ? "Exitoso" : "Fallido"}
                    </Badge>
                  </Group>
                </Paper>
              </Alert>
            )}
          </>
        )}
      </Stack>
    </Container>
  );
}