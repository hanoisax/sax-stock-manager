// ─── Stock Imports ────────────────────────────────────────────────────────────
// StockImports: import_id, supplier, import_date, total_cost, notes
// ImportItems:  item_id, import_id, product_id, product_name, quantity, unit_cost, subtotal

function getImports(params) {
  let list = sheetToObjects(getSheet('StockImports'));

  if (params.supplier) list = list.filter(i => String(i.supplier).toLowerCase().includes(params.supplier.toLowerCase()));
  if (params.from_date) {
    const from = new Date(params.from_date);
    list = list.filter(i => new Date(i.import_date) >= from);
  }
  if (params.to_date) {
    const to = new Date(params.to_date);
    to.setHours(23, 59, 59, 999);
    list = list.filter(i => new Date(i.import_date) <= to);
  }

  list.sort((a, b) => new Date(b.import_date) - new Date(a.import_date));
  list = list.map(i => ({ ...i, total_cost: Number(i.total_cost) || 0 }));

  return { success: true, data: list, total: list.length };
}

function getImport(id) {
  if (!id) return { success: false, error: 'Missing id' };
  const imports = sheetToObjects(getSheet('StockImports'));
  const imp = imports.find(i => String(i.import_id) === String(id));
  if (!imp) return { success: false, error: 'Import not found' };

  const items = sheetToObjects(getSheet('ImportItems'))
    .filter(i => String(i.import_id) === String(id))
    .map(i => ({
      ...i,
      quantity:  Number(i.quantity)  || 0,
      unit_cost: Number(i.unit_cost) || 0,
      subtotal:  Number(i.subtotal)  || 0,
    }));

  return { success: true, data: { ...imp, total_cost: Number(imp.total_cost) || 0, items } };
}

function createImport(body) {
  if (!body.items || !body.items.length) {
    return { success: false, error: 'items array is required and must not be empty' };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    let totalCost = 0;
    const enrichedItems = [];

    for (const item of body.items) {
      const qty      = Number(item.quantity)  || 0;
      const unitCost = Number(item.unit_cost) || 0;
      if (qty <= 0) return { success: false, error: 'Số lượng phải lớn hơn 0' };

      let productId   = item.product_id;
      let productName = '';

      if (item.new_product) {
        // ── Kèn mới: tạo sản phẩm trước rồi mới ghi phiếu nhập ──
        const np = item.new_product;
        if (!np.name) return { success: false, error: 'Tên sản phẩm không được để trống' };

        const createResult = createProduct({
          name:        np.name,
          type:        'Kèn',
          group:       np.group       || '',
          brand:       np.brand       || '',
          condition:   np.condition   || 'Mới',
          cost_price:  unitCost,
          sell_price:  Number(np.sell_price)  || 0,
          stock_qty:   0,              // stock sẽ được cộng bởi addStock bên dưới
          description: np.description || '',
          image_url:   Array.isArray(np.images) && np.images.length ? np.images.join(',') : '',
          status:      'active',
        });
        if (!createResult.success) return createResult;
        productId   = createResult.data.product_id;
        productName = np.name;
      } else {
        // ── Phụ kiện: lấy sản phẩm có sẵn ──
        const productResult = getProduct(productId);
        if (!productResult.success) return { success: false, error: `Không tìm thấy sản phẩm: ${productId}` };
        const p = productResult.data;
        productName = p.name;
        // Bình quân giá vốn gia quyền
        const newAvgCost = (p.stock_qty + qty) > 0
          ? Math.round((p.stock_qty * p.cost_price + qty * unitCost) / (p.stock_qty + qty))
          : unitCost;
        updateFieldsInRow(getSheet('Products'), 'product_id', productId, { cost_price: newAvgCost });
      }

      const subtotal = qty * unitCost;
      totalCost += subtotal;
      enrichedItems.push({ product_id: productId, product_name: productName, quantity: qty, unit_cost: unitCost, subtotal });
    }

    const importId = generateId('IMP');
    const now      = new Date().toISOString();

    appendRow(getSheet('StockImports'), {
      import_id:   importId,
      supplier:    body.supplier    || '',
      import_date: body.import_date || now,
      total_cost:  totalCost,
      notes:       body.notes       || '',
    });

    const itemsSheet = getSheet('ImportItems');
    for (const item of enrichedItems) {
      appendRow(itemsSheet, {
        item_id:      generateId('IMI'),
        import_id:    importId,
        product_id:   item.product_id,
        product_name: item.product_name,
        quantity:     item.quantity,
        unit_cost:    item.unit_cost,
        subtotal:     item.subtotal,
      });
      addStock(item.product_id, item.quantity);
    }

    return { success: true, data: { import_id: importId, total_cost: totalCost, items_count: enrichedItems.length } };
  } finally {
    lock.releaseLock();
  }
}

