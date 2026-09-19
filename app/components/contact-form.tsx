"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { type ContactErrors, type ContactFields, validateContact } from "../../lib/contact";

const initialFields: ContactFields = { name: "", contact: "", message: "" };

export default function ContactForm() {
  const [fields, setFields] = useState<ContactFields>(initialFields);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const nameInput = useRef<HTMLInputElement>(null);
  const contactInput = useRef<HTMLInputElement>(null);
  const messageInput = useRef<HTMLTextAreaElement>(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  function update(field: keyof ContactFields, value: string) {
    setFields(previous => ({ ...previous, [field]: value }));
    if (errors[field]) setErrors(previous => ({ ...previous, [field]: undefined }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateContact(fields);
    setErrors(nextErrors);
    const firstError = (Object.keys(nextErrors) as (keyof ContactFields)[])[0];
    if (firstError) {
      if (firstError === "name") nameInput.current?.focus();
      if (firstError === "contact") contactInput.current?.focus();
      if (firstError === "message") messageInput.current?.focus();
      return;
    }

    setStatus("sending");
    timer.current = setTimeout(() => setStatus("sent"), 650);
  }

  if (status === "sent") {
    return <div className="contact-success" role="status">
      <span aria-hidden="true">✓</span>
      <div>
        <p className="eyebrow">LỜI NHẮN ĐÃ SẴN SÀNG</p>
        <h3>Cảm ơn bạn đã ghé mộc.</h3>
        <p>Đây là bản xem trước giao diện. Lời nhắn chưa được gửi hoặc lưu vào hệ thống.</p>
      </div>
      <button type="button" onClick={() => { setFields(initialFields); setErrors({}); setStatus("idle"); }}>
        Gửi lời nhắn khác
      </button>
    </div>;
  }

  return <form className="contact-form" noValidate onSubmit={submit}>
    <div className="contact-field">
      <label htmlFor="contact-name">Họ và tên <span>*</span></label>
      <input ref={nameInput} id="contact-name" name="name" autoComplete="name" placeholder="Tên của bạn" value={fields.name} onChange={event => update("name", event.target.value)} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "contact-name-error" : undefined}/>
      {errors.name && <small id="contact-name-error" role="alert">{errors.name}</small>}
    </div>
    <div className="contact-field">
      <label htmlFor="contact-detail">Email hoặc số điện thoại <span>*</span></label>
      <input ref={contactInput} id="contact-detail" name="contact" autoComplete="email" inputMode="email" placeholder="Để mộc có thể hồi âm" value={fields.contact} onChange={event => update("contact", event.target.value)} aria-invalid={Boolean(errors.contact)} aria-describedby={errors.contact ? "contact-detail-error" : undefined}/>
      {errors.contact && <small id="contact-detail-error" role="alert">{errors.contact}</small>}
    </div>
    <div className="contact-field contact-message">
      <label htmlFor="contact-message">Lời nhắn <span>*</span></label>
      <textarea ref={messageInput} id="contact-message" name="message" rows={4} placeholder="Bạn đang nghĩ điều gì?" value={fields.message} onChange={event => update("message", event.target.value)} aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? "contact-message-error" : undefined}/>
      {errors.message && <small id="contact-message-error" role="alert">{errors.message}</small>}
    </div>
    <div className="contact-actions">
      <p>Bản giao diện thử nghiệm — chưa gửi dữ liệu ra ngoài.</p>
      <button className="contact-submit" type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Đang chuẩn bị…" : "Gửi lời nhắn"}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>
      </button>
    </div>
  </form>;
}
