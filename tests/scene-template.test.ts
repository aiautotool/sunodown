import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLayer,
  compileTimeline,
  rippleDelete,
  splitSceneLayer,
  createSceneTemplate,
  instantiateTemplate,
  migrateLegacyVisual,
  validateScene,
} from '../packages/scene-core/src/index.ts';
const base = () =>
  migrateLegacyVisual(
    {
      aspect: '16:9',
      template: 'glass-card',
      wave: 'bars',
      motion: 'low',
      lyrics: 'focus',
      layout: {},
      background: {},
      textStyles: {},
      subtitleStyle: {},
      effects: [],
    },
    200000,
  );
void test('timeline derives overlapping and sequential lanes from layer identities', () => {
  const scene = base();
  scene.layers = [];
  for (const [id, start, end] of [
    ['a', 0, 1000],
    ['b', 1000, 2000],
    ['c', 500, 1500],
  ] as const) {
    const l = createLayer(id, 'effect', 200000);
    l.effectId = 'rain';
    l.startMs = start;
    l.endMs = end;
    scene.layers.push(l);
  }
  const model = compileTimeline(scene);
  assert.equal(model.tracks.length, 2);
  assert.deepEqual(
    model.tracks.flatMap((t) => t.items.map((i) => i.layerId)).sort(),
    ['a', 'b', 'c'],
  );
  assert.equal(
    model.tracks.find((t) => t.items.length === 2)?.items[1].layerId,
    'b',
  );
});
void test('ripple delete only closes the main track and split preserves source offset', () => {
  const scene = base();
  scene.layers = [];
  for (const [id, start, end, role] of [
    ['a', 0, 1000, 'main-video'],
    ['b', 1000, 2000, 'main-video'],
    ['fx', 1000, 2000, 'atmosphere'],
  ] as const) {
    const l = createLayer(id, id === 'fx' ? 'effect' : 'video', 200000);
    l.startMs = start;
    l.endMs = end;
    l.role = role;
    scene.layers.push(l);
  }
  const deleted = rippleDelete(scene, 'a');
  assert.equal(deleted.layers.find((l) => l.id === 'b')?.startMs, 0);
  assert.equal(deleted.layers.find((l) => l.id === 'fx')?.startMs, 1000);
  assert.equal(scene.layers.length, 3);
  const split = splitSceneLayer(scene, 'b', 1500, 'right');
  assert.equal(
    split.layers.find((l) => l.id === 'right')?.params.trimStartMs,
    500,
  );
  assert.equal(split.layers.find((l) => l.id === 'b')?.endMs, 1500);
});
void test('template excludes current audio and lyrics and resolves timing for another song', () => {
  const scene = base();
  const fx = createLayer('smoke', 'effect', 200000);
  fx.effectId = 'smoke';
  fx.startMs = 10000;
  fx.endMs = 180000;
  scene.layers.push(fx, createLayer('audio', 'audio', 200000));
  scene.layers.find((l) => l.id === 'subtitle')!.params.cues = [
    { startMs: 10, endMs: 20, text: 'old song' },
  ];
  const template = createSceneTemplate(scene, 'test', 'Mystery');
  assert.ok(!template.scene.layers.some((l) => l.type === 'audio'));
  assert.deepEqual(
    template.scene.layers.find((l) => l.id === 'subtitle')?.params.cues,
    [],
  );
  const cues = [{ startMs: 3000, endMs: 4000, text: 'new song' }];
  const result = instantiateTemplate(template, 130000, cues);
  validateScene(result);
  assert.equal(result.layers.find((l) => l.id === 'smoke')?.startMs, 6500);
  assert.equal(result.layers.find((l) => l.id === 'smoke')?.endMs, 117000);
  assert.deepEqual(
    result.layers.find((l) => l.id === 'subtitle')?.params.cues,
    cues,
  );
  assert.equal(result.layers.find((l) => l.id === 'title')?.endMs, 130000);
  template.timing.smoke = {
    type: 'anchors',
    startOffsetMs: 2000,
    endOffsetMs: -3000,
  };
  const anchored = instantiateTemplate(template, 130000);
  assert.equal(anchored.layers.find((l) => l.id === 'smoke')?.startMs, 2000);
  assert.equal(anchored.layers.find((l) => l.id === 'smoke')?.endMs, 127000);
});
