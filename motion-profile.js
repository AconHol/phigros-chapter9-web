import {TRANSITIONS,songTransitionAt} from './transition-curves.js';
import {easeFade} from './motion-easing.js';
// Camera and opacity timings measured from consecutive reference frames.
export const MAP_ENTRY={referenceStart:750.5715,ambientPhase:-.0785,cameraDelay:.229,cameraDuration:.692,offsetX:-1.247612,offsetY:24.077780,opacityDuration:.713,backBase:0,backDelay:.0575,backDuration:.692};
export const DETAIL_ENTRY={duration:TRANSITIONS.song.duration};
export const INTERFACE_ENTRY=TRANSITIONS.song;
const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=value=>{const t=clamp(value);return t*t*(3-2*t);};
// These three fades were measured inside the artwork, after undoing camera motion.
export const NODE_ENTRY=Object.freeze({'about-universe':{delay:0,duration:.715},'archive-03':{delay:.055,duration:.690},'archive-04':{delay:.005,duration:.710}});
export function nodeEntryAt(node,elapsed,reducedMotion=false){
 if(reducedMotion)return 1;
 const profile=node.entry??NODE_ENTRY[node.id]??{delay:0,duration:MAP_ENTRY.opacityDuration};
 return smooth((elapsed-(profile.delay??0))/Math.max(.001,profile.duration??MAP_ENTRY.opacityDuration));
}
export function mapEntryAt(elapsed,reducedMotion=false){
 if(reducedMotion)return {opacity:1,back:1,x:0,y:0};
 const progress=clamp((elapsed-MAP_ENTRY.cameraDelay)/MAP_ENTRY.cameraDuration),remaining=(1-progress)**2;
 const fade=clamp(elapsed/MAP_ENTRY.opacityDuration),opacity=fade*fade*(3-2*fade);
 const button=clamp((elapsed-MAP_ENTRY.backDelay)/MAP_ENTRY.backDuration);
 return {opacity,back:button*button*(3-2*button),x:MAP_ENTRY.offsetX*remaining,y:MAP_ENTRY.offsetY*remaining};
}
export function detailEntryAt(progress,closing=false){
 const eased=easeFade(progress);
 if(closing)return {art:eased,dim:eased,softness:eased};
 const state=songTransitionAt(progress*DETAIL_ENTRY.duration);return {art:state.art,dim:eased,softness:eased};
}
export function interfaceEntryAt(elapsed,reducedMotion=false){
 const state=songTransitionAt(elapsed,reducedMotion);return{title:state.title,titleInk:state.titleInk,record:state.record,recordX:state.recordX};
}
