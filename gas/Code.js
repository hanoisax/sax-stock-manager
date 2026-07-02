const SPREADSHEET_ID = '1u6MxT1wnq-pl0eImWx65KcIDL1oQzHgi_hYO4EyDqnA';

function doGet(e)  { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  try {
    const params = e.parameter || {};
    const action = params.action;
    let body = {};
    if (e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
    if (params.data) {
      body = Object.assign(body, JSON.parse(params.data));
    }

    let result;
    switch (action) {
      // Products
      case 'getProducts':    result = getProducts(params);       break;
      case 'getProduct':     result = getProduct(params.id);     break;
      case 'createProduct':  result = createProduct(body);       break;
      case 'updateProduct':  result = updateProduct(body);       break;
      case 'deleteProduct':  result = deleteProduct(params.id);  break;

      // Customers
      case 'getCustomers':   result = getCustomers(params);      break;
      case 'createCustomer': result = createCustomer(body);      break;
      case 'updateCustomer': result = updateCustomer(body);      break;
      case 'deleteCustomer': result = deleteCustomer(params.id); break;

      // Orders (Sales)
      case 'getOrders':         result = getOrders(params);            break;
      case 'getOrder':          result = getOrder(params.id);          break;
      case 'createOrder':       result = createOrder(body);            break;
      case 'updateOrderStatus': result = updateOrderStatus(body);      break;
      case 'deleteOrder':       result = deleteOrder(params.id);       break;

      // Stock Imports
      case 'getImports':    result = getImports(params);        break;
      case 'getImport':     result = getImport(params.id);      break;
      case 'createImport':  result = createImport(body);        break;
      case 'updateImport':  result = updateImport(body);        break;
      case 'deleteImport':  result = deleteImport(params.id);   break;

      // Stock Takes (Kiểm kho)
      case 'getStockTakes': result = getStockTakes(params);     break;
      case 'getStockTake':  result = getStockTake(params.id);   break;
      case 'createStockTake': result = createStockTake(body);   break;
      case 'deleteStockTake': result = deleteStockTake(params.id); break;

      // Config & Dropdowns
      case 'getConfig':     result = getConfig();               break;
      case 'updateConfig':  result = updateConfig(body);        break;
      case 'getDropdowns':  result = getDropdowns();            break;

      // Dashboard & Reports
      case 'getDashboard':  result = getDashboard();            break;
      case 'getReport':     result = getReport(params);         break;

      // Image upload
      case 'uploadImage':   result = uploadImage(body);         break;

      // Public Web API (CMS-compatible) — trả dữ liệu thô cho website
      case 'webProducts':     result = webProducts(params);       break;
      case 'webProduct':      result = webProduct(params.id);     break;
      case 'webBusinessInfo': result = webBusinessInfo();         break;
      case 'webContacts':     result = webContacts();             break;
      case 'webHeroImages':   result = webHeroImages();           break;
      case 'webSpecialities': result = webSpecialities();         break;
      case 'webArticles':     result = webArticles();             break;

      default:
        result = { success: false, error: 'Unknown action: ' + action };
    }
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet(name) {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1)
    .filter(row => row.some(c => c !== '' && c !== null))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
}

function getHeaders(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return { headers: [], headerMap: {} };
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const headerMap = {};
  headers.forEach((h, i) => { headerMap[String(h).toLowerCase().trim()] = i; });
  return { headers, headerMap };
}

function generateId(prefix) {
  return prefix + Date.now().toString(36).toUpperCase()
    + Math.random().toString(36).substring(2, 5).toUpperCase();
}

function findRow(sheet, idColName, idValue) {
  const { headerMap } = getHeaders(sheet);
  const colIdx = headerMap[idColName.toLowerCase()];
  if (colIdx === undefined) return -1;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const col = sheet.getRange(2, colIdx + 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < col.length; i++) {
    if (String(col[i][0]) === String(idValue)) return i + 2;
  }
  return -1;
}

function appendRow(sheet, fieldMap) {
  const { headers } = getHeaders(sheet);
  const row = headers.map(h => {
    const key = String(h).toLowerCase().trim();
    return fieldMap[key] !== undefined ? fieldMap[key] : (fieldMap[h] !== undefined ? fieldMap[h] : '');
  });
  sheet.appendRow(row);
}

function updateFieldsInRow(sheet, idColName, idValue, fields) {
  const rowNum = findRow(sheet, idColName, idValue);
  if (rowNum === -1) return false;
  const { headers } = getHeaders(sheet);
  headers.forEach((h, colIdx) => {
    const key = String(h).toLowerCase().trim();
    if (fields[key] !== undefined) {
      sheet.getRange(rowNum, colIdx + 1).setValue(fields[key]);
    }
  });
  return true;
}
