import {DENSE_BLUR,DOWNSAMPLE,UNDERLAY_COMPOSITE} from './dense-blur.js';
import {ARRIVAL_GLOW,nodeArrivalEnergy,glowQuad,segmentUniforms} from './map-arrival.js';
import {easeFade} from './motion-easing.js';
import {MAP_BACKGROUND} from './map-background.js';
import {PROCEDURAL_FIELD,PROCEDURAL_LAYER_BLUR,PROCEDURAL_LAYER_COMPOSITE,PROCEDURAL_READER_ART,PROCEDURAL_DETAIL} from './procedural-shaders.js';
import {DETAIL_OPTICS,IDENTITY_MATRIX,matrixColumns} from './detail-optics.js';
import {VIEW,GRID,OPTICS,cameraLens,cameraSoftness,strokeMesh,inside,unproject} from './map-geometry.js';
import {mapEntryAt,nodeEntryAt,DETAIL_ENTRY,MAP_ENTRY} from './motion-profile.js';
import {songTransitionAt,TRANSITIONS,exitAt} from './transition-curves.js';
import {backgroundParticleAt,foregroundParticleAt,burstParticleAt,repeatParticleField} from './particle-field.js';
import {createNodeArtwork} from './node-artwork.js';
import {GLASS_BANDS,glassBandAt} from './glass-material.js';
import {backdropLayersAt,edgeRevealAt,mapRevealAt} from './transition-effects.js';
import {storyLayoutAt} from './story-layout.js';

