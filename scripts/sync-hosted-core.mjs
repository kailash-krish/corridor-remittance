import {cpSync,mkdirSync} from 'node:fs';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
mkdirSync(root+'frontend/server/core',{recursive:true});
cpSync(root+'backend/dist',root+'frontend/server/core',{recursive:true});
console.log('Synced compiled backend into the Vercel deployment package.');
