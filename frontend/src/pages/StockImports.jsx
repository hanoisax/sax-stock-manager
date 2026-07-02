import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { importsApi, productsApi, metaApi, imagesApi, fmt } from '../lib/api';
import { Plus, X, AlertCircle, Search, Trash2, Music2, Package, Camera, ImageOff, Pencil } from 'lucide-react';

export default function StockImports() {
  const [searchParams] = useSearchParams();
  const view   = searchParams.get('view');
  const editId = searchParams.get('id');
  if (view === 'new')               return <ImportForm />;
  if (view === 'edit' && editId)    return <ImportForm editId={editId} />;
  return <ImportList />;
}

// ─── Import List ──────────────────────────────────────────────────────────────
function ImportList() {
  const navigate = useNavigate();
  const [list, setList]       = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await importsApi.list(); setList(r.data); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Xóa phiếu nhập này? Tồn kho sẽ được hoàn lại.')) return;
    try { await importsApi.delete(id); load(); }
    catch (e) { alert(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Nhập kho</h1>
        <button className="btn-primary" onClick={() => navigate('?view=new')}>
          <Plus size={16} /> Tạo phiếu
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : list.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">Chưa có phiếu nhập nào</div>
      ) : (
        <div className="space-y-2">
          {list.map(imp => (
            <div key={imp.import_id} className="card !p-3 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="font-mono text-xs text-gray-400">{imp.import_id}</span>
                <p className="font-semibold text-gray-900 text-sm mt-0.5">{imp.supplier || 'Không rõ NCC'}</p>
                <p className="text-xs text-gray-500">{fmt.datetime(imp.import_date)}</p>
                {imp.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{imp.notes}</p>}
                <p className="text-base font-bold text-primary-700 mt-1">{fmt.currency(imp.total_cost)}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => navigate(`?view=edit&id=${imp.import_id}`)}
                  className="btn-ghost !p-2 text-gray-500 hover:bg-blue-50 hover:text-blue-600">
                  <Pencil size={15} />
                </button>
                <button onClick={(e) => remove(imp.import_id, e)}
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

// ─── Import Form (create + edit) ──────────────────────────────────────────────
const SAX_GROUPS = ['Alto', 'Soprano', 'Baritone'];

const EMPTY_SAX = {
  name: '', brand: '', group: '', condition: 'Mới',
  sell_price: '', description: '', images: [],
};

function ImportForm({ editId }) {
  const navigate   = useNavigate();
  const isEdit     = !!editId;

  const [loadingData, setLoadingData] = useState(isEdit);
  const [supplier, setSupplier]       = useState('');
  const [notes, setNotes]             = useState('');
  const [items, setItems]             = useState([]);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [tab, setTab]                 = useState('sax');

  const [saxForm, setSaxForm]         = useState(EMPTY_SAX);
  const [saxCost, setSaxCost]         = useState('');
  const [uploadingCount, setUploadingCount] = useState(0);
  const imageInputRef                 = useRef(null);

  const [products, setProducts]       = useState([]);
  const [dropdowns, setDropdowns]     = useState({});
  const [accSearch, setAccSearch]     = useState('');
  const [accOpen, setAccOpen]         = useState(false);

  // Load dropdowns + products
  useEffect(() => {
    Promise.all([
      productsApi.list({ status: 'active' }),
      metaApi.dropdowns(),
    ]).then(([p, d]) => {
      setProducts(p.data);
      setDropdowns(d.data || {});
    }).catch(console.error);
  }, []);

  // Load existing import data in edit mode
  useEffect(() => {
    if (!isEdit) return;
    importsApi.get(editId).then(r => {
      const imp = r.data;
      setSupplier(imp.supplier || '');
      setNotes(imp.notes || '');
      setItems((imp.items || []).map(i => ({
        _id:          i.item_id || i.product_id,
        _mode:        'acc',
        product_id:   i.product_id,
        quantity:     Number(i.quantity) || 1,
        unit_cost:    Number(i.unit_cost) || 0,
        display_name: i.product_name,
        display_sub:  '',
        preview_img:  null,
      })));
    }).catch(e => setError(e.message))
      .finally(() => setLoadingData(false));
  }, [editId]);

  // ── Image upload ───────────────────────────────────────────────────────────
  const handleImageSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const oversized = files.filter(f => f.size > 5 * 1024 * 1024);
    if (oversized.length) { setError(`Ảnh quá 5MB: ${oversized.map(f => f.name).join(', ')}`); e.target.value = ''; return; }
    setUploadingCount(c => c + files.length);
    setError('');
    const results = await Promise.allSettled(files.map(async (file) => {
      const base64 = await fileToBase64(file);
      const res = await imagesApi.upload({ data: base64, mimeType: file.type, filename: file.name });
      return res.data.url;
    }));
    setUploadingCount(c => c - files.length);
    const urls = results.filter(r => r.status === 'fulfilled').map(r => r.value);
    const errs = results.filter(r => r.status === 'rejected').map(r => r.reason.message);
    if (errs.length) setError('Upload thất bại: ' + errs.join(', '));
    if (urls.length) setSaxForm(f => ({ ...f, images: [...f.images, ...urls] }));
    e.target.value = '';
  };

  const removeSaxImage = (idx) =>
    setSaxForm(f => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));

  // ── Saxophone: add to cart ─────────────────────────────────────────────────
  const addSax = () => {
    if (!saxForm.name) return setError('Vui lòng nhập tên kèn');
    if (!saxCost)      return setError('Vui lòng nhập giá nhập');
    if (uploadingCount > 0) return setError('Đang upload ảnh, vui lòng chờ...');
    setError('');
    const tempId = `new_sax_${Date.now()}`;
    setItems(prev => [...prev, {
      _id:          tempId,
      _mode:        'sax',
      product_id:   null,
      new_product:  { ...saxForm, type: 'Kèn', sell_price: Number(saxForm.sell_price) || 0 },
      quantity:     1,
      unit_cost:    Number(saxCost),
      display_name: saxForm.name,
      display_sub:  `${saxForm.brand} · ${saxForm.group} · ${saxForm.condition}`,
      preview_img:  saxForm.images[0] || null,
      img_count:    saxForm.images.length,
    }]);
    setSaxForm(EMPTY_SAX);
    setSaxCost('');
  };

  // ── Accessory: add to cart ─────────────────────────────────────────────────
  const addAcc = (p) => {
    setItems(prev => {
      const ex = prev.find(i => i.product_id === p.product_id);
      if (ex) return prev.map(i =>
        i.product_id === p.product_id ? { ...i, quantity: i.quantity + 1 } : i
      );
      return [...prev, {
        _id:          p.product_id,
        _mode:        'acc',
        product_id:   p.product_id,
        quantity:     1,
        unit_cost:    p.cost_price || 0,
        display_name: p.name,
        display_sub:  `${p.brand} · Tồn: ${p.stock_qty}`,
        preview_img:  p.image_url ? p.image_url.split(',')[0] : null,
      }];
    });
    setAccSearch('');
    setAccOpen(false);
  };

  const updateQty  = (id, v) => { if (Number(v) <= 0) return removeItem(id); setItems(p => p.map(i => i._id === id ? { ...i, quantity: Number(v) } : i)); };
  const updateCost = (id, v) => setItems(p => p.map(i => i._id === id ? { ...i, unit_cost: Number(v) } : i));
  const removeItem = (id)    => setItems(p => p.filter(i => i._id !== id));

  const totalCost = items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const submit = async () => {
    if (items.length === 0) return setError('Thêm ít nhất 1 sản phẩm vào phiếu');
    setSaving(true); setError('');
    try {
      const mappedItems = items.map(i =>
        i._mode === 'sax'
          ? { new_product: i.new_product, quantity: i.quantity, unit_cost: i.unit_cost }
          : { product_id: i.product_id, quantity: i.quantity, unit_cost: i.unit_cost }
      );
      const payload = { supplier, notes, items: mappedItems };
      if (isEdit) {
        await importsApi.update({ ...payload, import_id: editId });
      } else {
        await importsApi.create(payload);
      }
      navigate('/imports');
    } catch (e) { setError(e.message); setSaving(false); }
  };

  const brands     = dropdowns.brand     || [];
  const conditions = dropdowns.condition || ['Mới', 'Like new', 'Cũ'];

  const filteredAcc = products.filter(p =>
    !accSearch ||
    p.name.toLowerCase().includes(accSearch.toLowerCase()) ||
    p.product_id.toLowerCase().includes(accSearch.toLowerCase())
  );

  if (loadingData) {
    return <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button className="btn-ghost !p-2" onClick={() => navigate('/imports')}><X size={18} /></button>
        <h1 className="text-xl font-bold text-gray-900">
          {isEdit ? 'Sửa phiếu nhập kho' : 'Tạo phiếu nhập kho'}
        </h1>
      </div>

      {error && (
        <div className="flex gap-2 items-start p-3 bg-red-50 rounded-lg text-red-700 text-sm">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <div className="grid md:grid-cols-5 gap-4">
        {/* Left: input area */}
        <div className="md:col-span-3 space-y-3">
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
            <button onClick={() => setTab('sax')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === 'sax' ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500 hover:text-gray-700'
              }`}>
              <Music2 size={16} /> Nhập kèn mới
            </button>
            <button onClick={() => setTab('acc')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === 'acc' ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500 hover:text-gray-700'
              }`}>
              <Package size={16} /> Phụ kiện / Khác
            </button>
          </div>

          {/* ── Tab: Kèn mới ─────────────────────────────────────────── */}
          {tab === 'sax' && (
            <div className="card space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Thông tin kèn nhập mới</p>
              <div>
                <label className="label">Tên kèn *</label>
                <input className="input" placeholder="VD: Yamaha YAS-280 Alto"
                  value={saxForm.name} onChange={e => setSaxForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Thương hiệu</label>
                  <select className="input" value={saxForm.brand}
                    onChange={e => setSaxForm(f => ({ ...f, brand: e.target.value }))}>
                    <option value="">-- Chọn --</option>
                    {brands.map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Loại kèn</label>
                  <select className="input" value={saxForm.group}
                    onChange={e => setSaxForm(f => ({ ...f, group: e.target.value }))}>
                    <option value="">-- Chọn --</option>
                    {SAX_GROUPS.map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tình trạng</label>
                  <select className="input" value={saxForm.condition}
                    onChange={e => setSaxForm(f => ({ ...f, condition: e.target.value }))}>
                    {conditions.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Giá bán dự kiến</label>
                  <input className="input" type="number" min="0" placeholder="VNĐ"
                    value={saxForm.sell_price}
                    onChange={e => setSaxForm(f => ({ ...f, sell_price: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Mô tả / Serial</label>
                <input className="input" placeholder="Số serial, ghi chú tình trạng..."
                  value={saxForm.description}
                  onChange={e => setSaxForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label className="label">Giá nhập *</label>
                <input className="input" type="number" min="0" placeholder="VNĐ"
                  value={saxCost} onChange={e => setSaxCost(e.target.value)} />
              </div>

              {/* Multi-image upload */}
              <div>
                <label className="label">Ảnh sản phẩm</label>
                <div className="flex flex-wrap gap-2">
                  {saxForm.images.map((url, idx) => (
                    <div key={idx} className="relative group w-16 h-16">
                      <img src={url} alt="" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                      <button type="button" onClick={() => removeSaxImage(idx)}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow">
                        <X size={9} />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => imageInputRef.current?.click()}
                    disabled={uploadingCount > 0}
                    className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-0.5 text-gray-400 hover:border-primary-400 hover:text-primary-500 transition-colors disabled:opacity-50">
                    {uploadingCount > 0 ? <span className="text-xs font-medium">{uploadingCount}</span> : <><Camera size={18} /><span className="text-xs">Thêm</span></>}
                  </button>
                  <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
                </div>
                {saxForm.images.length > 0 && (
                  <p className="text-xs text-gray-400 mt-1">{saxForm.images.length} ảnh · hover để xóa</p>
                )}
              </div>

              <button className="btn-primary w-full" onClick={addSax} disabled={uploadingCount > 0}>
                <Plus size={15} /> Thêm vào phiếu nhập
              </button>
            </div>
          )}

          {/* ── Tab: Phụ kiện ────────────────────────────────────────── */}
          {tab === 'acc' && (
            <div className="space-y-2">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-9" placeholder="Tìm sản phẩm có sẵn..."
                  value={accSearch}
                  onChange={e => { setAccSearch(e.target.value); setAccOpen(true); }}
                  onFocus={() => setAccOpen(true)}
                  onBlur={() => setTimeout(() => setAccOpen(false), 150)} />
              </div>
              {accOpen && (
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {filteredAcc.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">Không tìm thấy sản phẩm</p>
                  ) : filteredAcc.map(p => (
                    <button key={p.product_id} onClick={() => addAcc(p)}
                      className="w-full text-left card !p-3 flex items-center gap-3 hover:border-primary-300 hover:shadow transition-all">
                      <MiniThumb url={p.image_url} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.brand} · Tồn: {p.stock_qty}</p>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">{fmt.currency(p.cost_price)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: phiếu nhập */}
        <div className="md:col-span-2 space-y-3">
          <div className="card !p-3 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Thông tin phiếu</p>
            <div>
              <label className="label text-xs">Nhà cung cấp</label>
              <input className="input text-sm" value={supplier}
                onChange={e => setSupplier(e.target.value)} placeholder="Tên NCC, cá nhân bán..." />
            </div>
            <div>
              <label className="label text-xs">Ghi chú</label>
              <input className="input text-sm" value={notes}
                onChange={e => setNotes(e.target.value)} placeholder="Ghi chú phiếu nhập..." />
            </div>
          </div>

          <div className="card !p-3">
            <p className="text-sm font-semibold text-gray-700 mb-2">Danh sách nhập ({items.length} mục)</p>
            {items.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">Thêm kèn hoặc phụ kiện từ bên trái</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {items.map(i => (
                  <div key={i._id} className="pb-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        {i.preview_img
                          ? <img src={i.preview_img} alt="" className="w-8 h-8 rounded object-cover shrink-0 border border-gray-100" />
                          : <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center shrink-0">
                              {i._mode === 'sax'
                                ? <Music2 size={13} className="text-primary-400" />
                                : <Package size={13} className="text-gray-300" />}
                            </div>
                        }
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-900 truncate">{i.display_name}</p>
                          {i.display_sub && <p className="text-xs text-gray-400">{i.display_sub}</p>}
                          {i._mode === 'sax' && i.img_count > 0 && (
                            <p className="text-xs text-primary-600">{i.img_count} ảnh</p>
                          )}
                        </div>
                      </div>
                      <button onClick={() => removeItem(i._id)} className="text-gray-400 hover:text-red-500 shrink-0 mt-0.5">
                        <X size={13} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      {i._mode === 'sax' ? (
                        <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-200">SL: 1 cây</span>
                      ) : (
                        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                          <button className="px-2 py-1 text-gray-600 hover:bg-gray-100 text-sm"
                            onClick={() => updateQty(i._id, i.quantity - 1)}>−</button>
                          <span className="px-2 text-sm font-medium min-w-[28px] text-center">{i.quantity}</span>
                          <button className="px-2 py-1 text-gray-600 hover:bg-gray-100 text-sm"
                            onClick={() => updateQty(i._id, i.quantity + 1)}>+</button>
                        </div>
                      )}
                      <input className="input !py-1 text-xs text-right flex-1" type="number"
                        value={i.unit_cost} onChange={e => updateCost(i._id, e.target.value)}
                        placeholder="Giá nhập" />
                    </div>
                    <p className="text-xs text-right text-green-700 font-medium mt-0.5">
                      = {fmt.currency(i.quantity * i.unit_cost)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card !p-3">
            <div className="flex justify-between items-center font-bold text-base">
              <span>Tổng chi phí</span>
              <span className="text-green-700">{fmt.currency(totalCost)}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {items.filter(i => i._mode === 'sax').length} kèn mới ·{' '}
              {items.filter(i => i._mode === 'acc').length} loại phụ kiện
            </p>
          </div>

          <button className="btn-primary w-full text-base py-3" onClick={submit}
            disabled={saving || items.length === 0}>
            {saving ? 'Đang xử lý...' : isEdit
              ? `Lưu thay đổi · ${fmt.currency(totalCost)}`
              : `Xác nhận nhập · ${fmt.currency(totalCost)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function MiniThumb({ url }) {
  const firstUrl = url ? url.split(',')[0].trim() : '';
  if (!firstUrl) {
    return <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center shrink-0">
      <ImageOff size={12} className="text-gray-300" />
    </div>;
  }
  return <img src={firstUrl} alt="" onError={e => { e.target.style.display='none'; }}
    className="w-8 h-8 rounded object-cover shrink-0 border border-gray-100" />;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = (e) => resolve(e.target.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
