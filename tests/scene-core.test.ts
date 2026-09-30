import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createLayer,
  evaluateSceneFrame,
  migrateLegacyVisual,
  serializeScene,
  parseScene,
  compileRenderPlan,
} from '../packages/scene-core/src/index.ts';
const legacy = {
  aspect: '16:9',
  template: 'vinyl',
  wave: 'bars',
  motion: 'low',
  lyrics: 'focus',
  layout: { title: { x: 50, y: 20, scale: 120 } },
  background: { mode: 'suno' },
  textStyles: { title: { color: '#fff' } },
  subtitleStyle: { color: '#fff' },
  effects: ['rain', 'fog', 'rain'],
};
void test('migration preserves repeated FX order and produces reloadable document', () => {
  const scene = migrateLegacyVisual(legacy, 60000);
  assert.deepEqual(
    scene.layers.filter((l) => l.type === 'effect').map((l) => l.effectId),
    legacy.effects,
  );
  assert.deepEqual(parseScene(serializeScene(scene)), scene);
  assert.equal(scene.layers.find((l) => l.id === 'title')?.transform.x, 640);
  assert.equal(
    scene.layers.find((l) => l.id === 'title')?.transform.scaleX,
    1.2,
  );
  assert.equal(scene.canvas.durationMs, 60000);
});
void test('absolute millisecond evaluation interpolates without changing source document', () => {
  const scene = migrateLegacyVisual(legacy);
  const title = scene.layers.find((l) => l.id === 'title')!;
  title.animations = [
    {
      property: 'x',
      keyframes: [
        { timeMs: 0, value: 0 },
        { timeMs: 1000, value: 100 },
      ],
    },
  ];
  const original = serializeScene(scene),
    frame = evaluateSceneFrame(scene, 425.5);
  assert.equal(frame.layers.find((l) => l.id === 'title')?.transform.x, 42.55);
  assert.equal(frame.frame, 12);
  assert.equal(serializeScene(scene), original);
  assert.deepEqual(evaluateSceneFrame(scene, 425.5), frame);
  assert.equal(evaluateSceneFrame(scene, 30000).layers.length, 0);
});
void test('group transform, opacity, visibility, and compositing order are inherited', () => {
  const scene = migrateLegacyVisual(legacy),
    group = createLayer('group', 'group', 30000),
    child = createLayer('child', 'shape', 30000);
  group.transform.x = 100;
  group.opacity = 0.5;
  group.zIndex = 1;
  child.transform.x = 25;
  child.parentId = group.id;
  child.opacity = 0.4;
  child.zIndex = 999;
  scene.layers = [group, child, createLayer('other', 'shape', 30000)];
  scene.layers[2].zIndex = 2;
  scene.slots = [];
  const frame = evaluateSceneFrame(scene, 0);
  assert.deepEqual(
    frame.layers.map((l) => l.id),
    ['group', 'child', 'other'],
  );
  assert.equal(frame.layers[1].worldMatrix[4], 125);
  assert.equal(frame.layers[1].worldOpacity, 0.2);
  group.visible = false;
  assert.deepEqual(
    evaluateSceneFrame(scene, 0).layers.map((l) => l.id),
    ['other'],
  );
});
void test('reject cyclic groups, dangling assets, unsafe animation paths and unknown versions', () => {
  const scene = migrateLegacyVisual(legacy);
  const a = createLayer('a', 'group', 30000),
    b = createLayer('b', 'group', 30000);
  a.parentId = 'b';
  b.parentId = 'a';
  assert.throws(() => serializeScene({ ...scene, layers: [a, b], slots: [] }));
  assert.throws(() =>
    parseScene(JSON.stringify({ ...scene, schemaVersion: 5 })),
  );
  scene.layers[0].assetId = 'missing';
  assert.throws(() => serializeScene(scene));
  delete scene.layers[0].assetId;
  scene.layers[0].animations = [
    { property: 'params.__proto__', keyframes: [] },
  ];
  assert.throws(() => serializeScene(scene));
});
void test('render plan owns a snapshot and supports exactly matching frame evaluation', () => {
  const scene = migrateLegacyVisual(legacy),
    plan = compileRenderPlan(scene);
  assert.deepEqual(
    evaluateSceneFrame(plan.scene, 1500),
    evaluateSceneFrame(scene, 1500),
  );
  scene.layers[0].visible = false;
  assert.equal(plan.scene.layers[0].visible, true);
});
void test('hold and eased keyframes retain exact boundary behavior', () => {
  const scene = migrateLegacyVisual(legacy);
  scene.layers[0].animations = [
    {
      property: 'opacity',
      keyframes: [
        { timeMs: 0, value: 0, easing: 'hold' },
        { timeMs: 1000, value: 1 },
      ],
    },
  ];
  assert.equal(evaluateSceneFrame(scene, 999.9).layers[0].opacity, 0);
  assert.equal(evaluateSceneFrame(scene, 1000).layers[0].opacity, 1);
  scene.layers[0].animations[0].keyframes[0].easing = 'ease-in';
  assert.equal(evaluateSceneFrame(scene, 500).layers[0].opacity, 0.25);
});
