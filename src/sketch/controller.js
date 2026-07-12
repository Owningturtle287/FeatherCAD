import { makeEntity, nearestEntity, offsetEntity, trimEntity, extendEntity, filletLines, translateEntity } from './model.js';
import { solveSketch } from './solver.js';

export class SketchController extends EventTarget {
  constructor(view,store){
    super();this.view=view;this.store=store;this.tool='select';this.points=[];this.moving=null;this.lastPoint=null;this.polyStart=null;
    const svg=view.svg;svg.addEventListener('pointerdown',e=>this.down(e));svg.addEventListener('pointermove',e=>this.move(e));svg.addEventListener('pointerup',e=>this.up(e));svg.addEventListener('dblclick',()=>this.finishPolyline());svg.addEventListener('click',e=>{const g=e.target.closest?.('[data-dimension-id]');if(g)this.dispatchEvent(new CustomEvent('dimension',{detail:{id:g.dataset.dimensionId}}));});
  }
  setTool(tool){this.tool=tool;this.points=[];this.view.setPreview([]);this.dispatchEvent(new CustomEvent('tool',{detail:{tool}}));}
  get sketch(){return this.store.project?.sketches.find(s=>s.id===this.store.project.activeSketchId);}
  down(event){if(!this.sketch)return;event.preventDefault();const point=this.view.pointFromEvent(event),hit=this.view.hit(event);
    if(this.tool==='select'){if(hit)this.view.toggle(hit.id,event.shiftKey);else{this.view.selected.clear();this.view.render();}return;}
    if(this.tool==='delete'){if(hit)this.change('Delete sketch geometry',s=>{s.entities=s.entities.filter(e=>e.id!==hit.id);s.constraints=s.constraints.filter(c=>!c.entityIds.includes(hit.id));s.dimensions=s.dimensions.filter(d=>d.entityId!==hit.id);});return;}
    if(this.tool==='construction'){if(hit)this.change('Toggle construction geometry',()=>hit.construction=!hit.construction);return;}
    if(this.tool==='trim'){if(hit)this.change('Trim geometry',()=>{if(!trimEntity(hit,point))throw new Error('Trim supports lines and circles.');});return;}
    if(this.tool==='extend'){if(hit)this.change('Extend geometry',()=>{if(!extendEntity(hit,point))throw new Error('Extend supports lines.');});return;}
    if(this.tool==='offset'){if(hit)this.change('Offset geometry',s=>s.entities.push(offsetEntity(hit,s.gridSize/2)));return;}
    if(this.tool==='duplicate'){if(hit){const copy=structuredClone(hit);copy.id=crypto.randomUUID();translateEntity(copy,10,10);this.change('Duplicate geometry',s=>s.entities.push(copy));}return;}
    if(this.tool==='move'){if(hit&&!hit.fixed){this.moving=hit;this.lastPoint=point;this.store.undoStack.push({label:'Move geometry',project:structuredClone(this.store.project)});}return;}
    if(this.tool==='fillet'){if(hit){this.view.toggle(hit.id,true);if(this.view.selected.size===2){const [a,b]=[...this.view.selected].map(id=>this.sketch.entities.find(e=>e.id===id)),arc=filletLines(a,b,this.sketch.gridSize/2);if(arc)this.change('Sketch fillet',s=>s.entities.push(arc));else this.error('Select two connected lines.');this.view.selected.clear();}}return;}
    if(this.tool==='project'){this.dispatchEvent(new CustomEvent('project'));return;}
    this.collectPoint(point,event);
  }
  move(event){if(!this.sketch)return;const point=this.view.pointFromEvent(event);if(this.moving&&this.lastPoint){translateEntity(this.moving,point.x-this.lastPoint.x,point.y-this.lastPoint.y);this.lastPoint=point;solveSketch(this.sketch);this.view.render();this.store.dirty=true;this.store.emit('change',{label:'Move geometry'});return;}if(!this.points.length)return;const preview=makeEntity(this.tool,[...this.points,point],{sides:6,width:this.sketch.gridSize});if(preview)this.view.setPreview([preview]);}
  up(){this.moving=null;this.lastPoint=null;}
  collectPoint(point){
    if(this.tool==='polyline'){
      if(!this.polyStart){this.polyStart=point;this.points=[point];return;}const entity=makeEntity('line',[this.polyStart,point]);this.change('Draw polyline segment',s=>s.entities.push(entity));this.polyStart=point;this.points=[point];return;
    }
    this.points.push(point);const required=['centerArc','threeArc'].includes(this.tool)?3:2;if(this.points.length<required)return;const entity=makeEntity(this.tool,this.points,{sides:6,width:this.sketch.gridSize});if(entity)this.change(`Draw ${this.tool}`,s=>s.entities.push(entity));else this.error('Those points cannot define valid geometry.');this.points=[];this.view.setPreview([]);
  }
  finishPolyline(){this.polyStart=null;this.points=[];this.view.setPreview([]);}
  cancel(){this.finishPolyline();this.moving=null;this.setTool('select');}
  change(label,operation){try{this.store.mutate(label,project=>{const sketch=project.sketches.find(s=>s.id===project.activeSketchId);operation(sketch);solveSketch(sketch);});this.view.sketch=this.sketch;this.view.render();}catch(error){this.error(error.message);}}
  error(message){this.dispatchEvent(new CustomEvent('error',{detail:{message}}));}
}
