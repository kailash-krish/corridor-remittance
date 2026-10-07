import {spawn} from 'node:child_process';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const children=['backend','frontend'].map(folder=>spawn('npm',['run','dev'],{cwd:root+folder,stdio:'inherit'}));
let stopping=false;function stop(){if(stopping)return;stopping=true;for(const child of children)child.kill('SIGTERM')}
process.on('SIGINT',stop);process.on('SIGTERM',stop);for(const child of children)child.on('exit',code=>{if(!stopping){process.exitCode=code||0;stop()}});
