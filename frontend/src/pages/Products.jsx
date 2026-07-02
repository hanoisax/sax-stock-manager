import { useEffect, useState, useCallback, useRef } from 'react';
import { productsApi, metaApi, imagesApi, fmt } from '../lib/api';
import { Plus, Search, Pencil, Trash2, X, AlertCircle, Camera, ImageOff } from 'lucide-react';

const PRODUCT_TYPES = ['Kèn', 'Phụ kiện'];
const GROUP_OPTIONS = {
  'Kèn':      ['Alto', 'Soprano', 'Baritone'],
  'Phụ kiện': ['Beck', 'Dăm', 'Bao kèn', 'Chân kèn', 'Khác'],
};

const EMPTY_FORM = {
  product_id: '', name: '', type: 'Kèn', group: '', brand: '',
  condition: 'Mới', cost_price: '', sell_price: '', stock_qty: '',
  image_url: '', description: '', status: 'active',
};

export default function Products() {
  const [products, setProducts]     = useState([]);
  const [dropdowns, setDropdowns]   = useState({});
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filterType, setFilterType] = useState('');
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [uploading, setUploading]   = useState(false);
  const fileInputRef                = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (filterType) params.type = filterType;
      const [pRes, dRes] = await Promise.all([
        productsApi.list(params),
        dropdowns.brand ? Promise.resolve({ data: dropdowns }) : metaApi.dropdowns(),
      ]);
      setProducts(pRes.data);
      if (dRes.data) setDropdowns(dRes.data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [search, filterType]);

  useEffect(() => { load(); }, [load]);

  const openNew  = () => { setForm(EMPTY_FORM); setShowForm(true); setError(''); };
  const openEdit = (p) => {
    setForm({
      ...p,
      cost_price: String(p.cost_price),
      sell_price: String(p.sell_price),
      stock_qty:  String(p.stock_qty),
      image_url:  p.image_url || '',
      type:       p.type || 'Kèn',
      group:      p.group || '',
    });
    setShowForm(true);
    setError('');
  };
  const closeForm = () => { setShowForm(false); setError(''); };

  // Reset group khi đổi type
  const setType = (t) => setForm(f => ({ ...f, type: t, group: '' }));

  const handleImagePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('Ảnh tối đa 5MB'); return; }
    setUploading(true); setError('');
    try {
      const base64 = await fileToBase64(file);
      const res = await imagesApi.upload({ data: base64, mimeType: file.type, filename: file.name });
      // Thêm vào danh sách ảnh (comma-separated)
      setForm(f => ({
        ...f,
        image_url: f.image_url ? f.image_url + ',' + res.data.url : res.data.url,
      }));
    } catch (e) { setError('Upload ảnh thất bại: ' + e.message); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const removeImage = (idx) => {
    setForm(f => {
      const imgs = f.image_url.split(',').filter((_, i) => i !== idx).join(',');
      return { ...f, image_url: imgs };
    });
  };

  const save = async () => {
    if (!form.name) return setError('Vui lòng nhập tên sản phẩm');
    setSaving(true); setError('');
    try {
      const body = {
        ...form,
        cost_price: Number(form.cost_price) || 0,
        sell_price: Number(form.sell_price) || 0,
        stock_qty:  Number(form.stock_qty)  || 0,
      };
      if (form.product_id) await productsApi.update(body);
      else await productsApi.create(body);
      closeForm(); load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const remove = async (p) => {
    if (!confirm(`Xóa "${p.name}"?`)) return;
    try { await productsApi.delete(p.product_id); load(); }
    catch (e) { alert(e.message); }
  };

  const brands     = dropdowns.brand     || [];
  const conditions = dropdowns.condition || ['Mới', 'Like new', 'Cũ'];
  const groupOpts  = GROUP_OPTIONS[form.type] || [];
  const currentImgs = form.image_url ? form.image_url.split(',').filter(Boolean) : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Sản phẩm</h1>
        <button className="btn-primary" onClick={openNew}>
          <Plus size={16} /> Thêm mới
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Tìm theo tên, mã, thương hiệu..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input sm:w-36" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">Tất cả loại</option>
          {PRODUCT_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      {/* Table / List */}
      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : products.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">Không có sản phẩm nào</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="card !p-0 overflow-hidden hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['', 'Tên sản phẩm', 'Loại', 'Nhóm', 'Thương hiệu', 'Tồn', 'Giá bán', 'TT', ''].map((h, i) => (
                    <th key={i} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.map(p => (
                  <tr key={p.product_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 w-12">
                      <ProductThumb url={p.image_url} size={40} />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-[180px]">
                      <div className="truncate">{p.name}</div>
                      <div className="text-xs text-gray-400">{p.condition}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{p.type}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{p.group}</td>
                    <td className="px-4 py-3 text-gray-600">{p.brand}</td>
                    <td className="px-4 py-3">
                      <span className={p.stock_qty <= 0 ? 'badge-red' : p.stock_qty <= 2 ? 'badge-yellow' : 'badge-green'}>
                        {p.stock_qty}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{fmt.currency(p.sell_price)}</td>
                    <td className="px-4 py-3">
                      <span className={p.status === 'active' ? 'badge-green' : 'badge-gray'}>
                        {p.status === 'active' ? 'Đang bán' : 'Ẩn'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(p)} className="btn-ghost !p-2"><Pencil size={14} /></button>
                        <button onClick={() => remove(p)} className="btn-ghost !p-2 text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {products.map(p => (
              <div key={p.product_id} className="card !p-3 flex items-start gap-3">
                <ProductThumb url={p.image_url} size={52} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 text-sm truncate">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.type}{p.group ? ` · ${p.group}` : ''} · {p.brand}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-sm font-bold text-primary-700">{fmt.currency(p.sell_price)}</span>
                    <span className={p.stock_qty <= 0 ? 'badge-red' : p.stock_qty <= 2 ? 'badge-yellow' : 'badge-green'}>
                      Tồn: {p.stock_qty}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(p)} className="btn-ghost !p-2"><Pencil size={15} /></button>
                  <button onClick={() => remove(p)} className="btn-ghost !p-2 text-red-500"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="font-semibold text-gray-900">{form.product_id ? 'Cập nhật sản phẩm' : 'Thêm sản phẩm'}</h2>
              <button onClick={closeForm} className="btn-ghost !p-2"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {error && (
                <div className="flex gap-2 items-start p-3 bg-red-50 rounded-lg text-red-700 text-sm">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
                </div>
              )}

              {/* Image upload */}
              <Field label="Ảnh sản phẩm">
                <div className="flex flex-wrap gap-2">
                  {currentImgs.map((url, idx) => (
                    <div key={idx} className="relative group w-16 h-16">
                      <img src={url} alt="" className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                        onError={e => { e.target.style.display='none'; }} />
                      <button type="button" onClick={() => removeImage(idx)}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow">
                        <X size={9} />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                    className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-0.5 text-gray-400 hover:border-primary-400 hover:text-primary-500 transition-colors disabled:opacity-50">
                    {uploading ? <span className="text-xs">...</span> : <><Camera size={18} /><span className="text-xs">Thêm</span></>}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
                </div>
              </Field>

              <Field label="Tên sản phẩm *">
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </Field>

              {/* Type selector */}
              <Field label="Loại sản phẩm">
                <div className="flex gap-2">
                  {PRODUCT_TYPES.map(t => (
                    <button key={t} type="button" onClick={() => setType(t)}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${
                        form.type === t
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'border-gray-200 text-gray-600 hover:border-primary-300'
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
              </Field>

              {/* Group selector — conditional */}
              <div className="grid grid-cols-2 gap-3">
                <Field label={form.type === 'Kèn' ? 'Loại kèn' : 'Nhóm phụ kiện'}>
                  <select className="input" value={form.group} onChange={e => setForm(f => ({ ...f, group: e.target.value }))}>
                    <option value="">-- Chọn --</option>
                    {groupOpts.map(g => <option key={g}>{g}</option>)}
                  </select>
                </Field>
                <Field label="Thương hiệu">
                  <BrandCombobox
                    value={form.brand}
                    options={brands}
                    onChange={v => setForm(f => ({ ...f, brand: v }))}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Tình trạng">
                  <select className="input" value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}>
                    {conditions.map(c => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Tồn kho">
                  <input className="input" type="number" min="0" value={form.stock_qty}
                    onChange={e => setForm(f => ({ ...f, stock_qty: e.target.value }))} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Giá nhập (VNĐ)">
                  <input className="input" type="number" min="0" value={form.cost_price}
                    onChange={e => setForm(f => ({ ...f, cost_price: e.target.value }))} />
                </Field>
                <Field label="Giá bán (VNĐ)">
                  <input className="input" type="number" min="0" value={form.sell_price}
                    onChange={e => setForm(f => ({ ...f, sell_price: e.target.value }))} />
                </Field>
              </div>
              <Field label="Mô tả">
                <textarea className="input resize-none h-20" value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </Field>
              <Field label="Trạng thái">
                <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="active">Đang bán</option>
                  <option value="inactive">Ẩn</option>
                </select>
              </Field>
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
              <button className="btn-secondary flex-1" onClick={closeForm}>Hủy</button>
              <button className="btn-primary flex-1" onClick={save} disabled={saving || uploading}>
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BrandCombobox({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const q = (value || '').trim().toLowerCase();
  const filtered = q
    ? options.filter(b => b.toLowerCase().includes(q))
    : options;
  // Ẩn gợi ý nếu giá trị đang gõ trùng khít với 1 thương hiệu đã có
  const exactMatch = options.some(b => b.toLowerCase() === q);

  return (
    <div className="relative">
      <input
        className="input"
        placeholder="Chọn hoặc nhập thương hiệu..."
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && filtered.length > 0 && !(exactMatch && filtered.length === 1) && (
        <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto py-1">
          {filtered.map(b => (
            <li key={b}>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => { onChange(b); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                  b.toLowerCase() === q ? 'text-primary-700 font-medium' : 'text-gray-700'
                }`}
              >
                {b}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProductThumb({ url, size = 40 }) {
  const [err, setErr] = useState(false);
  const firstUrl = url ? url.split(',')[0].trim() : '';
  if (!firstUrl || err) {
    return (
      <div style={{ width: size, height: size }}
        className="rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
        <ImageOff size={size * 0.4} className="text-gray-300" />
      </div>
    );
  }
  return (
    <img src={firstUrl} alt="" onError={() => setErr(true)}
      style={{ width: size, height: size }}
      className="rounded-lg object-cover shrink-0 border border-gray-100" />
  );
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = (e) => resolve(e.target.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function Field({ label, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
