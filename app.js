import {VIEW,GRID,OPTICS,buildScene,project,unproject} from './map-geometry.js';
import {MapRenderer} from './map-renderer.js';
import {interfaceEntryAt,mapEntryAt,MAP_ENTRY} from './motion-profile.js';
import {ArchiveReader} from './archive-reader.js';
import {LoadingSequence} from './loading-sequence.js';
import {edgeRevealAt} from './transition-effects.js';
import {exitAt} from './transition-curves.js';
import {setTitleGlassWipe} from './title-glass.js';
import {navigationBounds,cameraLimits,resistAxis,settleAxis} from './map-bounds.js';
import {storyLayoutAt} from './story-layout.js';
import {BackgroundAudio} from './background-audio.js';

const $=id=>document.getElementById(id),stage=$('stage'),input=$('map-input'),targets=$('node-accessibility');
const initial={x:VIEW.width/2,y:VIEW.height/2,zoom:1},camera={...initial};
const archive=new ArchiveReader($('reader'));
const music=new BackgroundAudio($('ambience'),$('sound'));
const pointers=new Map(),buttons=new Map(),reducedMotion=matchMedia('(prefers-reduced-motion:reduce)').matches;
let renderer,scene,panBounds,boot,resourcesReady=false,scale=1,stageWidth=VIEW.width,stageHeight=VIEW.height,gesture=null,velocity=[0,0],animation=null,lastFrame=0,lastDraw=0,dirty=true,clock=0,noticeTimer,lastInput=0,selectedNode=null,detailClosing=false,interfaceClosing=null;

