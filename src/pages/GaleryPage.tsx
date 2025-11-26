// GalleryLanding.mantine.tsx
// Landing pública para mostrar una obra de la colección "galeria" por ID.
// Usa Mantine y el servicio firebase-galeria-service.
// Versión para React Router (useParams).

import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Anchor,
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
  Modal,
  TextInput,
} from "@mantine/core";
import {
  IconPlayerPlay,
  IconCheck,
  IconCopy,
  IconArrowLeft,
  IconCurrencyDollar,
  IconPhone,
} from "@tabler/icons-react";

import type { Galeria } from "../services/galeryService";
import {
  consultarGaleriaPorId,
  editarDonacionesSumando,
} from "../services/galeryService";
import { createDonacionByCelular } from "../services/transactionService";

export default function GalleryLanding() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [item, setItem] = useState<Galeria | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [donar, setDonar] = useState<number | "">(0);
  const [celular, setCelular] = useState("");
  const [modalOpened, setModalOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [donationSuccess, setDonationSuccess] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

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
    const celularTrimmed = celular.trim();

    // Validaciones en-modal (sin alert)
    if (!isFinite(m) || m <= 0) {
      setModalError("Ingresa un monto válido mayor a 0.");
      return;
    }

    if (!celularTrimmed) {
      setModalError("Por favor ingresa un número de celular.");
      return;
    }

    try {
      setSaving(true);
      setModalError(null);

      // 1. Crear la transacción de donación
      //    >>> Se envía también la referencia de la obra <<<
      const transaccion = await createDonacionByCelular({
        celular: celularTrimmed,
        monto: m,
        idObra: item.id,
        nombreObra: item.nombre,
      });

      // 2. Verificar resultado de la transacción
      if (transaccion.estado === "Fallido") {
        setModalError(
          transaccion.mensajeError ||
            "No se pudo procesar la donación (posible saldo insuficiente)."
        );
        return; // mantener el modal abierto mostrando el error
      }

      // 3. Actualizar el contador de donaciones en la galería
      const nuevo = await editarDonacionesSumando(item.id, m);
      setItem({ ...item, donaciones: nuevo });

      // 4. Mostrar mensaje de éxito
      setDonationSuccess(true);
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e.message : "No se pudo registrar la donación.";
      setModalError(errorMessage);
      console.error("Error al registrar donación:", e);
    } finally {
      setSaving(false);
    }
  }
  useEffect(() => {
  const savedPhone = localStorage.getItem("user_profile_celular");
  if (savedPhone) {
    setCelular(savedPhone);
  }
}, []);

  function openModal() {
    setModalError(null);
    setDonationSuccess(false);
    setModalOpened(true);
  }

  function closeModal() {
    setModalOpened(false);
    setDonationSuccess(false);
    setModalError(null);
    setDonar(0);
    setCelular("");
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
                  maxWidth: "800px",
                  margin: "0 auto",
                  aspectRatio: "16/9",
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
                    objectFit: "contain",
                    backgroundColor: "#000",
                  }}
                />
              </div>
            ) : (
              <Anchor href="#" target="_blank" rel="noreferrer">
                <Group gap="xs" align="center">
                  <IconPlayerPlay size={14} />
                  <span>Ver video</span>
                </Group>
              </Anchor>
            )}

            <Text>{item.descripcion}</Text>

            <Divider my="sm" />

            <Button
              onClick={openModal}
              leftSection={<IconCurrencyDollar size={16} />}
              size="md"
            >
              Apoyar esta obra
            </Button>
          </Stack>
        )}
      </Paper>

      {/* Modal de Donación */}
      <Modal
        opened={modalOpened}
        onClose={() => !saving && closeModal()}
        title={donationSuccess ? "¡Donación Exitosa!" : "Apoyar esta obra"}
        centered
      >
        <Stack gap="md">
          {donationSuccess ? (
            <>
              <Alert
                color="green"
                variant="light"
                title="¡Gracias por tu apoyo!"
              >
                Tu donación de{" "}
                <strong>
                  $
                  {typeof donar === "number"
                    ? donar.toLocaleString("es-CO")
                    : 0}{" "}
                  COP
                </strong>{" "}
                ha sido registrada exitosamente.
              </Alert>
              <Button onClick={closeModal} fullWidth>
                Cerrar
              </Button>
            </>
          ) : (
            <>
              {/* Errores visibles en el modal (incluye saldo insuficiente) */}
              {modalError && (
                <Alert color="red" variant="light" title="No se pudo completar">
                  {modalError}
                </Alert>
              )}

              <NumberInput
                label="Monto a donar"
                placeholder="Ingresa el monto en COP"
                value={donar}
                onChange={(v) => setDonar(typeof v === "number" ? v : 0)}
                min={1}
                thousandSeparator="."
                decimalSeparator=","
                leftSection={<IconCurrencyDollar size={16} />}
                required
                disabled={saving}
              />

              <TextInput
                label="Número de Celular"
                placeholder="Ej: 3001234567"
                value={celular}
                onChange={(e) => setCelular(e.currentTarget.value)}
                leftSection={<IconPhone size={16} />}
                required
                disabled={saving}
              />

              <Group justify="flex-end" mt="md">
                <Button variant="subtle" onClick={closeModal} disabled={saving}>
                  Cancelar
                </Button>
                <Button
                  onClick={applyDonation}
                  loading={saving}
                  leftSection={
                    !saving ? <IconCurrencyDollar size={16} /> : undefined
                  }
                >
                  Confirmar Donación
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Modal>
    </Container>
  );
}
