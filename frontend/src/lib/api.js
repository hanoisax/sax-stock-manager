import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Ném lỗi giống GAS (data.error) để các trang bắt e.message như cũ
function check(error) { if (error) throw new Error(error.message || 'API error'); }

// ─── Products ────────────────────────────────────────────────────────────────
export const productsApi = {
  list: async (params = {}) => {
    let q = supabase.from('products').select('*');
    if (params.type)   q = q.eq('type', params.type);
    if (params.brand)  q = q.eq('brand', params.brand);
    if (params.status) q = q.eq('status', params.status);
    if (params.search) {
      const s = params.search.replace(/[%,]/g, ' ');
      q = q.or(`name.ilike.%${s}%,product_id.ilike.%${s}%,brand.ilike.%${s}%`);
    }
    if (params.low_stock === 'true') q = q.lte('stock_qty', 0);
    if (params.in_stock  === 'true') q = q.gt('stock_qty', 0);
    const { data, error } = await q.order('created_at', { ascending: false });
    check(error);
    return { data, total: data.length };
  },
  get: async (id) => {
    const { data, error } = await supabase.from('products').select('*').eq('product_id', id).single();
    check(error);
    return { data };
  },
  create: async (body) => {
    const row = { ...body };
    if (!row.product_id) row.product_id = genId('PRD');
    const { data, error } = await supabase.from('products').insert(row).select('product_id').single();
    check(error);
    return { data };
  },
  update: async (body) => {
    const { product_id, ...fields } = body;
    const { error } = await supabase.from('products').update(fields).eq('product_id', product_id);
    check(error);
    return { success: true };
  },
  delete: async (id) => {
    const { error } = await supabase.from('products').delete().eq('product_id', id);
    check(error);
    return { success: true };
  },
};

// ─── Customers ───────────────────────────────────────────────────────────────
export const customersApi = {
  list: async (params = {}) => {
    let q = supabase.from('customers').select('*');
    if (params.search) {
      const s = params.search.replace(/[%,]/g, ' ');
      q = q.or(`name.ilike.%${s}%,phone.ilike.%${s}%,customer_id.ilike.%${s}%`);
    }
    const { data, error } = await q.order('created_at', { ascending: false });
    check(error);
    return { data, total: data.length };
  },
  create: async (body) => {
    const id = body.customer_id || genId('CUS');
    const { error } = await supabase.from('customers').insert({ ...body, customer_id: id });
    check(error);
    return { data: { customer_id: id } };
  },
  update: async (body) => {
    const { customer_id, ...fields } = body;
    const { error } = await supabase.from('customers').update(fields).eq('customer_id', customer_id);
    check(error);
    return { success: true };
  },
  delete: async (id) => {
    const { error } = await supabase.from('customers').delete().eq('customer_id', id);
    check(error);
    return { success: true };
  },
};

// ─── Orders ──────────────────────────────────────────────────────────────────
export const ordersApi = {
  list: async (params = {}) => {
    let q = supabase.from('orders').select('*', { count: 'exact' });
    if (params.customer_id)    q = q.eq('customer_id', params.customer_id);
    if (params.payment_status) q = q.eq('payment_status', params.payment_status);
    if (params.from_date)      q = q.gte('order_date', params.from_date);
    if (params.to_date)        q = q.lte('order_date', endOfDay(params.to_date));
    q = q.order('order_date', { ascending: false });
    if (params.page || params.page_size) {
      const page = parseInt(params.page) || 1;
      const size = parseInt(params.page_size) || 50;
      q = q.range((page - 1) * size, page * size - 1);
    }
    const { data, error, count } = await q;
    check(error);
    return { data, total: count ?? data.length };
  },
  get: async (id) => {
    const [{ data: order, error: e1 }, { data: items, error: e2 }] = await Promise.all([
      supabase.from('orders').select('*').eq('order_id', id).single(),
      supabase.from('order_items').select('*').eq('order_id', id),
    ]);
    check(e1); check(e2);
    return { data: { ...order, items: items || [] } };
  },
  create: async (body) => {
    const { items, ...order } = body;
    const { data, error } = await supabase.rpc('create_order', { p_order: order, p_items: items });
    check(error);
    return { data };
  },
  updateStatus: async (body) => {
    const { order_id, ...fields } = body;
    const { error } = await supabase.from('orders').update(fields).eq('order_id', order_id);
    check(error);
    return { success: true };
  },
  delete: async (id) => {
    const { error } = await supabase.rpc('delete_order', { p_id: id });
    check(error);
    return { success: true };
  },
};

