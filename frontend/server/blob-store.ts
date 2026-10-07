import {get,put,BlobPreconditionFailedError} from '@vercel/blob';
import {StorageConflict} from './session-engine.mjs';
// Compression weakens HTTP ETags; request identity encoding so CAS uses the stored version.
export const blobStore={
 async read(path:string){const result=await get(path,{access:'private',useCache:false,headers:{'accept-encoding':'identity'}});if(!result)return null;if(!result.stream)throw new Error('Private store returned no content');return{data:JSON.parse(await new Response(result.stream).text()),etag:result.blob.etag}},
 async write(path:string,body:string,etag?:string){try{await put(path,body,{access:'private',addRandomSuffix:false,allowOverwrite:!!etag,...(etag?{ifMatch:etag}:{}),contentType:'application/json',cacheControlMaxAge:60})}catch(error){if(error instanceof BlobPreconditionFailedError||(error instanceof Error&&/already exists/i.test(error.message)))throw new StorageConflict('Concurrent demo update');throw error}}
};
