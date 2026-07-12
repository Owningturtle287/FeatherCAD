import { detectProfiles } from './sketch/model.js';
import { uid } from './utils.js';

export function createFeature(type, options = {}) {
  const id=uid('feature');
  const defaults={
    extrude:{depth:10,symmetric:false,operation:'new'},cut:{depth:10,symmetric:false},revolve:{angle:360,segments:48,operation:'new'},revolveCut:{angle:360,segments:48},
    fillet:{amount:1},chamfer:{amount:1},shell:{thickness:1},linearPattern:{axis:'x',count:3,spacing:20},circularPattern:{axis:'y',count:4,radius:30},mirror:{axis:'x'},boolean:{operation:'union'},referencePlane:{offset:10,angle:0}
  };
  return{id,name:options.name||type.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase()),type,sketchId:options.sketchId||null,profileId:options.profileId||null,bodyId:options.bodyId||null,outputBodyId:options.outputBodyId||uid('body'),params:{...(defaults[type]||{}),...(options.params||{})},suppressed:false,status:'pending',error:null,lastValid:null};
}

export function validateFeature(feature,project,availableBodies=new Set()) {
  if(feature.suppressed)return null;
  if(['extrude','cut','revolve','revolveCut'].includes(feature.type)){
    const sketch=project.sketches.find(s=>s.id===feature.sketchId);if(!sketch)return'Linked sketch was deleted.';detectProfiles(sketch);const profile=sketch.profiles.find(p=>p.id===feature.profileId)||sketch.profiles.find(p=>p.valid);if(!profile)return'No closed profile is available.';if(!profile.valid)return'The selected profile self-intersects.';
  }
  if(['cut','revolveCut','fillet','chamfer','shell','linearPattern','circularPattern','mirror'].includes(feature.type)&&!availableBodies.has(feature.bodyId))return'The source body is unavailable at this history position.';
  if(feature.type==='boolean'&&(!availableBodies.has(feature.params.bodyA)||!availableBodies.has(feature.params.bodyB)))return'Both Boolean operands must exist earlier in history.';
  return null;
}

export function planRebuild(project) {
  const available=new Set(project.imports.filter(i=>i.bodyId).map(i=>i.bodyId)),steps=[];
  for(const feature of project.features){const error=validateFeature(feature,project,available);steps.push({featureId:feature.id,error});if(!error&&!feature.suppressed&&feature.type!=='referencePlane'){if(feature.type==='boolean')available.delete(feature.params.bodyB);if(feature.bodyId&&feature.outputBodyId&&feature.bodyId!==feature.outputBodyId)available.delete(feature.bodyId);if(feature.outputBodyId)available.add(feature.outputBodyId);else if(feature.bodyId)available.add(feature.bodyId);}}
  return steps;
}

export function syncBodies(project) {
  const previous=new Map(project.bodies.map(body=>[body.id,body])),ids=new Map();
  for(const item of project.imports.filter(i=>i.bodyId))ids.set(item.bodyId,{id:item.bodyId,name:previous.get(item.bodyId)?.name||item.name,visible:previous.get(item.bodyId)?.visible??item.visible??true,sourceFeatureId:null,importId:item.id,metrics:previous.get(item.bodyId)?.metrics||item.metrics||null,density:previous.get(item.bodyId)?.density||0});
  for(const feature of project.features.filter(f=>!f.suppressed&&!f.error&&f.type!=='referencePlane')){if(feature.type==='boolean')ids.delete(feature.params.bodyB);if(feature.bodyId&&feature.outputBodyId&&feature.bodyId!==feature.outputBodyId)ids.delete(feature.bodyId);const id=feature.outputBodyId||feature.bodyId;if(id){const old=previous.get(id)||ids.get(id);ids.set(id,{id,name:old?.name||`Body ${ids.size+1}`,visible:old?.visible??true,sourceFeatureId:feature.id,metrics:old?.metrics||null,density:old?.density||0});}}
  project.bodies=[...ids.values()];
}