// ─── Stock Imports ────────────────────────────────────────────────────────────
export const importsApi = {
  list: async (params = {}) => {
    let q = supabase.from('stock_imports').select('*');
    if (params.supplier)  q = q.ilike('supplier', `%${params.supplier}%`);
    if (params.from_date) q = q.gte('import_date', params.from_date);
    if (params.to_date)   q = q.lte('import_date', endOfDay(params.to_date));
    const { data, error } = await q.order('import_date', { ascending: false });
    check(error);
    return { data, total: data.length };
  },
  get: async (id) => {
    const [{ data: imp, error: e1 }, { data: items, error: e2 }] = await Promise.all([
      supabase.from('stock_imports').select('*').eq('import_id', id).single(),
      supabase.from('import_items').select('*').eq('import_id', id),
    ]);
    check(e1); check(e2);
    return { data: { ...imp, items: items || [] } };
  },
  create: async (body) => {
    const { items, ...imp } = body;
    const { data, error } = await supabase.rpc('create_import', { p_import: imp, p_items: items });
    check(error);
    return { data };
  },
  update: async (body) => {
    const { items, ...imp } = body;
    const { data, error } = await supabase.rpc('update_import', { p_import: imp, p_items: items });
    check(error);
    return { data };
  },
  delete: async (id) => {
    const { error } = await supabase.rpc('delete_import', { p_id: id });
    check(error);
    return { success: true };
  },
};

// ─── Stock Takes (Kiểm kho) ────────────────────────────────────────────────────
export const stockTakesApi = {
  list: async (params = {}) => {
    let q = supabase.from('stock_takes').select('*');
    if (params.from_date) q = q.gte('take_date', params.from_date);
    if (params.to_date)   q = q.lte('take_date', endOfDay(params.to_date));
    const { data, error } = await q.order('take_date', { ascending: false });
    check(error);
    return { data, total: data.length };
  },
  get: async (id) => {
    const [{ data: t, error: e1 }, { data: items, error: e2 }] = await Promise.all([
      supabase.from('stock_takes').select('*').eq('stocktake_id', id).single(),
      supabase.from('stock_take_items').select('*').eq('stocktake_id', id),
    ]);
    check(e1); check(e2);
    return { data: { ...t, items: items || [] } };
  },
  create: async (body) => {
    const { items, ...take } = body;
    const { data, error } = await supabase.rpc('create_stock_take', { p_take: take, p_items: items });
    check(error);
    return { data };
  },
  delete: async (id) => {
    const { error } = await supabase.rpc('delete_stock_take', { p_id: id });
    check(error);
    return { success: true };
  },
};

// ─── Images (Cloudinary — unsigned upload preset) ──────────────────────────────
const CLOUDINARY_CLOUD  = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export const imagesApi = {
  upload: async ({ data, mimeType, filename }) => {
    if (!CLOUDINARY_CLOUD || !CLOUDINARY_PRESET)
      throw new Error('Thiếu cấu hình Cloudinary (VITE_CLOUDINARY_CLOUD_NAME / VITE_CLOUDINARY_UPLOAD_PRESET)');

    const dataUri = `data:${mimeType || 'image/jpeg'};base64,${data}`;
    const body = new FormData();
    body.append('file', dataUri);
    body.append('upload_preset', CLOUDINARY_PRESET);
    body.append('folder', 'products');

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
      { method: 'POST', body }
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message || 'Upload Cloudinary thất bại');
    return { data: { url: json.secure_url } };
  },
};

