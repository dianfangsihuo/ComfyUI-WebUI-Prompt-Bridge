import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../web/webui_prompt_bridge.js',import.meta.url),'utf8');
function fn(name){const i=source.indexOf(`function ${name}(`);assert(i>=0);return source.slice(i,source.indexOf('\nfunction ',i+1));}
class Element {
 constructor(classes,parent=null){
  const set=new Set(classes.split(' '));this.classList={contains:k=>set.has(k),add:k=>set.add(k),remove:k=>set.delete(k)};
  const values=new Map();this.style={setProperty:(k,v,p)=>{values.set(k,[v,p]);this.style[k.replace(/-([a-z])/g,(_,l)=>l.toUpperCase())]=v;},getPropertyValue:k=>values.get(k)?.[0]||'',getPropertyPriority:k=>values.get(k)?.[1]||'',removeProperty:k=>values.delete(k)};
  this.parentElement=parent;this.isConnected=true;this.offsetHeight=500;this.offsetWidth=1000;
 }
 closest(selector){for(let e=this;e;e=e.parentElement)if(e.classList.contains(selector.slice(1)))return e;return null;}
}
for(const extraWrappers of [0,2,4]){
 const body=new Element('body'),node=new Element('lg-node',body),host=new Element('lg-node-widgets',node);
 let p=host;const chain=[];
 for(let i=0;i<extraWrappers;i++){p=new Element('grid-rows-subgrid',p);chain.push(p);}
 p=new Element('lg-node-widget',p);chain.push(p);p=new Element('subgrid',p);chain.push(p);
 const panel=new Element('webui-bridge-panel',p);
 const c=vm.createContext({document:{body,querySelectorAll:()=>[]},DOM_WIDGET_CONTENT_MIN_WIDTH:604,DEFAULT_PANEL_WIDTH:1180,DEFAULT_PANEL_HEIGHT:1180,DOM_WIDGET_INPUT_LABEL_GUTTER:18,DOM_WIDGET_OUTPUT_LABEL_GUTTER:18,DOM_WIDGET_NODE_EDGE_PAD:10,installBridgeDomWidgetShellGuard:()=>{},queueMicrotask:fn=>fn()});
 vm.runInContext(fn('syncBridgeDomWidgetWrapper')+fn('bridgeDomWidgetShellNeedsSync'),c);
 c.syncBridgeDomWidgetWrapper(panel,1000,700);
 assert.equal(host.style.position,'absolute');assert.equal(host.style.height,'auto');
 for(const e of chain)assert.equal(e.style.height,'100%','Intermediate wrapper not repaired');
 assert.equal(c.bridgeDomWidgetShellNeedsSync(panel,p),false);
 chain[0].offsetHeight=0;assert.equal(c.bridgeDomWidgetShellNeedsSync(panel,p),true,'Connected but clipped ancestor was accepted');
}
console.log('PASS Vue shell: legacy/new nested subgrids fill the whole chain; clipped ancestor detected');
