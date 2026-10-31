const PDF_OPTIONS = {
  margin: 10,
  image: { type: "jpeg" as const, quality: 0.98 },
  html2canvas: { scale: 2, useCORS: true },
  jsPDF: { unit: "mm" as const, format: "a4", orientation: "portrait" as const },
  // Evita che una riga (o un blocco) venga tagliata a metà tra una pagina e
  // l'altra: va tutta sulla pagina successiva piuttosto che spezzarsi. Solo
  // modalità "css" (legge il break-inside:avoid messo sui <div> di riga):
  // l'opzione "avoid" diretta su selettori come "tr" spinge l'elemento
  // inserendo un <div> cuscinetto subito prima di lui nel DOM — non valido
  // dentro un <tbody>, causa bordi/linee sfalsate nel PDF.
  pagebreak: { mode: ["css"] },
};

/** Genera e scarica un PDF a partire da un nodo DOM già stilizzato (stesso contenuto della stampa), senza passare dal dialogo di stampa del browser. Libreria caricata solo al click, per non appesantire il bundle iniziale. */
export async function downloadElementAsPdf(element: HTMLElement, filename: string) {
  const { default: html2pdf } = await import("html2pdf.js");
  await html2pdf().set({ ...PDF_OPTIONS, filename }).from(element).save();
}

/** Genera lo stesso PDF ma come stringa base64 (per allegarlo a un'email), senza scaricarlo. */
export async function generatePdfBase64(element: HTMLElement): Promise<string> {
  const { default: html2pdf } = await import("html2pdf.js");
  const dataUri: string = await html2pdf().set(PDF_OPTIONS).from(element).outputPdf("datauristring");
  const commaIndex = dataUri.indexOf(",");
  return commaIndex >= 0 ? dataUri.slice(commaIndex + 1) : dataUri;
}