// ─── Dashboard & Reports (tính phía client, giống logic GAS) ───────────────────
export const dashboardApi = {
  get: async () => {
    const [{ data: orders }, { data: products }, { data: imports }, { data: orderItems }] =
      await Promise.all([
        supabase.from('orders').select('*'),
        supabase.from('products').select('*'),
        supabase.from('stock_imports').select('*'),
        supabase.from('order_items').select('*'),
      ]);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart  = new Date(now.getFullYear(), 0, 1);
    const inRange  = (arr, from, f) => arr.filter(o => new Date(o[f]) >= from);
    const sumF     = (arr, k) => arr.reduce((s, o) => s + (Number(o[k]) || 0), 0);

    const todayOrders = inRange(orders, todayStart, 'order_date');
    const monthOrders = inRange(orders, monthStart, 'order_date');
    const yearOrders  = inRange(orders, yearStart,  'order_date');

    const productMap = {}; products.forEach(p => { productMap[p.product_id] = p; });
    const itemsByOrder = {};
    orderItems.forEach(i => { (itemsByOrder[i.order_id] ||= []).push(i); });

    let monthProfit = 0;
    monthOrders.forEach(o => (itemsByOrder[o.order_id] || []).forEach(i => {
      const cost = productMap[i.product_id] ? Number(productMap[i.product_id].cost_price) : 0;
      monthProfit += (Number(i.unit_price) - cost) * (Number(i.quantity) || 0);
    }));

    const lowStock = products
      .filter(p => Number(p.stock_qty) <= 0 && p.status !== 'inactive')
      .map(p => ({ product_id: p.product_id, name: p.name, stock_qty: Number(p.stock_qty) || 0 }));

    const productRevenue = {};
    monthOrders.forEach(o => (itemsByOrder[o.order_id] || []).forEach(i => {
      productRevenue[i.product_id] = (productRevenue[i.product_id] || 0) + (Number(i.subtotal) || 0);
    }));
    const topProducts = Object.entries(productRevenue)
      .sort(([, a], [, b]) => b - a).slice(0, 5)
      .map(([id, revenue]) => ({ product_id: id, name: productMap[id]?.name || id, revenue }));

    const inventoryValue = products.reduce(
      (s, p) => s + (Number(p.stock_qty) || 0) * (Number(p.cost_price) || 0), 0);

    const recentOrders = [...orders]
      .sort((a, b) => new Date(b.order_date) - new Date(a.order_date)).slice(0, 10);

    return { data: {
      revenue: { today: sumF(todayOrders, 'final_amount'), month: sumF(monthOrders, 'final_amount'), year: sumF(yearOrders, 'final_amount') },
      profit:  { month: monthProfit },
      orders:  { today: todayOrders.length, month: monthOrders.length, month_unpaid: monthOrders.filter(o => o.payment_status !== 'paid').length },
      imports: { month: inRange(imports, monthStart, 'import_date').length, month_cost: sumF(inRange(imports, monthStart, 'import_date'), 'total_cost') },
      inventory: {
        total_products: products.length,
        active:   products.filter(p => p.status === 'active').length,
        in_stock: products.filter(p => Number(p.stock_qty) > 0).length,
        low_stock_count: lowStock.length,
        inventory_value: inventoryValue,
      },
      low_stock: lowStock, top_products: topProducts, recent_orders: recentOrders,
    }};
  },

  report: async (params = {}) => {
    const now  = new Date();
    const from = params.from_date ? new Date(params.from_date) : new Date(now.getFullYear(), now.getMonth(), 1);
    const to   = params.to_date   ? new Date(endOfDay(params.to_date)) : new Date();

    const [{ data: orders }, { data: products }, { data: imports }, { data: orderItems }] =
      await Promise.all([
        supabase.from('orders').select('*'),
        supabase.from('products').select('*'),
        supabase.from('stock_imports').select('*'),
        supabase.from('order_items').select('*'),
      ]);

    const productMap = {}; products.forEach(p => { productMap[p.product_id] = p; });
    const fOrders  = orders.filter(o => { const d = new Date(o.order_date);  return d >= from && d <= to; });
    const fImports = imports.filter(i => { const d = new Date(i.import_date); return d >= from && d <= to; });
    const fIds   = new Set(fOrders.map(o => String(o.order_id)));
    const fItems = orderItems.filter(i => fIds.has(String(i.order_id)));

    const revenueByDay = {};
    fOrders.forEach(o => {
      const day = String(o.order_date || '').substring(0, 10);
      revenueByDay[day] = (revenueByDay[day] || 0) + (Number(o.final_amount) || 0);
    });

    let grossProfit = 0;
    const salesByProduct = {};
    fItems.forEach(i => {
      const cost = productMap[i.product_id] ? Number(productMap[i.product_id].cost_price) : 0;
      const qty = Number(i.quantity) || 0, rev = Number(i.subtotal) || 0;
      const prof = (Number(i.unit_price) - cost) * qty;
      grossProfit += prof;
      const sp = (salesByProduct[i.product_id] ||= { product_id: i.product_id, name: productMap[i.product_id]?.name || i.product_id, qty: 0, revenue: 0, profit: 0 });
      sp.qty += qty; sp.revenue += rev; sp.profit += prof;
    });

    const inventoryValue = products.reduce((s, p) => s + (Number(p.stock_qty) || 0) * (Number(p.cost_price) || 0), 0);

    return { data: {
      period: { from: from.toISOString(), to: to.toISOString() },
      total_revenue:     fOrders.reduce((s, o) => s + (Number(o.final_amount) || 0), 0),
      total_import_cost: fImports.reduce((s, i) => s + (Number(i.total_cost) || 0), 0),
      gross_profit:  grossProfit,
      orders_count:  fOrders.length,
      imports_count: fImports.length,
      revenue_by_day: Object.entries(revenueByDay).map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date)),
      sales_by_product: Object.values(salesByProduct).sort((a, b) => b.revenue - a.revenue),
      inventory_value: inventoryValue,
    }};
  },
};

// ─── Dropdowns & Config ───────────────────────────────────────────────────────
export const metaApi = {
  dropdowns: async () => {
    const { data, error } = await supabase.from('products').select('brand');
    check(error);
    const brand = [...new Set(data.map(p => p.brand).filter(Boolean))].sort();
    return { data: {
      brand,
      condition: ['Mới', 'Like new', 'Cũ'],
      category:  ['Kèn', 'Phụ kiện'],
    }};
  },
  config: async () => {
    const { data, error } = await supabase.from('config').select('*');
    check(error);
    const cfg = {}; (data || []).forEach(r => { cfg[r.key] = r.value; });
    return { data: cfg };
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function genId(prefix) {
  return prefix + Date.now().toString(36).toUpperCase()
    + Math.random().toString(36).substring(2, 5).toUpperCase();
}
function endOfDay(d) {
  const x = new Date(d); x.setHours(23, 59, 59, 999); return x.toISOString();
}

export const fmt = {
  currency: (n) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0),
  number:   (n) => new Intl.NumberFormat('vi-VN').format(n || 0),
  date:     (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—',
  datetime: (d) => d ? new Date(d).toLocaleString('vi-VN') : '—',
  shortDate:(d) => d ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '—',
};
