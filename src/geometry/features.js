import * as THREE from 'three';
import { COLORS } from '../constants.js';
import { profilePoints } from '../sketch/model.js';
import { booleanMeshes } from './csg.js';

const bodyMaterial=()=>new THREE.MeshStandardMaterial({color:COLORS.body,roughness:.55,metalness:.05,side:THREE.DoubleSide});
function shapeFromPoints(points){if(points.length<3)throw new Error('The selected profile has fewer than three points.');const shape=new THREE.Shape();shape.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))shape.lineTo(p.x,p.y);shape.closePath();return shape;}
function orientToPlane(object,planeId){if(planeId==='plane-xz')object.rotation.x=Math.PI/2;else if(planeId==='plane-yz')object.rotation.y=-Math.PI/2;}

export function makeFeatureMesh(feature,project,sourceMesh=null){
  const sketch=project.sketches.find(s=>s.id===feature.sketchId);const profile=sketch?.profiles.find(p=>p.id===feature.profileId)||sketch?.profiles.find(p=>p.valid);
  if(['extrude','cut','revolve','revolveCut'].includes(feature.type)&&(!sketch||!profile||!profile.valid))throw new Error('A valid closed sketch profile is required.');
  const points=profile?profilePoints(sketch,profile):[];let tool;
  if(feature.type==='extrude'||feature.type==='cut'){
    const depth=Math.max(.01,Number(feature.params.depth)||10),geometry=new THREE.ExtrudeGeometry(shapeFromPoints(points),{depth,steps:1,bevelEnabled:!!feature.params.bevel,bevelSize:Number(feature.params.bevel)||0,bevelThickness:Number(feature.params.bevel)||0,bevelSegments:Number(feature.params.bevelSegments)||3});geometry.translate(0,0,feature.params.symmetric?-depth/2:0);tool=new THREE.Mesh(geometry,bodyMaterial());orientToPlane(tool,sketch.planeId);
  }else if(feature.type==='revolve'||feature.type==='revolveCut'){
    const angle=THREE.MathUtils.degToRad(Number(feature.params.angle)||360),segments=Math.max(8,Math.min(128,Number(feature.params.segments)||48));const lathePoints=points.map(p=>new THREE.Vector2(Math.max(.001,Math.abs(p.x)),p.y));tool=new THREE.Mesh(new THREE.LatheGeometry(lathePoints,segments,0,angle),bodyMaterial());orientToPlane(tool,sketch.planeId);
  }else if(feature.type==='fillet'||feature.type==='chamfer'){
    if(!sourceMesh)throw new Error('Fillet or chamfer needs an existing body.');const amount=Math.max(.01,Number(feature.params.amount)||1);const sourceFeature=[...project.features].reverse().find(f=>f.id!==feature.id&&f.outputBodyId===feature.bodyId&&['extrude','revolve'].includes(f.type));
    if(sourceFeature?.type==='extrude')tool=makeFeatureMesh({...sourceFeature,params:{...sourceFeature.params,bevel:amount,bevelSegments:feature.type==='chamfer'?1:5}},project,null);else throw new Error('Reliable fillet/chamfer is limited to bodies created by a single extrusion.');
  }else if(feature.type==='shell'){
    if(!sourceMesh||!sourceMesh.isMesh)throw new Error('Shell needs a single mesh body.');const thickness=Math.max(.01,Number(feature.params.thickness)||1);sourceMesh.geometry.computeBoundingBox();const box=sourceMesh.geometry.boundingBox,size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());if(thickness*2>=Math.min(size.x,size.y)||thickness>=size.z)throw new Error('Shell thickness is too large for this body.');const inner=sourceMesh.clone();inner.geometry=sourceMesh.geometry.clone();const position=inner.geometry.getAttribute('position'),sx=(size.x-2*thickness)/size.x,sy=(size.y-2*thickness)/size.y;for(let i=0;i<position.count;i++){const v=new THREE.Vector3().fromBufferAttribute(position,i);v.x=center.x+(v.x-center.x)*sx;v.y=center.y+(v.y-center.y)*sy;v.z+=thickness;position.setXYZ(i,v.x,v.y,v.z);}position.needsUpdate=true;inner.geometry.computeVertexNormals();inner.updateMatrixWorld(true);sourceMesh.updateMatrixWorld(true);tool=booleanMeshes(sourceMesh,inner,'subtract');inner.geometry.dispose();
  }else throw new Error(`Unsupported mesh feature: ${feature.type}`);
  tool.updateMatrixWorld(true);
  if((feature.type==='cut'||feature.type==='revolveCut')&&sourceMesh){const result=booleanMeshes(sourceMesh,tool,'subtract');tool.geometry.dispose();return result;}
  if((feature.type==='extrude'||feature.type==='revolve')&&sourceMesh&&feature.params.operation==='union'){const result=booleanMeshes(sourceMesh,tool,'union');tool.geometry.dispose();return result;}
  return tool;
}

