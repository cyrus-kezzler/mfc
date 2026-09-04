import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const rows = [
  ['espresso-martini-700-cripps', 18.69, 'Confirmed 31 Jul 2026 from live QuickBooks invoice MFC3915: Cripps & Co Espresso Martini 700ml, 252 units at 18.69, exclusive of tax. QBO item Cripps & Co.:Cripps Espresso Martini 700ml Prepay carries the same rate. SUPERSEDES the 15.02 carried in Canon, which appears to have been the retired Cripps 500ml price (QBO shows that deleted item at 15.26).'],
  ['espresso-daiquiri-350-fm', 14.52, 'QuickBooks item Fortnum & Mason:F&M Espresso Daiquiri, F&M SKU 5086517, 35cl. List price read 31 Jul 2026. Not yet cross-checked against an invoice line.'],
  ['robin-roy-350-fm', 14.64, 'QuickBooks item Fortnum & Mason:F&M Robin Roy, F&M SKU 5086518, 35cl. List price read 31 Jul 2026. Not yet cross-checked against an invoice line.'],
  ['vesper-martini-350-fm', 13.86, 'QuickBooks item Fortnum & Mason:F&M Vesper Martini, F&M SKU 5086516, 35cl. List price read 31 Jul 2026. Not yet cross-checked against an invoice line.'],
];
for (const [code, amount, notes] of rows) {
  const s = await sql`select id from skus where code = ${code}`;
  if (!s.length) { console.log('NO SKU', code); continue; }
  const existing = await sql`select id from sku_prices where sku_id = ${s[0].id} and price_type = 'wholesale' and effective_to is null`;
  if (existing.length) { console.log('already priced', code); continue; }
  await sql`insert into sku_prices (sku_id, price_type, amount, effective_from, notes) values (${s[0].id}, 'wholesale', ${amount}, '2026-07-31', ${notes})`;
  console.log('SET', code.padEnd(28), amount);
}
const un = await sql`select s.code from skus s left join sku_prices p on p.sku_id = s.id and p.price_type='wholesale' and p.effective_to is null where p.id is null order by s.code`;
console.log('still without a wholesale price:', un.map(r=>r.code).join(', ') || 'none');
