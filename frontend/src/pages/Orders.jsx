import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ordersApi, productsApi, customersApi, fmt } from '../lib/api';
import { Plus, Search, Trash2, X, AlertCircle, Check, ShoppingCart, UserPlus } from 'lucide-react';

// ─── Order List ───────────────────────────────────────────────────────────────
export default function Orders() {
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view') || 'list';

  return view === 'new' ? <NewOrder /> : <OrderList />;
}

function OrderList() {
  const navigate = useNavigate();
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter) params.payment_status = filter;
      const r = await ordersApi.list(params);
      setOrders(r.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const remove = async (id) => {
    if (!confirm('Hủy đơn hàng này?')) return;
    try { await ordersApi.delete(id); load(); }
    catch (e) { alert(e.message); }
  };

  const togglePaid = async (o) => {
    try {
      await ordersApi.updateStatus({ order_id: o.order_id, payment_status: o.payment_status === 'paid' ? 'unpaid' : 'paid' });
      load();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Đơn hàng</h1>
        <button className="btn-primary" onClick={() => navigate('?view=new')}>
          <Plus size={16} /> Tạo đơn
        </button>
      </div>

      <div className="flex gap-2">
        {['', 'paid', 'unpaid'].map(s => (
          <button key={s}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === s ? 'bg-primary-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            onClick={() => setFilter(s)}>
            {s === '' ? 'Tất cả' : s === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : orders.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">Chưa có đơn hàng nào</div>
      ) : (
        <div className="space-y-2">
          {orders.map(o => (
            <div key={o.order_id} className="card !p-3 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900 text-sm">{o.customer_name || 'Khách lẻ'}</span>
                  <span className={o.payment_status === 'paid' ? 'badge-green' : 'badge-yellow'}>
                    {o.payment_status === 'paid' ? 'Đã TT' : 'Chưa TT'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{fmt.datetime(o.order_date)} · {o.payment_method}</p>
                {o.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{o.notes}</p>}
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-base font-bold text-primary-700">{fmt.currency(o.final_amount)}</span>
                  {o.discount > 0 && <span className="text-xs text-gray-400 line-through">{fmt.currency(o.total_amount)}</span>}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => togglePaid(o)}
                  className={`p-2 rounded-lg transition-colors ${o.payment_status === 'paid' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  title={o.payment_status === 'paid' ? 'Đánh dấu chưa TT' : 'Đánh dấu đã TT'}>
                  <Check size={15} />
                </button>
                <button onClick={() => remove(o.order_id)} className="p-2 rounded-lg text-red-500 hover:bg-red-50">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── New Order (POS) ─────────────────────────────────────────────────────────
function NewOrder() {
  const navigate = useNavigate();
  const [products, setProducts]     = useState([]);
  const [customers, setCustomers]   = useState([]);
  const [prodSearch, setProdSearch] = useState('');
  const [prodOpen, setProdOpen]     = useState(false);
  const [items, setItems]           = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('Khách lẻ');
  const [custSearch, setCustSearch]     = useState('Khách lẻ');
  const [custOpen, setCustOpen]         = useState(false);
  const [newCustMode, setNewCustMode]   = useState(false);
  const [newCustName, setNewCustName]   = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustSaving, setNewCustSaving] = useState(false);
  const [discount, setDiscount]   = useState('');
  const [payMethod, setPayMethod] = useState('Tiền mặt');
  const [payStatus, setPayStatus] = useState('paid');
  const [notes, setNotes]         = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => {
    Promise.all([productsApi.list({ in_stock: 'true' }), customersApi.list()])
      .then(([p, c]) => { setProducts(p.data); setCustomers(c.data); });
  }, []);

  const filtered = products.filter(p =>
    !prodSearch || p.name.toLowerCase().includes(prodSearch.toLowerCase()) ||
    p.product_id.toLowerCase().includes(prodSearch.toLowerCase())
  );

  const filteredCustomers = customers.filter(c =>
    !custSearch || c.name.toLowerCase().includes(custSearch.toLowerCase()) ||
    (c.phone && c.phone.includes(custSearch))
  );

  const selectCustomer = (id, name) => {
    setCustomerId(id);
    setCustomerName(name);
    setCustSearch(name);
    setCustOpen(false);
  };

  const addItem = (p) => {
    setItems(prev => {
      const existing = prev.find(i => i.product_id === p.product_id);
      if (existing) {
        return prev.map(i => i.product_id === p.product_id
          ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product_id: p.product_id, name: p.name, unit_price: p.sell_price, quantity: 1, stock_qty: p.stock_qty }];
    });
    setProdSearch('');
    setProdOpen(false);
  };

  const updateQty = (id, qty) => {
    if (qty <= 0) return removeItem(id);
    setItems(prev => prev.map(i => i.product_id === id ? { ...i, quantity: qty } : i));
  };

  const updatePrice = (id, price) => {
    setItems(prev => prev.map(i => i.product_id === id ? { ...i, unit_price: Number(price) } : i));
  };

  const removeItem = (id) => setItems(prev => prev.filter(i => i.product_id !== id));

  const totalAmount = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const finalAmount = totalAmount - (Number(discount) || 0);

  const createCustomer = async () => {
    if (!newCustName.trim()) return;
    setNewCustSaving(true);
    try {
      const r = await customersApi.create({ name: newCustName.trim(), phone: newCustPhone.trim() });
      const newCust = { customer_id: r.data.customer_id, name: newCustName.trim(), phone: newCustPhone.trim() };
      setCustomers(prev => [...prev, newCust]);
      selectCustomer(newCust.customer_id, newCust.name);
      setNewCustMode(false);
      setNewCustName('');
      setNewCustPhone('');
    } catch (e) { alert(e.message); }
    finally { setNewCustSaving(false); }
  };

  const submit = async () => {
    if (items.length === 0) return setError('Thêm ít nhất 1 sản phẩm');
    for (const i of items) {
      if (i.quantity > i.stock_qty) return setError(`"${i.name}" chỉ còn ${i.stock_qty} cái`);
    }
    setSaving(true); setError('');
    try {
      await ordersApi.create({
        customer_id: customerId,
        customer_name: customerName,
        discount: Number(discount) || 0,
        payment_method: payMethod,
        payment_status: payStatus,
        notes,
        items: items.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price })),
      });
      navigate('/orders');
    } catch (e) { setError(e.message); setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button className="btn-ghost !p-2" onClick={() => navigate('/orders')}><X size={18} /></button>
        <h1 className="text-xl font-bold text-gray-900">Tạo đơn bán</h1>
      </div>

      {error && (
        <div className="flex gap-2 items-start p-3 bg-red-50 rounded-lg text-red-700 text-sm">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <div className="grid md:grid-cols-5 gap-4">
        {/* Product picker */}
        <div className="md:col-span-3 space-y-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Tìm sản phẩm..."
              value={prodSearch}
              onFocus={() => setProdOpen(true)}
              onBlur={() => setTimeout(() => setProdOpen(false), 150)}
              onChange={e => { setProdSearch(e.target.value); setProdOpen(true); }}
            />
          </div>
          {prodOpen && (
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {filtered.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Không tìm thấy</p>
              ) : filtered.map(p => (
                <button key={p.product_id} onClick={() => addItem(p)}
                  className="w-full text-left card !p-3 flex items-center justify-between hover:border-primary-300 hover:shadow transition-all">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.brand} · Tồn: {p.stock_qty}</p>
                  </div>
                  <span className="text-sm font-semibold text-primary-700 shrink-0 ml-2">{fmt.currency(p.sell_price)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cart & checkout */}
        <div className="md:col-span-2 space-y-3">
          {/* Customer */}
          <div className="card !p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="label !mb-0">Khách hàng</label>
              {!newCustMode && (
                <button className="flex items-center gap-1 text-xs text-primary-700 hover:text-primary-900 font-medium"
                  onClick={() => setNewCustMode(true)}>
                  <UserPlus size={13} /> Tạo mới
                </button>
              )}
            </div>
            {!newCustMode ? (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  className="input text-sm pl-8"
                  placeholder="Tìm khách hàng..."
                  value={custSearch}
                  onFocus={() => { setCustOpen(true); setCustSearch(''); }}
                  onBlur={() => setTimeout(() => { setCustOpen(false); setCustSearch(customerName); }, 150)}
                  onChange={e => { setCustSearch(e.target.value); setCustOpen(true); }}
                />
                {custOpen && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    <button
                      className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 border-b border-gray-100"
                      onClick={() => selectCustomer('', 'Khách lẻ')}>
                      Khách lẻ
                    </button>
                    {filteredCustomers.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-3">Không tìm thấy</p>
                    ) : filteredCustomers.map(c => (
                      <button key={c.customer_id}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between gap-2"
                        onClick={() => selectCustomer(c.customer_id, c.name)}>
                        <span className="text-sm font-medium text-gray-900">{c.name}</span>
                        {c.phone && <span className="text-xs text-gray-400 shrink-0">{c.phone}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  className="input text-sm"
                  placeholder="Tên khách hàng *"
                  value={newCustName}
                  onChange={e => setNewCustName(e.target.value)}
                  autoFocus
                />
                <input
                  className="input text-sm"
                  placeholder="Số điện thoại"
                  value={newCustPhone}
                  onChange={e => setNewCustPhone(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    className="btn-primary flex-1 text-sm py-1.5"
                    onClick={createCustomer}
                    disabled={newCustSaving || !newCustName.trim()}>
                    <UserPlus size={14} />
                    {newCustSaving ? 'Đang lưu...' : 'Lưu khách'}
                  </button>
                  <button
                    className="btn-ghost text-sm py-1.5 px-3"
                    onClick={() => { setNewCustMode(false); setNewCustName(''); setNewCustPhone(''); }}>
                    Hủy
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Cart items */}
          <div className="card !p-3">
            <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <ShoppingCart size={15} /> Giỏ hàng ({items.length})
            </p>
            {items.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Chưa có sản phẩm</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {items.map(i => (
                  <div key={i.product_id} className="border-b border-gray-50 pb-2 last:border-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-gray-900 flex-1 leading-tight">{i.name}</p>
                      <button onClick={() => removeItem(i.product_id)} className="text-gray-400 hover:text-red-500 shrink-0">
                        <X size={13} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                        <button className="px-2 py-1 text-gray-600 hover:bg-gray-100 text-sm"
                          onClick={() => updateQty(i.product_id, i.quantity - 1)}>−</button>
                        <span className="px-2 text-sm font-medium min-w-[28px] text-center">{i.quantity}</span>
                        <button className="px-2 py-1 text-gray-600 hover:bg-gray-100 text-sm"
                          onClick={() => updateQty(i.product_id, i.quantity + 1)}>+</button>
                      </div>
                      <input className="input !py-1 text-xs text-right flex-1" type="number" value={i.unit_price}
                        onChange={e => updatePrice(i.product_id, e.target.value)} />
                    </div>
                    <p className="text-xs text-right text-primary-700 font-medium mt-0.5">
                      = {fmt.currency(i.quantity * i.unit_price)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="card !p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Tổng tiền hàng</span>
              <span className="font-medium">{fmt.currency(totalAmount)}</span>
            </div>
            <div className="flex items-center justify-between text-sm gap-2">
              <span className="text-gray-500 shrink-0">Giảm giá</span>
              <input className="input !py-1 text-right text-sm w-32" type="number" min="0"
                value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0" />
            </div>
            <div className="flex justify-between text-base font-bold border-t border-gray-100 pt-2">
              <span>Thành tiền</span>
              <span className="text-primary-700">{fmt.currency(finalAmount)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label text-xs">Thanh toán</label>
              <select className="input text-sm" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                <option>Tiền mặt</option>
                <option>Chuyển khoản</option>
                <option>Thẻ</option>
              </select>
            </div>
            <div>
              <label className="label text-xs">Trạng thái</label>
              <select className="input text-sm" value={payStatus} onChange={e => setPayStatus(e.target.value)}>
                <option value="paid">Đã TT</option>
                <option value="unpaid">Chưa TT</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label text-xs">Ghi chú</label>
            <input className="input text-sm" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ghi chú đơn hàng..." />
          </div>

          <button className="btn-primary w-full text-base py-3" onClick={submit} disabled={saving || items.length === 0}>
            {saving ? 'Đang xử lý...' : `Xác nhận đơn · ${fmt.currency(finalAmount)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
