import {clamp,sampleCurve} from './motion-easing.js';
const smooth=x=>{const t=clamp(x);return t*t*(3-2*t);};
const grow=x=>1-(1-clamp(x))**3;
export function backdropLayersAt(layout,time,reducedMotion=false){
 const t=reducedMotion?3:Math.max(0,time),song=layout==='song';
 const upper=grow((t-.015)/(song?.74:.87)),lower=grow((t-.06)/(song?1.04:1.22)),clear=smooth((t-(song?.69:.83))/(song?.37:.43));
 // The old map softens through the reveal, rather than reaching maximum
 // blur before the artwork starts. The final Gaussian strength is unchanged.
 const underlay=smooth(clamp(t/(song?1.10:1.28))**1.4);
 // The lower lattice has the same full-cell geometry as the upper plane.
 // Its strokes are already present
 // in the blurred material; expansion and Gaussian clearing expose it together.
 // Its final period differs from the upper plane, so the lattices overlap.
 return{upperScale:.86+.14*upper,lowerScale:.72+.32*lower,lowerBlur:12*(1-(.25*lower+.75*clear)),underlayBlur:16*underlay,cover:smooth(t/(song?.34:.32))};
}
export function edgeRevealAt(value){const wipe=clamp(value);return{visibility:wipe>0?1:0,wipe};}
export function edgeWipeMask(value,feather=.13){
 const p=clamp(value);if(p<=0)return'linear-gradient(transparent,transparent)';if(p>=1)return'none';
 // A single oblique front: the transparent area never opens a second window.
 const front=-feather+p*(1+2*feather),solid=(front-feather)*100,empty=(front+feather)*100;
 const stops=Array.from({length:9},(_,i)=>{const x=i/8,alpha=1-x*x*(3-2*x);return`rgba(0,0,0,${alpha.toFixed(6)}) ${(solid+(empty-solid)*x).toFixed(4)}%`;});
 return`linear-gradient(106.7deg,${stops.join(',')})`;
}
export function mapRevealAt(time,reducedMotion=false){
 const t=reducedMotion?2:Math.max(0,time),settle=sampleCurve([[0,1],[.24,.94],[.43,.72],[.59,.32],[.73,.08],[.93,0],[1.16,0]],t,1);
 return{push:0,glow:1+6.5*settle,exposure:1};
}
