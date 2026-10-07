import api from '../api/client.js';

// The PDF endpoint needs the login token, so it is fetched as a blob instead of opened as a plain link.
export async function downloadInvoicePdf(id, invoiceNumber) {
  const res = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${invoiceNumber || `invoice-${id}`}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
