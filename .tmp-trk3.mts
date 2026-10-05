// READ-ONLY. Shipped query + shipped allowlist + shipped business-day rule.
import { createClient } from '@libsql/client';
import { createAdminApiClient } from '@shopify/admin-api-client';
import { createDecipheriv } from 'crypto';
import fs from 'fs';
import { businessDaysSince, LATE_AFTER_BUSINESS_DAYS } from './src/lib/tracker.ts';
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^"|"$/g,'')]}));
const key = Buffer.from(env.ENCRYPTION_KEY.padEnd(64,'0').slice(0,64),'hex');
const decrypt = (c: string) => { const [iv,tag,data]=c.split(':'); const d=createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'hex')); d.setAuthTag(Buffer.from(tag,'hex')); return d.update(Buffer.from(data,'hex')).toString('utf8')+d.final('utf8'); };
const db = createClient({ url: env.DATABASE_URL, authToken: env.DATABASE_AUTH_TOKEN });
const s: any = (await db.execute('select shopify_domain, api_access_token from stores limit 1')).rows[0];
let token; try { token = decrypt(String(s.api_access_token)); } catch { token = String(s.api_access_token); }
const client = createAdminApiClient({ storeDomain: String(s.shopify_domain), apiVersion: '2026-01', accessToken: token });
const src = fs.readFileSync('src/lib/server/shopify/tracker.ts','utf8');
const Q = src.match(/const ORDERS_QUERY = `([\s\S]*?)`;/)![1];
const TRACKED = new Set(eval(src.match(/const TRACKED = new Set\((\[[^\]]*\])\)/)![1]));
const days = 60, since = new Date(Date.now()-(days+14)*86400e3).toISOString().slice(0,10), cutoff = Date.now()-days*86400e3;
let after: string|null = null, rows: any[] = [], tz = 'UTC';
while (true) {
  const r: any = await client.request(Q, { variables: { after, query: `fulfillment_status:shipped -status:cancelled created_at:>=${since}` } });
  tz = r.data.shop.ianaTimezone || tz;
  for (const o of r.data.orders.nodes) {
    if (o.cancelledAt) continue;
    const live = o.fulfillments.filter((f: any) => f.status !== 'CANCELLED'); if (!live.length) continue;
    const ds = live.find((f: any) => f.displayStatus)?.displayStatus ?? null; if (!ds || !TRACKED.has(ds)) continue;
    const disp = live.map((f: any) => f.createdAt).sort()[0]; if (Date.parse(disp) < cutoff) continue;
    const bd = businessDaysSince(disp, tz); rows.push({ name: o.name, ds, bd, late: bd >= LATE_AFTER_BUSINESS_DAYS });
  }
  if (!r.data.orders.pageInfo.hasNextPage) break; after = r.data.orders.pageInfo.endCursor;
}
rows.sort((a,b)=>b.bd-a.bd);
console.log(`60d  In Transit ${rows.filter(r=>r.ds!=='ATTEMPTED_DELIVERY').length} | Attempted ${rows.filter(r=>r.ds==='ATTEMPTED_DELIVERY').length} | Late ${rows.filter(r=>r.late).length}`);
for (const r of rows) console.log(`  ${r.name.padEnd(7)} ${r.ds.padEnd(20)} ${String(r.bd).padStart(2)} business days${r.late ? '  LATE' : ''}`);
