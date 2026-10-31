import { TRPCError } from "@trpc/server";
import { prisma } from "@flipplan/db";
import { sendQuoteEmailSchema, sendVendorContractEmailSchema, sendVendorQuoteRequestEmailSchema } from "@flipplan/shared";
import { protectedProcedure, router } from "../trpc.js";
import { assertDealAccess } from "../lib/tenantAccess.js";
import { sendEmailWithPdfAttachment } from "../lib/mailer.js";

export const emailRouter = router({
  // Manda il preventivo cliente (PDF già generato lato web, identico a
  // "Scarica PDF") via email alla casella del cliente salvata nella scheda
  // Cliente del deal. Se il preventivo era ancora in "Bozza", lo segna
  // "Inviato" — coerente col fatto che è appena partito davvero.
  sendQuote: protectedProcedure.input(sendQuoteEmailSchema).mutation(async ({ ctx, input }) => {
    await assertDealAccess(ctx.user.tenantId, input.dealId);
    const deal = await prisma.deal.findUniqueOrThrow({ where: { id: input.dealId } });
    if (!deal.clientEmail) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Il cliente non ha un'email salvata (scheda Cliente)." });
    }

    await sendEmailWithPdfAttachment({
      to: deal.clientEmail,
      subject: `Preventivo — ${deal.address || deal.name}`,
      text: `Gentile ${deal.clientName || "cliente"},\n\nin allegato trova il preventivo per i lavori in ${deal.address || deal.name}.\n\nRestiamo a disposizione per qualsiasi chiarimento.\n\nHouse to Home Srl`,
      pdfBase64: input.pdfBase64,
      attachmentFilename: `Preventivo ${deal.name}.pdf`,
    });

    if (deal.quoteStatus === "BOZZA") {
      await prisma.deal.update({ where: { id: deal.id }, data: { quoteStatus: "INVIATO" } });
    }

    return { success: true };
  }),

  // Manda il contratto lavori di un fornitore (PDF generato lato web dalla
  // tab Contratti fornitori) via email alla sua casella.
  sendVendorContract: protectedProcedure.input(sendVendorContractEmailSchema).mutation(async ({ ctx, input }) => {
    await assertDealAccess(ctx.user.tenantId, input.dealId);
    const [deal, vendor] = await Promise.all([
      prisma.deal.findUniqueOrThrow({ where: { id: input.dealId } }),
      prisma.vendor.findUniqueOrThrow({ where: { id: input.vendorId } }),
    ]);
    if (vendor.tenantId !== ctx.user.tenantId) throw new TRPCError({ code: "NOT_FOUND" });
    if (!vendor.email) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Questo fornitore non ha un'email salvata (pagina Fornitori)." });
    }

    await sendEmailWithPdfAttachment({
      to: vendor.email,
      subject: `Contratto lavori — ${deal.address || deal.name}`,
      text: `Gentile ${vendor.name},\n\nin allegato il contratto per i lavori in ${deal.address || deal.name}.\n\nResto a disposizione per qualsiasi chiarimento.\n\nHouse to Home Srl`,
      pdfBase64: input.pdfBase64,
      attachmentFilename: `Contratto ${vendor.name} - ${deal.name}.pdf`,
    });

    return { success: true };
  }),

  // Manda la lista sopralluogo (voci flaggate per questo fornitore, senza
  // prezzi) via email, per chiedergli di preventivarle.
  sendVendorQuoteRequest: protectedProcedure.input(sendVendorQuoteRequestEmailSchema).mutation(async ({ ctx, input }) => {
    await assertDealAccess(ctx.user.tenantId, input.dealId);
    const [deal, vendor] = await Promise.all([
      prisma.deal.findUniqueOrThrow({ where: { id: input.dealId } }),
      prisma.vendor.findUniqueOrThrow({ where: { id: input.vendorId } }),
    ]);
    if (vendor.tenantId !== ctx.user.tenantId) throw new TRPCError({ code: "NOT_FOUND" });
    if (!vendor.email) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Questo fornitore non ha un'email salvata (pagina Fornitori)." });
    }

    await sendEmailWithPdfAttachment({
      to: vendor.email,
      subject: `Richiesta preventivo — ${deal.address || deal.name}`,
      text: `Gentile ${vendor.name},\n\nin allegato l'elenco delle lavorazioni emerse dal sopralluogo in ${deal.address || deal.name}. Vi chiediamo cortesemente di farci avere un preventivo per le voci elencate.\n\nResto a disposizione per qualsiasi chiarimento.\n\nHouse to Home Srl`,
      pdfBase64: input.pdfBase64,
      attachmentFilename: `Richiesta preventivo ${vendor.name} - ${deal.name}.pdf`,
    });

    return { success: true };
  }),
});
