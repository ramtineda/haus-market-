// ============================================================
// JAVADI 2.0 – سئو (Sitemap, Robots, JSON-LD)
// ============================================================
const db = require('./database');

function getBaseUrl() {
  return process.env.BASE_URL || 'http://localhost:3000';
}

function generateSitemap() {
  const base = getBaseUrl();
  const products = db.prepare('SELECT slug, updated_at FROM products WHERE is_active = 1 ORDER BY updated_at DESC').all();
  const categories = db.prepare('SELECT slug FROM categories WHERE is_active = 1').all();
  const brands = db.prepare('SELECT slug FROM brands WHERE is_active = 1').all();
  const today = new Date().toISOString().split('T')[0];

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  const staticPages = [
    { path: '/', priority: '1.0', freq: 'daily' },
    { path: '/products', priority: '0.9', freq: 'daily' },
    { path: '/deal', priority: '0.9', freq: 'daily' },
    { path: '/about', priority: '0.5', freq: 'monthly' },
    { path: '/contact', priority: '0.5', freq: 'monthly' },
    { path: '/faq', priority: '0.6', freq: 'monthly' },
  ];
  for (const p of staticPages) {
    xml += `  <url><loc>${base}${p.path}</loc><lastmod>${today}</lastmod><changefreq>${p.freq}</changefreq><priority>${p.priority}</priority></url>\n`;
  }

  for (const c of categories) {
    xml += `  <url><loc>${base}/category/${c.slug}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
  }
  for (const b of brands) {
    xml += `  <url><loc>${base}/brand/${b.slug}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>\n`;
  }
  for (const p of products) {
    const lastmod = p.updated_at ? p.updated_at.split(' ')[0] : today;
    xml += `  <url><loc>${base}/product/${p.slug}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>\n`;
  }

  xml += '</urlset>';
  return xml;
}

function generateRobots() {
  const base = getBaseUrl();
  const adminPath = process.env.ADMIN_PATH || 'admin';
  return `# robots.txt for JAVADI
User-agent: *
Allow: /
Disallow: /${adminPath}
Disallow: /api/
Disallow: /cart
Disallow: /checkout
Disallow: /my-orders
Disallow: /wishlist
Disallow: /compare

Sitemap: ${base}/sitemap.xml
`;
}

function productJsonLd(product) {
  const base = getBaseUrl();
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.short_desc || product.long_desc || '',
    image: product.image ? [product.image] : [],
    sku: `JV-${product.id}`,
    brand: { '@type': 'Brand', name: product.brand_name || 'نامشخص' },
    offers: {
      '@type': 'Offer',
      url: `${base}/product/${product.slug}`,
      priceCurrency: 'IRR',
      price: Number(product.price * 10).toFixed(0),
      availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  };
  return data;
}

module.exports = { generateSitemap, generateRobots, productJsonLd, getBaseUrl };