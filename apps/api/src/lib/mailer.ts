import nodemailer from "nodemailer";
import { TRPCError } from "@trpc/server";

// Invio email via Gmail SMTP con la casella aziendale (housetohomesrl@gmail.com),
// usata sia per il preventivo cliente sia per i contratti fornitori. Credenziali
// lette da variabili d'ambiente (mai hardcoded/committate): GMAIL_USER +
// GMAIL_APP_PASSWORD (password per le app, non quella normale dell'account Google).
let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Invio email non configurato: mancano le variabili GMAIL_USER / GMAIL_APP_PASSWORD su Railway.",
    });
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
    });
  }
  return transporter;
}

export async function sendEmailWithPdfAttachment(options: {
  to: string;
  subject: string;
  text: string;
  pdfBase64: string;
  attachmentFilename: string;
}) {
  const user = process.env.GMAIL_USER;
  const mailer = getTransporter();
  try {
    await mailer.sendMail({
      from: `"House to Home Srl" <${user}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      attachments: [{ filename: options.attachmentFilename, content: options.pdfBase64, encoding: "base64" }],
    });
  } catch (err) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Invio email fallito: ${err instanceof Error ? err.message : "errore sconosciuto"}`,
    });
  }
}
