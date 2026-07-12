import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';
import { MAX_IMPORT_BYTES } from '../constants.js';
import { fileBase, uid } from '../utils.js';

export class ImportManager extends EventTarget {
  constructor(){super();this.worker=null;}
  async import(file){
    if(file.size>MAX_IMPORT_BYTES)throw new Error(`File exceeds the ${MAX_IMPORT_BYTES/1048576} MB browser limit.`);
    const ext=file.name.split('.').pop().toLowerCase();
    if(['feathercad','fcd'].includes(ext))return this.native(file);
    if(['step','stp','iges','igs'].includes(ext))throw new Error('STEP and IGES require an exact Open Cascade WASM kernel, which this lightweight build does not bundle.');
    if(['gltf','glb','3mf'].includes(ext))return this.threeLoader(file,ext);
    if(!['stl','obj','dxf','svg'].includes(ext))throw new Error(`.${ext || 'unknown'} is not supported.`);
    const buffer=await file.arrayBuffer();return new Promise((resolve,reject)=>{
      this.worker=new Worker(new URL('../workers/import-worker.js',import.meta.url),{type:'module'});
      this.worker.onmessage=event=>{const {type,result,error,progress}=event.data;if(type==='progress')this.dispatchEvent(new CustomEvent('progress',{detail:{progress}}));else{this.worker?.terminate();this.worker=null;if(error)reject(new Error(error));else resolve({...result,id:uid('import'),name:fileBase(file.name),fileName:file.name});}};
      this.worker.onerror=event=>{this.worker?.terminate();this.worker=null;reject(new Error(event.message||'Import worker failed.'));};
      this.worker.postMessage({buffer,ext,name:file.name},[buffer]);
    });
  }
  cancel(){this.worker?.terminate();this.worker=null;this.dispatchEvent(new CustomEvent('cancel'));}
  async native(file){let parsed;try{parsed=JSON.parse(await file.text());}catch{throw new Error('The FeatherCAD file is not valid JSON.');}if(parsed.format!=='FeatherCAD'||!Array.isArray(parsed.features)||!Array.isArray(parsed.sketches))throw new Error('The file is not a valid FeatherCAD project.');return{kind:'native',project:parsed};}
  async threeLoader(file,ext){
    const url=URL.createObjectURL(file);try{const object=await new Promise((resolve,reject)=>{if(ext==='3mf')new ThreeMFLoader().load(url,resolve,undefined,reject);else new GLTFLoader().load(url,gltf=>resolve(gltf.scene),undefined,reject);});const meshes=[];object.updateMatrixWorld(true);object.traverse(child=>{if(!child.isMesh)return;const g=child.geometry.index?child.geometry.toNonIndexed():child.geometry;const p=g.getAttribute('position'),positions=[];for(let i=0;i<p.count;i++){const v=child.localToWorld(new THREE.Vector3().fromBufferAttribute(p,i));positions.push(v.x,v.y,v.z);}meshes.push({positions});if(g!==child.geometry)g.dispose();});if(!meshes.length)throw new Error('No mesh geometry was found.');const positions=meshes.flatMap(m=>m.positions);return{id:uid('import'),name:fileBase(file.name),fileName:file.name,kind:'mesh',parametric:false,format:ext,bodyId:uid('body'),meshData:{positions},warnings:['Imported as a non-parametric mesh.']};}finally{URL.revokeObjectURL(url);}
  }
}

export const importer=new ImportManager();
