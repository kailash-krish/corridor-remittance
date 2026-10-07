import assert from 'node:assert/strict';
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:3100';
let cookie='';
async function call(path,body,extra={}){const r=await fetch(`${origin}${path}`,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:origin,...(cookie?{Cookie:cookie}:{}),...extra},body:body===undefined?undefined:JSON.stringify(body)});const j=await r.json();return{r,j};}
for(const path of ['/','/login','/dashboard','/privacy','/terms']){const r=await fetch(origin+path);assert.equal(r.status,200,path)}
assert.equal((await call('/api/backend/transfers')).r.status,401);
const badOrigin=await call('/api/session',{name:'Test Sender'},{Origin:'https://untrusted.example'});assert.equal(badOrigin.r.status,403);
const session=await call('/api/session',{name:'Test Sender'});assert.equal(session.r.status,200);cookie=session.r.headers.get('set-cookie').split(';')[0];assert.ok(session.r.headers.get('set-cookie').includes('HttpOnly'));
assert.equal((await call('/api/backend/admin/aml/queue')).r.status,404);
assert.equal((await call('/api/backend/quotes',{sourceCurrency:'AED',targetCurrency:'INR',sendAmountMinor:-100})).r.status,400);
for(const [id,status] of [['DEMO0000','REJECTED'],['DEMO9999','REVIEW'],['DEMO123456','APPROVED']]){const k=await call('/api/backend/kyc/submit',{fullName:'Fictional Sender',dateOfBirth:'1993-04-12',idType:'NATIONAL_ID',idNumber:id,country:'ARE'});assert.equal(k.r.status,200,JSON.stringify(k.j));assert.equal(k.j.data.status,status)}
async function create(){const q=await call('/api/backend/quotes',{sourceCurrency:'AED',targetCurrency:'INR',sendAmountMinor:100000});assert.equal(q.r.status,201);assert.equal(q.j.data.fee_minor,1000);const key=crypto.randomUUID();const body={quoteId:q.j.data.id,recipientDetails:{name:'Fictional Recipient',upi_id:'fictional@demobank',country:'IND'}};const t=await call('/api/backend/transfers',body,{'Idempotency-Key':key});assert.equal(t.r.status,201);assert.equal(t.j.data.status,'AWAITING_FUNDS');const duplicate=await call('/api/backend/transfers',body,{'Idempotency-Key':key});assert.equal(duplicate.j.data.id,t.j.data.id);return t.j.data.id;}
const cancelled=await create();assert.equal((await call(`/api/backend/transfers/${cancelled}/cancel`,{reason:'Integration test'})).j.data.status,'CANCELLED');
const id=await create();const deposit=await call(`/api/backend/transfers/${id}/deposit`,{});assert.equal(deposit.r.status,200);const final=await call(`/api/backend/transfers/${id}`);assert.equal(final.j.data.status,'COMPLETED');assert.ok(final.j.data.events.length>=7);assert.ok(final.j.data.blockchain_tx_hash);assert.equal((await call('/api/backend/transfers')).j.data.length,2);
const firstCookie=cookie;const second=await call('/api/session',{name:'Other Test Sender'});cookie=second.r.headers.get('set-cookie').split(';')[0];assert.equal((await call(`/api/backend/transfers/${id}`)).r.status,404);cookie=firstCookie;
const logout=await fetch(`${origin}/api/session`,{method:'DELETE',headers:{Origin:origin,Cookie:cookie}});assert.equal(logout.status,200);
console.log('PASS: pages, session protections, route allowlist, validation, three KYC outcomes, quotes, idempotency, cancellation, deposit-to-payout, audit events, ownership isolation, logout.');
