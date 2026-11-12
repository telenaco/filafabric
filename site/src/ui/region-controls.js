import { el } from './dom.js';
import { colourBarModel, regionInPiece, REGION_PALETTE, lineLayersOf, LINE_LAYERS_MAX, lineWidthOf, colourName, sanitizeSeam } from '../engine/regions.js';

const PAINTS = { red:'#ff0000',blue:'#0000ff',green:'#00ff00',yellow:'#ffff00',other:'#777777' };
const ROLE_LABELS = { pattern:'Pattern',hole:'Hole',solid:'Solid',line:'Line' };

/** Region navigation. Existing card panels remain the settings editor. */
const alignSelect=(value,onChange,label,focus='line-align')=>{
  const select=el('select',{'aria-label':label,'data-region-focus':focus},...[['inside','Inside the edge'],['centre','Both sides (centred)'],['outside','Outside the edge']].map(([v,text])=>el('option',{value:v,text,selected:v===value})));
  select.addEventListener('change',()=>onChange(select.value));
  return el('label',{class:'field-row'},el('span',{text:label}),select);
};

export class RegionControls {
  constructor(options) { Object.assign(this, options); }

  update(regions, selection, seam) {
    this.bar.hidden = !regions?.length;
    this.header.hidden = !regions?.length;
    if (!regions?.length) { this.bar.replaceChildren(); this.header.replaceChildren(); return; }
    const active = document.activeElement;
    const focusId = this.bar.contains(active) ? active.dataset.regionFocus : null;
    const headerFocusId = this.header.contains(active) ? active.dataset.regionFocus : null;
    const focusTarget = (container, id) => container.querySelector(`[data-region-focus="${id}"]`);
    // Colours first, as named in the drawing; lines together at the end. What a colour prints as is chosen below ("Print as").
    const model = colourBarModel(regions.map(r=>({...r,cardName:this.cards.find(c=>c.id===r.card)?.name})), selection)
      .sort((a,b)=>(a.role==='line')-(b.role==='line'));
    const restoreHeaderFocus = () => {
      if (!headerFocusId) return;
      const target = focusTarget(this.header, headerFocusId) ?? focusTarget(this.bar, selection ?? model[0].id);
      target?.focus({ preventScroll: true });
    };
    // far left: tick or untick every colour at once
    const all = el('input',{type:'checkbox',checked:model.every(c=>c.enabled),'aria-label':'Tick every colour','data-region-focus':'all-enabled'});
    all.indeterminate = model.some(c=>c.enabled) && !model.every(c=>c.enabled);
    all.addEventListener('change',()=>this.change(null,{allEnabled:all.checked}));
    const allChip = el('span',{class:'region-chip region-all',title:'Tick or untick every colour'},el('label',{class:'region-enabled'},all));
    this.bar.replaceChildren(allChip,...model.map((chip,index)=>{
      const input = el('input',{type:'checkbox',checked:chip.enabled,'aria-label':`${chip.applied ? 'Work on' : 'Include'} ${chip.label}`,'data-region-focus':`${chip.id}-enabled`});
      input.addEventListener('change',()=>this.change(chip.id,{enabled:input.checked}));
      const button = el('button',{type:'button',class:'region-select','aria-pressed':String(chip.selected),'aria-label':chip.label,title:chip.label,tabindex:chip.selected||!selection&&index===0?'0':'-1','data-region-focus':chip.id},
        el('span',{class:'region-paint',style:`background:${chip.hex??PAINTS[chip.color]}`,'aria-hidden':'true'}),...(chip.role==='line'?[el('span',{class:'small muted',text:'Line'})]:[]));
      button.addEventListener('click',()=>this.select(chip.id));
      button.addEventListener('keydown',event=>{
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
        event.preventDefault();
        const next=event.key==='Home'?0:event.key==='End'?model.length-1:(index+(event.key==='ArrowRight'?1:-1)+model.length)%model.length;
        this.select(model[next].id); focusTarget(this.bar, model[next].id)?.focus();
      });
      if(chip.applied)button.append(el('span',{class:'region-applied',text:'✓',title:'Applied: part of the piece','aria-hidden':'true'}));
      return el('span',{class:`region-chip${chip.included?'':' excluded'}${chip.applied?' applied':''}`},el('label',{class:'region-enabled'},input),button);
    }));
    if(focusId)focusTarget(this.bar,focusId)?.focus();
    const region=regions.find(r=>r.id===selection);
    if(!region){
      this.header.replaceChildren(el('h2',{class:'eyebrow',text:'Drawing regions'}),el('p',{class:'small muted',text:'Tick a colour and choose what it prints as. Apply sets it aside as part of the piece: untick it and it keeps showing while you work on the next colour on top of it.'}),el('p',{class:'small muted',text:`Draw in ${REGION_PALETTE.map(c=>c.name).join(', ')}. Red is the pattern, blue a hole, green and yellow solids; the others are lines.`}));
      restoreHeaderFocus();
      return;
    }
    const done=el('button',{type:'button',class:'link small',text:'Whole piece','data-region-focus':'whole-piece'}); done.addEventListener('click',this.close);
    // Editing an excluded colour adds it to the working piece so the change is visible.
    const included = regionInPiece(region);
    const edit=(patch)=>this.change(region.id,included?patch:{...patch,enabled:true});
    const role=el('select',{'aria-label':'Region role',id:'region-role','data-region-focus':'region-role'},...Object.entries(ROLE_LABELS).map(([value,text])=>el('option',{value,text,selected:value===region.role})));
    role.addEventListener('change',()=>edit({role:role.value}));
    const parts=[el('div',{class:'region-header-title'},el('span',{class:'region-paint',style:`background:${region.hex??PAINTS[region.color]}`}),el('strong',{text:`${colourName(region.hex)??region.color} ${region.hex??''}`}),done),el('label',{class:'field-row'},el('span',{text:'Print as'}),role)];
    if(!included){
      const include=el('button',{type:'button',class:'link small',text:`Include ${colourName(region.hex)??region.color}`,'data-region-focus':'include-region'});
      include.addEventListener('click',()=>this.change(region.id,{enabled:true}));
      parts.push(el('p',{class:'small muted region-excluded-note'},`${colourName(region.hex)??region.color} is not in the preview yet: it is unticked in the colour row. `,include));
    }
    if(region.role==='pattern'){
      const picker=el('select',{id:'region-card','aria-label':'Design for this region','data-region-focus':'region-card'},...this.cards.filter(c=>c.status==='ready'&&!c.hidden).map(c=>el('option',{value:c.id,text:`${c.name} · ${c.shelf}`,selected:c.id===region.card})));
      picker.addEventListener('change',()=>this.useCard(region.id,picker.value));
      const current = region.seam ?? seam;
      const width = el('input', { type: 'number', min: 0, max: 10, step: .01, value: current.enabled ? current.width : 0, 'data-region-focus': 'region-outline-width' });
      width.addEventListener('change', () => {
        if (width.value === '' || !width.validity.valid || (width.valueAsNumber > 0 && width.valueAsNumber < .4)) {
          width.value = current.enabled ? current.width : 0;
          return;
        }
        edit({ seam: sanitizeSeam({ ...current, enabled: width.valueAsNumber > 0, width: width.valueAsNumber }) });
      });
      const inherited = el('p', { class: 'small muted', text: 'Uses the default region outline until you change it. Set width to 0 to turn it off.' });
      const reset = el('button', { type: 'button', class: 'link small', text: 'Use default region outline', 'data-region-focus': 'region-outline-default' });
      reset.addEventListener('click', () => edit({ seam: undefined }));
      parts.push(el('label',{class:'field-row stacked'},el('span',{text:'Region design'}),picker),
        el('section', { class: 'region-outline', 'aria-label': 'Selected colour outline' },
          el('h3', { class: 'eyebrow', text: 'This colour’s outline' }),
          el('label', { class: 'field-row' }, el('span', { text: 'Width (mm)' }), width),
          alignSelect(current.align, value => edit({ seam: sanitizeSeam({ ...current, align: value }) }), 'Region outline sits', 'region-outline-align'),
          region.seam ? reset : inherited),
        el('p',{class:'small muted',text:`The design settings below apply to ${colourName(region.hex)??region.color} only.`}));
    }
    if(region.role==='line'){
      const layers=el('input',{type:'number',min:1,max:LINE_LAYERS_MAX,step:1,value:lineLayersOf(region),'aria-label':'Layers','data-region-focus':'line-layers'});
      layers.addEventListener('change',()=>edit({lineLayers:lineLayersOf({lineLayers:layers.value})}));
      const thick=el('input',{type:'number',min:.2,max:20,step:.1,value:lineWidthOf(region)??'',placeholder:'as drawn','aria-label':'Thickness in mm','data-region-focus':'line-width'});
      thick.addEventListener('change',()=>edit({lineWidth:lineWidthOf({lineWidth:thick.value})}));
      parts.push(el('label',{class:'field-row'},el('span',{text:'Layers'}),layers),el('label',{class:'field-row'},el('span',{text:'Thickness mm'}),thick),
        alignSelect(region.lineAlign??'centre',value=>edit({lineAlign:value}),'Line sits'),
        el('p',{class:'small muted',text:'Thickness is the drawn line width unless you set one: the nozzle goes round as many times as it takes. Layers stacks it taller, for folds and stiffening.'}));
    }
    if(region.applied){
      const out=el('button',{type:'button',class:'link small',text:'Take out of the piece','data-region-focus':'remove-region'});
      out.addEventListener('click',()=>this.change(region.id,{applied:false,enabled:false}));
      parts.push(el('p',{class:'small muted'},'Applied: this colour is part of the piece. ',out));
    }
    this.header.replaceChildren(...parts);
    restoreHeaderFocus();
  }
}
