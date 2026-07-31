import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const s = await sql`select id from skus where code='sakura-martini-250'`;
const id = s[0].id;
console.log('-- state now --');
for (const r of await sql`select id, price_type, amount, effective_from, effective_to from sku_prices where sku_id=${id} order by price_type, effective_from`) console.log(' ', r.id, r.price_type.padEnd(10), r.amount, 'from', r.effective_from, r.effective_to ? 'to '+r.effective_to : '(current)');
const wsNote = 'First agreed wholesale price for this SKU, set 31 Jul 2026 ahead of listing with Italo. Derived from the retailer test rather than the markup rule: 23.00 RRP divided by (1.30 retailer margin x 1.20 VAT) gives 14.74, the most chargeable without the shelf price breaking the RRP. That is 21.9% on COGS of 10.58 plus 0.93 shipping, below the 1.40 rule price of 15.74, and deliberately so: the drink cannot carry both a 40% markup and this shelf price because premium daiginjo sake is 61% of it. The 0.93 shipping is carried from the old file and should be zeroed if Italo is self-delivered, worth about seven points.';
const open = await sql`select id from sku_prices where sku_id=${id} and price_type='wholesale' and effective_to is null`;
if (open.length) { await sql`update sku_prices set effective_to='2026-07-31', updated_at=now() where id=${open[0].id}`; console.log('closed old wholesale row', open[0].id); }
const already = await sql`select id from sku_prices where sku_id=${id} and price_type='wholesale' and effective_from='2026-07-31' and effective_to is null`;
if (!already.length) { await sql`insert into sku_prices (sku_id, price_type, amount, effective_from, shipping, notes) values (${id}, 'wholesale', 14.74, '2026-07-31', 0.93, ${wsNote})`; console.log('inserted wholesale 14.74'); }
console.log('-- state after --');
for (const r of await sql`select price_type, amount, effective_from, effective_to from sku_prices where sku_id=${id} order by price_type, effective_from`) console.log(' ', r.price_type.padEnd(10), r.amount, 'from', r.effective_from, r.effective_to ? 'to '+r.effective_to : '(current)');
