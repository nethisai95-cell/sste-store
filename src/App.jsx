import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { razorpayMethodOptions } from './payment-methods.js';
import { parseQrPayload, unitShortCode } from './qr-scan.js';
import PosApp from './Pos.jsx';
import { buildInvoice } from './invoice.js';

const categories = ['All', 'Furniture', 'Lighting', 'Decor', 'Storage'];
const razorpayPaymentMethods = [
  { id: 'all', label: 'All methods', detail: 'Choose at secure checkout' },
  { id: 'upi', label: 'UPI', detail: 'UPI apps' },
  { id: 'card', label: 'Cards', detail: 'Credit or debit' },
  { id: 'netbanking', label: 'Net banking', detail: 'Your bank' },
  { id: 'wallet', label: 'Wallets', detail: 'Supported wallets' },
];
const orderStatuses = ['received', 'processing', 'shipped', 'delivered', 'cancelled'];
const indianStates = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh',
  'Lakshadweep', 'Puducherry',
];

const collections = [
  {
    title: 'Living Room',
    summary: 'Soft textures and tactile layers for everyday comfort.',
    accent: 'Cushions & seating',
    image:
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
    mood: 'Warm neutral layering',
  },
  {
    title: 'Workspace',
    summary: 'Calm, elevated essentials that make focus feel easy.',
    accent: 'Desk & lighting',
    image:
      'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80',
    mood: 'Focused and functional',
  },
  {
    title: 'Dining',
    summary: 'Warm, functional pieces for shared moments and slow dinners.',
    accent: 'Tabletop & décor',
    image:
      'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1200&q=80',
    mood: 'Intentional gathering',
  },
];

const testimonials = [
  {
    name: 'Alyssa T.',
    quote: 'The pieces feel premium and lived-in at the same time. My space finally feels like me.',
  },
  {
    name: 'Marcus L.',
    quote: 'Shipping was quick, packaging was beautiful, and the quality exceeded expectations.',
  },
  {
    name: 'Nina P.',
    quote: 'I love how easy it is to curate a cohesive room without overthinking the details.',
  },
];

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
});
const indiaDate = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeZone: 'Asia/Kolkata',
});
const indiaDateTime = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Kolkata',
});

function OrderInvoice({ order }) {
  const invoice = buildInvoice(order);
  const intra = invoice.intraState;
  const isTaxInvoice = invoice.title === 'Tax Invoice';
  const paid = order.paymentStatus === 'razorpay_paid';
  return (
    <section className="tax-draft-invoice" aria-label={`${invoice.title} ${invoice.invoiceNumber}`}>
      <header className="invoice-header">
        <div className="invoice-seller">
          <h2>{order.sellerLegalName || 'Business legal name not configured'}</h2>
          <p>
            {order.sellerRegisteredAddress || 'Registered address not configured'}<br />
            {order.sellerRegisteredState || 'State not configured'}
            {order.sellerGstin ? <><br /><strong>GSTIN: {order.sellerGstin}</strong></> : null}
          </p>
        </div>
        <div className="invoice-title">
          <h1>{invoice.title}</h1>
          <span>Original for recipient</span>
        </div>
      </header>
      <div className="invoice-meta">
        <dl>
          <div><dt>Invoice no</dt><dd>{invoice.invoiceNumber}</dd></div>
          <div><dt>Invoice date</dt><dd>{indiaDate.format(new Date(order.created_at))}</dd></div>
          <div><dt>Order no</dt><dd>{order.orderNumber}</dd></div>
        </dl>
        <dl>
          <div><dt>Payment</dt><dd>{paid ? 'Paid online' : order.paymentStatus === 'demo_paid' ? 'Demo payment (test)' : order.paymentMethod || 'Pending'}</dd></div>
          <div><dt>Place of supply</dt><dd>{order.state || '—'}</dd></div>
          <div><dt>Reverse charge</dt><dd>No</dd></div>
        </dl>
      </div>
      <div className="invoice-parties">
        <div>
          <h3>Billed to</h3>
          <p>
            <strong>{order.recipientName || 'Customer'}</strong><br />
            {order.addressLine1}{order.addressLine2 ? `, ${order.addressLine2}` : ''}<br />
            {order.city}, {order.state} {order.postalCode}
            {order.phone ? <><br />Phone: {order.phone}</> : null}
          </p>
        </div>
        <div>
          <h3>Shipped to</h3>
          <p>
            <strong>{order.recipientName || 'Customer'}</strong><br />
            {order.addressLine1}{order.addressLine2 ? `, ${order.addressLine2}` : ''}<br />
            {order.city}, {order.state} {order.postalCode}
          </p>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th><th>Item</th><th>HSN/SAC</th><th>Qty</th><th>Rate</th><th>Taxable value</th>
            {invoice.hasTax && (intra ? <><th>CGST</th><th>SGST</th></> : <th>IGST</th>)}
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((line, index) => (
            <tr key={line.id}>
              <td>{index + 1}</td>
              <td>{line.name}{line.gstRate !== null && line.gstRate !== undefined ? <><br /><small>GST {line.gstRate}%</small></> : null}</td>
              <td>{line.hsnCode || '—'}</td>
              <td>{line.quantity}</td>
              <td className="num">{money.format(line.price)}</td>
              <td className="num">{money.format(line.taxable)}</td>
              {invoice.hasTax && (intra
                ? <><td className="num">{money.format(line.cgst)}</td><td className="num">{money.format(line.sgst)}</td></>
                : <td className="num">{money.format(line.igst)}</td>)}
              <td className="num">{money.format(line.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {invoice.hasTax && (
        <table className="invoice-hsn">
          <thead>
            <tr>
              <th>HSN/SAC</th><th>Taxable value</th><th>GST rate</th>
              {intra ? <><th>CGST</th><th>SGST</th></> : <th>IGST</th>}
            </tr>
          </thead>
          <tbody>
            {invoice.hsnSummary.map((row) => (
              <tr key={`${row.hsnCode}-${row.gstRate}`}>
                <td>{row.hsnCode || '—'}</td>
                <td className="num">{money.format(row.taxable)}</td>
                <td className="num">{row.gstRate ?? '—'}%</td>
                {intra ? <><td className="num">{money.format(row.cgst)}</td><td className="num">{money.format(row.sgst)}</td></> : <td className="num">{money.format(row.igst)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="invoice-summary">
        <p className="invoice-words"><strong>Amount in words</strong><br />{invoice.totalInWords}<br /><small>Total quantity: {invoice.totalQuantity}</small></p>
        <table className="invoice-totals">
          <tbody>
            <tr><td>Taxable value</td><td className="num">{money.format(invoice.taxable)}</td></tr>
            {invoice.hasTax && (intra
              ? <><tr><td>CGST</td><td className="num">{money.format(invoice.cgst)}</td></tr><tr><td>SGST</td><td className="num">{money.format(invoice.sgst)}</td></tr></>
              : <tr><td>IGST</td><td className="num">{money.format(invoice.igst)}</td></tr>)}
            <tr className="invoice-grand"><td><strong>Total</strong></td><td className="num"><strong>{money.format(invoice.total)}</strong></td></tr>
          </tbody>
        </table>
      </div>
      {!isTaxInvoice && <p className="invoice-note">{invoice.title === 'Bill of Supply' ? 'Seller is not registered for GST; no tax is charged.' : 'No GST charged on the items in this order.'}</p>}
      <footer className="invoice-footer">
        <div className="invoice-terms">
          <h3>Declaration</h3>
          <p>We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</p>
          <p className="invoice-note">This is a computer-generated invoice and does not require a signature.</p>
        </div>
        <div className="invoice-sign">
          <p>For {order.sellerLegalName || 'the seller'}</p>
          <span>Authorised signatory</span>
        </div>
      </footer>
    </section>
  );
}

const LABEL_PAGE_CSS = '@page { size: 50mm 30mm; margin: 0; }';
const LABEL_SHEET_PAGE_CSS = '@page { size: A4; margin: 8mm; }';

function printWithPage(pageCss) {
  const style = document.createElement('style');
  style.textContent = pageCss;
  document.head.appendChild(style);
  const cleanup = () => {
    style.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
}

function PrintLayer({ children }) {
  return createPortal(<div className="qr-print-layer">{children}</div>, document.body);
}

function usePrintJob(pageCss) {
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    if (!printing) return undefined;
    const startedAt = Date.now();
    const waitForImages = () => {
      const images = [...document.querySelectorAll('.qr-print-layer img')];
      const pending = document.querySelectorAll('.qr-print-layer .qr-sheet-label > span:first-child, .qr-print-layer .qr-print-single > span:first-child').length;
      const ready = images.length > 0 && !pending && images.every((image) => image.complete && image.naturalWidth > 0);
      if (ready || Date.now() - startedAt > 4000) {
        printWithPage(pageCss);
      } else {
        timer = window.setTimeout(waitForImages, 60);
      }
    };
    let timer = window.setTimeout(waitForImages, 50);
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', done);
    };
  }, [printing, pageCss]);
  return [printing, () => setPrinting(true)];
}

function PrintSheetButton({ units, productName }) {
  const [printing, startPrint] = usePrintJob(LABEL_SHEET_PAGE_CSS);
  return (
    <>
      <button type="button" className="primary-button" onClick={startPrint}>Print all labels</button>
      {printing && (
        <PrintLayer>
          <div className="qr-label-sheet">
            {units.map((unit) => (
              <QrSheetLabel
                key={unit.id}
                code={unitShortCode(unit.id)}
                name={productName}
                url={`${window.location.origin}/admin?unit=${encodeURIComponent(unit.id)}`}
              />
            ))}
          </div>
        </PrintLayer>
      )}
    </>
  );
}

function AdminQrLabel({
  url,
  title,
  identifier,
  description = 'Scan to open this record in the owner dashboard',
}) {
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');
  const [printing, startPrint] = usePrintJob(LABEL_PAGE_CSS);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 2, width: 240 })
      .then((result) => {
        if (active) setImageUrl(result);
      })
      .catch(() => {
        if (active) setError('Could not create this QR code.');
      });
    return () => { active = false; };
  }, [url]);

  return (
    <div className="admin-qr-label">
      {error ? <p role="alert">{error}</p> : imageUrl ? <img src={imageUrl} alt={`QR code for ${title}`} /> : <span>Creating QR code…</span>}
      <div>
        <strong>{title}</strong>
        <span>{identifier}</span>
        <small>{description}</small>
        <button className="secondary-button admin-qr-print-button" type="button" disabled={!imageUrl} onClick={startPrint}>
          Print QR label
        </button>
      </div>
      {printing && (
        <PrintLayer>
          <div className="qr-print-single">
            <img src={imageUrl} alt="" />
            <div><strong>{title}</strong><span>{identifier}</span></div>
          </div>
        </PrintLayer>
      )}
    </div>
  );
}

function QrScannerDialog({ title, hint, continuous = false, onScan, onClose }) {
  const videoRef = useRef(null);
  const onScanRef = useRef(onScan);
  const [cameraError, setCameraError] = useState('');
  const [manual, setManual] = useState('');
  const [lastResult, setLastResult] = useState('');
  onScanRef.current = onScan;

  useEffect(() => {
    let stopped = false;
    let stream;
    let timer;
    const recent = new Map();
    const handle = async (text) => {
      const now = Date.now();
      if (now - (recent.get(text) || 0) < 3000) return false;
      recent.set(text, now);
      const message = await onScanRef.current(text);
      if (message) setLastResult(message);
      return true;
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera is not available here (it needs HTTPS or localhost). Type the code below instead.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      } catch {
        setCameraError('Camera permission was blocked. Allow camera access, or type the code below.');
        return;
      }
      if (stopped) { stream.getTracks().forEach((track) => track.stop()); return; }
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play().catch(() => {});

      const detector = 'BarcodeDetector' in window ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null;
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });
      let jsQR = null;
      if (!detector) jsQR = (await import('jsqr')).default;

      const tick = async () => {
        if (stopped) return;
        let found = '';
        if (video.readyState >= 2 && video.videoWidth) {
          try {
            if (detector) {
              found = (await detector.detect(video))[0]?.rawValue || '';
            } else {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              context.drawImage(video, 0, 0);
              found = jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)?.data || '';
            }
          } catch {
            found = '';
          }
        }
        if (found && await handle(found) && !continuous) return;
        timer = window.setTimeout(tick, 250);
      };
      tick();
    };
    start();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [continuous]);

  const submitManual = async (event) => {
    event.preventDefault();
    const value = manual.trim();
    if (!value) return;
    setManual('');
    const message = await onScanRef.current(value);
    if (message) setLastResult(message);
  };

  return (
    <div className="qr-scanner-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="qr-scanner-card">
        <div className="qr-scanner-head">
          <strong>{title}</strong>
          <button className="ghost-button" type="button" onClick={onClose}>Done</button>
        </div>
        {cameraError ? <p className="admin-login-error" role="alert">{cameraError}</p> : (
          <div className="qr-scanner-view">
            <video ref={videoRef} playsInline muted />
            <span className="qr-scanner-frame" aria-hidden="true" />
          </div>
        )}
        <p className="qr-scanner-hint">{hint}</p>
        {lastResult && <p className="qr-scanner-result" role="status">{lastResult}</p>}
        <form className="qr-scanner-manual" onSubmit={submitManual}>
          <input value={manual} onChange={(event) => setManual(event.target.value)} placeholder="Type or paste a code, e.g. 3F2B8C1E" aria-label="Label code" />
          <button className="secondary-button" type="submit">Look up</button>
        </form>
      </div>
    </div>
  );
}

function QrSheetLabel({ url, code, name }) {
  const [imageUrl, setImageUrl] = useState('');
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(url, { errorCorrectionLevel: 'Q', margin: 1, width: 200 })
      .then((result) => { if (active) setImageUrl(result); })
      .catch(() => {});
    return () => { active = false; };
  }, [url]);
  return (
    <div className="qr-sheet-label">
      {imageUrl ? <img src={imageUrl} alt={`QR code ${code}`} /> : <span>…</span>}
      <strong>{code}</strong>
      <span>{name}</span>
    </div>
  );
}

function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load Razorpay Checkout. Check your connection and try again.'));
    document.head.appendChild(script);
  });
}

function normalizeIndianMobile(value) {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
  return digits.slice(0, 10);
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  if (response.status === 204) return null;

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || 'The request could not be completed.');
  }

  return result;
}

