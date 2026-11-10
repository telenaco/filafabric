import test from 'node:test';
import assert from 'node:assert/strict';
import { drawingPolylines, linePasses, offsetPolyline, passesFor } from '../../site/src/engine/drawing.js';
import { designById } from '../../site/src/ui/designs.js';
import { defaultProfiles } from './helpers.js';

const square = (reverse = false) => {
  const points = [{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100},{x:0,y:0}];
  return reverse ? [...points].reverse() : points;
};
const area = path => path.slice(0,-1).reduce((a,p,i)=>a+p.x*path[i+1].y-path[i+1].x*p.y,0)/2;

test('closed inside/outside lines obey both windings and one-sided first-pass offsets', () => {
  const bead = .45, ring = square();
  for (const path of [ring, [...ring].reverse()]) {
    const inside = linePasses({pts:path,width:1},bead,{align:'inside'});
    const outside = linePasses({pts:path,width:1},bead,{align:'outside'});
    const sign = Math.sign(area(path));
    assert.ok(inside.every(pass=>Math.sign(area(pass))===sign));
    assert.ok(outside.every(pass=>Math.sign(area(pass))===sign));
    const firstInside = inside[0].find(p=>p.y!==path[0].y || p.x!==path[0].x);
    const firstOutside = outside[0].find(p=>p.y!==path[0].y || p.x!==path[0].x);
    assert.ok(firstInside && firstOutside);
    assert.ok(Math.abs(Math.min(...inside[0].flatMap(p=>[p.x,p.y,100-p.x,100-p.y]))-bead/2)<.01);
    assert.ok(Math.abs(Math.min(...outside[0].flatMap(p=>[p.x,p.y,100-p.x,100-p.y]))+bead/2)<.01);
    assert.ok(!inside.flat().some(p=>p.x<0||p.x>100||p.y<0||p.y>100));
    assert.ok(outside.flat().some(p=>p.x<0||p.x>100||p.y<0||p.y>100));
  }
});

test('open paths use left/right, and pass spacing controls the one-sided count and pitch', () => {
  const line = {pts:[{x:0,y:0},{x:10,y:0}],width:1};
  const left = linePasses(line,.45,{align:'left',spacing:.8});
  const right = linePasses(line,.45,{align:'right',spacing:.8});
  assert.ok(left.every(pass=>pass[0].y>0));
  assert.ok(right.every(pass=>pass[0].y<0));
  assert.equal(left.length,Math.max(1,Math.min(8,Math.round((1-.45)/(.8*.45))+1)));
  assert.ok(Math.abs(Math.abs(left[1][0].y-left[0][0].y)-.36)<1e-9);
  assert.equal(linePasses(line,.45,{align:'centre'}).length,passesFor(1,.45));
  const closed=square();
  assert.deepEqual(linePasses({pts:closed,width:1},.45,{align:'left'}),linePasses({pts:closed,width:1},.45,{align:'centre'}));
});

test('narrow inside circles stop before self-crossing and report every dropped pass', () => {
  const ring = Array.from({length:100},(_,i)=>({x:1.5*Math.cos(i*2*Math.PI/100),y:1.5*Math.sin(i*2*Math.PI/100)}));
  ring.push({...ring[0]});
  const vector={name:'small',width:3,height:3,paths:[ring],styles:[{color:'other',width:2}]};
  const result=drawingPolylines(vector,{bead:.45,lineAlign:'inside',passSpacing:.8});
  assert.ok(result.clipped.length>0);
  assert.ok(result.droppedPasses>0);
  assert.ok(result.clipped.every(line=>Math.abs(area([...line.pts,line.pts[0]]))>1e-6));
});

test('centre alignment remains exactly the old geometry and default generated G-code', () => {
  const pts=[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10},{x:0,y:0}];
  const line={pts,width:1.4};
  const n=passesFor(line.width,.45), pitch=Math.min(line.width/n,.45*.8);
  const old=Array.from({length:n},(_,k)=>offsetPolyline(pts,(k-(n-1)/2)*pitch));
  assert.deepEqual(linePasses(line,.45),old);
  const card=designById('svgdesign'), profiles=defaultProfiles();
  const settings=card.sanitize({...card.defaults(),width:30,height:30,lineAlign:'centre',passSpacing:.8});
  const result=card.generate(profiles.machine,profiles.material,settings);
  assert.ok(result.moves.length>0);
  assert.equal(settings.lineAlign,'centre');
});

test('Your drawing routes Lines sit settings into its actual generated paths', () => {
  const card=designById('svgdesign'),{machine,material}=defaultProfiles();
  const ring=[{x:5,y:5},{x:25,y:5},{x:25,y:25},{x:5,y:25},{x:5,y:5}];
  const vector={name:'square',width:30,height:30,paths:[ring],styles:[{color:'other',width:1}]};
  const minX=align=>{
    const raw={...card.defaults(),width:30,height:30,mode:'outline',lineAlign:align,support:{...card.defaults().support,enabled:false}};
    const result=card.generate(machine,material,card.sanitize(raw),{vector});
    return Math.min(...result.strands.flatMap(s=>s.pts.map(p=>p.x)));
  };
  assert.ok(Math.abs(minX('centre')-5)<.3);
  assert.ok(minX('inside')>=5);
  assert.ok(minX('outside')<5);
});
