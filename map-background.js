import {FACET_FIELD} from './facet-light.js';
// The resting map material is independent of all detail/reader transitions.
const NOISE=`float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.52;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.03+vec2(12.7,7.3);a*=.48;}return v;}`;

export const MAP_BACKGROUND=`precision highp float;varying vec2 uv;uniform vec2 uView,uResolution,uOrigin;uniform vec3 uCamera;uniform float uTime,uCell,uEntry,uGlow;
${NOISE}
${FACET_FIELD}
float periodic(float x,float p){return abs(mod(x+p*.5,p)-p*.5);}
vec4 triangle(vec2 p,float cell){float h=cell*.8660254;vec2 b=vec2(p.x/cell-p.y/(2.*h),p.y/h),f=fract(b),id=floor(b);float up=step(1.,f.x+f.y);vec3 weights=mix(vec3(f,1.-f.x-f.y),vec3(1.-f.x,1.-f.y,f.x+f.y-1.),up);return vec4(id,up,min(weights.x,min(weights.y,weights.z))*h);}
vec2 facetCenter(vec4 tile,float cell){
 vec2 b=tile.xy+vec2(mix(1./3.,2./3.,tile.z));
 return vec2(cell*(b.x+b.y*.5),cell*.8660254*b.y);
}
float facetLight(vec4 tile,vec2 center,float cell,float fog){
 // One colour per face. Sample the same evolving, downward-moving field at
 // every centroid; do not lock bright faces to random IDs or pulse them.
 return movingFacetLight(center,cell,uTime);
}
// A continuous world-space light field illuminates the existing edges only.
// All axes share the same value at a junction, instead of unrelated row strobes.
float gridFlow(vec2 p){
 float period=uCell*12.,along=dot(p,vec2(-.5,.8660254))-uTime*60.;
 float phase=mod(along+period*.5,period)-period*.5;
 float head=exp(-.5*pow(phase/(uCell*.85),2.));
 float tailPhase=mod(along+uCell*1.4+period*.5,period)-period*.5;
 float tail=exp(-.5*pow(tailPhase/(uCell*2.4),2.));
 return head*.76+tail*.24;
}
// The light changes edge contrast without changing the stroke/halo width.
float lineLight(float d,float pixel,float moving){
 float strength=.36+.25*moving;
 float core=1.-smoothstep(.20,.20+pixel,d);
 return core*strength+exp(-d*.45)*.004;
}
void main(){
 vec2 screen=vec2(uv.x,1.-uv.y)*uView,p=(screen-uView*.5)/uCamera.z+uCamera.xy,g=p-uOrigin;float h=uCell*.8660254;
 vec4 face=triangle(g,uCell);vec2 center=facetCenter(face,uCell),materialPoint=center+uOrigin;
 float cloud=fbm(materialPoint*vec2(.005,.017)+vec2(-uTime*.05,uTime*.018));float strand=fbm(materialPoint*vec2(.009,.052)+vec2(-uTime*.034,cloud));
 float band=exp(-pow((materialPoint.y-650.-sin(materialPoint.x*.003)*58.)/110.,2.));float fog=band*(.25+.8*cloud)*(.35+.65*strand);
 float deep=fbm(materialPoint*.0017);vec3 col=vec3(.011,.046,.062)+vec3(.21,.29,.32)*fog+vec3(.011,.027,.036)*deep;
 // Dark buildings and weathered platforms share the grid's world coordinates.
 float worldY=p.y-180.,skyline=0.,windows=0.;
 for(int i=0;i<3;i++){
  float depth=float(i),width=32.+depth*23.,column=floor((p.x+depth*147.)/width),seed=hash(vec2(column,depth+17.));
  float roof=65.+seed*240.+depth*90.,face=step(roof,worldY)*step(fract((p.x+depth*147.)/width),.78);
  skyline+=face*(.015+depth*.009)*(1.-smoothstep(560.,1000.,p.y));
  vec2 pane=fract(vec2(p.x/7.,worldY/11.));
  windows+=face*step(.78,pane.x)*step(.86,pane.y)*step(.72,hash(floor(vec2(p.x/7.,worldY/11.))))*.022;
 }
 float architectureTexture=fbm(p*vec2(.028,.045));
 col+=vec3(.13,.19,.22)*(skyline+windows)*(1.2+architectureTexture);
 col-=vec3(.006,.016,.018)*skyline;
 col+=vec3(.018,.035,.041)*exp(-pow((p.y-540.-sin(p.x*.004)*43.)/85.,2.))*architectureTexture;
 vec4 big=triangle(g,uCell*2.);
 col+=vec3(.43,.53,.56)*facetLight(face,center,uCell,fog);
 float pixel=max(.20,.52/(uCamera.z*uResolution.x/uView.x));
 float dh=periodic(g.y,h),da=periodic(g.x+g.y*.5773503,uCell)*.8660254,db=periodic(g.x-g.y*.5773503,uCell)*.8660254;
 float moving=gridFlow(g),grid=lineLight(min(dh,min(da,db)),pixel,moving);
 vec3 gridColor=vec3(.51,.665,.72)*mix(1.,1.48,smoothstep(1.,2.8,uCamera.z));
 col+=gridColor*grid;
 col+=vec3(.40,.70,.76)*exp(-min(dh,min(da,db))/5.)*.012*(uGlow-1.)*(.32+.68*exp(-pow((p.x-uCamera.x+48.)/240.,2.)-pow((p.y-uCamera.y-30.)/180.,2.)));
 float inset=exp(-pow((big.w-5.)/2.6,2.))*.025;col+=vec3(.14,.32,.37)*inset;
 gl_FragColor=vec4(col*uEntry,1.);
}`;
