import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi, fmt } from '../lib/api';
import {
  TrendingUp, ShoppingCart, Package, AlertTriangle,
  ArrowRight, PackagePlus, Wallet,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function StatCard({ label, value, sub, icon: Icon, color }) {
  return (
    <div className="card flex items-start gap-3">
      <div className={`p-2.5 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-gray-900 mt-0.5 truncate">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    dashboardApi.get()
      .then(r => setData(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton />;
  if (error)   return <div className="card text-red-600 text-sm">Lỗi: {error}</div>;
  if (!data)   return null;

  const { revenue, orders, profit, inventory, low_stock, top_products, recent_orders } = data;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Tổng quan</h1>
        <p className="text-sm text-gray-500">Cập nhật theo thời gian thực</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Doanh thu hôm nay" value={fmt.currency(revenue.today)}
          sub={`${orders.today} đơn`} icon={TrendingUp} color="bg-primary-700" />
        <StatCard label="Doanh thu tháng" value={fmt.currency(revenue.month)}
          sub={`${orders.month} đơn`} icon={ShoppingCart} color="bg-green-600" />
        <StatCard label="Lãi gộp tháng" value={fmt.currency(profit.month)}
          icon={Wallet} color="bg-amber-500" />
        <StatCard label="Giá trị tồn kho" value={fmt.currency(inventory.inventory_value)}
          sub={`${inventory.in_stock}/${inventory.total_products} SP còn hàng`}
          icon={Package} color="bg-purple-600" />
      </div>

      {/* Low stock alert */}
      {low_stock?.length > 0 && (
        <div className="card border-l-4 border-l-amber-400 bg-amber-50 !p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-amber-600" />
            <span className="text-sm font-semibold text-amber-800">
              {low_stock.length} sản phẩm hết hàng
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {low_stock.slice(0, 5).map(p => (
              <span key={p.product_id} className="badge-yellow text-xs">{p.name}</span>
            ))}
            {low_stock.length > 5 && (
              <Link to="/products?low_stock=true" className="text-xs text-amber-700 underline">
                +{low_stock.length - 5} khác
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Top products */}
        {top_products?.length > 0 && (
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Top sản phẩm tháng này</h2>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top_products} layout="vertical" margin={{ left: 0, right: 12 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={100}
                    tick={{ fontSize: 11 }} tickFormatter={s => s.length > 14 ? s.slice(0,14)+'…' : s} />
                  <Tooltip formatter={v => fmt.currency(v)} labelStyle={{ fontSize: 12 }} />
                  <Bar dataKey="revenue" fill="#1d4ed8" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Recent orders */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Đơn hàng gần đây</h2>
            <Link to="/orders" className="text-xs text-primary-700 flex items-center gap-1 hover:underline">
              Xem tất cả <ArrowRight size={12} />
            </Link>
          </div>
          {recent_orders?.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Chưa có đơn hàng</p>
          ) : (
            <div className="space-y-2">
              {recent_orders?.slice(0, 6).map(o => (
                <div key={o.order_id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{o.customer_name || 'Khách lẻ'}</p>
                    <p className="text-xs text-gray-400">{fmt.shortDate(o.order_date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{fmt.currency(o.final_amount)}</p>
                    <span className={o.payment_status === 'paid' ? 'badge-green' : 'badge-yellow'}>
                      {o.payment_status === 'paid' ? 'Đã TT' : 'Chưa TT'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/orders/new" className="card flex items-center gap-3 hover:border-primary-300 hover:shadow-md transition-all cursor-pointer !p-3">
          <ShoppingCart size={20} className="text-primary-700" />
          <span className="text-sm font-medium">Tạo đơn bán</span>
        </Link>
        <Link to="/imports/new" className="card flex items-center gap-3 hover:border-primary-300 hover:shadow-md transition-all cursor-pointer !p-3">
          <PackagePlus size={20} className="text-green-600" />
          <span className="text-sm font-medium">Nhập hàng</span>
        </Link>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-32" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="h-52 bg-gray-200 rounded-xl" />
        <div className="h-52 bg-gray-200 rounded-xl" />
      </div>
    </div>
  );
}
