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
  IconTicket,
  IconCash,
  IconCheck,
  IconAlertCircle,
} from "@tabler/icons-react";
import {
  type Experience,
  subscribeExperiences,
} from "../services/experienceService";
import {
  createRecargaByCelular,
  formatTransactionForList,
} from "../services/transactionService";

export default function HostPage() {
  const [celular, setCelular] = useState("");
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [experienceId, setExperienceId] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    title: string;
    message: string;
    color: "red" | "green";
  } | null>(null);

  useEffect(() => {
    const unsub = subscribeExperiences((items) => {
      setExperiences(items);
      setLoadingList(false);
    });
    return () => unsub();
  }, []);

  const onSubmit = async () => {
    setResult(null);
    if (!celular || !experienceId) {
      setResult({
        ok: false,
        title: "Faltan datos",
        message: "Ingresa el celular y selecciona una experiencia.",
        color: "red",
      });
      return;
    }
    try {
      setSubmitting(true);
      const tx = await createRecargaByCelular({
        celular,
        idExperiencia: experienceId,
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
        Vista Host / Cliente
      </Title>
      <Text c="dimmed" mb="lg">
        Recarga de saldo por experiencia
      </Text>

      <Stack gap="md">
        <TextInput
          label="Celular del usuario"
          placeholder="3101234567"
          value={celular}
          onChange={(e) => setCelular(e.currentTarget.value)}
          leftSection={<IconCash size={16} />}
        />

        <div>
          <Group mb={6} justify="space-between">
            <Text fw={500}>Experiencia</Text>
            {loadingList && <Loader size="xs" />}
          </Group>
          <Select
            placeholder="Selecciona una experiencia"
            data={experiences.map((e) => ({
              value: e.id,
              label: `${e.nombre} ( ${e.valor} )`,
            }))}
            value={experienceId}
            onChange={setExperienceId}
            leftSection={<IconTicket size={16} />}
            searchable
            nothingFoundMessage="Sin experiencias"
          />
        </div>

        <Group>
          <Button
            onClick={onSubmit}
            loading={submitting}
            disabled={loadingList}
          >
            Recargar saldo
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
