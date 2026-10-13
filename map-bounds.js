import {VIEW,GRID} from './map-geometry.js';
const finite=value=>typeof value==='number'&&Number.isFinite(value);
export function navigationBounds(scene,settings={}){
 const explicit=settings.bounds;
 if(explicit&&['left','top','right','bottom'].every(key=>finite(explicit[key]))&&explicit.right>explicit.left&&explicit.bottom>explicit.top)return{...explicit};
 const padding=finite(settings.padding)?Math.max(0,settings.padding):GRID.cell*2;
 const points=[...scene.nodes.flatMap(node=>node.polygon),...scene.links.flatMap(link=>link.points)];
 // Keep the original starting composition inside the navigable world.
 return{left:Math.min(0,...points.map(p=>p[0]-padding)),top:Math.min(0,...points.map(p=>p[1]-padding)),right:Math.max(VIEW.width,...points.map(p=>p[0]+padding)),bottom:Math.max(VIEW.height,...points.map(p=>p[1]+padding))};
}
export function cameraLimits(bounds,camera,view,anchor={x:VIEW.width/2,y:VIEW.height/2}){
 const halfX=view.width/(2*camera.zoom),halfY=view.height/(2*camera.zoom);
 function axis(low,high,half,preferred){
  if(high-low<=half*2)return[Math.max(low,Math.min(high,preferred)),Math.max(low,Math.min(high,preferred))];
  return[low+half,high-half];
 }
 const [minX,maxX]=axis(bounds.left,bounds.right,halfX,anchor.x),[minY,maxY]=axis(bounds.top,bounds.bottom,halfY,anchor.y);
 return{minX,maxX,minY,maxY};
}

export function resistAxis(value,low,high,extent){
 const boundary=Math.max(low,Math.min(high,value)),distance=value-boundary;
 return boundary+distance*.55/(1+Math.abs(distance)/Math.max(1,extent));
}
export function settleAxis(value,velocity,low,high,dt,extent=80){
 const boundary=Math.max(low,Math.min(high,value));
 if(value===boundary){
  const next=value+velocity*dt,end=Math.max(low,Math.min(high,next)),distance=next-end;
  const resistance=distance===0?1:.55/(1+Math.abs(distance)/Math.max(1,extent))**2;
  return{value:resistAxis(next,low,high,extent),velocity:velocity*Math.exp(-dt/190)*resistance};
 }
 const omega=.015,offset=value-boundary,c=velocity+omega*offset,e=Math.exp(-omega*dt);
 const next=boundary+(offset+c*dt)*e,v=(velocity-omega*c*dt)*e;
 return Math.abs(next-boundary)<.03&&Math.abs(v)<.0005?{value:boundary,velocity:0}:{value:next,velocity:v};
}
