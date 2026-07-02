import { useEffect, useState, useCallback } from 'react';
import { customersApi, fmt } from '../lib/api';
import { Plus, Search, Pencil, Trash2, X, AlertCircle, Phone, Mail } from 'lucide-react';

const EMPTY = { customer_id: '', name: '', phone: '', email: '', address: '', notes: '' };

export default function Customers() {
  const [list, setList]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]       = useState(EMPTY);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = search ? { search } : {};
      const r = await customersApi.list(params);
      setList(r.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const openNew  = () => { setForm(EMPTY); setShowForm(true); setError(''); };
  const openEdit = (c) => { setForm(c); setShowForm(true); setError(''); };
  const close    = () => { setShowForm(false); setError(''); };

  const save = async () => {
    if (!form.name) return setError('Vui lòng nhập tên khách hàng');
    setSaving(true); setError('');
    try {
      if (form.customer_id) await customersApi.update(form);
      else await customersApi.create(form);
      close(); load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const remove = async (c) => {
    if (!confirm(`Xóa khách hàng "${c.name}"?`)) return;
    try { await customersApi.delete(c.customer_id); load(); }
    catch (e) { alert(e.message); }
  };

  const f = (k) => e => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Khách hàng</h1>
        <button className="btn-primary" onClick={openNew}><Plus size={16} /> Thêm mới</button>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-9" placeholder="Tìm theo tên, SĐT..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : list.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">Chưa có khách hàng nào</div>
      ) : (
        <div className="space-y-2">
          {list.map(c => (
            <div key={c.customer_id} className="card !p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{c.name}</p>
                <div className="flex flex-wrap gap-3 mt-1">
                  {c.phone && <span className="flex items-center gap-1 text-xs text-gray-500"><Phone size={11} />{c.phone}</span>}
                  {c.email && <span className="flex items-center gap-1 text-xs text-gray-500"><Mail size={11} />{c.email}</span>}
                </div>
                {c.address && <p className="text-xs text-gray-400 mt-0.5 truncate">{c.address}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => openEdit(c)} className="btn-ghost !p-2"><Pencil size={15} /></button>
                <button onClick={() => remove(c)} className="btn-ghost !p-2 text-red-500"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{form.customer_id ? 'Cập nhật khách hàng' : 'Thêm khách hàng'}</h2>
              <button onClick={close} className="btn-ghost !p-2"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {error && <div className="flex gap-2 items-start p-3 bg-red-50 rounded-lg text-red-700 text-sm"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</div>}
              <div><label className="label">Tên *</label><input className="input" value={form.name} onChange={f('name')} /></div>
              <div><label className="label">Số điện thoại</label><input className="input" type="tel" value={form.phone} onChange={f('phone')} /></div>
              <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={f('email')} /></div>
              <div><label className="label">Địa chỉ</label><input className="input" value={form.address} onChange={f('address')} /></div>
              <div><label className="label">Ghi chú</label><textarea className="input resize-none h-16" value={form.notes} onChange={f('notes')} /></div>
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-gray-100">
              <button className="btn-secondary flex-1" onClick={close}>Hủy</button>
              <button className="btn-primary flex-1" onClick={save} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
