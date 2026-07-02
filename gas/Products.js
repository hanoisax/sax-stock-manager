// Sheet: Products
// Columns: product_id, name, type, group, brand, condition,
//          cost_price, sell_price, stock_qty, image_url, description, status, created_at
// type: 'Kèn' | 'Phụ kiện'
// group (Kèn): 'Alto' | 'Soprano' | 'Baritone'
// group (Phụ kiện): 'Beck' | 'Dăm' | 'Bao kèn' | 'Chân kèn' | 'Khác'

function getProducts(params) {
  const sheet = getSheet('Products');
  let list = sheetToObjects(sheet);

  if (params.type)   list = list.filter(p => p.type === params.type);
  if (params.brand)  list = list.filter(p => p.brand === params.brand);
  if (params.status) list = list.filter(p => p.status === params.status);
  if (params.search) {
    const q = params.search.toLowerCase();
    list = list.filter(p =>
      String(p.name).toLowerCase().includes(q) ||
      String(p.product_id).toLowerCase().includes(q) ||
      String(p.brand).toLowerCase().includes(q)
    );
  }
  if (params.low_stock === 'true')  list = list.filter(p => Number(p.stock_qty) <= 0);
  if (params.in_stock === 'true')   list = list.filter(p => Number(p.stock_qty) > 0);

  list = list.map(normalizeProduct);
  return { success: true, data: list, total: list.length };
}

function getProduct(id) {
  if (!id) return { success: false, error: 'Missing id' };
  const list = sheetToObjects(getSheet('Products'));
  const p = list.find(p => String(p.product_id) === String(id));
  if (!p) return { success: false, error: 'Product not found' };
  return { success: true, data: normalizeProduct(p) };
}

function createProduct(body) {
  if (!body.name) return { success: false, error: 'name is required' };
  const id = body.product_id || generateId('PRD');
  appendRow(getSheet('Products'), {
    product_id:  id,
    name:        body.name || '',
    type:        body.type || '',
    group:       body.group || '',
    brand:       body.brand || '',
    condition:   body.condition || 'Mới',
    cost_price:  Number(body.cost_price) || 0,
    sell_price:  Number(body.sell_price) || 0,
    stock_qty:   Number(body.stock_qty) || 0,
    image_url:   body.image_url || '',
    description: body.description || '',
    status:      body.status || 'active',
    created_at:  new Date().toISOString(),
  });
  return { success: true, data: { product_id: id } };
}

function updateProduct(body) {
  if (!body.product_id) return { success: false, error: 'product_id is required' };
  const fields = {};
  Object.keys(body).forEach(k => { fields[k.toLowerCase().trim()] = body[k]; });
  const ok = updateFieldsInRow(getSheet('Products'), 'product_id', body.product_id, fields);
  return ok ? { success: true } : { success: false, error: 'Product not found' };
}

function deleteProduct(id) {
  if (!id) return { success: false, error: 'Missing id' };
  const sheet = getSheet('Products');
  const row = findRow(sheet, 'product_id', id);
  if (row === -1) return { success: false, error: 'Product not found' };
  sheet.deleteRow(row);
  return { success: true };
}

// ─── Internal stock helpers ──────────────────────────────────────────────────

function addStock(productId, qty) {
  return _changeStock(productId, qty);
}

function subtractStock(productId, qty) {
  return _changeStock(productId, -qty);
}

function _changeStock(productId, delta) {
  const sheet = getSheet('Products');
  const row = findRow(sheet, 'product_id', productId);
  if (row === -1) return { success: false, error: 'Product not found: ' + productId };
  const { headerMap } = getHeaders(sheet);
  const col = headerMap['stock_qty'];
  if (col === undefined) return { success: false, error: 'stock_qty column not found' };
  const cell = sheet.getRange(row, col + 1);
  const newQty = (Number(cell.getValue()) || 0) + delta;
  cell.setValue(newQty);
  return { success: true, new_stock: newQty };
}

function normalizeProduct(p) {
  return {
    ...p,
    cost_price: Number(p.cost_price) || 0,
    sell_price: Number(p.sell_price) || 0,
    stock_qty:  Number(p.stock_qty)  || 0,
  };
}
