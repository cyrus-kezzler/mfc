import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const notes = 'Confirmed by Cyrus, 31 Jul 2026. 23.68 ex VAT, matching QBO item Cripps & Co.:Cripps Negroni 700ml Prepay. PREPAYMENT ARRANGEMENT, and it is the reason for the two QBO items: the Negroni is made and aged as a whole batch up front, the ingredients are expensive, so Cripps agreed to pay ahead and then call bottles off as they need them. The Prepay item carries the money; the Call item is the drawdown and correctly shows 0.00 on invoices such as MFC3915. A zero-rated Call line is NOT a free case and must never be read as one. Practical effect: Cripps cash funds the ageing.';
const s = await sql`select id from skus where code = 'negroni-700-cripps'`;
await sql`insert into sku_prices (sku_id, price_type, amount, effective_from, notes) values (${s[0].id}, 'wholesale', 23.68, '2026-07-31', ${notes})`;
const r = await sql`select s.code, p.amount from sku_prices p join skus s on s.id=p.sku_id where p.price_type='wholesale' and p.effective_to is null and s.client_id in (2,3) order by s.code`;
for (const x of r) console.log(x.code.padEnd(30), x.amount);
const un = await sql`select s.code from skus s left join sku_prices p on p.sku_id=s.id and p.price_type='wholesale' and p.effective_to is null where p.id is null order by s.code`;
console.log('unpriced:', un.map(r=>r.code).join(', ') || 'none');
