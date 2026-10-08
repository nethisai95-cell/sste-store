import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseQrPayload, unitShortCode } from './qr-scan.js';
import { amountInWords } from './invoice.js';

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
const dateTime = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Kolkata',
});
const paymentLabels = { cash: 'Cash', upi: 'UPI', card: 'Card' };

function gstPaise(taxablePaise, rate) {
  return Math.round((taxablePaise * Math.round(Number(rate || 0) * 100)) / 10000);
}

function PosLogin({ apiRequest, onSignedIn, notice }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const body = JSON.stringify({ email: form.email, password: form.password });
    try {
      try {
        await apiRequest('/api/employee/login', { method: 'POST', body });
      } catch {
        await apiRequest('/api/admin/login', { method: 'POST', body });
      }
      const session = await apiRequest('/api/pos/session');
      if (!session.authenticated) {
        setError('This account does not have access to the till. Ask the owner for a cashier or manager login.');
      } else {
        onSignedIn(session);
      }
    } catch (requestError) {
      setError(requestError.message === 'Incorrect email or password.' ? 'Email or password is incorrect.' : requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="admin-shell pos-login">
      <form className="admin-login-card" onSubmit={submit}>
        <p className="eyebrow">SSTE Studio · In-store</p>
        <h1>Point of sale</h1>
        <label>Email
          <input type="email" required autoComplete="username" value={form.email}
            onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))} />
        </label>
        <label>Password
          <input type="password" required autoComplete="current-password" value={form.password}
            onChange={(event) => setForm((previous) => ({ ...previous, password: event.target.value }))} />
        </label>
        {notice && !error && <p className="admin-login-error" role="alert">{notice}</p>}
        {error && <p className="admin-login-error" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Open till'}</button>
        <a className="ghost-button" href="/">Back to storefront</a>
      </form>
    </main>
  );
}

