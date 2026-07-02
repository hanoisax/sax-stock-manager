// ─── Customers ───────────────────────────────────────────────────────────────
// Sheet: Customers
// Columns: customer_id, name, phone, email, address, notes, created_at

function getCustomers(params) {
  let list = sheetToObjects(getSheet('Customers'));
  if (params.search) {
    const q = params.search.toLowerCase();
    list = list.filter(c =>
      String(c.name).toLowerCase().includes(q) ||
      String(c.phone).includes(q) ||
      String(c.customer_id).toLowerCase().includes(q)
    );
  }
  return { success: true, data: list, total: list.length };
}

function createCustomer(body) {
  if (!body.name) return { success: false, error: 'name is required' };
  const id = body.customer_id || generateId('CUS');
  appendRow(getSheet('Customers'), {
    customer_id: id,
    name:        body.name || '',
    phone:       body.phone || '',
    email:       body.email || '',
    address:     body.address || '',
    notes:       body.notes || '',
    created_at:  new Date().toISOString(),
  });
  return { success: true, data: { customer_id: id } };
}

function updateCustomer(body) {
  if (!body.customer_id) return { success: false, error: 'customer_id is required' };
  const fields = {};
  Object.keys(body).forEach(k => { fields[k.toLowerCase().trim()] = body[k]; });
  const ok = updateFieldsInRow(getSheet('Customers'), 'customer_id', body.customer_id, fields);
  return ok ? { success: true } : { success: false, error: 'Customer not found' };
}

function deleteCustomer(id) {
  if (!id) return { success: false, error: 'Missing id' };
  const sheet = getSheet('Customers');
  const row = findRow(sheet, 'customer_id', id);
  if (row === -1) return { success: false, error: 'Customer not found' };
  sheet.deleteRow(row);
  return { success: true };
}

// ─── Orders (Sales) ───────────────────────────────────────────────────────────
// Orders:     order_id, customer_id, customer_name, order_date, total_amount,
//             discount, final_amount, payment_method, payment_status, notes, created_by
// OrderItems: item_id, order_id, product_id, product_name, quantity, unit_price, subtotal

function getOrders(params) {
  let orders = sheetToObjects(getSheet('Orders'));

  if (params.customer_id)     orders = orders.filter(o => String(o.customer_id) === params.customer_id);
  if (params.payment_status)  orders = orders.filter(o => o.payment_status === params.payment_status);
  if (params.from_date) {
    const from = new Date(params.from_date);
    orders = orders.filter(o => new Date(o.order_date) >= from);
  }
  if (params.to_date) {
    const to = new Date(params.to_date);
    to.setHours(23, 59, 59, 999);
    orders = orders.filter(o => new Date(o.order_date) <= to);
  }

  orders.sort((a, b) => new Date(b.order_date) - new Date(a.order_date));
  orders = orders.map(o => ({
    ...o,
    total_amount: Number(o.total_amount) || 0,
    discount:     Number(o.discount)     || 0,
    final_amount: Number(o.final_amount) || 0,
  }));

  const page     = parseInt(params.page)      || 1;
  const pageSize = parseInt(params.page_size) || 50;
  const total    = orders.length;
  if (params.page || params.page_size) {
    orders = orders.slice((page - 1) * pageSize, page * pageSize);
  }

  return { success: true, data: orders, total, page, page_size: pageSize };
}

function getOrder(id) {
  if (!id) return { success: false, error: 'Missing id' };
  const orders = sheetToObjects(getSheet('Orders'));
  const order  = orders.find(o => String(o.order_id) === String(id));
  if (!order) return { success: false, error: 'Order not found' };

  const items = sheetToObjects(getSheet('OrderItems'))
    .filter(i => String(i.order_id) === String(id))
    .map(i => ({
      ...i,
      quantity:   Number(i.quantity)   || 0,
      unit_price: Number(i.unit_price) || 0,
      subtotal:   Number(i.subtotal)   || 0,
    }));

  return {
    success: true,
    data: {
      ...order,
      total_amount: Number(order.total_amount) || 0,
      discount:     Number(order.discount)     || 0,
      final_amount: Number(order.final_amount) || 0,
      items,
    }
  };
}

