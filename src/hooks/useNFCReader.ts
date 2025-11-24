import { useEffect, useState } from "react";

export function useNFCReader() {
    const [nfcSupported, setNfcSupported] = useState<boolean>(false);
  
    useEffect(() => {
      setNfcSupported("NDEFReader" in window);
    }, []);
  
    return { nfcSupported };
  }