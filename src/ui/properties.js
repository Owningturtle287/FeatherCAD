import { escapeHTML, round } from '../utils.js';
import { icon } from './icons.js';

export function propertiesTemplate(project,id){
  if(!id)return'<div class="empty-state">Select a plane, sketch, feature, or body to inspect it.</div>';
  if(id==='origin')return`<div class="property-hero"><span class="property-icon">◎</span><h2>Origin</h2><p>Global coordinate system at X 0, Y 0, Z 0.</p></div>`;
  const groups=['planes','sketches','features','bodies','imports'];let item,group;for(const g of groups){item=project[g].find(x=>x.id===id);if(item){group=g;break;}}
  if(!item)return'<div class="empty-state">This item is no longer available.</div>';
  let body=`<label>Name<input data-property="name" value="${escapeHTML(item.name)}" maxlength="80"></label>`;
  if(group==='planes'){body+=item.standard?'<p class="field-help">Standard reference plane</p>':numberField('offset',item.offset||0,project.units)+numberField('angle',item.angle||0,'°');body+=visibility(item);}
  if(group==='sketches'){body+=`<div class="status-card ${item.status}"><strong>${item.status.replace(/^./,c=>c.toUpperCase())}-constrained</strong><span>${item.entities.length} entities · ${item.constraints.length} constraints · ${item.dimensions.length} dimensions</span>${item.errors?.map(e=>`<small>${escapeHTML(e)}</small>`).join('')||''}</div>${visibility(item)}<button class="secondary full" data-action="edit-sketch" data-id="${item.id}">Edit sketch</button>`;}
  if(group==='features'){for(const[k,v]of Object.entries(item.params||{})){if(typeof v==='number')body+=numberField(`param.${k}`,v,k==='angle'?'°':project.units);else if(typeof v==='boolean')body+=`<label class="switch"><input type="checkbox" data-property="param.${k}" ${v?'checked':''}><span>${label(k)}</span></label>`;else body+=`<label>${label(k)}<input data-property="param.${k}" value="${escapeHTML(v)}"></label>`;}body+=`<label class="switch"><input type="checkbox" data-property="suppressed" ${item.suppressed?'checked':''}><span>Suppressed</span></label>${item.error?`<div class="error-card"><strong>Rebuild failed</strong><span>${escapeHTML(item.error)}</span><small>Last valid state is preserved in history metadata.</small></div>`:''}<div class="row"><button class="secondary" data-action="move-feature-up">Move up</button><button class="secondary" data-action="move-feature-down">Move down</button></div>`;}
  if(group==='bodies'){const m=item.metrics;body+=visibility(item);if(m)body+=`<div class="metrics"><div><span>Bounds</span><strong>${m.bounds.map(v=>round(v,2)).join(' × ')} ${project.units}</strong></div><div><span>Surface area</span><strong>${round(m.area,2)} ${project.units}²</strong></div><div><span>Volume</span><strong>${round(m.volume,2)} ${project.units}³</strong></div></div>`;body+=`<label>Material density<input data-property="density" inputmode="decimal" value="${item.density||0}"><small>mass / ${project.units}³</small></label>`;if(m&&item.density)body+=`<div class="measure-result">Approx. mass: ${round(m.volume*item.density,3)}</div>`;}
  if(group==='imports'){body+=`<div class="warning-card">${item.parametric?'Native parametric project':'Non-parametric mesh or unconstrained sketch import'}</div>${(item.warnings||[]).map(w=>`<p class="field-help">${escapeHTML(w)}</p>`).join('')}`;}
  if(!item.standard)body+=`<button class="danger ghost full" data-action="delete-item">${icon('trash','Delete')}</button>`;
  return`<div class="property-section">${body}</div>`;
}
function numberField(key,value,unit){return`<label>${label(key)}<div class="unit-input"><input type="number" inputmode="decimal" step="any" data-property="${key}" value="${value}"><span>${unit}</span></div></label>`;}
function visibility(item){return`<label class="switch"><input type="checkbox" data-property="visible" ${item.visible?'checked':''}><span>Visible</span></label>`;}
function label(key){return key.replace('param.','').replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase());}
