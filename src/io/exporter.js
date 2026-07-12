import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { downloadBlob, safeName } from '../utils.js';
import { profilePoints } from '../sketch/model.js';

export async function exportProject({format,project,renderer,scope='all',binary=true,includeHidden=false,sketchId=null}){
  const name=safeName(project.name);if(format==='feathercad'||format==='fcd'){downloadBlob(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),`${name}.feathercad`);return;}
  if(['step','stp','iges','igs'].includes(format))throw new Error('Exact STEP/IGES export is unavailable without an Open Cascade B-rep kernel.');
  if(format==='png'){const blob=await renderer.snapshot();if(!blob)throw new Error('The viewport image could not be encoded.');downloadBlob(blob,`${name}.png`);return;}
  if(format==='svg'||format==='dxf'){const sketch=project.sketches.find(s=>s.id===(sketchId||project.selectedId))||project.sketches[0];if(!sketch)throw new Error('The project has no sketch to export.');const text=format==='svg'?sketchSVG(sketch):sketchDXF(sketch);downloadBlob(new Blob([text],{type:format==='svg'?'image/svg+xml':'application/dxf'}),`${name}.${format}`);return;}
  const object=exportObject(renderer,scope,includeHidden);if(!object)throw new Error('There is no visible body to export.');
  if(format==='stl'){const data=new STLExporter().parse(object,{binary});downloadBlob(new Blob([data],{type:'model/stl'}),`${name}.stl`);}
  else if(format==='obj'){const data=new OBJExporter().parse(object);downloadBlob(new Blob([data],{type:'text/plain'}),`${name}.obj`);}
  else if(format==='gltf'||format==='glb'){const data=await new Promise((resolve,reject)=>new GLTFExporter().parse(object,resolve,reject,{binary:format==='glb',onlyVisible:!includeHidden}));downloadBlob(new Blob([format==='glb'?data:JSON.stringify(data)],{type:format==='glb'?'model/gltf-binary':'model/gltf+json'}),`${name}.${format}`);}
  else throw new Error(`.${format} export is not supported by this build.`);
}

function exportObject(renderer,scope,includeHidden){if(scope==='selected'&&renderer.selected)return renderer.findById(renderer.selected);const group=renderer.modelGroup.clone();group.children=group.children.filter(o=>includeHidden||o.visible);return group.children.length?group:null;}
function sketchSVG(sketch){const pts=sketch.entities.flatMap(e=>Object.values(e).filter(v=>v&&Number.isFinite(v.x))),minX=Math.min(0,...pts.map(p=>p.x)),maxX=Math.max(100,...pts.map(p=>p.x)),minY=Math.min(0,...pts.map(p=>p.y)),maxY=Math.max(100,...pts.map(p=>p.y));let body='';for(const e of sketch.entities.filter(e=>!e.construction)){if(e.type==='line')body+=`<line x1="${e.a.x}" y1="${-e.a.y}" x2="${e.b.x}" y2="${-e.b.y}"/>`;else if(e.type==='circle')body+=`<circle cx="${e.c.x}" cy="${-e.c.y}" r="${e.r}"/>`;else if(e.type==='rect'){const p=profilePoints(sketch,{entityIds:[e.id]});body+=`<polygon points="${p.map(v=>`${v.x},${-v.y}`).join(' ')}"/>`;}else if(e.points)body+=`<${e.type==='polygon'?'polygon':'polyline'} points="${e.points.map(v=>`${v.x},${-v.y}`).join(' ')}"/>`;}return`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${-maxY} ${maxX-minX} ${maxY-minY}" fill="none" stroke="#007ba7" stroke-width="0.5">${body}</svg>`;}
function sketchDXF(sketch){const rows=['0','SECTION','2','ENTITIES'];for(const e of sketch.entities.filter(e=>!e.construction)){if(e.type==='line')rows.push('0','LINE','8','0','10',String(e.a.x),'20',String(e.a.y),'30','0','11',String(e.b.x),'21',String(e.b.y),'31','0');if(e.type==='circle')rows.push('0','CIRCLE','8','0','10',String(e.c.x),'20',String(e.c.y),'30','0','40',String(e.r));}rows.push('0','ENDSEC','0','EOF');return rows.join('\n');}