function resize(){
 stageWidth=Math.max(VIEW.width,innerWidth/innerHeight*VIEW.height);stageHeight=Math.max(VIEW.height,innerHeight/innerWidth*VIEW.width);scale=innerWidth/stageWidth;camera.viewWidth=initial.viewWidth=stageWidth;camera.viewHeight=initial.viewHeight=stageHeight;
 stage.style.width=`${stageWidth}px`;stage.style.height=`${stageHeight}px`;stage.style.transform=`scale(${scale})`;stage.style.setProperty('--stage-extra-height',`${stageHeight-VIEW.height}px`);
 stage.style.setProperty('--stage-height',`${stageHeight}px`);
 const uiScale=Math.min(1.25,stageHeight/VIEW.height),uiExpansion=(uiScale-1)/.25;
 stage.style.setProperty('--back-scale',String(uiScale));stage.style.setProperty('--song-ui-scale',String(uiScale));stage.style.setProperty('--song-ui-expansion',String(uiExpansion));stage.style.setProperty('--song-title-top',`${216*uiScale-4*uiExpansion}px`);
 stage.style.setProperty('--story-image-left',`${-350-209.29*uiExpansion}px`);stage.style.setProperty('--story-image-top',`${96.195*uiExpansion}px`);stage.style.setProperty('--story-image-height',`${VIEW.height+202.903*uiExpansion}px`);stage.style.setProperty('--story-text-top',`${126+85.9*uiExpansion}px`);stage.style.setProperty('--story-font',`${Math.max(31.1*uiScale,16/scale)}px`);
 stage.style.setProperty('--native-story-left',`${-350-210*uiExpansion}px`);stage.style.setProperty('--native-story-top',`${96*uiExpansion}px`);stage.style.setProperty('--native-story-height',`${VIEW.height+202.371*uiExpansion}px`);
 syncStoryLayout();
 stage.style.setProperty('--archive-font',`${Math.max(37.333333,16/scale)}px`);stage.style.setProperty('--archive-heading',`${Math.max(72,28/scale)}px`);
 const inset=Math.max(0,(stageWidth-VIEW.width)*.35);stage.style.setProperty('--ui-inset',`${inset}px`);stage.dataset.uiInset=inset.toFixed(3);
 renderer?.resize(innerWidth,innerHeight,stageWidth,stageHeight);stage.dataset.viewWidth=stageWidth.toFixed(3);stage.dataset.viewHeight=stageHeight.toFixed(3);if(panBounds&&!selectedNode)clampCamera();dirty=true;
}
function syncStoryLayout(){
 const story=storyLayoutAt(stageHeight/stageWidth*1280,archive.artPlacement),unit=stageWidth/1280;
 for(const key of ['left','right','top','bottom'])stage.style.setProperty(`--story-text-${key}`,`${story.text[key]*unit}px`);
 stage.style.setProperty('--story-font',`${Math.max(story.text.font*unit,16/scale)}px`);stage.style.setProperty('--story-feather',`${108*unit}px`);
 stage.style.setProperty('--story-expand-left',`${story.expand.left*unit}px`);stage.style.setProperty('--story-expand-top',`${story.expand.top*unit}px`);stage.style.setProperty('--story-expand-size',`${32*unit}px`);
}
function point(event){const rect=stage.getBoundingClientRect();return [(event.clientX-rect.left)/scale,(event.clientY-rect.top)/scale];}
function sceneTime(now=performance.now()){return boot&&!boot.sceneStarted?0:Math.max(0,(now-(boot?.sceneStarted??renderer?.started??now))/1000);}
function notify(text){$('notice').textContent=text;$('notice').classList.add('show');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').classList.remove('show'),1800);}
function cancelMotion(){animation=null;velocity=[0,0];lastInput=performance.now();dirty=true;}
function clampCamera(resist=false){
 camera.zoom=Math.max(.7,Math.min(4.6,camera.zoom));if(!panBounds)return;
 const limits=cameraLimits(panBounds,camera,{width:stageWidth,height:stageHeight},initial),extent=(Math.max(32,Number(scene.navigation?.elasticity)||110))/(scale*camera.zoom);
 const x=resist?resistAxis(camera.x,limits.minX,limits.maxX,extent):Math.max(limits.minX,Math.min(limits.maxX,camera.x));
 const y=resist?resistAxis(camera.y,limits.minY,limits.maxY,extent):Math.max(limits.minY,Math.min(limits.maxY,camera.y));
 if(!resist){if(x!==camera.x)velocity[0]=0;if(y!==camera.y)velocity[1]=0;}camera.x=x;camera.y=y;
 stage.dataset.panResistance=resist?'rubber-band':'bounded';
 stage.dataset.panBounds=JSON.stringify(panBounds);stage.dataset.panLimits=JSON.stringify(limits);
}
function syncTargets(actual){
 for(const node of scene.nodes){
  const polygon=node.polygon.map(p=>project(p,actual,renderer.lean)),xs=polygon.map(p=>p[0]),ys=polygon.map(p=>p[1]),left=Math.min(...xs),top=Math.min(...ys),button=buttons.get(node.id);
  Object.assign(button.style,{left:`${left}px`,top:`${top}px`,width:`${Math.max(...xs)-left}px`,height:`${Math.max(...ys)-top}px`});
 }
 stage.dataset.camera=`${camera.x.toFixed(2)},${camera.y.toFixed(2)},${camera.zoom.toFixed(3)}`;
}
function reset(){
 if(!renderer||boot?.active)return;if(selectedNode)closeDetail();cancelMotion();animation={from:{...camera},to:{...initial},start:performance.now(),duration:reducedMotion?1:620};
}
function clickNode(node){
 if(!renderer?.loaded||boot?.active||!node||selectedNode)return;clock=sceneTime();renderer.pulse(node,clock);stage.dataset.lastClicked=node.id;stage.dataset.clicks=String(Number(stage.dataset.clicks||0)+1);dirty=true;
 if(!node.unlocked||!['song','story','clue','document'].includes(node.type))return;
 if(node.type==='song'?!node.image:!node.image&&!node.mapText&&!node.pages?.length)return;
 cancelMotion();selectedNode=node;detailClosing=false;interfaceClosing=null;renderer.hover=null;
 if(node.type!=='song'){
  archive.open(node,clock,reducedMotion);syncStoryLayout();targets.inert=true;targets.setAttribute('aria-hidden','true');stage.dataset.mode='reader';stage.dataset.detailNode=node.id;stage.dataset.detailPhase='opening';$('back').setAttribute('aria-label','返回地图');$('back').title='返回地图 Esc';return;
 }
 renderer.select(node,clock,reducedMotion);
 $('song-title').textContent=node.title;$('song-artist').textContent=node.artist||'';
 const detail=$('detail');detail.classList.remove('entered','closing');detail.style.setProperty('--title-opacity','0');detail.style.setProperty('--record-opacity','0');detail.style.setProperty('--record-x','-198.201093px');detail.hidden=false;targets.inert=true;targets.setAttribute('aria-hidden','true');
 stage.dataset.mode='detail';stage.dataset.detailNode=node.id;stage.dataset.detailPhase='opening';$('back').setAttribute('aria-label','返回地图');$('back').title='返回地图 Esc';
 requestAnimationFrame(()=>{if(selectedNode&&!detailClosing)detail.classList.add('entered');});$('song-title').focus({preventScroll:true});
}
function closeDetail(){
 if(!selectedNode||detailClosing)return;cancelMotion();clock=sceneTime();
 if(archive.active){archive.close(clock);detailClosing=true;stage.dataset.detailPhase='closing';dirty=true;return;}
 renderer.updateDetail(clock);interfaceClosing={...interfaceEntryAt(clock-renderer.detail.start,reducedMotion),start:clock};detailClosing=true;renderer.closeDetail(clock,reducedMotion);$('detail').classList.add('closing');stage.dataset.detailPhase='closing';dirty=true;
}
function updateInterface(){
 if(!selectedNode||archive.active)return;
 const profile=interfaceClosing?interfaceClosing:interfaceEntryAt(clock-renderer.detail.start,reducedMotion),detail=$('detail');
 const titleWipe=profile.title,exit=interfaceClosing?(reducedMotion?1:exitAt('song',clock-interfaceClosing.start)):0;
 setTitleGlassWipe(detail.querySelector('.title-glass'),titleWipe);
 for(const element of detail.querySelectorAll('h1,p')){element.style.maskImage='none';element.style.opacity=String(profile.titleInk*(element.tagName==='P'?.95:1));}
 detail.style.maskImage='none';detail.style.opacity=String(1-exit);detail.style.setProperty('--title-opacity',String(titleWipe>0?1:0));
 stage.dataset.titleWipe=titleWipe.toFixed(6);stage.dataset.titleInk=profile.titleInk.toFixed(6);stage.dataset.interfaceElapsed=(clock-(interfaceClosing?.start??renderer.detail.start)).toFixed(6);stage.dataset.titleOpacity=titleWipe>0?'1':'0';
 if(!detailClosing)stage.dataset.detailPhase=renderer.detailProgress===1&&profile.title===1&&profile.titleInk===1?'open':'opening';
}
function finishDetail(){
 const previous=selectedNode;selectedNode=null;detailClosing=false;interfaceClosing=null;$('detail').hidden=true;$('detail').classList.remove('entered','closing');targets.inert=false;targets.removeAttribute('aria-hidden');
 stage.dataset.mode='map';stage.dataset.detailPhase='closed';delete stage.dataset.detailNode;$('back').setAttribute('aria-label','复位地图');$('back').title='复位地图 R';clampCamera();buttons.get(previous?.id)?.focus({preventScroll:true});dirty=true;
}
function zoom(factor,p=[stageWidth/2,stageHeight/2]){
 if(!renderer||boot?.active||selectedNode)return;cancelMotion();const before=unproject(p,camera,renderer.lean);camera.zoom=Math.max(.7,Math.min(4.6,camera.zoom*factor));const after=unproject(p,camera,renderer.lean);camera.x+=before[0]-after[0];camera.y+=before[1]-after[1];clampCamera();dirty=true;
}
function toggleSound(){
 music.toggle();
}
function release(event,cancel=false){
 if(!pointers.has(event.pointerId))return;pointers.delete(event.pointerId);if(input.hasPointerCapture(event.pointerId))input.releasePointerCapture(event.pointerId);if(pointers.size)return;
 const current=gesture;gesture=null;input.classList.remove('dragging');
 if(cancel||current?.pinch){velocity=[0,0];return;}
 if(current?.dragged){if(event.timeStamp-current.last.time>100)velocity=[0,0];return;}
 velocity=[0,0];const node=renderer.hit(point(event),renderer.camera||camera);clickNode(node);
}
input.addEventListener('pointerdown',event=>{
 if(!renderer||boot?.active||selectedNode||(event.pointerType==='mouse'&&event.button!==0))return;cancelMotion();pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});input.setPointerCapture(event.pointerId);
 if(pointers.size===1)gesture={start:{x:event.clientX,y:event.clientY},last:{x:event.clientX,y:event.clientY,time:event.timeStamp},camera:{...camera},dragged:false};
 else{const [a,b]=[...pointers.values()];gesture={pinch:true,dragged:true,distance:Math.hypot(a.x-b.x,a.y-b.y),zoom:camera.zoom,world:unproject(point({clientX:(a.x+b.x)/2,clientY:(a.y+b.y)/2}),camera,renderer.lean)};}
});
input.addEventListener('pointermove',event=>{
 if(!renderer||boot?.active||selectedNode)return;
 if(!pointers.has(event.pointerId)){const node=renderer.hit(point(event),renderer.camera||camera);renderer.hover=node?.id??null;input.classList.toggle('over-node',Boolean(node));dirty=true;return;}
 pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});lastInput=performance.now();
 if(pointers.size>=2){const [a,b]=[...pointers.values()],p=point({clientX:(a.x+b.x)/2,clientY:(a.y+b.y)/2});camera.zoom=Math.max(.7,Math.min(4.6,gesture.zoom*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,gesture.distance)));const actual=unproject(p,camera,renderer.lean);camera.x+=gesture.world[0]-actual[0];camera.y+=gesture.world[1]-actual[1];clampCamera(true);dirty=true;return;}
 if(!gesture||gesture.pinch)return;const dx=event.clientX-gesture.start.x,dy=event.clientY-gesture.start.y;
 if(Math.hypot(dx,dy)>6)gesture.dragged=true;if(!gesture.dragged)return;
 input.classList.add('dragging');renderer.hover=null;const before={...camera},dt=Math.max(1,event.timeStamp-gesture.last.time);
 const start=unproject(point({clientX:gesture.start.x,clientY:gesture.start.y}),gesture.camera,renderer.lean),now=unproject(point(event),gesture.camera,renderer.lean);camera.x=gesture.camera.x+start[0]-now[0];camera.y=gesture.camera.y+start[1]-now[1];clampCamera(true);
 velocity=[velocity[0]*.42+(camera.x-before.x)/dt*.58,velocity[1]*.42+(camera.y-before.y)/dt*.58];gesture.last={x:event.clientX,y:event.clientY,time:event.timeStamp};dirty=true;
});
input.addEventListener('pointerup',e=>release(e));input.addEventListener('pointercancel',e=>release(e,true));input.addEventListener('pointerleave',()=>{if(!gesture&&renderer){renderer.hover=null;input.classList.remove('over-node');dirty=true;}});
input.addEventListener('wheel',event=>{event.preventDefault();zoom(Math.exp(-Math.max(-140,Math.min(140,event.deltaY))*.0013),point(event));},{passive:false});
input.addEventListener('dblclick',event=>{if(renderer&&!renderer.hit(point(event),renderer.camera||camera))reset();});
$('back').addEventListener('click',()=>selectedNode?closeDetail():reset());$('fullscreen').addEventListener('click',()=>{if(!document.fullscreenElement)document.documentElement.requestFullscreen().catch(()=>{});else document.exitFullscreen();});
document.addEventListener('keydown',event=>{
 if($('story-art-viewer').open)return;
 const key=event.key.toLowerCase();if(boot?.active&&key!=='f')return;if(key==='r')reset();else if(key==='escape')selectedNode?closeDetail():reset();else if(key==='m')toggleSound();else if(key==='f')$('fullscreen').click();
 else if(!selectedNode&&['arrowleft','arrowright','arrowup','arrowdown'].includes(key)){event.preventDefault();cancelMotion();camera.x+=key==='arrowleft'?-90/camera.zoom:key==='arrowright'?90/camera.zoom:0;camera.y+=key==='arrowup'?-90/camera.zoom:key==='arrowdown'?90/camera.zoom:0;clampCamera();}
 else if(['+','=','-','_'].includes(key))zoom(key==='-'||key==='_'?1/1.12:1.12);
});
window.addEventListener('resize',resize);window.addEventListener('blur',()=>{pointers.clear();gesture=null;velocity=[0,0];input.classList.remove('dragging');});
document.addEventListener('visibilitychange',()=>{if(document.hidden)velocity=[0,0];});

