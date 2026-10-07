import {existsSync,readFileSync,writeFileSync} from 'node:fs';import {randomBytes} from 'node:crypto';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
for(const folder of ['frontend','backend','mcp']){const r=spawnSync('npm',['ci'],{cwd:root+folder,stdio:'inherit'});if(r.status!==0)process.exit(r.status||1)}
const backend=root+'backend/.env',frontend=root+'frontend/.env.local';
let key;if(existsSync(backend)){key=readFileSync(backend,'utf8').match(/^SUPABASE_JWT_SECRET=(.+)$/m)?.[1];if(!key&&!existsSync(frontend))throw new Error('Existing backend configuration needs SUPABASE_JWT_SECRET before setting up demo sessions.');}else{key=randomBytes(32).toString('hex');writeFileSync(backend,`PORT=4100\nHOST=127.0.0.1\nNODE_ENV=development\nSUPABASE_JWT_SECRET=${key}\n`,{mode:0o600})}
if(!existsSync(frontend))writeFileSync(frontend,`BACKEND_URL=http://127.0.0.1:4100\nAPP_ORIGIN=http://127.0.0.1:3100\nDEMO_MODE=true\nDEMO_JWT_SECRET=${key}\n`,{mode:0o600});
console.log('Dependencies installed. Existing configuration preserved. Run npm run dev.');
