"use server";

import { Resend } from "resend";

export interface ContactFormState {
  status: "idle" | "success" | "error";
  message?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MESSAGE_LENGTH = 2000;
const GENERIC_ERROR_MESSAGE =
  "No se pudo enviar el mensaje. Intenta nuevamente más tarde.";

export async function sendContactMessage(
  _prevState: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  const honeypot = String(formData.get("company") ?? "").trim();
  if (honeypot) {
    return { status: "success" };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!name || !email || !message) {
    return { status: "error", message: "Completa todos los campos antes de enviar." };
  }

  if (!EMAIL_REGEX.test(email)) {
    return { status: "error", message: "Ingresa un correo electrónico válido." };
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return {
      status: "error",
      message: `El mensaje no puede superar los ${MAX_MESSAGE_LENGTH} caracteres.`,
    };
  }

  const to = process.env.CONTACT_TO_EMAIL;
  if (!to) {
    return { status: "error", message: GENERIC_ERROR_MESSAGE };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: "Arcade Vault <onboarding@resend.dev>",
      to,
      replyTo: email,
      subject: `Nuevo mensaje de contacto — ${name}`,
      text: `De: ${name} <${email}>\n\n${message}`,
    });

    if (error) {
      return { status: "error", message: GENERIC_ERROR_MESSAGE };
    }

    return { status: "success", message: name };
  } catch {
    return { status: "error", message: GENERIC_ERROR_MESSAGE };
  }
}
