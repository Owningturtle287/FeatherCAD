import { distance, deg, midpoint, rad, round } from '../utils.js';
import { entityPoints } from './model.js';

export function solveSketch(sketch) {
  const errors = [];
  for (let pass = 0; pass < 4; pass++) {
    for (const constraint of sketch.constraints) {
      const entities = constraint.entityIds.map(id => sketch.entities.find(e => e.id === id)).filter(Boolean);
      try { applyConstraint(constraint, entities); } catch (error) { errors.push(`${constraint.type}: ${error.message}`); }
    }
    for (const dimension of sketch.dimensions) {
      const entity = sketch.entities.find(e => e.id === dimension.entityId);
      if (entity) try { applyDimension(dimension, entity); } catch (error) { errors.push(`${dimension.type}: ${error.message}`); }
    }
  }
  const conflict = validateConstraints(sketch);
  errors.push(...conflict);
  const points = sketch.entities.flatMap(entityPoints);
  const fixed = sketch.constraints.filter(c => c.type === 'fixed').flatMap(c => c.entityIds);
  const constrainedCount = sketch.constraints.length + sketch.dimensions.length + fixed.length * 2;
  sketch.status = errors.length ? 'conflict' : constrainedCount > points.length * 2 ? 'over' : constrainedCount >= points.length * 2 ? 'full' : 'under';
  sketch.errors = [...new Set(errors)];
  return { status: sketch.status, errors: sketch.errors };
}

export function addConstraint(sketch, type, entityIds) {
  if (!entityIds.length) throw new Error('Select geometry first.');
  const id = crypto.randomUUID();
  sketch.constraints.push({ id, type, entityIds: [...entityIds] });
  return solveSketch(sketch);
}

export function addDimension(sketch, type, entityId, value) {
  const entity = sketch.entities.find(e => e.id === entityId);
  if (!entity) throw new Error('Select one geometry item.');
  const dimension = { id: crypto.randomUUID(), type, entityId, value: Number(value), x: 0, y: 0 };
  const pts = entityPoints(entity); if (pts.length) { const m = pts.length > 1 ? midpoint(pts[0], pts[1]) : pts[0]; dimension.x=m.x;dimension.y=m.y-8; }
  sketch.dimensions.push(dimension); solveSketch(sketch); return dimension;
}

function applyConstraint(c, e) {
  const first=e[0], second=e[1];
  if (!first) throw new Error('Referenced geometry is missing.');
  if (c.type === 'fixed') { first.fixed = true; return; }
  if (c.type === 'horizontal' && first.a) first.b.y = first.a.y;
  else if (c.type === 'vertical' && first.a) first.b.x = first.a.x;
  else if (c.type === 'coincident' && first.b && second?.a) second.a = first.b;
  else if (c.type === 'parallel' && first.a && second?.a) { const a=Math.atan2(first.b.y-first.a.y,first.b.x-first.a.x),l=distance(second.a,second.b);second.b.x=second.a.x+Math.cos(a)*l;second.b.y=second.a.y+Math.sin(a)*l; }
  else if (c.type === 'perpendicular' && first.a && second?.a) { const a=Math.atan2(first.b.y-first.a.y,first.b.x-first.a.x)+Math.PI/2,l=distance(second.a,second.b);second.b.x=second.a.x+Math.cos(a)*l;second.b.y=second.a.y+Math.sin(a)*l; }
  else if ((c.type === 'concentric' || c.type === 'tangent') && first.c && second?.c) { if(c.type==='concentric')second.c={...first.c}; else { const a=Math.atan2(second.c.y-first.c.y,second.c.x-first.c.x),d=first.r+second.r;second.c={x:first.c.x+Math.cos(a)*d,y:first.c.y+Math.sin(a)*d}; } }
  else if (c.type === 'equal' && second) { if(first.r && second.r)second.r=first.r; else if(first.a&&second.a){const l=distance(first.a,first.b),a=Math.atan2(second.b.y-second.a.y,second.b.x-second.a.x);second.b={x:second.a.x+Math.cos(a)*l,y:second.a.y+Math.sin(a)*l};} }
  else if (c.type === 'collinear' && first.a && second?.a) { const dx=first.b.x-first.a.x,dy=first.b.y-first.a.y,l=Math.hypot(dx,dy)||1;const p=second.a,t=((p.x-first.a.x)*dx+(p.y-first.a.y)*dy)/(l*l);second.a={x:first.a.x+t*dx,y:first.a.y+t*dy}; }
  else if (c.type === 'symmetric' && second) { const axis=c.axis||0; for(const p of entityPoints(second)) p[axis?'y':'x'] *= -1; }
}

function applyDimension(d, e) {
  const value = Number(d.value); if (!Number.isFinite(value) || value <= 0 && d.type !== 'angle') throw new Error('Dimension must be a valid positive number.');
  if (d.type === 'radius' && 'r' in e) e.r=value;
  else if (d.type === 'diameter' && 'r' in e) e.r=value/2;
  else if ((d.type==='distance'||d.type==='distanceX'||d.type==='distanceY') && e.a && e.b) {
    if(d.type==='distanceX')e.b.x=e.a.x+Math.sign(e.b.x-e.a.x||1)*value;
    else if(d.type==='distanceY')e.b.y=e.a.y+Math.sign(e.b.y-e.a.y||1)*value;
    else {const a=Math.atan2(e.b.y-e.a.y,e.b.x-e.a.x);e.b={x:e.a.x+Math.cos(a)*value,y:e.a.y+Math.sin(a)*value};}
  } else if (d.type==='angle' && e.a && e.b) {const l=distance(e.a,e.b);e.b={x:e.a.x+Math.cos(rad(value))*l,y:e.a.y+Math.sin(rad(value))*l};}
}

function validateConstraints(sketch) {
  const errors=[];
  for(const c of sketch.constraints){const e=sketch.entities.find(x=>x.id===c.entityIds[0]);if(!e)continue;if(c.type==='horizontal'&&e.a&&Math.abs(e.a.y-e.b.y)>.01)errors.push('Horizontal constraint conflicts with another relation.');if(c.type==='vertical'&&e.a&&Math.abs(e.a.x-e.b.x)>.01)errors.push('Vertical constraint conflicts with another relation.');}
  for(const d of sketch.dimensions){if(!Number.isFinite(d.value))errors.push('A dimension is invalid.');}
  return errors;
}

export function inferredDimension(entity, type) {
  if(type==='radius')return round(entity.r||0);
  if(type==='diameter')return round((entity.r||0)*2);
  if(type==='angle'&&entity.a)return round(deg(Math.atan2(entity.b.y-entity.a.y,entity.b.x-entity.a.x)));
  if(entity.a&&entity.b){if(type==='distanceX')return round(Math.abs(entity.b.x-entity.a.x));if(type==='distanceY')return round(Math.abs(entity.b.y-entity.a.y));return round(distance(entity.a,entity.b));}
  return 10;
}
