import { useState, useEffect } from "react";
import { Button, Text, Stack, Alert, Group, Loader } from "@mantine/core";
import { IconNfc, IconNfcOff, IconAlertCircle } from "@tabler/icons-react";

interface NFCReaderProps {
  onCelularRead: (celular: string) => void;
  disabled?: boolean;
}

export function NFCReader({ onCelularRead, disabled = false }: NFCReaderProps) {
  const [nfcSupported, setNfcSupported] = useState<boolean | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Verificar si el navegador soporta Web NFC API
    if ("NDEFReader" in window) {
      setNfcSupported(true);
    } else {
      setNfcSupported(false);
    }
  }, []);

  const readNFC = async () => {
    setError(null);
    setScanning(true);

    try {
      // @ts-ignore - Web NFC API puede no estar en los tipos
      const ndef = new NDEFReader();
      
      // Solicitar permiso y comenzar a escanear
      await ndef.scan();
      
      console.log("Esperando tag NFC...");

      // @ts-ignore
      ndef.addEventListener("reading", ({ message, serialNumber }) => {
        console.log(`Tag detectado. Serial: ${serialNumber}`);
        console.log(`Número de records: ${message.records.length}`);
        
        try {
          // Leer los registros del mensaje NDEF
          for (const record of message.records) {
            console.log("Record completo:", {
              recordType: record.recordType,
              mediaType: record.mediaType,
              encoding: record.encoding,
              lang: record.lang,
              data: new Uint8Array(record.data)
            });
            
            // Si es un registro de texto
            if (record.recordType === "text") {
              // El Web NFC API automáticamente maneja el status byte y el language code
              // Solo necesitamos decodificar el data
              const textDecoder = new TextDecoder(record.encoding || "utf-8");
              const celular = textDecoder.decode(record.data);
              console.log("Celular leído (text record):", celular);
              
              onCelularRead(celular.trim());
              setScanning(false);
              return;
            }
            
            // Si es un registro mime o unknown, intentar decodificar directamente
            if (record.recordType === "mime" || record.recordType === "unknown") {
              const textDecoder = new TextDecoder("utf-8");
              const celular = textDecoder.decode(record.data);
              console.log("Celular leído (mime/unknown):", celular);
              
              onCelularRead(celular.trim());
              setScanning(false);
              return;
            }
          }

          // Si no se encontró el formato esperado, intentar leer datos raw
          if (message.records.length > 0) {
            const firstRecord = message.records[0];
            const dataArray = new Uint8Array(firstRecord.data);
            console.log("Data raw bytes:", Array.from(dataArray));
            
            // Intentar decodificar como UTF-8
            const textDecoder = new TextDecoder("utf-8");
            const rawData = textDecoder.decode(firstRecord.data);
            console.log("Data raw decodificado:", rawData);
            
            // Si los primeros bytes parecen ser control bytes, saltarlos
            // El status byte del Text Record está en la posición 0
            let cleanData = rawData;
            
            // Si el primer byte no es ASCII imprimible, intentar saltarlo
            if (rawData.length > 0 && (rawData.charCodeAt(0) < 32 || rawData.charCodeAt(0) > 126)) {
              cleanData = rawData.substring(1);
              console.log("Data sin status byte:", cleanData);
            }
            
            // Extraer solo números del texto
            const celular = cleanData.replace(/[^\d]/g, "");
            console.log("Números extraídos:", celular);
            
            if (celular.length >= 10) {
              onCelularRead(celular);
              setScanning(false);
              return;
            }
          }

          setError("No se encontró número de celular en el tag");
          setScanning(false);
          
        } catch (err) {
          console.error("Error procesando tag:", err);
          setError("Error al leer los datos del tag");
          setScanning(false);
        }
      });

      // @ts-ignore
      ndef.addEventListener("readingerror", () => {
        console.error("Error al leer el tag NFC");
        setError("No se pudo leer el tag. Inténtalo de nuevo.");
        setScanning(false);
      });

    } catch (err: any) {
      console.error("Error NFC:", err);
      
      if (err.name === "NotAllowedError") {
        setError("Permiso denegado. Permite el acceso a NFC.");
      } else if (err.name === "NotSupportedError") {
        setError("NFC no está soportado en este dispositivo.");
        setNfcSupported(false);
      } else {
        setError("Error al iniciar lectura NFC: " + err.message);
      }
      
      setScanning(false);
    }
  };

  const cancelScan = () => {
    setScanning(false);
    setError(null);
  };

  // Si NFC no está soportado, no mostrar nada
  if (nfcSupported === false) {
    return null;
  }

  // Si aún estamos verificando soporte
  if (nfcSupported === null) {
    return null;
  }

  return (
    <Stack gap="xs">
      {!scanning ? (
        <Button
          onClick={readNFC}
          disabled={disabled}
          leftSection={<IconNfc size={18} />}
          variant="light"
          fullWidth
        >
          Leer celular con NFC
        </Button>
      ) : (
        <Alert
          color="blue"
          title="Esperando tag NFC..."
          icon={<Loader size="sm" />}
        >
          <Stack gap="sm">
            <Text size="sm">
              Acerca el tag NTAG216 al dispositivo para leer el número de
              celular.
            </Text>
            <Button
              onClick={cancelScan}
              variant="subtle"
              size="xs"
              leftSection={<IconNfcOff size={16} />}
            >
              Cancelar
            </Button>
          </Stack>
        </Alert>
      )}

      {error && (
        <Alert
          color="red"
          title="Error NFC"
          icon={<IconAlertCircle />}
          withCloseButton
          onClose={() => setError(null)}
        >
          <Text size="sm">{error}</Text>
        </Alert>
      )}
    </Stack>
  );
}