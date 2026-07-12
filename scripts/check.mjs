import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { detectProfiles } from '../src/sketch/model.js';
import { solveSketch } from '../src/sketch/solver.js';

const required=['index.html','styles.css','manifest.webmanifest','service-worker.js','README.md','THIRD_PARTY_LICENSES.md','assets/logo-mark.svg','assets/favicon.svg','assets/apple-touch-icon.png','assets/icon-192.png','assets/icon-512.png','assets/maskable-192.png','assets/maskable-512.png'];
for(const file of required)if(!existsSync(file))throw new Error(`Missing required file: ${file}`);
const walk=dir=>readdirSync(dir).flatMap(name=>{const path=join(dir,name);return statSync(path).isDirectory()?walk(path):[path]});
for(const file of [...walk('src'),'service-worker.js'].filter(f=>f.endsWith('.js')))execFileSync(process.execPath,['--check',file],{stdio:'inherit'});
for(const file of walk('src').filter(f=>f.endsWith('.js'))){const source=readFileSync(file,'utf8');for(const match of source.matchAll(/(?:from\s*|import\s*)["'](\.{1,2}\/[^"']+)["']/g)){const target=new URL(match[1],`file://${process.cwd()}/${file}`).pathname;if(!existsSync(target))throw new Error(`Broken local import in ${file}: ${match[1]}`);}}
JSON.parse(readFileSync('manifest.webmanifest','utf8'));
const sketch={entities:[
  {id:'a',type:'line',a:{x:0,y:0},b:{x:10,y:0}},
  {id:'b',type:'line',a:{x:10,y:0},b:{x:10,y:10}},
  {id:'c',type:'line',a:{x:10,y:10},b:{x:0,y:10}},
  {id:'d',type:'line',a:{x:0,y:10},b:{x:0,y:0}}
],constraints:[],dimensions:[],profiles:[],errors:[]};
if(!detectProfiles(sketch).some(p=>p.valid))throw new Error('Closed-profile test failed.');
if(solveSketch(sketch).status!=='under')throw new Error('Constraint-state test failed.');
console.log(`FeatherCAD check passed: ${walk('src').length} source files, assets present, syntax valid, sketch core valid.`);
