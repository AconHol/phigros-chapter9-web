import {sampleCurve} from './motion-easing.js';
import {LOADING_PROFILE as P} from './loading-profile.js';
import {GRID_TRANSITION} from './grid-transition-profile.js';
import {GridTransition} from './grid-transition.js';
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{const t=clamp(x);return t*t*(3-2*t);};
const sample=sampleCurve;
export class LoadingSequence{
 constructor(element,options={},reducedMotion=false){
  this.element=element;this.started=performance.now();this.active=options!==false&&options?.enabled!==false&&!reducedMotion;
  this.duration=Math.max(.5,Math.min(12,Number(options?.duration)||P.minimumDuration));
  this.dots=[...element.querySelectorAll('.loading-dots span')];
  if(this.active)this.grid=new GridTransition(element.querySelector('#loading-grid'));
  if(!this.active){element.hidden=true;this.phase='complete';}
 }
 async preload(){if(this.grid)await this.grid.load();}
 update(now,ready){
  if(!this.active){if(ready&&!this.sceneStarted)this.sceneStarted=now;return;}
  const elapsed=Math.max(0,(now-this.started)/1000);let black=1,white=0,grid=0,logo=sample(P.loadingKeys,Math.min(elapsed,P.loadingKeys.at(-1)[0]),1);
  const imagesReady=[...this.element.querySelectorAll('img')].every(image=>image.complete&&image.naturalWidth);
  if(ready&&imagesReady&&elapsed>=this.duration&&!this.exitStarted)this.exitStarted=now;
  this.phase='loading';
  if(this.exitStarted){
   const t=(now-this.exitStarted)/1000,riseEnd=GRID_TRANSITION.duration,revealAt=riseEnd+P.whiteHold;
   logo*=1-smooth(t/P.logoOut);grid=1;this.grid.draw(Math.min(t,GRID_TRANSITION.referenceTimes.at(-1)));this.phase='grid';
   if(t>=riseEnd){white=1;this.phase='white';}
   if(t>=riseEnd)black=0;
   if(t>=revealAt){
    if(!this.sceneStarted)this.sceneStarted=this.exitStarted+revealAt*1000;
    const reveal=t-revealAt;white=sample(P.whiteKeys,reveal,1);grid=0;this.phase='revealing';
    if(reveal>=P.revealDuration){this.active=false;this.phase='complete';this.element.hidden=true;this.element.setAttribute('aria-hidden','true');}
   }
  }
  this.element.style.setProperty('--loading-black',String(black));this.element.style.setProperty('--loading-white',String(white));this.element.style.setProperty('--loading-logo',String(logo));
  this.element.style.setProperty('--loading-grid',String(grid));
  const dotIntro=P.loadingKeys[1][0],dotKeys=P.loadingKeys.slice(1),dotPeriod=dotKeys.at(-1)[0]-dotIntro;
  const dotTime=elapsed<dotIntro?elapsed:dotIntro+(elapsed-dotIntro)%dotPeriod;
  for(let i=0;i<this.dots.length;i++)this.dots[i].style.opacity=String(sample(elapsed<dotIntro?P.loadingKeys.slice(0,2):dotKeys,dotTime,i+2));
  this.element.dataset.phase=this.phase;this.element.dataset.elapsed=elapsed.toFixed(6);this.element.dataset.white=white.toFixed(6);this.element.dataset.logo=logo.toFixed(6);this.element.dataset.grid=grid.toFixed(6);this.element.dataset.exitElapsed=this.exitStarted?((now-this.exitStarted)/1000).toFixed(6):'0';
 }
}
