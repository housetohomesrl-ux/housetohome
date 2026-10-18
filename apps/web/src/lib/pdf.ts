/** Genera e scarica un PDF a partire da un nodo DOM già stilizzato (stesso contenuto della stampa), senza passare dal dialogo di stampa del browser. Libreria caricata solo al click, per non appesantire il bundle iniziale. */
export async function downloadElementAsPdf(element: HTMLElement, filename: string) {
  const { default: html2pdf } = await import("html2pdf.js");
  await html2pdf()
    .set({
      margin: 10,
      filename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    })
    .from(element)
    .save();
}
