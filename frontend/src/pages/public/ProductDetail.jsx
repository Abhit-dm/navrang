import React, { useEffect, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import api from '../../api/client.js';
import { PriceTag, ProductImage } from '../../components/public/ProductCard.jsx';
import { statusBadgeClass, telLink, whatsappLink } from '../../utils/format.js';

export default function ProductDetail() {
  const { id } = useParams();
  const { settings } = useOutletContext();
  const [product, setProduct] = useState(null);
  const [state, setState] = useState('loading');

  useEffect(() => {
    setState('loading');
    api.get(`/public/products/${id}`)
      .then((res) => { setProduct(res.data); setState('ready'); })
      .catch((err) => setState(err.response?.status === 404 ? 'missing' : 'error'));
  }, [id]);

  if (state === 'loading') return <div className="pub-container pub-section"><div className="pub-skeleton" /></div>;
  if (state !== 'ready') {
    return (
      <div className="pub-container pub-section pub-state">
        <p>{state === 'missing' ? 'This product could not be found.' : 'This product could not be loaded right now.'}</p>
        <Link className="btn btn-secondary" to="/products">Back to Products</Link>
      </div>
    );
  }

  const specs = [
    ['Brand', product.brand], ['Category', product.category], ['Tyre size', product.size], ['Rim size', product.rimSize],
    ['Vehicle type', product.vehicleType], ['Tyre type', product.tyreType], ['Pattern', product.pattern],
    ['Speed rating', product.speedRating], ['Load index', product.loadIndex],
  ].filter(([, v]) => v);
  const subject = encodeURIComponent(`Enquiry: ${product.name}${product.size ? ` (${product.size})` : ''}`);
  const call = telLink(settings.phone);
  const wa = whatsappLink(settings.whatsapp || settings.phone, `Hello, I am interested in ${product.name}${product.size ? ` (${product.size})` : ''}. Is it available?`);

  return (
    <section className="pub-section">
      <div className="pub-container">
        <div className="pub-breadcrumb"><Link to="/">Home</Link> / <Link to="/products">Products</Link> / {product.name}</div>
        <div className="pub-detail">
          <ProductImage product={product} />
          <div>
            {product.brand && <span className="pub-brand">{product.brand}</span>}
            <h1>{product.name}</h1>
            <PriceTag product={product} />
            <p style={{ margin: '10px 0' }}><span className={statusBadgeClass(product.availability)}>{product.availability}</span></p>
            <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>{product.description || 'Contact us for more details about this tyre and its suitability for your vehicle.'}</p>
            <table className="pub-spec"><tbody>{specs.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody></table>
            <div className="pub-actions">
              <Link className="btn btn-secondary btn-lg" to={`/contact?subject=${subject}`}>Enquire Now</Link>
              <Link className="btn btn-outline btn-lg" to="/contact">Contact Us</Link>
              {call && <a className="btn btn-accent btn-lg" href={call}>Call Now</a>}
              {wa && <a className="btn btn-whatsapp btn-lg" href={wa} target="_blank" rel="noreferrer">WhatsApp</a>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
