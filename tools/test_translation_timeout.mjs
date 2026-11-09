/** Derived from magicdolls PR #12; maintainer policy: retry explicit HTTP
 * rejection only, not ambiguous timeouts or deterministic misses.
 * Timers are shortened for the test; production timeout remains 45 s.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('../web/webui_prompt_bridge.js', import.meta.url), 'utf8');
const queueStart = src.indexOf('const localTranslationCache = new Map();');
const queueEnd = src.indexOf('function normalizeLoraName(', queueStart);
const apiStart = src.indexOf('async function translatePromptAllInOne(');
const apiEnd = src.indexOf('\nfunction translationDiagnosticMessage(', apiStart);
assert.ok(queueStart >= 0 && queueEnd > queueStart && apiStart >= 0 && apiEnd > apiStart);
const queueSource = src.slice(queueStart,queueEnd)
  .replace('const LOCAL_TRANSLATION_RETRY_DELAY_MS = 7000;', 'const LOCAL_TRANSLATION_RETRY_DELAY_MS = 15;')
  .replace('const LOCAL_TRANSLATION_REQUEST_TIMEOUT_MS = 45000;', 'const LOCAL_TRANSLATION_REQUEST_TIMEOUT_MS = 70;');
const apiSource = src.slice(apiStart,apiEnd);

function runner(fetch) {
  const warnings = [];
  const ctx = vm.createContext({
    window:{setTimeout,clearTimeout},
    AbortController,
    console:{warn:(...parts)=>warnings.push(parts.join(' '))},
    api:{fetchApi:fetch},
    bridgeJson:async (response)=>response,
    bridgeTimeoutError:(message)=>Object.assign(new Error(message),{name:'TimeoutError'}),
    normalizeAttentionValue:(tag)=>({body:tag}),
  });
  vm.runInContext(`${queueSource}\n${apiSource}`, ctx);
  return {
    translate: vm.runInContext('translateTagsToLocal',ctx),
    reset: vm.runInContext('resetLocalTranslationCache',ctx),
    state:()=>vm.runInContext('({active:localTranslationActiveBatches,pending:localTranslationPending.size,queued:localTranslationQueue.length})',ctx),
    cache:(k)=>vm.runInContext(`localTranslationCache.get(${JSON.stringify(k)})`,ctx),
    warnings,
  };
}

const delay=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));
const timeout=(ms)=>new Promise((_,reject)=>setTimeout(()=>reject(Error(`Test exceeded ${ms}ms`)),ms));
const resolved=(text,localFn=(v)=>`zh_${v}`)=>({tags:text.split(', ').map((v)=>({input:v, local:localFn(v),matched:true}))});

// 1. Two batches that NEVER settle must not block later jobs.
{
  const requests=[];
  const t=runner((_url, options)=>{
    const {text}=JSON.parse(options.body);
    requests.push({text,signal:options.signal});
    if(text.startsWith('stuck_')) return new Promise(()=>{}); // ignores abort!
    return Promise.resolve(resolved(text));
  });
  const tags=['stuck_1','stuck_2','stuck_3','stuck_4','good_1','good_2','good_3'];
  const results=await Promise.race([t.translate(tags),timeout(1000)]);
  assert.deepEqual(Array.from(results),['','','','','zh_good_1','zh_good_2','zh_good_3']);
  assert.ok(requests.some((r)=>r.text==='good_1, good_2'));
  assert.ok(requests.some((r)=>r.signal?.aborted));
  for(const tag of tags.filter(tag=>tag.startsWith('stuck_'))){
    assert.equal(requests.filter(r=>r.text.split(', ').includes(tag)).length,1);
  }
  assert.equal(t.state().active,0);
  assert.equal(t.state().pending,0);
  console.log('PASS: hung transport releases slots without duplicate ambiguous request');
}

// 2. Ignore a late success from an already timed-out request.
{
  let lateCalls=0;
  const t=runner((_url, options)=>{
    const {text}=JSON.parse(options.body);
    lateCalls++;
    if(lateCalls===1) return new Promise((resolve)=>setTimeout(()=>resolve(resolved(text,()=>"old_late")),180));
    return Promise.resolve(resolved(text,()=>"new_valid"));
  });
  const result=await Promise.race([t.translate(['late_tag']),timeout(700)]);
  assert.equal(result[0],'');
  t.reset();
  assert.equal((await t.translate(['late_tag']))[0],'new_valid');
  await delay(180);
  assert.equal(t.cache('late_tag'),'new_valid');
  assert.equal(t.state().active,0);
  assert.equal(lateCalls,2);
  console.log('PASS: late response cannot overwrite retry result');
}

// 5. Deterministic miss/config/auth failures have no delayed retry; rerender
// is cooled down, settings reset permits another explicit attempt.
for (const response of [
  {tags:[{input:'missing',local:'missing',matched:false}],diagnostics:{warnings:[{code:'translation_source_builtin'}]}},
  {tags:[],diagnostics:{errors:[{code:'ai_api_key_missing'}]}},
  Object.assign(new Error('Unauthorized'),{status:401}),
  Object.assign(new Error('Gateway deadline'),{status:504}),
]) {
  let calls=0;
  const t=runner(async()=>{calls++;if(response instanceof Error)throw response;return response;});
  assert.equal((await t.translate(['missing']))[0],'');
  await t.translate(['missing']);assert.equal(calls,1);
  t.reset();await t.translate(['missing']);assert.equal(calls,2);
}
console.log('PASS: deterministic failures and rerenders do not trigger automatic retry');

// 6. An explicit transient HTTP response can be retried once.
{
  let calls=0;const t=runner(async(_url,options)=>{
    if(++calls===1)throw Object.assign(new Error('Rate limited'),{status:429});
    return resolved(JSON.parse(options.body).text);
  });
  assert.equal((await t.translate(['transient']))[0],'zh_transient');assert.equal(calls,2);
}
console.log('PASS: explicit transient rejection gets one bounded retry');

// 3. Repeated tags share one request and both consumers resolve.
{
  const sent=[];
  const t=runner((_url,options)=>{
    const {text}=JSON.parse(options.body);
    sent.push(text);
    return Promise.resolve(resolved(text));
  });
  const out=await t.translate(['repeat','repeat','other']);
  assert.deepEqual(Array.from(out),['zh_repeat','zh_repeat','zh_other']);
  assert.deepEqual(sent,['repeat, other']);
  assert.equal(t.state().pending,0);
  console.log('PASS: duplicate tag requests remain deduplicated');
}

// 4. Abort signal is actually forwarded to the API transport.
{
  let seenSignal;
  const t=runner((_url,options)=>{
    seenSignal=options.signal;
    return new Promise(()=>{});
  });
  await Promise.race([t.translate(['blocked']),timeout(500)]);
  assert.equal(seenSignal.aborted,true);
  assert.equal(t.state().active,0);
  console.log('PASS: fetch signal aborted after timeout');
}
