import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { stockTakesApi, productsApi, fmt } from '../lib/api';
import { Plus, X, AlertCircle, Search, Trash2, ClipboardCheck, ImageOff, TrendingUp, TrendingDown, Eye } from 'lucide-react';

export default function StockTakes() {
  const [searchParams] = useSearchParams();
  const view   = searchParams.get('view');
  const viewId = searchParams.get('id');
  if (view === 'new')               return <StockTakeForm />;
  if (view === 'detail' && viewId)  return <StockTakeDetail id={viewId} />;
  return <StockTakeList />;
}

// ─── List ───────────────────────────────────────────────────────────────────
function StockTakeList() {
  const navigate = useNavigate();
  const [list, setList]       = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await stockTakesApi.list(); setList(r.data); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Xóa phiếu kiểm kho này? Tồn kho hiện tại sẽ được giữ nguyên.')) return;
    try { await stockTakesApi.delete(id); load(); }
    catch (e) { alert(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Kiểm kho</h1>
        <button className="btn-primary" onClick={() => navigate('?view=new')}>
          <Plus size={16} /> Kiểm kho mới
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : list.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">Chưa có phiếu kiểm kho nào</div>
      ) : (
        <div className="space-y-2">
          {list.map(t => (
            <div key={t.stocktake_id} onClick={() => navigate(`?view=detail&id=${t.stocktake_id}`)}
              className="card !p-3 flex items-start justify-between gap-3 cursor-pointer hover:border-primary-300 hover:shadow transition-all">
              <div className="min-w-0 flex-1">
                <span className="font-mono text-xs text-gray-400">{t.stocktake_id}</span>
                <p className="text-xs text-gray-500 mt-0.5">{fmt.datetime(t.take_date)}</p>
                {t.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{t.notes}</p>}
                <div className="flex items-center gap-3 mt-1.5">
                  <DiffBadge qty={t.total_diff_qty} />
                  <span className={`text-base font-bold ${t.total_diff_value >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {t.total_diff_value >= 0 ? '+' : ''}{fmt.currency(t.total_diff_value)}
                  </span>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={(e) => { e.stopPropagation(); navigate(`?view=detail&id=${t.stocktake_id}`); }}
                  className="btn-ghost !p-2 text-gray-500 hover:bg-blue-50 hover:text-blue-600">
                  <Eye size={15} />
                </button>
                <button onClick={(e) => remove(t.stocktake_id, e)}
                  className="btn-ghost !p-2 text-red-500 hover:bg-red-50">
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

// ─── Detail ─────────────────────────────────────────────────────────────────
function StockTakeDetail({ id }) {
  const navigate = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    stockTakesApi.get(id)
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}</div>;
  if (!data)   return <div className="card text-center py-12 text-gray-400">Không tìm thấy phiếu</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button className="btn-ghost !p-2" onClick={() => navigate('/stocktakes')}><X size={18} /></button>
        <h1 className="text-xl font-bold text-gray-900">Chi tiết kiểm kho</h1>
      </div>

      <div className="card !p-3">
        <span className="font-mono text-xs text-gray-400">{data.stocktake_id}</span>
        <p className="text-sm text-gray-500 mt-0.5">{fmt.datetime(data.take_date)}</p>
        {data.notes && <p className="text-sm text-gray-600 mt-1">{data.notes}</p>}
        <div className="flex items-center gap-4 mt-2 pt-2 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-400">Chênh lệch SL</p>
            <DiffBadge qty={data.total_diff_qty} />
          </div>
          <div>
            <p className="text-xs text-gray-400">Chênh lệch giá trị</p>
            <p className={`text-base font-bold ${data.total_diff_value >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              {data.total_diff_value >= 0 ? '+' : ''}{fmt.currency(data.total_diff_value)}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {data.items.map((i, idx) => (
          <div key={idx} className="card !p-3">
            <p className="text-sm font-medium text-gray-900">{i.product_name}</p>
            <div className="grid grid-cols-3 gap-2 mt-2 text-center">
              <div>
                <p className="text-xs text-gray-400">Hệ thống</p>
                <p className="text-sm font-semibold text-gray-700">{i.system_qty}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Thực tế</p>
                <p className="text-sm font-semibold text-gray-900">{i.actual_qty}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Chênh lệch</p>
                <p className={`text-sm font-bold ${i.diff_qty > 0 ? 'text-green-700' : i.diff_qty < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                  {i.diff_qty > 0 ? '+' : ''}{i.diff_qty}
                </p>
              </div>
            </div>
            {i.diff_qty !== 0 && (
              <p className={`text-xs text-right mt-1 font-medium ${i.diff_value >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {i.diff_value >= 0 ? '+' : ''}{fmt.currency(i.diff_value)} (giá vốn {fmt.currency(i.cost_price)})
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── New Form ───────────────────────────────────────────────────────────────
function StockTakeForm() {
  const navigate = useNavigate();
  const [products, setProducts]   = useState([]);
  const [items, setItems]         = useState([]);   // [{ product_id, name, system_qty, cost_price, actual_qty, image_url }]
  const [search, setSearch]       = useState('');
  const [open, setOpen]           = useState(false);
  const [notes, setNotes]         = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => {
    productsApi.list({ status: 'active' }).then(r => setProducts(r.data)).catch(console.error);
  }, []);

  const addItem = (p) => {
    setItems(prev => {
      if (prev.find(i => i.product_id === p.product_id)) return prev;
      return [...prev, {
        product_id: p.product_id,
        name:       p.name,
        system_qty: Number(p.stock_qty) || 0,
        cost_price: Number(p.cost_price) || 0,
        actual_qty: '',
        image_url:  p.image_url || '',
      }];
    });
    // Chọn xong thì thu gọn thanh tìm kiếm
    setSearch('');
    setOpen(false);
  };

  const setActual = (id, v) => setItems(prev => prev.map(i => i.product_id === id ? { ...i, actual_qty: v } : i));
  const removeItem = (id) => setItems(prev => prev.filter(i => i.product_id !== id));

  const diffOf = (i) => i.actual_qty === '' ? null : Number(i.actual_qty) - i.system_qty;
  const totalDiffValue = items.reduce((s, i) => {
    const d = diffOf(i);
    return d === null ? s : s + d * i.cost_price;
  }, 0);

  const filtered = products.filter(p =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.product_id.toLowerCase().includes(search.toLowerCase())
  );

  const submit = async () => {
    const valid = items.filter(i => i.actual_qty !== '' && !isNaN(Number(i.actual_qty)));
    if (valid.length === 0) return setError('Nhập số lượng thực tế cho ít nhất 1 sản phẩm');
    setSaving(true); setError('');
    try {
      await stockTakesApi.create({
        notes,
        items: valid.map(i => ({ product_id: i.product_id, actual_qty: Number(i.actual_qty) })),
      });
      navigate('/stocktakes');
    } catch (e) { setError(e.message); setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button className="btn-ghost !p-2" onClick={() => navigate('/stocktakes')}><X size={18} /></button>
        <h1 className="text-xl font-bold text-gray-900">Kiểm kho</h1>
      </div>

      {error && (
        <div className="flex gap-2 items-start p-3 bg-red-50 rounded-lg text-red-700 text-sm">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {/* Product search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-9" placeholder="Tìm sản phẩm cần kiểm đếm..."
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)} />
        {open && (
          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-72 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Không tìm thấy sản phẩm</p>
            ) : filtered.map(p => {
              const added = items.find(i => i.product_id === p.product_id);
              return (
                <button key={p.product_id}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => addItem(p)} disabled={!!added}
                  className="w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  <MiniThumb url={p.image_url} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.brand} · Tồn: {p.stock_qty}</p>
                  </div>
                  {added && <span className="text-xs text-primary-600 shrink-0">Đã thêm</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Count list */}
      <div className="card !p-3">
        <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <ClipboardCheck size={15} /> Danh sách kiểm đếm ({items.length})
        </p>
        {items.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">Chọn sản phẩm từ ô tìm kiếm phía trên</p>
        ) : (
          <div className="space-y-2">
            {items.map(i => {
              const diff = diffOf(i);
              return (
                <div key={i.product_id} className="pb-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <MiniThumb url={i.image_url} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{i.name}</p>
                        <p className="text-xs text-gray-400">Giá vốn: {fmt.currency(i.cost_price)}</p>
                      </div>
                    </div>
                    <button onClick={() => removeItem(i.product_id)} className="text-gray-400 hover:text-red-500 shrink-0 mt-0.5">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="text-center px-2">
                      <p className="text-[10px] text-gray-400 leading-none">Hệ thống</p>
                      <p className="text-sm font-semibold text-gray-700 mt-0.5">{i.system_qty}</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-gray-400 leading-none mb-0.5">Số thực tế</p>
                      <input className="input !py-1.5 text-sm text-center" type="number" min="0"
                        placeholder="..." value={i.actual_qty}
                        onChange={e => setActual(i.product_id, e.target.value)} />
                    </div>
                    <div className="text-center px-2 min-w-[64px]">
                      <p className="text-[10px] text-gray-400 leading-none">Chênh lệch</p>
                      {diff === null ? (
                        <p className="text-sm text-gray-300 mt-0.5">—</p>
                      ) : (
                        <p className={`text-sm font-bold mt-0.5 ${diff > 0 ? 'text-green-700' : diff < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                          {diff > 0 ? '+' : ''}{diff}
                        </p>
                      )}
                    </div>
                  </div>
                  {diff !== null && diff !== 0 && (
                    <p className={`text-xs text-right mt-1 font-medium ${diff >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {diff >= 0 ? '+' : ''}{fmt.currency(diff * i.cost_price)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="card !p-3 flex justify-between items-center">
          <span className="text-sm font-semibold text-gray-700">Tổng chênh lệch giá trị</span>
          <span className={`text-base font-bold ${totalDiffValue >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {totalDiffValue >= 0 ? '+' : ''}{fmt.currency(totalDiffValue)}
          </span>
        </div>
      )}

      <div className="card !p-3">
        <label className="label text-xs">Ghi chú</label>
        <input className="input text-sm" value={notes}
          onChange={e => setNotes(e.target.value)} placeholder="Lý do kiểm kho, người kiểm..." />
      </div>

      <button className="btn-primary w-full text-base py-3" onClick={submit}
        disabled={saving || items.length === 0}>
        {saving ? 'Đang xử lý...' : 'Xác nhận điều chỉnh tồn kho'}
      </button>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function DiffBadge({ qty }) {
  const cls = qty > 0 ? 'text-green-700' : qty < 0 ? 'text-red-600' : 'text-gray-500';
  const Icon = qty > 0 ? TrendingUp : qty < 0 ? TrendingDown : null;
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-semibold ${cls}`}>
      {Icon && <Icon size={14} />}
      {qty > 0 ? '+' : ''}{qty} cái
    </span>
  );
}

function MiniThumb({ url }) {
  const firstUrl = url ? url.split(',')[0].trim() : '';
  if (!firstUrl) {
    return <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center shrink-0">
      <ImageOff size={12} className="text-gray-300" />
    </div>;
  }
  return <img src={firstUrl} alt="" onError={e => { e.target.style.display = 'none'; }}
    className="w-8 h-8 rounded object-cover shrink-0 border border-gray-100" />;
}
