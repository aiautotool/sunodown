import assert from 'node:assert/strict';
import test from 'node:test';
import { createLayer } from '../packages/scene-core/src/scene.ts';
import { retimeLayer } from '../packages/scene-core/src/timeline.ts';
void test('move retains clip duration, shifts keyframes and clamps to song boundary',()=>{
 const layer=createLayer('rain','effect',3000);layer.startMs=500;layer.endMs=1500;layer.animations=[{property:'opacity',keyframes:[{timeMs:500,value:0},{timeMs:1500,value:1}]}];
 const next=retimeLayer(layer,2500,'move',3000);
 assert.equal(next.startMs,2000);assert.equal(next.endMs,3000);
 assert.deepEqual(next.animations[0].keyframes.map(k=>k.timeMs),[2000,3000]);assert.equal(layer.startMs,500);
});
void test('trim cannot invert clip or cross song boundaries',()=>{
 const layer=createLayer('rain','effect',3000);
 assert.equal(retimeLayer(layer,5000,'start',3000).startMs,2950);
 assert.equal(retimeLayer(layer,-5000,'end',3000).endMs,50);
});
void test('locked layer and invalid motion leave timing unchanged',()=>{
 const layer=createLayer('rain','effect',3000);layer.locked=true;
 assert.deepEqual(retimeLayer(layer,100,'move',3000),layer);
 layer.locked=false;assert.deepEqual(retimeLayer(layer,NaN,'move',3000),layer);
});
void test('video trim advances the source offset and left movement preserves unique keyframe times',()=>{
 const layer=createLayer('video','video',3000);layer.startMs=500;layer.endMs=2000;layer.params.trimStartMs=100;
 assert.equal(retimeLayer(layer,200,'start',3000).params.trimStartMs,300);
 layer.animations=[{property:'opacity',keyframes:[{timeMs:0,value:0},{timeMs:100,value:.2},{timeMs:500,value:1}]}];
 const moved=retimeLayer(layer,-500,'move',3000);assert.deepEqual(moved.animations[0].keyframes.map(k=>k.timeMs),[0]);
});
