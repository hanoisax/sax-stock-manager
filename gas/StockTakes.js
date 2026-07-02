// ─── Stock Takes (Kiểm kho) ─────────────────────────────────────────────────
// Sheet: StockTakes
//   stocktake_id, take_date, notes, total_diff_qty, total_diff_value, created_at
// Sheet: StockTakeItems
//   item_id, stocktake_id, product_id, product_name, system_qty, actual_qty,
//   diff_qty, cost_price, diff_value
//
// Kiểm kho: nhập số lượng thực tế, hệ thống điều chỉnh tồn về đúng số thực.
// Giá trị chênh lệch = (số thực - số hệ thống) × giá vốn hiện tại.

const STOCKTAKE_HEADERS = ['stocktake_id', 'take_date', 'notes', 'total_diff_qty', 'total_diff_value', 'created_at'];
const STOCKTAKE_ITEM_HEADERS = ['item_id', 'stocktake_id', 'product_id', 'product_name', 'system_qty', 'actual_qty', 'diff_qty', 'cost_price', 'diff_value'];

function ensureSheet(name, headers) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

function getStockTakes(params) {
  const sheet = ensureSheet('StockTakes', STOCKTAKE_HEADERS);
  let list = sheetToObjects(sheet);

  if (params && params.from_date) {
    const from = new Date(params.from_date);
    list = list.filter(t => new Date(t.take_date) >= from);
  }
  if (params && params.to_date) {
    const to = new Date(params.to_date);
    to.setHours(23, 59, 59, 999);
    list = list.filter(t => new Date(t.take_date) <= to);
  }

  list.sort((a, b) => new Date(b.take_date) - new Date(a.take_date));
  list = list.map(t => ({
    ...t,
    total_diff_qty:   Number(t.total_diff_qty)   || 0,
    total_diff_value: Number(t.total_diff_value) || 0,
  }));

  return { success: true, data: list, total: list.length };
}

function getStockTake(id) {
  if (!id) return { success: false, error: 'Missing id' };
  const sheet = ensureSheet('StockTakes', STOCKTAKE_HEADERS);
  const t = sheetToObjects(sheet).find(x => String(x.stocktake_id) === String(id));
  if (!t) return { success: false, error: 'Stock take not found' };

  const items = sheetToObjects(ensureSheet('StockTakeItems', STOCKTAKE_ITEM_HEADERS))
    .filter(i => String(i.stocktake_id) === String(id))
    .map(i => ({
      ...i,
      system_qty: Number(i.system_qty) || 0,
      actual_qty: Number(i.actual_qty) || 0,
      diff_qty:   Number(i.diff_qty)   || 0,
      cost_price: Number(i.cost_price) || 0,
      diff_value: Number(i.diff_value) || 0,
    }));

  return {
    success: true,
    data: {
      ...t,
      total_diff_qty:   Number(t.total_diff_qty)   || 0,
      total_diff_value: Number(t.total_diff_value) || 0,
      items,
    }
  };
}

function createStockTake(body) {
  if (!body.items || !body.items.length) {
    return { success: false, error: 'items array is required and must not be empty' };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const productsSheet = getSheet('Products');
    const enrichedItems = [];
    let totalDiffQty = 0;
    let totalDiffValue = 0;

    for (const item of body.items) {
      const productResult = getProduct(item.product_id);
      if (!productResult.success) return { success: false, error: 'Không tìm thấy sản phẩm: ' + item.product_id };
      const p = productResult.data;

      const systemQty = Number(p.stock_qty) || 0;
      const actualQty = Number(item.actual_qty);
      if (isNaN(actualQty) || actualQty < 0) {
        return { success: false, error: `Số lượng thực tế không hợp lệ cho "${p.name}"` };
      }

      const diffQty   = actualQty - systemQty;
      const costPrice = Number(p.cost_price) || 0;
      const diffValue = diffQty * costPrice;

      // Đưa tồn về đúng số thực tế
      updateFieldsInRow(productsSheet, 'product_id', item.product_id, { stock_qty: actualQty });

      totalDiffQty   += diffQty;
      totalDiffValue += diffValue;
      enrichedItems.push({
        product_id:   item.product_id,
        product_name: p.name,
        system_qty:   systemQty,
        actual_qty:   actualQty,
        diff_qty:     diffQty,
        cost_price:   costPrice,
        diff_value:   diffValue,
      });
    }

    const stocktakeId = generateId('STK');
    const now = new Date().toISOString();

    appendRow(ensureSheet('StockTakes', STOCKTAKE_HEADERS), {
      stocktake_id:     stocktakeId,
      take_date:        body.take_date || now,
      notes:            body.notes     || '',
      total_diff_qty:   totalDiffQty,
      total_diff_value: totalDiffValue,
      created_at:       now,
    });

    const itemsSheet = ensureSheet('StockTakeItems', STOCKTAKE_ITEM_HEADERS);
    for (const item of enrichedItems) {
      appendRow(itemsSheet, {
        item_id:      generateId('STI'),
        stocktake_id: stocktakeId,
        product_id:   item.product_id,
        product_name: item.product_name,
        system_qty:   item.system_qty,
        actual_qty:   item.actual_qty,
        diff_qty:     item.diff_qty,
        cost_price:   item.cost_price,
        diff_value:   item.diff_value,
      });
    }

    return {
      success: true,
      data: {
        stocktake_id:     stocktakeId,
        total_diff_qty:   totalDiffQty,
        total_diff_value: totalDiffValue,
        items_count:      enrichedItems.length,
      }
    };
  } finally {
    lock.releaseLock();
  }
}

function deleteStockTake(id) {
  if (!id) return { success: false, error: 'Missing id' };

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    // Lưu ý: xóa phiếu kiểm kho KHÔNG hoàn lại tồn (tồn đã là số thực tế đúng).
    const itemsSheet = ensureSheet('StockTakeItems', STOCKTAKE_ITEM_HEADERS);
    const { headerMap } = getHeaders(itemsSheet);
    const idCol = headerMap['stocktake_id'];
    const allData = itemsSheet.getDataRange().getValues();
    const rowsToDelete = [];
    for (let i = allData.length - 1; i >= 1; i--) {
      if (String(allData[i][idCol]) === String(id)) rowsToDelete.push(i + 1);
    }
    rowsToDelete.forEach(r => itemsSheet.deleteRow(r));

    const sheet = ensureSheet('StockTakes', STOCKTAKE_HEADERS);
    const row = findRow(sheet, 'stocktake_id', id);
    if (row === -1) return { success: false, error: 'Stock take not found' };
    sheet.deleteRow(row);

    return { success: true };
  } finally {
    lock.releaseLock();
  }
}