function updateImport(body) {
  if (!body.import_id) return { success: false, error: 'Missing import_id' };
  if (!body.items || !body.items.length) return { success: false, error: 'items array is required' };

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const itemsSheet   = getSheet('ImportItems');
    const importsSheet = getSheet('StockImports');

    // 1. Hoàn lại stock + đảo ngược bình quân giá vốn
    const oldItems = sheetToObjects(itemsSheet).filter(i => String(i.import_id) === String(body.import_id));

    // Gom nhóm theo product_id trước khi thay đổi stock
    const revertMap = {};
    for (const item of oldItems) {
      const pid = String(item.product_id);
      if (!revertMap[pid]) revertMap[pid] = { qty: 0, totalCost: 0 };
      revertMap[pid].qty       += Number(item.quantity)  || 0;
      revertMap[pid].totalCost += (Number(item.quantity) || 0) * (Number(item.unit_cost) || 0);
    }

    for (const [pid, rev] of Object.entries(revertMap)) {
      const pResult = getProduct(pid);
      if (!pResult.success) { subtractStock(pid, rev.qty); continue; }
      const p = pResult.data;
      const remainingQty = p.stock_qty - rev.qty;
      if (remainingQty > 0) {
        const revertedCost = Math.round((p.stock_qty * p.cost_price - rev.totalCost) / remainingQty);
        updateFieldsInRow(getSheet('Products'), 'product_id', pid, { cost_price: Math.max(0, revertedCost) });
      }
      subtractStock(pid, rev.qty);
    }

    // 2. Xóa ImportItems cũ (bottom-up)
    const { headerMap } = getHeaders(itemsSheet);
    const importIdCol = headerMap['import_id'];
    const allData = itemsSheet.getDataRange().getValues();
    const rowsToDelete = [];
    for (let i = allData.length - 1; i >= 1; i--) {
      if (String(allData[i][importIdCol]) === String(body.import_id)) rowsToDelete.push(i + 1);
    }
    rowsToDelete.forEach(r => itemsSheet.deleteRow(r));

    // 3. Xử lý items mới (giống createImport)
    let totalCost = 0;
    const enrichedItems = [];

    for (const item of body.items) {
      const qty      = Number(item.quantity)  || 0;
      const unitCost = Number(item.unit_cost) || 0;
      if (qty <= 0) return { success: false, error: 'Số lượng phải lớn hơn 0' };

      let productId   = item.product_id;
      let productName = '';

      if (item.new_product) {
        const np = item.new_product;
        if (!np.name) return { success: false, error: 'Tên sản phẩm không được để trống' };
        const createResult = createProduct({
          name: np.name, type: 'Kèn', group: np.group || '',
          brand: np.brand || '', condition: np.condition || 'Mới',
          cost_price: unitCost, sell_price: Number(np.sell_price) || 0,
          stock_qty: 0, description: np.description || '',
          image_url: Array.isArray(np.images) && np.images.length ? np.images.join(',') : '',
          status: 'active',
        });
        if (!createResult.success) return createResult;
        productId   = createResult.data.product_id;
        productName = np.name;
      } else {
        const productResult = getProduct(productId);
        if (!productResult.success) return { success: false, error: 'Không tìm thấy sản phẩm: ' + productId };
        const p = productResult.data;
        productName = p.name;
        // Bình quân giá vốn gia quyền
        const newAvgCost = (p.stock_qty + qty) > 0
          ? Math.round((p.stock_qty * p.cost_price + qty * unitCost) / (p.stock_qty + qty))
          : unitCost;
        updateFieldsInRow(getSheet('Products'), 'product_id', productId, { cost_price: newAvgCost });
      }

      const subtotal = qty * unitCost;
      totalCost += subtotal;
      enrichedItems.push({ product_id: productId, product_name: productName, quantity: qty, unit_cost: unitCost, subtotal });
    }

    // 4. Cập nhật header phiếu nhập
    updateFieldsInRow(importsSheet, 'import_id', body.import_id, {
      supplier:    body.supplier    || '',
      import_date: body.import_date || new Date().toISOString(),
      total_cost:  totalCost,
      notes:       body.notes       || '',
    });

    // 5. Tạo ImportItems mới + cộng stock
    for (const item of enrichedItems) {
      appendRow(itemsSheet, {
        item_id:      generateId('IMI'),
        import_id:    body.import_id,
        product_id:   item.product_id,
        product_name: item.product_name,
        quantity:     item.quantity,
        unit_cost:    item.unit_cost,
        subtotal:     item.subtotal,
      });
      addStock(item.product_id, item.quantity);
    }

    return { success: true, data: { import_id: body.import_id, total_cost: totalCost } };
  } finally {
    lock.releaseLock();
  }
}

