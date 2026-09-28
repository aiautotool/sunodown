import assert from 'node:assert/strict';
import test from 'node:test';
import {createStudioRenderModel,assertStudioRenderParity} from '../components/studio-render-model';
import {BUILTIN_STUDIO_PRESETS} from '../components/presets/studio-presets';
import {DEFAULT_BACKGROUND_CONFIG,sanitizeStoredBackground} from '../components/v8/background';

for(const mode of ['image','video'] as const){
 void test(`${mode} selection reaches preview and export without losing session URL`,()=>{
  const background={...DEFAULT_BACKGROUND_CONFIG,mode,[`${mode}Url`]:'blob:pexels-selected',[`${mode}Fingerprint`]:'pexels-123'};
  const config={...BUILTIN_STUDIO_PRESETS[0].config,background};
  const model=createStudioRenderModel(config);
  assert.equal(model.visual.background.mode,mode);
  assert.equal(model.visual.background[`${mode}Url`],'blob:pexels-selected');
  assert.equal(model.visual.background[`${mode}Fingerprint`],'pexels-123');
  assert.equal(assertStudioRenderParity(config,model.visual).ok,true);
  const changed=createStudioRenderModel({...config,background:{...background,[`${mode}Url`]:'blob:other',[`${mode}Fingerprint`]:'pexels-456'}});
  assert.notEqual(model.fingerprint,changed.fingerprint);
  assert.equal(sanitizeStoredBackground(background).mode,'suno');
  assert.equal(sanitizeStoredBackground(background)[`${mode}Url`],undefined);
 });
}
