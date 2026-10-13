import {clamp,timedBezier} from './motion-easing.js';
import {timedReveal} from './wipe-timing.js';
const smooth=x=>{const p=clamp(x);return p*p*(3-2*p);};
export const TRANSITIONS={song:{duration:1.94,returnDuration:.249},document:{duration:2.15,returnDuration:.251},banner:{duration:2.02,returnDuration:.251},story:{duration:2.06,returnDuration:.27}};
// Sequential VFR measurements: the clock starts at old-map coverage, not
// an assumed artwork onset. Artwork, glass, ink and text have distinct cues.
// A smooth distance-based clock lengthens the visible settling range while
// retaining the measured onset and base curve. Endpoint velocity stays zero.
const TITLE=[.421,.818,.15,.25,.52,8],ART=[.240,.672,.05,.85,1.00,6],INK=[.340,.761,.145,.855];
const BANNER_INK=[.568,.600,.248,.850];
const BANNER_HEADING=[.546,.880,.020,.496,.50];
const cue=(time,profile)=>timedBezier(time,...profile);
const wipe=(time,profile)=>timedReveal(time,...profile);
export function exitAt(layout,elapsed,reducedMotion=false){
 if(reducedMotion)return 1;
 if(layout==='story')return smooth(elapsed/TRANSITIONS.story.returnDuration);
 return timedBezier(elapsed,0,(TRANSITIONS[layout]??TRANSITIONS.document).returnDuration,layout==='song'?.020:.027,layout==='song'?.961:.980);
}
export function songTransitionAt(time,reducedMotion=false){
 const t=reducedMotion?3:Math.max(0,time);
 return{background:smooth(t/.34),backgroundElapsed:t,art:wipe(t,ART),artBlur:0,mapFade:Array(16).fill(1),title:wipe(t,TITLE),titleInk:cue(t,INK),record:1,recordX:0,exit:0};
}
export function readerTransitionAt(layout,time,reducedMotion=false){
 const t=reducedMotion?3:Math.max(0,time),story=layout==='story',banner=layout==='banner';
 const artDelay=story?.33:banner?.08:.32,artDuration=story?.86:banner?.82:.96;
 const textDelay=story?.56:banner?.52:.49,textDuration=story?.67:banner?.69:.84;
 const text=banner?wipe(t,BANNER_HEADING):timedReveal(t,textDelay,textDuration,1/3,2/3,.40);
 const textOpacity=banner?cue(t,BANNER_INK):smooth((t-(textDelay-.04))/textDuration);
 return{text,headingFeather:banner?4.774:.13,art:timedReveal(t,artDelay,artDuration,1/3,2/3,story?.85:banner?1.10:.85),textOpacity,background:smooth(t/.32),mapFade:Array(16).fill(1)};
}
