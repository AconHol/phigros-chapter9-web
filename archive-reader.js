import {readerTransitionAt,TRANSITIONS,exitAt} from './transition-curves.js';
import {edgeWipeMask} from './transition-effects.js';
export class ArchiveReader{
 constructor(element){
  this.element=element;this.title=element.querySelector('h1');this.content=element.querySelector('.archive-text');this.image=element.querySelector('img');this.grid=element.querySelector('.archive-grid');this.node=null;this.progress=0;
  element.querySelector('[data-page="previous"]').addEventListener('click',()=>this.showPage(this.index-1));element.querySelector('[data-page="next"]').addEventListener('click',()=>this.showPage(this.index+1));
  this.expand=element.querySelector('.story-expand');this.viewer=document.getElementById('story-art-viewer');this.viewerImage=this.viewer.querySelector('img');
  this.expand.addEventListener('click',()=>{if(!this.page?.image)return;clearTimeout(this.viewerTimer);this.viewer.dataset.closing='false';this.viewerImage.src=this.page.image;this.viewerImage.alt=this.page.title??this.node.title;this.viewer.showModal();});
  this.viewer.querySelector('button').addEventListener('click',()=>this.dismissArt());this.viewer.addEventListener('cancel',event=>{event.preventDefault();this.dismissArt();});this.viewer.addEventListener('click',event=>{if(event.target===this.viewer)this.dismissArt();});
 }
 dismissArt(immediate=false){if(!this.viewer.open)return;clearTimeout(this.viewerTimer);this.viewer.dataset.closing='true';if(immediate||this.reducedMotion)this.viewer.close();else this.viewerTimer=setTimeout(()=>this.viewer.close(),220);}
 get active(){return this.node!==null;}
 async preload(nodes){this.preloaded=await Promise.all([...new Set(nodes.flatMap(n=>(n.pages??[]).flatMap(p=>[p.image,p.imageDetail&&(!p.imageDetail.baseImage||p.imageDetail.baseImage===p.image)?p.imageDetail.image:null]).filter(Boolean)))].map(async path=>{const image=new Image();image.src=path;await image.decode();return image;}));}
 open(node,time,reducedMotion=false){
  this.node=node;this.started=time;this.reducedMotion=reducedMotion;this.closing=false;this.closeState=null;this.mapFade=Array(16).fill(1);this.progress=0;this.artProgress=0;this.backgroundProgress=0;this.elapsed=0;this.exit=0;this.element.style.opacity='1';this.element.hidden=false;
  this.pages=node.pages?.length?node.pages:[{title:node.title,image:node.image,text:[]}];this.showPage(0);this.title.focus({preventScroll:true});this.update(time);
 }
 showPage(index){
  this.index=Math.max(0,Math.min(this.pages.length-1,index));this.page=this.pages[this.index];const page=this.page,layout=page.image&&(page.layout??'document')==='document'?'banner':page.layout??'document';
  this.element.dataset.layout=layout;this.element.dataset.backdrop='true';this.element.dataset.procedural='true';this.element.dataset.native='false';this.element.dataset.nativeStory='false';this.nativeHero=null;this.title.textContent=page.title??this.node.title;
  this.image.hidden=true;this.image.removeAttribute('src');this.artImage=page.image??null;const sourceMatches=!page.imageDetail?.baseImage||page.imageDetail.baseImage===page.image;this.artDetail=sourceMatches?(page.imageDetail??null):null;const placementMatches=!page.imagePlacement?.baseImage||page.imagePlacement.baseImage===page.image;this.artPlacement=sourceMatches&&placementMatches?(page.imagePlacement??null):null;this.dim=0;this.expand.hidden=layout!=='story'||!page.image;
  const text=Array.isArray(page.text)?page.text:typeof page.text==='string'?page.text.split(/\n\s*\n/):[];
  this.content.replaceChildren(...text.map(value=>{const p=document.createElement('p');p.textContent=value;return p;}));this.element.querySelector('.archive-scroll').scrollTop=0;
  const nav=this.element.querySelector('.archive-pages');nav.hidden=this.pages.length<2;nav.querySelector('span').textContent=`${this.index+1} / ${this.pages.length}`;nav.querySelector('[data-page="previous"]').disabled=this.index===0;nav.querySelector('[data-page="next"]').disabled=this.index===this.pages.length-1;
 }
 close(time){if(this.closing)return;this.dismissArt(true);this.closing=true;this.closedAt=time;this.closeState={elapsed:this.elapsed,art:this.artProgress,text:this.textProgress,background:this.backgroundProgress,textOpacity:this.textOpacity};}
 updateGrid(){}
 update(time){
  if(!this.active)return false;const elapsed=time-this.started,layout=this.element.dataset.layout,state=readerTransitionAt(layout,elapsed,this.reducedMotion);
  this.exit=this.closing?(exitAt(layout,time-this.closedAt,this.reducedMotion)):0;
  this.elapsed=this.closing?this.closeState.elapsed:elapsed;this.artProgress=this.closing?this.closeState.art:state.art;this.textProgress=this.closing?this.closeState.text:state.text;this.backgroundProgress=this.closing?this.closeState.background:state.background;this.progress=this.backgroundProgress;this.artWipeProgress=this.artProgress;this.artVisibility=1;this.textOpacity=this.closing?this.closeState.textOpacity:state.textOpacity;
  this.title.style.maskImage=edgeWipeMask(this.textProgress,state.headingFeather);this.content.style.maskImage='none';this.element.style.maskImage='none';this.element.style.opacity=String(1-this.exit);this.element.style.setProperty('--archive-text',String(this.textOpacity));this.title.style.opacity=this.textProgress>0?'1':'0';
  this.expand.style.opacity=String(this.artProgress);this.expand.disabled=this.artProgress<.8||this.closing;
  this.element.dataset.phase=this.closing?'closing':elapsed>=(TRANSITIONS[layout]??TRANSITIONS.document).duration?'open':'opening';this.element.dataset.elapsed=elapsed.toFixed(6);this.element.dataset.artWipe=this.artProgress.toFixed(6);this.element.dataset.titleWipe=this.textProgress.toFixed(6);this.element.dataset.exitWipe=this.exit.toFixed(6);this.element.dataset.textOpacity=(this.textOpacity).toFixed(6);
  if(this.closing&&this.exit===1){this.node=null;this.element.hidden=true;return true;}return false;
 }
}
