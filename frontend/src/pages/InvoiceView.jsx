import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import api from '../api/client.js';
import { downloadInvoicePdf } from '../utils/download.js';
import { PAYMENT_METHODS, formatCurrency, formatDate, statusBadgeClass, todayInput } from '../utils/format.js';

export default function InvoiceView() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const [invoice, setInvoice] = useState(null);
  const [settings, setSettings] = useState(null);
  const [showPayForm, setShowPayForm] = useState(params.get('pay') === '1');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [payDate, setPayDate] = useState(todayInput());
  const [payRef, setPayRef] = useState('');
  const [paying, setPaying] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');

  const load = () => api.get(`/invoices/${id}`).then((res) => setInvoice(res.data)).catch((err) => setLoadError(err.response?.data?.message || 'Could not load the invoice.'));

  useEffect(() => {
    load();
    api.get('/settings').then((res) => setSettings(res.data));
  }, [id]);

  // Opening from the list's Print button prints once the invoice has rendered.
  useEffect(() => {
    if (invoice && settings && params.get('print') === '1') {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [invoice?.id, settings?.id]);

  const recordPayment = async (e) => {
    e.preventDefault();
    if (paying) return;
    setError('');
    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) { setError('Enter a payment amount greater than zero.'); return; }
    if (amount > invoice.dueAmount + 0.005) { setError('Payment cannot be more than the balance amount.'); return; }
    setPaying(true);
    try {
      await api.post('/payments', { invoiceId: id, amount, method: payMethod, referenceNumber: payRef, paymentDate: payDate });
      setShowPayForm(false); setPayAmount(''); setPayRef('');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setPaying(false);
    }
  };

  const downloadPdf = async () => {
    setPdfBusy(true);
    try { await downloadInvoicePdf(invoice.id, invoice.invoiceNumber); } catch { setError('Could not download the PDF.'); } finally { setPdfBusy(false); }
  };

  if (loadError) return <div className="panel"><div className="error-text">{loadError}</div><Link className="btn btn-outline" to="/admin/invoices">Back to Invoices</Link></div>;
  if (!invoice || !settings) return <div className="empty-state">Loading invoice...</div>;

  return (
    <div>
      <div className="no-print form-actions" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <Link className="btn btn-outline" to="/admin/invoices">← Invoices</Link>
        <button className="btn btn-secondary" onClick={() => window.print()}>🖨️ Print Invoice</button>
        <button className="btn btn-secondary" disabled={pdfBusy} onClick={downloadPdf}>{pdfBusy ? 'Preparing PDF...' : '⬇ Download PDF'}</button>
        {invoice.dueAmount > 0 && invoice.status === 'ACTIVE' && (
          <button className="btn btn-outline" onClick={() => setShowPayForm((v) => !v)}>Record Payment</button>
        )}
        {invoice.sale && <Link className="btn btn-outline" to={`/admin/sales/${invoice.saleId}`}>View Sale</Link>}
      </div>
      {error && !showPayForm && <div className="error-text no-print">{error}</div>}

      {showPayForm && (
        <div className="panel no-print">
          <form onSubmit={recordPayment}>
            <div className="form-grid">
              <div className="form-group"><label>Amount (Balance: {formatCurrency(invoice.dueAmount)})</label><input type="number" min="0.01" step="0.01" max={invoice.dueAmount} required value={payAmount} onChange={(e) => setPayAmount(e.target.value)} /></div>
              <div className="form-group">
                <label>Method</label>
                <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                  {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Payment Date</label><input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} /></div>
              <div className="form-group"><label>Reference (optional)</label><input value={payRef} onChange={(e) => setPayRef(e.target.value)} /></div>
            </div>
            {error && <div className="error-text">{error}</div>}
            <button className="btn btn-secondary" type="submit" disabled={paying}>{paying ? 'Saving...' : 'Save Payment'}</button>
          </form>
        </div>
      )}

      <div className="invoice-sheet">
        {!invoice.isGst && <div className="non-gst-flag">NON-GST BILL</div>}
        {invoice.status === 'CANCELLED' && <div className="non-gst-flag" style={{ background: '#111827' }}>CANCELLED</div>}
        <div className="invoice-header">
          <div>
            <h1>{settings.businessName}</h1>
            <div className="tag">{settings.tagline}</div>
            <div>{settings.address}</div>
            <div>Phone: {settings.phone} | Email: {settings.email}</div>
            {invoice.isGst && <div>GSTIN: {settings.gstin} | State: {settings.state} ({settings.stateCode})</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <h2>{invoice.isGst ? 'TAX INVOICE' : 'BILL (NON-GST)'}</h2>
            <div><strong>Invoice#:</strong> {invoice.invoiceNumber}</div>
            <div><strong>Date:</strong> {formatDate(invoice.invoiceDate)}</div>
          </div>
        </div>

        <div className="invoice-meta">
          <div>
            <strong>Bill To:</strong><br />
            {invoice.customer.name}<br />
            Mobile: {invoice.customer.phone}<br />
            {invoice.customer.altPhone && <>Alternate: {invoice.customer.altPhone}<br /></>}
            {invoice.customer.email && <>Email: {invoice.customer.email}<br /></>}
            {invoice.customer.address}<br />
            {invoice.customer.gstin && <>GSTIN: {invoice.customer.gstin}</>}
          </div>
          {invoice.vehicle && (
            <div>
              <strong>Vehicle:</strong><br />
              Number: {invoice.vehicle.vehicleNumber}<br />
              {invoice.vehicle.model && <>Model: {invoice.vehicle.model}<br /></>}
              {invoice.vehicle.vehicleType && <>Type: {invoice.vehicle.vehicleType}</>}
            </div>
          )}
        </div>

        <table className="data-table">
          <thead>
            <tr><th>S.No</th><th>Product</th><th>Brand</th><th>Model</th><th>Tyre Size</th><th className="num">Qty</th><th className="num">Price</th><th className="num">Discount</th>{invoice.isGst && <th className="num">GST%</th>}<th className="num">Total</th></tr>
          </thead>
          <tbody>
            {invoice.items.map((item, idx) => (
              <tr key={item.id}>
                <td>{idx + 1}</td>
                <td>{item.product.name}</td>
                <td>{item.product.brand}</td>
                <td>{item.product.pattern || '-'}</td>
                <td>{item.product.size || '-'}</td>
                <td className="num">{item.quantity}</td>
                <td className="num">{formatCurrency(item.rate)}</td>
                <td className="num">{formatCurrency(item.discount)}</td>
                {invoice.isGst && <td className="num">{item.gstPercent}%</td>}
                <td className="num">{formatCurrency(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="invoice-bottom">
          <div className="invoice-summary">
            <div className="invoice-summary-left">
              <p><strong>Payment Status:</strong> <span className={statusBadgeClass(invoice.displayStatus)}>{invoice.displayStatus}</span></p>
              <p><strong>Payment Method:</strong> {invoice.sale?.paymentMethod || '-'}{invoice.dueDate && invoice.dueAmount > 0 && <> | <strong>Due Date:</strong> {formatDate(invoice.dueDate)}</>}</p>

              {invoice.warranties?.length > 0 && (
                <div>
                  <strong>Warranty Information:</strong>
                  <ul>
                    {invoice.warranties.map((w) => (
                      <li key={w.id}>{w.warrantyCode}: {w.warrantyType} until {formatDate(w.warrantyEnd)}</li>
                    ))}
                  </ul>
                </div>
              )}

              {invoice.sale?.notes && <p><strong>Notes:</strong> {invoice.sale.notes}</p>}
              {settings.invoiceTerms && <p className="invoice-terms"><strong>Terms:</strong> {settings.invoiceTerms}</p>}
            </div>

            <div className="totals-box">
              <div className="row"><span>Subtotal</span><span>{formatCurrency(invoice.subtotal)}</span></div>
              <div className="row"><span>Discount</span><span>-{formatCurrency(invoice.discount)}</span></div>
              <div className="row"><span>Taxable Amount</span><span>{formatCurrency(invoice.taxableAmount)}</span></div>
              {invoice.isGst && invoice.cgst > 0 && <div className="row"><span>CGST</span><span>{formatCurrency(invoice.cgst)}</span></div>}
              {invoice.isGst && invoice.sgst > 0 && <div className="row"><span>SGST</span><span>{formatCurrency(invoice.sgst)}</span></div>}
              {invoice.isGst && invoice.igst > 0 && <div className="row"><span>IGST</span><span>{formatCurrency(invoice.igst)}</span></div>}
              <div className="row grand"><span>Grand Total</span><span>{formatCurrency(invoice.grandTotal)}</span></div>
              <div className="row"><span>Paid</span><span>{formatCurrency(invoice.paidAmount)}</span></div>
              <div className="row"><span>Balance Amount</span><span>{formatCurrency(invoice.dueAmount)}</span></div>
            </div>
          </div>

          <div className="signature-row">
            <div>{settings.footerText}</div>
            <div>Authorized Signature</div>
          </div>
        </div>
      </div>
    </div>
  );
}
