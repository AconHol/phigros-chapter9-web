import {clamp,sampleCurve} from './motion-easing.js';
const LIGHT=[[0,1],[.24,.94],[.43,.72],[.59,.32],[.73,.08],[.93,0],[1.16,0]];
export function nodeArrivalEnergy(node,focus,time){
 const dx=node.center[0]-focus.x+48,dy=node.center[1]-focus.y-30;
 const field=Math.exp(-dx*dx/(210*210)-dy*dy/(155*155));
 const area=(node.bounds.right-node.bounds.left)*(node.bounds.bottom-node.bounds.top);
 const mass=Math.max(.48,Math.min(1.20,Math.pow(area/(250*110),.22)));
 const delay=-.07*clamp((focus.y-node.center[1])/180);
 const kind=node.document?.48:node.type==='song'?1:.76;
 return 6.5*(.18+1.04*field)*mass*kind*sampleCurve(LIGHT,time-delay,1);
}
export function glowQuad(points,radius=44){
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),l=Math.min(...xs)-radius,r=Math.max(...xs)+radius,t=Math.min(...ys)-radius,b=Math.max(...ys)+radius;
 return new Float32Array([l,t,0,0,r,t,0,0,l,b,0,0,l,b,0,0,r,t,0,0,r,b,0,0]);
}
export function segmentUniforms(points,closed=false){
 const packed=new Float32Array(32),count=closed?points.length:points.length-1;let length=0;
 for(let i=0;i<count;i++){const a=points[i],b=points[(i+1)%points.length];packed.set([...a,...b],i*4);length+=Math.hypot(b[0]-a[0],b[1]-a[1]);}
 return{packed,count,length};
}
export const ARRIVAL_GLOW=`precision highp float;varying vec2 vWorld;uniform sampler2D uCoverage;uniform vec4 uSegments[8],uEnds;uniform vec3 uClipEdges[6],uColor;uniform vec2 uEnergy,uResolution,uJoins[8];uniform float uCount,uClipCount,uKind,uLength,uJoinCount,uTime;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 a=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(a),hash(a+vec2(1.,0.)),f.x),mix(hash(a+vec2(0.,1.)),hash(a+1.),f.x),f.y);}
void main(){
 if(texture2D(uCoverage,gl_FragCoord.xy/uResolution).r>.99){gl_FragColor=vec4(0.);return;}
 float distance=100000.,along=0.,travel=0.;
 for(int i=0;i<8;i++)if(float(i)<uCount){vec2 a=uSegments[i].xy,b=uSegments[i].zw,v=b-a;float segLength=max(.001,length(v)),t=clamp(dot(vWorld-a,v)/(segLength*segLength),0.,1.),d=length(vWorld-a-v*t);if(d<distance){distance=d;along=(travel+t*segLength)/max(1.,uLength);}travel+=segLength;}
 float interior=100000.;for(int i=0;i<6;i++)if(float(i)<uClipCount)interior=min(interior,dot(uClipEdges[i].xy,vWorld)+uClipEdges[i].z);
 float outside=uKind>.5?1.:1.-smoothstep(-.5,.2,interior),join=0.;
 for(int i=0;i<8;i++)if(float(i)<uJoinCount)join=max(join,exp(-.5*dot(vWorld-uJoins[i],vWorld-uJoins[i])/(13.*13.)));
 float energy=mix(uEnergy.x,uEnergy.y,along),cloud=.68+.32*noise(vWorld*vec2(.009,.012)+vec2(uTime*.04,0.));
 float width=(4.8+2.5*sqrt(max(0.,energy)))*(1.+.30*join),halo=exp(-.5*distance*distance/(width*width));
 float cap=uKind>.5?.42+.58*smoothstep(0.,15.,min(length(vWorld-uEnds.xy),length(vWorld-uEnds.zw))):.84+.16*join;
 gl_FragColor=vec4(uColor*halo*energy*cloud*outside*cap,1.);
}`;