export function applyBodyFeature(feature,project,bodies){
  const source=bodies.get(feature.bodyId)||null;
  if(['extrude','cut','revolve','revolveCut','fillet','chamfer','shell'].includes(feature.type)){
    const mesh=makeFeatureMesh(feature,project,source);if(source&&mesh!==source)source.geometry?.dispose();return [{id:feature.outputBodyId||feature.bodyId||`body-${feature.id}`,mesh}];
  }
  if(feature.type==='linearPattern'||feature.type==='circularPattern'||feature.type==='mirror'){
    if(!source)throw new Error('Pattern or mirror needs an existing body.');const group=new THREE.Group(),count=Math.max(2,Math.min(50,Number(feature.params.count)||2));
    if(feature.type==='linearPattern'){for(let i=0;i<count;i++){const clone=source.clone();clone.geometry=source.geometry.clone();const axis=feature.params.axis||'x';clone.position[axis]=i*(Number(feature.params.spacing)||20);group.add(clone);}}
    else if(feature.type==='circularPattern'){for(let i=0;i<count;i++){const clone=source.clone();clone.geometry=source.geometry.clone();const a=i*Math.PI*2/count,r=Number(feature.params.radius)||30;clone.position.set(Math.cos(a)*r,0,Math.sin(a)*r);clone.rotation.y=-a;group.add(clone);}}
    else {group.add(source.clone());const clone=source.clone();clone.geometry=source.geometry.clone();clone.scale[feature.params.axis||'x']=-1;group.add(clone);}
    return [{id:feature.outputBodyId||feature.bodyId,mesh:group}];
  }
  if(feature.type==='boolean'){
    const a=bodies.get(feature.params.bodyA),b=bodies.get(feature.params.bodyB);if(!a||!b)throw new Error('Choose two available bodies.');return[{id:feature.outputBodyId||feature.params.bodyA,mesh:booleanMeshes(a,b,feature.params.operation||'union')}];
  }
  return [];
}

export function metricsForObject(object,density=0){
  const box=new THREE.Box3().setFromObject(object),size=box.getSize(new THREE.Vector3());let area=0,volume=0;
  object.traverse(child=>{if(!child.isMesh)return;const g=child.geometry.index?child.geometry.toNonIndexed():child.geometry,pos=g.getAttribute('position');for(let i=0;i<pos.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(child.matrixWorld),b=new THREE.Vector3().fromBufferAttribute(pos,i+1).applyMatrix4(child.matrixWorld),c=new THREE.Vector3().fromBufferAttribute(pos,i+2).applyMatrix4(child.matrixWorld);area+=b.clone().sub(a).cross(c.clone().sub(a)).length()/2;volume+=a.dot(b.clone().cross(c))/6;}if(g!==child.geometry)g.dispose();});volume=Math.abs(volume);return{bounds:[size.x,size.y,size.z],area,volume,mass:volume*density};
}
