// GalleryLanding.mantine.tsx
// Landing pública para mostrar una obra de la colección "galeria" por ID.
// Usa Mantine y el servicio firebase-galeria-service.
// Versión para React Router (useParams).

import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Anchor,
  Badge,
  Button,
  Container,
  Group,
  Loader,
  NumberInput,
  Paper,
  Stack,
  Text,
  Title,
  Divider,
  Alert,
  CopyButton,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import {
  IconPlayerPlay,
  IconCheck,
  IconCopy,
  IconArrowLeft,
  IconCurrencyDollar,
} from "@tabler/icons-react";

import type { Galeria } from "../services/galeryService";
import {
  consultarGaleriaPorId,
  editarDonacionesSumando,
} from "../services/galeryService";

export default function GalleryLanding() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [item, setItem] = useState<Galeria | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [donar, setDonar] = useState<number | "">(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id) {
        setError("ID no proporcionado");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const g = await consultarGaleriaPorId(id);
        if (!g) {
          setError("No se encontró la obra");
          setItem(null);
        } else {
          setItem(g);
        }
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "Error al cargar";
        setError(errorMessage);
        console.error("Error al cargar galería:", e);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id]);

  const pageURL = useMemo(() => {
    if (typeof window !== "undefined") return window.location.href;
    return "";
  }, []);

  async function applyDonation() {
    if (!item) return;
    const m = typeof donar === "number" ? donar : 0;
    if (!isFinite(m) || m <= 0) {
      alert("Ingresa un monto válido (> 0)");
      return;
    }
    try {
      setSaving(true);
      const nuevo = await editarDonacionesSumando(item.id, m);
      setItem({ ...item, donaciones: nuevo });
      setDonar(0);
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e.message : "No se pudo registrar la donación";
      alert(errorMessage);
      console.error("Error al registrar donación:", e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Container size="md" py="xl">
      <Group justify="space-between" mb="md">
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate(-1)}
        >
          Volver
        </Button>
        {pageURL && (
          <CopyButton value={pageURL} timeout={1500}>
            {({ copied, copy }) => (
              <Tooltip label={copied ? "Copiado" : "Copiar enlace"} withArrow>
                <ActionIcon
                  onClick={copy}
                  variant={copied ? "filled" : "light"}
                  color={copied ? "teal" : undefined}
                >
                  {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                </ActionIcon>
              </Tooltip>
            )}
          </CopyButton>
        )}
      </Group>

      <Paper withBorder radius="lg" p="lg">
        {loading ? (
          <Stack align="center" py="xl">
            <Loader />
            <Text c="dimmed">Cargando obra…</Text>
          </Stack>
        ) : error ? (
          <Alert color="red" title="Error" variant="light">
            {error}
          </Alert>
        ) : !item ? (
          <Alert color="yellow" title="No encontrada" variant="light">
            No encontramos la obra solicitada.
          </Alert>
        ) : (
          <Stack gap="md">
            <Title order={2}>{item.nombre}</Title>
            <Text c="dimmed" fw={500}>
              ID: <code>{item.id}</code>
            </Text>

            {/* Video */}
            {item.videoURL ? (
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  overflow: "hidden",
                  borderRadius: "12px",
                  border: "1px solid #dee2e6",
                }}
              >
                <video
                  src={item.videoURL}
                  controls
                  playsInline
                  style={{
                    height: "100%",
                    width: "100%",
                    display: "block",
                  }}
                />
              </div>
            ) : (
              <Anchor
                href="#"
                target="_blank"
                rel="noreferrer"
              >
                <Group gap="xs" align="center">
                  <IconPlayerPlay size={14} />
                  <span>Ver video</span>
                </Group>
              </Anchor>
            )}

            <Text>{item.descripcion}</Text>

            <Group>
              <Badge
                size="lg"
                variant="light"
                leftSection={<IconCurrencyDollar size={14} />}
              >
                Donaciones: {item.donaciones.toLocaleString("es-CO")}
              </Badge>
            </Group>

            <Divider my="sm" />

            <Group align="end">
              <NumberInput
                label="Apoyar esta obra"
                placeholder="Monto en COP"
                value={donar}
                onChange={(v) => setDonar(typeof v === "number" ? v : 0)}
                min={1}
                thousandSeparator="."
                decimalSeparator=","
                maw={220}
              />
              <Button
                onClick={applyDonation}
                loading={saving}
                leftSection={<IconCurrencyDollar size={16} />}
              >
                Donar
              </Button>
            </Group>
          </Stack>
        )}
      </Paper>
    </Container>
  );
}
