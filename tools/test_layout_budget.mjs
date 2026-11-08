import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
const source=readFileSync(new URL("../web/webui_prompt_bridge.js",import.meta.url),"utf8");
function extract(name) {
    const start=source.indexOf(`function ${name}(`);
    assert(start>=0);
    return source.slice(start,source.indexOf("\nfunction ",start+1));
}
const c=vm.createContext({});
vm.runInContext(extract("clampNumber")+extract("fitBridgeSectionBudget"),c);
const base={top:220,extra:96,available:1601,topMin:220,extraMin:96,comfortTop:620};
const fixed=c.fitBridgeSectionBudget(base);
assert.equal(fixed.top,620);assert.equal(fixed.extra,981);
assert.equal(c.fitBridgeSectionBudget({...base,top:620,extra:960}),null,"Small intentional gap changed");
assert.equal(c.fitBridgeSectionBudget({...base,available:200}),null,"Impossible size should not generate negative heights");
assert.equal(c.fitBridgeSectionBudget({...base,top:NaN}),null);
const fractional=c.fitBridgeSectionBudget({...base,top:1000,extra:96,available:650.8});
assert(fractional.top>=220&&fractional.extra>=96,"Fractional viewport budget crossed a section minimum");
let checks=0;
for(const top of [220,420,620,1000,2000]) for(const extra of [96,152,320,520,1400]) for(const available of [316,400,650,960,1600,3100]) {
    const plan=c.fitBridgeSectionBudget({...base,top,extra,available});
    if(plan){assert(plan.top>=220);assert(plan.extra>=96);assert(Math.abs(plan.top+plan.extra-available)<=1);
        assert.equal(c.fitBridgeSectionBudget({...base,...plan,available}),null,"Budget repair must be idempotent");}
    checks++;
}
// Exercise the real setSize wrapper with a host that uses Float32Array size.
const begin=source.indexOf('    if (!node.__webuiBridgeSetSizeWrapped');
const end=source.indexOf('    const hadRepairablePanelSize',begin);
assert(begin>=0&&end>begin);
const context=vm.createContext({
    window:{requestAnimationFrame:f=>f()},
    shouldRepairBridgePanelSize:()=>false,bridgeRepairedPanelSizeLockActive:()=>false,
    clampPanelSize:(w,h)=>[w,h],bridgePanelSizesMatch:(a,b)=>a?.[0]===b?.[0]&&a?.[1]===b?.[1],
});
vm.runInContext(`function install(node){${source.slice(begin,end)}}`,context);
const node={size:new Float32Array([1000,800]),__webuiBridgeDesiredSize:[1000,800],setSize(size){this.size=new Float32Array(size)}};
context.install(node);node.size[1]=1500;node.setSize(node.size);
assert.equal(node.__webuiBridgeDesiredSize[1],1500,"Native typed-array resize bypassed desired size update");
assert.equal(node.__webuiBridgeSavedPanelSize[1],1500,"Native typed-array resize was not persisted");
// Storage defaults can change, but existing panels retain independent heights.
const storage=new Map([["height",620]]);
const heights=vm.createContext({
    readLocalNumber:(key,fallback)=>storage.get(key)??fallback,
    writeLocalNumber:(key,value)=>storage.set(key,value),clearLocalValue:key=>storage.delete(key),
    window:{setTimeout:f=>f()},
});
for(const name of ["clampNumber","resolveResizeValue","resizeTargetKey","resizeTargetLayoutHeight","applyStoredHeight","setResizeTargetHeight","resetResizeTargetHeight","persistResizeTargetHeight"])
    vm.runInContext(extract(name),heights);
const a={style:{},offsetHeight:0},b={style:{},offsetHeight:0};
heights.applyStoredHeight(a,"height");storage.set("height",500);heights.applyStoredHeight(b,"height");
heights.applyStoredHeight(a,"height");assert.equal(a.style.height,"620px");assert.equal(b.style.height,"500px");
heights.setResizeTargetHeight(a,"height",550);heights.applyStoredHeight(b,"height");assert.equal(b.style.height,"500px");
heights.resetResizeTargetHeight(a,"height");assert.equal(a.__webuiBridgePreferredHeight,undefined);
// Vue's socket-aware fill height must not be compared to the legacy fixed box.
vm.runInContext(extract("bridgeDomWidgetShellNeedsSync"),heights);
const host={style:{position:"absolute"}},root={isConnected:true,offsetWidth:500,offsetHeight:260,style:{width:"100%",height:"100%"}};
const panel={isConnected:true,__webuiBridgeExpectedWidgetSize:[520,350],style:{height:"100%"},classList:{contains:()=>true},closest:()=>host};
assert.equal(heights.bridgeDomWidgetShellNeedsSync(panel,root),false,"Valid Vue fill caused an infinite shell-repair loop");
root.style.height="350px";assert.equal(heights.bridgeDomWidgetShellNeedsSync(panel,root),true);
console.log(`Layout budget: ${checks} size combinations, manual-gap preservation, idempotence, independent panels, native typed-array resize and Vue shell guard passed.`);
