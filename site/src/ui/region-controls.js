import { el } from './dom.js';
import { colourBarModel, paletteName, REGION_PALETTE } from '../engine/regions.js';

const PAINTS = { red:'#ff0000',blue:'#0000ff',green:'#00ff00',yellow:'#ffff00',other:'#777777' };
const ROLE_LABELS = { pattern:'Pattern',hole:'Hole',solid:'Solid',line:'Line' };

/** Region navigation. Existing card panels remain the settings editor. */
export class RegionControls {
  constructor(options) { Object.assign(this, options); }

  update(regions, selection, seam) {
    this.bar.hidden = !regions?.length;
    this.header.hidden = !regions?.length;
    if (!regions?.length) { this.bar.replaceChildren(); this.header.replaceChildren(); return; }
    const active = document.activeElement;
    const focusId = this.bar.contains(active) ? active.dataset.regionFocus : null;
    const model = colourBarModel(regions.map(r=>({...r,cardName:this.cards.find(c=>c.id===r.card)?.name})), selection);
    this.bar.replaceChildren(...model.map((chip,index)=>{
      const input = el('input',{type:'checkbox',checked:chip.enabled,'aria-label':`Include ${chip.label}`,'data-region-focus':`${chip.id}-enabled`});
      input.addEventListener('change',()=>this.change(chip.id,{enabled:input.checked}));
      const button = el('button',{type:'button',class:'region-select','aria-pressed':String(chip.selected),'aria-label':chip.label,title:chip.label,tabindex:chip.selected||!selection&&index===0?'0':'-1','data-region-focus':chip.id},
        el('span',{class:'region-paint',style:`background:${chip.hex??PAINTS[chip.color]}`,'aria-hidden':'true'}),el('span',{text:ROLE_LABELS[chip.role]}));
      button.addEventListener('click',()=>this.select(chip.id));
      button.addEventListener('keydown',event=>{
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
        event.preventDefault();
        const next=event.key==='Home'?0:event.key==='End'?model.length-1:(index+(event.key==='ArrowRight'?1:-1)+model.length)%model.length;
        this.select(model[next].id); this.bar.querySelector(`[data-region-focus="${model[next].id}"]`)?.focus();
      });
      return el('span',{class:`region-chip${chip.enabled?'':' excluded'}`},el('label',{class:'region-enabled'},input),button);
    }));
    if(focusId)this.bar.querySelector(`[data-region-focus="${focusId}"]`)?.focus();
    const region=regions.find(r=>r.id===selection);
    const done=el('button',{type:'button',class:'link small',text:'Whole piece'}); done.addEventListener('click',this.close);
    if(!region){this.header.replaceChildren(el('h2',{class:'eyebrow',text:'Drawing regions'}),el('p',{class:'small muted',text:'Select a colour above the preview to edit its design and settings.'}),el('p',{class:'small muted',text:`Draw in ${REGION_PALETTE.map(c=>c.name).join(', ')}. Red is the pattern, blue a hole, green and yellow solids; the others are lines.`}));return;}
    const role=el('select',{'aria-label':'Region role',id:'region-role'},...Object.entries(ROLE_LABELS).map(([value,text])=>el('option',{value,text,selected:value===region.role})));
    role.addEventListener('change',()=>this.change(region.id,{role:role.value}));
    const parts=[el('div',{class:'region-header-title'},el('span',{class:'region-paint',style:`background:${region.hex??PAINTS[region.color]}`}),el('strong',{text:paletteName(region.hex)?`${paletteName(region.hex)} ${region.hex}`:region.hex??region.color}),done),el('label',{class:'field-row'},el('span',{text:'Print as'}),role)];
    if(region.role==='pattern'){
      const picker=el('select',{id:'region-card','aria-label':'Design for this region'},...this.cards.filter(c=>c.status==='ready'&&!c.hidden).map(c=>el('option',{value:c.id,text:`${c.name} · ${c.shelf}`,selected:c.id===region.card})));
      picker.addEventListener('change',()=>this.useCard(region.id,picker.value));
      parts.push(el('label',{class:'field-row stacked'},el('span',{text:'Region design'}),picker),el('p',{class:'small muted',text:'The controls below change only this colour region.'}));
    }
    if(region.role==='line'){
      const align=el('select',{id:'region-align','aria-label':'Lines sit'},...['centre','inside','outside','left','right'].map(value=>el('option',{value,text:value[0].toUpperCase()+value.slice(1),selected:(region.lineAlign??'centre')===value})));
      align.addEventListener('change',()=>this.change(region.id,{lineAlign:align.value}));
      const spacing=el('input',{type:'number',min:.6,max:1,step:.05,value:region.passSpacing??.8,'aria-label':'Pass spacing in bead widths'});
      spacing.addEventListener('change',()=>this.change(region.id,{passSpacing:Math.max(.6,Math.min(1,Number(spacing.value)||.8))}));
      parts.push(el('label',{class:'field-row'},el('span',{text:'Lines sit'}),align),el('p',{class:'small muted',text:'Inside/outside: closed shapes. Left/right: open paths. Other combinations stay centred.'}),el('label',{class:'field-row'},el('span',{text:'Pass spacing × bead'}),spacing));
    }
    const on=el('input',{type:'checkbox',checked:seam.enabled,'aria-label':'Join neighbouring regions with seams'});
    const width=el('input',{type:'number',min:1,max:3,step:.1,value:seam.width,'aria-label':'Seam width in bead widths'});
    on.addEventListener('change',()=>this.change(null,{seam:{...seam,enabled:on.checked}}));
    width.addEventListener('change',()=>this.change(null,{seam:{...seam,width:Math.max(1,Math.min(3,Number(width.value)||1))}}));
    parts.push(el('label',{class:'switch-row'},on,el('span',{text:'Join regions with seams'})),el('label',{class:'field-row'},el('span',{text:'Seam width × bead'}),width));
    if(!seam.enabled)parts.push(el('p',{class:'ctl-warn small',text:'Regions will not be joined.'}));
    this.header.replaceChildren(...parts);
  }
}
