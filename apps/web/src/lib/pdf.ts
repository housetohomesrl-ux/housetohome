const PDF_OPTIONS = {
  margin: 10,
  image: { type: "jpeg" as const, quality: 0.98 },
  html2canvas: { scale: 2, useCORS: true },
  jsPDF: { unit: "mm" as const, format: "a4", orientation: "portrait" as const },
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
