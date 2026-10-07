import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api/client.js';
import ProductCard from '../../components/public/ProductCard.jsx';

const CATEGORIES = ['Car Tyres', 'Bike Tyres', 'SUV Tyres', 'Commercial Tyres', 'Other'];
const PRICE_RANGES = [
  ['', 'Any price'], ['0-5000', 'Under ₹5,000'], ['5000-10000', '₹5,000 - ₹10,000'], ['10000-20000', '₹10,000 - ₹20,000'], ['20000-', 'Above ₹20,000'],
];

export default function PublicProducts() {
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState({ brands: [], vehicleTypes: [] });
  const [products, setProducts] = useState([]);
  const [state, setState] = useState('loading');
  const [search, setSearch] = useState(params.get('search') || '');

  const category = params.get('category') || '';
  const brand = params.get('brand') || '';
  const vehicleType = params.get('vehicleType') || '';
  const price = params.get('price') || '';
  const q = params.get('search') || '';

  useEffect(() => { api.get('/public/products/filters').then((res) => setFilters(res.data)).catch(() => {}); }, []);

  useEffect(() => {
    setState('loading');
    const [minPrice, maxPrice] = price ? price.split('-') : ['', ''];
    api.get('/public/products', { params: { search: q, category, brand, vehicleType, minPrice, maxPrice } })
      .then((res) => { setProducts(res.data); setState('ready'); })
      .catch(() => setState('error'));
  }, [q, category, brand, vehicleType, price]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };
  const clear = () => { setSearch(''); setParams({}, { replace: true }); };
  const active = category || brand || vehicleType || price || q;

  return (
    <>
      <div className="pub-banner"><div className="pub-container"><h1>Our Products</h1><p>Find the right tyre for your vehicle</p></div></div>
      <section className="pub-section">
        <div className="pub-container">
          <form className="pub-filters" onSubmit={(e) => { e.preventDefault(); setParam('search', search.trim()); }}>
            <input className="search" aria-label="Search products" placeholder="Search by name, brand or size" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select aria-label="Category" value={category} onChange={(e) => setParam('category', e.target.value)}>
              <option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select aria-label="Brand" value={brand} onChange={(e) => setParam('brand', e.target.value)}>
              <option value="">All brands</option>{filters.brands.map((b) => <option key={b}>{b}</option>)}
            </select>
            <select aria-label="Vehicle type" value={vehicleType} onChange={(e) => setParam('vehicleType', e.target.value)}>
              <option value="">All vehicle types</option>{filters.vehicleTypes.map((v) => <option key={v}>{v}</option>)}
            </select>
            <select aria-label="Price" value={price} onChange={(e) => setParam('price', e.target.value)}>
              {PRICE_RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button className="btn btn-secondary" type="submit">Search</button>
            {active && <button className="btn btn-outline" type="button" onClick={clear}>Clear</button>}
          </form>

          {state === 'loading' && <div className="pub-grid">{[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <div key={i} className="pub-skeleton" />)}</div>}
          {state === 'error' && <div className="pub-error">Products could not be loaded. Please refresh the page or try again shortly.</div>}
          {state === 'ready' && products.length === 0 && <div className="pub-state">No products match your search. Try clearing the filters.</div>}
          {state === 'ready' && products.length > 0 && (
            <>
              <p className="pub-meta" style={{ marginBottom: 14 }}>{products.length} product{products.length === 1 ? '' : 's'} found</p>
              <div className="pub-grid">{products.map((p) => <ProductCard key={p.id} product={p} />)}</div>
            </>
          )}
        </div>
      </section>
    </>
  );
}
