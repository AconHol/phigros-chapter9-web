// Playback is unlocked by a real gesture. A stored mute preference takes
// precedence over autoplay; background tabs pause and resume the same track.
export class BackgroundAudio{
 constructor(audio,button){
  this.audio=audio;this.button=button;this.enabled=false;this.ready=false;this.volume=.23;this.generation=0;this.fadeFrame=0;
  this.storageKey='phigros.chapter9.background-music';
  this.unlock=event=>{if(!this.ready||!this.enabled||document.hidden||event.target?.closest?.('#sound'))return;if(event.type==='keydown'&&['Shift','Control','Alt','Meta','Tab'].includes(event.key))return;if(this.audio.paused)this.play();};
  document.addEventListener('pointerdown',this.unlock,{passive:true});document.addEventListener('keydown',this.unlock);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){this.generation++;cancelAnimationFrame(this.fadeFrame);audio.pause();audio.volume=0;this.update();}else if(this.ready&&this.enabled)this.play();});
  audio.addEventListener('playing',()=>this.update());audio.addEventListener('pause',()=>this.update());
  audio.addEventListener('error',()=>{this.button.dataset.audioState='error';this.button.title='背景音乐暂不可用，点击重试 M';});
  button.addEventListener('click',()=>this.toggle());
 }
 configure(config){
  if(!config?.ambience){this.button.hidden=true;return;}
  this.audio.src=config.ambience;this.audio.loop=true;this.audio.preload='metadata';this.audio.volume=0;
  this.volume=Number.isFinite(config.volume)?Math.max(0,Math.min(1,config.volume)):.23;
  let saved=null;try{saved=localStorage.getItem(this.storageKey);}catch{}
  this.enabled=saved===null?config.autoplay!==false:saved==='on';this.ready=true;this.button.hidden=false;this.update();
 }
 update(){
  const playing=this.enabled&&!this.audio.paused;
  this.button.setAttribute('aria-pressed',String(playing));this.button.setAttribute('aria-label',playing?'关闭背景音乐':'开启背景音乐');
  this.button.dataset.audioState=playing?'playing':this.enabled?'waiting':'muted';this.button.title=playing?'关闭背景音乐 M':'开启背景音乐 M';
 }
 fade(to,duration,done){
  cancelAnimationFrame(this.fadeFrame);const from=this.audio.volume,start=performance.now();
  const tick=now=>{const p=Math.min(1,(now-start)/duration),ease=p*p*(3-2*p);this.audio.volume=Math.max(0,Math.min(1,from+(to-from)*ease));if(p<1)this.fadeFrame=requestAnimationFrame(tick);else done?.();};
  this.fadeFrame=requestAnimationFrame(tick);
 }
 async play(){
  if(!this.ready||!this.enabled||document.hidden)return;
  const request=++this.generation;
  try{await this.audio.play();if(request!==this.generation)return;if(!this.enabled||document.hidden){this.audio.pause();return;}this.fade(this.volume,900);this.update();}
  catch{if(request===this.generation)this.update();}
 }
 toggle(){
  if(!this.ready)return;
  if(this.enabled&&this.audio.paused){this.play();return;}
  this.enabled=!this.enabled;
  try{localStorage.setItem(this.storageKey,this.enabled?'on':'off');}catch{}
  this.generation++;
  if(this.enabled)this.play();else this.fade(0,280,()=>{if(!this.enabled)this.audio.pause();this.update();});
  this.update();
 }
}
