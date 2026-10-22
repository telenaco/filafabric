// Rebuild the source offer after changing the app or its vendored slicing kernel.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const run=(cmd,args)=>{
  const result=spawnSync(cmd,args,{cwd:root,encoding:'utf8'});
  if(result.status!==0) throw new Error(`${cmd}: ${result.stderr||result.error}`);
  return result.stdout;
};
const target='vendor/arachne/filafabric-source.tar.gz';
const files=[...new Set(run('git',['ls-files','--cached','--others','--exclude-standard','-z','--','.']).split('\0'))]
  .filter(p=>p && p!==target && fs.existsSync(path.join(root,p)) && fs.statSync(path.join(root,p)).isFile()).sort();
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'filafabric-source-'));
try {
  const list=path.join(temp,'files.txt');fs.writeFileSync(list,files.join('\n')+'\n');
  run('tar',['-czf',target,'-T',list]);
} finally {fs.rmSync(temp,{recursive:true,force:true});}
const hash=file=>createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
console.log(JSON.stringify({archive:target,files:files.length,sha256:hash(target)}));
