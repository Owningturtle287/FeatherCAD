import * as THREE from 'three';

const EPSILON = 1e-5;
class Vector {
  constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
  clone(){return new Vector(this.x,this.y,this.z)} negated(){return new Vector(-this.x,-this.y,-this.z)}
  plus(a){return new Vector(this.x+a.x,this.y+a.y,this.z+a.z)} minus(a){return new Vector(this.x-a.x,this.y-a.y,this.z-a.z)} times(a){return new Vector(this.x*a,this.y*a,this.z*a)} dividedBy(a){return new Vector(this.x/a,this.y/a,this.z/a)}
  dot(a){return this.x*a.x+this.y*a.y+this.z*a.z} lerp(a,t){return this.plus(a.minus(this).times(t))} length(){return Math.sqrt(this.dot(this))} unit(){return this.dividedBy(this.length()||1)}
  cross(a){return new Vector(this.y*a.z-this.z*a.y,this.z*a.x-this.x*a.z,this.x*a.y-this.y*a.x)}
}
class Vertex {
  constructor(pos,normal=new Vector()){this.pos=pos;this.normal=normal;} clone(){return new Vertex(this.pos.clone(),this.normal.clone())} flip(){this.normal=this.normal.negated()} interpolate(other,t){return new Vertex(this.pos.lerp(other.pos,t),this.normal.lerp(other.normal,t))}
}
class Plane {
  constructor(normal,w){this.normal=normal;this.w=w;}
  clone(){return new Plane(this.normal.clone(),this.w)} flip(){this.normal=this.normal.negated();this.w=-this.w}
  static fromPoints(a,b,c){const n=b.minus(a).cross(c.minus(a)).unit();return new Plane(n,n.dot(a));}
  splitPolygon(polygon,coplanarFront,coplanarBack,front,back){
    const COPLANAR=0,FRONT=1,BACK=2,SPANNING=3;let polygonType=0;const types=[];
    for(const vertex of polygon.vertices){const t=this.normal.dot(vertex.pos)-this.w,type=t<-EPSILON?BACK:t>EPSILON?FRONT:COPLANAR;polygonType|=type;types.push(type);}
    if(polygonType===COPLANAR)(this.normal.dot(polygon.plane.normal)>0?coplanarFront:coplanarBack).push(polygon);
    else if(polygonType===FRONT)front.push(polygon); else if(polygonType===BACK)back.push(polygon); else {const f=[],b=[];for(let i=0;i<polygon.vertices.length;i++){const j=(i+1)%polygon.vertices.length,ti=types[i],tj=types[j],vi=polygon.vertices[i],vj=polygon.vertices[j];if(ti!==BACK)f.push(vi);if(ti!==FRONT)b.push(ti!==BACK?vi.clone():vi);if((ti|tj)===SPANNING){const t=(this.w-this.normal.dot(vi.pos))/this.normal.dot(vj.pos.minus(vi.pos)),v=vi.interpolate(vj,t);f.push(v);b.push(v.clone());}}if(f.length>=3)front.push(new Polygon(f));if(b.length>=3)back.push(new Polygon(b));}
  }
}
class Polygon { constructor(vertices){this.vertices=vertices;this.plane=Plane.fromPoints(vertices[0].pos,vertices[1].pos,vertices[2].pos)} clone(){return new Polygon(this.vertices.map(v=>v.clone()))} flip(){this.vertices.reverse().forEach(v=>v.flip());this.plane.flip()} }
class Node {
  constructor(polygons=[]){this.plane=null;this.front=null;this.back=null;this.polygons=[];if(polygons.length)this.build(polygons)}
  clone(){const n=new Node();n.plane=this.plane?.clone()||null;n.front=this.front?.clone()||null;n.back=this.back?.clone()||null;n.polygons=this.polygons.map(p=>p.clone());return n}
  invert(){for(const p of this.polygons)p.flip();this.plane?.flip();this.front?.invert();this.back?.invert();[this.front,this.back]=[this.back,this.front]}
  clipPolygons(polygons){if(!this.plane)return polygons.slice();let front=[],back=[];for(const p of polygons)this.plane.splitPolygon(p,front,back,front,back);if(this.front)front=this.front.clipPolygons(front);if(this.back)back=this.back.clipPolygons(back);else back=[];return front.concat(back)}
  clipTo(node){this.polygons=node.clipPolygons(this.polygons);this.front?.clipTo(node);this.back?.clipTo(node)}
  allPolygons(){return this.polygons.concat(this.front?this.front.allPolygons():[],this.back?this.back.allPolygons():[])}
  build(polygons){if(!polygons.length)return;if(!this.plane)this.plane=polygons[0].plane.clone();const front=[],back=[];for(const p of polygons)this.plane.splitPolygon(p,this.polygons,this.polygons,front,back);if(front.length){if(!this.front)this.front=new Node();this.front.build(front)}if(back.length){if(!this.back)this.back=new Node();this.back.build(back)}}
}
class Solid {
  constructor(polygons){this.polygons=polygons} clone(){return new Solid(this.polygons.map(p=>p.clone()))}
  union(other){const a=new Node(this.clone().polygons),b=new Node(other.clone().polygons);a.clipTo(b);b.clipTo(a);b.invert();b.clipTo(a);b.invert();a.build(b.allPolygons());return new Solid(a.allPolygons())}
  subtract(other){const a=new Node(this.clone().polygons),b=new Node(other.clone().polygons);a.invert();a.clipTo(b);b.clipTo(a);b.invert();b.clipTo(a);b.invert();a.build(b.allPolygons());a.invert();return new Solid(a.allPolygons())}
  intersect(other){const a=new Node(this.clone().polygons),b=new Node(other.clone().polygons);a.invert();b.clipTo(a);b.invert();a.clipTo(b);b.clipTo(a);a.build(b.allPolygons());a.invert();return new Solid(a.allPolygons())}
}

export function solidFromMesh(mesh){
  mesh.updateMatrixWorld(true);const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();const pos=geometry.getAttribute('position'),normal=geometry.getAttribute('normal');const normalMatrix=new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);const polygons=[];
  for(let i=0;i<pos.count;i+=3){const vertices=[];for(let j=0;j<3;j++){const p=new THREE.Vector3().fromBufferAttribute(pos,i+j).applyMatrix4(mesh.matrixWorld),n=normal?new THREE.Vector3().fromBufferAttribute(normal,i+j).applyMatrix3(normalMatrix).normalize():new THREE.Vector3();vertices.push(new Vertex(new Vector(p.x,p.y,p.z),new Vector(n.x,n.y,n.z)));}if(vertices[1].pos.minus(vertices[0].pos).cross(vertices[2].pos.minus(vertices[0].pos)).length()>EPSILON)polygons.push(new Polygon(vertices));}
  if(geometry!==mesh.geometry)geometry.dispose();return new Solid(polygons);
}
export function meshFromSolid(solid,material){
  const positions=[];for(const polygon of solid.polygons){for(let i=2;i<polygon.vertices.length;i++){for(const v of [polygon.vertices[0],polygon.vertices[i-1],polygon.vertices[i]])positions.push(v.pos.x,v.pos.y,v.pos.z);}}
  if(!positions.length)throw new Error('Boolean operation produced an empty body.');const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return new THREE.Mesh(geometry,material);
}
export function booleanMeshes(a,b,operation,material=a.material){const sa=solidFromMesh(a),sb=solidFromMesh(b);const out=operation==='union'?sa.union(sb):operation==='intersect'?sa.intersect(sb):sa.subtract(sb);return meshFromSolid(out,material);}