function AccountRecoveryPanel({ initialAccountType = 'customer', allowAccountTypeSelection = false, onBack }) {
  const [options, setOptions] = useState(null);
  const [stage, setStage] = useState('request');
  const [accountType, setAccountType] = useState(
    ['customer', 'employee', 'delivery'].includes(initialAccountType) ? initialAccountType : 'customer',
  );
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    apiRequest('/api/recovery/options')
      .then((result) => { if (active) setOptions(result); })
      .catch((requestError) => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (stage === 'request') {
        const result = await apiRequest('/api/recovery/email/request', {
          method: 'POST',
          body: JSON.stringify({ accountType, email }),
        });
        setNotice(result.message);
        setStage('complete');
        return;
      }

      const result = await apiRequest('/api/recovery/email/complete', {
        method: 'POST',
        body: JSON.stringify({ accountType, email, code, password }),
      });
      setNotice(result.message);
      setStage('done');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const startOver = () => {
    setStage('request');
    setNotice('');
    setError('');
    setCode('');
    setPassword('');
  };

  return (
    <section className="account-recovery-panel" aria-labelledby="account-recovery-title">
      <p className="eyebrow">Secure account access</p>
      <h2 id="account-recovery-title">Recover your account</h2>
      <p className="admin-login-copy">Reset your password using a one-time code sent to the email address on your account.</p>
      {!options ? (
        <>
          <p role={error ? 'alert' : 'status'}>{error || 'Checking recovery options…'}</p>
          {error && <button className="secondary-button" type="button" onClick={() => window.location.reload()}>Retry</button>}
        </>
      ) : (
        <>
          {!options.emailEnabled && (
            <p className="admin-login-copy" role="status">Recovery delivery is not configured yet. Contact the store owner to reset your account.</p>
          )}
          <form className="admin-login-form" onSubmit={handleSubmit}>
            {allowAccountTypeSelection && (
              <label>Account type
                <select value={accountType} onChange={(event) => setAccountType(event.target.value)}>
                  <option value="customer">Customer</option>
                  <option value="employee">Employee</option>
                  <option value="delivery">Delivery staff</option>
                </select>
              </label>
            )}
            <label>Email address
              <input type="email" autoComplete="email" required maxLength="254" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            {stage === 'complete' && (
              <>
                <label>Six-digit code
                  <input inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength="6" value={code} onChange={(event) => setCode(event.target.value)} />
                </label>
                <label>New password
                  <input type="password" autoComplete="new-password" required minLength="12" maxLength="256" value={password} onChange={(event) => setPassword(event.target.value)} />
                </label>
              </>
            )}
            {error && <p className="admin-login-error" role="alert">{error}</p>}
            {notice && <p className="account-notice" role="status">{notice}</p>}
            <p className="admin-login-copy">Forgot which email you used? Contact the store owner or customer support to verify your identity.</p>
            <div className="admin-login-actions">
              {stage === 'request' ? (
                <button className="primary-button" type="submit" disabled={busy || !options.emailEnabled}>
                  {busy ? 'Sending…' : 'Send reset code'}
                </button>
              ) : stage !== 'done' ? (
                <>
                  <button className="secondary-button" type="button" onClick={startOver}>Start over</button>
                  <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Verifying…' : 'Continue'}</button>
                </>
              ) : (
                <button className="secondary-button" type="button" onClick={startOver}>Use another method</button>
              )}
              <button className="secondary-button" type="button" onClick={onBack}>Back to sign in</button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}

function AdminSalesChart({ data }) {
  const width = 760;
  const height = 240;
  const padding = { top: 18, right: 18, bottom: 34, left: 62 };
  const values = data.map((day) => Number(day.revenue) || 0);
  const max = Math.max(1, ...values);
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const points = values.map((value, index) => ({
    x: padding.left + (data.length < 2 ? chartWidth / 2 : (index / (data.length - 1)) * chartWidth),
    y: padding.top + chartHeight - (value / max) * chartHeight,
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(' ');
  const labels = [0, Math.floor((data.length - 1) / 3), Math.floor((data.length - 1) * 2 / 3), data.length - 1]
    .filter((index, position, indexes) => index >= 0 && indexes.indexOf(index) === position);

  return (
    <div className="admin-chart-scroll">
      <svg className="admin-sales-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Daily live-mode Razorpay collections in Indian rupees">
        <title>Daily live-mode Razorpay collections, in INR</title>
        {[0, 0.5, 1].map((fraction) => {
          const y = padding.top + chartHeight * fraction;
          return (
            <g key={fraction}>
              <line className="admin-chart-grid" x1={padding.left} x2={width - padding.right} y1={y} y2={y} />
              <text className="admin-chart-axis" x={padding.left - 9} y={y + 4} textAnchor="end">
                {money.format(max * (1 - fraction))}
              </text>
            </g>
          );
        })}
        {points.length > 1 && <polyline className="admin-chart-line" points={line} />}
        {points.map((point, index) => (
          <circle className="admin-chart-point" cx={point.x} cy={point.y} r="3.5" key={data[index].date}>
            <title>{`${indiaDate.format(new Date(`${data[index].date}T12:00:00+05:30`))}: ${money.format(values[index])}`}</title>
          </circle>
        ))}
        {labels.map((index) => (
          <text
            className="admin-chart-axis"
            x={points[index]?.x ?? padding.left}
            y={height - 7}
            textAnchor={index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle'}
            key={index}
          >
            {data[index]?.date
              ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
                .format(new Date(`${data[index].date}T12:00:00+05:30`))
              : ''}
          </text>
        ))}
      </svg>
    </div>
  );
}

function percentageChange(current, previous) {
  const now = Number(current) || 0;
  const before = Number(previous) || 0;
  if (before === 0) return null;
  return ((now - before) / before) * 100;
}

function App() {
  const [products, setProducts] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [sortBy, setSortBy] = useState('featured');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('Living Room');
  const [cart, setCart] = useState(() => {
    try {
      const savedCart = JSON.parse(window.localStorage.getItem('sste-cart') || '[]');
      return Array.isArray(savedCart) ? savedCart : [];
    } catch {
      return [];
    }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [checkoutMessage, setCheckoutMessage] = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState('address');
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('all');
  const [shippingAddress, setShippingAddress] = useState({
    recipientName: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
  });
  const isAdminPath = typeof window !== 'undefined' && window.location.pathname === '/admin';
  const isAccountPath = typeof window !== 'undefined' && window.location.pathname === '/account';
  const isDeliveryPath = typeof window !== 'undefined' && window.location.pathname === '/delivery';
  const isEmployeePath = typeof window !== 'undefined' && window.location.pathname === '/employee';
  const isPosPath = typeof window !== 'undefined' && window.location.pathname === '/pos';
  const [adminMode, setAdminMode] = useState(false);
  const [adminChecking, setAdminChecking] = useState(isAdminPath);
  const [deliveryChecking, setDeliveryChecking] = useState(isDeliveryPath);
  const [employeeChecking, setEmployeeChecking] = useState(isEmployeePath);
  const [employee, setEmployee] = useState(null);
  const [employeeCredentials, setEmployeeCredentials] = useState({ email: '', password: '' });
  const [employeeError, setEmployeeError] = useState('');
  const [employeeRecovering, setEmployeeRecovering] = useState(false);
  const [employeeNotice, setEmployeeNotice] = useState('');
  const [employeeWorkspace, setEmployeeWorkspace] = useState(null);
  const [employeeProducts, setEmployeeProducts] = useState([]);
  const [employeeTickets, setEmployeeTickets] = useState([]);
  const [employeeFinance, setEmployeeFinance] = useState(null);
  const [employeeFinanceOrders, setEmployeeFinanceOrders] = useState([]);
  const [employeeInventoryDrafts, setEmployeeInventoryDrafts] = useState({});
  const [employeeSupportDrafts, setEmployeeSupportDrafts] = useState({});
  const [employeeFinanceEntry, setEmployeeFinanceEntry] = useState({
    entryType: 'expense', amount: '', category: '', orderId: '', reference: '', note: '', direction: 'out',
  });
  const [deliveryAgent, setDeliveryAgent] = useState(null);
  const [deliveryCredentials, setDeliveryCredentials] = useState({ email: '', password: '' });
  const [deliveryAssignments, setDeliveryAssignments] = useState([]);
  const [deliveryError, setDeliveryError] = useState('');
  const [deliveryRecovering, setDeliveryRecovering] = useState(false);
  const [deliveryNotice, setDeliveryNotice] = useState('');
  const [scannerMode, setScannerMode] = useState('');
  const [labelSheetProductId, setLabelSheetProductId] = useState('');
  const [deliveryPinDrafts, setDeliveryPinDrafts] = useState({});
  const [deliveryBusyId, setDeliveryBusyId] = useState('');
  const [deliveryActionId, setDeliveryActionId] = useState('');
  const [deliveryNoteDrafts, setDeliveryNoteDrafts] = useState({});
  const [deliveryFocusUnitId, setDeliveryFocusUnitId] = useState(
    () => new URLSearchParams(window.location.search).get('unit'),
  );
  const [deliveryFocusOrderId] = useState(
    () => new URLSearchParams(window.location.search).get('order'),
  );
  const [adminOrders, setAdminOrders] = useState([]);
  const [adminFinance, setAdminFinance] = useState(null);
  const [adminTaxProfile, setAdminTaxProfile] = useState(null);
  const [adminCrmStatus, setAdminCrmStatus] = useState(null);
  const [crmSyncing, setCrmSyncing] = useState(false);
  const [crmNotice, setCrmNotice] = useState('');
  const [adminEmployees, setAdminEmployees] = useState([]);
  const [newEmployee, setNewEmployee] = useState({ name: '', email: '', role: 'inventory', password: '' });
  const [employeeResetDrafts, setEmployeeResetDrafts] = useState({});
  const [employeeEventLogs, setEmployeeEventLogs] = useState({});
  const [adminEmployeeNotice, setAdminEmployeeNotice] = useState('');
  const [taxInvoiceOrder, setTaxInvoiceOrder] = useState(null);
  const [financeEntryDraft, setFinanceEntryDraft] = useState({
    entryType: 'expense',
    amount: '',
    category: '',
    direction: 'out',
    orderId: '',
    reference: '',
    note: '',
  });
  const [financeNotice, setFinanceNotice] = useState('');
  const [taxProfileNotice, setTaxProfileNotice] = useState('');
  const [productTaxDrafts, setProductTaxDrafts] = useState({});
  const [adminPaymentSettings, setAdminPaymentSettings] = useState(null);
  const [adminAnalytics, setAdminAnalytics] = useState(null);
  const [adminAnalyticsRange, setAdminAnalyticsRange] = useState(30);
  const [adminAnalyticsLoading, setAdminAnalyticsLoading] = useState(false);
  const [adminAiStatus, setAdminAiStatus] = useState(null);
  const [adminAiQuestion, setAdminAiQuestion] = useState('');
  const [adminAiAnswer, setAdminAiAnswer] = useState(null);
  const [adminAiLoading, setAdminAiLoading] = useState(false);
  const [adminAiError, setAdminAiError] = useState('');
  const [activeAdminQr, setActiveAdminQr] = useState(null);
  const [inventoryUnitsByProduct, setInventoryUnitsByProduct] = useState({});
  const [openUnitProductId, setOpenUnitProductId] = useState(null);
  const [deliveryAgents, setDeliveryAgents] = useState([]);
  const [adminDeliveries, setAdminDeliveries] = useState([]);
  const [pickupAddress, setPickupAddress] = useState('');
  const [newDeliveryAgent, setNewDeliveryAgent] = useState({ name: '', email: '', password: '' });
  const [deliveryAgentNotice, setDeliveryAgentNotice] = useState({ type: '', text: '' });
  const [deliveryAgentDrafts, setDeliveryAgentDrafts] = useState({});
  const [deliveryAssignmentDrafts, setDeliveryAssignmentDrafts] = useState({});
  const [qrFocus, setQrFocus] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('product')) return { type: 'product', id: params.get('product') };
    if (params.has('order')) return { type: 'order', id: params.get('order') };
    if (params.has('unit')) return { type: 'unit', id: params.get('unit') };
    return null;
  });
  const [inventoryMovements, setInventoryMovements] = useState([]);
  const [inventoryDrafts, setInventoryDrafts] = useState({});
  const [adminSupportTickets, setAdminSupportTickets] = useState([]);
  const [adminFeedback, setAdminFeedback] = useState([]);
  const [supportReplyDrafts, setSupportReplyDrafts] = useState({});
  const [adminCredentials, setAdminCredentials] = useState({
    email: '',
    password: '',
  });
  const [adminError, setAdminError] = useState('');
  const [customer, setCustomer] = useState(null);
  const [customerChecking, setCustomerChecking] = useState(isAccountPath);
  const [customerMode, setCustomerMode] = useState(
    () => new URLSearchParams(window.location.search).has('recover') ? 'recovery' : 'login',
  );
  const [customerCredentials, setCustomerCredentials] = useState({ email: '', password: '' });
  const [customerError, setCustomerError] = useState('');
  const [customerNotice, setCustomerNotice] = useState('');
  const [customerOrders, setCustomerOrders] = useState([]);
  const [supportTickets, setSupportTickets] = useState([]);
  const [accountFeedback, setAccountFeedback] = useState([]);
  const [supportForm, setSupportForm] = useState({
    category: 'order',
    subject: '',
    orderId: '',
    message: '',
  });
  const [supportError, setSupportError] = useState('');
  const [supportNotice, setSupportNotice] = useState('');
  const [supportReply, setSupportReply] = useState({});
  const [feedbackDrafts, setFeedbackDrafts] = useState({});
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [productsError, setProductsError] = useState('');
  const [productsLoading, setProductsLoading] = useState(true);
  const [paymentOptions, setPaymentOptions] = useState({
    razorpayEnabled: false,
    razorpayMode: null,
    demoEnabled: import.meta.env.DEV,
  });
  const [taxOptions, setTaxOptions] = useState({ checkoutReady: false, message: 'Checking the store tax setup…' });
  const [newProduct, setNewProduct] = useState({
    name: '',
    category: 'Furniture',
    price: '',
    gstRate: '',
    hsnCode: '',
    accent: '',
    tag: 'New',
    image: '',
    description: '',
    published: true,
  });
  const searchInputRef = useRef(null);
  const catalogSectionRef = useRef(null);

  useEffect(() => {
    if (!taxInvoiceOrder) return undefined;
    const printTimer = window.setTimeout(() => window.print(), 0);
    const clearInvoice = () => setTaxInvoiceOrder(null);
    window.addEventListener('afterprint', clearInvoice);
    return () => {
      window.clearTimeout(printTimer);
      window.removeEventListener('afterprint', clearInvoice);
    };
  }, [taxInvoiceOrder]);

  async function loadInventoryUnits(productId, offset = 0, append = false) {
    setInventoryUnitsByProduct((previous) => ({
      ...previous,
      [productId]: { ...previous[productId], loading: true, error: '' },
    }));
    try {
      const result = await apiRequest(
        `/api/admin/products/${encodeURIComponent(productId)}/units?limit=50&offset=${offset}`,
      );
      setInventoryUnitsByProduct((previous) => ({
        ...previous,
        [productId]: {
          units: append ? [...(previous[productId]?.units || []), ...result.units] : result.units,
          total: result.total,
          offset: result.offset,
          loading: false,
          error: '',
        },
      }));
    } catch (error) {
      setInventoryUnitsByProduct((previous) => ({
        ...previous,
        [productId]: { ...previous[productId], loading: false, error: error.message },
      }));
    }
  }

  async function loadDeliveryAssignments() {
    const result = await apiRequest('/api/delivery/assignments');
    setDeliveryAssignments(result.assignments);
    setPickupAddress(result.pickupAddress || '');
  }

  async function loadAdminDashboardData(range = adminAnalyticsRange, silent = false) {
    if (!silent) setAdminAnalyticsLoading(true);
    try {
      const [
        adminProducts,
        orders,
        paymentSettings,
        analytics,
        aiStatus,
        movements,
        tickets,
        feedback,
        agents,
        deliveryData,
        finance,
        taxProfile,
        employees,
        crmStatus,
      ] = await Promise.all([
        apiRequest('/api/admin/products'),
        apiRequest('/api/admin/orders'),
        apiRequest('/api/admin/payment-settings'),
        apiRequest(`/api/admin/analytics?range=${range}`),
        apiRequest('/api/admin/ai/status'),
        apiRequest('/api/admin/inventory/movements?limit=12'),
        apiRequest('/api/admin/support/tickets'),
        apiRequest('/api/admin/feedback'),
        apiRequest('/api/admin/delivery/agents'),
        apiRequest('/api/admin/deliveries'),
        apiRequest(`/api/admin/finance?range=${range}`),
        apiRequest('/api/admin/tax-profile'),
        apiRequest('/api/admin/employees'),
        apiRequest('/api/admin/crm/status'),
      ]);
      setProducts(adminProducts);
      setAdminOrders(orders);
      setAdminPaymentSettings(paymentSettings);
      setAdminAnalytics(analytics);
      setAdminAiStatus(aiStatus);
      setInventoryMovements(movements);
      setAdminSupportTickets(tickets);
      setAdminFeedback(feedback);
      setDeliveryAgents(agents);
      setAdminDeliveries(deliveryData.deliveries);
      setAdminFinance(finance);
      setAdminTaxProfile(taxProfile);
      setAdminEmployees(employees);
      setAdminCrmStatus(crmStatus);
      setPickupAddress(deliveryData.pickupAddress || '');
      setAdminAnalyticsRange(range);
    } finally {
      if (!silent) setAdminAnalyticsLoading(false);
    }
  }

  async function loadAdminLiveData() {
    const apply = (path, handler) => apiRequest(path).then(handler).catch(() => {});
    await Promise.all([
      apply('/api/admin/orders', setAdminOrders),
      apply('/api/admin/deliveries', (data) => {
        setAdminDeliveries(data.deliveries);
        setPickupAddress(data.pickupAddress || '');
      }),
      apply('/api/admin/products', setProducts),
      apply('/api/admin/support/tickets', setAdminSupportTickets),
      apply('/api/admin/inventory/movements?limit=12', setInventoryMovements),
      apply('/api/admin/ai/status', setAdminAiStatus),
      apply('/api/admin/delivery/agents', setDeliveryAgents),
      apply('/api/admin/feedback', setAdminFeedback),
    ]);
  }

  async function loadEmployeeWorkspace(employeeInfo) {
    const workspace = await apiRequest('/api/employee/workspace');
    setEmployee(employeeInfo);
    setEmployeeWorkspace(workspace);
    if (employeeInfo.role === 'inventory') {
      setEmployeeProducts(await apiRequest('/api/admin/products'));
    } else if (employeeInfo.role === 'support') {
      setEmployeeTickets(await apiRequest('/api/admin/support/tickets'));
    } else if (employeeInfo.role === 'finance') {
      const [finance, orders] = await Promise.all([
        apiRequest('/api/admin/finance?range=30'),
        apiRequest('/api/admin/finance/orders'),
      ]);
      setEmployeeFinance(finance);
      setEmployeeFinanceOrders(orders);
    }
  }

  async function refreshAdminAnalytics(range) {
    const selectedRange = range ?? adminAnalyticsRange;
    setAdminAnalyticsLoading(true);
    setAdminAiAnswer(null);
    try {
      const analytics = await apiRequest(`/api/admin/analytics?range=${selectedRange}`);
      setAdminAnalytics(analytics);
      setAdminAnalyticsRange(selectedRange);
      setAdminError('');
    } catch (error) {
      setAdminError(error.message);
    } finally {
      setAdminAnalyticsLoading(false);
    }
  }

  const [activeAdminSection, setActiveAdminSection] = useState('');
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const main = document.querySelector('main');
    if (main && !main.id) {
      main.id = 'main-content';
      main.tabIndex = -1;
    }
    const titles = {
      '/admin': 'Owner dashboard',
      '/pos': 'Point of sale',
      '/employee': 'Employee workspace',
      '/delivery': 'Delivery operations',
      '/account': 'Your account',
    };
    const section = titles[window.location.pathname];
    document.title = section ? `${section} · SSTE Studio` : 'SSTE Studio — Home essentials for India';
  });

  useEffect(() => {
    const topbar = document.querySelector('.topbar');
    if (!topbar) return undefined;
    const apply = () => document.documentElement.style.setProperty('--topbar-h', `${topbar.offsetHeight}px`);
    apply();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(apply);
    observer?.observe(topbar);
    window.addEventListener('resize', apply);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', apply);
    };
  });

  useEffect(() => {
    if (!adminMode) return undefined;
    const ids = ['admin-analytics', 'admin-ai', 'admin-finance', 'admin-crm', 'admin-employees', 'admin-inventory', 'payment-settings', 'admin-products', 'admin-orders', 'admin-logistics', 'admin-support', 'admin-feedback'];
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.3;
      let current = '';
      for (const id of ids) {
        const element = document.getElementById(id);
        if (element && element.getBoundingClientRect().top <= line) current = id;
      }
      setActiveAdminSection(current);
      setShowBackToTop(window.scrollY > 700);
    };
    const onScroll = () => { if (!frame) frame = window.setTimeout(update, 60); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.clearTimeout(frame);
    };
  }, [adminMode]);

  const liveRefreshRef = useRef(null);
  const lastFullAdminLoad = useRef(Date.now());
  liveRefreshRef.current = async () => {
    try {
      if (isAdminPath) {
        if (adminMode) {
          await loadAdminLiveData();
          if (Date.now() - lastFullAdminLoad.current > 15000) {
            lastFullAdminLoad.current = Date.now();
            await loadAdminDashboardData(adminAnalyticsRange, true);
          }
        }
      } else if (isDeliveryPath) {
        if (deliveryAgent) await loadDeliveryAssignments();
      } else if (isEmployeePath) {
        if (employee) await loadEmployeeWorkspace(employee);
      } else if (isAccountPath) {
        if (customer) {
          const [orders, tickets, feedback] = await Promise.all([
            apiRequest('/api/account/orders'),
            apiRequest('/api/support/tickets'),
            apiRequest('/api/account/feedback'),
          ]);
          setCustomerOrders(orders);
          setSupportTickets(tickets);
          setAccountFeedback(feedback);
        }
      } else {
        setProducts(await apiRequest('/api/products'));
      }
    } catch {
      // A failed background refresh keeps the data already on screen.
    }
  };

  useEffect(() => {
    if (typeof EventSource === 'undefined') return undefined;
    let running = false;
    let queued = false;
    const run = async () => {
      if (running) { queued = true; return; }
      running = true;
      try { await liveRefreshRef.current?.(); } finally { running = false; }
      if (queued) { queued = false; run(); }
    };
    const refresh = () => { run(); };
    const source = new EventSource('/api/events');
    source.addEventListener('change', refresh);
    source.addEventListener('hello', refresh);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, 8000);
    return () => {
      clearInterval(poll);
      source.close();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const aiAnalystOn = Boolean(adminAiStatus?.configured) && (adminAiStatus?.agents?.find((agent) => agent.key === 'bi_analyst')?.effectiveEnabled ?? true);

  const toggleAiAgent = async (key, enabled) => {
    setAdminAiError('');
    try {
      const result = await apiRequest(`/api/admin/ai/agents/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled }),
      });
      setAdminAiStatus((current) => ({ ...current, agents: result.agents }));
    } catch (error) {
      setAdminAiError(error.message);
    }
  };

  const askAdminAi = async (event) => {
    event.preventDefault();
    setAdminAiLoading(true);
    setAdminAiError('');
    setAdminAiAnswer(null);
    try {
      const answer = await apiRequest('/api/admin/ai/ask', {
        method: 'POST',
        body: JSON.stringify({
          question: adminAiQuestion,
          rangeDays: adminAnalyticsRange,
        }),
      });
      setAdminAiAnswer(answer);
    } catch (error) {
      setAdminAiError(error.message);
    } finally {
      setAdminAiLoading(false);
    }
  };

  useEffect(() => {
    window.localStorage.setItem('sste-cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (!adminMode || !qrFocus) return;
    let active = true;
    if (qrFocus.type === 'unit') {
      apiRequest(`/api/admin/inventory/units/${encodeURIComponent(qrFocus.id)}`)
        .then((unit) => {
          if (!active) return;
          setQrFocus({ type: 'product', id: unit.productId, unitId: unit.id });
          setActiveAdminQr({ type: 'unit', id: unit.id });
        })
        .catch((error) => {
          if (active) setAdminError(error.message);
        });
      return () => { active = false; };
    }
    if (qrFocus.type === 'product') {
      setOpenUnitProductId(qrFocus.id);
      setActiveAdminQr(qrFocus.unitId ? { type: 'unit', id: qrFocus.unitId } : null);
      loadInventoryUnits(qrFocus.id);
    }
    const target = document.getElementById(
      qrFocus.type === 'order'
        ? `admin-order-${qrFocus.id}`
        : `inventory-product-${qrFocus.id}`,
    );
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return () => { active = false; };
  }, [adminMode, qrFocus]);

  useEffect(() => {
    if (!deliveryAgent) return;
    const assignment = deliveryFocusUnitId
      ? deliveryAssignments.find((item) => item.items.some((line) => line.units.some((unit) => unit.id === deliveryFocusUnitId)))
      : deliveryAssignments.find((item) => item.orderId === deliveryFocusOrderId);
    const targetId = deliveryFocusUnitId
      ? `delivery-unit-${deliveryFocusUnitId}`
      : deliveryFocusOrderId ? `delivery-order-${deliveryFocusOrderId}` : '';
    if (assignment && targetId) {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if ((deliveryFocusOrderId || deliveryFocusUnitId) && deliveryAssignments.length) {
      setDeliveryError('That QR code is not part of a delivery assigned to your account.');
    }
  }, [deliveryAgent, deliveryAssignments, deliveryFocusOrderId, deliveryFocusUnitId]);

  useEffect(() => {
    const closeOverlays = (event) => {
      if (event.key === 'Escape') {
        setCartOpen(false);
        setSelectedProduct(null);
      }
    };

    window.addEventListener('keydown', closeOverlays);
    return () => window.removeEventListener('keydown', closeOverlays);
  }, []);

  useEffect(() => {
    let active = true;

    const loadProducts = async () => {
      setProductsLoading(true);
      setProductsError('');

      try {
        if (isAdminPath) {
          const session = await apiRequest('/api/admin/session');
          if (!active) return;

          if (session.authenticated) {
            await loadAdminDashboardData(30);
            if (!active) return;
            setAdminMode(true);
          } else {
            setProducts([]);
          }
        } else if (isDeliveryPath) {
          const session = await apiRequest('/api/delivery/session');
          if (!active) return;
          setDeliveryAgent(session.agent);
          if (session.authenticated) {
            const result = await apiRequest('/api/delivery/assignments');
            if (!active) return;
            setDeliveryAssignments(result.assignments);
            setPickupAddress(result.pickupAddress || '');
          }
        } else if (isEmployeePath) {
          const session = await apiRequest('/api/employee/session');
          if (!active) return;
          if (session.authenticated) await loadEmployeeWorkspace(session.employee);
        } else if (isAccountPath) {
          const session = await apiRequest('/api/account/session');
          if (!active) return;
          setCustomer(session.customer);
          if (session.authenticated) {
            setOrdersLoading(true);
            const [orders, tickets, feedback] = await Promise.all([
              apiRequest('/api/account/orders'),
              apiRequest('/api/support/tickets'),
              apiRequest('/api/account/feedback'),
            ]);
            if (!active) return;
            setCustomerOrders(orders);
            setSupportTickets(tickets);
            setAccountFeedback(feedback);
          }
        } else {
          const [productResult, customerResult, paymentResult, taxResult] = await Promise.allSettled([
            apiRequest('/api/products'),
            apiRequest('/api/account/session'),
            apiRequest('/api/payment-options'),
            apiRequest('/api/tax-options'),
          ]);
          if (!active) return;
          if (productResult.status === 'fulfilled') {
            setProducts(productResult.value);
          } else {
            setProductsError(productResult.reason.message);
          }
          if (customerResult.status === 'fulfilled') {
            setCustomer(customerResult.value.customer);
          }
          if (paymentResult.status === 'fulfilled') {
            setPaymentOptions(paymentResult.value);
          }
          if (taxResult.status === 'fulfilled') {
            setTaxOptions(taxResult.value);
          } else {
            setTaxOptions({
              checkoutReady: false,
              message: 'Store tax settings could not be verified. Checkout is paused until they are available.',
            });
          }
        }
      } catch (error) {
        if (!active) return;
        if (isAdminPath) setAdminError(error.message);
        else if (isDeliveryPath) setDeliveryError(error.message);
        else if (isEmployeePath) setEmployeeError(error.message);
        else if (isAccountPath) setCustomerError(error.message);
        else setProductsError(error.message);
      } finally {
        if (active) {
          setAdminChecking(false);
          setProductsLoading(false);
          setCustomerChecking(false);
          setOrdersLoading(false);
          setDeliveryChecking(false);
          setEmployeeChecking(false);
        }
      }
    };

    loadProducts();
    return () => {
      active = false;
    };
  }, [isAccountPath, isAdminPath, isDeliveryPath, isEmployeePath]);

  const activeCollection =
    collections.find((collection) => collection.title === selectedRoom) ?? collections[0];

  const visibleProducts = useMemo(
    () => products.filter((product) => product.published !== false),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const filtered = visibleProducts.filter((product) => {
      const matchesCategory =
        activeCategory === 'All' || product.category === activeCategory;
      const matchesSearch = product.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });

    switch (sortBy) {
      case 'low-to-high':
        return [...filtered].sort((a, b) => a.price - b.price);
      case 'high-to-low':
        return [...filtered].sort((a, b) => b.price - a.price);
      case 'rating':
        return [...filtered].sort((a, b) => b.rating - a.rating);
      default:
        return filtered;
    }
  }, [activeCategory, searchTerm, sortBy, visibleProducts]);

  const cartItems = cart
    .map((entry) => {
      const product = visibleProducts.find((item) => item.id === entry.id);
      return product ? { ...product, quantity: entry.quantity } : null;
    })
    .filter(Boolean);

  const unavailableCartItems = cartItems.filter((item) => item.inStock === false);
  const unconfiguredTaxCartItems = cartItems.filter((item) => item.gstRate === null || item.gstRate === undefined);
  const taxCheckoutBlocked = unconfiguredTaxCartItems.length > 0 || !taxOptions.checkoutReady;
  const taxableSubtotalPaise = cartItems.reduce(
    (sum, item) => sum + Math.round(item.price * 100) * item.quantity,
    0,
  );
  const estimatedTaxPaise = cartItems.reduce((sum, item) => {
    if (item.gstRate === null || item.gstRate === undefined) return sum;
    const lineBasePaise = Math.round(item.price * 100) * item.quantity;
    return sum + Math.round((lineBasePaise * Math.round(Number(item.gstRate) * 100)) / 10000);
  }, 0);
  const subtotal = taxableSubtotalPaise / 100;
  const estimatedTax = estimatedTaxPaise / 100;
  const checkoutTotal = subtotal + estimatedTax;
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const draftCount = products.filter((item) => item.published === false).length;
  const publishedCount = visibleProducts.length;
  const trackedProducts = products.filter((item) => item.inventoryTrackingEnabled);
  const lowStockProducts = trackedProducts.filter(
    (item) => item.stockOnHand - item.reservedQuantity <= item.reorderLevel,
  );
  const outOfStockProducts = trackedProducts.filter(
    (item) => item.stockOnHand - item.reservedQuantity <= 0,
  );
  const availableInventoryUnits = trackedProducts.reduce(
    (sum, item) => sum + item.stockOnHand - item.reservedQuantity,
    0,
  );
  const openSupportTickets = adminSupportTickets.filter(
    (ticket) => ['open', 'in_progress'].includes(ticket.status),
  );
  const pendingFeedbackCount = adminFeedback.filter((item) => item.status === 'pending').length;

  const addToCart = (product, quantity = 1) => {
    setCartOpen(true);
    setCart((previous) => {
      const existing = previous.find((item) => item.id === product.id);

      if (existing) {
        return previous.map((item) =>
          item.id === product.id
            ? { ...item, quantity: Math.min(99, item.quantity + quantity) }
            : item,
        );
      }

      return [...previous, { id: product.id, quantity: Math.min(99, quantity) }];
    });
  };

  const updateQuantity = (productId, delta) => {
    setCart((previous) =>
      previous
        .map((item) =>
          item.id === productId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const openQuickView = (product) => {
    setSelectedProduct(product);
  };

  const closeQuickView = () => {
    setSelectedProduct(null);
  };

  const handleSearchAction = () => {
    searchInputRef.current?.focus();
    catalogSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCollectionExplore = (collectionTitle) => {
    setSelectedRoom(collectionTitle);
    setActiveCategory('All');
    setSearchTerm('');
    catalogSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const continueToPayment = (event) => {
    event.preventDefault();
    if (cartItems.length === 0) {
      setCheckoutMessage('Add something to your bag before checking out.');
      return;
    }

    if (!customer) {
      setCheckoutMessage('Sign in or create an account to save your order history before checkout.');
      return;
    }

    if (taxCheckoutBlocked) {
      setCheckoutMessage(taxOptions.message || 'The store tax setup must be reviewed before checkout.');
      return;
    }

    setCheckoutMessage('');
    setCheckoutStep('payment');
  };

  const completeCheckoutOrder = (order, message) => {
    setCart([]);
    setCartOpen(false);
    setCheckoutOpen(false);
    setCheckoutStep('address');
    setShippingAddress({
      recipientName: '',
      phone: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      postalCode: '',
    });
    setCustomerOrders((previous) => [order, ...previous]);
    setCheckoutMessage(message);
  };

  const placeDemoUpiOrder = async (simulateSuccess) => {
    if (!simulateSuccess) {
      setCheckoutMessage('Test payment failed. No order was placed and no money moved.');
      return;
    }

    setCheckoutSubmitting(true);
    try {
      const result = await apiRequest('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          items: cartItems.map((item) => ({ productId: item.id, quantity: item.quantity })),
          shippingAddress,
          paymentMode: 'demo_upi_success',
        }),
      });
      completeCheckoutOrder(
        result.order,
        `Test UPI payment passed for ${money.format(result.order.total)}. Order ${result.order.orderNumber} was saved. No money moved.`,
      );
    } catch (error) {
      setCheckoutMessage(error.message);
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  const startRazorpayPayment = async () => {
    setCheckoutSubmitting(true);
    setCheckoutMessage('');
    try {
      const order = await apiRequest('/api/payments/razorpay/orders', {
        method: 'POST',
        body: JSON.stringify({
          items: cartItems.map((item) => ({ productId: item.id, quantity: item.quantity })),
          shippingAddress,
        }),
      });
      await loadRazorpayCheckout();

      let paymentResolutionStarted = false;
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: order.name,
        description: order.description,
        order_id: order.razorpayOrderId,
        prefill: order.prefill,
        theme: { color: '#775c49' },
        ...(selectedPaymentMethod === 'all'
          ? {}
          : { method: razorpayMethodOptions(selectedPaymentMethod) }),
        handler: async (paymentResponse) => {
          paymentResolutionStarted = true;
          try {
            const verified = await apiRequest('/api/payments/razorpay/verify', {
              method: 'POST',
              body: JSON.stringify({ orderId: order.orderId, ...paymentResponse }),
            });
            completeCheckoutOrder(
              verified.order,
              `Payment verified by Razorpay. Order ${verified.order.orderNumber} was placed.`,
            );
          } catch (error) {
            setCheckoutMessage(error.message);
          } finally {
            setCheckoutSubmitting(false);
          }
        },
        modal: {
          ondismiss: async () => {
            if (paymentResolutionStarted) return;
            try {
              await apiRequest('/api/payments/razorpay/failure', {
                method: 'POST',
                body: JSON.stringify({ orderId: order.orderId }),
              });
              setCheckoutMessage('Checkout was closed. The stock reservation has been released; you can try again any time.');
            } catch (error) {
              setCheckoutMessage(`Checkout was closed, but the stock reservation could not be released: ${error.message}`);
            } finally {
              setCheckoutSubmitting(false);
            }
          },
        },
      });
      checkout.on('payment.failed', async (failure) => {
        paymentResolutionStarted = true;
        let failureMessage = failure.error?.description || 'Razorpay could not complete this payment.';
        try {
          await apiRequest('/api/payments/razorpay/failure', {
            method: 'POST',
            body: JSON.stringify({ orderId: order.orderId }),
          });
        } catch (error) {
          failureMessage = `${failureMessage} The payment status could not be updated: ${error.message}`;
        } finally {
          setCheckoutMessage(failureMessage);
          setCheckoutSubmitting(false);
        }
      });
      checkout.open();
    } catch (error) {
      setCheckoutMessage(error.message);
      setCheckoutSubmitting(false);
    }
  };

  const handleCustomerAuth = async (event) => {
    event.preventDefault();
    setCustomerError('');
    setCustomerNotice('');

    try {
      const action = customerMode === 'register' ? 'register' : 'login';
      const result = await apiRequest(`/api/account/${action}`, {
        method: 'POST',
        body: JSON.stringify(customerCredentials),
      });
      setCustomer(result.customer);
      setCustomerCredentials({ email: '', password: '' });

      if (action === 'register') {
        setCustomerOrders([]);
        setSupportTickets([]);
        setAccountFeedback([]);
        setCustomerNotice('Your account is ready. Orders you place while signed in will appear here.');
      } else {
        const [orders, tickets, feedback] = await Promise.all([
          apiRequest('/api/account/orders'),
          apiRequest('/api/support/tickets'),
          apiRequest('/api/account/feedback'),
        ]);
        setCustomerOrders(orders);
        setSupportTickets(tickets);
        setAccountFeedback(feedback);
        setCustomerNotice('You are signed in.');
      }
    } catch (error) {
      setCustomerError(error.message);
    }
  };

  const handleCustomerLogout = async () => {
    try {
      await apiRequest('/api/account/logout', { method: 'POST' });
      setCustomer(null);
      setCustomerOrders([]);
      setSupportTickets([]);
      setAccountFeedback([]);
      setCustomerNotice('You have signed out.');
      setCustomerError('');
    } catch (error) {
      setCustomerError(error.message);
    }
  };

  const handleAdminLogin = async (event) => {
    event.preventDefault();

    setAdminError('');
    try {
      await apiRequest('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify(adminCredentials),
      });
      await loadAdminDashboardData(30);
      setAdminMode(true);
      setAdminCredentials({ email: '', password: '' });
    } catch (error) {
      setAdminError(error.message);
    }
  };

  const handleAdminLogout = async () => {
    try {
      await apiRequest('/api/admin/logout', { method: 'POST' });
      setAdminMode(false);
      setProducts([]);
      setAdminOrders([]);
      setAdminFinance(null);
      setAdminTaxProfile(null);
      setAdminAnalytics(null);
      setAdminSupportTickets([]);
      setAdminFeedback([]);
      setAdminError('');
    } catch (error) {
      setAdminError(error.message);
    }
  };

  const createEmployee = async (event) => {
    event.preventDefault();
    setAdminError('');
    setAdminEmployeeNotice('');
    try {
      const created = await apiRequest('/api/admin/employees', {
        method: 'POST',
        body: JSON.stringify(newEmployee),
      });
      setAdminEmployees((previous) => [created, ...previous]);
      setNewEmployee({ name: '', email: '', role: 'inventory', password: '' });
      setAdminEmployeeNotice('Employee account created. Share the work email and initial password through a separate secure channel.');
    } catch (error) {
      setAdminError(error.message);
    }
  };

  const updateEmployee = async (employeeId, patch) => {
    try {
      const updated = await apiRequest(`/api/admin/employees/${encodeURIComponent(employeeId)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setAdminEmployees((previous) => previous.map((item) => item.id === updated.id ? updated : item));
      setAdminError('');
    } catch (error) {
      setAdminError(error.message);
    }
  };

  const resetEmployeePassword = async (event, employeeId) => {
    event.preventDefault();
    setAdminEmployeeNotice('');
    const password = employeeResetDrafts[employeeId] || '';
    try {
      await apiRequest(`/api/admin/employees/${encodeURIComponent(employeeId)}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      setEmployeeResetDrafts((previous) => ({ ...previous, [employeeId]: '' }));
      setEmployeeEventLogs((previous) => ({ ...previous, [employeeId]: null }));
      setAdminError('');
      setAdminEmployeeNotice('Password reset. Provide the new password to the employee through a separate secure channel.');
    } catch (error) {
      setAdminError(error.message);
    }
  };

  const loadEmployeeEvents = async (employeeId) => {
    try {
      const events = await apiRequest(`/api/admin/employees/${encodeURIComponent(employeeId)}/events`);
      setEmployeeEventLogs((previous) => ({ ...previous, [employeeId]: events }));
    } catch (error) {
      setAdminError(error.message);
    }
  };

  const queueZohoSync = async (payload) => {
    setCrmSyncing(true);
    setAdminError('');
    setCrmNotice('');
    try {
      const result = await apiRequest('/api/admin/crm/sync', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setCrmNotice(result.message);
      setAdminCrmStatus(await apiRequest('/api/admin/crm/status'));
    } catch (error) {
      setAdminError(error.message);
    } finally {
      setCrmSyncing(false);
    }
  };

  const handleDeliveryLogin = async (event) => {
    event.preventDefault();
    setDeliveryError('');
    try {
      const result = await apiRequest('/api/delivery/login', {
        method: 'POST',
        body: JSON.stringify(deliveryCredentials),
      });
      const assignmentResult = await apiRequest('/api/delivery/assignments');
      setDeliveryAgent(result.agent);
      setDeliveryAssignments(assignmentResult.assignments);
      setPickupAddress(assignmentResult.pickupAddress || '');
      setDeliveryCredentials({ email: '', password: '' });
    } catch (error) {
      setDeliveryError(error.message);
    }
  };

  const handleDeliveryLogout = async () => {
    try {
      await apiRequest('/api/delivery/logout', { method: 'POST' });
      setDeliveryAgent(null);
      setDeliveryAssignments([]);
      setDeliveryError('');
      setDeliveryNotice('');
    } catch (error) {
      setDeliveryError(error.message);
    }
  };

  const handleEmployeeLogin = async (event) => {
    event.preventDefault();
    setEmployeeError('');
    setEmployeeNotice('');
    try {
      const result = await apiRequest('/api/employee/login', {
        method: 'POST',
        body: JSON.stringify(employeeCredentials),
      });
      await loadEmployeeWorkspace(result.employee);
      setEmployeeCredentials({ email: '', password: '' });
    } catch (error) {
      setEmployeeError(error.message);
    }
  };

  const handleEmployeeLogout = async () => {
    try {
      await apiRequest('/api/employee/logout', { method: 'POST' });
      setEmployee(null);
      setEmployeeWorkspace(null);
      setEmployeeProducts([]);
      setEmployeeTickets([]);
      setEmployeeFinance(null);
      setEmployeeFinanceOrders([]);
      setEmployeeError('');
    } catch (error) {
      setEmployeeError(error.message);
    }
  };

  const saveEmployeeInventory = async (event, product) => {
    event.preventDefault();
    const draft = employeeInventoryDrafts[product.id] || {
      stockOnHand: product.stockOnHand,
      reorderLevel: product.reorderLevel,
    };
    try {
      if (Number(draft.reorderLevel) > Number(draft.stockOnHand)) {
        throw new Error('Reorder level cannot be more than the physical stock count.');
      }
      const updated = await apiRequest(`/api/admin/products/${encodeURIComponent(product.id)}/inventory`, {
        method: 'PATCH',
        body: JSON.stringify({ stockOnHand: Number(draft.stockOnHand), reorderLevel: Number(draft.reorderLevel) }),
      });
      setEmployeeProducts((previous) => previous.map((item) => item.id === updated.id ? updated : item));
      setEmployeeInventoryDrafts((previous) => ({
        ...previous,
        [product.id]: { stockOnHand: updated.stockOnHand, reorderLevel: updated.reorderLevel },
      }));
      setEmployeeNotice(`Stock count saved for ${product.name}.`);
      setEmployeeError('');
    } catch (error) {
      setEmployeeError(error.message);
    }
  };

  const updateEmployeeSupportStatus = async (ticketId, status) => {
    try {
      await apiRequest(`/api/admin/support/tickets/${encodeURIComponent(ticketId)}`, {
        method: 'PATCH', body: JSON.stringify({ status }),
      });
      setEmployeeTickets(await apiRequest('/api/admin/support/tickets'));
      setEmployeeError('');
    } catch (error) {
      setEmployeeError(error.message);
    }
  };

  const sendEmployeeSupportReply = async (event, ticketId) => {
    event.preventDefault();
    try {
      await apiRequest(`/api/admin/support/tickets/${encodeURIComponent(ticketId)}/messages`, {
        method: 'POST', body: JSON.stringify({ message: employeeSupportDrafts[ticketId] || '' }),
      });
      setEmployeeTickets(await apiRequest('/api/admin/support/tickets'));
      setEmployeeSupportDrafts((previous) => ({ ...previous, [ticketId]: '' }));
      setEmployeeNotice('Reply sent to the customer inbox.');
      setEmployeeError('');
    } catch (error) {
      setEmployeeError(error.message);
    }
  };

  const submitEmployeeFinanceEntry = async (event) => {
    event.preventDefault();
    try {
      await apiRequest('/api/admin/finance/entries', {
        method: 'POST',
        body: JSON.stringify({
          ...employeeFinanceEntry,
          amount: Number(employeeFinanceEntry.amount),
          orderId: employeeFinanceEntry.entryType === 'refund' ? employeeFinanceEntry.orderId : '',
          direction: employeeFinanceEntry.direction || 'out',
        }),
      });
      setEmployeeFinanceEntry({ entryType: 'expense', amount: '', category: '', orderId: '', reference: '', note: '', direction: 'out' });
      const [finance, orders] = await Promise.all([
        apiRequest('/api/admin/finance?range=30'),
        apiRequest('/api/admin/finance/orders'),
      ]);
      setEmployeeFinance(finance);
      setEmployeeFinanceOrders(orders);
      setEmployeeNotice('Finance record added to the append-only audit ledger.');
      setEmployeeError('');
    } catch (error) {
      setEmployeeError(error.message);
    }
  };

  const handleAdminScan = async (text) => {
    const parsed = parseQrPayload(text);
    if (!parsed || parsed.type === 'short') {
      return parsed ? 'Short codes need the full QR scan or unit ID here.' : 'Not an SSTE QR code.';
    }
    setAdminError('');
    setQrFocus({ type: parsed.type, id: parsed.id });
    setScannerMode('');
    return '';
  };

  const handleDeliveryScan = async (text) => {
    const parsed = parseQrPayload(text);
    if (!parsed || parsed.type === 'order') return 'Not a parcel item label.';
    const units = deliveryAssignments.flatMap((delivery) => delivery.items.flatMap((line) => line.units
      .map((unit) => ({ unit, delivery }))));
    const match = units.find(({ unit }) => (parsed.type === 'short'
      ? unitShortCode(unit.id) === parsed.id.toUpperCase()
      : unit.id === parsed.id));
    if (!match) return '✗ Not part of a delivery assigned to you.';
    if (match.unit.pickedUp) return `Already scanned · ${unitShortCode(match.unit.id)}`;
    if (!['assigned', 'picked_up'].includes(match.delivery.deliveryStatus)) return '✗ This delivery is no longer at pickup stage.';
    await pickupDeliveryUnit(match.unit.id);
    return `✓ Scanned ${unitShortCode(match.unit.id)}`;
  };

  const pickupDeliveryUnit = async (unitId) => {
    setDeliveryError('');
    setDeliveryNotice('');
    try {
      const result = await apiRequest(`/api/delivery/units/${encodeURIComponent(unitId)}/pickup`, {
        method: 'POST',
      });
      setDeliveryNotice(result.alreadyScanned ? 'This item was already recorded at pickup.' : 'Item scan recorded for pickup.');
      await loadDeliveryAssignments();
    } catch (error) {
      setDeliveryError(error.message);
    }
  };

  const updateDeliveryStep = async (delivery, requestedStatus) => {
    const status = requestedStatus || (delivery.deliveryStatus === 'assigned'
      ? 'picked_up'
      : delivery.deliveryStatus === 'picked_up'
        ? 'in_transit'
        : delivery.deliveryStatus === 'in_transit'
          ? 'out_for_delivery'
          : delivery.deliveryStatus === 'out_for_delivery'
            ? 'delivered'
            : delivery.deliveryStatus === 'delivery_failed'
              ? 'in_transit'
              : null);
    if (!status) return;
    setDeliveryError('');
    setDeliveryNotice('');
    setDeliveryActionId(delivery.deliveryId);
    setDeliveryBusyId(delivery.deliveryId);
    try {
      await apiRequest(`/api/delivery/assignments/${encodeURIComponent(delivery.deliveryId)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          pin: deliveryPinDrafts[delivery.deliveryId] || '',
          note: deliveryNoteDrafts[delivery.deliveryId] || '',
        }),
      });
      setDeliveryPinDrafts((previous) => ({ ...previous, [delivery.deliveryId]: '' }));
      setDeliveryNoteDrafts((previous) => ({ ...previous, [delivery.deliveryId]: '' }));
      setDeliveryNotice(status === 'delivered'
        ? `✓ Order ${delivery.orderNumber} marked as DELIVERED.`
        : `✓ Order ${delivery.orderNumber} updated: ${status.replaceAll('_', ' ')}.`);
      await loadDeliveryAssignments();
    } catch (error) {
      if (/sign-in required|session expired|inactive/i.test(error.message)) {
        setDeliveryAgent(null);
        setDeliveryAssignments([]);
        setDeliveryError('Your session ended. Please sign in again, then confirm the delivery. Nothing was lost.');
        return;
      }
      setDeliveryError(error.message);
    } finally {
      setDeliveryBusyId('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const printInvoice = async (order) => {
    setAdminError('');
    try {
      const { invoiceNumber } = await apiRequest(`/api/admin/orders/${encodeURIComponent(order.id)}/invoice`, { method: 'POST' });
      const numbered = { ...order, invoiceNumber };
      setAdminOrders((previous) => previous.map((item) => (item.id === order.id ? numbered : item)));
      setTaxInvoiceOrder(numbered);
    } catch (error) {
      setAdminError(error.message);
    }
  };

  const createDeliveryAgent = async (event) => {
    event.preventDefault();
    setAdminError('');
    setDeliveryAgentNotice({ type: '', text: '' });
    if (newDeliveryAgent.password.length < 12) {
      setDeliveryAgentNotice({ type: 'error', text: 'Password must be at least 12 characters.' });
      return;
    }
    try {
      const agent = await apiRequest('/api/admin/delivery/agents', {
        method: 'POST',
        body: JSON.stringify(newDeliveryAgent),
      });
      setDeliveryAgents((previous) => [agent, ...previous]);
      setNewDeliveryAgent({ name: '', email: '', password: '' });
      setDeliveryAgentNotice({ type: 'success', text: `Created ${agent.email}. They can sign in at /delivery.` });
    } catch (error) {
      setDeliveryAgentNotice({ type: 'error', text: error.message });
    }
  };

  const setDeliveryAgentActive = async (agent) => {
    try {
      const updated = await apiRequest(`/api/admin/delivery/agents/${encodeURIComponent(agent.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !agent.active }),
      });
      setDeliveryAgents((previous) => previous.map((item) => item.id === updated.id
        ? { ...item, ...updated }
        : item));
      setAdminError('');
    } catch (error) {
      setAdminError(error.message);
    }
  };

  const assignDelivery = async (delivery) => {
    const agentId = deliveryAssignmentDrafts[delivery.orderId] || delivery.agentId;
    if (!agentId) {
      setAdminError('Select an active delivery person before dispatching this order.');
      return;
    }
    try {
      await apiRequest(`/api/admin/orders/${encodeURIComponent(delivery.orderId)}/delivery`, {
        method: 'PUT',
        body: JSON.stringify({ agentId }),
      });
      const refreshed = await apiRequest('/api/admin/deliveries');
      setAdminDeliveries(refreshed.deliveries);
      setAdminError('');
    } catch (error) {
      setAdminError(error.message);
    }
  };

  const handleAddProduct = async (event) => {
    event.preventDefault();

    const numericPrice = Number(newProduct.price);

    setAdminError('');
    try {
      const createdProduct = await apiRequest('/api/admin/products', {
        method: 'POST',
        body: JSON.stringify({
          ...newProduct,
          price: numericPrice,
          image:
            newProduct.image.trim() ||
            'https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&w=900&q=80',
        }),
      });

      setProducts((previous) => [createdProduct, ...previous]);
      setNewProduct({
        name: '',
        category: 'Furniture',
        price: '',
        gstRate: '',
        hsnCode: '',
        accent: '',
        tag: 'New',
        image: '',
        description: '',
        published: true,
      });
    } catch (error) {
      setAdminError(error.message);
    }
  };

  const toggleProductPublished = async (product) => {
    try {
      const updatedProduct = await apiRequest(`/api/admin/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ published: product.published === false }),
      });
      setProducts((previous) =>
        previous.map((item) => item.id === updatedProduct.id ? updatedProduct : item),
      );
      setAdminError('');
    } catch (error) {
      setAdminError(error.message);
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      const updatedOrder = await apiRequest(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setAdminOrders((previous) =>
        previous.map((order) => order.id === updatedOrder.id
          ? { ...order, status: updatedOrder.status, updated_at: updatedOrder.updated_at }
          : order),
      );
      setAdminError('');
      loadAdminDashboardData().catch((error) => setAdminError(error.message));
    } catch (error) {
      setAdminError(error.message);
    }
  };

  const deleteProduct = async (productId) => {
    try {
      await apiRequest(`/api/admin/products/${productId}`, { method: 'DELETE' });
      setProducts((previous) => previous.filter((product) => product.id !== productId));
      setAdminError('');
    } catch (error) {
      setAdminError(error.message);
    }
  };

  const saveProductInventory = async (event, product) => {
    event.preventDefault();
    const draft = inventoryDrafts[product.id] ?? {
      stockOnHand: product.stockOnHand,
      reorderLevel: product.reorderLevel,
    };
    try {
      if (Number(draft.reorderLevel) > Number(draft.stockOnHand)) {
        throw new Error('Reorder level cannot be more than the physical stock count.');
      }
      const updatedProduct = await apiRequest(`/api/admin/products/${product.id}/inventory`, {
        method: 'PATCH',
        body: JSON.stringify({
          stockOnHand: Number(draft.stockOnHand),
          reorderLevel: Number(draft.reorderLevel),
        }),
      });
      setProducts((previous) => previous.map((item) =>
        item.id === updatedProduct.id ? updatedProduct : item,
      ));
      setInventoryDrafts((previous) => ({ ...previous, [product.id]: {
        stockOnHand: updatedProduct.stockOnHand,
        reorderLevel: updatedProduct.reorderLevel,
      } }));
      setAdminError('');
      loadInventoryUnits(product.id);
      apiRequest('/api/admin/inventory/movements?limit=12')
        .then(setInventoryMovements)
        .catch((error) => setAdminError(error.message));
    } catch (error) {
      setAdminError(error.message);
    }
  };

  const saveProductTax = async (event, product) => {
    event.preventDefault();
    const draft = productTaxDrafts[product.id] || {
      gstRate: product.gstRate,
      hsnCode: product.hsnCode || '',
    };
    try {
      const updatedProduct = await apiRequest(`/api/admin/products/${product.id}/tax`, {
        method: 'PATCH',
        body: JSON.stringify({ gstRate: Number(draft.gstRate), hsnCode: draft.hsnCode }),
      });
      setProducts((previous) => previous.map((item) =>
        item.id === updatedProduct.id ? updatedProduct : item,
      ));
      setProductTaxDrafts((previous) => ({
        ...previous,
        [product.id]: { gstRate: updatedProduct.gstRate, hsnCode: updatedProduct.hsnCode },
      }));
      setAdminError('');
    } catch (error) {
      setAdminError(error.message);
    }
  };

  const submitFinanceEntry = async (event) => {
    event.preventDefault();
    setFinanceNotice('');
    setAdminError('');
    try {
      await apiRequest('/api/admin/finance/entries', {
        method: 'POST',
        body: JSON.stringify({
          ...financeEntryDraft,
          amount: Number(financeEntryDraft.amount),
          orderId: financeEntryDraft.entryType === 'refund' ? financeEntryDraft.orderId : '',
        }),
      });
      setFinanceEntryDraft({
        entryType: 'expense',
        amount: '',
        category: '',
        direction: 'out',
        orderId: '',
        reference: '',
        note: '',
      });
      setFinanceNotice('The finance record was appended to the audit ledger.');
      setAdminFinance(await apiRequest(`/api/admin/finance?range=${adminAnalyticsRange}`));
    } catch (error) {
      setAdminError(error.message);
    }
  };

  const saveTaxProfile = async (event) => {
    event.preventDefault();
    setTaxProfileNotice('');
    setAdminError('');
    try {
      const result = await apiRequest('/api/admin/tax-profile', {
        method: 'PUT',
        body: JSON.stringify(adminTaxProfile),
      });
      setAdminTaxProfile(result);
      setTaxProfileNotice('Business tax profile saved.');
    } catch (error) {
      setAdminError(error.message);
    }
  };

  const exportFinanceCsv = () => {
    if (!adminFinance) return;
    const columns = ['createdAt', 'entryType', 'amountPaise', 'paymentMode', 'orderNumber', 'category', 'reference', 'note', 'recordedBy'];
    const escapeCsv = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = [
      columns.join(','),
      ...adminFinance.entries.map((entry) => columns.map((column) => escapeCsv(
        column === 'amountPaise' ? (Number(entry.amountPaise) / 100).toFixed(2) : entry[column],
      )).join(',')),
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `sste-finance-${adminFinance.totals.periodStart}-to-${adminFinance.totals.periodEnd}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateSupportTicket = async (event) => {
    event.preventDefault();
    setSupportError('');
    setSupportNotice('');
    try {
      await apiRequest('/api/support/tickets', {
        method: 'POST',
        body: JSON.stringify(supportForm),
      });
      const tickets = await apiRequest('/api/support/tickets');
      setSupportTickets(tickets);
      setSupportForm({ category: 'order', subject: '', orderId: '', message: '' });
      setSupportNotice('Your support request was sent. You can follow replies here in your account.');
    } catch (error) {
      setSupportError(error.message);
    }
  };

  const handleCustomerSupportReply = async (event, ticketId) => {
    event.preventDefault();
    const message = supportReply[ticketId] || '';
    try {
      await apiRequest(`/api/support/tickets/${ticketId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
      setSupportTickets(await apiRequest('/api/support/tickets'));
      setSupportReply((previous) => ({ ...previous, [ticketId]: '' }));
      setSupportError('');
    } catch (error) {
      setSupportError(error.message);
    }
  };

  const submitOrderFeedback = async (event, orderId) => {
    event.preventDefault();
    const draft = feedbackDrafts[orderId] || { rating: 5, message: '' };
    try {
      await apiRequest('/api/account/feedback', {
        method: 'POST',
        body: JSON.stringify({ orderId, rating: Number(draft.rating), message: draft.message }),
      });
      setAccountFeedback(await apiRequest('/api/account/feedback'));
      setSupportNotice('Thank you for sharing feedback about your order.');
      setSupportError('');
    } catch (error) {
      setSupportError(error.message);
      setSupportNotice('');
    }
  };

  const handleOwnerSupportReply = async (event, ticketId) => {
    event.preventDefault();
    try {
      await apiRequest(`/api/admin/support/tickets/${ticketId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: supportReplyDrafts[ticketId] || '' }),
      });
      setAdminSupportTickets(await apiRequest('/api/admin/support/tickets'));
      setSupportReplyDrafts((previous) => ({ ...previous, [ticketId]: '' }));
      setAdminError('');
    } catch (error) {
      setAdminError(error.message);
    }
  };

  const updateSupportTicketStatus = async (ticketId, status) => {
    try {
      await apiRequest(`/api/admin/support/tickets/${ticketId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setAdminSupportTickets(await apiRequest('/api/admin/support/tickets'));
      setAdminError('');
    } catch (error) {
      setAdminError(error.message);
    }
  };

  const moderateFeedback = async (feedbackId, status) => {
    try {
      await apiRequest(`/api/admin/feedback/${feedbackId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setAdminFeedback(await apiRequest('/api/admin/feedback'));
      refreshAdminAnalytics();
      setAdminError('');
    } catch (error) {
      setAdminError(error.message);
    }
  };

  if (isEmployeePath && employeeChecking) {
    return <main className="delivery-shell"><h1>Checking employee sign-in…</h1></main>;
  }

  if (isEmployeePath && !employee) {
    return (
      <main className="admin-login-overlay">
        <section className="admin-login-card" aria-labelledby="employee-access-title">
          <p className="eyebrow">SSTE Studio · staff access</p>
          <h1 id="employee-access-title">Employee sign in</h1>
          <p className="admin-login-copy">Use the work email and password provided by the store owner.</p>
          {employeeRecovering ? (
            <AccountRecoveryPanel initialAccountType="employee" onBack={() => setEmployeeRecovering(false)} />
          ) : (
            <form className="admin-login-form" onSubmit={handleEmployeeLogin}>
              <label>
                Work email
                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={employeeCredentials.email}
                  onChange={(event) => setEmployeeCredentials((previous) => ({ ...previous, email: event.target.value }))}
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={employeeCredentials.password}
                  onChange={(event) => setEmployeeCredentials((previous) => ({ ...previous, password: event.target.value }))}
                />
              </label>
              {employeeError && <p className="admin-login-error" role="alert">{employeeError}</p>}
              <div className="admin-login-actions">
                <a className="secondary-button" href="/">Back to store</a>
                <button className="primary-button" type="submit">Sign in</button>
              </div>
              <button className="text-button account-forgot-link" type="button" onClick={() => setEmployeeRecovering(true)}>Forgot email or password?</button>
            </form>
          )}
        </section>
      </main>
    );
  }

  if (isEmployeePath && employee) {
    const employeeRoleLabels = {
      manager: 'Operations manager',
      inventory: 'Inventory',
      support: 'Customer support',
      finance: 'Finance',
      cashier: 'In-store cashier',
    };
    return (
      <>
        <header className="topbar admin-topbar">
          <div className="brand-block">
            <span className="brand-mark">S</span>
            <div><p className="brand-name">SSTE Studio</p><span className="brand-tag">Employee workspace</span></div>
          </div>
          <div className="header-actions">
            <span>{employee.name} · {employeeRoleLabels[employee.role]}</span>
            <button className="ghost-button" onClick={handleEmployeeLogout}>Sign out</button>
          </div>
        </header>
        <main className="admin-shell employee-workspace">
          <section className="admin-hero">
            <div>
              <p className="eyebrow">{employeeRoleLabels[employee.role]}</p>
              <h1>Welcome, {employee.name}</h1>
              <p>{employee.email} · Access is limited to your assigned work area.</p>
            </div>
          </section>
          {employeeError && <p className="admin-login-error" role="alert">{employeeError}</p>}
          {employeeNotice && <p className="account-notice" role="status">{employeeNotice}</p>}

          {['manager', 'cashier'].includes(employee.role) && (
            <section className="admin-panel">
              <h2>In-store sales</h2>
              <p>Ring up walk-in customers, scan item labels and print receipts.</p>
              <a className="primary-button" href="/pos">Open point of sale</a>
            </section>
          )}

          {employee.role === 'manager' && employeeWorkspace && (
            <section className="finance-kpi-grid">
              <article><span>Orders · last 30 days</span><strong>{employeeWorkspace.summary.recentOrders}</strong></article>
              <article><span>Open support tickets</span><strong>{employeeWorkspace.summary.openTickets}</strong></article>
              <article><span>Products at reorder level</span><strong>{employeeWorkspace.summary.lowStockProducts}</strong></article>
              <article><span>Active deliveries</span><strong>{employeeWorkspace.summary.activeDeliveries}</strong></article>
              <p className="payment-notice">Manager workspace displays operational summaries only. Sensitive payment setup, customer records, staff credentials, and tax-profile controls remain owner-only.</p>
            </section>
          )}

          {employee.role === 'inventory' && (
            <section className="admin-panel">
              <div className="panel-header"><h2>Inventory counts</h2></div>
              <p className="payment-notice">Stock changes create auditable inventory movements. Enter a verified physical count; outstanding reservations cannot be counted as available stock.</p>
              <div className="employee-stock-list">
                {employeeProducts.map((product) => {
                  const draft = employeeInventoryDrafts[product.id] || {
                    stockOnHand: product.stockOnHand,
                    reorderLevel: product.reorderLevel,
                  };
                  return (
                    <article className="employee-stock-row" key={product.id}>
                      <div><strong>{product.name}</strong><span>{product.inventoryTrackingEnabled ? `${product.stockOnHand - product.reservedQuantity} available · ${product.reservedQuantity} reserved` : 'Inventory tracking not initialized'}</span></div>
                      <form className="inventory-adjustment-form" onSubmit={(event) => saveEmployeeInventory(event, product)}>
                        <label>Physical count<input type="number" min={product.reservedQuantity} max="1000000" step="1" required value={draft.stockOnHand} onChange={(event) => setEmployeeInventoryDrafts((previous) => ({ ...previous, [product.id]: { ...draft, stockOnHand: event.target.value } }))} /></label>
                        <label>Reorder alert<input type="number" min="0" max="1000000" step="1" required value={draft.reorderLevel} onChange={(event) => setEmployeeInventoryDrafts((previous) => ({ ...previous, [product.id]: { ...draft, reorderLevel: event.target.value } }))} /></label>
                        <button className="secondary-button" type="submit">Save count</button>
                      </form>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {employee.role === 'support' && (
            <section className="admin-panel">
              <div className="panel-header"><h2>Customer support inbox</h2><span>{employeeWorkspace?.summary.openTickets || 0} open</span></div>
              {employeeTickets.length === 0 ? <p>No support tickets are available.</p> : employeeTickets.map((ticket) => (
                <article className="admin-support-ticket" key={ticket.id}>
                  <div className="support-ticket-heading">
                    <div><span>{ticket.category} · {ticket.orderNumber || 'general enquiry'}</span><h3>{ticket.subject}</h3><p>{ticket.customerEmail}</p></div>
                    <label>Ticket status<select value={ticket.status} onChange={(event) => updateEmployeeSupportStatus(ticket.id, event.target.value)}>
                      {['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'].map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
                    </select></label>
                  </div>
                  <div className="support-message-list">{ticket.messages.map((message) => (
                    <div className={`support-message ${message.authorRole}`} key={message.id}><strong>{message.authorRole === 'owner' ? message.authorName : message.authorName}</strong><p>{message.message}</p><time>{indiaDateTime.format(new Date(message.createdAt))}</time></div>
                  ))}</div>
                  <form className="support-reply-form" onSubmit={(event) => sendEmployeeSupportReply(event, ticket.id)}>
                    <label>Reply<textarea required maxLength="3000" rows="2" value={employeeSupportDrafts[ticket.id] || ''} onChange={(event) => setEmployeeSupportDrafts((previous) => ({ ...previous, [ticket.id]: event.target.value }))} /></label>
                    <button className="primary-button" type="submit">Send reply</button>
                  </form>
                </article>
              ))}
            </section>
          )}

          {employee.role === 'finance' && employeeFinance && (
            <section className="admin-panel finance-panel">
              <h2>Finance operations</h2>
              <div className="finance-kpi-grid">
                <article><span>Live captured sales</span><strong>{money.format(employeeFinance.totals.liveSalesPaise / 100)}</strong></article>
                <article><span>Refunds recorded</span><strong>{money.format(employeeFinance.totals.liveRefundsPaise / 100)}</strong></article>
                <article><span>Expenses recorded</span><strong>{money.format(employeeFinance.totals.expensesPaise / 100)}</strong></article>
                <article><span>GST recorded</span><strong>{money.format(employeeFinance.tax.recordedTax)}</strong></article>
              </div>
              <form className="finance-entry-form" onSubmit={submitEmployeeFinanceEntry}>
                <h3>Append finance record</h3>
                <p>Record a refund only after it has been separately issued through the payment provider. Entries are permanent and attributed to your work email.</p>
                <div className="finance-entry-fields">
                  <label>Type<select value={employeeFinanceEntry.entryType} onChange={(event) => setEmployeeFinanceEntry((previous) => ({ ...previous, entryType: event.target.value }))}>
                    <option value="expense">Expense</option><option value="refund">Refund already issued</option><option value="reconciliation">Reconciliation</option>
                  </select></label>
                  <label>Amount (₹)<input type="number" min="0.01" max="100000000" step="0.01" required value={employeeFinanceEntry.amount} onChange={(event) => setEmployeeFinanceEntry((previous) => ({ ...previous, amount: event.target.value }))} /></label>
                  {employeeFinanceEntry.entryType === 'reconciliation' && <label>Direction<select value={employeeFinanceEntry.direction} onChange={(event) => setEmployeeFinanceEntry((previous) => ({ ...previous, direction: event.target.value }))}><option value="in">Increase</option><option value="out">Decrease</option></select></label>}
                  <label>Category<input required maxLength="80" value={employeeFinanceEntry.category} onChange={(event) => setEmployeeFinanceEntry((previous) => ({ ...previous, category: event.target.value }))} /></label>
                  {employeeFinanceEntry.entryType === 'refund' && <label>Order<select required value={employeeFinanceEntry.orderId} onChange={(event) => setEmployeeFinanceEntry((previous) => ({ ...previous, orderId: event.target.value }))}><option value="">Select paid order</option>{employeeFinanceOrders.map((order) => <option key={order.id} value={order.id}>{order.orderNumber} · {money.format(order.total)}</option>)}</select></label>}
                  <label>External reference<input maxLength="120" value={employeeFinanceEntry.reference} onChange={(event) => setEmployeeFinanceEntry((previous) => ({ ...previous, reference: event.target.value }))} /></label>
                </div>
                <label>Audit note<textarea required maxLength="1000" rows="2" value={employeeFinanceEntry.note} onChange={(event) => setEmployeeFinanceEntry((previous) => ({ ...previous, note: event.target.value }))} /></label>
                <button className="primary-button" type="submit">Save audit record</button>
              </form>
              <div className="finance-ledger-wrap"><h3>Recent records</h3><div className="finance-ledger-scroll"><table className="finance-ledger-table"><thead><tr><th>Recorded</th><th>Type</th><th>Reference</th><th>Category</th><th>Amount</th></tr></thead><tbody>{employeeFinance.entries.map((entry) => <tr key={entry.id}><td>{indiaDateTime.format(new Date(entry.createdAt))}</td><td>{entry.entryType}</td><td>{entry.orderNumber || entry.reference || '—'}</td><td>{entry.category}<br />{entry.note}<br /><small>{entry.recordedBy}</small></td><td>{money.format(entry.amountPaise / 100)}</td></tr>)}</tbody></table></div></div>
            </section>
          )}
          <p className="admin-muted-copy">Need access or a password reset? Contact the store owner. Employee passwords are never displayed in this workspace.</p>
        </main>
      </>
    );
  }

  if (adminMode) {
    return (
      <>
        <header className="topbar admin-topbar">
          <div className="brand-block">
            <span className="brand-mark">S</span>
            <div>
              <p className="brand-name">SSTE Studio</p>
              <span className="brand-tag">Owner dashboard</span>
            </div>
          </div>

          <div className="header-actions">
            <a className="ghost-button" href="/pos">Open POS</a>
            <button className="primary-button" onClick={() => setScannerMode('admin')}>
              Scan QR
            </button>
            <button className="ghost-button" onClick={handleAdminLogout}>
              Sign out
            </button>
            <a className="ghost-button" href="/">
              Back to storefront
            </a>
          </div>
        </header>
        {scannerMode === 'admin' && (
          <QrScannerDialog
            title="Scan a product, unit or order QR"
            hint="Point the camera at any SSTE label to jump straight to that record."
            onScan={handleAdminScan}
            onClose={() => setScannerMode('')}
          />
        )}

        <main className="admin-shell">
          <section className="admin-hero">
            <div>
              <p className="eyebrow">Operations</p>
              <h1>Website control center</h1>
              {adminError && <p className="admin-login-error" role="alert">{adminError}</p>}
            </div>
            <div className="admin-summary-grid">
              <article className="admin-stat-card">
                <span>Live listings</span>
                <strong>{publishedCount}</strong>
              </article>
              <article className="admin-stat-card">
                <span>Drafts</span>
                <strong>{draftCount}</strong>
              </article>
              <article className="admin-stat-card">
                <span>Store health</span>
                <strong>On</strong>
              </article>
            </div>
          </section>
          <nav className="admin-section-nav" aria-label="Owner dashboard sections">
            {[
              ['admin-analytics', 'Business intelligence'],
              ['admin-ai', 'AI analyst'],
              ['admin-finance', 'Tax & finance'],
              ['admin-crm', 'Zoho CRM'],
              ['admin-employees', 'Employee access'],
              ['admin-inventory', 'Inventory'],
              ['payment-settings', 'Payments'],
              ['admin-products', 'Products'],
              ['admin-orders', 'Orders'],
              ['admin-logistics', 'Logistics'],
              ['admin-support', 'Customer care'],
              ['admin-feedback', 'Feedback'],
            ].map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className={activeAdminSection === id ? 'is-active' : ''}
                aria-current={activeAdminSection === id ? 'location' : undefined}
              >
                {label}
              </a>
            ))}
            <a href="/delivery">Delivery portal</a>
            <a href="/employee">Employee portal</a>
          </nav>
          {showBackToTop && (
            <button
              type="button"
              className="back-to-top"
              aria-label="Back to top"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              ↑
            </button>
          )}

          <section className="admin-bi-section" id="admin-analytics" aria-labelledby="admin-bi-title">
            <div className="admin-section-heading">
              <div>
                <p className="eyebrow">Business intelligence · Asia/Kolkata</p>
                <h2 id="admin-bi-title">Store performance</h2>
                <p>
                  {adminAnalytics
                    ? `${indiaDate.format(new Date(`${adminAnalytics.periodStart}T12:00:00+05:30`))} – ${indiaDate.format(new Date(`${adminAnalytics.periodEnd}T12:00:00+05:30`))}`
                    : 'Live store data'}
                  {' · '}Compared with the previous equal-length period
                </p>
              </div>
              <div className="admin-report-actions">
                <label>
                  Report period
                  <select
                    value={adminAnalyticsRange}
                    disabled={adminAnalyticsLoading}
                    onChange={(event) => refreshAdminAnalytics(Number(event.target.value))}
                  >
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                    <option value="365">Last 12 months</option>
                  </select>
                </label>
                <button className="secondary-button" type="button" disabled={adminAnalyticsLoading} onClick={() => loadAdminDashboardData()}>
                  {adminAnalyticsLoading ? 'Refreshing…' : 'Refresh data'}
                </button>
              </div>
            </div>

            {adminAnalytics ? (
              <>
                <div className="admin-kpi-grid">
                  <article className="admin-kpi-card primary">
                    <span>Live Razorpay collections</span>
                    <strong>{money.format(Number(adminAnalytics.current.revenue))}</strong>
                    <small>
                      {adminAnalytics.current.paidOrders} live captures · test and demo payments excluded
                    </small>
                    <span className="admin-kpi-change">
                      {percentageChange(adminAnalytics.current.revenue, adminAnalytics.previous.revenue) === null
                        ? 'No previous-period baseline'
                        : `${percentageChange(adminAnalytics.current.revenue, adminAnalytics.previous.revenue) >= 0 ? '↑' : '↓'} ${Math.abs(percentageChange(adminAnalytics.current.revenue, adminAnalytics.previous.revenue)).toFixed(1)}% vs prior period`}
                    </span>
                  </article>
                  <article className="admin-kpi-card">
                    <span>Orders placed</span>
                    <strong>{adminAnalytics.current.orders}</strong>
                    <small>{adminAnalytics.current.cancelledOrders} cancelled in this period</small>
                    <span className="admin-kpi-change">{Number(adminAnalytics.current.cancellationRate).toFixed(1)}% cancellation rate</span>
                  </article>
                  <article className="admin-kpi-card">
                    <span>Average live order</span>
                    <strong>{money.format(Number(adminAnalytics.current.averageOrderValue))}</strong>
                    <small>Calculated from live-mode Razorpay captures only</small>
                    <span className="admin-kpi-change">
                      {percentageChange(adminAnalytics.current.averageOrderValue, adminAnalytics.previous.averageOrderValue) === null
                        ? 'No previous-period baseline'
                        : `${percentageChange(adminAnalytics.current.averageOrderValue, adminAnalytics.previous.averageOrderValue) >= 0 ? '↑' : '↓'} ${Math.abs(percentageChange(adminAnalytics.current.averageOrderValue, adminAnalytics.previous.averageOrderValue)).toFixed(1)}% vs prior period`}
                    </span>
                  </article>
                  <article className="admin-kpi-card">
                    <span>New customers</span>
                    <strong>{adminAnalytics.current.newCustomers}</strong>
                    <small>{adminAnalytics.current.repeatCustomers} repeat captured buyers</small>
                    <span className="admin-kpi-change">Account registrations in selected period</span>
                  </article>
                  <article className="admin-kpi-card">
                    <span>Payment success</span>
                    <strong>{Number(adminAnalytics.payments.successRate).toFixed(1)}%</strong>
                    <small>{adminAnalytics.payments.captured} live captured · {adminAnalytics.payments.failed} live failed</small>
                    <span className="admin-kpi-change">Live-mode payment attempts only</span>
                  </article>
                  <article className="admin-kpi-card">
                    <span>Customer rating</span>
                    <strong>{Number(adminAnalytics.feedback.averageRating) > 0 ? `${Number(adminAnalytics.feedback.averageRating).toFixed(1)} / 5` : '—'}</strong>
                    <small>{adminAnalytics.feedback.approvedCount} approved reviews in period</small>
                    <span className="admin-kpi-change">{adminAnalytics.feedback.pendingCount} waiting for moderation</span>
                  </article>
                </div>

                <div className="admin-bi-grid">
                  <section className="admin-panel admin-chart-panel">
                    <div className="panel-header">
                      <div>
                        <p className="eyebrow">Captured payment trend</p>
                        <h3>Daily live-mode collections</h3>
                      </div>
                      <span className="admin-data-badge">INR · Asia/Kolkata</span>
                    </div>
                    {Number(adminAnalytics.current.revenue) > 0 ? (
                      <AdminSalesChart data={adminAnalytics.daily} />
                    ) : (
                      <div className="admin-empty-chart">
                        <strong>No live Razorpay collections in this period</strong>
                        <span>Test-mode Razorpay, test UPI simulations, pending payments, and failed payments are excluded.</span>
                      </div>
                    )}
                    <p className="admin-chart-footnote">
                      Live-mode captured order totals; excludes test payments, refunds, and gateway fees because those are not recorded by this store.
                    </p>
                  </section>

                  <section className="admin-panel admin-analyst-panel" aria-labelledby="admin-analyst-title">
                    <div className="panel-header">
                      <div>
                        <p className="eyebrow">Decision support</p>
                        <h3 id="admin-analyst-title">Store analyst brief</h3>
                      </div>
                      <span className="admin-data-badge">Database-grounded</span>
                    </div>
                    <p className="admin-analyst-disclaimer">
                      Automated observations from recorded orders and stock. No traffic, ad spend, cost, or refund data is connected yet.
                    </p>
                    <ul className="admin-insight-list">
                      {lowStockProducts.length > 0 && (
                        <li className="warning">
                          <strong>{lowStockProducts.length} tracked {lowStockProducts.length === 1 ? 'product is' : 'products are'} at or below reorder level.</strong>
                          <span>{lowStockProducts.slice(0, 3).map((item) => item.name).join(', ')}{lowStockProducts.length > 3 ? ', and more' : ''}. Review the inventory queue below.</span>
                        </li>
                      )}
                      {adminAnalytics.payments.failed > 0 && (
                        <li className="warning">
                          <strong>{adminAnalytics.payments.failed} Razorpay payment{adminAnalytics.payments.failed === 1 ? '' : 's'} failed.</strong>
                          <span>Check the payment state and follow up with customers if needed.</span>
                        </li>
                      )}
                      {openSupportTickets.length > 0 && (
                        <li className="warning">
                          <strong>{openSupportTickets.length} customer support request{openSupportTickets.length === 1 ? '' : 's'} need attention.</strong>
                          <span>Open the support inbox to respond and update their status.</span>
                        </li>
                      )}
                      {adminAnalytics.topProducts[0] && (
                        <li>
                          <strong>{adminAnalytics.topProducts[0].name} leads recorded live Razorpay collections.</strong>
                          <span>{adminAnalytics.topProducts[0].units} units · {money.format(Number(adminAnalytics.topProducts[0].revenue))} in this period.</span>
                        </li>
                      )}
                      {adminAnalytics.regions[0] && (
                        <li>
                          <strong>{adminAnalytics.regions[0].state} is the leading recorded region.</strong>
                          <span>{adminAnalytics.regions[0].orders} paid order{adminAnalytics.regions[0].orders === 1 ? '' : 's'} · {money.format(Number(adminAnalytics.regions[0].revenue))}.</span>
                        </li>
                      )}
                      {adminAnalytics.current.orders === 0 && (
                        <li><strong>No orders were placed in this period.</strong><span>Try a longer report period or check back after the next order.</span></li>
                      )}
                      {lowStockProducts.length === 0 && adminAnalytics.payments.failed === 0 && openSupportTickets.length === 0 && (
                        <li><strong>No urgent inventory, payment, or support alerts.</strong><span>Review sales and customer feedback below for routine actions.</span></li>
                      )}
                      {adminAnalytics.payments.simulated > 0 && (
                        <li>
                          <strong>{adminAnalytics.payments.simulated} simulated UPI order{adminAnalytics.payments.simulated === 1 ? '' : 's'} excluded from revenue.</strong>
                          <span>The development payment simulator never collects money.</span>
                        </li>
                      )}
                    </ul>
                  </section>
                </div>

                <div className="admin-bi-grid admin-bi-lower-grid">
                  <section className="admin-panel">
                    <div className="panel-header"><h3>Top products</h3><span className="admin-data-badge">Live paid units</span></div>
                    {adminAnalytics.topProducts.length === 0 ? (
                      <p className="admin-muted-copy">No live-mode product collections in this period.</p>
                    ) : (
                      <ol className="admin-ranked-list">
                        {adminAnalytics.topProducts.map((item, index) => {
                          const highest = Math.max(1, Number(adminAnalytics.topProducts[0].revenue));
                          return (
                            <li key={`${item.name}-${item.category}`}>
                              <span className="admin-rank-number">{String(index + 1).padStart(2, '0')}</span>
                              <div className="admin-rank-content">
                                <div><strong>{item.name}</strong><span>{item.category} · {item.units} units</span></div>
                                <strong>{money.format(Number(item.revenue))}</strong>
                                <span className="admin-rank-bar"><i style={{ width: `${Math.max(4, (Number(item.revenue) / highest) * 100)}%` }} /></span>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </section>
                  <section className="admin-panel">
                    <div className="panel-header"><h3>Order pipeline</h3><span className="admin-data-badge">{adminAnalytics.current.orders} orders</span></div>
                    {adminAnalytics.fulfillment.length === 0 ? (
                      <p className="admin-muted-copy">No order activity in this report period.</p>
                    ) : (
                      <ul className="admin-pipeline-list">
                        {adminAnalytics.fulfillment.map((item) => (
                          <li key={item.status}>
                            <span>{item.status.replaceAll('_', ' ')}</span>
                            <div className="admin-pipeline-track"><i style={{ width: `${Math.max(3, adminAnalytics.current.orders ? item.orders / adminAnalytics.current.orders * 100 : 0)}%` }} /></div>
                            <strong>{item.orders}</strong>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="admin-payment-health">
                      <span>Pending payments <strong>{adminAnalytics.payments.pending}</strong></span>
                      <span>Failed payments <strong>{adminAnalytics.payments.failed}</strong></span>
                      <span>Test captures <strong>{adminAnalytics.payments.testCaptured}</strong></span>
                      <span>Demo payments <strong>{adminAnalytics.payments.simulated}</strong></span>
                    </div>
                  </section>
                  <section className="admin-panel">
                    <div className="panel-header"><h3>Customer regions</h3><span className="admin-data-badge">Live paid orders</span></div>
                    {adminAnalytics.regions.length === 0 ? (
                      <p className="admin-muted-copy">No paid orders with region data in this period.</p>
                    ) : (
                      <ul className="admin-region-list">
                        {adminAnalytics.regions.map((item) => (
                          <li key={item.state}><span>{item.state}</span><strong>{money.format(Number(item.revenue))}</strong><small>{item.orders} orders</small></li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>

                <section className="admin-panel admin-ai-panel" id="admin-ai" aria-labelledby="admin-ai-title">
                  <div className="admin-section-heading">
                    <div>
                      <p className="eyebrow">Ask your business data</p>
                      <h2 id="admin-ai-title">AI business analyst</h2>
                      <p>Ask questions about the selected report. The analyst can explain KPIs and suggest next steps; it cannot change store data.</p>
                    </div>
                    <span className={`admin-data-badge ${aiAnalystOn ? '' : 'attention'}`}>
                      {!adminAiStatus?.configured ? 'Setup required' : aiAnalystOn ? (adminAiStatus?.usesGemini ? 'Gemini connected' : 'Free built-in analyst') : 'Switched off'}
                    </span>
                  </div>
                  <div className="admin-ai-agents" aria-label="AI agent organisation chart">
                    {(adminAiStatus?.agents || []).map((agent, _index, all) => {
                      let depth = 0;
                      for (let p = agent.parent; p; p = all.find((a) => a.key === p)?.parent) depth += 1;
                      const external = agent.key === 'qa_maintainer';
                      return (
                        <label
                          key={agent.key}
                          className={`admin-ai-agent-toggle ${agent.effectiveEnabled ? '' : 'is-off'}`}
                          style={{ marginLeft: `${depth * 1.5}rem` }}
                        >
                          <input
                            type="checkbox"
                            role="switch"
                            checked={agent.enabled}
                            disabled={external}
                            onChange={(event) => toggleAiAgent(agent.key, event.target.checked)}
                          />
                          <span>
                            <strong>
                              {agent.label}: {agent.enabled ? (agent.effectiveEnabled ? 'On' : 'On (paused by manager)') : 'Off'}
                              {' · '}{agent.status === 'live' ? 'Live' : 'Planned'}
                            </strong>
                            <small>{agent.description}</small>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="admin-ai-privacy-note">
                    {adminAiStatus?.usesGemini
                      ? 'Your question and aggregate report metrics are sent to Google Gemini. Customer names, emails, phone numbers, addresses, individual orders, and support messages are not included. Do not put personal details in your question.'
                      : 'The free built-in analyst runs on this server: no data leaves your store and no subscription or key is needed. Optionally add a free GEMINI_API_KEY to the server environment for open-ended answers.'}
                  </p>
                  <div className="admin-ai-suggestions" aria-label="Suggested questions">
                    {[
                      'What changed in live collections compared with the previous period?',
                      'Which products should I check for restocking?',
                      'Which state contributed the most live collections?',
                    ].map((suggestion) => (
                      <button
                        type="button"
                        key={suggestion}
                        disabled={!aiAnalystOn || adminAiLoading}
                        onClick={() => setAdminAiQuestion(suggestion)}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                  <form className="admin-ai-form" onSubmit={askAdminAi}>
                    <label htmlFor="admin-ai-question">Ask a question about this store report</label>
                    <textarea
                      id="admin-ai-question"
                      required
                      minLength="3"
                      maxLength="500"
                      rows="3"
                      disabled={!aiAnalystOn || adminAiLoading}
                      value={adminAiQuestion}
                      onChange={(event) => setAdminAiQuestion(event.target.value)}
                      placeholder="For example: What should I prioritize this week based on sales, stock, and support?"
                    />
                    <div className="admin-ai-submit-row">
                      <span>{adminAnalyticsRange}-day report · aggregate data only</span>
                      <button className="primary-button" type="submit" disabled={!aiAnalystOn || adminAiLoading}>
                        {adminAiLoading ? 'Analysing…' : 'Ask analyst'}
                      </button>
                    </div>
                  </form>
                  {adminAiError && <p className="account-error" role="alert">{adminAiError}</p>}
                  {adminAiAnswer && (
                    <article className="admin-ai-answer" aria-live="polite">
                      <div className="admin-ai-answer-heading">
                        <strong>Analyst response</strong>
                        <span>
                          {indiaDate.format(new Date(`${adminAiAnswer.periodStart}T12:00:00+05:30`))} – {indiaDate.format(new Date(`${adminAiAnswer.periodEnd}T12:00:00+05:30`))}
                          {' · '}{adminAiAnswer.provider} · {adminAiAnswer.model}
                        </span>
                      </div>
                      <p>{adminAiAnswer.answer}</p>
                      {adminAiAnswer.recommendations.length > 0 && (
                        <div>
                          <h3>Suggested next steps</h3>
                          <ul>{adminAiAnswer.recommendations.map((item, index) => <li key={index}>{item}</li>)}</ul>
                        </div>
                      )}
                      {adminAiAnswer.evidence.length > 0 && (
                        <div>
                          <h3>Report evidence</h3>
                          <ul>{adminAiAnswer.evidence.map((item, index) => <li key={index}>{item}</li>)}</ul>
                        </div>
                      )}
                    </article>
                  )}
                </section>
              </>
            ) : (
              <p className="admin-muted-copy" role="status">
                {adminAnalyticsLoading ? 'Loading business intelligence…' : 'Analytics are unavailable. Refresh the report to try again.'}
              </p>
            )}
          </section>

          <section className="admin-panel finance-panel" id="admin-finance" aria-labelledby="admin-finance-title">
            <div className="admin-section-heading">
              <div>
                <p className="eyebrow">Owner-only · append-only activity</p>
                <h2 id="admin-finance-title">Tax &amp; financial maintenance</h2>
                <p>Review recorded GST, payment captures, expense/refund records, and reconciliation adjustments.</p>
              </div>
              <div className="finance-actions">
                <label>
                  Period
                  <select
                    value={adminFinance?.totals.rangeDays || adminAnalyticsRange}
                    disabled={adminAnalyticsLoading}
                    onChange={async (event) => {
                      const range = Number(event.target.value);
                      try {
                        setAdminFinance(await apiRequest(`/api/admin/finance?range=${range}`));
                      } catch (error) {
                        setAdminError(error.message);
                      }
                    }}
                  >
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                    <option value="365">Last 12 months</option>
                  </select>
                </label>
                <button className="secondary-button" type="button" disabled={!adminFinance?.entries.length} onClick={exportFinanceCsv}>
                  Export ledger CSV
                </button>
              </div>
            </div>
            <p className="payment-notice">
              GST rates and HSN/SAC codes must be verified by your tax professional. The app records item-level tax snapshots and totals, but does not determine place-of-supply, split CGST/SGST vs IGST, issue GST invoices, file returns, or calculate tax on shipping. This report is an operational aid, not a tax filing.
            </p>
            {adminTaxProfile && (
              <form className="tax-profile-form" onSubmit={saveTaxProfile}>
                <div>
                  <h3>Business tax profile</h3>
                  <p>Profile changes apply to new orders only. Each order retains a snapshot of the seller details used when placed.</p>
                </div>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={adminTaxProfile.gstRegistered}
                    onChange={(event) => setAdminTaxProfile((previous) => ({
                      ...previous,
                      gstRegistered: event.target.checked,
                      accountantReviewed: false,
                      ...(event.target.checked ? {} : { gstin: '', registeredState: '', accountantReviewed: false }),
                    }))}
                  />
                  This business is registered for GST
                </label>
                {adminTaxProfile.gstRegistered && (
                  <>
                    <div className="finance-entry-fields">
                      <label>
                        Legal business name
                        <input
                          required
                          maxLength="160"
                          value={adminTaxProfile.legalName}
                          onChange={(event) => setAdminTaxProfile((previous) => ({ ...previous, legalName: event.target.value, accountantReviewed: false }))}
                        />
                      </label>
                      <label>
                        GSTIN
                        <input
                          required
                          maxLength="15"
                          value={adminTaxProfile.gstin}
                          onChange={(event) => setAdminTaxProfile((previous) => ({ ...previous, gstin: event.target.value.toUpperCase(), accountantReviewed: false }))}
                        />
                      </label>
                      <label>
                        Registered state / UT
                        <select
                          required
                          value={adminTaxProfile.registeredState}
                          onChange={(event) => setAdminTaxProfile((previous) => ({ ...previous, registeredState: event.target.value, accountantReviewed: false }))}
                        >
                          <option value="">Select state / UT</option>
                          {indianStates.map((state) => <option key={state} value={state}>{state}</option>)}
                        </select>
                      </label>
                    </div>
                    <label>
                      Registered business address
                      <textarea
                        required
                        maxLength="500"
                        rows="3"
                        value={adminTaxProfile.registeredAddress}
                        onChange={(event) => setAdminTaxProfile((previous) => ({ ...previous, registeredAddress: event.target.value, accountantReviewed: false }))}
                      />
                    </label>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={adminTaxProfile.accountantReviewed}
                        onChange={(event) => setAdminTaxProfile((previous) => ({ ...previous, accountantReviewed: event.target.checked }))}
                      />
                      I confirm a qualified tax professional has reviewed this GST profile and the configured product rates.
                    </label>
                  </>
                )}
                <button className="secondary-button" type="submit">Save business tax profile</button>
                {adminTaxProfile.accountantReviewed && adminTaxProfile.reviewedAt && (
                  <p className="admin-muted-copy">
                    Review attested by {adminTaxProfile.reviewedBy} on {indiaDateTime.format(new Date(adminTaxProfile.reviewedAt))}.
                  </p>
                )}
                {taxProfileNotice && <p className="account-notice" role="status">{taxProfileNotice}</p>}
              </form>
            )}
            {adminFinance ? (
              <>
                <div className="finance-kpi-grid">
                  <article><span>Live captured sales</span><strong>{money.format(adminFinance.totals.liveSalesPaise / 100)}</strong></article>
                  <article><span>Live refunds recorded</span><strong>{money.format(adminFinance.totals.liveRefundsPaise / 100)}</strong></article>
                  <article><span>Expenses recorded</span><strong>{money.format(adminFinance.totals.expensesPaise / 100)}</strong></article>
                  <article><span>Net recorded cash movement</span><strong>{money.format(adminFinance.totals.liveNetPaise / 100)}</strong></article>
                  <article><span>GST taxable sales</span><strong>{money.format(adminFinance.tax.taxableSales)}</strong></article>
                  <article><span>GST recorded on paid orders</span><strong>{money.format(adminFinance.tax.recordedTax)}</strong></article>
                  <article><span>Simulated / test tax (not liability)</span><strong>{money.format(adminFinance.tax.simulatedTax)}</strong></article>
                </div>
                <p className="admin-muted-copy">
                  {indiaDate.format(new Date(`${adminFinance.totals.periodStart}T12:00:00+05:30`))} – {indiaDate.format(new Date(`${adminFinance.totals.periodEnd}T12:00:00+05:30`))}
                  {' · '}{money.format(adminFinance.totals.simulatedSalesPaise / 100)} simulated/test orders excluded from live sales and tax liability.
                  {adminFinance.tax.ordersWithoutTaxRecords > 0
                    ? ` ${adminFinance.tax.ordersWithoutTaxRecords} paid historical order(s) have no tax snapshot and are excluded from GST totals.`
                    : ''}
                </p>

                <form className="finance-entry-form" onSubmit={submitFinanceEntry}>
                  <h3>Append an audit record</h3>
                  <p>Records cannot be edited or deleted. Log a refund here only after you have separately completed the refund with the payment provider.</p>
                  <div className="finance-entry-fields">
                    <label>
                      Record type
                      <select
                        value={financeEntryDraft.entryType}
                        onChange={(event) => setFinanceEntryDraft((previous) => ({ ...previous, entryType: event.target.value }))}
                      >
                        <option value="expense">Expense</option>
                        <option value="refund">Refund already issued</option>
                        <option value="reconciliation">Reconciliation adjustment</option>
                      </select>
                    </label>
                    <label>
                      Amount (₹)
                      <input
                        type="number"
                        min="0.01"
                        max="100000000"
                        step="0.01"
                        required
                        value={financeEntryDraft.amount}
                        onChange={(event) => setFinanceEntryDraft((previous) => ({ ...previous, amount: event.target.value }))}
                      />
                    </label>
                    {financeEntryDraft.entryType === 'reconciliation' && (
                      <label>
                        Adjustment direction
                        <select
                          value={financeEntryDraft.direction}
                          onChange={(event) => setFinanceEntryDraft((previous) => ({ ...previous, direction: event.target.value }))}
                        >
                          <option value="in">Increase recorded balance</option>
                          <option value="out">Decrease recorded balance</option>
                        </select>
                      </label>
                    )}
                    <label>
                      Category
                      <input
                        required
                        maxLength="80"
                        value={financeEntryDraft.category}
                        onChange={(event) => setFinanceEntryDraft((previous) => ({ ...previous, category: event.target.value }))}
                        placeholder={financeEntryDraft.entryType === 'expense' ? 'Packaging, rent, gateway fee…' : 'Reason'}
                      />
                    </label>
                    {financeEntryDraft.entryType === 'refund' && (
                      <label>
                        Order
                        <select
                          required
                          value={financeEntryDraft.orderId}
                          onChange={(event) => setFinanceEntryDraft((previous) => ({ ...previous, orderId: event.target.value }))}
                        >
                          <option value="">Select a paid order</option>
                          {adminOrders.filter((order) => ['razorpay_paid', 'demo_paid'].includes(order.paymentStatus)).map((order) => (
                            <option key={order.id} value={order.id}>{order.orderNumber} · {money.format(order.total)}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label>
                      External reference (optional)
                      <input
                        maxLength="120"
                        value={financeEntryDraft.reference}
                        onChange={(event) => setFinanceEntryDraft((previous) => ({ ...previous, reference: event.target.value }))}
                        placeholder="Bank / gateway / receipt reference"
                      />
                    </label>
                  </div>
                  <label>
                    Audit note
                    <textarea
                      required
                      maxLength="1000"
                      rows="2"
                      value={financeEntryDraft.note}
                      onChange={(event) => setFinanceEntryDraft((previous) => ({ ...previous, note: event.target.value }))}
                      placeholder="Explain the source and purpose of this record"
                    />
                  </label>
                  <button className="primary-button" type="submit">Save audit record</button>
                  {financeNotice && <p className="account-notice" role="status">{financeNotice}</p>}
                </form>

                <div className="finance-ledger-wrap">
                  <h3>Auditable ledger · latest 250 records in period</h3>
                  {adminFinance.entries.length === 0 ? (
                    <p className="admin-muted-copy">No ledger entries for this period yet. Confirmed payments will be recorded automatically.</p>
                  ) : (
                    <div className="finance-ledger-scroll">
                      <table className="finance-ledger-table">
                        <thead><tr><th>Recorded</th><th>Type</th><th>Order / ref</th><th>Category &amp; note</th><th>Mode / actor</th><th>Amount</th></tr></thead>
                        <tbody>
                          {adminFinance.entries.map((entry) => (
                            <tr key={entry.id}>
                              <td>{indiaDateTime.format(new Date(entry.createdAt))}</td>
                              <td>{entry.entryType}</td>
                              <td>{entry.orderNumber || entry.reference || '—'}</td>
                              <td><strong>{entry.category}</strong><br />{entry.note}</td>
                              <td>{entry.paymentMode || 'manual'}<br />{entry.recordedBy}</td>
                              <td className={entry.amountPaise < 0 ? 'finance-negative' : 'finance-positive'}>
                                {money.format(entry.amountPaise / 100)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="admin-muted-copy" role="status">{adminAnalyticsLoading ? 'Loading tax and finance records…' : 'Finance records are unavailable. Refresh the owner dashboard to try again.'}</p>
            )}
          </section>

          <section className="admin-panel finance-panel" id="admin-crm" aria-labelledby="admin-crm-title">
            <div className="admin-section-heading">
              <div>
                <p className="eyebrow">Optional external service · owner-controlled</p>
                <h2 id="admin-crm-title">Zoho CRM synchronization</h2>
                <p>
                  {adminCrmStatus?.configured
                    ? `Connected configuration for ${adminCrmStatus.apiDataCenter}. New registrations and live paid orders are queued automatically; use manual sync for existing customers.`
                    : 'Not configured. Add Zoho OAuth credentials to the private server .env and restart the API to enable synchronization.'}
                </p>
                <p>
                  This app currently sends customer email and aggregate live paid-order summaries. It excludes names and phone
                  numbers because the account profile does not store them separately from shipping recipients. Delivery addresses,
                  payment details, passwords, and support messages are excluded. Update your privacy notice before enabling Zoho.
                </p>
              </div>
              <button
                className="secondary-button"
                type="button"
                disabled={!adminCrmStatus?.configured || crmSyncing}
                onClick={() => queueZohoSync({ queueAllExisting: true })}
              >
                {crmSyncing ? 'Queueing…' : 'Sync all existing customers'}
              </button>
            </div>
            {adminCrmStatus?.queue && (
              <div className="admin-summary-grid crm-queue-grid" aria-label="Zoho synchronization queue">
                <article className="admin-stat-card"><span>Pending</span><strong>{adminCrmStatus.queue.pending}</strong></article>
                <article className="admin-stat-card"><span>Processing</span><strong>{adminCrmStatus.queue.processing}</strong></article>
                <article className="admin-stat-card"><span>Synced</span><strong>{adminCrmStatus.queue.synced}</strong></article>
                <article className="admin-stat-card"><span>Failed</span><strong>{adminCrmStatus.queue.failed}</strong></article>
              </div>
            )}
            {adminCrmStatus?.latestFailure?.lastError && (
              <p className="admin-login-error" role="status">Latest sync failure: {adminCrmStatus.latestFailure.lastError}</p>
            )}
            {crmNotice && <p className="account-notice" role="status">{crmNotice}</p>}
          </section>

          <section className="admin-panel employee-admin-panel" id="admin-employees" aria-labelledby="admin-employees-title">
            <div className="admin-section-heading">
              <div>
                <p className="eyebrow">Owner-managed access</p>
                <h2 id="admin-employees-title">Employee accounts</h2>
                <p>Review work identity, role, account status, and access events. Passwords are irreversibly hashed and are never displayed; reset one to issue a replacement.</p>
              </div>
            </div>
            <form className="employee-create-form" onSubmit={createEmployee}>
              <h3>Create employee login</h3>
              <div className="finance-entry-fields">
                <label>Name<input required maxLength="120" value={newEmployee.name} onChange={(event) => setNewEmployee((previous) => ({ ...previous, name: event.target.value }))} /></label>
                <label>Work email<input type="email" required maxLength="254" value={newEmployee.email} onChange={(event) => setNewEmployee((previous) => ({ ...previous, email: event.target.value }))} /></label>
                <label>Role<select value={newEmployee.role} onChange={(event) => setNewEmployee((previous) => ({ ...previous, role: event.target.value }))}>
                  <option value="manager">Operations manager</option>
                  <option value="inventory">Inventory</option>
                  <option value="support">Customer support</option>
                  <option value="finance">Finance</option>
                  <option value="cashier">In-store cashier</option>
                </select></label>
                <label>Temporary initial password<input type="password" autoComplete="new-password" required minLength="12" maxLength="256" value={newEmployee.password} onChange={(event) => setNewEmployee((previous) => ({ ...previous, password: event.target.value }))} /></label>
              </div>
              <button className="primary-button" type="submit">Create account</button>
              {adminEmployeeNotice && <p className="account-notice" role="status">{adminEmployeeNotice}</p>}
            </form>
            <div className="employee-admin-list">
              {adminEmployees.length === 0 ? <p className="admin-muted-copy">No employee accounts have been created.</p> : adminEmployees.map((staff) => (
                <article className="employee-admin-card" key={staff.id}>
                  <div className="employee-admin-heading">
                    <div><h3>{staff.name}</h3><p>{staff.email}</p><span>{staff.active ? 'Active' : 'Deactivated'} · Last sign-in: {staff.lastLoginAt ? indiaDateTime.format(new Date(staff.lastLoginAt)) : 'Never'}</span></div>
                    <label>Role<select value={staff.role} onChange={(event) => updateEmployee(staff.id, { role: event.target.value })}>
                      <option value="manager">Operations manager</option>
                      <option value="inventory">Inventory</option>
                      <option value="support">Customer support</option>
                      <option value="finance">Finance</option>
                      <option value="cashier">In-store cashier</option>
                    </select></label>
                  </div>
                  <div className="employee-admin-actions">
                    <button className={staff.active ? 'delete-button' : 'secondary-button'} type="button" onClick={() => updateEmployee(staff.id, { active: !staff.active })}>
                      {staff.active ? 'Deactivate and revoke sessions' : 'Reactivate account'}
                    </button>
                    <form onSubmit={(event) => resetEmployeePassword(event, staff.id)}>
                      <label>New password<input type="password" autoComplete="new-password" required minLength="12" maxLength="256" value={employeeResetDrafts[staff.id] || ''} onChange={(event) => setEmployeeResetDrafts((previous) => ({ ...previous, [staff.id]: event.target.value }))} /></label>
                      <button className="secondary-button" type="submit">Reset password</button>
                    </form>
                    <button className="secondary-button" type="button" onClick={() => Array.isArray(employeeEventLogs[staff.id]) ? setEmployeeEventLogs((previous) => ({ ...previous, [staff.id]: false })) : loadEmployeeEvents(staff.id)}>
                      {Array.isArray(employeeEventLogs[staff.id]) ? 'Hide access history' : 'View access history'}
                    </button>
                  </div>
                  {Array.isArray(employeeEventLogs[staff.id]) && (
                    <ul className="employee-event-list">
                      {employeeEventLogs[staff.id].map((event, index) => <li key={`${event.createdAt}-${index}`}><time>{indiaDateTime.format(new Date(event.createdAt))}</time><strong>{event.type.replaceAll('_', ' ')}</strong><span>{event.detail} · {event.actor}</span></li>)}
                    </ul>
                  )}
                </article>
              ))}
            </div>
          </section>

          <section className="admin-panel admin-inventory-panel" id="admin-inventory" aria-labelledby="admin-inventory-title">
            <div className="admin-section-heading">
              <div>
                <p className="eyebrow">Stock control</p>
                <h2 id="admin-inventory-title">Inventory management</h2>
                <p>Set an opening count to enable tracking. Pending checkouts reserve stock; payment failures and cancellations release it. Generate owner-only QR labels for quick product or order lookup.</p>
              </div>
              <a className="secondary-button" href="#inventory-history">View stock history</a>
            </div>
            <div className="inventory-summary-grid">
              <article><span>Tracked SKUs</span><strong>{trackedProducts.length}</strong></article>
              <article><span>Available units</span><strong>{availableInventoryUnits}</strong></article>
              <article className={lowStockProducts.length ? 'attention' : ''}><span>At reorder level</span><strong>{lowStockProducts.length}</strong></article>
              <article className={outOfStockProducts.length ? 'critical' : ''}><span>Out of stock</span><strong>{outOfStockProducts.length}</strong></article>
            </div>
            <p className="inventory-policy-note">
              Store valuation and profit are not shown because product cost prices are not recorded. Stock count changes are written to the movement history.
            </p>
            <div className="inventory-product-grid">
              {products.map((product) => {
                const draft = inventoryDrafts[product.id] || {
                  stockOnHand: product.stockOnHand,
                  reorderLevel: product.reorderLevel,
                };
                const available = product.stockOnHand - product.reservedQuantity;
                const stockStatus = !product.inventoryTrackingEnabled
                  ? 'not-tracked'
                  : available <= 0 ? 'out-of-stock'
                    : available <= product.reorderLevel ? 'low-stock' : 'in-stock';
                return (
                  <article
                    className={`inventory-product-card ${qrFocus?.type === 'product' && qrFocus.id === product.id ? 'admin-qr-focus' : ''}`}
                    id={`inventory-product-${product.id}`}
                    key={product.id}
                  >
                    <div className="inventory-product-heading">
                      <div><span>{product.category}</span><h3>{product.name}</h3></div>
                      <span className={`inventory-status ${stockStatus}`}>
                        {stockStatus === 'not-tracked' ? 'Not tracked' : stockStatus.replaceAll('-', ' ')}
                      </span>
                    </div>
                    <div className="admin-qr-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setActiveAdminQr(
                          activeAdminQr?.id === product.id && activeAdminQr.type === 'product'
                            ? null
                            : { type: 'product', id: product.id },
                        )}
                      >
                        {activeAdminQr?.id === product.id && activeAdminQr.type === 'product' ? 'Hide product QR' : 'Product record QR'}
                      </button>
                    </div>
                    {activeAdminQr?.id === product.id && activeAdminQr.type === 'product' && (
                      <AdminQrLabel
                        title={product.name}
                        identifier={`Product ID · ${product.id}`}
                        url={`${window.location.origin}/admin?product=${encodeURIComponent(product.id)}`}
                      />
                    )}
                    <div className="admin-unit-toolbar">
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={!product.inventoryTrackingEnabled}
                        onClick={() => {
                          const isOpen = openUnitProductId === product.id;
                          setOpenUnitProductId(isOpen ? null : product.id);
                          if (!isOpen && !inventoryUnitsByProduct[product.id]?.units) {
                            loadInventoryUnits(product.id);
                          }
                        }}
                      >
                        {openUnitProductId === product.id ? 'Hide serialized units' : 'Unique item labels'}
                      </button>
                      {product.inventoryTrackingEnabled && (
                        <span>{product.stockOnHand} physical item{product.stockOnHand === 1 ? '' : 's'} tracked</span>
                      )}
                    </div>
                    {openUnitProductId === product.id && (
                      <div className="admin-unit-list">
                        {inventoryUnitsByProduct[product.id]?.loading && <p role="status">Loading serialized units…</p>}
                        {inventoryUnitsByProduct[product.id]?.error && (
                          <p className="account-error" role="alert">{inventoryUnitsByProduct[product.id].error}</p>
                        )}
                        {(inventoryUnitsByProduct[product.id]?.units || []).map((unit) => (
                          <article
                            className={`admin-unit-row ${qrFocus?.unitId === unit.id ? 'admin-qr-focus' : ''}`}
                            id={`inventory-unit-${unit.id}`}
                            key={unit.id}
                          >
                            <div className="admin-unit-copy">
                              <strong>Unit {unit.id.toUpperCase()}</strong>
                              <span className={`inventory-status ${unit.status}`}>{unit.status}</span>
                              {unit.orderNumber && <span>Order {unit.orderNumber}</span>}
                              {unit.history?.length > 0 && (
                                <details>
                                  <summary>Unit history ({unit.history.length} recent events)</summary>
                                  <ol>
                                    {unit.history.map((event, index) => (
                                      <li key={`${event.type}-${event.createdAt}-${index}`}>
                                        {event.type.replaceAll('_', ' ')} · {indiaDateTime.format(new Date(event.createdAt))}
                                        {event.orderNumber ? ` · ${event.orderNumber}` : ''}
                                      </li>
                                    ))}
                                  </ol>
                                </details>
                              )}
                            </div>
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => setActiveAdminQr(
                                activeAdminQr?.type === 'unit' && activeAdminQr.id === unit.id
                                  ? null
                                  : { type: 'unit', id: unit.id },
                              )}
                            >
                              {activeAdminQr?.type === 'unit' && activeAdminQr.id === unit.id ? 'Hide label' : 'Unique QR'}
                            </button>
                            {activeAdminQr?.type === 'unit' && activeAdminQr.id === unit.id && (
                              <AdminQrLabel
                                title={`${product.name} · unique unit`}
                                identifier={`Code ${unitShortCode(unit.id)} · ${unit.id}`}
                                url={`${window.location.origin}/admin?unit=${encodeURIComponent(unit.id)}`}
                              />
                            )}
                          </article>
                        ))}
                        {(inventoryUnitsByProduct[product.id]?.units?.length || 0) > 0 && (
                          <div className="qr-label-sheet-toolbar">
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => setLabelSheetProductId(labelSheetProductId === product.id ? '' : product.id)}
                            >
                              {labelSheetProductId === product.id ? 'Hide label sheet' : `Label sheet (${inventoryUnitsByProduct[product.id].units.length})`}
                            </button>
                            {labelSheetProductId === product.id && (
                              <PrintSheetButton units={inventoryUnitsByProduct[product.id].units} productName={product.name} />
                            )}
                          </div>
                        )}
                        {labelSheetProductId === product.id && (
                          <div className="qr-label-sheet">
                            {inventoryUnitsByProduct[product.id].units.map((unit) => (
                              <QrSheetLabel
                                key={unit.id}
                                code={unitShortCode(unit.id)}
                                name={product.name}
                                url={`${window.location.origin}/admin?unit=${encodeURIComponent(unit.id)}`}
                              />
                            ))}
                          </div>
                        )}
                        {(inventoryUnitsByProduct[product.id]?.total || 0) === 0 && !inventoryUnitsByProduct[product.id]?.loading && (
                          <p className="admin-muted-copy">Set a physical count above to create individually tracked units and unique labels.</p>
                        )}
                        {(inventoryUnitsByProduct[product.id]?.units?.length || 0) < (inventoryUnitsByProduct[product.id]?.total || 0) && (
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={inventoryUnitsByProduct[product.id]?.loading}
                            onClick={() => loadInventoryUnits(
                              product.id,
                              inventoryUnitsByProduct[product.id]?.units?.length || 0,
                              true,
                            )}
                          >
                            Load more unique item labels
                          </button>
                        )}
                      </div>
                    )}
                    <div className="inventory-numbers">
                      <span>Available <strong>{product.inventoryTrackingEnabled ? available : '—'}</strong></span>
                      <span>Reserved <strong>{product.inventoryTrackingEnabled ? product.reservedQuantity : '—'}</strong></span>
                      <span>On hand <strong>{product.inventoryTrackingEnabled ? product.stockOnHand : '—'}</strong></span>
                    </div>
                    <form className="inventory-adjustment-form" onSubmit={(event) => saveProductInventory(event, product)}>
                      <label>
                        Physical count
                        <input
                          type="number"
                          min={product.reservedQuantity}
                          max="1000000"
                          required
                          value={draft.stockOnHand}
                          onChange={(event) => setInventoryDrafts((previous) => ({
                            ...previous, [product.id]: { ...draft, stockOnHand: event.target.value },
                          }))}
                        />
                      </label>
                      <label>
                        Reorder at
                        <input
                          type="number"
                          min="0"
                          max="1000000"
                          required
                          value={draft.reorderLevel}
                          onChange={(event) => setInventoryDrafts((previous) => ({
                            ...previous, [product.id]: { ...draft, reorderLevel: event.target.value },
                          }))}
                        />
                      </label>
                      <button className="secondary-button" type="submit">
                        {product.inventoryTrackingEnabled ? 'Save stock count' : 'Start tracking'}
                      </button>
                    </form>
                  </article>
                );
              })}
            </div>
            <section className="inventory-history" id="inventory-history">
              <div className="panel-header"><h3>Recent stock movements</h3><span className="admin-data-badge">Latest 12</span></div>
              {inventoryMovements.length === 0 ? (
                <p className="admin-muted-copy">No stock adjustments or reservations have been recorded.</p>
              ) : (
                <div className="inventory-movement-list">
                  {inventoryMovements.map((movement) => (
                    <article key={movement.id}>
                      <div><strong>{movement.productName}</strong><span>{movement.note || movement.type.replaceAll('_', ' ')}</span></div>
                      <span className="movement-type">{movement.type.replaceAll('_', ' ')}</span>
                      <strong>{movement.quantityChange > 0 ? '+' : ''}{movement.quantityChange} on hand</strong>
                      <span>{movement.reservedChange > 0 ? '+' : ''}{movement.reservedChange} reserved</span>
                      <time>{indiaDateTime.format(new Date(movement.createdAt))}</time>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </section>

          <section className="admin-panel payment-settings-panel" id="payment-settings" aria-labelledby="payment-settings-title">
            <div className="panel-header payment-settings-heading">
              <div>
                <p className="eyebrow">Accept customer payments</p>
                <h2 id="payment-settings-title">Razorpay setup</h2>
              </div>
              <span className={`payment-setup-badge ${adminPaymentSettings?.configured ? 'configured' : 'not-configured'}`}>
                {adminPaymentSettings?.configured
                  ? `${adminPaymentSettings.mode === 'live' ? 'Live' : 'Test'} keys connected`
                  : 'Setup required'}
              </span>
            </div>
            <p className="payment-settings-copy">
              Connect your Razorpay merchant account to collect real payments for orders. Complete Razorpay account verification and add a settlement bank account before switching to live keys.
            </p>
            <div className="payment-credential-status" aria-label="Razorpay credential status">
              <span>Key ID: {adminPaymentSettings?.keyIdPresent ? 'configured' : 'missing'}</span>
              <span>Key secret: {adminPaymentSettings?.keySecretPresent ? 'configured securely' : 'missing'}</span>
              <span>Webhook secret: {adminPaymentSettings?.webhookSecretPresent ? 'configured' : 'optional, recommended'}</span>
            </div>
            <ol className="payment-setup-steps">
              <li>Create and verify a merchant account in the Razorpay Dashboard; add your bank account for settlements.</li>
              <li>Generate test keys first. Add <code>RAZORPAY_KEY_ID</code> and <code>RAZORPAY_KEY_SECRET</code> to the server's private environment (local <code>.env</code> or your host's secret manager), then restart the server.</li>
              <li>Configure the webhook URL <code>/api/payments/razorpay/webhook</code> for <code>payment.captured</code> and <code>payment.failed</code>; store its signing secret as <code>RAZORPAY_WEBHOOK_SECRET</code>.</li>
              <li>Test the full flow, then replace the test keys with live keys only after account approval. Activate UPI, cards, or other methods in Razorpay according to your account eligibility.</li>
            </ol>
            <div className="payment-settings-actions">
              <a className="secondary-button" href="https://dashboard.razorpay.com/app/keys" target="_blank" rel="noreferrer">
                Open Razorpay Dashboard
              </a>
              <span>Secret values are never displayed or stored in this dashboard.</span>
            </div>
            {!adminPaymentSettings?.configured && (
              <p className="payment-setup-note" role="status">
                Real payments are currently unavailable. Test-only simulation is available in development; it never moves money.
              </p>
            )}
          </section>

          <section className="admin-layout" id="admin-products">
            <div className="admin-panel">
              <div className="panel-header">
                <h2>Add a new posting</h2>
              </div>

              <form className="admin-form" onSubmit={handleAddProduct}>
                <label>
                  Product name
                  <input
                    type="text"
                    value={newProduct.name}
                    onChange={(event) =>
                      setNewProduct((previous) => ({ ...previous, name: event.target.value }))
                    }
                    placeholder="Example: Linen bench"
                  />
                </label>

                <div className="inline-field-row">
                  <label>
                    Category
                    <select
                      value={newProduct.category}
                      onChange={(event) =>
                        setNewProduct((previous) => ({
                          ...previous,
                          category: event.target.value,
                        }))
                      }
                    >
                      {categories
                        .filter((category) => category !== 'All')
                        .map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                    </select>
                  </label>

                  <label>
                    Price before GST (₹ INR)
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={newProduct.price}
                      onChange={(event) =>
                        setNewProduct((previous) => ({
                          ...previous,
                          price: event.target.value,
                        }))
                      }
                      placeholder="299"
                    />
                  </label>

                  <label>
                    GST rate (%)
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      required
                      value={newProduct.gstRate}
                      onChange={(event) =>
                        setNewProduct((previous) => ({ ...previous, gstRate: event.target.value }))
                      }
                      placeholder="Set the verified rate"
                    />
                  </label>
                </div>

                <label>
                  HSN/SAC code (optional)
                  <input
                    type="text"
                    maxLength="8"
                    value={newProduct.hsnCode}
                    onChange={(event) =>
                      setNewProduct((previous) => ({ ...previous, hsnCode: event.target.value.toUpperCase() }))
                    }
                    placeholder="As advised by your tax professional"
                  />
                </label>

                <div className="inline-field-row">
                  <label>
                    Tag
                    <input
                      type="text"
                      value={newProduct.tag}
                      onChange={(event) =>
                        setNewProduct((previous) => ({ ...previous, tag: event.target.value }))
                      }
                      placeholder="New"
                    />
                  </label>

                  <label>
                    Accent
                    <input
                      type="text"
                      value={newProduct.accent}
                      onChange={(event) =>
                        setNewProduct((previous) => ({ ...previous, accent: event.target.value }))
                      }
                      placeholder="Soft oak"
                    />
                  </label>
                </div>

                <label>
                  Image URL
                  <input
                    type="url"
                    value={newProduct.image}
                    onChange={(event) =>
                      setNewProduct((previous) => ({ ...previous, image: event.target.value }))
                    }
                    placeholder="https://example.com/image.jpg"
                  />
                </label>

                <label>
                  Short description
                  <textarea
                    rows="4"
                    value={newProduct.description}
                    onChange={(event) =>
                      setNewProduct((previous) => ({
                        ...previous,
                        description: event.target.value,
                      }))
                    }
                    placeholder="What makes this item special?"
                  />
                </label>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={newProduct.published}
                    onChange={(event) =>
                      setNewProduct((previous) => ({
                        ...previous,
                        published: event.target.checked,
                      }))
                    }
                  />
                  Publish immediately
                </label>

                <button type="submit" className="primary-button admin-submit-button">
                  Save posting
                </button>
              </form>
            </div>

            <div className="admin-panel">
              <div className="panel-header">
                <h2>Manage postings</h2>
              </div>

              <div className="admin-product-list">
                {products.length === 0 ? (
                  <p className="admin-login-copy">
                    {productsLoading ? 'Loading postings…' : 'No postings yet.'}
                  </p>
                ) : products.map((product) => (
                  <article key={product.id} className="admin-product-card">
                    <img src={product.image} alt={product.name} />
                    <div className="admin-product-copy">
                      <div className="admin-product-topline">
                        <div>
                          <h3>{product.name}</h3>
                          <p>{product.category}</p>
                        </div>
                        <span className="admin-price">{money.format(product.price)}</span>
                      </div>

                      <p className="admin-description">{product.description}</p>

                      <form className="product-tax-form" onSubmit={(event) => saveProductTax(event, product)}>
                        <label>
                          GST rate (%)
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            required
                            value={(productTaxDrafts[product.id]?.gstRate ?? product.gstRate) ?? ''}
                            onChange={(event) => setProductTaxDrafts((previous) => ({
                              ...previous,
                              [product.id]: {
                                gstRate: event.target.value,
                                hsnCode: previous[product.id]?.hsnCode ?? product.hsnCode ?? '',
                              },
                            }))}
                          />
                        </label>
                        <label>
                          HSN/SAC
                          <input
                            type="text"
                            maxLength="8"
                            value={productTaxDrafts[product.id]?.hsnCode ?? product.hsnCode ?? ''}
                            onChange={(event) => setProductTaxDrafts((previous) => ({
                              ...previous,
                              [product.id]: {
                                gstRate: previous[product.id]?.gstRate ?? product.gstRate ?? '',
                                hsnCode: event.target.value.toUpperCase(),
                              },
                            }))}
                          />
                        </label>
                        <button className="secondary-button" type="submit">Save tax settings</button>
                      </form>
                      <p className="admin-muted-copy">
                        {product.gstRate === null || product.gstRate === undefined
                          ? 'Tax rate not configured; checkout is paused for this product.'
                          : `New orders use ${product.gstRate}% GST. Existing orders retain their saved tax snapshot.`}
                      </p>

                      <div className="admin-product-actions">
                        <button
                          className={
                            product.published === false ? 'publish-toggle off' : 'publish-toggle'
                          }
                          onClick={() => toggleProductPublished(product)}
                        >
                          {product.published === false ? 'Draft' : 'Published'}
                        </button>
                        <button className="delete-button" onClick={() => deleteProduct(product.id)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="admin-panel admin-orders-panel" id="admin-orders">
            <div className="panel-header">
              <div>
                <h2>Customer orders</h2>
                <p className="admin-order-policy-note">
                  Cancelling an already paid order does not issue a refund or restock returned items. Reconcile the physical count after any return.
                </p>
              </div>
            </div>
            {adminOrders.length === 0 ? (
              <p className="admin-login-copy">No customer orders yet.</p>
            ) : (
              <div className="admin-order-list">
                {adminOrders.map((order) => (
                  <article
                    className={`admin-order-row ${qrFocus?.type === 'order' && qrFocus.id === order.id ? 'admin-qr-focus' : ''}`}
                    id={`admin-order-${order.id}`}
                    key={order.id}
                  >
                    <div>
                      <strong>{order.orderNumber}</strong>
                      <span>{order.customerEmail}</span>
                      <span>{indiaDate.format(new Date(order.created_at))}</span>
                      <button
                        type="button"
                        className="secondary-button admin-order-qr-toggle"
                        onClick={() => setActiveAdminQr(
                          activeAdminQr?.id === order.id && activeAdminQr.type === 'order'
                            ? null
                            : { type: 'order', id: order.id },
                        )}
                      >
                        {activeAdminQr?.id === order.id && activeAdminQr.type === 'order' ? 'Hide order QR' : 'Show order QR'}
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => printInvoice(order)}
                      >
                        Print invoice
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={!adminCrmStatus?.configured || crmSyncing}
                        onClick={() => queueZohoSync({ customerId: order.customerId })}
                      >
                        Sync customer to Zoho
                      </button>
                      {activeAdminQr?.id === order.id && activeAdminQr.type === 'order' && (
                        <AdminQrLabel
                          title={`Order ${order.orderNumber}`}
                          identifier={`Order ID · ${order.id}`}
                          url={`${window.location.origin}/admin?order=${encodeURIComponent(order.id)}`}
                        />
                      )}
                    </div>
                    <div>
                      <strong>{money.format(order.total)}</strong>
                      {order.taxTotal !== null && order.taxTotal !== undefined && (
                        <span>GST included: {money.format(order.taxTotal)}</span>
                      )}
                      <span>{order.items.length} line items</span>
                      <span className="admin-order-payment">
                        {order.paymentStatus === 'demo_paid'
                          ? 'Test UPI · simulated · no money moved'
                          : order.paymentStatus === 'razorpay_paid'
                            ? order.paymentProviderMode === 'test'
                              ? 'Razorpay test · no money collected'
                              : order.paymentProviderMode === 'live'
                                ? 'Razorpay live · payment verified'
                                : 'Razorpay · verified (mode not recorded)'
                            : order.paymentStatus === 'razorpay_pending'
                              ? 'Razorpay · pending'
                              : order.paymentStatus === 'razorpay_failed'
                                ? 'Razorpay · failed'
                                : 'Payment not collected'}
                      </span>
                    </div>
                    <label>
                      Fulfillment status
                      <select
                        value={order.status}
                        onChange={(event) => updateOrderStatus(order.id, event.target.value)}
                      >
                        {orderStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {order.recipientName && (
                      <p className="admin-order-address">
                        Deliver to {order.recipientName} · +91 {order.phone} · {order.addressLine1}
                        {order.addressLine2 ? `, ${order.addressLine2}` : ''}, {order.city},{' '}
                        {order.state} {order.postalCode}
                      </p>
                    )}
                    {taxInvoiceOrder?.id === order.id && <OrderInvoice order={order} />}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="admin-panel admin-logistics-panel" id="admin-logistics" aria-labelledby="admin-logistics-title">
            <div className="admin-section-heading">
              <div>
                <p className="eyebrow">Dispatch and last-mile delivery</p>
                <h2 id="admin-logistics-title">Logistics desk</h2>
                <p>Assign eligible paid orders to separate delivery accounts. Staff see only their own route assignments.</p>
              </div>
            </div>
            {!pickupAddress && (
              <p className="admin-ai-setup-note" role="status">
                Set <code>STORE_PICKUP_ADDRESS</code> in the server environment and restart the API so drivers know where to collect parcels.
              </p>
            )}
            {pickupAddress && <p className="logistics-pickup-address"><strong>Pickup point:</strong> {pickupAddress}</p>}
            <div className="admin-logistics-grid">
              <section className="admin-panel logistics-agent-panel">
                <div className="panel-header">
                  <div><h3>Delivery staff</h3><span className="admin-muted-copy">Create individual sign-ins; never share the owner password.</span></div>
                  <span className="admin-data-badge">{deliveryAgents.filter((agent) => agent.active).length} active</span>
                </div>
                <form className="delivery-agent-form" onSubmit={createDeliveryAgent}>
                  <label>
                    Name
                    <input required maxLength="120" value={newDeliveryAgent.name} onChange={(event) => setNewDeliveryAgent((previous) => ({ ...previous, name: event.target.value }))} />
                  </label>
                  <label>
                    Email
                    <input type="email" required maxLength="254" autoComplete="off" value={newDeliveryAgent.email} onChange={(event) => setNewDeliveryAgent((previous) => ({ ...previous, email: event.target.value }))} />
                  </label>
                  <label>
                    Initial password (12+ characters)
                    <input type="password" required minLength="12" maxLength="256" autoComplete="new-password" value={newDeliveryAgent.password} onChange={(event) => setNewDeliveryAgent((previous) => ({ ...previous, password: event.target.value }))} />
                  </label>
                  <button className="secondary-button" type="submit">Create delivery account</button>
                  {deliveryAgentNotice.text && (
                    <p className={deliveryAgentNotice.type === 'error' ? 'admin-login-error' : 'admin-muted-copy'} role={deliveryAgentNotice.type === 'error' ? 'alert' : 'status'}>{deliveryAgentNotice.text}</p>
                  )}
                </form>
                {deliveryAgents.length === 0 ? (
                  <p className="admin-muted-copy">Create a delivery account before assigning a route.</p>
                ) : (
                  <div className="delivery-agent-list">
                    {deliveryAgents.map((agent) => (
                      <article key={agent.id}>
                        <div><strong>{agent.name}</strong><span>{agent.email} · {agent.activeDeliveries || 0} active deliveries</span></div>
                        <button className={agent.active ? 'secondary-button' : 'publish-toggle off'} type="button" onClick={() => setDeliveryAgentActive(agent)}>
                          {agent.active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </section>
              <section className="admin-panel dispatch-list-panel">
                <div className="panel-header"><h3>Dispatch queue</h3><span className="admin-data-badge">{adminDeliveries.length} orders</span></div>
                {adminDeliveries.length === 0 ? (
                  <p className="admin-muted-copy">Eligible paid orders appear here when ready to dispatch.</p>
                ) : (
                  <div className="dispatch-order-list">
                    {adminDeliveries.map((delivery) => (
                      <article className="dispatch-order-card" key={delivery.orderId}>
                        <div className="dispatch-order-heading">
                          <div><strong>{delivery.orderNumber}</strong><span>{delivery.recipientName} · {indiaDateTime.format(new Date(delivery.createdAt))}</span></div>
                          <span className={`ticket-status ${delivery.deliveryStatus ? `ticket-${delivery.deliveryStatus}` : 'ticket-open'}`}>
                            {delivery.deliveryStatus?.replaceAll('_', ' ') || 'ready to assign'}
                          </span>
                        </div>
                        <p>{delivery.addressLine1}{delivery.addressLine2 ? `, ${delivery.addressLine2}` : ''}, {delivery.city}, {delivery.state} {delivery.postalCode} · +91 {delivery.phone}</p>
                        <div className="dispatch-order-items">
                          {delivery.items.map((item) => (
                            <div key={item.id}>
                              <span>{item.name} × {item.quantity}</span>
                              {item.units.map((unit) => (
                                <span className="dispatch-unit-label" key={unit.id}>
                                  Unit QR · {unit.id.slice(0, 8).toUpperCase()}
                                  <button
                                    className="secondary-button"
                                    type="button"
                                    onClick={() => setActiveAdminQr(activeAdminQr?.type === 'driver-unit' && activeAdminQr.id === unit.id ? null : { type: 'driver-unit', id: unit.id })}
                                  >
                                    {activeAdminQr?.type === 'driver-unit' && activeAdminQr.id === unit.id ? 'Hide' : 'Print driver label'}
                                  </button>
                                  {activeAdminQr?.type === 'driver-unit' && activeAdminQr.id === unit.id && (
                                    <AdminQrLabel
                                      title={`${item.name} · delivery pickup`}
                                      identifier={`Unit ID · ${unit.id}`}
                                      description="Scan from the assigned delivery staff account to record pickup"
                                      url={`${window.location.origin}/delivery?unit=${encodeURIComponent(unit.id)}`}
                                    />
                                  )}
                                </span>
                              ))}
                            </div>
                          ))}
                        </div>
                        {delivery.agentName && <p>Assigned to <strong>{delivery.agentName}</strong> · {delivery.agentEmail}</p>}
                        {(!delivery.deliveryStatus || delivery.deliveryStatus === 'assigned') && (
                          <div className="dispatch-assignment-row">
                            <label>
                              Delivery person
                              <select
                                value={deliveryAssignmentDrafts[delivery.orderId] || delivery.agentId || ''}
                                onChange={(event) => setDeliveryAssignmentDrafts((previous) => ({ ...previous, [delivery.orderId]: event.target.value }))}
                              >
                                <option value="">Select active staff</option>
                                {deliveryAgents.filter((agent) => agent.active).map((agent) => (
                                  <option value={agent.id} key={agent.id}>{agent.name} · {agent.email}</option>
                                ))}
                              </select>
                            </label>
                            <button className="primary-button" type="button" disabled={!deliveryAgents.some((agent) => agent.active)} onClick={() => assignDelivery(delivery)}>
                              {delivery.deliveryStatus ? 'Reassign' : 'Assign delivery'}
                            </button>
                          </div>
                        )}
                        {delivery.deliveryId && (
                          <div className="dispatch-qr-actions">
                            <button className="secondary-button" type="button" onClick={() => setActiveAdminQr(activeAdminQr?.type === 'dispatch' && activeAdminQr.id === delivery.orderId ? null : { type: 'dispatch', id: delivery.orderId })}>
                              {activeAdminQr?.type === 'dispatch' && activeAdminQr.id === delivery.orderId ? 'Hide driver QR' : 'Driver order QR'}
                            </button>
                            {activeAdminQr?.type === 'dispatch' && activeAdminQr.id === delivery.orderId && (
                              <AdminQrLabel
                                title={`Driver pickup · ${delivery.orderNumber}`}
                                identifier={`Delivery ID · ${delivery.deliveryId}`}
                                description="For this order's assigned delivery staff"
                                url={`${window.location.origin}/delivery?order=${encodeURIComponent(delivery.orderId)}`}
                              />
                            )}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </section>

          <section className="admin-panel admin-support-panel" id="admin-support">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Customer care</p>
                <h2>Support inbox</h2>
              </div>
              <span className={openSupportTickets.length ? 'admin-data-badge attention' : 'admin-data-badge'}>
                {openSupportTickets.length} needs reply
              </span>
            </div>
            {adminSupportTickets.length === 0 ? (
              <p className="admin-muted-copy">No customer support conversations yet.</p>
            ) : (
              <div className="admin-support-list">
                {adminSupportTickets.map((ticket) => (
                  <article className="admin-support-ticket" key={ticket.id}>
                    <div className="support-ticket-heading">
                      <div>
                        <span>{ticket.category} · {ticket.orderNumber || 'general enquiry'}</span>
                        <h3>{ticket.subject}</h3>
                        <p>{ticket.customerEmail}</p>
                      </div>
                      <label>
                        Ticket status
                        <select
                          value={ticket.status}
                          onChange={(event) => updateSupportTicketStatus(ticket.id, event.target.value)}
                        >
                          <option value="open">Open</option>
                          <option value="in_progress">In progress</option>
                          <option value="waiting_customer">Waiting for customer</option>
                          <option value="resolved">Resolved</option>
                          <option value="closed">Closed</option>
                        </select>
                      </label>
                    </div>
                    <div className="support-message-list">
                      {ticket.messages.map((message) => (
                        <div className={`support-message ${message.authorRole}`} key={message.id}>
                          <strong>{message.authorRole === 'owner' ? 'Store team' : message.authorName}</strong>
                          <p>{message.message}</p>
                          <time>{indiaDateTime.format(new Date(message.createdAt))}</time>
                        </div>
                      ))}
                    </div>
                    <form className="support-reply-form" onSubmit={(event) => handleOwnerSupportReply(event, ticket.id)}>
                      <label>
                        Reply to customer
                        <textarea
                          required
                          maxLength="3000"
                          rows="2"
                          value={supportReplyDrafts[ticket.id] || ''}
                          onChange={(event) => setSupportReplyDrafts((previous) => ({ ...previous, [ticket.id]: event.target.value }))}
                          placeholder="Write a clear, helpful response"
                        />
                      </label>
                      <button className="primary-button" type="submit">Send reply</button>
                    </form>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="admin-panel admin-feedback-panel" id="admin-feedback">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Voice of the customer</p>
                <h2>Order feedback</h2>
              </div>
              <span className={pendingFeedbackCount ? 'admin-data-badge attention' : 'admin-data-badge'}>
                {pendingFeedbackCount} to review
              </span>
            </div>
            {adminFeedback.length === 0 ? (
              <p className="admin-muted-copy">Customer feedback will appear here after a paid order.</p>
            ) : (
              <div className="admin-feedback-list">
                {adminFeedback.map((item) => (
                  <article className="admin-feedback-card" key={item.id}>
                    <div className="admin-feedback-heading">
                      <div>
                        <strong>{item.orderNumber} · {item.customerEmail}</strong>
                        <span>{indiaDate.format(new Date(item.createdAt))}</span>
                      </div>
                      <strong className="feedback-rating">{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)} <span>{item.rating}/5</span></strong>
                    </div>
                    <p>{item.message || 'Customer submitted a rating without a written comment.'}</p>
                    <div className="admin-feedback-actions">
                      <span className={`ticket-status ticket-${item.status}`}>{item.status}</span>
                      {item.status !== 'approved' && (
                        <button className="secondary-button" onClick={() => moderateFeedback(item.id, 'approved')}>Approve</button>
                      )}
                      {item.status !== 'hidden' && (
                        <button className="delete-button" onClick={() => moderateFeedback(item.id, 'hidden')}>Hide</button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </main>
      </>
    );
  }

  if (isAdminPath && adminChecking) {
    return (
      <main className="admin-login-overlay">
        <section className="admin-login-card" aria-live="polite">
          <h1>Checking owner session</h1>
        </section>
      </main>
    );
  }

  if (isAdminPath) {
    return (
      <main className="admin-login-overlay">
        <section className="admin-login-card" aria-labelledby="owner-access-title">
          <div className="panel-header">
            <h1 id="owner-access-title">Owner access</h1>
          </div>
          <p className="admin-login-copy">Sign in to manage product listings and storefront updates.</p>

          <form className="admin-login-form" onSubmit={handleAdminLogin}>
            <label>
              Email
              <input
                type="email"
                autoComplete="username"
                required
                value={adminCredentials.email}
                onChange={(event) =>
                  setAdminCredentials((previous) => ({
                    ...previous,
                    email: event.target.value,
                  }))
                }
                placeholder="Owner email"
              />
            </label>

            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={adminCredentials.password}
                onChange={(event) =>
                  setAdminCredentials((previous) => ({
                    ...previous,
                    password: event.target.value,
                  }))
                }
                placeholder="Password"
              />
            </label>

            {adminError && <p className="admin-login-error" role="alert">{adminError}</p>}

            <div className="admin-login-actions">
              <a className="secondary-button" href="/">Cancel</a>
              <button type="submit" className="primary-button">Sign in</button>
            </div>
          </form>
        </section>
      </main>
    );
  }

  if (isPosPath) {
    return <PosApp apiRequest={apiRequest} QrScannerDialog={QrScannerDialog} />;
  }

  if (isDeliveryPath && deliveryChecking) {
    return (
      <main className="delivery-shell">
        <p className="eyebrow">SSTE Studio logistics</p>
        <h1>Checking delivery staff session…</h1>
      </main>
    );
  }

  if (isDeliveryPath) {
    return (
      <>
        <header className="topbar account-topbar">
          <a className="brand-block" href="/">
            <span className="brand-mark">S</span>
            <span><span className="brand-name">SSTE Studio</span><span className="brand-tag">Delivery operations</span></span>
          </a>
          <div className="header-actions">
            <a className="ghost-button" href="/">Storefront</a>
            {deliveryAgent && <button className="primary-button" onClick={() => setScannerMode('delivery')}>Scan parcel</button>}
            {deliveryAgent && <button className="ghost-button" onClick={handleDeliveryLogout}>Sign out</button>}
          </div>
        </header>
        {scannerMode === 'delivery' && (
          <QrScannerDialog
            continuous
            title="Scan parcel items"
            hint="Scan each item label in turn. Each one is recorded automatically."
            onScan={handleDeliveryScan}
            onClose={() => setScannerMode('')}
          />
        )}
        <main className="delivery-shell">
          {deliveryAgent ? (
            <>
              <section className="account-heading">
                <div>
                  <p className="eyebrow">Assigned routes</p>
                  <h1>Welcome, {deliveryAgent.name}</h1>
                  <p>{deliveryAgent.email}</p>
                </div>
                <span className="account-order-count">{deliveryAssignments.length} active deliveries</span>
              </section>
              {pickupAddress
                ? <p className="logistics-pickup-address"><strong>Pickup point:</strong> {pickupAddress}</p>
                : <p className="admin-ai-setup-note">The store owner has not configured a pickup point yet. Contact dispatch for collection instructions.</p>}
              {deliveryNotice && <p className="account-notice" role="status">{deliveryNotice}</p>}
              {deliveryError && <p className="account-error" role="alert">{deliveryError}</p>}
              {deliveryAssignments.length === 0 ? (
                <section className="admin-panel"><p className="admin-muted-copy">No active deliveries are assigned to you.</p></section>
              ) : (
                <div className="delivery-assignment-list">
                  {deliveryAssignments.map((delivery) => {
                    const units = delivery.items.flatMap((item) => item.units);
                    const allUnitsScanned = units.every((unit) => unit.pickedUp);
                    const nextStatus = delivery.deliveryStatus === 'assigned'
                      ? 'picked_up'
                      : delivery.deliveryStatus === 'picked_up'
                        ? 'in_transit'
                        : delivery.deliveryStatus === 'in_transit'
                          ? 'out_for_delivery'
                          : delivery.deliveryStatus === 'out_for_delivery'
                            ? 'delivered'
                            : delivery.deliveryStatus === 'delivery_failed'
                              ? 'in_transit' : '';
                    return (
                      <article
                        className={`admin-panel delivery-assignment-card ${deliveryFocusOrderId === delivery.orderId ? 'admin-qr-focus' : ''}`}
                        id={`delivery-order-${delivery.orderId}`}
                        key={delivery.deliveryId}
                      >
                        <div className="delivery-card-heading">
                          <div><p className="eyebrow">Order {delivery.orderNumber}</p><h2>{delivery.deliveryStatus.replaceAll('_', ' ')}</h2></div>
                          <span className="admin-data-badge">{money.format(delivery.total)}</span>
                        </div>
                        <div className="delivery-drop-details">
                          <strong>{delivery.recipientName} · +91 {delivery.phone}</strong>
                          <span>{delivery.addressLine1}{delivery.addressLine2 ? `, ${delivery.addressLine2}` : ''}</span>
                          <span>{delivery.city}, {delivery.state} {delivery.postalCode}</span>
                        </div>
                        <h3>Parcel items · scan each serialized unit at pickup</h3>
                        <div className="delivery-item-list">
                          {delivery.items.map((item) => (
                            <section key={item.id} className="delivery-item">
                              <strong>{item.name} × {item.quantity}</strong>
                              {item.units.length === 0 ? (
                                <span>This item is not individually serialized.</span>
                              ) : item.units.map((unit) => (
                                <div
                                  className={`delivery-unit-scan-row ${deliveryFocusUnitId === unit.id ? 'admin-qr-focus' : ''}`}
                                  id={`delivery-unit-${unit.id}`}
                                  key={unit.id}
                                >
                                  <span>Unit {unit.id.toUpperCase()}</span>
                                  <span className={`inventory-status ${unit.pickedUp ? 'sold' : 'reserved'}`}>
                                    {unit.pickedUp ? 'scanned at pickup' : 'awaiting scan'}
                                  </span>
                                  <button
                                    type="button"
                                    className="secondary-button"
                                    disabled={unit.pickedUp || !['assigned', 'picked_up'].includes(delivery.deliveryStatus)}
                                    onClick={() => pickupDeliveryUnit(unit.id)}
                                  >
                                    {unit.pickedUp ? 'Scanned' : 'Confirm pickup scan'}
                                  </button>
                                </div>
                              ))}
                            </section>
                          ))}
                        </div>
                        {delivery.deliveryStatus === 'out_for_delivery' && (
                          <label className="delivery-pin-field">
                            Customer delivery PIN
                            <input
                              inputMode="numeric"
                              pattern="[0-9]{6}"
                              maxLength="6"
                              value={deliveryPinDrafts[delivery.deliveryId] || ''}
                              onChange={(event) => setDeliveryPinDrafts((previous) => ({ ...previous, [delivery.deliveryId]: event.target.value.replace(/\D/g, '').slice(0, 6) }))}
                              placeholder="6-digit PIN from recipient"
                            />
                            <small>Ask the customer for the PIN shown in their account under Orders. Confirm delivery works once all 6 digits are entered.</small>
                          </label>
                        )}
                        {delivery.deliveryStatus === 'out_for_delivery' && (
                          <label className="delivery-pin-field">
                            Delivery exception note
                            <input
                              maxLength="240"
                              value={deliveryNoteDrafts[delivery.deliveryId] || ''}
                              onChange={(event) => setDeliveryNoteDrafts((previous) => ({ ...previous, [delivery.deliveryId]: event.target.value }))}
                              placeholder="Leave empty for successful delivery"
                            />
                          </label>
                        )}
                        <div className="delivery-status-actions">
                          <span>{delivery.deliveryStatus === 'assigned' && `${units.filter((unit) => unit.pickedUp).length}/${units.length} serialized units scanned`}</span>
                          {nextStatus && (
                            <button
                              className="primary-button"
                              type="button"
                              disabled={(delivery.deliveryStatus === 'assigned' && !allUnitsScanned) || deliveryBusyId === delivery.deliveryId}
                              onClick={() => {
                                if (nextStatus === 'delivered' && !/^\d{6}$/.test(deliveryPinDrafts[delivery.deliveryId] || '')) {
                                  setDeliveryNotice('');
                                  setDeliveryActionId(delivery.deliveryId);
                                  setDeliveryError('Enter the 6-digit delivery PIN first. The customer finds it under Account → Orders → Delivery PIN.');
                                  return;
                                }
                                updateDeliveryStep(delivery);
                              }}
                            >
                              {deliveryBusyId === delivery.deliveryId
                                ? 'Saving…'
                                : nextStatus === 'delivered'
                                ? 'Confirm delivery'
                                : nextStatus === 'picked_up'
                                  ? 'Confirm parcel pickup'
                                  : nextStatus === 'in_transit'
                                    ? 'Start transit'
                                    : 'Out for delivery'}
                            </button>
                          )}
                          {delivery.deliveryStatus === 'out_for_delivery' && (
                            <button
                              className="secondary-button"
                              type="button"
                              disabled={(deliveryNoteDrafts[delivery.deliveryId] || '').trim().length < 5}
                              onClick={() => updateDeliveryStep(delivery, 'delivery_failed')}
                            >
                              Report failed delivery
                            </button>
                          )}
                        </div>
                        {deliveryActionId === delivery.deliveryId && deliveryError && (
                          <p className="account-error" role="alert">✗ {deliveryError}</p>
                        )}
                        {delivery.history.length > 0 && (
                          <details className="delivery-event-history">
                            <summary>Recent tracking events</summary>
                            <ol>{delivery.history.map((event, index) => (
                              <li key={`${event.type}-${event.createdAt}-${index}`}>
                                {event.type.replaceAll('_', ' ')} · {indiaDateTime.format(new Date(event.createdAt))}
                                {event.note ? ` · ${event.note}` : ''}
                              </li>
                            ))}</ol>
                          </details>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <section className="admin-login-card delivery-login-card">
              <p className="eyebrow">Authorized delivery staff only</p>
              <h1>Delivery sign in</h1>
              <p className="admin-login-copy">Use the separate account provided by the store owner. You can access only deliveries assigned to you.</p>
              {deliveryRecovering ? (
                <AccountRecoveryPanel initialAccountType="delivery" onBack={() => setDeliveryRecovering(false)} />
              ) : (
                <form className="admin-login-form" onSubmit={handleDeliveryLogin}>
                  <label>Email<input type="email" required autoComplete="username" value={deliveryCredentials.email} onChange={(event) => setDeliveryCredentials((previous) => ({ ...previous, email: event.target.value }))} /></label>
                  <label>Password<input type="password" required autoComplete="current-password" value={deliveryCredentials.password} onChange={(event) => setDeliveryCredentials((previous) => ({ ...previous, password: event.target.value }))} /></label>
                  {deliveryError && <p className="admin-login-error" role="alert">{deliveryError}</p>}
                  <div className="admin-login-actions"><a className="secondary-button" href="/">Cancel</a><button className="primary-button" type="submit">Sign in</button></div>
                  <button className="text-button account-forgot-link" type="button" onClick={() => setDeliveryRecovering(true)}>Forgot email or password?</button>
                </form>
              )}
            </section>
          )}
        </main>
      </>
    );
  }

  if (isAccountPath && customerChecking) {
    return (
      <main className="account-shell">
        <p className="eyebrow">SSTE Studio</p>
        <h1>Loading your account</h1>
      </main>
    );
  }

  if (isAccountPath) {
    return (
      <>
        <header className="topbar account-topbar">
          <a className="brand-block" href="/">
            <span className="brand-mark">S</span>
            <span>
              <span className="brand-name">SSTE Studio</span>
              <span className="brand-tag">Customer account</span>
            </span>
          </a>
          <div className="header-actions">
            <a className="ghost-button" href="/">Continue shopping</a>
            {customer && (
              <button className="ghost-button" onClick={handleCustomerLogout}>Sign out</button>
            )}
          </div>
        </header>

        <main className="account-shell">
          {customer ? (
            <>
              <section className="account-heading">
                <div>
                  <p className="eyebrow">Your account</p>
                  <h1>Order history</h1>
                  <p>{customer.email}</p>
                </div>
                <span className="account-order-count">{customerOrders.length} orders</span>
              </section>

              {customerNotice && <p className="account-notice" role="status">{customerNotice}</p>}
              {customerError && <p className="account-error" role="alert">{customerError}</p>}

              {ordersLoading ? (
                <p className="account-empty">Loading your orders…</p>
              ) : customerOrders.length === 0 ? (
                <section className="account-empty">
                  <h2>No orders yet</h2>
                  <p>Orders you place while signed in will be saved here.</p>
                  <a className="primary-button" href="/">Browse the collection</a>
                </section>
              ) : (
                <div className="customer-order-list">
                  {customerOrders.map((order) => (
                    <article className="customer-order" key={order.id}>
                      <header className="customer-order-header">
                        <div>
                          <span>Order number</span>
                          <strong>{order.orderNumber}</strong>
                        </div>
                        <div>
                          <span>Placed</span>
                          <strong>{indiaDate.format(new Date(order.created_at))}</strong>
                        </div>
                        <div>
                          <span>Status</span>
                          <strong className={`order-status status-${order.status}`}>
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </strong>
                        </div>
                        <div>
                          <span>Total</span>
                          <strong>{money.format(order.total)}</strong>
                        </div>
                      </header>
                      {order.paymentStatus && (
                        <p className="order-payment-status">
                          {order.paymentStatus === 'demo_paid'
                            ? 'Test UPI · simulated success · no money moved'
                            : order.paymentStatus === 'razorpay_paid'
                              ? order.paymentProviderMode === 'test'
                                ? 'Razorpay test payment · no money collected'
                                : order.paymentProviderMode === 'live'
                                  ? 'Razorpay live payment · verified'
                                  : 'Razorpay · verified (mode not recorded)'
                              : order.paymentStatus === 'razorpay_pending'
                                ? 'Razorpay · awaiting payment confirmation'
                                : order.paymentStatus === 'razorpay_failed'
                                  ? 'Razorpay · payment failed'
                                  : 'Payment not collected'}
                        </p>
                      )}
                      {order.deliveryStatus && (
                        <div className="customer-delivery-tracking" aria-live="polite">
                          <div>
                            <span>Delivery status</span>
                            <strong>{order.deliveryStatus.replaceAll('_', ' ')}</strong>
                          </div>
                          {order.deliveryPin && (
                            <p>
                              Delivery PIN <strong>{order.deliveryPin}</strong>
                              <span> Share this with your delivery person only when your parcel arrives.</span>
                            </p>
                          )}
                        </div>
                      )}
                      <div className="customer-order-items">
                        {order.items.map((item) => (
                          <div className="customer-order-item" key={item.id}>
                            <img src={item.image} alt="" />
                            <span>{item.name}</span>
                            <span>Qty {item.quantity}</span>
                            <strong>{money.format(item.price * item.quantity)}</strong>
                          </div>
                        ))}
                      </div>
                      {order.recipientName && (
                        <p className="order-delivery-address">
                          Delivering to {order.recipientName} · {order.addressLine1}
                          {order.addressLine2 ? `, ${order.addressLine2}` : ''}, {order.city},{' '}
                          {order.state} {order.postalCode} · +91 {order.phone}
                        </p>
                      )}
                      <p className="order-updated">
                        Last updated {indiaDateTime.format(new Date(order.updated_at))}
                      </p>
                    </article>
                  ))}
                </div>
              )}

              <section className="account-service-grid">
                <div className="account-service-panel">
                  <div className="panel-header">
                    <div>
                      <p className="eyebrow">We're here to help</p>
                      <h2>Contact customer care</h2>
                    </div>
                  </div>
                  <p className="support-response-note">
                    Send a private message to the store team. Replies and updates stay in your account.
                  </p>
                  <form className="account-form support-form" onSubmit={handleCreateSupportTicket}>
                    <label>
                      Topic
                      <select
                        value={supportForm.category}
                        onChange={(event) => setSupportForm((previous) => ({ ...previous, category: event.target.value }))}
                      >
                        <option value="order">Order help</option>
                        <option value="delivery">Delivery</option>
                        <option value="payment">Payment</option>
                        <option value="product">Product question</option>
                        <option value="return">Return or exchange</option>
                        <option value="other">Something else</option>
                      </select>
                    </label>
                    <label>
                      Related order (optional)
                      <select
                        value={supportForm.orderId}
                        onChange={(event) => setSupportForm((previous) => ({ ...previous, orderId: event.target.value }))}
                      >
                        <option value="">No specific order</option>
                        {customerOrders.map((order) => (
                          <option value={order.id} key={order.id}>{order.orderNumber}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Subject
                      <input
                        required
                        maxLength="120"
                        value={supportForm.subject}
                        onChange={(event) => setSupportForm((previous) => ({ ...previous, subject: event.target.value }))}
                        placeholder="A short summary"
                      />
                    </label>
                    <label>
                      How can we help?
                      <textarea
                        required
                        minLength="5"
                        maxLength="3000"
                        rows="4"
                        value={supportForm.message}
                        onChange={(event) => setSupportForm((previous) => ({ ...previous, message: event.target.value }))}
                        placeholder="Share the details so our team can help."
                      />
                    </label>
                    {supportError && <p className="account-error" role="alert">{supportError}</p>}
                    {supportNotice && <p className="account-notice" role="status">{supportNotice}</p>}
                    <button className="primary-button" type="submit">Send to customer care</button>
                  </form>
                </div>

                <div className="account-service-panel">
                  <div className="panel-header">
                    <div>
                      <p className="eyebrow">Your conversations</p>
                      <h2>Support requests</h2>
                    </div>
                    <span className="account-order-count">{supportTickets.length} tickets</span>
                  </div>
                  {supportTickets.length === 0 ? (
                    <p className="support-response-note">No support requests yet. We're glad things are going smoothly.</p>
                  ) : (
                    <div className="support-ticket-list">
                      {supportTickets.map((ticket) => (
                        <article className="support-ticket-card" key={ticket.id}>
                          <div className="support-ticket-heading">
                            <div>
                              <span>{ticket.category} · {ticket.orderId ? 'order linked' : 'general'}</span>
                              <h3>{ticket.subject}</h3>
                            </div>
                            <span className={`ticket-status ticket-${ticket.status}`}>{ticket.status.replaceAll('_', ' ')}</span>
                          </div>
                          <div className="support-message-list">
                            {ticket.messages.map((message) => (
                              <div className={`support-message ${message.authorRole}`} key={message.id}>
                                <strong>{message.authorRole === 'owner' ? 'SSTE customer care' : 'You'}</strong>
                                <p>{message.message}</p>
                                <time>{indiaDateTime.format(new Date(message.createdAt))}</time>
                              </div>
                            ))}
                          </div>
                          <form className="support-reply-form" onSubmit={(event) => handleCustomerSupportReply(event, ticket.id)}>
                            <label>
                              Reply
                              <textarea
                                required
                                maxLength="3000"
                                rows="2"
                                value={supportReply[ticket.id] || ''}
                                onChange={(event) => setSupportReply((previous) => ({ ...previous, [ticket.id]: event.target.value }))}
                                placeholder="Add a message to this conversation"
                              />
                            </label>
                            <button className="secondary-button" type="submit">Reply</button>
                          </form>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="account-service-panel order-feedback-panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Help us improve</p>
                    <h2>Order feedback</h2>
                  </div>
                </div>
                <p className="support-response-note">Share a rating after a paid order. Your comments are private to you and the store team.</p>
                <div className="order-feedback-list">
                  {accountFeedback.filter((item) => !item.rating).length === 0 ? (
                    <p className="support-response-note">No paid orders are waiting for feedback.</p>
                  ) : accountFeedback.filter((item) => !item.rating).map((item) => {
                    const draft = feedbackDrafts[item.orderId] || { rating: 5, message: '' };
                    return (
                      <form className="order-feedback-card" key={item.orderId} onSubmit={(event) => submitOrderFeedback(event, item.orderId)}>
                        <div>
                          <strong>{item.orderNumber}</strong>
                          <span>{indiaDate.format(new Date(item.orderDate))}</span>
                        </div>
                        <label>
                          Your rating
                          <select
                            value={draft.rating}
                            onChange={(event) => setFeedbackDrafts((previous) => ({
                              ...previous,
                              [item.orderId]: { ...draft, rating: Number(event.target.value) },
                            }))}
                          >
                            {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} out of 5 stars</option>)}
                          </select>
                        </label>
                        <label>
                          Comment (optional)
                          <textarea
                            maxLength="2000"
                            rows="2"
                            value={draft.message}
                            onChange={(event) => setFeedbackDrafts((previous) => ({
                              ...previous,
                              [item.orderId]: { ...draft, message: event.target.value },
                            }))}
                            placeholder="What went well, or what could be better?"
                          />
                        </label>
                        <button className="secondary-button" type="submit">Send feedback</button>
                      </form>
                    );
                  })}
                  {accountFeedback.filter((item) => item.rating).map((item) => (
                    <article className="order-feedback-card submitted" key={item.orderId}>
                      <div>
                        <strong>{item.orderNumber}</strong>
                        <span>{item.rating} / 5 stars · {item.status === 'approved' ? 'published' : 'received for review'}</span>
                      </div>
                      {item.message && <p>{item.message}</p>}
                    </article>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <section className="account-auth-layout">
              <div className="account-auth-intro">
                <p className="eyebrow">SSTE Studio</p>
                <h1>{customerMode === 'register' ? 'Create your account.' : 'Welcome back.'}</h1>
                <p>Keep your order history and follow fulfillment updates in one place.</p>
              </div>

              <div className="account-auth-panel">
                {customerMode === 'recovery' ? (
                  <AccountRecoveryPanel
                    initialAccountType={new URLSearchParams(window.location.search).get('recover') || 'customer'}
                    allowAccountTypeSelection
                    onBack={() => { setCustomerMode('login'); setCustomerError(''); }}
                  />
                ) : (
                  <>
                    <div className="account-mode-switch" role="group" aria-label="Account access mode">
                      <button
                        type="button"
                        className={customerMode === 'login' ? 'active' : ''}
                        onClick={() => { setCustomerMode('login'); setCustomerError(''); }}
                      >
                        Sign in
                      </button>
                      <button
                        type="button"
                        className={customerMode === 'register' ? 'active' : ''}
                        onClick={() => { setCustomerMode('register'); setCustomerError(''); }}
                      >
                        Create account
                      </button>
                    </div>

                    <form className="account-form" onSubmit={handleCustomerAuth}>
                      <label>
                        Email
                        <input
                          type="email"
                          autoComplete="email"
                          required
                          maxLength="254"
                          value={customerCredentials.email}
                          onChange={(event) => setCustomerCredentials((previous) => ({ ...previous, email: event.target.value }))}
                          placeholder="you@example.com"
                        />
                      </label>
                      <label>
                        Password
                        <input
                          type="password"
                          autoComplete={customerMode === 'register' ? 'new-password' : 'current-password'}
                          required
                          minLength="12"
                          maxLength="256"
                          value={customerCredentials.password}
                          onChange={(event) => setCustomerCredentials((previous) => ({ ...previous, password: event.target.value }))}
                          placeholder="At least 12 characters"
                        />
                      </label>
                      {customerError && <p className="account-error" role="alert">{customerError}</p>}
                      {customerNotice && <p className="account-notice" role="status">{customerNotice}</p>}
                      <button className="primary-button" type="submit">
                        {customerMode === 'register' ? 'Create account' : 'Sign in'}
                      </button>
                      {customerMode === 'login' && <button className="text-button account-forgot-link" type="button" onClick={() => setCustomerMode('recovery')}>Forgot email or password?</button>}
                    </form>
                  </>
                )}
              </div>
            </section>
          )}
        </main>
      </>
    );
  }

  return (
    <>
      <header className="topbar">
        <a className="brand-block" href="/">
          <span className="brand-mark">S</span>
          <div>
            <p className="brand-name">SSTE Studio</p>
            <span className="brand-tag">India · Prices in INR</span>
          </div>
        </a>

        <form
          className="header-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            handleSearchAction();
          }}
        >
          <input
            type="search"
            aria-label="Search all products"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search furniture, lighting and more"
          />
          <button type="submit" aria-label="Search products">⌕</button>
        </form>

        <nav className="main-nav" aria-label="Shop by category">
          {['All', ...categories.slice(1)].map((category) => (
            <button
              key={category}
              type="button"
              aria-pressed={activeCategory === category}
              onClick={() => {
                setActiveCategory(category);
                catalogSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              {category === 'All' ? 'Shop all' : category}
            </button>
          ))}
        </nav>

        <div className="header-actions">
          <a className="ghost-button" href="/account">
            {customer ? 'Your account' : 'Sign in'}
          </a>
          <button
            className="cart-toggle"
            aria-expanded={cartOpen}
            onClick={() => setCartOpen((open) => !open)}
          >
            Bag {totalItems > 0 ? `(${totalItems})` : ''}
          </button>
        </div>
      </header>

      <main className="page-shell">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Spring collection 2026</p>
            <h1>Bring a softer rhythm to your home.</h1>
            <p className="lede">
              Thoughtful essentials for slower mornings, deeper focus, and more beautiful everyday rituals.
            </p>
            <div className="hero-actions">
              <button className="primary-button" onClick={() => handleCollectionExplore(selectedRoom)}>
                Shop the collection
              </button>
              <button
                className="secondary-button"
                onClick={() => catalogSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
              >
                Browse all
              </button>
            </div>
            <div className="room-pills" aria-label="Choose a room">
              {collections.map((collection) => (
                <button
                  key={collection.title}
                  className={selectedRoom === collection.title ? 'room-pill active' : 'room-pill'}
                  onClick={() => setSelectedRoom(collection.title)}
                >
                  {collection.title}
                </button>
              ))}
            </div>
            <div className="hero-metrics">
              <div><strong>48h</strong><span>dispatch</span></div>
              <div><strong>30 days</strong><span>easy returns</span></div>
              <div><strong>Thoughtful</strong><span>by design</span></div>
            </div>
          </div>
          <div className="hero-visual">
            <img src={activeCollection.image} alt={`${activeCollection.title} collection`} />
            <div className="floating-card">
              <p>Featured collection</p>
              <strong>{activeCollection.title}</strong>
              <span>{activeCollection.mood}</span>
            </div>
          </div>
        </section>

        <section className="feature-strip" aria-label="Store promises">
          <div>
            <strong>Fast dispatch</strong>
            <span>Orders ship within 48 hours</span>
          </div>
          <div>
            <strong>Free returns</strong>
            <span>30-day easy exchanges</span>
          </div>
          <div>
            <strong>Curated quality</strong>
            <span>Thoughtfully designed for daily life</span>
          </div>
        </section>

        <section className="collection-grid" aria-label="Featured collections">
          {collections.map((collection) => (
            <article
              key={collection.title}
              className={selectedRoom === collection.title ? 'collection-card active' : 'collection-card'}
              onClick={() => setSelectedRoom(collection.title)}
            >
              <p className="collection-kicker">{collection.accent}</p>
              <h3>{collection.title}</h3>
              <p>{collection.summary}</p>
              <button className="text-button" onClick={() => handleCollectionExplore(collection.title)}>
                Explore
              </button>
            </article>
          ))}
        </section>

        <section className="catalog" ref={catalogSectionRef}>
          <div className="catalog-header">
            <div>
              <p className="eyebrow">Curated picks</p>
              <h2>Shop the essentials</h2>
            </div>

            <div className="catalog-tools">
              <label className="search-box" aria-label="Search products">
                <span>⌕</span>
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search products"
                />
              </label>

              <label className="sort-box">
                <span>Sort</span>
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                  <option value="featured">Featured</option>
                  <option value="low-to-high">Price: Low to high</option>
                  <option value="high-to-low">Price: High to low</option>
                  <option value="rating">Top rated</option>
                </select>
              </label>
            </div>
          </div>

          <div className="filter-row" aria-label="Filter by category">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                aria-pressed={category === activeCategory}
                className={category === activeCategory ? 'chip active' : 'chip'}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="product-grid">
            {filteredProducts.length === 0 ? (
              <div className="empty-catalog-state">
                <p>
                  {productsLoading
                    ? 'Loading products…'
                    : productsError
                      ? 'Products are temporarily unavailable. Please try again shortly.'
                      : 'No products match this search yet.'}
                </p>
              </div>
            ) : (
              filteredProducts.map((product) => (
                <article key={product.id} className="product-card">
                  <div className="product-image-wrap">
                    <img src={product.image} alt={product.name} />
                    <span className="product-badge">{product.tag}</span>
                  </div>

                  <div className="product-body">
                    <div className="product-meta">
                      <span>{product.category}</span>
                      <span>★ {product.rating}</span>
                    </div>
                    <h3>{product.name}</h3>
                    <p>{product.accent}</p>
                    <p className="product-tax-note">
                      {product.gstRate === null || product.gstRate === undefined
                        ? 'Tax information unavailable'
                        : `${product.gstRate}% GST added at checkout`}
                    </p>
                    <p className={`product-availability ${product.inStock === false ? 'out-of-stock' : ''}`}>
                      {product.inStock === false ? 'Out of stock' : 'In stock'}
                    </p>
                    <div className="price-row">
                      <strong>{money.format(product.price)}</strong>
                      <div className="card-actions">
                        <button className="secondary-ghost" onClick={() => openQuickView(product)}>
                          Quick view
                        </button>
                        <button
                          disabled={product.inStock === false}
                          onClick={() => addToCart(product)}
                        >
                          {product.inStock === false ? 'Out of stock' : 'Add to cart'}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="testimonial-section">
          <div className="section-heading">
            <p className="eyebrow">Loved by our community</p>
            <h2>What customers say</h2>
          </div>

          <div className="testimonial-grid">
            {testimonials.map((testimonial) => (
              <article key={testimonial.name} className="testimonial-card">
                <div className="stars">★★★★★</div>
                <p>“{testimonial.quote}”</p>
                <strong>{testimonial.name}</strong>
              </article>
            ))}
          </div>
        </section>
      </main>

      {cartOpen && (
        <button
          className="cart-backdrop"
          type="button"
          aria-label="Close shopping cart"
          onClick={() => setCartOpen(false)}
        />
      )}
      <aside
        className={cartOpen ? 'cart-panel open' : 'cart-panel'}
        role="dialog"
        aria-label="Shopping cart"
        aria-modal={cartOpen}
        aria-hidden={!cartOpen}
        inert={!cartOpen}
      >
        <div className="cart-header">
          <div>
            <p className="eyebrow">Your bag</p>
            <h3>{totalItems} {totalItems === 1 ? 'item' : 'items'}</h3>
          </div>
          <button className="close-cart" onClick={() => setCartOpen(false)}>
            Close
          </button>
        </div>

        {cartItems.length === 0 ? (
          <div className="empty-cart">
            <p>Your cart is empty.</p>
            <button onClick={() => setCartOpen(false)}>Keep shopping</button>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {cartItems.map((item) => (
                <div key={item.id} className="cart-item">
                  <img src={item.image} alt={item.name} />
                  <div className="cart-item-body">
                    <div className="cart-item-copy">
                      <h4>{item.name}</h4>
                      <p>{money.format(item.price)}</p>
                      <p className={`product-availability ${item.inStock === false ? 'out-of-stock' : ''}`}>
                        {item.inStock === false ? 'Out of stock' : 'In stock'}
                      </p>
                    </div>
                    <div className="cart-controls">
                      <button onClick={() => updateQuantity(item.id, -1)}>-</button>
                      <span>{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        aria-label={`Increase ${item.name} quantity`}
                        disabled={item.quantity >= 99 || item.inStock === false}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="cart-summary">
              <div>
                <span>Items subtotal</span>
                <strong>{money.format(subtotal)}</strong>
              </div>
              <div>
                <span>Shipping</span>
                <strong>Free</strong>
              </div>
              <div>
                <span>Estimated GST</span>
                <strong>
                  {unconfiguredTaxCartItems.length > 0 ? 'Tax setup required' : money.format(estimatedTax)}
                </strong>
              </div>
              <div className="cart-total-row">
                <span>Total incl. GST</span>
                <strong>{money.format(checkoutTotal)}</strong>
              </div>
              {taxCheckoutBlocked && (
                <p className="payment-notice" role="status">
                  {taxOptions.message || 'Checkout is paused until the store tax profile and product tax rates are configured.'}
                </p>
              )}
              {checkoutOpen ? (
                checkoutStep === 'address' ? (
                <form className="delivery-form" onSubmit={continueToPayment}>
                  <h4>Delivery address</h4>
                  <p>India · PIN code delivery</p>
                  {unavailableCartItems.length > 0 && (
                    <p className="account-error" role="alert">
                      Remove out-of-stock items before continuing to checkout.
                    </p>
                  )}
                  <label>
                    Full name
                    <input
                      autoComplete="name"
                      required
                      maxLength="120"
                      value={shippingAddress.recipientName}
                      onChange={(event) => setShippingAddress((previous) => ({ ...previous, recipientName: event.target.value }))}
                    />
                  </label>
                  <label>
                    Mobile number
                    <span className="phone-input">
                      <span aria-hidden="true">+91</span>
                      <input
                        type="tel"
                        autoComplete="tel-national"
                        inputMode="numeric"
                        pattern="[6-9][0-9]{9}"
                        title="Enter a 10-digit Indian mobile number starting with 6, 7, 8, or 9."
                        required
                        minLength="10"
                        maxLength="16"
                        value={shippingAddress.phone}
                        onChange={(event) => setShippingAddress((previous) => ({ ...previous, phone: normalizeIndianMobile(event.target.value) }))}
                      />
                    </span>
                  </label>
                  <label>
                    Flat, house no., building, street
                    <input
                      autoComplete="address-line1"
                      required
                      maxLength="160"
                      value={shippingAddress.addressLine1}
                      onChange={(event) => setShippingAddress((previous) => ({ ...previous, addressLine1: event.target.value }))}
                    />
                  </label>
                  <label>
                    Area, landmark (optional)
                    <input
                      autoComplete="address-line2"
                      maxLength="120"
                      value={shippingAddress.addressLine2}
                      onChange={(event) => setShippingAddress((previous) => ({ ...previous, addressLine2: event.target.value }))}
                    />
                  </label>
                  <div className="delivery-form-row">
                    <label>
                      Town / city
                      <input
                        autoComplete="address-level2"
                        required
                        maxLength="80"
                        value={shippingAddress.city}
                        onChange={(event) => setShippingAddress((previous) => ({ ...previous, city: event.target.value }))}
                      />
                    </label>
                    <label>
                      State / UT
                      <select
                        autoComplete="address-level1"
                        required
                        value={shippingAddress.state}
                        onChange={(event) => setShippingAddress((previous) => ({ ...previous, state: event.target.value }))}
                      >
                        <option value="">Select</option>
                        {indianStates.map((state) => <option key={state} value={state}>{state}</option>)}
                      </select>
                    </label>
                  </div>
                  <label>
                    PIN code
                    <input
                      autoComplete="postal-code"
                      inputMode="numeric"
                      pattern="[1-9][0-9]{5}"
                      title="Enter a valid 6-digit Indian PIN code."
                      required
                      minLength="6"
                      maxLength="6"
                      value={shippingAddress.postalCode}
                      onChange={(event) => setShippingAddress((previous) => ({ ...previous, postalCode: event.target.value.replace(/\D/g, '').slice(0, 6) }))}
                    />
                  </label>
                  {checkoutMessage && <p className="account-error" role="alert">{checkoutMessage}</p>}
                <button className="checkout-button" type="submit" disabled={unavailableCartItems.length > 0 || taxCheckoutBlocked}>
                  Continue to payment
                </button>
                <button className="delivery-back-button" type="button" onClick={() => { setCheckoutOpen(false); setCheckoutStep('address'); setCheckoutMessage(''); }}>
                  Back to bag
                </button>
              </form>
              ) : (
                <section className="delivery-form demo-payment-panel" aria-labelledby="demo-payment-title">
                  <h4 id="demo-payment-title">Final step: payment</h4>
                  <p>Amount due: <strong>{money.format(checkoutTotal)}</strong> including the estimated GST shown above.</p>
                  {paymentOptions.razorpayEnabled && (
                    <div className="razorpay-payment-option">
                      <p>
                        {paymentOptions.razorpayMode === 'live'
                          ? 'Choose how you would like to pay. Razorpay securely handles payment details.'
                          : 'Razorpay test keys are connected. Test payments do not move real money.'}
                      </p>
                      <div className="payment-method-grid" role="group" aria-label="Preferred payment method">
                        {razorpayPaymentMethods.map((method) => (
                          <button
                            key={method.id}
                            type="button"
                            className={selectedPaymentMethod === method.id ? 'payment-method-option selected' : 'payment-method-option'}
                            aria-pressed={selectedPaymentMethod === method.id}
                            disabled={checkoutSubmitting}
                            onClick={() => setSelectedPaymentMethod(method.id)}
                          >
                            <strong>{method.label}</strong>
                            <span>{method.detail}</span>
                          </button>
                        ))}
                      </div>
                      <button
                        className="checkout-button"
                        type="button"
                        disabled={checkoutSubmitting || unavailableCartItems.length > 0 || taxCheckoutBlocked}
                        onClick={startRazorpayPayment}
                      >
                        {checkoutSubmitting
                          ? 'Opening secure checkout…'
                          : paymentOptions.razorpayMode === 'live'
                            ? 'Continue securely with Razorpay'
                            : 'Open Razorpay test checkout'}
                      </button>
                    </div>
                  )}
                  {paymentOptions.demoEnabled && (
                    <>
                      <div className="payment-notice" role="note">
                        Local test simulation only. It does not open a UPI app, contact a bank, use a UPI ID, or move money.
                      </div>
                      <button
                        className="checkout-button"
                        type="button"
                        disabled={checkoutSubmitting || unavailableCartItems.length > 0 || taxCheckoutBlocked}
                        onClick={() => placeDemoUpiOrder(true)}
                      >
                        {checkoutSubmitting ? 'Recording test result…' : 'Simulate successful UPI payment'}
                      </button>
                      <button
                        className="payment-failure-button"
                        type="button"
                        disabled={checkoutSubmitting || unavailableCartItems.length > 0 || taxCheckoutBlocked}
                        onClick={() => placeDemoUpiOrder(false)}
                      >
                        Simulate failed payment
                      </button>
                    </>
                  )}
                  {checkoutMessage && <p className="account-error" role="alert">{checkoutMessage}</p>}
                  {!paymentOptions.razorpayEnabled && !paymentOptions.demoEnabled && (
                    <p className="account-error" role="alert">
                      No payment method is configured. Contact the store owner.
                    </p>
                  )}
                  <button
                    className="delivery-back-button"
                    type="button"
                    disabled={checkoutSubmitting}
                    onClick={() => { setCheckoutStep('address'); setCheckoutMessage(''); }}
                  >
                    Back to delivery address
                  </button>
                </section>
                )
              ) : (
                <button
                  className="checkout-button"
                  disabled={unavailableCartItems.length > 0 || taxCheckoutBlocked}
                  onClick={() => {
                    setCheckoutMessage('');
                    if (customer) {
                      setCheckoutStep('address');
                      setCheckoutOpen(true);
                    }
                    else setCheckoutMessage('Sign in or create an account before checkout.');
                  }}
                >
                  Checkout
                </button>
              )}
            </div>
          </>
        )}
      </aside>

      {checkoutMessage && (
        <div className="checkout-toast" role="status" aria-live="polite">
          {checkoutMessage}
          {!customer && cartItems.length > 0 && <a href="/account">Go to account</a>}
        </div>
      )}

      {selectedProduct && (
        <div className="modal-backdrop" onClick={closeQuickView}>
          <div
            className="product-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-view-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="modal-close" onClick={closeQuickView}>×</button>
            <div className="modal-image-wrap">
              <img src={selectedProduct.image} alt={selectedProduct.name} />
            </div>

            <div className="modal-content">
              <p className="eyebrow">{selectedProduct.category}</p>
              <h3 id="quick-view-title">{selectedProduct.name}</h3>
              <div className="modal-price-row">
                <strong>{money.format(selectedProduct.price)}</strong>
                <span>★ {selectedProduct.rating}</span>
              </div>
              <p className={`product-availability ${selectedProduct.inStock === false ? 'out-of-stock' : ''}`}>
                {selectedProduct.inStock === false ? 'Out of stock' : 'In stock'}
              </p>
              <p className="modal-description">{selectedProduct.description}</p>
              <p className="modal-story">{selectedProduct.story}</p>

              <div className="color-picker">
                {selectedProduct.colors.map((color) => (
                  <button key={color} className="color-swatch" type="button">
                    {color}
                  </button>
                ))}
              </div>

              <button
                className="primary-button modal-button"
                disabled={selectedProduct.inStock === false}
                onClick={() => {
                  addToCart(selectedProduct);
                  closeQuickView();
                }}
              >
                {selectedProduct.inStock === false ? 'Out of stock' : 'Add to cart'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
