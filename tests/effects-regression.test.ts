import assert from 'node:assert/strict';
import test from 'node:test';
import {drawVideoEffects,normalizeEffectSettings,type EffectConfig} from '../components/v8/video-effects';
import {createStudioRenderModel,assertStudioRenderParity} from '../components/studio-render-model';
import {BUILTIN_STUDIO_PRESETS,normalizePresetConfig} from '../components/presets/studio-presets';

void test('effect controls survive normalization and reach preview/export',()=>{
 const config={...BUILTIN_STUDIO_PRESETS[0].config,effectSettings:{speed:2,angle:-35,density:2.5,size:1.8}};
 const model=createStudioRenderModel(config);
 assert.deepEqual(normalizePresetConfig(config).effectSettings,config.effectSettings);
 assert.equal(model.effects.speed,2);
 assert.equal(model.effects.fallAngle,-35);
 assert.equal(model.effects.intensity,2.5);
 assert.equal(model.effects.particleSize,1.8);
 assert.equal(assertStudioRenderParity(config,model.visual).ok,true);
 assert.notEqual(model.fingerprint,createStudioRenderModel({...config,effectSettings:{...config.effectSettings,angle:35}}).fingerprint);
 assert.deepEqual(normalizeEffectSettings({speed:Infinity,angle:90,density:-1,size:20}),{speed:1,angle:60,density:.2,size:3});
});

function rain(overrides:Partial<EffectConfig>){
 const lines:number[][]=[];let from:number[]=[];
 const ctx={save(){},restore(){},beginPath(){},moveTo(x:number,y:number){from=[x,y]},lineTo(x:number,y:number){lines.push([...from,x,y])},stroke(){},lineWidth:0};
 drawVideoEffects(ctx as unknown as CanvasRenderingContext2D,1080,1920,1,{effects:['rain'],intensity:1,speed:1,opacity:.75,wind:0,...overrides});
 return {lines,width:ctx.lineWidth};
}
void test('rain responds to direction, speed, density and thickness',()=>{
 const base=rain({}),left=rain({fallAngle:-30}),right=rain({fallAngle:30});
 assert.equal(base.lines[0][2],base.lines[0][0]);
 assert.ok(left.lines[0][2]<left.lines[0][0]);
 assert.ok(right.lines[0][2]>right.lines[0][0]);
 assert.notEqual(rain({speed:2}).lines[0][1],base.lines[0][1]);
 assert.equal(rain({intensity:2}).lines.length,base.lines.length*2);
 assert.equal(rain({particleSize:2}).width,base.width*2);
});

void test('scene FX reach export when the legacy effect list is empty',()=>{
 const config={...BUILTIN_STUDIO_PRESETS[0].config,effects:[]};
 const migrated=createStudioRenderModel(config).scene;
 const layer={...migrated.layers[0],id:'new-rain',name:'Rain',type:'effect' as const,effectId:'rain',params:{density:1,speed:1,angle:0,size:1},zIndex:6};
 const model=createStudioRenderModel(config,30000,[layer]);
 assert.deepEqual(model.effects.effects,['rain']);
 assert.notEqual(model.fingerprint,createStudioRenderModel(config).fingerprint);
 const lines:number[][]=[];let from:number[]=[];
 const ctx={save(){},restore(){},transform(){},beginPath(){},moveTo(x:number,y:number){from=[x,y]},lineTo(x:number,y:number){lines.push([...from,x,y])},stroke(){},lineWidth:0};
 drawVideoEffects(ctx as unknown as CanvasRenderingContext2D,1280,720,1,model.effects);
 assert.equal(lines.length,85);
 lines.length=0;layer.visible=false;
 drawVideoEffects(ctx as unknown as CanvasRenderingContext2D,1280,720,1,createStudioRenderModel(config,30000,[layer]).effects);
 assert.equal(lines.length,0);
});
void test('scene FX timing, opacity and keyframes use the same evaluated source',()=>{
 const config={...BUILTIN_STUDIO_PRESETS[0].config,effects:['rain'] as const};
 const base=createStudioRenderModel({...config,effects:[...config.effects]});
 const fx=base.scene.layers.filter(l=>l.type==='effect');fx[0].startMs=1000;fx[0].endMs=2000;
 fx[0].animations=[{property:'params.density',keyframes:[{timeMs:1000,value:1},{timeMs:2000,value:3}]}];
 const model=createStudioRenderModel({...config,effects:[...config.effects]},30000,fx);
 let count=0;
 const ctx={save(){},restore(){},transform(){},beginPath(){},moveTo(){},lineTo(){count++},stroke(){},lineWidth:0};
 drawVideoEffects(ctx as unknown as CanvasRenderingContext2D,1280,720,.99,model.effects);assert.equal(count,0);
 drawVideoEffects(ctx as unknown as CanvasRenderingContext2D,1280,720,1.5,model.effects);assert.equal(count,170);
 count=0;drawVideoEffects(ctx as unknown as CanvasRenderingContext2D,1280,720,2,model.effects);assert.equal(count,0);
});
