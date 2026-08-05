"use client";

import { useActionState, useEffect, useState, type FormEvent } from "react";
import { sendContactMessage, type ContactFormState } from "@/app/acerca-de/actions";

const initialState: ContactFormState = { status: "idle" };
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ContactForm() {
  const [state, formAction, pending] = useActionState(sendContactMessage, initialState);
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [shake, setShake] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [state]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    const name = form.name.trim();
    const email = form.email.trim();
    const message = form.message.trim();
    if (!name || !email || !message || !EMAIL_REGEX.test(email)) {
      e.preventDefault();
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
  };

  if (state.status === "success" && !dismissed) {
    return (
      <div className="terminal-success">
        <div className="term-bar">
          <span className="dot r"></span>
          <span className="dot y"></span>
          <span className="dot g"></span>
          <span className="term-title">VAULT-OS // TERMINAL</span>
        </div>
        <div className="term-body">
          <div className="line">
            <span className="prompt">vault@arcade:~$</span> ./send_message --to=team
          </div>
          <div className="line dim">[OK] Conectando con servidor…</div>
          <div className="line dim">[OK] Validando contenido…</div>
          <div className="line dim">[OK] Transmitiendo paquete…</div>
          <div className="line success">
            &gt; MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS,{" "}
            {(state.message ?? "").toUpperCase()}.<span className="caret">_</span>
          </div>
          <div style={{ marginTop: 18 }}>
            <button
              className="btn ghost"
              type="button"
              onClick={() => {
                setDismissed(true);
                setForm({ name: "", email: "", message: "" });
              }}
            >
              ENVIAR OTRO MENSAJE
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      className={"contact-form" + (shake ? " shake" : "")}
      action={formAction}
      onSubmit={handleSubmit}
    >
      <input
        type="text"
        name="company"
        className="hp-field"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      <div className="field">
        <label>NOMBRE</label>
        <input
          name="name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="px_kai"
        />
      </div>
      <div className="field">
        <label>CORREO ELECTRÓNICO</label>
        <input
          type="email"
          name="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="jugador@vault.gg"
        />
      </div>
      <div className="field">
        <label>MENSAJE</label>
        <textarea
          name="message"
          rows={5}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          placeholder="Cuéntanos qué tienes en mente…"
        />
      </div>
      {state.status === "error" && (
        <div className="contact-form-error" role="alert">
          {state.message}
        </div>
      )}
      <button className="btn xl press" type="submit" style={{ width: "100%" }} disabled={pending}>
        {pending ? "▶  ENVIANDO…" : "▶  ENVIAR MENSAJE"}
      </button>
    </form>
  );
}
