import {vi} from 'vitest';
const rates={AED:3.6725,INR:96.43,EUR:.88985,GBP:.75409,CAD:1.4224,AUD:1.4349,SGD:1.2784,JPY:158.21,KWD:.3088};
vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(Object.entries(rates).map(([quote,rate])=>({base:'USD',quote,rate,date:new Date().toISOString().slice(0,10)}))))));
