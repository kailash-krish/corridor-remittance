import {NextRequest,NextResponse} from 'next/server';
import {jwtVerify} from 'jose';
import {runPersistedRequest} from './session-engine.mjs';
import {blobStore} from './blob-store';
export async function hostedHandler(req:NextRequest,path:string,token?:string){
 if(path==='quotes/estimate'&&req.method==='GET'){const {fxService}=await import('./core/services/fxService.js');try{const q=req.nextUrl.searchParams;const data=await fxService.calculateQuote(q.get('source')||'',q.get('target')||'',Number(q.get('amount')));return NextResponse.json({data},{headers:{'Cache-Control':'no-store'}})}catch(error){const e=error as {statusCode?:number;message?:string};return NextResponse.json({error:{message:e.message||'Rates unavailable'}},{status:e.statusCode||503})}}
 const configured=!!(process.env.BLOB_READ_WRITE_TOKEN||process.env.BLOB_STORE_ID);
 if(path==='health')return NextResponse.json({status:configured?'ok':'unconfigured',mode:'hosted-demo',storage:'private-blob'},{status:configured?200:503});
 if(!configured||!process.env.DEMO_JWT_SECRET)return NextResponse.json({error:{message:'The hosted demo is not configured yet.'}},{status:503});
 let userId:string;try{const {payload}=await jwtVerify(token||'',new TextEncoder().encode(process.env.DEMO_JWT_SECRET),{algorithms:['HS256']});if(!payload.sub||!/^[a-f0-9-]{36}$/.test(payload.sub))throw new Error('Invalid session');userId=payload.sub}catch{return NextResponse.json({error:{message:'Your demo session expired. Please sign in again.'}},{status:401})}
 const body=req.method==='GET'?undefined:await req.text();if(body&&Buffer.byteLength(body)>8192)return NextResponse.json({error:{message:'Request too large.'}},{status:413});
 const headers:Record<string,string>={'content-type':'application/json',authorization:`Bearer ${token}`};const key=req.headers.get('idempotency-key');if(key)headers['idempotency-key']=key;
 try{const result=await runPersistedRequest({userId,event:{httpMethod:req.method,path:`/${path}`,headers,body,isBase64Encoded:false,requestContext:{requestId:crypto.randomUUID(),identity:{sourceIp:'127.0.0.1'}}}},blobStore) as {statusCode:number;body:string};return new NextResponse(result.body,{status:result.statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})}catch(error){console.error('Hosted demo request failed:',error instanceof Error?error.name:'storage error');return NextResponse.json({error:{message:'The demo storage service is temporarily unavailable. Please retry.'}},{status:503})}
}
