import {createHash} from 'node:crypto';
import serverless from 'serverless-http';
import appModule from './core/app.js';
import repository from './core/db/repository.js';
import scopeModule from './core/db/requestScope.js';
const handler=serverless(appModule.app);
const maps=['kycRecords','quotes','transfers','amlFlags','idempotencyKeys'];
const arrays=['transferEvents','notifications'];
export class StorageConflict extends Error {}
export function snapshot(database){return {version:1,...Object.fromEntries(maps.map(name=>[name,[...database[name].entries()]])),...Object.fromEntries(arrays.map(name=>[name,database[name]]))};}
function restore(data){const db=new repository.InMemoryDatabase();if(!data)return db;if(data.version!==1)throw new Error('Unsupported demo data version');for(const name of maps){if(!Array.isArray(data[name]))throw new Error('Invalid stored demo data');db[name]=new Map(data[name])}for(const name of arrays){if(!Array.isArray(data[name]))throw new Error('Invalid stored demo data');db[name]=data[name]}return db}
const failure=(statusCode,message)=>({statusCode,body:JSON.stringify({error:{message}}),headers:{'content-type':'application/json'}});
/** A complete API request is committed atomically with a compare-and-swap write. */
export async function runPersistedRequest({userId,event},store){
 const key=`demo-sessions/${createHash('sha256').update(userId).digest('hex')}.json`;
 for(let attempt=0;attempt<4;attempt++){
  const saved=await store.read(key);const database=restore(saved?.data);const before=JSON.stringify(snapshot(database));
  if(event.httpMethod==='POST'&&event.path==='/quotes'&&database.quotes.size>=50)return failure(429,'This demo session has reached its 50-quote limit. Start a new session to continue.');
  if(event.httpMethod==='POST'&&event.path==='/transfers'&&database.transfers.size>=20)return failure(429,'This demo session has reached its 20-transfer limit. Start a new session to continue.');
  const result=await scopeModule.databaseScope.run(database,()=>handler(event,{callbackWaitsForEmptyEventLoop:false}));
  const after=JSON.stringify(snapshot(database));
  if(after!==before){try{await store.write(key,after,saved?.etag)}catch(error){if(error instanceof StorageConflict)continue;throw error}}
  return result;
 }
 return failure(409,'Another request updated this session. Please retry.');
}