function deleteImport(id) {
  if (!id) return { success: false, error: 'Missing id' };

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    // Restore stock
    const itemsSheet = getSheet('ImportItems');
    const items = sheetToObjects(itemsSheet).filter(i => String(i.import_id) === String(id));
    for (const item of items) {
      subtractStock(item.product_id, Number(item.quantity) || 0);
    }

    // Delete ImportItems rows (bottom-up)
    const { headerMap } = getHeaders(itemsSheet);
    const importIdCol = headerMap['import_id'];
    const allData = itemsSheet.getDataRange().getValues();
    const rowsToDelete = [];
    for (let i = allData.length - 1; i >= 1; i--) {
      if (String(allData[i][importIdCol]) === String(id)) rowsToDelete.push(i + 1);
    }
    rowsToDelete.forEach(r => itemsSheet.deleteRow(r));

    const importsSheet = getSheet('StockImports');
    const importRow = findRow(importsSheet, 'import_id', id);
    if (importRow === -1) return { success: false, error: 'Import not found' };
    importsSheet.deleteRow(importRow);

    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

// ─── Image Upload ─────────────────────────────────────────────────────────────

const IMAGE_FOLDER_ID = '1tYSWSeMyFIQbZbF331AlmVBWRc-UUQuc';

// Chạy hàm này 1 lần từ GAS Editor để cấp quyền Drive (read + write)
function initDriveAccess() {
  const folder   = DriveApp.getFolderById(IMAGE_FOLDER_ID);
  const testFile = folder.createFile('_auth_test.txt', 'ok', 'text/plain');
  testFile.setTrashed(true);
  Logger.log('Drive read+write OK - folder: ' + folder.getName());
}

function uploadImage(body) {
  if (!body.data) return { success: false, error: 'Không có dữ liệu ảnh' };

  const folder   = DriveApp.getFolderById(IMAGE_FOLDER_ID);
  const mimeType = body.mimeType || 'image/jpeg';
  const filename = body.filename || ('product_' + Date.now() + '.jpg');
  const blob     = Utilities.newBlob(Utilities.base64Decode(body.data), mimeType, filename);

  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const fileId = file.getId();
  const url    = 'https://drive.google.com/uc?export=view&id=' + fileId;
  return { success: true, data: { url, file_id: fileId } };
}

// ─── Config ───────────────────────────────────────────────────────────────────
// Sheet: Config — Columns: store_name, phone, address, tax_rate (single row)

function getConfig() {
  const sheet = getSheet('Config');
  const data  = sheet.getDataRange().getValues();
  if (data.length < 2) return { success: true, data: {} };
  const headers = data[0];
  const values  = data[1];
  const config  = {};
  headers.forEach((h, i) => { config[h] = values[i]; });
  return { success: true, data: config };
}

function updateConfig(body) {
  const sheet = getSheet('Config');
  const { headers, headerMap } = getHeaders(sheet);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    // No data row yet — create one
    const row = headers.map(h => body[h] !== undefined ? body[h] : '');
    sheet.appendRow(row);
  } else {
    headers.forEach((h, colIdx) => {
      if (body[h] !== undefined) {
        sheet.getRange(2, colIdx + 1).setValue(body[h]);
      }
    });
  }
  return { success: true };
}
