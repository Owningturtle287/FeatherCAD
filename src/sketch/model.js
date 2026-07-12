import { distance, midpoint, round, uid } from '../utils.js';

export function createSketch(planeId, name = 'Sketch') {
  return { id: uid('sketch'), name, planeId, visible: true, status: 'under', entities: [], constraints: [], dimensions: [], profiles: [], errors: [], gridSize: 10 };
}

export function entityPoints(entity) {
  switch (entity.type) {
    case 'line': return [entity.a, entity.b];
    case 'polyline': case 'polygon': return entity.points;
    case 'rect': return rectPoints(entity);
    case 'circle': return [entity.c];
    case 'arc': return [entity.c, entity.a, entity.b].filter(Boolean);
    case 'slot': return [entity.a, entity.b];
    default: return entity.points || [];
  }
}

export function rectPoints(entity) {
  if (entity.mode === 'center') {
    const dx = Math.abs(entity.p.x - entity.c.x), dy = Math.abs(entity.p.y - entity.c.y);
    return [{x:entity.c.x-dx,y:entity.c.y-dy},{x:entity.c.x+dx,y:entity.c.y-dy},{x:entity.c.x+dx,y:entity.c.y+dy},{x:entity.c.x-dx,y:entity.c.y+dy}];
  }
  return [{x:entity.a.x,y:entity.a.y},{x:entity.b.x,y:entity.a.y},{x:entity.b.x,y:entity.b.y},{x:entity.a.x,y:entity.b.y}];
}

export function makeEntity(tool, points, options = {}) {
  const base = { id: uid('entity'), construction: false, projected: false };
  if (tool === 'line') return { ...base, type: 'line', a: points[0], b: points[1] };
  if (tool === 'polyline') return { ...base, type: 'polyline', points };
  if (tool === 'cornerRect') return { ...base, type: 'rect', mode: 'corner', a: points[0], b: points[1] };
  if (tool === 'centerRect') return { ...base, type: 'rect', mode: 'center', c: points[0], p: points[1] };
  if (tool === 'circle') return { ...base, type: 'circle', c: points[0], r: distance(points[0], points[1]) };
  if (tool === 'centerArc') {
    const c = points[0]; return { ...base, type: 'arc', mode: 'center', c, a: points[1], b: points[2], r: distance(c, points[1]) };
  }
  if (tool === 'threeArc') {
    const circle = circleFrom3(points[0], points[1], points[2]);
    return circle ? { ...base, type: 'arc', mode: 'three', c: circle.c, r: circle.r, a: points[0], through: points[1], b: points[2] } : null;
  }
  if (tool === 'polygon') {
    const c = points[0], r = distance(c, points[1]), sides = options.sides || 6;
    const angle = Math.atan2(points[1].y-c.y, points[1].x-c.x);
    return { ...base, type: 'polygon', c, sides, points: Array.from({length:sides},(_,i)=>({x:c.x+r*Math.cos(angle+i*Math.PI*2/sides),y:c.y+r*Math.sin(angle+i*Math.PI*2/sides)})) };
  }
  if (tool === 'slot') return { ...base, type: 'slot', a: points[0], b: points[1], width: options.width || Math.max(4, distance(points[0], points[1]) * .25) };
  return null;
}

export function snapPoint(point, sketch, options = {}) {
  const threshold = options.threshold || 7;
  let best = null;
  const candidates = [];
  for (const entity of sketch.entities) {
    for (const p of entityPoints(entity)) candidates.push({ ...p, kind: entity.projected ? 'projected' : 'endpoint' });
    if (entity.type === 'line') candidates.push({ ...midpoint(entity.a, entity.b), kind: 'midpoint' });
    if (entity.c) candidates.push({ ...entity.c, kind: 'center' });
  }
  for (const candidate of candidates) {
    const d = distance(point, candidate); if (d <= threshold && (!best || d < best.distance)) best = { point: {x:candidate.x,y:candidate.y}, kind:candidate.kind, distance:d };
  }
  if (best) return best;
  if (options.grid !== false) {
    const size = sketch.gridSize || 10;
    return { point: { x: round(point.x / size) * size, y: round(point.y / size) * size }, kind: 'grid' };
  }
  return { point, kind: null };
}

export function nearestEntity(point, sketch, tolerance = 6) {
  let hit = null;
  for (const entity of sketch.entities) {
    let d = Infinity;
    if (entity.type === 'circle') d = Math.abs(distance(point, entity.c) - entity.r);
    else if (entity.type === 'arc') d = Math.abs(distance(point, entity.c) - entity.r);
    else if (entity.type === 'line') d = pointSegmentDistance(point, entity.a, entity.b);
    else if (entity.type === 'rect' || entity.type === 'polygon' || entity.type === 'polyline') {
      const pts = entity.type === 'rect' ? rectPoints(entity) : entity.points;
      for (let i=0;i<pts.length-(entity.type==='polyline'?1:0);i++) d = Math.min(d, pointSegmentDistance(point, pts[i], pts[(i+1)%pts.length]));
    } else if (entity.type === 'slot') d = Math.min(pointSegmentDistance(point, entity.a, entity.b), Math.abs(distance(point, entity.a)-entity.width/2), Math.abs(distance(point, entity.b)-entity.width/2));
    if (d <= tolerance && (!hit || d < hit.distance)) hit = { entity, distance: d };
  }
  return hit;
}

export function translateEntity(entity, dx, dy) {
  const moved = new Set();
  const shift = p => { if (!p || moved.has(p)) return; p.x += dx; p.y += dy; moved.add(p); };
  for (const key of ['a','b','c','p','through']) shift(entity[key]);
  (entity.points || []).forEach(shift);
}

