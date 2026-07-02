// ─── Dashboard ───────────────────────────────────────────────────────────────

function getDashboard() {
  const orders   = sheetToObjects(getSheet('Orders'));
  const products = sheetToObjects(getSheet('Products'));
  const imports  = sheetToObjects(getSheet('StockImports'));

  const now        = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart  = new Date(now.getFullYear(), 0, 1);

  const inRange  = (arr, from) => arr.filter(o => new Date(o.order_date || o.import_date) >= from);
  const sumField = (arr, field) => arr.reduce((s, o) => s + (Number(o[field]) || 0), 0);

  const todayOrders = inRange(orders, todayStart);
  const monthOrders = inRange(orders, monthStart);
  const yearOrders  = inRange(orders, yearStart);

  // Gross profit estimation: final_amount - sum of (cost_price * qty) per order
  // We approximate using product current cost_price since we don't store cost snapshot
  const productMap = {};
  products.forEach(p => { productMap[p.product_id] = p; });

  const orderItems = sheetToObjects(getSheet('OrderItems'));
  const itemsByOrder = {};
  orderItems.forEach(i => {
    if (!itemsByOrder[i.order_id]) itemsByOrder[i.order_id] = [];
    itemsByOrder[i.order_id].push(i);
  });

  let monthProfit = 0;
  monthOrders.forEach(o => {
    const items = itemsByOrder[o.order_id] || [];
    items.forEach(i => {
      const p = productMap[i.product_id];
      const cost = p ? Number(p.cost_price) : 0;
      monthProfit += (Number(i.unit_price) - cost) * (Number(i.quantity) || 0);
    });
  });

  // Low stock: stock_qty <= 0
  const lowStock = products
    .filter(p => Number(p.stock_qty) <= 0 && p.status !== 'inactive')
    .map(p => ({ product_id: p.product_id, name: p.name, stock_qty: Number(p.stock_qty) || 0 }));

  // Top 5 products by month revenue
  const productRevenue = {};
  monthOrders.forEach(o => {
    (itemsByOrder[o.order_id] || []).forEach(i => {
      if (!productRevenue[i.product_id]) productRevenue[i.product_id] = 0;
      productRevenue[i.product_id] += Number(i.subtotal) || 0;
    });
  });
  const topProducts = Object.entries(productRevenue)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([id, revenue]) => {
      const p = productMap[id];
      return { product_id: id, name: p ? p.name : id, revenue };
    });

  // Inventory value (cost)
  const inventoryValue = products.reduce(
    (s, p) => s + (Number(p.stock_qty) || 0) * (Number(p.cost_price) || 0), 0
  );

  // Recent orders (last 10)
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.order_date) - new Date(a.order_date))
    .slice(0, 10)
    .map(o => ({
      ...o,
      total_amount: Number(o.total_amount) || 0,
      discount:     Number(o.discount)     || 0,
      final_amount: Number(o.final_amount) || 0,
    }));

  return {
    success: true,
    data: {
      revenue: {
        today: sumField(todayOrders, 'final_amount'),
        month: sumField(monthOrders, 'final_amount'),
        year:  sumField(yearOrders,  'final_amount'),
      },
      profit: {
        month: monthProfit,
      },
      orders: {
        today:        todayOrders.length,
        month:        monthOrders.length,
        month_unpaid: monthOrders.filter(o => o.payment_status !== 'paid').length,
      },
      imports: {
        month:      inRange(imports, monthStart).length,
        month_cost: sumField(inRange(imports, monthStart), 'total_cost'),
      },
      inventory: {
        total_products: products.length,
        active:         products.filter(p => p.status === 'active').length,
        in_stock:       products.filter(p => Number(p.stock_qty) > 0).length,
        low_stock_count: lowStock.length,
        inventory_value: inventoryValue,
      },
      low_stock:       lowStock,
      top_products:    topProducts,
      recent_orders:   recentOrders,
    }
  };
}

// ─── Reports ─────────────────────────────────────────────────────────────────

function getReport(params) {
  const now  = new Date();
  const from = params.from_date ? new Date(params.from_date) : new Date(now.getFullYear(), now.getMonth(), 1);
  const to   = params.to_date   ? new Date(params.to_date)   : new Date();
  to.setHours(23, 59, 59, 999);

  const orders   = sheetToObjects(getSheet('Orders'));
  const products = sheetToObjects(getSheet('Products'));
  const imports  = sheetToObjects(getSheet('StockImports'));

  const productMap = {};
  products.forEach(p => { productMap[p.product_id] = p; });

  const filteredOrders  = orders.filter(o => { const d = new Date(o.order_date);  return d >= from && d <= to; });
  const filteredImports = imports.filter(i => { const d = new Date(i.import_date); return d >= from && d <= to; });

  const orderItems = sheetToObjects(getSheet('OrderItems'));
  const filteredOrderIds = new Set(filteredOrders.map(o => String(o.order_id)));
  const filteredItems = orderItems.filter(i => filteredOrderIds.has(String(i.order_id)));

  // Revenue by day
  const revenueByDay = {};
  filteredOrders.forEach(o => {
    const day = String(o.order_date || '').substring(0, 10);
    if (!revenueByDay[day]) revenueByDay[day] = 0;
    revenueByDay[day] += Number(o.final_amount) || 0;
  });

  // Gross profit & sales by product
  let grossProfit = 0;
  const salesByProduct = {};
  filteredItems.forEach(i => {
    const p = productMap[i.product_id];
    const cost = p ? Number(p.cost_price) : 0;
    const qty  = Number(i.quantity) || 0;
    const rev  = Number(i.subtotal) || 0;
    const prof = (Number(i.unit_price) - cost) * qty;
    grossProfit += prof;

    if (!salesByProduct[i.product_id]) {
      salesByProduct[i.product_id] = { product_id: i.product_id, name: p ? p.name : i.product_id, qty: 0, revenue: 0, profit: 0 };
    }
    salesByProduct[i.product_id].qty     += qty;
    salesByProduct[i.product_id].revenue += rev;
    salesByProduct[i.product_id].profit  += prof;
  });

  const inventoryValue = products.reduce(
    (s, p) => s + (Number(p.stock_qty) || 0) * (Number(p.cost_price) || 0), 0
  );

  return {
    success: true,
    data: {
      period:           { from: from.toISOString(), to: to.toISOString() },
      total_revenue:    filteredOrders.reduce((s, o) => s + (Number(o.final_amount) || 0), 0),
      total_import_cost: filteredImports.reduce((s, i) => s + (Number(i.total_cost) || 0), 0),
      gross_profit:     grossProfit,
      orders_count:     filteredOrders.length,
      imports_count:    filteredImports.length,
      revenue_by_day:   Object.entries(revenueByDay).map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date)),
      sales_by_product: Object.values(salesByProduct).sort((a, b) => b.revenue - a.revenue),
      inventory_value:  inventoryValue,
    }
  };
}

// ─── Dropdowns ───────────────────────────────────────────────────────────────
// Sheet: Sheet2 — Columns: category, sub_category, brand, condition

function getDropdowns() {
  const sheet = getSheet('Sheet2');
  const data  = sheet.getDataRange().getValues();
  if (data.length < 1) return { success: true, data: {} };

  const headers = data[0];
  const result  = {};
  headers.forEach((h, i) => {
    if (!h) return;
    result[h] = data.slice(1).map(row => row[i]).filter(v => v !== '' && v !== null && v !== undefined);
  });
  return { success: true, data: result };
}
