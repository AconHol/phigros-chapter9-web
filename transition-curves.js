import {clamp,timedBezier,sampleCurve} from './motion-easing.js';
import {timedReveal} from './wipe-timing.js';
const smooth=x=>{const p=clamp(x);return p*p*(3-2*p);};
export const TRANSITIONS={song:{duration:1.94,returnDuration:.249},document:{duration:2.15,returnDuration:.251},banner:{duration:2.02,returnDuration:.251},story:{duration:1.30,returnDuration:.27}};
// Sequential VFR measurements: the clock starts at old-map coverage, not
// an assumed artwork onset. Artwork, glass, ink and text have distinct cues.
// A smooth distance-based clock lengthens the visible settling range while
// retaining the measured onset and base curve. Endpoint velocity stays zero.
const TITLE=[.421,.818,.15,.25,.52,8],ART=[.240,.672,.05,.85,1.00,6],INK=[.340,.761,.145,.855];
const BANNER_INK=[.568,.600,.248,.850];
const BANNER_HEADING=[.546,.880,.020,.496,.50];
// SVID_20261010_164209_1.mp4, 20.96–23.18s. One oblique picture front;
// text enters later. Monotone Hermite sampling preserves the measured cues.
const STORY_ART=[[0,0],[.32,0],[.434,.290],[.690,.646],[.928,.810],[1.08,.92],[1.20,1]];
const STORY_TEXT=[[0,0],[.55,0],[.647,.122],[.733,.286],[.819,.501],[.904,.658],[.990,.824],[1.076,.985],[1.16,1]];
const STORY_EXIT=[[0,0],[.107,.40],[.195,.72],[.27,1]];
const cue=(time,profile)=>timedBezier(time,...profile);
const wipe=(time,profile)=>timedReveal(time,...profile);
export function exitAt(layout,elapsed,reducedMotion=false){
 if(reducedMotion)return 1;
 if(layout==='story')return sampleCurve(STORY_EXIT,Math.max(0,elapsed),1);
 return timedBezier(elapsed,0,(TRANSITIONS[layout]??TRANSITIONS.document).returnDuration,layout==='song'?.020:.027,layout==='song'?.961:.980);
}
export function songTransitionAt(time,reducedMotion=false){
 const t=reducedMotion?3:Math.max(0,time);
 return{background:smooth(t/.34),backgroundElapsed:t,art:wipe(t,ART),artBlur:0,mapFade:Array(16).fill(1),title:wipe(t,TITLE),titleInk:cue(t,INK),record:1,recordX:0,exit:0};
}
export function readerTransitionAt(layout,time,reducedMotion=false){
 const t=reducedMotion?3:Math.max(0,time),story=layout==='story',banner=layout==='banner';
 if(story){const text=sampleCurve(STORY_TEXT,t,1);return{text,headingFeather:.13,art:sampleCurve(STORY_ART,t,1),textOpacity:text,background:smooth(t/.32),mapFade:Array(16).fill(1)};}
 const artDelay=story?.33:banner?.08:.32,artDuration=story?.86:banner?.82:.96;
 const textDelay=story?.56:banner?.52:.49,textDuration=story?.67:banner?.69:.84;
 const text=banner?wipe(t,BANNER_HEADING):timedReveal(t,textDelay,textDuration,1/3,2/3,.40);
 const textOpacity=banner?cue(t,BANNER_INK):smooth((t-(textDelay-.04))/textDuration);
 return{text,headingFeather:banner?4.774:.13,art:timedReveal(t,artDelay,artDuration,1/3,2/3,story?.85:banner?1.10:.85),textOpacity,background:smooth(t/.32),mapFade:Array(16).fill(1)};
}
