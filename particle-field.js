import {easeOut} from './motion-easing.js';
import {VIEW} from './map-geometry.js';

export function backgroundParticleAt(particle,time,opacity=1){
 const life=Math.pow(.5+.5*Math.sin(time/particle.life*2+particle.phase),2);
 return {x:particle.x+(particle.direction??1)*particle.speed*time,y:particle.y,size:particle.size,opacity:particle.opacity*life*opacity,type:particle.type};
}

export function foregroundParticleAt(particle,time,opacity=1){
 const phase=time*Math.PI*2/particle.life+particle.phase;
 const speed=particle.velocity?.[0]??(particle.phase<Math.PI?-1:1)*(32+particle.size*.5);
 return {x:particle.x+speed*time,y:particle.y,size:particle.size,opacity:particle.opacity*(.20+.80*Math.pow(.5+.5*Math.sin(phase),1.7))*opacity,type:particle.type};
}

export function burstParticleAt(particle,time){
 const elapsed=time-particle.time,phase=easeOut(elapsed/1.25);
 return {x:particle.x+particle.vx*1.25*phase,y:particle.y,size:particle.size*(1-phase*.375),opacity:(1-phase)*.46,type:0};
}

// Repeat in map space. Changing the camera never changes a particle's anchor.
export function repeatParticleField(items,camera,view,period=[VIEW.width,VIEW.height]){
 const halfWidth=view.width/camera.zoom*.64+120,halfHeight=view.height/camera.zoom*.64+120;
 const left=camera.x-halfWidth,right=camera.x+halfWidth,top=camera.y-halfHeight,bottom=camera.y+halfHeight,visible=[];
 for(const particle of items){
  const x0=Math.ceil((left-particle.x)/period[0]),x1=Math.floor((right-particle.x)/period[0]),y0=Math.ceil((top-particle.y)/period[1]),y1=Math.floor((bottom-particle.y)/period[1]);
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)visible.push({...particle,x:particle.x+x*period[0],y:particle.y+y*period[1]});
 }
 return visible;
}
