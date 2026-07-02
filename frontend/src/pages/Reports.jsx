import { useEffect, useState } from 'react';
import { dashboardApi, fmt } from '../lib/api';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Package, ShoppingCart } from 'lucide-react';

function today() { return new Date().toISOString().split('T')[0]; }
function firstOfMonth() {
  const d = new Date(); d.setDate(1);
  return d.toISOString().split('T')[0];
}

export default function Reports() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo]     = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await dashboardApi.report({ from_date: from, to_date: to });
      setData(r.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [from, to]);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Báo cáo</h1>

      {/* Date filter */}
      <div className="card !p-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="label text-xs">Từ ngày</label>
          <input type="date" className="input text-sm" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label text-xs">Đến ngày</label>
          <input type="date" className="input text-sm" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {[
            { label: 'Hôm nay', f: today(), t: today() },
            { label: 'Tháng này', f: firstOfMonth(), t: today() },
          ].map(({ label, f, t }) => (
            <button key={label}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${from === f && to === t ? 'bg-primary-700 text-white border-primary-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              onClick={() => { setFrom(f); setTo(t); }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}</div>
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      ) : data && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Doanh thu" value={fmt.currency(data.total_revenue)} icon={TrendingUp} color="text-primary-700 bg-primary-50" />
            <KpiCard label="Lãi gộp" value={fmt.currency(data.gross_profit)} icon={TrendingUp} color="text-green-700 bg-green-50" />
            <KpiCard label="Chi phí nhập" value={fmt.currency(data.total_import_cost)} icon={TrendingDown} color="text-amber-700 bg-amber-50" />
            <KpiCard label="Giá trị tồn" value={fmt.currency(data.inventory_value)} icon={Package} color="text-purple-700 bg-purple-50" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="card text-center !py-3">
              <p className="text-2xl font-bold text-gray-900">{data.orders_count}</p>
              <p className="text-xs text-gray-500 mt-0.5">Đơn bán</p>
            </div>
            <div className="card text-center !py-3">
              <p className="text-2xl font-bold text-gray-900">{data.imports_count}</p>
              <p className="text-xs text-gray-500 mt-0.5">Phiếu nhập</p>
            </div>
            <div className="card text-center !py-3">
              <p className="text-2xl font-bold text-gray-900">{data.in_stock_count}</p>
              <p className="text-xs text-gray-500 mt-0.5">SP còn hàng</p>
            </div>
            <div className="card text-center !py-3">
              <p className="text-2xl font-bold text-gray-900">
                {data.total_revenue > 0 ? Math.round(data.gross_profit / data.total_revenue * 100) : 0}%
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Biên lợi nhuận</p>
            </div>
          </div>

          {/* Revenue chart */}
          {data.revenue_by_day?.length > 0 && (
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Doanh thu theo ngày</h2>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.revenue_by_day} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => (v / 1e6).toFixed(0) + 'M'} />
                    <Tooltip formatter={v => fmt.currency(v)} labelStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="amount" stroke="#1d4ed8" strokeWidth={2} fill="url(#grad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Top products table */}
          {data.sales_by_product?.length > 0 && (
            <div className="card !p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700">Top sản phẩm bán chạy</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {data.sales_by_product.slice(0, 8).map((p, i) => (
                  <div key={p.product_id} className="flex items-center gap-3 px-4 py-3">
                    <span className="text-xs font-bold text-gray-400 w-5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                      <p className="text-xs text-gray-500">Số lượng: {p.qty}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{fmt.currency(p.revenue)}</p>
                      <p className="text-xs text-green-600">+{fmt.currency(p.profit)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, color }) {
  return (
    <div className="card">
      <div className={`inline-flex p-2 rounded-lg ${color} mb-2`}>
        <Icon size={16} />
      </div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-base font-bold text-gray-900 mt-0.5 truncate">{value}</p>
    </div>
  );
}
