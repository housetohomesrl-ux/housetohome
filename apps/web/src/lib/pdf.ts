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

/**
 * html2pdf.js ha due bug di arrotondamento che, insieme, lasciano un residuo
 * (1-4px) dei bordi della riga spinta alla pagina dopo visibile in fondo alla
 * pagina precedente, dove dovrebbe esserci solo spazio bianco:
 * 1) l'altezza pagina usata per decidere DOVE spingere una riga (CSS px, da
 *    pageSize.inner.px.height) e quella usata per TAGLIARE l'immagine
 *    (px canvas, da canvas.width * ratio) derivano dalla stessa dimensione
 *    ma con arrotondamenti indipendenti — forzare canvas.width a combaciare
 *    esattamente con pageSize.inner.px.width (via html2canvas.width) chiude
 *    gran parte dello scarto;
 * 2) lo spazio "cuscinetto" inserito per spingere la riga ha un'altezza
 *    frazionaria (es. 7.76562px) — un paio di px di margine di sicurezza in
 *    più eliminano lo scarto residuo.
 * Verificato con una ricostruzione isolata (Playwright + html2pdf.js) prima
 * e dopo: senza questo intervento il residuo è visibile su ogni pagina (e
 * cresce di pagina in pagina), con entrambi gli accorgimenti sparisce.
 */
async function preparePdfWorker(element: HTMLElement, extraOptions: Record<string, unknown> = {}) {
  const { default: html2pdf } = await import("html2pdf.js");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- proprietà interne non esposte nei tipi di html2pdf.js
  const worker = html2pdf().set({ ...PDF_OPTIONS, ...extraOptions }).from(element) as any;
  await worker.setPageSize();
  const innerPxWidth = worker.prop.pageSize.inner.px.width;
  worker.opt.html2canvas.width = innerPxWidth;
  worker.opt.html2canvas.windowWidth = innerPxWidth;
  await worker.toContainer();
  worker.prop.container.querySelectorAll('div[style*="height"]').forEach((div: HTMLElement) => {
    const h = parseFloat(div.style.height);
    if (!isNaN(h) && div.textContent === "" && div.children.length === 0) {
      div.style.height = `${Math.ceil(h) + 6}px`;
    }
  });
  return worker;
}

/** Genera e scarica un PDF a partire da un nodo DOM già stilizzato (stesso contenuto della stampa), senza passare dal dialogo di stampa del browser. Libreria caricata solo al click, per non appesantire il bundle iniziale. */
export async function downloadElementAsPdf(element: HTMLElement, filename: string) {
  const worker = await preparePdfWorker(element, { filename });
  await worker.save();
}

/** Genera lo stesso PDF ma come stringa base64 (per allegarlo a un'email), senza scaricarlo. */
export async function generatePdfBase64(element: HTMLElement): Promise<string> {
  const worker = await preparePdfWorker(element);
  const dataUri: string = await worker.outputPdf("datauristring");
  const commaIndex = dataUri.indexOf(",");
  return commaIndex >= 0 ? dataUri.slice(commaIndex + 1) : dataUri;
}