function Receipt({ sale, onClose }) {
  return (
    <div className="qr-scanner-backdrop" role="dialog" aria-modal="true" aria-label="Receipt">
      <div className="qr-scanner-card pos-receipt-card">
        <div className="pos-receipt">
          <h2>{sale.sellerLegalName || 'SSTE Studio'}</h2>
          {sale.sellerAddress && <p className="pos-center">{sale.sellerAddress}{sale.sellerState ? `, ${sale.sellerState}` : ''}</p>}
          {sale.sellerGstin && <p className="pos-center">GSTIN: {sale.sellerGstin}</p>}
          <p className="pos-doc-title">{sale.sellerGstin && sale.taxTotal > 0 ? 'TAX INVOICE' : sale.sellerGstin ? 'INVOICE' : 'BILL OF SUPPLY'}</p>
          {sale.status === 'voided' && <p className="pos-void-banner">VOIDED{sale.voidReason ? ` · ${sale.voidReason}` : ''}</p>}
          <div className="pos-receipt-meta">
            <span>Receipt no</span><strong>{sale.receiptNumber}</strong>
            <span>Date</span><span>{dateTime.format(new Date(sale.createdAt))}</span>
            <span>Cashier</span><span>{sale.cashierName}</span>
            {sale.customerName && <><span>Customer</span><span>{sale.customerName}{sale.customerPhone ? ` · ${sale.customerPhone}` : ''}</span></>}
          </div>
          <table>
            <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Rate</th><th className="num">Amount</th></tr></thead>
            <tbody>
              {sale.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.productName}<small>{item.gstRate}% GST{item.hsnCode ? ` · HSN ${item.hsnCode}` : ''}</small></td>
                  <td className="num">{item.quantity}</td>
                  <td className="num">{money.format(item.unitPrice)}</td>
                  <td className="num">{money.format(item.unitPrice * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="pos-center pos-muted">{sale.items.length} item{sale.items.length === 1 ? '' : 's'} · {sale.items.reduce((sum, item) => sum + item.quantity, 0)} qty</p>
          <dl>
            <div><dt>Subtotal</dt><dd>{money.format(sale.taxableSubtotal)}</dd></div>
            {sale.taxTotal > 0 ? (
              <>
                <div><dt>CGST</dt><dd>{money.format(Math.floor(sale.taxTotal * 100 / 2) / 100)}</dd></div>
                <div><dt>SGST</dt><dd>{money.format(sale.taxTotal - Math.floor(sale.taxTotal * 100 / 2) / 100)}</dd></div>
              </>
            ) : (
              <div><dt>GST</dt><dd>{money.format(sale.taxTotal)}</dd></div>
            )}
            <div className="pos-receipt-total"><dt>Total</dt><dd>{money.format(sale.total)}</dd></div>
            <div><dt>Paid by</dt><dd>{paymentLabels[sale.paymentMethod]}{sale.paymentReference ? ` · ${sale.paymentReference}` : ''}</dd></div>
            {sale.amountTendered !== null && (
              <>
                <div><dt>Cash received</dt><dd>{money.format(sale.amountTendered)}</dd></div>
                <div><dt>Change</dt><dd>{money.format(sale.changeDue)}</dd></div>
              </>
            )}
          </dl>
          <p className="pos-center pos-muted">Amount in words: {amountInWords(sale.total)}</p>
          <p className="pos-center pos-thanks">Thank you for shopping with us!<br />Please keep this receipt as proof of purchase.</p>
          <p className="pos-center pos-muted">Computer-generated receipt. No signature required.</p>
        </div>
        <div className="pos-receipt-actions">
          <button className="secondary-button" type="button" onClick={() => window.print()}>Print receipt</button>
          <button className="primary-button" type="button" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

export default function PosApp({ apiRequest: rawApiRequest, QrScannerDialog }) {
  const [session, setSession] = useState(null);
  const [sessionNotice, setSessionNotice] = useState('');
  const apiRequest = useCallback(async (...args) => {
    try {
      return await rawApiRequest(...args);
    } catch (requestError) {
      if (/sign-in required|sign in/i.test(requestError.message || '')) {
        setSession(null);
        setSessionNotice('Your session ended. Please sign in again to continue.');
      }
      throw requestError;
    }
  }, [rawApiRequest]);
  const [checking, setChecking] = useState(true);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [cart, setCart] = useState([]);
  const [payment, setPayment] = useState({ method: 'cash', tendered: '', reference: '', customerName: '', customerPhone: '' });
  const [scannerOpen, setScannerOpen] = useState(false);
  const [wandCode, setWandCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [view, setView] = useState('sell');
  const [history, setHistory] = useState({ sales: [], today: null });
  const productsRef = useRef([]);
  const cartRef = useRef([]);
  productsRef.current = products;
  cartRef.current = cart;

  const loadProducts = useCallback(async () => {
    setProducts(await apiRequest('/api/pos/products'));
  }, [apiRequest]);

  const loadHistory = useCallback(async () => {
    setHistory(await apiRequest('/api/pos/sales'));
  }, [apiRequest]);

  useEffect(() => {
    apiRequest('/api/pos/session')
      .then((result) => setSession(result.authenticated ? result : null))
      .catch(() => setSession(null))
      .finally(() => setChecking(false));
  }, [apiRequest]);

  useEffect(() => {
    if (!session) return;
    loadProducts().catch((requestError) => setError(requestError.message));
    loadHistory().catch(() => {});
  }, [session, loadProducts, loadHistory]);

  const categories = useMemo(() => ['All', ...new Set(products.map((product) => product.category))], [products]);
  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => (category === 'All' || product.category === category)
      && (!term || product.name.toLowerCase().includes(term)));
  }, [products, search, category]);

  const lines = cart.map((line) => {
    const product = products.find((item) => item.id === line.productId);
    const subtotal = Math.round((product?.price || 0) * 100) * line.quantity;
    return { ...line, product, subtotal, tax: gstPaise(subtotal, product?.gstRate) };
  });
  const taxableTotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
  const taxTotal = lines.reduce((sum, line) => sum + line.tax, 0);
  const totalPaise = taxableTotal + taxTotal;
  const tenderedPaise = Math.round(Number(payment.tendered || 0) * 100);
  const changePaise = tenderedPaise - totalPaise;
  const cashShort = payment.method === 'cash' && payment.tendered !== '' && changePaise < 0;

  const addProduct = (product, unitId) => {
    setError('');
    setNotice('');
    const current = cartRef.current;
    const existing = current.find((line) => line.productId === product.id);
    const nextQuantity = (existing?.quantity || 0) + 1;
    if (product.tracked && nextQuantity > product.available) {
      setError(`${product.name} has only ${product.available} in stock.`);
      return false;
    }
    if (nextQuantity > 99) return false;
    setCart(existing
      ? current.map((line) => (line.productId === product.id
        ? { ...line, quantity: nextQuantity, unitIds: unitId ? [...line.unitIds, unitId] : line.unitIds }
        : line))
      : [...current, { productId: product.id, quantity: 1, unitIds: unitId ? [unitId] : [] }]);
    return true;
  };

  const changeQuantity = (productId, delta) => {
    setCart((current) => current.flatMap((line) => {
      if (line.productId !== productId) return [line];
      const quantity = line.quantity + delta;
      const product = productsRef.current.find((item) => item.id === productId);
      if (quantity < 1) return [];
      if (quantity > 99 || (product?.tracked && quantity > product.available)) return [line];
      return [{ ...line, quantity, unitIds: line.unitIds.slice(0, quantity) }];
    }));
  };

  const handleScan = async (text) => {
    const parsed = parseQrPayload(text);
    if (!parsed || !['unit', 'short'].includes(parsed.type)) return '✗ Not an item label.';
    const code = parsed.id;
    try {
      const unit = await apiRequest(`/api/pos/units/${encodeURIComponent(code)}`);
      if (unit.status !== 'available') return `✗ ${unit.productName} (${unitShortCode(unit.id)}) is ${unit.status}, not on the shelf.`;
      if (cartRef.current.some((line) => line.unitIds.includes(unit.id))) return `Already in the cart · ${unitShortCode(unit.id)}`;
      const product = productsRef.current.find((item) => item.id === unit.productId);
      if (!product) return '✗ This product is not for sale.';
      return addProduct(product, unit.id) ? `✓ Added ${product.name} · ${unitShortCode(unit.id)}` : '✗ Could not add this item.';
    } catch (requestError) {
      return `✗ ${requestError.message}`;
    }
  };

  const submitWand = async (event) => {
    event.preventDefault();
    const value = wandCode;
    setWandCode('');
    if (!value.trim()) return;
    const message = await handleScan(value);
    if (message.startsWith('✗')) setError(message.slice(2));
    else setNotice(message);
  };

  const completeSale = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const sale = await apiRequest('/api/pos/sales', {
        method: 'POST',
        body: JSON.stringify({
          items: cart,
          paymentMethod: payment.method,
          amountTendered: payment.method === 'cash' ? payment.tendered : undefined,
          paymentReference: payment.reference,
          customerName: payment.customerName,
          customerPhone: payment.customerPhone,
        }),
      });
      setReceipt(sale);
      setCart([]);
      setPayment({ method: 'cash', tendered: '', reference: '', customerName: '', customerPhone: '' });
      await Promise.all([loadProducts(), loadHistory()]);
    } catch (requestError) {
      setError(requestError.message);
      loadProducts().catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  const openReceipt = async (saleId) => {
    try {
      setReceipt(await apiRequest(`/api/pos/sales/${encodeURIComponent(saleId)}`));
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const voidSale = async (sale) => {
    const reason = window.prompt(`Why is ${sale.receiptNumber} being voided? Items go back into stock.`);
    if (!reason?.trim()) return;
    try {
      await apiRequest(`/api/pos/sales/${encodeURIComponent(sale.id)}/void`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      setNotice(`${sale.receiptNumber} was voided and its items returned to stock.`);
      await Promise.all([loadProducts(), loadHistory()]);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const signOut = async () => {
    const path = session.role === 'owner' ? '/api/admin/logout' : '/api/employee/logout';
    await apiRequest(path, { method: 'POST' }).catch(() => {});
    setSession(null);
    setCart([]);
  };

  if (checking) return <main className="admin-shell"><p className="eyebrow">Opening till…</p></main>;
  if (!session) return <PosLogin apiRequest={rawApiRequest} notice={sessionNotice} onSignedIn={(next) => { setSessionNotice(''); setSession(next); }} />;

  const canVoid = session.role === 'owner' || session.role === 'manager';
  const payDisabled = busy || cart.length === 0 || cashShort
    || lines.some((line) => !line.product);

  return (
    <>
      <header className="topbar admin-topbar pos-topbar">
        <div className="brand-block">
          <span className="brand-mark">S</span>
          <div><p className="brand-name">SSTE Studio</p><span className="brand-tag">Point of sale · {session.name}</span></div>
        </div>
        <div className="header-actions">
          <button className={view === 'sell' ? 'primary-button' : 'ghost-button'} onClick={() => setView('sell')}>Sell</button>
          <button className={view === 'history' ? 'primary-button' : 'ghost-button'} onClick={() => { setView('history'); loadHistory().catch(() => {}); }}>Sales today</button>
          <button className="ghost-button" onClick={signOut}>Sign out</button>
        </div>
      </header>

      {receipt && <Receipt sale={receipt} onClose={() => setReceipt(null)} />}
      {scannerOpen && (
        <QrScannerDialog
          continuous
          title="Scan item labels"
          hint="Scan each item's QR label to add that exact unit to the sale."
          onScan={handleScan}
          onClose={() => setScannerOpen(false)}
        />
      )}

      <main className="pos-shell">
        {error && <p className="admin-login-error pos-banner" role="alert">{error}</p>}
        {notice && <p className="account-notice pos-banner" role="status">{notice}</p>}

        {view === 'history' ? (
          <section className="admin-panel pos-history">
            <h2>Today</h2>
            {history.today && (
              <div className="finance-kpi-grid">
                <article><span>Sales</span><strong>{history.today.salesCount}</strong></article>
                <article><span>Total</span><strong>{money.format(history.today.total)}</strong></article>
                <article><span>Cash</span><strong>{money.format(history.today.cash)}</strong></article>
                <article><span>UPI</span><strong>{money.format(history.today.upi)}</strong></article>
                <article><span>Card</span><strong>{money.format(history.today.card)}</strong></article>
                <article><span>GST collected</span><strong>{money.format(history.today.tax)}</strong></article>
              </div>
            )}
            <h3>Recent sales</h3>
            {history.sales.length === 0 ? <p className="admin-muted-copy">No in-store sales yet.</p> : (
              <ul className="pos-sale-list">
                {history.sales.map((sale) => (
                  <li key={sale.id} className={sale.status === 'voided' ? 'pos-voided' : ''}>
                    <div>
                      <strong>{sale.receiptNumber}</strong>
                      <span>{dateTime.format(new Date(sale.createdAt))} · {paymentLabels[sale.paymentMethod]} · {sale.cashierName}</span>
                      {sale.status === 'voided' && <span>Voided: {sale.voidReason}</span>}
                    </div>
                    <strong>{money.format(sale.total)}</strong>
                    <button className="secondary-button" type="button" onClick={() => openReceipt(sale.id)}>Receipt</button>
                    {canVoid && sale.status === 'completed' && (
                      <button className="ghost-button" type="button" onClick={() => voidSale(sale)}>Void</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : (
          <div className="pos-grid">
            <section className="pos-catalog">
              <div className="pos-toolbar">
                <input type="search" placeholder="Search products" aria-label="Search products" value={search} onChange={(event) => setSearch(event.target.value)} />
                <button className="primary-button" type="button" onClick={() => setScannerOpen(true)}>Scan item</button>
              </div>
              <form className="pos-wand" onSubmit={submitWand}>
                <input value={wandCode} onChange={(event) => setWandCode(event.target.value)} placeholder="Barcode scanner / label code (focus here and scan)" aria-label="Label code" />
                <button className="secondary-button" type="submit">Add</button>
              </form>
              <div className="pos-categories">
                {categories.map((name) => (
                  <button key={name} type="button" className={name === category ? 'primary-button' : 'ghost-button'} onClick={() => setCategory(name)}>{name}</button>
                ))}
              </div>
              <div className="pos-products">
                {visibleProducts.map((product) => {
                  const soldOut = product.tracked && product.available < 1;
                  return (
                    <button key={product.id} type="button" className="pos-product" disabled={soldOut} onClick={() => addProduct(product)}>
                      <img src={product.imageUrl} alt="" loading="lazy" />
                      <strong>{product.name}</strong>
                      <span>{money.format(product.price)}</span>
                      <small>{product.tracked ? (soldOut ? 'Out of stock' : `${product.available} in stock`) : 'Not stock-tracked'}</small>
                    </button>
                  );
                })}
                {visibleProducts.length === 0 && <p className="admin-muted-copy">No products match.</p>}
              </div>
            </section>

            <aside className="pos-cart admin-panel">
              <h2>Current sale</h2>
              {lines.length === 0 ? <p className="admin-muted-copy">Tap a product or scan an item label to start.</p> : (
                <ul className="pos-lines">
                  {lines.map((line) => (
                    <li key={line.productId}>
                      <div>
                        <strong>{line.product?.name || 'Unavailable product'}</strong>
                        <small>{money.format(line.product?.price || 0)} each{line.unitIds.length ? ` · ${line.unitIds.length} scanned` : ''}</small>
                      </div>
                      <div className="pos-qty">
                        <button type="button" aria-label="Remove one" onClick={() => changeQuantity(line.productId, -1)}>−</button>
                        <span>{line.quantity}</span>
                        <button type="button" aria-label="Add one" onClick={() => changeQuantity(line.productId, 1)}>+</button>
                      </div>
                      <strong>{money.format(line.subtotal / 100)}</strong>
                    </li>
                  ))}
                </ul>
              )}
              <dl className="pos-totals">
                <div><dt>Subtotal</dt><dd>{money.format(taxableTotal / 100)}</dd></div>
                <div><dt>GST (estimate)</dt><dd>{money.format(taxTotal / 100)}</dd></div>
                <div className="pos-grand"><dt>Total</dt><dd>{money.format(totalPaise / 100)}</dd></div>
              </dl>

              <div className="pos-methods" role="group" aria-label="Payment method">
                {Object.entries(paymentLabels).map(([method, label]) => (
                  <button key={method} type="button" className={payment.method === method ? 'primary-button' : 'secondary-button'} onClick={() => setPayment((previous) => ({ ...previous, method }))}>{label}</button>
                ))}
              </div>
              {payment.method === 'cash' ? (
                <label>Cash received
                  <input inputMode="decimal" value={payment.tendered} placeholder={(totalPaise / 100).toFixed(2)}
                    onChange={(event) => setPayment((previous) => ({ ...previous, tendered: event.target.value.replace(/[^\d.]/g, '') }))} />
                </label>
              ) : (
                <label>{payment.method === 'upi' ? 'UPI transaction ID' : 'Card approval code'}
                  <input maxLength="80" value={payment.reference}
                    onChange={(event) => setPayment((previous) => ({ ...previous, reference: event.target.value }))} />
                </label>
              )}
              {payment.method === 'cash' && payment.tendered !== '' && (
                <p className={cashShort ? 'admin-login-error' : 'pos-change'}>
                  {cashShort ? `Short by ${money.format(-changePaise / 100)}` : `Change due ${money.format(changePaise / 100)}`}
                </p>
              )}
              <details className="pos-customer">
                <summary>Customer details (optional)</summary>
                <label>Name<input maxLength="120" value={payment.customerName} onChange={(event) => setPayment((previous) => ({ ...previous, customerName: event.target.value }))} /></label>
                <label>Mobile<input inputMode="tel" maxLength="14" value={payment.customerPhone} onChange={(event) => setPayment((previous) => ({ ...previous, customerPhone: event.target.value }))} /></label>
              </details>
              <button className="primary-button pos-charge" type="button" disabled={payDisabled} onClick={completeSale}>
                {busy ? 'Recording…' : `Charge ${money.format(totalPaise / 100)}`}
              </button>
              {cart.length > 0 && <button className="ghost-button" type="button" onClick={() => setCart([])}>Clear sale</button>}
            </aside>
          </div>
        )}
      </main>
    </>
  );
}