function createOrder(body) {
  if (!body.items || !body.items.length) {
    return { success: false, error: 'items array is required and must not be empty' };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    // Validate & calculate totals
    let totalAmount = 0;
    const enrichedItems = [];

    for (const item of body.items) {
      const productResult = getProduct(item.product_id);
      if (!productResult.success) return { success: false, error: `Product not found: ${item.product_id}` };
      const product = productResult.data;

      const qty = Number(item.quantity) || 0;
      if (qty <= 0) return { success: false, error: `Invalid quantity for ${item.product_id}` };
      if (product.stock_qty < qty) {
        return {
          success: false,
          error: `Không đủ hàng "${product.name}". Tồn: ${product.stock_qty}, cần: ${qty}`
        };
      }

      const unitPrice = Number(item.unit_price) || product.sell_price;
      const subtotal  = qty * unitPrice;
      totalAmount += subtotal;
      enrichedItems.push({ ...item, product_name: product.name, quantity: qty, unit_price: unitPrice, subtotal });
    }

    const discount    = Number(body.discount) || 0;
    const finalAmount = totalAmount - discount;
    const orderId     = generateId('ORD');
    const now         = new Date().toISOString();

    // Write order
    appendRow(getSheet('Orders'), {
      order_id:       orderId,
      customer_id:    body.customer_id    || '',
      customer_name:  body.customer_name  || '',
      order_date:     body.order_date     || now,
      total_amount:   totalAmount,
      discount:       discount,
      final_amount:   finalAmount,
      payment_method: body.payment_method || 'Tiền mặt',
      payment_status: body.payment_status || 'paid',
      notes:          body.notes          || '',
      created_by:     body.created_by     || '',
    });

    // Write order items & subtract stock
    const itemsSheet = getSheet('OrderItems');
    for (const item of enrichedItems) {
      appendRow(itemsSheet, {
        item_id:      generateId('ITM'),
        order_id:     orderId,
        product_id:   item.product_id,
        product_name: item.product_name,
        quantity:     item.quantity,
        unit_price:   item.unit_price,
        subtotal:     item.subtotal,
      });
      subtractStock(item.product_id, item.quantity);
    }

    return { success: true, data: { order_id: orderId, total_amount: totalAmount, final_amount: finalAmount } };
  } finally {
    lock.releaseLock();
  }
}

function updateOrderStatus(body) {
  if (!body.order_id) return { success: false, error: 'order_id is required' };
  const fields = {};
  if (body.payment_status) fields.payment_status = body.payment_status;
  if (body.payment_method) fields.payment_method = body.payment_method;
  if (body.notes !== undefined) fields.notes = body.notes;
  const ok = updateFieldsInRow(getSheet('Orders'), 'order_id', body.order_id, fields);
  return ok ? { success: true } : { success: false, error: 'Order not found' };
}

function deleteOrder(id) {
  if (!id) return { success: false, error: 'Missing id' };

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    // Restore stock from OrderItems
    const itemsSheet = getSheet('OrderItems');
    const items = sheetToObjects(itemsSheet).filter(i => String(i.order_id) === String(id));
    for (const item of items) {
      addStock(item.product_id, Number(item.quantity) || 0);
    }

    // Delete OrderItems rows (delete bottom-up to preserve row indices)
    const { headerMap } = getHeaders(itemsSheet);
    const orderIdCol = headerMap['order_id'];
    const allData = itemsSheet.getDataRange().getValues();
    const rowsToDelete = [];
    for (let i = allData.length - 1; i >= 1; i--) {
      if (String(allData[i][orderIdCol]) === String(id)) rowsToDelete.push(i + 1);
    }
    rowsToDelete.forEach(r => itemsSheet.deleteRow(r));

    // Delete order row
    const ordersSheet = getSheet('Orders');
    const orderRow = findRow(ordersSheet, 'order_id', id);
    if (orderRow === -1) return { success: false, error: 'Order not found' };
    ordersSheet.deleteRow(orderRow);

    return { success: true };
  } finally {
    lock.releaseLock();
  }
}
