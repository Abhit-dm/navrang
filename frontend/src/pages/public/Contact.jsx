import React, { useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import api from '../../api/client.js';
import { telLink, whatsappLink } from '../../utils/format.js';

const EMPTY = { name: '', phone: '', email: '', subject: '', message: '', website: '' };

function validate(f) {
  const e = {};
  if (f.name.trim().length < 2) e.name = 'Please enter your name.';
  if (!/^[0-9+\-\s]{10,15}$/.test(f.phone.trim())) e.phone = 'Enter a valid phone number (10 to 15 digits).';
  if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Enter a valid email address.';
  if (f.subject.trim().length < 3) e.subject = 'Please enter a subject.';
  if (f.message.trim().length < 10) e.message = 'Please write at least 10 characters.';
  return e;
}

export default function Contact() {
  const { settings } = useOutletContext();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ ...EMPTY, subject: params.get('subject') || '' });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ type: '', text: '' });
  const [sending, setSending] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (sending) return;
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) { setStatus({ type: 'error', text: 'Please correct the highlighted fields.' }); return; }
    setSending(true);
    setStatus({ type: '', text: '' });
    try {
      const { data } = await api.post('/public/enquiries', form);
      setStatus({ type: 'success', text: data.message });
      setForm(EMPTY);
    } catch (err) {
      setStatus({ type: 'error', text: err.response?.data?.message || 'We could not send your message. Please try again or call us.' });
    } finally {
      setSending(false);
    }
  };

  const call = telLink(settings.phone);
  const wa = whatsappLink(settings.whatsapp || settings.phone);
  const mapSrc = settings.address ? `https://www.google.com/maps?q=${encodeURIComponent(settings.address)}&output=embed` : null;
  const rows = [
    ['📞', 'Phone', settings.phone && <a href={call}>{settings.phone}</a>],
    ['💬', 'WhatsApp', wa && settings.whatsapp && <a href={wa} target="_blank" rel="noreferrer">{settings.whatsapp}</a>],
    ['✉️', 'Email', settings.email && <a href={`mailto:${settings.email}`}>{settings.email}</a>],
    ['📍', 'Address', settings.address],
    ['🕒', 'Business Hours', settings.businessHours],
  ].filter((r) => r[2]);

  const field = (key, label, props = {}) => (
    <div className="form-group">
      <label htmlFor={`c-${key}`}>{label}</label>
      {props.rows
        ? <textarea id={`c-${key}`} value={form[key]} onChange={set(key)} {...props} />
        : <input id={`c-${key}`} value={form[key]} onChange={set(key)} {...props} />}
      {errors[key] && <div className="field-error">{errors[key]}</div>}
    </div>
  );

  return (
    <>
      <div className="pub-banner"><div className="pub-container"><h1>Contact Us</h1><p>We would love to hear from you</p></div></div>
      <section className="pub-section">
        <div className="pub-container pub-contact">
          <div>
            <h2>Get in Touch</h2>
            <div className="pub-underline" />
            <div className="pub-card pad">
              {rows.map(([icon, label, value]) => (
                <div className="pub-info-row" key={label}><div className="pub-icon">{icon}</div><div><strong>{label}</strong>{value}</div></div>
              ))}
              {rows.length === 0 && <p>Contact details will be available soon.</p>}
            </div>
            {mapSrc && <iframe className="pub-map" title="Navrang Tyres location" src={mapSrc} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />}
          </div>
          <div>
            <h2>Send an Enquiry</h2>
            <div className="pub-underline" />
            <form className="pub-form pub-card pad" onSubmit={submit} noValidate>
              {status.text && <div className={status.type === 'success' ? 'pub-success' : 'pub-error'} role="status">{status.text}</div>}
              {field('name', 'Name *', { autoComplete: 'name', maxLength: 100 })}
              {field('phone', 'Phone *', { autoComplete: 'tel', inputMode: 'tel', maxLength: 15 })}
              {field('email', 'Email', { type: 'email', autoComplete: 'email', maxLength: 150 })}
              {field('subject', 'Subject *', { maxLength: 150 })}
              {field('message', 'Message *', { rows: 5, maxLength: 2000 })}
              <div className="pub-hp" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} /></label></div>
              <button className="btn btn-secondary btn-lg" type="submit" disabled={sending}>{sending ? 'Sending...' : 'Send Message'}</button>
            </form>
          </div>
        </div>
      </section>
    </>
  );
}