export function offsetEntity(entity, amount = 5) {
  const copy = structuredClone(entity); copy.id = uid('entity'); copy.projected = false;
  if (copy.type === 'circle' || copy.type === 'arc') copy.r = Math.max(.1, copy.r + amount);
  else translateEntity(copy, amount, amount);
  return copy;
}

export function trimEntity(entity, point) {
  if (entity.type === 'line') {
    if (distance(point, entity.a) < distance(point, entity.b)) entity.a = midpoint(entity.a, entity.b); else entity.b = midpoint(entity.a, entity.b);
    return true;
  }
  if (entity.type === 'circle') {
    entity.type = 'arc'; entity.a = {x:entity.c.x+entity.r,y:entity.c.y}; entity.b = {x:entity.c.x-entity.r,y:entity.c.y}; return true;
  }
  return false;
}

export function extendEntity(entity, point, amount = 10) {
  if (entity.type !== 'line') return false;
  const target = distance(point, entity.a) < distance(point, entity.b) ? 'a' : 'b';
  const other = target === 'a' ? entity.b : entity.a; const p = entity[target]; const length = distance(p, other) || 1;
  p.x += (p.x-other.x)/length*amount; p.y += (p.y-other.y)/length*amount; return true;
}

export function filletLines(a, b, radius = 5) {
  if (a.type !== 'line' || b.type !== 'line') return null;
  const pairs = [[a.a,b.a],[a.a,b.b],[a.b,b.a],[a.b,b.b]].sort((p,q)=>distance(...p)-distance(...q));
  const [pa,pb] = pairs[0]; if (distance(pa,pb) > 8) return null;
  const c = midpoint(pa,pb); return { id:uid('entity'), type:'arc', mode:'fillet', c, r:radius, a:{x:c.x+radius,y:c.y}, b:{x:c.x,y:c.y+radius}, construction:false, projected:false };
}

export function detectProfiles(sketch) {
  const profiles = [];
  for (const entity of sketch.entities.filter(e => !e.construction)) {
    if (entity.type === 'circle' || entity.type === 'rect' || entity.type === 'polygon' || entity.type === 'slot') profiles.push({ id:`profile-${entity.id}`, entityIds:[entity.id], closed:true, valid:true });
  }
  const lines = sketch.entities.filter(e => !e.construction && e.type === 'line');
  const unused = new Set(lines.map(l=>l.id));
  while (unused.size) {
    const first = lines.find(l=>unused.has(l.id)); unused.delete(first.id);
    const chain = [first]; let end = first.b; let guard = 0;
    while (guard++ < lines.length) {
      const next = lines.find(l => unused.has(l.id) && (distance(l.a,end)<.01 || distance(l.b,end)<.01));
      if (!next) break; unused.delete(next.id); chain.push(next); end = distance(next.a,end)<.01 ? next.b : next.a;
      if (distance(end, first.a)<.01) { profiles.push({ id:`profile-${first.id}`, entityIds:chain.map(l=>l.id), closed:true, valid:!hasSelfIntersection(chain) }); break; }
    }
  }
  sketch.profiles = profiles;
  return profiles;
}

export function profilePoints(sketch, profile) {
  const entities = profile.entityIds.map(id=>sketch.entities.find(e=>e.id===id)).filter(Boolean);
  if (entities.length === 1) {
    const e = entities[0];
    if (e.type === 'rect') return rectPoints(e);
    if (e.type === 'polygon') return e.points;
    if (e.type === 'circle') return Array.from({length:48},(_,i)=>({x:e.c.x+e.r*Math.cos(i*Math.PI*2/48),y:e.c.y+e.r*Math.sin(i*Math.PI*2/48)}));
    if (e.type === 'slot') return slotPoints(e);
  }
  if (entities.every(e=>e.type==='line')) {
    const result = [entities[0].a, entities[0].b];
    for (const line of entities.slice(1)) { const end=result[result.length-1]; result.push(distance(line.a,end)<.01?line.b:line.a); }
    return result;
  }
  return [];
}

export function slotPoints(e) {
  const angle = Math.atan2(e.b.y-e.a.y,e.b.x-e.a.x), r=e.width/2;
  const pts=[];
  for(let i=0;i<=12;i++){const t=angle+Math.PI/2+i*Math.PI/12;pts.push({x:e.b.x+r*Math.cos(t),y:e.b.y+r*Math.sin(t)});}
  for(let i=0;i<=12;i++){const t=angle-Math.PI/2+i*Math.PI/12;pts.push({x:e.a.x+r*Math.cos(t),y:e.a.y+r*Math.sin(t)});}
  return pts;
}

function pointSegmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy;if(!l)return distance(p,a);const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l));return distance(p,{x:a.x+t*dx,y:a.y+t*dy});}
function circleFrom3(a,b,c){const d=2*(a.x*(b.y-c.y)+b.x*(c.y-a.y)+c.x*(a.y-b.y));if(Math.abs(d)<1e-6)return null;const aa=a.x*a.x+a.y*a.y,bb=b.x*b.x+b.y*b.y,cc=c.x*c.x+c.y*c.y;const center={x:(aa*(b.y-c.y)+bb*(c.y-a.y)+cc*(a.y-b.y))/d,y:(aa*(c.x-b.x)+bb*(a.x-c.x)+cc*(b.x-a.x))/d};return{c:center,r:distance(center,a)};}
function segmentsIntersect(a,b,c,d){const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);return cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0;}
function hasSelfIntersection(lines){for(let i=0;i<lines.length;i++)for(let j=i+2;j<lines.length;j++){if(i===0&&j===lines.length-1)continue;if(segmentsIntersect(lines[i].a,lines[i].b,lines[j].a,lines[j].b))return true;}return false;}