const QUAD_VERTEX=`attribute vec2 aPosition; varying vec2 uv; void main(){uv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}`;
const WORLD_VERTEX=`attribute vec2 aPosition,aUv; uniform vec3 uCamera; uniform vec2 uView; varying vec2 vUv; varying vec2 vWorld;
void main(){vec2 p=(aPosition-uCamera.xy)*uCamera.z+uView*.5;gl_Position=vec4(p.x/uView.x*2.-1.,1.-p.y/uView.y*2.,0.,1.);vUv=aUv;vWorld=aPosition;}`;
const NOISE=`float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.52;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.03+vec2(12.7,7.3);a*=.48;}return v;}`;
const BACKGROUND=MAP_BACKGROUND;
const NODE=`precision highp float;varying vec2 vUv,vWorld;uniform sampler2D uTexture,uMapArtwork;uniform vec2 uUvScale,uUvOffset,uArtworkScale,uArtworkOffset;uniform vec3 uFocusGain,uFocusBias,uBandAmplitude;uniform float uBandPhase;uniform float uTime,uOpacity,uReveal,uArrival,uLocked,uDocument,uHasImage,uPulse,uBrightness,uHaze,uFocus,uSeparateArtwork,uPixelScale;
void main(){
 vec2 texUv=.5+(vUv-.5)*uUvScale+uUvOffset;vec4 image=texture2D(uTexture,texUv);
 if(uSeparateArtwork>.5){vec4 illustration=texture2D(uMapArtwork,.5+(vUv-.5)*uArtworkScale+uArtworkOffset);image=mix(illustration,image,smoothstep(.72,.79,vUv.y));}
 float l=dot(image.rgb,vec3(.2126,.7152,.0722));vec3 art=mix(vec3(l),image.rgb,.88);
 art*=uBrightness;art=mix(art,vec3(.10,.17,.21),.07);art+=vec3(0.,.05,.065)*uHaze;art+=vec3(.015,.025,.032)*(1.-vUv.y)*uPulse;
 art=art*mix(vec3(1.),uFocusGain,uFocus)+uFocusBias*uFocus;
 vec3 blank=mix(vec3(.003,.035,.050),vec3(.020,.100,.115),uFocus)+vec3(.012,.022,.030)*pow(1.-vUv.y,4.);
 blank=mix(blank,vec3(.12,.20,.23),uArrival*(1.-clamp(uReveal,0.,1.)));
 float front=-.10+uReveal*1.20;
 float wipe=uReveal>=.999?1.:step(.0001,uReveal)*(1.-smoothstep(front-.10,front+.10,vUv.x+vUv.y*.08));
 vec3 col=mix(blank,art,uHasImage*(1.-uLocked)*mix(1.,wipe,uArrival));
 if(uDocument>.5)col=vec3(.002,.061,.083)+vec3(.012,.036,.045)*pow(1.-vUv.y,3.);
 float glass=exp(-pow((vUv.x+vUv.y*.55-mod(uTime*.10,2.4)+.4)/.035,2.));
 col+=vec3(.06,.10,.12)*glass*(.045+uPulse*.16);
 // Measured inward glass bands use map space, so zoom and pan preserve their phase.
 float angle=(vWorld.y-398.)*6.28318530718/2.23900000;
 float periodPixels=2.23900000*uPixelScale;
 float bands=0.0069785115+(-0.0058109287*cos(angle)+-0.0077692266*sin(angle));
 bands+=(-0.0006795314*cos(angle*2.)+0.0065692987*sin(angle*2.))*(1.-smoothstep(.38,.50,2./max(.1,periodPixels)));
 bands+=(0.0033736349*cos(angle*3.)+-0.0014211912*sin(angle*3.))*(1.-smoothstep(.44,.55,3./max(.1,periodPixels)));
 col+=vec3(max(0.,bands))*uLocked*smoothstep(2.1,3.2,periodPixels);
 float wideBandDistance=mod(vWorld.y-398.-uBandPhase+29.75*.5,29.75)-29.75*.5;
 col+=uBandAmplitude*exp(-.5*pow(wideBandDistance/0.75,2.))*uLocked*(1.-uDocument);
 gl_FragColor=vec4(col*mix(uReveal,1.,uArrival),uOpacity);
}`;
const STROKE=`precision highp float;varying vec2 vUv,vWorld;uniform vec3 uColor,uClipEdges[6];uniform float uTime,uOpacity,uPulse,uRoute,uClipCount,uLockedBorder,uGlow;
void main(){
 float x=vUv.x*(uRoute>.5?1.8:uRoute<-.5?1.:2.),core=exp(-x*x*310.);float a,extra=max(0.,uGlow-1.);
 if(uRoute>.5){
  float flow=pow(max(0.,sin(vUv.y*.0075-uTime*.62)),18.);
  float soft=exp(-x*x*22.)*(.26+extra*.10),wide=exp(-x*x*5.)*.078+exp(-x*x*2.5)*extra*.22;
  a=(core*(.91+extra*.08)+soft+wide)*(uOpacity+flow*.24+uPulse*.5);
 }else if(uRoute<-.5){a=(core+exp(-x*x*27.)*.18)*uOpacity;}
 else{
  // Clockwise polygons: the negative side of the stroke is inside the tile.
  float inner=(1.-smoothstep(-.025,.025,x))*exp(-x*x*3.8)*(.24+uLockedBorder*.22+uPulse*.19);
  float outer=exp(-x*x*12.)*.13;
  float boundary=100000.;for(int i=0;i<6;i++){if(float(i)<uClipCount)boundary=min(boundary,dot(uClipEdges[i].xy,vWorld)+uClipEdges[i].z);}
  float interior=smoothstep(-.45,.25,boundary);
  float outside=1.-interior,spill=exp(-x*x*2.2)*outside*extra*.72;
  a=((core*.94+inner)*interior+outer+spill)*(uOpacity+uPulse*.46);
 }
 gl_FragColor=vec4(uColor*a,a);
}`;
const TILE_COVERAGE='precision highp float;void main(){gl_FragColor=vec4(1.);}';
const PARTICLE_VERTEX=`attribute vec2 aPosition,aUv,aData;uniform vec3 uCamera;uniform vec2 uView;varying vec2 vUv,vData;
void main(){vec2 p=(aPosition-uCamera.xy)*uCamera.z+uView*.5;gl_Position=vec4(p.x/uView.x*2.-1.,1.-p.y/uView.y*2.,0.,1.);vUv=aUv;vData=aData;}`;
const PARTICLE=`precision highp float;varying vec2 vUv,vData;
void main(){
 float type=vData.y;vec2 p=vUv;if(type>2.5)p.y=-p.y;
 float sd=max(abs(p.x)*.8660254-p.y*.5,p.y)-.5;
 float triangle=(1.-smoothstep(-.035,.085,sd))*.72+exp(-abs(sd)*15.)*.13;
 float dust=exp(-dot(p,p)*5.)*.70+exp(-dot(p,p)*22.)*.30;
 float hollow=exp(-abs(sd)*23.)*.52;
 float a=(type<.5 || type>2.5 ? triangle:type<1.5?dust:hollow)*vData.x;
 vec3 color=type<.5 || type>2.5 ? vec3(.66,.79,.82):type<1.5?vec3(.77,.90,.94):vec3(.45,.77,.85);
 gl_FragColor=vec4(color*a,a);
}`;
const BLUR=`precision highp float;varying vec2 uv;uniform sampler2D uTexture;uniform vec2 uDirection;uniform float uExtract;
vec3 sampleAt(vec2 p){vec3 c=texture2D(uTexture,p).rgb;if(uExtract>.5)c=max(c-vec3(.40),vec3(0.))*.94;return c;}
void main(){vec3 c=sampleAt(uv)*.227027;c+=(sampleAt(uv+uDirection*1.384615)+sampleAt(uv-uDirection*1.384615))*.316216;c+=(sampleAt(uv+uDirection*3.230769)+sampleAt(uv-uDirection*3.230769))*.070270;gl_FragColor=vec4(c,1.);}`;
const POST=`precision highp float;varying vec2 uv;uniform sampler2D uScene,uBloom,uSoft,uTileCoverage,uEntryLight,uArrivalBloom;uniform vec2 uResolution,uView,uLean,uLensAxes,uUnderlay;uniform vec3 uCrt;uniform float uTime,uLens,uBloomStrength,uEntryBloomStrength,uGrain,uSoftness,uDetail,uEntry,uReaderDim,uMapFade[16],uEntryExposure,uBackdropCover;
${NOISE}
vec3 opticalSample(vec2 position,float radius){
 vec2 d=radius*1.41421356/uView;
 vec3 center=texture2D(uScene,position).rgb*.25;
 vec3 sides=texture2D(uScene,position+vec2(d.x,0.)).rgb+texture2D(uScene,position-vec2(d.x,0.)).rgb+texture2D(uScene,position+vec2(0.,d.y)).rgb+texture2D(uScene,position-vec2(0.,d.y)).rgb;
 vec3 corners=texture2D(uScene,position+d).rgb+texture2D(uScene,position-d).rgb+texture2D(uScene,position+vec2(d.x,-d.y)).rgb+texture2D(uScene,position+vec2(-d.x,d.y)).rgb;
 return center+sides*.125+corners*.0625;
}
void main(){
 vec2 p=vec2(uv.x,1.-uv.y)*2.-1.;float r2=p.x*p.x*.85+p.y*p.y*.65;
 float lensRadius=dot(p*p,uLensAxes);
 vec2 source=p/(1.+dot(uLean,p)*(1.-uDetail))*(1.+uLens*lensRadius*(1.-uDetail));vec2 coord=vec2(.5+source.x*.5,.5-source.y*.5);
 float softness=smoothstep(.10,1.05,r2)*(1.-uDetail*.87);
 float blurRadius=uSoftness*clamp(softness*(1.285+softness*(-2.057+softness*1.855)),0.,1.);
 vec3 col=opticalSample(coord,blurRadius);
 float underlay=smoothstep(.15,12.,uUnderlay.x);
 if(uUnderlay.y>.5)underlay=smoothstep(.15,1.5,uUnderlay.x);
 col=mix(col,texture2D(uSoft,coord).rgb,underlay);
 vec2 fringe=source*r2*.00055;
 col.r=mix(col.r,mix(opticalSample(coord+fringe,blurRadius).r,texture2D(uSoft,coord+fringe).r,underlay),.5);
 col.b=mix(col.b,mix(opticalSample(coord-fringe,blurRadius).b,texture2D(uSoft,coord-fringe).b,underlay),.5);
 float outside=1.-texture2D(uTileCoverage,coord).r;
 col+=texture2D(uBloom,coord).rgb*uBloomStrength;
 col+=(texture2D(uEntryLight,coord).rgb+texture2D(uArrivalBloom,coord).rgb*uEntryBloomStrength)*outside;
 col*=uEntryExposure;
 float lum=dot(col,vec3(.2126,.7152,.0722));float n=hash(floor(gl_FragCoord.xy)+floor(uTime*30.)*vec2(71.,113.))-.5;
 float lowNoise=noise(gl_FragCoord.xy*.085+vec2(uTime*.023,0.))-.5;
 col+=(n*.78+lowNoise*.22)*uGrain*(.55+lum*.9);
 float vignette=1.-smoothstep(.34,1.62,r2)*mix(.50,.35,uDetail);col*=vignette;
 float horizontalRim=smoothstep(.90,1.06,abs(p.x))*.14;
 float tall=clamp((uView.y/uView.x-943.229/2048.)/(1344./2048.-943.229/2048.),0.,1.);
 float verticalStart=p.y<0.0 ? mix(.90,.970,tall) : mix(.885,.952,tall);
 float verticalRim=smoothstep(verticalStart,1.02,abs(p.y))*(p.y<0.0 ? .86 : .82);
 float rim=mix(max(horizontalRim,verticalRim),smoothstep(.90,1.06,max(abs(p.x),abs(p.y)))*.10,uDetail);
 col=mix(col,vec3(.001,.007,.010),rim);col+=vec3(.002,.010,.017)*smoothstep(.44,1.15,r2)*(1.-uDetail);col*=mix(vec3(.965,.961,.961),vec3(1.016,1.023,1.018),uDetail);
 float row=clamp(((1.-uv.y)*840.-120.)/40.,0.,15.),lower=floor(row),upper=min(15.,lower+1.);float a=1.,b=1.;
 for(int i=0;i<16;i++){if(abs(float(i)-lower)<.1)a=uMapFade[i];if(abs(float(i)-upper)<.1)b=uMapFade[i];}
 float mapFade=mix(a,b,smoothstep(0.,1.,fract(row)));
 // Map coefficients were measured in the final composite. Compensate for
 // the new plane's transmission before drawing it, avoiding a second fade.

 float scanY=(1.-uv.y)*uView.y*1280./uView.x;
 float scanDistance=abs(mod(scanY+uCrt.x*.5,uCrt.x)-uCrt.x*.5);
 col*=1.-exp(-.5*pow(scanDistance/max(.1,uCrt.y),2.))*uCrt.z;
 gl_FragColor=vec4(max(col,0.)*uEntry*(1.-uReaderDim)*mapFade,1.);
}`;

