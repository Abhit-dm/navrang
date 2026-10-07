import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import api from '../../api/client.js';
import { telLink, whatsappLink } from '../../utils/format.js';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/about', label: 'About Us' },
  { to: '/products', label: 'Products' },
  { to: '/contact', label: 'Contact Us' },
];

export default function PublicLayout() {
  const [settings, setSettings] = useState({});
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => { api.get('/public/settings').then((res) => setSettings(res.data || {})).catch(() => {}); }, []);
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [pathname]);

  const call = telLink(settings.phone);
  const wa = whatsappLink(settings.whatsapp || settings.phone, 'Hello Navrang Tyres, I would like to enquire about tyres.');
  const name = settings.businessName || 'NAVRANG TYRES';

  return (
    <div className="pub">
      <header className="pub-header">
        <div className="pub-container pub-header-inner">
          <Link to="/" className="pub-logo" aria-label={`${name} home`}>
            <strong>NAVRANG <span>TYRES</span></strong>
            <small>{settings.tagline || 'Quality Tyres. Trusted Service.'}</small>
          </Link>
          <nav className={`pub-nav ${open ? 'open' : ''}`} aria-label="Main navigation">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>{l.label}</NavLink>
            ))}
            <div className="pub-mobile-cta">
              {call && <a className="btn btn-secondary" href={call}>Call Now</a>}
              {wa && <a className="btn btn-whatsapp" href={wa} target="_blank" rel="noreferrer">WhatsApp</a>}
            </div>
          </nav>
          <div className="pub-header-cta">
            {call && <a className="btn btn-secondary btn-sm hide-sm" href={call}>Call Now</a>}
            {wa && <a className="btn btn-whatsapp btn-sm hide-sm" href={wa} target="_blank" rel="noreferrer">WhatsApp</a>}
            <button className="pub-burger" aria-label="Toggle menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? '✕' : '☰'}</button>
          </div>
        </div>
      </header>

      <main><Outlet context={{ settings }} /></main>

      <footer className="pub-footer">
        <div className="pub-container pub-footer-grid">
          <div>
            <h4>{name}</h4>
            <p>{settings.tagline || 'Quality Tyres. Trusted Service.'}</p>
            <div className="pub-social">
              {settings.facebookUrl && <a href={settings.facebookUrl} target="_blank" rel="noreferrer">Facebook</a>}
              {settings.instagramUrl && <a href={settings.instagramUrl} target="_blank" rel="noreferrer">Instagram</a>}
            </div>
          </div>
          <div>
            <h4>Quick Links</h4>
            <ul>{LINKS.map((l) => <li key={l.to}><Link to={l.to}>{l.label}</Link></li>)}</ul>
          </div>
          <div>
            <h4>Contact</h4>
            {settings.phone && <p>Phone: <a href={call}>{settings.phone}</a></p>}
            {settings.email && <p>Email: <a href={`mailto:${settings.email}`}>{settings.email}</a></p>}
            {settings.address && <p>Address: {settings.address}</p>}
            {settings.businessHours && <p>Hours: {settings.businessHours}</p>}
          </div>
        </div>
        <div className="pub-footer-bottom">
          © {new Date().getFullYear()} Navrang Tyres. All rights reserved. · <Link to="/login">Staff Login</Link>
        </div>
      </footer>

      {wa && <a className="pub-float-wa" href={wa} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp">WhatsApp</a>}
    </div>
  );
}
