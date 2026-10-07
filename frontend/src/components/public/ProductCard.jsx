import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import TyreIcon from './TyreIcon.jsx';
import { formatCurrency, statusBadgeClass } from '../../utils/format.js';

export function ProductImage({ product }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [product.imageUrl]);
  return (
    <div className="pub-product-img">
      {product.imageUrl && !failed
        ? <img src={product.imageUrl} alt={product.name} loading="lazy" onError={() => setFailed(true)} />
        : <TyreIcon title={product.name} />}
    </div>
  );
}

export function PriceTag({ product }) {
  if (!product.price) return <div className="pub-meta">Price on request</div>;
  return (
    <div className="pub-price">
      {formatCurrency(product.price)}
      {product.mrp && product.mrp > product.price && <small>{formatCurrency(product.mrp)}</small>}
    </div>
  );
}

export default function ProductCard({ product }) {
  return (
    <article className="pub-card">
      <Link to={`/products/${product.id}`}><ProductImage product={product} /></Link>
      <div className="pub-product-body">
        {product.brand && <span className="pub-brand">{product.brand}</span>}
        <h3>{product.name}</h3>
        <div className="pub-meta">
          {[product.size && `Size: ${product.size}`, product.vehicleType].filter(Boolean).join(' · ')}
        </div>
        <PriceTag product={product} />
        <div className="pub-product-foot">
          <span className={statusBadgeClass(product.availability)}>{product.availability}</span>
          <Link className="btn btn-outline btn-sm" to={`/products/${product.id}`}>View Details</Link>
        </div>
      </div>
    </article>
  );
}