const DETAIL=PROCEDURAL_DETAIL;

function rng(seed){let value=seed;return()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};}
const ART_MATERIALS={'true-home':[.69,1.45],'about-universe':[.98,1.15],evanescent:[.89,1],implexrough:[.99,1],exoplanetary:[.46,1.5],entrance:[.52,1.5]};
const READER_FIELD=PROCEDURAL_FIELD,READER_HERO=PROCEDURAL_READER_ART;
export class MapRenderer{
 constructor(canvas,scene){
  this.canvas=canvas;this.scene=scene;this.view={...VIEW};this.started=performance.now();this.lean=[0,0];this.hover=null;this.pulses=new Map();this.detail=null;this.detailProgress=0;this.bursts=[];this.textures=new Map();
  const gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'high-performance',premultipliedAlpha:false});if(!gl)throw new Error('当前浏览器无法启动 WebGL，请使用 Edge 或 Chrome');this.gl=gl;
  this.programs={arrival:this.program(WORLD_VERTEX,ARRIVAL_GLOW),denseBlur:this.program(QUAD_VERTEX,DENSE_BLUR),downsample:this.program(QUAD_VERTEX,DOWNSAMPLE),underlayComposite:this.program(QUAD_VERTEX,UNDERLAY_COMPOSITE),coverage:this.program(WORLD_VERTEX,TILE_COVERAGE),background:this.program(QUAD_VERTEX,BACKGROUND),reader:this.program(QUAD_VERTEX,READER_FIELD),readerBlur:this.program(QUAD_VERTEX,PROCEDURAL_LAYER_BLUR),readerComposite:this.program(QUAD_VERTEX,PROCEDURAL_LAYER_COMPOSITE),readerHero:this.program(QUAD_VERTEX,READER_HERO),node:this.program(WORLD_VERTEX,NODE),stroke:this.program(WORLD_VERTEX,STROKE),particle:this.program(PARTICLE_VERTEX,PARTICLE),detail:this.program(QUAD_VERTEX,DETAIL),blur:this.program(QUAD_VERTEX,BLUR),post:this.program(QUAD_VERTEX,POST)};
  this.quad=this.buffer(new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]));this.dynamic=gl.createBuffer();
  this.blank=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.blank);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,15,24,255]));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  this.nodeMeshes=new Map();this.edges=new Map();this.fileMeshes=new Map();this.clipPlanes=new Map();
  for(const node of scene.nodes){
   const {left,right,top,bottom}=node.bounds,vertices=[];
   for(let i=1;i<node.polygon.length-1;i++)for(const point of [node.polygon[0],node.polygon[i],node.polygon[i+1]])vertices.push(point[0],point[1],(point[0]-left)/(right-left),(point[1]-top)/(bottom-top));
   this.nodeMeshes.set(node.id,this.buffer(new Float32Array(vertices)));this.edges.set(node.id,this.buffer(strokeMesh(node.polygon,26,true)));
   const planes=new Float32Array(18);for(let i=0;i<node.polygon.length;i++){const a=node.polygon[i],b=node.polygon[(i+1)%node.polygon.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]),nx=-(b[1]-a[1])/length,ny=(b[0]-a[0])/length;planes.set([nx,ny,-nx*a[0]-ny*a[1]],i*3);}this.clipPlanes.set(node.id,planes);
   if(node.document&&node.id!=='document-03'){const [cx,cy]=node.center,p=[[cx-4,cy-7],[cx+2,cy-7],[cx+6,cy-3],[cx+6,cy+7],[cx-4,cy+7],[cx-4,cy-7]],fold=[[cx+2,cy-7],[cx+2,cy-3],[cx+6,cy-3]];this.fileMeshes.set(node.id,this.buffer(new Float32Array([...strokeMesh(p,3),...strokeMesh(fold,3)])));}
  }
  this.linkMeshes=scene.links.map(l=>this.buffer(strokeMesh(l.points,18,false)));
  this.arrivalNodes=new Map(scene.nodes.map(node=>{
   const ports=scene.links.flatMap(link=>link.from===node.id?[link.points[0]]:link.to===node.id?[link.points.at(-1)]:[]).slice(0,8),joins=new Float32Array(16);
   ports.forEach((point,i)=>joins.set(point,i*2));return[node.id,{mesh:this.buffer(glowQuad(node.polygon)),...segmentUniforms(node.polygon,true),joins,joinCount:ports.length}];
  }));
  this.arrivalLinks=scene.links.flatMap(link=>{const parts=[];for(let offset=0;offset<link.points.length-1;offset+=8){const points=link.points.slice(offset,offset+9);parts.push({link,points,mesh:this.buffer(glowQuad(points)),...segmentUniforms(points)});}return parts;});
  const random=rng(917483);this.particles=Array.from({length:270},(_,i)=>{const type=i<205?0:i<254?1:2;return {x:-550+random()*3200,y:-380+random()*1750,size:type===1?.7+random()*1.5:2.3+Math.pow(random(),2)*(type===2?10:7.5),speed:38+random()*64,direction:random()<.5?-1:1,phase:random()*Math.PI*2,depth:i%3,life:3+random()*9,opacity:type===1?.10+random()*.28:.08+random()*.40,type};});
  this.foreground=Array.from({length:224},(_,i)=>{
   const type=i<168?0:i<208?1:2;
   return {x:random()*VIEW.width,y:random()*VIEW.height,size:type===0?5.5+Math.pow(random(),1.5)*11:type===1?.75+random()*1.65:7+random()*11,velocity:[(random()<.5?-1:1)*(28+random()*45),0],phase:random()*Math.PI*2,life:3.6+random()*8.4,opacity:type===0?.26+random()*.43:type===1?.13+random()*.20:.10+random()*.20,type};
  });
  canvas.dataset.renderer='webgl-unified';canvas.dataset.particleMotion='horizontal';canvas.dataset.gridFlow='continuous-edge-field';canvas.dataset.facetFill='flat-cell-color';canvas.dataset.facetLight='advected-evolving-lattice-field';canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;});canvas.addEventListener('webglcontextrestored',()=>location.reload());
 }
 program(vertex,fragment){
  const gl=this.gl,compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));return shader;};
  const p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return {handle:p,uniforms:new Map()};
 }
 uniform(p,name){if(!p.uniforms.has(name))p.uniforms.set(name,this.gl.getUniformLocation(p.handle,name));return p.uniforms.get(name);}
 f(p,name,value){if(!Number.isFinite(value))throw new Error(`画面参数无效：${name}`);this.gl.uniform1f(this.uniform(p,name),value);}
 v2(p,name,x,y){if(![x,y].every(Number.isFinite))throw new Error(`画面参数无效：${name}`);this.gl.uniform2f(this.uniform(p,name),x,y);}
 v3(p,name,x,y,z){if(![x,y,z].every(Number.isFinite))throw new Error(`画面参数无效：${name}`);this.gl.uniform3f(this.uniform(p,name),x,y,z);}
 texture(p,name,texture,unit){const gl=this.gl;gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(this.uniform(p,name),unit);}
 buffer(array){const gl=this.gl,b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,array,gl.STATIC_DRAW);return {buffer:b,count:array.length/4,quadCount:array.length/2};}
 bind(p,mesh,world=true){
  const gl=this.gl;gl.useProgram(p.handle);gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);const a=gl.getAttribLocation(p.handle,'aPosition');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,world?16:8,0);
  if(world){const b=gl.getAttribLocation(p.handle,'aUv');if(b>=0){gl.enableVertexAttribArray(b);gl.vertexAttribPointer(b,2,gl.FLOAT,false,16,8);}this.v3(p,'uCamera',this.camera.x,this.camera.y,this.camera.zoom);this.v2(p,'uView',this.view.width,this.view.height);}
 }
 async load(){
  const paths=[...this.scene.nodes.filter(n=>n.image&&n.unlocked).map(n=>[n.id,n.image]),...new Set(this.scene.nodes.flatMap(n=>(n.pages??[]).flatMap(p=>[p.image,p.imageDetail&&(!p.imageDetail.baseImage||p.imageDetail.baseImage===p.image)?p.imageDetail.image:null]).filter(Boolean)))].map(item=>Array.isArray(item)?item:['archive:'+item,item]);
  await Promise.all(paths.map(([id,path])=>new Promise((resolve,reject)=>{
   const image=new Image();image.onload=()=>{const gl=this.gl,t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
    const pot=(image.width&(image.width-1))===0&&(image.height&(image.height-1))===0;gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,id==='grid'?gl.REPEAT:gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,id==='grid'?gl.REPEAT:gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    if(pot&&id==='grid'){gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);}else gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    this.textures.set(id,{texture:t,width:image.width,height:image.height});resolve();};
   image.onerror=()=>reject(new Error(`地图素材无法读取：${path}`));image.src=path;
  })));
  await Promise.all([document.fonts.load('500 24px "Saira UI"'),document.fonts.load('400 24px "Saira UI"')]);
  let textCards=0;for(const node of this.scene.nodes.filter(n=>n.mapText&&!n.image&&n.unlocked)){
   const image=createNodeArtwork(node),gl=this.gl,t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);this.textures.set(node.id,{texture:t,width:image.width,height:image.height});
   textCards++;
  }
  this.canvas.dataset.textCards=String(textCards);
  this.warmTransitions();this.loaded=true;this.started=performance.now();this.canvas.dataset.textures=String(this.textures.size);
 }
 warmTransitions(){
  // First-use GPU work and the title font finish behind the loading cover.
  // All warm-up rendering targets are offscreen; the normal map draw is unchanged.
  const gl=this.gl,art=this.textures.values().next().value;
  this.drawReaderField({layout:'banner',progress:1,elapsed:.45,exit:0,reducedMotion:false},this.detailFrame);
  if(art){
   let p=this.programs.readerHero;this.renderTarget(this.detailFrame);this.bind(p,this.quad,false);this.texture(p,'uArt',art.texture,0);
   this.v2(p,'uView',this.view.width,this.view.height);this.v2(p,'uImage',art.width,art.height);this.f(p,'uWipe',1);this.f(p,'uExit',0);this.f(p,'uKind',0);this.f(p,'uTime',1.5);this.f(p,'uUpperScale',1);gl.drawArrays(gl.TRIANGLES,0,6);
   p=this.programs.detail;this.renderTarget(this.readerBlurB);this.bind(p,this.quad,false);this.texture(p,'uMapScene',this.detailFrame.texture,0);this.texture(p,'uArt',art.texture,1);
   this.v2(p,'uView',this.view.width,this.view.height);this.v3(p,'uProfile',1,1,0);this.f(p,'uArtFraction',1);this.f(p,'uArtOffset',0);this.f(p,'uExit',0);gl.uniformMatrix3fv(this.uniform(p,'uArtMatrix'),false,new Float32Array(IDENTITY_MATRIX));this.v3(p,'uArtGradeBias',0,0,0);this.v3(p,'uArtGain',1,1,1);this.v3(p,'uArtBias',0,0,0);this.f(p,'uArtVignette',0);gl.drawArrays(gl.TRIANGLES,0,6);
  }
  this.blurTexture(this.mapOpticalFrame.texture,this.underlaySource,this.underlayA,this.underlayB,16);
  gl.finish();gl.disable(gl.BLEND);this.renderTarget(null);
  for(const key of ['backdropLayers','lowerBlurMode','transitionGridCell','transitionExit'])delete this.canvas.dataset[key];
  this.canvas.dataset.transitionPrewarmed='true';
 }
 target(width,height){
  const gl=this.gl,texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);const framebuffer=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('画面缓冲创建失败');return {texture,framebuffer,width,height};
 }
 resize(width,height,viewWidth=VIEW.width,viewHeight=VIEW.height){
  this.view={width:viewWidth,height:viewHeight};
  const gl=this.gl,ratio=Math.min(devicePixelRatio||1,1.5,2200/width),w=Math.max(1,Math.round(width*ratio)),h=Math.max(1,Math.round(height*ratio));this.canvas.width=w;this.canvas.height=h;
  for(const t of [this.mapOpticalFrame,this.underlaySource,this.underlayA,this.underlayB,this.entryLightFrame,this.entrySource,this.entryBlurA,this.entryBlurB,this.coverageFrame,this.frame,this.detailFrame,this.bloomA,this.bloomB,this.softA,this.softB,this.readerLower,this.readerBlurA,this.readerBlurB])if(t){gl.deleteTexture(t.texture);gl.deleteFramebuffer(t.framebuffer);}
  this.mapOpticalFrame=this.target(w,h);this.entryLightFrame=this.target(w,h);
  this.frame=this.target(w,h);this.coverageFrame=this.target(w,h);this.detailFrame=this.target(w,h);this.bloomA=this.target(Math.max(1,Math.round(w/3)),Math.max(1,Math.round(h/3)));this.bloomB=this.target(this.bloomA.width,this.bloomA.height);this.softA=this.target(this.bloomA.width,this.bloomA.height);this.softB=this.target(this.bloomA.width,this.bloomA.height);
  this.underlaySource=this.target(this.bloomA.width,this.bloomA.height);this.underlayA=this.target(this.bloomA.width,this.bloomA.height);this.underlayB=this.target(this.bloomA.width,this.bloomA.height);
  this.entrySource=this.target(this.bloomA.width,this.bloomA.height);this.entryBlurA=this.target(this.bloomA.width,this.bloomA.height);this.entryBlurB=this.target(this.bloomA.width,this.bloomA.height);
  this.readerLower=this.target(w,h);this.readerBlurA=this.target(w,h);this.readerBlurB=this.target(w,h);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
 }
 renderTarget(target){const gl=this.gl;gl.bindFramebuffer(gl.FRAMEBUFFER,target?.framebuffer??null);gl.viewport(0,0,target?.width??this.canvas.width,target?.height??this.canvas.height);}
 hit(point,camera){const position=unproject(point,camera,this.lean);return [...this.scene.nodes].reverse().find(n=>inside(position,n.polygon))??null;}
 pulse(node,time){this.pulses.set(node.id,time);const random=rng(Math.floor(time*1000));for(let i=0;i<20;i++){const direction=random()<.5?-1:1,speed=25+random()*68;this.bursts.push({x:node.center[0],y:node.center[1],vx:direction*speed,time,size:2+random()*3});}}
 select(node,time,reducedMotion=false){this.detail={node,from:this.detailProgress,to:1,start:time,duration:reducedMotion?.001:DETAIL_ENTRY.duration,reducedMotion};this.detailState=songTransitionAt(0,reducedMotion);}
 closeDetail(time,reducedMotion=false){if(this.detail)this.detail={...this.detail,from:this.detailProgress,to:0,start:time,duration:reducedMotion?.001:TRANSITIONS.song.returnDuration,reducedMotion,closeState:{...this.detailState,mapFade:this.detailState.mapFade.slice()}};}
 updateDetail(time){
  if(!this.detail){this.detailProgress=0;this.detailState=null;return;}
  const t=Math.max(0,Math.min(1,(time-this.detail.start)/this.detail.duration)),ease=this.detail.to===0?exitAt('song',time-this.detail.start,this.detail.reducedMotion):easeFade(t);
  this.detailProgress=this.detail.from+(this.detail.to-this.detail.from)*ease;
  if(this.detail.to===0){const saved=this.detail.closeState,fade=1-ease;this.detailState={...saved,background:saved.background,art:saved.art,artWipe:saved.artWipe??saved.art,artVisibility:1,exit:ease,mapFade:Array(16).fill(1)};}
  else{this.detailState=songTransitionAt(time-this.detail.start,this.detail.reducedMotion);const layers=backdropLayersAt('song',time-this.detail.start,this.detail.reducedMotion);this.detailState.background=Math.max(this.detailState.background,layers.cover);const reveal=edgeRevealAt(this.detailState.art);this.detailState.artWipe=reveal.wipe;this.detailState.artVisibility=reveal.visibility;}
  if(t===1&&this.detail.to===0){this.detail=null;this.detailState=null;}
 }
 blurTexture(texture,source,a,b,sigma){
  const gl=this.gl;gl.disable(gl.BLEND);let p=this.programs.downsample;this.renderTarget(source);this.bind(p,this.quad,false);this.texture(p,'uTexture',texture,0);this.v2(p,'uFootprint',1/source.width,1/source.height);gl.drawArrays(gl.TRIANGLES,0,6);
  p=this.programs.denseBlur;this.renderTarget(a);this.bind(p,this.quad,false);this.texture(p,'uTexture',source.texture,0);this.v2(p,'uStep',1/source.width,0);this.f(p,'uSigma',sigma*source.width/1280);gl.drawArrays(gl.TRIANGLES,0,6);
  this.renderTarget(b);this.texture(p,'uTexture',a.texture,0);this.v2(p,'uStep',0,1/source.height);gl.drawArrays(gl.TRIANGLES,0,6);
 }
 drawArrival(time,camera,reducedMotion){
  const gl=this.gl,p=this.programs.arrival;
  if(this.entryMode!=='white'||time>=1.18||reducedMotion){
   if(!this.entryCleared){gl.disable(gl.BLEND);gl.clearColor(0,0,0,1);for(const target of [this.entryLightFrame,this.entrySource,this.entryBlurA,this.entryBlurB]){this.renderTarget(target);gl.clear(gl.COLOR_BUFFER_BIT);}this.entryCleared=true;}
   this.canvas.dataset.entryLightEnergies=JSON.stringify(Object.fromEntries(this.scene.nodes.map(node=>[node.id,0])));return;
  }
  this.entryCleared=false;this.renderTarget(this.entryLightFrame);gl.disable(gl.BLEND);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);
  const energies=new Map(this.scene.nodes.map(node=>[node.id,reducedMotion?0:nodeArrivalEnergy(node,camera,time)]));
  if(time<1.18&&!reducedMotion){
   gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);
   const setup=(mesh,data,kind,e1,e2,ends,planes,joins,joinCount)=>{this.bind(p,mesh);this.texture(p,'uCoverage',this.coverageFrame.texture,0);this.v2(p,'uResolution',this.entryLightFrame.width,this.entryLightFrame.height);gl.uniform4fv(this.uniform(p,'uSegments[0]'),data.packed);this.f(p,'uCount',data.count);this.f(p,'uLength',data.length);this.f(p,'uKind',kind);this.v2(p,'uEnergy',e1,e2);gl.uniform4fv(this.uniform(p,'uEnds'),new Float32Array(ends));this.f(p,'uClipCount',kind===0?data.count:0);gl.uniform3fv(this.uniform(p,'uClipEdges[0]'),planes);gl.uniform2fv(this.uniform(p,'uJoins[0]'),joins);this.f(p,'uJoinCount',joinCount);this.f(p,'uTime',time);this.v3(p,'uColor',.66,.88,.93);gl.drawArrays(gl.TRIANGLES,0,mesh.count);};
   for(const node of this.scene.nodes){const data=this.arrivalNodes.get(node.id),energy=energies.get(node.id)*(node.unlocked?.52:.76);setup(data.mesh,data,0,energy,energy,[...node.center,...node.center],this.clipPlanes.get(node.id),data.joins,data.joinCount);}
   const emptyPlanes=new Float32Array(18),emptyJoins=new Float32Array(16);
   for(const data of this.arrivalLinks){setup(data.mesh,data,1,energies.get(data.link.from)*.45,energies.get(data.link.to)*.45,[...data.points[0],...data.points.at(-1)],emptyPlanes,emptyJoins,0);}
   gl.disable(gl.BLEND);
  }
  this.blurTexture(this.entryLightFrame.texture,this.entrySource,this.entryBlurA,this.entryBlurB,7.5);
  this.canvas.dataset.entryLightEnergies=JSON.stringify(Object.fromEntries(energies));this.canvas.dataset.entryGlowGeometry='polygon-and-route-distance';
 }
 drawMapUnderlay(sigma,target){
  const gl=this.gl;this.blurTexture(this.mapOpticalFrame.texture,this.underlaySource,this.underlayA,this.underlayB,sigma);
  this.renderTarget(target);const p=this.programs.underlayComposite;this.bind(p,this.quad,false);this.texture(p,'uOriginal',this.mapOpticalFrame.texture,0);this.texture(p,'uBlurred',this.underlayB.texture,1);this.f(p,'uMix',Math.min(1,sigma*this.underlaySource.width/1280/.6));gl.drawArrays(gl.TRIANGLES,0,6);
  this.canvas.dataset.underlayBlurMode='completed-map-dense-gaussian';this.canvas.dataset.underlayTapCount='49';
 }
 drawParticles(items){
  const gl=this.gl,p=this.programs.particle,data=new Float32Array(items.length*36);let j=0;
  for(const item of items){const {x,y,size,opacity,type}=item;for(const [u,v] of [[-1,-1],[1,-1],[-1,1],[-1,1],[1,-1],[1,1]]){data[j++]=x+u*size;data[j++]=y+v*size;data[j++]=u;data[j++]=v;data[j++]=opacity;data[j++]=type;}}
  gl.useProgram(p.handle);gl.bindBuffer(gl.ARRAY_BUFFER,this.dynamic);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);
  for(const [name,offset] of [['aPosition',0],['aUv',8],['aData',16]]){const location=gl.getAttribLocation(p.handle,name);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,2,gl.FLOAT,false,24,offset);}
  this.v3(p,'uCamera',this.camera.x,this.camera.y,this.camera.zoom);this.v2(p,'uView',this.view.width,this.view.height);gl.drawArrays(gl.TRIANGLES,0,items.length*6);
 }
 drawReaderField(state,target=null){
  if(!state)return;const gl=this.gl,time=state.elapsed,camera={x:0,y:0,zoom:1,lens:0,viewWidth:this.view.width,viewHeight:this.view.height};
  const layers=backdropLayersAt(state.layout??'song',time,state.reducedMotion);
  const material=this.programs.reader,setMaterial=(plane,exit)=>{this.bind(material,this.quad,false);this.v2(material,'uView',this.view.width,this.view.height);this.v2(material,'uEffect',state.progress,time);this.v3(material,'uLayers',layers.upperScale,layers.lowerScale,layers.lowerBlur);this.f(material,'uExit',exit);this.f(material,'uKind',state.layout==='song'?0:1);this.f(material,'uPlane',plane);};
  // Blur premultiplied RGBA, including coverage; the live map remains underneath.
  gl.disable(gl.BLEND);this.renderTarget(this.readerLower);setMaterial(1,0);gl.drawArrays(gl.TRIANGLES,0,6);
  let lowerTexture=this.readerLower.texture;
  if(layers.lowerBlur>.05){
   this.blurTexture(lowerTexture,this.underlaySource,this.underlayA,this.underlayB,layers.lowerBlur);lowerTexture=this.underlayB.texture;
  }
  // Dissolve both material planes together after their independent blur.
  this.renderTarget(target);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  const composite=this.programs.readerComposite;this.bind(composite,this.quad,false);this.texture(composite,'uTexture',lowerTexture,0);this.f(composite,'uExit',state.exit??0);gl.drawArrays(gl.TRIANGLES,0,6);
  setMaterial(0,state.exit??0);gl.drawArrays(gl.TRIANGLES,0,6);gl.disable(gl.BLEND);
  this.canvas.dataset.backdropLayers=JSON.stringify(layers);this.canvas.dataset.lowerBlurMode='dense-gaussian-premultiplied-rgba';this.canvas.dataset.transitionGridCell='126';this.canvas.dataset.transitionLowerGridCell='126';this.canvas.dataset.transitionLowerGridMode='full-cell-independent-plane';this.canvas.dataset.transitionGridComposition='overlapping-planes';this.canvas.dataset.transitionExit=String(state.exit??0);return camera;
 }
 drawReader(){
  const state=this.readerState;if(!state)return;this.readerCamera=this.drawReaderField(state);const gl=this.gl,art=this.textures.get('archive:'+state.image);
  if(art&&state.artWipe>0){const p=this.programs.readerHero,layers=backdropLayersAt(state.layout,state.elapsed,state.reducedMotion);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);this.bind(p,this.quad,false);this.texture(p,'uArt',art.texture,0);this.v2(p,'uView',this.view.width,this.view.height);this.v2(p,'uImage',art.width,art.height);this.f(p,'uWipe',state.artWipe);this.f(p,'uExit',state.exit??0);this.f(p,'uKind',state.layout==='story'?1:0);this.f(p,'uTime',state.elapsed);this.f(p,'uUpperScale',layers.upperScale);const imageDetail=state.imageDetail,detailTexture=imageDetail?this.textures.get('archive:'+imageDetail.image):null;this.texture(p,'uArtDetail',detailTexture?.texture??art.texture,1);gl.uniform4fv(this.uniform(p,'uDetailRect'),new Float32Array(imageDetail?.rect??[0,0,1,1]));const placement=state.layout==='story'?storyLayoutAt(this.view.height/this.view.width*1280,state.imagePlacement??{x:-350,y:60.06,width:1277,height:1277*art.height/art.width}).art:state.imagePlacement;gl.uniform4fv(this.uniform(p,'uArtPlacement'),new Float32Array(placement?[placement.x,placement.y,placement.width,placement.height]:[0,0,0,0]));this.f(p,'uHasDetail',detailTexture?1:0);this.f(p,'uEmbeddedMaterial',imageDetail?.embeddedMaterial?1:0);this.canvas.dataset.readerDetailImage=detailTexture?imageDetail.image:'';gl.drawArrays(gl.TRIANGLES,0,6);gl.disable(gl.BLEND);this.canvas.dataset.readerMaskScale=layers.upperScale.toFixed(6);}
  this.canvas.dataset.readerProfile=state.layout;this.canvas.dataset.readerOpacity=state.progress.toFixed(6);this.canvas.dataset.readerElapsed=state.elapsed.toFixed(6);
 }
 draw(time,camera,reducedMotion=false){
  if(this.lost||!this.frame)return;const gl=this.gl;this.updateDetail(time);const ambientTime=reducedMotion?0:time+MAP_ENTRY.ambientPhase;
  const entry=this.entryMode==='white'?{opacity:1,back:1,x:0,y:0}:mapEntryAt(this.loaded?time:0,reducedMotion),enter=this.loaded?1:0;
  this.camera={...camera,viewWidth:this.view.width,viewHeight:this.view.height,x:camera.x+entry.x,y:camera.y+entry.y};camera=this.camera;
  this.canvas.dataset.elapsed=time.toFixed(6);this.canvas.dataset.actualCamera=JSON.stringify(this.camera);this.canvas.dataset.lens=(camera.lens??cameraLens(camera.zoom,this.view)).toFixed(9);this.canvas.dataset.opticalSoftness=cameraSoftness(camera.zoom,this.view).toFixed(6);this.canvas.dataset.entryOpacity=(this.loaded?entry.opacity:0).toFixed(6);this.canvas.dataset.referenceTime=(MAP_ENTRY.referenceStart+time).toFixed(6);
  const arrival=this.entryMode==='white'?mapRevealAt(time,reducedMotion):{push:0,glow:1,exposure:1};
  if(this.entryMode==='white')this.canvas.dataset.entryLatticeMotion='stationary';this.canvas.dataset.actualCamera=JSON.stringify(this.camera);this.canvas.dataset.lens=(camera.lens??cameraLens(camera.zoom,this.view)).toFixed(9);
  this.renderTarget(this.frame);gl.disable(gl.BLEND);let p=this.programs.background;this.bind(p,this.quad,false);this.v2(p,'uView',this.view.width,this.view.height);this.v2(p,'uResolution',this.frame.width,this.frame.height);this.v2(p,'uOrigin',GRID.x,GRID.y);this.v3(p,'uCamera',camera.x,camera.y,camera.zoom);this.f(p,'uCell',GRID.cell);this.f(p,'uEntry',enter);this.f(p,'uGlow',arrival.glow);this.f(p,'uTime',ambientTime);
  gl.drawArrays(gl.TRIANGLES,0,6);
  gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);
  const overlay=this.readerState??(this.detailState?{progress:this.detailState.background,elapsed:this.detailState.backgroundElapsed,layout:'song',exit:this.detailState.exit??0}:null),overlayLayers=overlay?backdropLayersAt(overlay.layout,overlay.elapsed,reducedMotion):null;
  const underlaySigma=overlayLayers?overlayLayers.underlayBlur*Math.min(1,overlay.progress/.2)*(1-(overlay.exit??0)):0;
  const mapElements=1-(this.readerProgress??0),glassBand=glassBandAt(time,reducedMotion);this.canvas.dataset.glassBandPhase=glassBand.phase.toFixed(6);
  // Environment triangles are occluded by tiles and connecting lines.
  gl.blendFunc(gl.ONE,gl.ONE);
  const backgroundSprites=this.particles.map(particle=>backgroundParticleAt(particle,ambientTime,enter));
  const sprites=repeatParticleField(backgroundSprites,camera,this.view,[3200,1750]);
  const nearSprites=repeatParticleField(this.foreground.map(particle=>foregroundParticleAt(particle,ambientTime,enter)),camera,this.view);for(const sprite of nearSprites)sprite.size*=Math.pow(Math.max(1,camera.zoom),-.4);sprites.push(...nearSprites);
  this.canvas.dataset.particleSpace='world';this.canvas.dataset.foregroundParticles=String(nearSprites.length);
  this.canvas.dataset.movingParticles=String(sprites.length);this.canvas.dataset.entryTriangles='0';
  this.drawParticles(sprites);
  for(let i=0;i<this.linkMeshes.length;i++){const mesh=this.linkMeshes[i];p=this.programs.stroke;this.bind(p,mesh);this.f(p,'uTime',ambientTime+i*.36);this.f(p,'uOpacity',.94*enter*mapElements);this.f(p,'uPulse',0);this.f(p,'uRoute',1);this.f(p,'uGlow',1);this.v3(p,'uColor',.66,.91,1.);gl.drawArrays(gl.TRIANGLES,0,mesh.count);}
  for(const node of this.scene.nodes){
   const texture=this.textures.get(node.id),artwork=this.textures.get(node.id+':map-art'),mesh=this.nodeMeshes.get(node.id),start=this.pulses.get(node.id),pulse=start===undefined?0:Math.exp(-(time-start)*4.5);
   const reveal=this.entryMode==='white'?1:entry.opacity>1e-6?nodeEntryAt(node,time,reducedMotion)/entry.opacity:0;
   const hover=this.hover===node.id ? .1 : 0;
   gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);p=this.programs.node;this.bind(p,mesh);this.texture(p,'uTexture',texture?.texture??this.blank,0);this.f(p,'uTime',ambientTime);this.f(p,'uOpacity',enter*mapElements);this.f(p,'uHasImage',texture?1:0);this.f(p,'uLocked',node.unlocked?0:1);this.f(p,'uDocument',node.document?1:0);this.f(p,'uPulse',pulse+hover);
   this.f(p,'uReveal',reveal);this.f(p,'uArrival',0);this.texture(p,'uMapArtwork',artwork?.texture??this.blank,1);this.f(p,'uSeparateArtwork',artwork?1:0);this.v2(p,'uArtworkScale',...(node.mapArtwork?.scale??[1,1]));this.v2(p,'uArtworkOffset',...(node.mapArtwork?.offset??[0,0]));
   const material=ART_MATERIALS[node.id]??[.96,0];this.f(p,'uBrightness',material[0]);this.f(p,'uHaze',material[1]);
   this.f(p,'uBandPhase',glassBand.phase);this.v3(p,'uBandAmplitude',...glassBand.amplitude);this.f(p,'uPixelScale',camera.zoom*this.frame.width/this.view.width);this.f(p,'uFocus',Math.max(0,Math.min(1,(camera.zoom-1)/1.8)));this.v3(p,'uFocusGain',...(node.materialFocus?.gain??[1,1,1]));this.v3(p,'uFocusBias',...(node.materialFocus?.bias??[0,0,0]));
   const ratio=(node.bounds.right-node.bounds.left)/(node.bounds.bottom-node.bounds.top),imageRatio=texture?texture.width/texture.height:ratio,crop=node.mapCrop??{};this.v2(p,'uUvScale',Math.min(1,ratio/imageRatio)*(crop.scaleX??1),Math.min(1,imageRatio/ratio)*(crop.scaleY??1));this.v2(p,'uUvOffset',crop.offsetX??0,crop.offsetY??0);gl.drawArrays(gl.TRIANGLES,0,mesh.count);
   gl.blendFunc(gl.ONE,gl.ONE);p=this.programs.stroke;const edge=this.edges.get(node.id);this.bind(p,edge);this.f(p,'uTime',ambientTime);this.f(p,'uOpacity',enter*(this.entryMode==='white'?1:reveal)*mapElements*(node.document ? .55 : node.bakedFrame&&!artwork ? .30 : node.unlocked ? .44 : .92));this.f(p,'uPulse',(pulse+hover)*reveal);this.f(p,'uRoute',0);this.f(p,'uGlow',1);this.f(p,'uLockedBorder',node.unlocked?0:1);this.f(p,'uClipCount',node.polygon.length);gl.uniform3fv(this.uniform(p,'uClipEdges[0]'),this.clipPlanes.get(node.id));this.v3(p,'uColor',...(node.unlocked?[.50,.80,.95]:[.72,.94,1.]));gl.drawArrays(gl.TRIANGLES,0,edge.count);
   if(node.unlocked&&this.fileMeshes.has(node.id)){const icon=this.fileMeshes.get(node.id);this.bind(p,icon);this.f(p,'uOpacity',.9*enter*mapElements);this.f(p,'uPulse',pulse);this.f(p,'uRoute',-1);this.v3(p,'uColor',.84,.97,1.);gl.drawArrays(gl.TRIANGLES,0,icon.count);}
  }
  gl.blendFunc(gl.ONE,gl.ONE);
  const burstSprites=[];
  this.bursts=this.bursts.filter(b=>time-b.time<1.25);if(!reducedMotion)for(const b of this.bursts)burstSprites.push(burstParticleAt(b,time));
  this.drawParticles(burstSprites);gl.disable(gl.BLEND);const source=this.frame;
  gl.disable(gl.BLEND);p=this.programs.blur;this.renderTarget(this.bloomA);this.bind(p,this.quad,false);this.texture(p,'uTexture',source.texture,0);this.v2(p,'uDirection',4.8/this.view.width,0);this.f(p,'uExtract',1);gl.drawArrays(gl.TRIANGLES,0,6);
  this.renderTarget(this.bloomB);this.texture(p,'uTexture',this.bloomA.texture,0);this.v2(p,'uDirection',0,9.6/this.view.height);this.f(p,'uExtract',0);gl.drawArrays(gl.TRIANGLES,0,6);
  this.renderTarget(this.softA);this.texture(p,'uTexture',source.texture,0);this.v2(p,'uDirection',OPTICS.edgeSoftness*5.1/this.view.width,0);this.f(p,'uExtract',0);gl.drawArrays(gl.TRIANGLES,0,6);
  this.renderTarget(this.softB);this.texture(p,'uTexture',this.softA.texture,0);this.v2(p,'uDirection',0,OPTICS.edgeSoftness*4.8/this.view.height);gl.drawArrays(gl.TRIANGLES,0,6);
  if(overlayLayers)this.canvas.dataset.underlayLogicalSigma=underlaySigma.toFixed(6);else delete this.canvas.dataset.underlayLogicalSigma;
  this.renderTarget(this.coverageFrame);gl.disable(gl.BLEND);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);
  if(time<1.18&&!reducedMotion){p=this.programs.coverage;for(const node of this.scene.nodes){const mesh=this.nodeMeshes.get(node.id);this.bind(p,mesh);gl.drawArrays(gl.TRIANGLES,0,mesh.count);}}
  this.drawArrival(time,camera,reducedMotion);
  const showingDetail=this.detail&&this.detailProgress>0;this.renderTarget(overlayLayers?this.mapOpticalFrame:showingDetail?this.detailFrame:null);p=this.programs.post;this.bind(p,this.quad,false);this.texture(p,'uScene',source.texture,0);this.texture(p,'uBloom',this.bloomB.texture,1);this.texture(p,'uSoft',this.softB.texture,2);this.texture(p,'uTileCoverage',this.coverageFrame.texture,3);this.texture(p,'uEntryLight',this.entryLightFrame.texture,4);this.texture(p,'uArrivalBloom',this.entryBlurB.texture,5);this.v2(p,'uView',this.view.width,this.view.height);this.f(p,'uDetail',0);this.v2(p,'uResolution',this.frame.width,this.frame.height);this.v2(p,'uLean',...this.lean);this.v2(p,'uLensAxes',OPTICS.radialX*this.view.width/VIEW.width,OPTICS.radialY);this.f(p,'uTime',ambientTime);this.f(p,'uLens',camera.lens??cameraLens(camera.zoom,this.view));this.f(p,'uBloomStrength',OPTICS.bloom);this.f(p,'uEntryBloomStrength',.78);this.f(p,'uEntryExposure',arrival.exposure);this.v2(p,'uUnderlay',0,0);this.f(p,'uBackdropCover',overlay?.progress??0);const crt=this.effects?.scanlines??{};this.v3(p,'uCrt',Math.max(2,Number(crt.period)||6.265636897639509),Math.max(.1,Number(crt.width)||.35),Math.max(0,Math.min(.2,crt.strength??.075)));this.canvas.dataset.scanlineMode='static';this.canvas.dataset.entryGlow=arrival.glow.toFixed(6);this.canvas.dataset.entryExposure=arrival.exposure.toFixed(6);this.f(p,'uGrain',OPTICS.grain);this.f(p,'uSoftness',cameraSoftness(camera.zoom,this.view));this.f(p,'uEntry',this.loaded?entry.opacity:0);this.f(p,'uReaderDim',this.readerDim??0);gl.uniform1fv(this.uniform(p,'uMapFade[0]'),new Float32Array(this.readerMapFade??this.detailState?.mapFade??Array(16).fill(1)));gl.drawArrays(gl.TRIANGLES,0,6);
  if(overlayLayers)this.drawMapUnderlay(underlaySigma,showingDetail?this.detailFrame:null);else{delete this.canvas.dataset.underlayBlurMode;delete this.canvas.dataset.underlayTapCount;}
  if(showingDetail){
   const art=this.textures.get(this.detail.node.id),profile=this.detailState,illustration=this.detail.node.illustration??{};
   this.drawReaderField({layout:'song',progress:profile.background,elapsed:profile.backgroundElapsed,exit:profile.exit??0,reducedMotion:this.detail.reducedMotion},this.detailFrame);
   this.canvas.dataset.detailBackgroundOpacity=profile.background.toFixed(6);this.canvas.dataset.detailBackgroundProfile=String(illustration.backdropIndex??3);
   const artFraction=art.width/art.height/(this.view.width/this.view.height),logicalBlur=profile.artBlur*this.view.width/1280;let artSoft=art.texture;
   if(profile.artBlur>1){
    p=this.programs.blur;this.renderTarget(this.softA);this.bind(p,this.quad,false);this.texture(p,'uTexture',art.texture,0);this.v2(p,'uDirection',logicalBlur/(1.633*this.view.width*artFraction),0);this.f(p,'uExtract',0);gl.drawArrays(gl.TRIANGLES,0,6);
    this.renderTarget(this.softB);this.texture(p,'uTexture',this.softA.texture,0);this.v2(p,'uDirection',0,logicalBlur/(1.633*this.view.height));gl.drawArrays(gl.TRIANGLES,0,6);artSoft=this.softB.texture;
   }
   const softMix=Math.max(0,Math.min(1,(profile.artBlur-1)/1.5));
   this.renderTarget(null);p=this.programs.detail;this.bind(p,this.quad,false);this.texture(p,'uMapScene',this.detailFrame.texture,0);this.texture(p,'uArt',art.texture,1);this.texture(p,'uMapSoft',this.detailFrame.texture,2);this.texture(p,'uArtSoft',artSoft,3);
   this.f(p,'uExit',profile.exit??0);this.v2(p,'uView',this.view.width,this.view.height);this.v3(p,'uProfile',profile.artVisibility??1,profile.artWipe??profile.art,0);this.canvas.dataset.detailArtWipe=(profile.artWipe??profile.art).toFixed(6);this.f(p,'uArtBlur',Math.min(profile.artBlur,1.5)*this.view.width/1280);this.f(p,'uArtSoftBlend',softMix*softMix*(3-2*softMix));this.canvas.dataset.detailArtOpacity=profile.art.toFixed(6);this.canvas.dataset.detailArtBlur=profile.artBlur.toFixed(6);this.canvas.dataset.detailMapFade=JSON.stringify(profile.mapFade);this.f(p,'uProgress',this.detailProgress);this.f(p,'uTime',ambientTime);
   this.f(p,'uArtFraction',art.width/art.height/(this.view.width/this.view.height));this.f(p,'uArtOffset',illustration.offsetX??0);const grade=illustration.grade===false?null:DETAIL_OPTICS;gl.uniformMatrix3fv(this.uniform(p,'uArtMatrix'),false,new Float32Array(grade?matrixColumns(grade.matrix):IDENTITY_MATRIX));this.v3(p,'uArtGradeBias',...(grade?.bias??[0,0,0]));this.f(p,'uArtVignette',grade?.vignette??0);this.v3(p,'uArtGain',...(illustration.colorGain??[1,1,1]));this.v3(p,'uArtBias',...(illustration.colorBias??[0,0,0]));this.f(p,'uMapOpacity',illustration.mapOpacity??.86);gl.drawArrays(gl.TRIANGLES,0,6);
  }
  if(this.readerState)this.drawReader();
 }
}
