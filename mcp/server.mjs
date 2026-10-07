import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {z} from 'zod';
const base=process.env.CORRIDOR_API_URL||'http://127.0.0.1:4100';
const server=new McpServer({name:'corridor-remittance',version:'1.0.0'});
async function request(path,body){const token=process.env.CORRIDOR_ACCESS_TOKEN;if(path!=='health'&&!token)throw new Error('Set CORRIDOR_ACCESS_TOKEN to an authenticated user JWT.');const r=await fetch(`${base}/${path}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});const j=await r.json();if(!r.ok)throw new Error(j.error?.message||`Backend returned ${r.status}`);return j;}
function tool(name,description,inputSchema,handler,readOnly=true){server.registerTool(name,{description,inputSchema,annotations:{readOnlyHint:readOnly,destructiveHint:false,idempotentHint:readOnly,openWorldHint:false}},async args=>{try{return{content:[{type:'text',text:JSON.stringify(await handler(args))}]};}catch(e){return{isError:true,content:[{type:'text',text:e.message||'Request failed'}]};}})}
tool('service_health','Check whether the Corridor API is available.',{},()=>request('health'));
tool('create_quote','Create a simulated AED to INR quote valid for 60 seconds. Amount is an integer in fils; 100000 means AED 1000. No transfer is initiated.',{send_amount_minor:z.number().int().min(504).max(100000000)},({send_amount_minor})=>request('quotes',{sourceCurrency:'AED',targetCurrency:'INR',sendAmountMinor:send_amount_minor}),false);
tool('list_transfers','List transfers belonging to the authenticated user.',{},()=>request('transfers'));
tool('get_transfer','Get one transfer and its event timeline, subject to backend ownership checks.',{transfer_id:z.string().uuid()},({transfer_id})=>request(`transfers/${transfer_id}`));
tool('identity_status','Read the authenticated user’s verification status without returning identity fields.',{},async()=>{const j=await request('kyc/status');return{status:j.data.status}});
server.registerResource('prototype-scope','corridor://scope',{description:'Corridor prototype scope and supported tools',mimeType:'text/plain'},async uri=>({contents:[{uri:uri.href,text:'Corridor is an AED to INR hackathon prototype. Fiat rails, KYC and the default chain adapter are simulated. This server can inspect transfers and create quotes. It cannot initiate transfers, simulate deposits, change identities, or approve AML reviews. Never interpret simulated payout status as a real payment.'}]}));
await server.connect(new StdioServerTransport());
