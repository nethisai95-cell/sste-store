const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function belowThousand(n) {
  const parts = [];
  if (n >= 100) {
    parts.push(`${ones[Math.floor(n / 100)]} Hundred`);
    n %= 100;
  }
  if (n >= 20) parts.push(tens[Math.floor(n / 10)] + (n % 10 ? ` ${ones[n % 10]}` : ''));
  else if (n > 0) parts.push(ones[n]);
  return parts.join(' ');
}

function integerInWords(n) {
  if (n === 0) return 'Zero';
  const units = [[10000000, 'Crore'], [100000, 'Lakh'], [1000, 'Thousand']];
  const parts = [];
  for (const [size, label] of units) {
    if (n >= size) {
      parts.push(`${belowThousand(Math.floor(n / size))} ${label}`);
      n %= size;
    }
  }
  if (n > 0) parts.push(belowThousand(n));
  return parts.join(' ');
}

export function amountInWords(amount) {
  const paiseTotal = Math.round(Number(amount) * 100);
  const rupees = Math.floor(paiseTotal / 100);
  const paise = paiseTotal % 100;
  let words = `${integerInWords(rupees)} Rupees`;
  if (paise) words += ` and ${integerInWords(paise)} Paise`;
  return `${words} Only`;
}

const normalizeState = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

export function isIntraState(sellerState, customerState) {
  const seller = normalizeState(sellerState);
  const customer = normalizeState(customerState);
  return Boolean(seller && customer && seller === customer);
}

// Splits a line's GST (in rupees) into CGST+SGST for intra-state supply, or IGST otherwise.
export function splitGst(taxAmount, intraState) {
  const paise = Math.round(Number(taxAmount || 0) * 100);
  if (!intraState) return { cgst: 0, sgst: 0, igst: paise / 100 };
  const cgstPaise = Math.floor(paise / 2);
  return { cgst: cgstPaise / 100, sgst: (paise - cgstPaise) / 100, igst: 0 };
}

export function buildInvoice(order) {
  const intraState = isIntraState(order.sellerRegisteredState, order.state);
  const lines = order.items.map((item) => {
    const taxable = Math.round(Number(item.price) * 100) * item.quantity / 100;
    const tax = item.taxAmount === null || item.taxAmount === undefined ? null : Number(item.taxAmount);
    return {
      ...item,
      taxable,
      tax,
      ...splitGst(tax, intraState),
      lineTotal: tax === null ? taxable : Math.round((taxable + tax) * 100) / 100,
    };
  });
  const totals = lines.reduce((sum, line) => ({
    taxable: sum.taxable + Math.round(line.taxable * 100),
    cgst: sum.cgst + Math.round(line.cgst * 100),
    sgst: sum.sgst + Math.round(line.sgst * 100),
    igst: sum.igst + Math.round(line.igst * 100),
  }), { taxable: 0, cgst: 0, sgst: 0, igst: 0 });
  const hasTax = lines.some((line) => (line.tax || 0) > 0);
  const hsnMap = new Map();
  for (const line of lines) {
    const key = `${line.hsnCode || ''}|${line.gstRate ?? ''}`;
    const row = hsnMap.get(key) || { hsnCode: line.hsnCode || '', gstRate: line.gstRate ?? null, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    row.taxable += Math.round(line.taxable * 100);
    row.cgst += Math.round(line.cgst * 100);
    row.sgst += Math.round(line.sgst * 100);
    row.igst += Math.round(line.igst * 100);
    hsnMap.set(key, row);
  }
  const hsnSummary = [...hsnMap.values()].map((row) => ({
    ...row, taxable: row.taxable / 100, cgst: row.cgst / 100, sgst: row.sgst / 100, igst: row.igst / 100,
  }));
  const totalQuantity = lines.reduce((sum, line) => sum + Number(line.quantity), 0);
  const registered = Boolean(order.sellerGstRegistered && order.sellerGstin);
  return {
    intraState,
    lines,
    hasTax,
    hsnSummary,
    totalQuantity,
    title: registered && hasTax ? 'Tax Invoice' : registered ? 'Invoice' : 'Bill of Supply',
    invoiceNumber: order.invoiceNumber || `INV-${order.orderNumber}`,
    taxable: totals.taxable / 100,
    cgst: totals.cgst / 100,
    sgst: totals.sgst / 100,
    igst: totals.igst / 100,
    total: Number(order.total),
    totalInWords: amountInWords(order.total),
  };
}
