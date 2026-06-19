import { useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { contactSchema, type ContactInput } from "../../lib/contact-schema";
import { track } from "../../lib/analytics";
import { site } from "../../lib/content";

type Status = "idle" | "submitting" | "success" | "error";

const f = site.contact.fields;

function inputClass(invalid: boolean): string {
  const base =
    "mt-2 w-full rounded-2xl bg-bg px-4 py-3 font-body text-text ring-1 transition-shadow placeholder:text-muted focus:outline-none focus:ring-2";
  return `${base} ${invalid ? "ring-coral focus:ring-coral" : "ring-text/10 focus:ring-blue"}`;
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="font-body text-sm font-medium">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 font-body text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export default function ContactForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    mode: "onBlur",
    defaultValues: { name: "", email: "", message: "", company: "" },
  });
  const [status, setStatus] = useState<Status>("idle");
  const mountedAt = useRef(Date.now());

  const onSubmit = async (data: ContactInput) => {
    setStatus("submitting");
    track("form_submit");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, _elapsed: Date.now() - mountedAt.current }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus("success");
      track("form_success");
      reset();
    } catch {
      setStatus("error");
      track("form_error");
    }
  };

  if (status === "success") {
    return (
      <div
        className="flex flex-col items-start gap-3 rounded-card bg-surface p-8 shadow-card ring-1 ring-text/5"
        role="status"
      >
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-green/15">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-6 w-6 text-green">
            <path
              d="M5 12.5l4 4 10-10"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <p className="font-display text-xl font-bold">送信しました</p>
        <p className="font-body text-muted">{site.contact.note}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="rounded-card bg-surface p-8 shadow-card ring-1 ring-text/5"
    >
      {/* honeypot（視覚・SRから隠す。人間は触れない） */}
      <div className="absolute h-0 w-0 overflow-hidden" aria-hidden="true">
        <label>
          Company
          <input type="text" tabIndex={-1} autoComplete="off" {...register("company")} />
        </label>
      </div>

      <div className="space-y-5">
        <Field id="name" label={f.name.label} error={errors.name?.message}>
          <input
            id="name"
            type="text"
            placeholder={f.name.placeholder}
            aria-invalid={errors.name ? "true" : undefined}
            aria-describedby={errors.name ? "name-error" : undefined}
            className={inputClass(Boolean(errors.name))}
            {...register("name")}
          />
        </Field>

        <Field id="email" label={f.email.label} error={errors.email?.message}>
          <input
            id="email"
            type="email"
            placeholder={f.email.placeholder}
            aria-invalid={errors.email ? "true" : undefined}
            aria-describedby={errors.email ? "email-error" : undefined}
            className={inputClass(Boolean(errors.email))}
            {...register("email")}
          />
        </Field>

        <Field id="message" label={f.message.label} error={errors.message?.message}>
          <textarea
            id="message"
            rows={4}
            placeholder={f.message.placeholder}
            aria-invalid={errors.message ? "true" : undefined}
            aria-describedby={errors.message ? "message-error" : undefined}
            className={inputClass(Boolean(errors.message))}
            {...register("message")}
          />
        </Field>
      </div>

      {status === "error" && (
        <p role="alert" className="mt-4 font-body text-sm text-danger">
          送信に失敗しました。時間をおいて再度お試しください。
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="mt-6 w-full rounded-button bg-blue px-6 py-3.5 font-body font-medium text-white shadow-floating transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 motion-reduce:transform-none"
      >
        {status === "submitting" ? "送信中…" : site.contact.submit}
      </button>
    </form>
  );
}
