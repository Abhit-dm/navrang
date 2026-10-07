import React from 'react';
import { Link, useOutletContext } from 'react-router-dom';

// Default wording is deliberately generic; the shop can replace each block in Admin > Settings.
const DEFAULTS = {
  aboutText: 'Navrang Tyres supplies and fits tyres for cars, bikes and commercial vehicles. We help customers choose the right tyre for their vehicle, budget and driving needs, and we look after it with proper fitting and follow-up care.',
  missionText: 'To provide reliable tyres and honest, dependable service so that every customer can drive with confidence.',
  visionText: 'To be the tyre shop customers trust first for quality products, fair prices and helpful service.',
  commitmentText: 'We are committed to clear pricing, genuine products and respectful service, and to standing behind the work we do.',
};

const REASONS = [
  'Wide choice of tyres for cars, bikes, SUVs and commercial vehicles',
  'Honest advice on the right tyre for your vehicle',
  'Fitting, balancing and alignment services under one roof',
  'Clear pricing and proper invoices for every purchase',
  'Friendly support by phone and WhatsApp',
];

export default function About() {
  const { settings } = useOutletContext();
  const text = (key) => settings[key] || DEFAULTS[key];
  const blocks = [['Our Mission', 'missionText', '🎯'], ['Our Vision', 'visionText', '🔭'], ['Our Commitment', 'commitmentText', '🤝']];

  return (
    <>
      <div className="pub-banner"><div className="pub-container"><h1>About Us</h1><p>Get to know Navrang Tyres</p></div></div>

      <section className="pub-section">
        <div className="pub-container">
          <h2>About Navrang Tyres</h2>
          <div className="pub-underline" />
          <p className="lead" style={{ maxWidth: 820 }}>{text('aboutText')}</p>
        </div>
      </section>

      <section className="pub-section alt">
        <div className="pub-container pub-grid three">
          {blocks.map(([title, key, icon]) => (
            <div key={key} className="pub-card pad"><div className="pub-icon">{icon}</div><h3>{title}</h3><p>{text(key)}</p></div>
          ))}
        </div>
      </section>

      <section className="pub-section">
        <div className="pub-container">
          <h2>Why Choose Navrang Tyres</h2>
          <div className="pub-underline" />
          <ul style={{ lineHeight: 2, paddingLeft: 20, margin: '0 0 24px' }}>{REASONS.map((r) => <li key={r}>{r}</li>)}</ul>
          <div className="pub-hero-actions">
            <Link className="btn btn-secondary" to="/products">Explore Products</Link>
            <Link className="btn btn-outline" to="/contact">Contact Us</Link>
          </div>
        </div>
      </section>
    </>
  );
}
