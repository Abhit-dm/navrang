import React, { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import api from '../../api/client.js';
import ProductCard from '../../components/public/ProductCard.jsx';
import TyreIcon from '../../components/public/TyreIcon.jsx';
import { telLink, whatsappLink } from '../../utils/format.js';

const SERVICES = [
  ['🛞', 'Tyre Replacement'], ['🎯', 'Wheel Alignment'], ['⚖️', 'Wheel Balancing'], ['🔄', 'Tyre Rotation'],
  ['🔧', 'Puncture Repair'], ['🔍', 'Tyre Inspection'], ['💨', 'Nitrogen Filling'],
];
const WHY = [
  ['✅', 'Quality Products', 'Tyres from trusted brands for cars, bikes and commercial vehicles.'],
  ['🤝', 'Trusted Service', 'Honest advice and careful fitting on every job.'],
  ['👨‍🔧', 'Experienced Team', 'A team that handles fitting, balancing and alignment every day.'],
  ['💰', 'Competitive Pricing', 'Clear, fair pricing with no hidden charges.'],
  ['📞', 'Customer Support', 'Call or WhatsApp us any time during business hours.'],
];

export default function Home() {
  const { settings } = useOutletContext();
  const [products, setProducts] = useState([]);
  const [state, setState] = useState('loading');

  useEffect(() => {
    api.get('/public/products')
      .then((res) => { setProducts(res.data.slice(0, 8)); setState('ready'); })
      .catch(() => setState('error'));
  }, []);

  const call = telLink(settings.phone);
  const wa = whatsappLink(settings.whatsapp || settings.phone, 'Hello Navrang Tyres, I need help choosing tyres.');

  return (
    <>
      <section className="pub-hero">
        <div className="pub-container pub-hero-inner">
          <div>
            <h1>NAVRANG <span>TYRES</span></h1>
            <p className="tag">{settings.tagline || 'Quality Tyres. Trusted Service.'}</p>
            <p className="sub">Tyres, fitting and care for your vehicle, all in one place. Browse our range online and visit us or call to get the right tyres fitted.</p>
            <div className="pub-hero-actions">
              <Link className="btn btn-secondary btn-lg" to="/products">Explore Products</Link>
              <Link className="btn btn-ghost-light btn-lg" to="/contact">Contact Us</Link>
              {call && <a className="btn btn-accent btn-lg" href={call}>Call Now</a>}
            </div>
          </div>
          <div className="pub-hero-art"><TyreIcon /></div>
        </div>
      </section>

      <section className="pub-section">
        <div className="pub-container pub-two">
          <div>
            <h2>About Navrang Tyres</h2>
            <div className="pub-underline" />
            <p className="lead">{settings.aboutText || 'Navrang Tyres supplies and fits tyres for cars, bikes and commercial vehicles. We focus on helping every customer choose the right tyre for their vehicle and driving needs.'}</p>
            <Link className="btn btn-primary" to="/about">About Us</Link>
          </div>
          <div className="pub-about-art"><TyreIcon /></div>
        </div>
      </section>

      <section className="pub-section alt">
        <div className="pub-container">
          <div className="pub-section-head">
            <div><h2>Popular Tyres</h2><div className="pub-underline" /></div>
            <Link className="btn btn-secondary" to="/products">View All Products</Link>
          </div>
          {state === 'loading' && <div className="pub-grid">{[1, 2, 3, 4].map((i) => <div key={i} className="pub-skeleton" />)}</div>}
          {state === 'error' && <div className="pub-error">Products could not be loaded right now. Please try again shortly.</div>}
          {state === 'ready' && products.length === 0 && <div className="pub-state">Our product list is being updated. Please contact us for availability.</div>}
          {state === 'ready' && products.length > 0 && <div className="pub-grid">{products.map((p) => <ProductCard key={p.id} product={p} />)}</div>}
        </div>
      </section>

      <section className="pub-section">
        <div className="pub-container">
          <h2 className="pub-center">Our Services</h2>
          <div className="pub-underline" style={{ margin: '8px auto 24px' }} />
          <div className="pub-grid three">
            {SERVICES.map(([icon, label]) => (
              <div key={label} className="pub-card pad"><div className="pub-icon">{icon}</div><h3>{label}</h3></div>
            ))}
          </div>
        </div>
      </section>

      <section className="pub-section alt">
        <div className="pub-container">
          <h2 className="pub-center">Why Choose Us</h2>
          <div className="pub-underline" style={{ margin: '8px auto 24px' }} />
          <div className="pub-why">
            {WHY.map(([icon, title, text]) => (
              <div key={title} className="item"><div className="pub-icon">{icon}</div><h3 style={{ margin: '0 0 6px', fontSize: '1rem' }}>{title}</h3><p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.88rem' }}>{text}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="pub-cta">
        <div className="pub-container">
          <h2>Need the right tyres for your vehicle?</h2>
          <div className="pub-hero-actions">
            {call && <a className="btn btn-accent btn-lg" href={call}>Call Now</a>}
            {wa && <a className="btn btn-whatsapp btn-lg" href={wa} target="_blank" rel="noreferrer">WhatsApp</a>}
            <Link className="btn btn-ghost-light btn-lg" to="/contact">Contact Us</Link>
          </div>
        </div>
      </section>
    </>
  );
}
