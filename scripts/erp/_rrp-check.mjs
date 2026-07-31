import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
// Live Shopify variant prices, read 31 Jul 2026 via the Shopify Admin API.
const shopify = {
 'cold-brew-negroni-250':18.00,'corpse-reviver-250':15.50,'baby-otis-250':20.50,'baby-otis-500':37.00,
 'dempsey-250':19.50,'dempsey-500':35.00,'desert-negroni-250':21.00,'desert-negroni-500':37.50,
 'espresso-martini-250':15.00,'espresso-martini-500':25.00,'gibson-martini-250':16.50,
 'lychee-martini-250':15.50,'manhattan-250':23.00,'manhattan-500':43.00,'margarita-250':19.50,
 'naked-and-famous-250':22.00,'negroni-250':17.00,'negroni-500':31.00,'pisco-martini-250':17.50,
 'pisco-martini-500':33.00,'red-hook-250':21.00,'rum-old-fashioned-250':17.50,'rum-old-fashioned-500':31.50,
 'sakura-martini-250':23.00,'trident-250':19.00,'trident-500':33.50,'tuxedo-250':18.00,
 'vesper-250':16.50,'vesper-500':31.00 };
const rows = await sql`select s.code, p.amount from skus s join sku_prices p on p.sku_id=s.id and p.price_type='rrp' and p.effective_to is null order by s.code`;
let bad=0;
for (const r of rows) {
  const live = shopify[r.code];
  if (live === undefined) { console.log('  no shopify price for', r.code); continue; }
  const db = Number(r.amount);
  if (Math.abs(db - live) > 0.005) { bad++; console.log('  MISMATCH', r.code.padEnd(26), 'db', db.toFixed(2).padStart(7), 'shopify', live.toFixed(2).padStart(7)); }
}
console.log(bad ? bad + ' RRP mismatches' : 'every RRP matches Shopify');