function frame(now){
 requestAnimationFrame(frame);if(!renderer||document.hidden){lastFrame=now;return;}
 const dt=Math.min(40,now-(lastFrame||now));lastFrame=now;boot?.update(now,resourcesReady);clock=sceneTime(now);
 if(boot){stage.dataset.bootPhase=boot.phase;stage.dataset.bootElapsed=((now-boot.started)/1000).toFixed(6);if(boot.sceneStarted&&renderer.started!==boot.sceneStarted)renderer.started=boot.sceneStarted;if(!boot.active&&stage.dataset.mode==='loading')stage.dataset.mode='map';}
 if(animation){const t=Math.max(0,Math.min(1,(now-animation.start)/animation.duration)),ease=1-Math.pow(1-t,4);for(const key of ['x','y','zoom'])camera[key]=animation.from[key]+(animation.to[key]-animation.from[key])*ease;clampCamera();dirty=true;if(t===1)animation=null;}
 else if(!gesture&&!selectedNode&&panBounds){
  const limits=cameraLimits(panBounds,camera,{width:stageWidth,height:stageHeight},initial);
  for(const [index,key,low,high] of [[0,'x',limits.minX,limits.maxX],[1,'y',limits.minY,limits.maxY]]){
   if(Math.abs(velocity[index])>.0005||camera[key]<low||camera[key]>high){const next=settleAxis(camera[key],velocity[index],low,high,dt,(Math.max(32,Number(scene.navigation?.elasticity)||110))/(scale*camera.zoom));camera[key]=next.value;velocity[index]=next.velocity;dirty=true;}
  }
  stage.dataset.panSpring=JSON.stringify({x:camera.x,y:camera.y,vx:velocity[0],vy:velocity[1]});
 }
 const leanX=reducedMotion?0:Math.max(-.006,Math.min(.006,velocity[0]*.014)),leanY=reducedMotion?0:Math.max(-.004,Math.min(.004,velocity[1]*.009));
 renderer.lean[0]+=(leanX-renderer.lean[0])*(1-Math.exp(-dt/150));renderer.lean[1]+=(leanY-renderer.lean[1])*(1-Math.exp(-dt/150));
 const actual={...camera};
 const transitioning=renderer.detail&&renderer.detailProgress!==renderer.detail.to;
 if(dirty||transitioning||now-lastDraw>=16){
  if(archive.active){const finished=archive.update(clock);renderer.readerMapFade=archive.mapFade;renderer.readerDim=archive.mapFade?0:archive.progress*archive.dim;renderer.readerProgress=0;renderer.readerState={progress:archive.backgroundProgress,elapsed:archive.elapsed,layout:$('reader').dataset.layout,image:archive.artImage,imageDetail:archive.artDetail,imagePlacement:archive.artPlacement,artWipe:archive.artWipeProgress,exit:archive.exit,reducedMotion};stage.dataset.detailProgress=archive.progress.toFixed(3);stage.dataset.detailPhase=$('reader').dataset.phase;if(finished){renderer.readerDim=0;renderer.readerProgress=0;renderer.readerMapFade=null;renderer.readerState=null;renderer.readerCamera=null;for(const key of Object.keys(renderer.canvas.dataset).filter(key=>key.startsWith('reader')))delete renderer.canvas.dataset[key];finishDetail();}}
  renderer.draw(clock,actual,reducedMotion);stage.style.setProperty('--entry-exposure',renderer.canvas.dataset.entryExposure??'1');syncTargets(renderer.camera);lastDraw=now;dirty=false;stage.dataset.frames=String(Number(stage.dataset.frames||0)+1);
  const backOpacity=renderer.loaded?(renderer.entryMode==='white'?1:mapEntryAt(clock,reducedMotion).back):MAP_ENTRY.backBase;stage.style.setProperty('--back-opacity',String(backOpacity));stage.dataset.backOpacity=backOpacity.toFixed(6);
  if(selectedNode){
   if(archive.active)archive.updateGrid(renderer.readerCamera??renderer.camera,renderer.readerState?[0,0]:renderer.lean);
   else{stage.dataset.detailProgress=renderer.detailProgress.toFixed(3);if(detailClosing&&!renderer.detail)finishDetail();else updateInterface();}
  }
  if(renderer.loaded&&!boot?.active&&now-renderer.started>1050)stage.dataset.ready='true';
 }
}
async function start(){
 try{
  const response=await fetch('config.json',{cache:'no-store'});if(!response.ok)throw new Error('地图数据无法读取');const data=await response.json();document.title=`${data.title||'穹顶孤舟'} · 地图演示`;scene=buildScene(data);scene.navigation=data.navigation??{};panBounds=navigationBounds(scene,data.navigation);renderer=new MapRenderer($('map-canvas'),scene);
  boot=new LoadingSequence($('loading'),data.loading,reducedMotion);renderer.entryMode=boot.active?'white':'legacy';renderer.effects=data.effects??{};music.configure(data.audio);
  if(data.view?.node){const focus=scene.nodes.find(node=>node.id===data.view.node);if(focus){initial.x=camera.x=focus.center[0];initial.y=camera.y=focus.center[1];}}
  if(data.view){for(const key of ['x','y','zoom'])if(Number.isFinite(data.view[key]))initial[key]=camera[key]=data.view[key];if(Number.isFinite(data.view.lens))initial.lens=camera.lens=Math.max(-.15,Math.min(.08,data.view.lens));}clampCamera();
  for(const node of scene.nodes){const button=document.createElement('button');button.className='node-target';button.setAttribute('aria-label',node.title+(node.unlocked?'':'，未解锁'));button.dataset.id=node.id;button.dataset.vertices=JSON.stringify(node.axial);button.addEventListener('focus',()=>{renderer.hover=node.id;dirty=true;});button.addEventListener('blur',()=>{renderer.hover=null;dirty=true;});button.addEventListener('click',()=>clickNode(node));targets.append(button);buttons.set(node.id,button);}
  stage.dataset.nodes=scene.nodes.length;stage.dataset.links=scene.links.length;stage.dataset.gridCell=GRID.cell;stage.dataset.lens=OPTICS.lens;stage.dataset.mode=boot.active?'loading':'map';stage.dataset.detailPhase='closed';stage.dataset.routes=JSON.stringify(scene.links.map(l=>l.axial));
  resize();requestAnimationFrame(frame);await Promise.all([renderer.load(),archive.preload(scene.nodes),boot.preload(),...(boot.active?[...$('loading').querySelectorAll('img')].map(image=>image.decode().catch(()=>{throw new Error('加载动画素材无法读取');})):[])]);resourcesReady=true;dirty=true;
 }catch(error){$('loading').hidden=true;$('error').hidden=false;$('error').textContent=error.message;stage.dataset.ready='error';console.error(error);}
}
resize();start();
