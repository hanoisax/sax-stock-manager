// ─── Public Web API (CMS-compatible) ────────────────────────────────────────
// Cấp dữ liệu cho website BroSax (brosax-web). Trả về JSON đúng shape mà web cần,
// nguồn dữ liệu là sheet Products (+ Config). Các action ở đây trả về dữ liệu
// "thô" (array/object) thay vì bọc { success, data } để khớp định dạng CMS cũ.

const WEB_PLACEHOLDER_IMG = 'https://placehold.co/400x500?text=BroSax';
const WEB_DEFAULT_LOGO    = 'https://placehold.co/64x64?text=BS';

// type/group (sheet) → category (navbar web)
function _webCategory(p) {
  if (p.type === 'Kèn') return 'saxophones';
  switch (p.group) {
    case 'Beck':     return 'mouthpieces';
    case 'Dăm':      return 'reeds';
    case 'Bao kèn':  return 'accessories';
    case 'Chân kèn': return 'accessories';
    default:         return 'others';
  }
}

function _webTruthy(v) {
  if (v === true) return true;
  const s = String(v).trim().toLowerCase();
  return s === 'true' || s === 'x' || s === '1' || s === 'yes' || s === 'có';
}

function _mapWebProduct(p) {
  const imgs = String(p.image_url || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const media = imgs.length
    ? imgs.map(u => ({ image: { url: u } }))
    : [{ image: { url: WEB_PLACEHOLDER_IMG } }];

  const basePrice   = Number(p.sell_price) || 0;
  const saleOff     = Number(p.sale_price);  // cột tùy chọn, nếu có
  const saleOffPrice = (!isNaN(saleOff) && saleOff > 0) ? saleOff : basePrice;

  return {
    id:        String(p.product_id),
    name:      p.name || '',
    category:  _webCategory(p),
    status:    p.condition || '',
    featured:  _webTruthy(p.featured),
    reference: '',
    createdAt: p.created_at || '',
    description:         p.description || '',
    detailedDescription: p.detailed_description || p.description || '',
    price: { basePrice, saleOffPrice, currency: 'VND' },
    media,
  };
}

// GET ?action=webProducts  [&featured=true][&category=X][&_sort=createdAt:desc][&_limit=12]
function webProducts(params) {
  params = params || {};
  let list = sheetToObjects(getSheet('Products'))
    .filter(p => String(p.status || 'active').toLowerCase() === 'active')
    .map(_mapWebProduct);

  if (params.featured === 'true') list = list.filter(p => p.featured);
  if (params.category)            list = list.filter(p => p.category === params.category);

  // Mặc định sắp xếp mới nhất trước
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (params._sort === 'createdAt:asc') list.reverse();

  const limit = parseInt(params._limit, 10);
  if (!isNaN(limit) && limit > 0) list = list.slice(0, limit);

  return list;
}

// GET ?action=webProduct&id=PRD...
function webProduct(id) {
  if (!id) return null;
  const p = sheetToObjects(getSheet('Products'))
    .find(x => String(x.product_id) === String(id));
  return p ? _mapWebProduct(p) : null;
}

// GET ?action=webBusinessInfo  → { name, logo: { url, mime } }
function webBusinessInfo() {
  const cfg = (getConfig().data) || {};
  return {
    name: cfg.store_name || 'BroSax',
    logo: {
      url:  cfg.logo_url || WEB_DEFAULT_LOGO,
      mime: 'image/png',
    },
  };
}

// GET ?action=webContacts  → [ { type, value } ]
function webContacts() {
  const cfg = (getConfig().data) || {};
  const out = [];
  if (cfg.email)     out.push({ type: 'email',   value: String(cfg.email) });
  if (cfg.phone)     out.push({ type: 'phone',   value: String(cfg.phone) });
  if (cfg.address)   out.push({ type: 'address', value: String(cfg.address) });
  if (cfg.facebook)  out.push({ type: 'facebook', value: String(cfg.facebook) });
  if (cfg.youtube)   out.push({ type: 'youtube',  value: String(cfg.youtube) });
  if (cfg.estore)    out.push({ type: 'estore',   value: String(cfg.estore) });
  return out;
}

// GET ?action=webHeroImages  → [ { reference, image: { url } } ]
// Dùng ảnh của vài sản phẩm mới nhất có hình để banner không bị trống.
function webHeroImages() {
  const list = sheetToObjects(getSheet('Products'))
    .filter(p => String(p.status || 'active').toLowerCase() === 'active')
    .map(_mapWebProduct)
    .filter(p => p.media[0].image.url !== WEB_PLACEHOLDER_IMG)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);
  return list.map(p => ({
    reference: '/products/' + p.id,
    image: { url: p.media[0].image.url },
  }));
}

// GET ?action=webSpecialities  → [] (chưa dùng; có thể mở rộng sau)
function webSpecialities() {
  return [];
}

// GET ?action=webArticles  → [] (blog chưa dùng tới sheet)
function webArticles() {
  return [];
}

// Chạy 1 lần từ GAS Editor: thêm các cột tùy chọn cho web nếu chưa có.
function initWebColumns() {
  const sheet = getSheet('Products');
  const { headers } = getHeaders(sheet);
  const lower = headers.map(h => String(h).toLowerCase().trim());
  const toAdd = ['featured', 'sale_price', 'detailed_description'].filter(c => lower.indexOf(c) === -1);
  if (!toAdd.length) { Logger.log('Đã có đủ cột web.'); return; }
  let col = sheet.getLastColumn();
  toAdd.forEach(name => {
    col += 1;
    sheet.getRange(1, col).setValue(name);
  });
  Logger.log('Đã thêm cột: ' + toAdd.join(', '));
}
