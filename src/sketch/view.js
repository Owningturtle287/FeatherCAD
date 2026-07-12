import { COLORS } from '../constants.js';
import { distance, escapeHTML } from '../utils.js';
import { detectProfiles, nearestEntity, rectPoints, snapPoint } from './model.js';

const SVG_NS='http://www.w3.org/2000/svg';
export class SketchView extends EventTarget {
  constructor(svg) {
    super(); this.svg=svg; this.sketch=null; this.scale=1; this.center={x:0,y:0}; this.selected=new Set(); this.preview=[]; this.snap=null;
    this.resizeObserver=new ResizeObserver(()=>this.render()); this.resizeObserver.observe(svg);
  }
  setSketch(sketch){this.sketch=sketch;this.selected.clear();this.fit();}
  fit(){if(!this.sketch)return;const points=this.sketch.entities.flatMap(e=>Object.values(e).filter(v=>v&&typeof v==='object'&&Number.isFinite(v.x)));if(points.length){const xs=points.map(p=>p.x),ys=points.map(p=>p.y);this.center={x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2};this.scale=Math.min(8,Math.max(.5,Math.min(this.svg.clientWidth/(Math.max(...xs)-Math.min(...xs)+50),this.svg.clientHeight/(Math.max(...ys)-Math.min(...ys)+50))));}this.render();}
  screenToWorld(clientX,clientY){const r=this.svg.getBoundingClientRect();return{x:(clientX-r.left-r.width/2)/this.scale+this.center.x,y:-(clientY-r.top-r.height/2)/this.scale+this.center.y};}
  worldToScreen(p){return{x:(p.x-this.center.x)*this.scale+this.svg.clientWidth/2,y:(this.center.y-p.y)*this.scale+this.svg.clientHeight/2};}
  pointFromEvent(event,{snap=true}={}){const p=this.screenToWorld(event.clientX,event.clientY);if(!snap||!this.sketch)return p;const result=snapPoint(p,this.sketch,{threshold:10/this.scale,grid:true});this.snap=result;return result.point;}
  hit(event){const point=this.screenToWorld(event.clientX,event.clientY);return nearestEntity(point,this.sketch,10/this.scale)?.entity||null;}
  toggle(id,add=false){if(!add)this.selected.clear();if(this.selected.has(id))this.selected.delete(id);else this.selected.add(id);this.render();this.dispatchEvent(new CustomEvent('selection',{detail:{ids:[...this.selected]}}));}
  setPreview(entities){this.preview=entities||[];this.render();}
  render(){
    if(!this.sketch)return; const width=this.svg.clientWidth||1,height=this.svg.clientHeight||1;this.svg.setAttribute('viewBox',`0 0 ${width} ${height}`);this.svg.replaceChildren();
    this.drawGrid(width,height); const validIds=new Set(detectProfiles(this.sketch).filter(p=>p.valid).flatMap(p=>p.entityIds));
    for(const entity of this.sketch.entities)this.drawEntity(entity,{profile:validIds.has(entity.id),selected:this.selected.has(entity.id)});
    for(const entity of this.preview)this.drawEntity(entity,{preview:true});
    for(const dimension of this.sketch.dimensions)this.drawDimension(dimension);
    if(this.snap?.kind){const p=this.worldToScreen(this.snap.point);this.node('circle',{cx:p.x,cy:p.y,r:6,class:'sketch-snap'});this.node('text',{x:p.x+9,y:p.y-9,class:'sketch-snap-label'},this.snap.kind);}
  }
  drawGrid(width,height){const spacing=Math.max(12,(this.sketch.gridSize||10)*this.scale),ox=width/2-(this.center.x*this.scale)%spacing,oy=height/2+(this.center.y*this.scale)%spacing;const group=this.node('g',{class:'sketch-grid'});for(let x=ox%spacing;x<width;x+=spacing)this.node('line',{x1:x,y1:0,x2:x,y2:height},null,group);for(let y=oy%spacing;y<height;y+=spacing)this.node('line',{x1:0,y1:y,x2:width,y2:y},null,group);const o=this.worldToScreen({x:0,y:0});this.node('line',{x1:0,y1:o.y,x2:width,y2:o.y,class:'axis x'},null,group);this.node('line',{x1:o.x,y1:0,x2:o.x,y2:height,class:'axis y'},null,group);}
  drawEntity(entity,state={}){const cls=['sketch-entity',`status-${this.sketch.status}`,entity.construction?'construction':'',entity.projected?'projected':'',state.profile?'valid-profile':'',state.selected?'selected':'',state.preview?'preview':''].filter(Boolean).join(' ');const p=x=>this.worldToScreen(x);let node;
    if(entity.type==='line'){const a=p(entity.a),b=p(entity.b);node=this.node('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:cls});this.point(a);this.point(b);}
    else if(entity.type==='polyline'||entity.type==='polygon'){node=this.node(entity.type==='polygon'?'polygon':'polyline',{points:entity.points.map(x=>{const q=p(x);return`${q.x},${q.y}`}).join(' '),class:cls});}
    else if(entity.type==='rect'){const pts=rectPoints(entity).map(p);node=this.node('polygon',{points:pts.map(q=>`${q.x},${q.y}`).join(' '),class:cls});}
    else if(entity.type==='circle'){const c=p(entity.c);node=this.node('circle',{cx:c.x,cy:c.y,r:entity.r*this.scale,class:cls});this.point(c);}
    else if(entity.type==='arc'){const a=p(entity.a),b=p(entity.b);node=this.node('path',{d:`M ${a.x} ${a.y} A ${entity.r*this.scale} ${entity.r*this.scale} 0 0 0 ${b.x} ${b.y}`,class:cls});}
    else if(entity.type==='slot'){const a=p(entity.a),b=p(entity.b),w=entity.width*this.scale;node=this.node('path',{d:`M ${a.x} ${a.y} L ${b.x} ${b.y}`,class:`${cls} slot`,style:`stroke-width:${w}px`});this.node('path',{d:`M ${a.x} ${a.y} L ${b.x} ${b.y}`,class:cls});}
    if(node){node.dataset.id=entity.id;node.setAttribute('tabindex','0');}
  }
  drawDimension(d){const p=this.worldToScreen(d);const text=`${Number(d.value).toFixed(2)} ${d.type==='angle'?'°':''}`;const g=this.node('g',{class:'sketch-dimension',role:'button','aria-label':`Edit ${d.type} ${text}`});this.node('rect',{x:p.x-34,y:p.y-14,width:68,height:24,rx:6},null,g);const t=this.node('text',{x:p.x,y:p.y+3,'text-anchor':'middle'},text,g);g.dataset.dimensionId=d.id;}
  point(p){this.node('circle',{cx:p.x,cy:p.y,r:3,class:'sketch-point'});}
  node(name,attrs={},text=null,parent=this.svg){const n=document.createElementNS(SVG_NS,name);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==null)n.textContent=text;parent.appendChild(n);return n;}
}
