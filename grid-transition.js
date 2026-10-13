import {GRID_TRANSITION as P} from './grid-transition-profile.js';
import {PROCEDURAL_LAYER_BLUR} from './procedural-shaders.js';
const vertex='attribute vec2 position;varying vec2 uv;void main(){uv=(position+1.)*.5;gl_Position=vec4(position,0.,1.);}';
const lattice=`float periodic(float x,float period){return abs(mod(x+period*.5,period)-period*.5);}
vec4 coarseField(vec2 uv,vec2 view,float time){
 vec2 p=vec2(uv.x,1.-uv.y)*view+(vec2(1280.,840.)-view)*.5;
 vec2 n=(p-vec2(640.,420.))/(view*.5);float r=dot(n,n);
 p=vec2(640.,420.)+(p-vec2(640.,420.))*(1.+${P.lens}*r);
 float cell=${P.periodX},height=${P.periodY};vec2 g=p-vec2(${P.origin[0]},${P.origin[1]});
 vec3 sides=vec3(periodic(g.x,cell),periodic(g.y+g.x*${P.slope},height)/${Math.sqrt(1+P.slope*P.slope)},periodic(g.y-g.x*${P.slope},height)/${Math.sqrt(1+P.slope*P.slope)});
 float d=min(sides.x,min(sides.y,sides.z)),far=max(sides.x,max(sides.y,sides.z)),second=sides.x+sides.y+sides.z-d-far;
 float y=1.-uv.y,rise=smoothstep(0.,.50,time),front=1.1-rise*1.25;float reveal=smoothstep(front-.13,front+.13,y);
 float brightFront=1.05-smoothstep(.47,1.17,time)*1.25;float brighten=smoothstep(brightFront-.15,brightFront+.15,y);
 return vec4(d,second,reveal,brighten);
}`;
const fragment=`precision highp float;varying vec2 uv;uniform vec2 view;uniform float time;
${lattice}
void main(){
 vec4 field=coarseField(uv,view,time);float d=field.x,second=field.y,reveal=field.z,brighten=field.w;
 float glowGrowth=smoothstep(.55,1.06,time);
 float core=exp(-.5*pow(d/mix(.8,.9,glowGrowth),2.)),inside=exp(-.5*pow((d-10.5)/mix(.8,1.2,glowGrowth),2.));
 float inward=exp(-d/9.5),broad=exp(-d/mix(26.,80.4,glowGrowth));
 float exposure=1.+mix(4.2,3.82,glowGrowth)*brighten*smoothstep(.48,1.12,time);
 vec3 color=vec3(.011,.046,.059)+vec3(.17,.34,.37)*inward+vec3(.14,.27,.30)*broad*mix(1.,3.7,glowGrowth);
 float innerDiffuse=exp(-max(0.,d-10.5)/20.)*smoothstep(9.,13.,d);
 color+=vec3(.11,.17,.185)*innerDiffuse*(1.-glowGrowth);
 float knotRadius=mix(12.,18.,glowGrowth),knot=exp(-.5*(d*d+second*second)/(knotRadius*knotRadius));
 color+=mix(vec3(.46,.69,.71),vec3(.82,1.,1.),glowGrowth)*core+mix(vec3(.40,.79,.83),vec3(.45,.66,.69),glowGrowth)*inside*(mix(.40,.60,glowGrowth)+brighten*1.1)+vec3(.10,.18,.20)*knot*(1.+brighten*3.5);
 color*=exposure*reveal;
 // Compress highlights while the glow spreads; the final exposure still reaches white.
 color/=1.+.78*glowGrowth*color;
 float white=smoothstep(1.,1.68,time);color=mix(color,vec3(1.),white);
 gl_FragColor=vec4(color,1.);
}`;
const optical=`precision highp float;varying vec2 uv;uniform sampler2D uTexture;uniform vec2 view;uniform float time;
${lattice}
void main(){
 float growth=smoothstep(.55,1.1,time),white=smoothstep(1.,1.68,time);
 vec3 color=texture2D(uTexture,uv).rgb;
 color=pow(max(color,vec3(0.)),vec3(mix(1.,.83,growth)));
 // Diffuse light is blurred independently of the two thin luminous boundaries.
 // Reconstruct their distance field after the RGBA blur so clipping in the
 // intermediate target cannot erase the white peaks of the narrow lines.
 vec4 field=coarseField(uv,view,time);
 float outerLine=exp(-.5*pow(field.x/.65,2.)),innerLine=exp(-.5*pow((field.x-10.5)/.70,2.));
 float sharp=field.z*(1.-growth)*(1.-white);
 color+=vec3(.80,1.,1.)*(outerLine*(.18+.28*field.w)+innerLine*(.035+.145*field.w))*sharp;
 // Before exposure, diffuse ambient light fills the dark triangle interiors.
 // Near-edge tint keeps the thin outline pale rather than saturated blue.
 float early=field.z*(1.-growth)*(1.-white),edgeTint=exp(-.5*pow((field.x-2.)/2.4,2.));
 color+=vec3(.14,.09,.055)*(1.-exp(-field.x/14.))*early;
 color+=vec3(.10*exp(-field.x/3.),-.09*edgeTint,-.13*edgeTint)*early;
 color*=mix(.90,1.,growth);
 // During exposure the dark interval between the two luminous boundaries
 // remains readable against the diffuse light, then disappears into white.
 float interval=exp(-.5*pow((field.x-5.5)/2.4,2.));
 float crease=exp(-.5*pow(field.x/.85,2.));
 // Preserve cyan exposure between the contours: their red attenuation is
 // stronger than green/blue attenuation, not a neutral-grey subtraction.
 color-=(vec3(.115,.039,.042)*crease+vec3(.35,.018,.040)*interval)*growth*field.z*(1.-white);
 float grain=fract(sin(dot(floor(gl_FragCoord.xy)+floor(time*30.),vec2(12.9898,78.233)))*43758.5453)-.5;
 color+=grain*.0025*(1.-white);
 color*=1.-exp(-.5*pow(periodic((1.-uv.y)*view.y,8.5)/.45,2.))*.025*(1.-white);
 gl_FragColor=vec4(color,1.);
}`;
export class GridTransition{
 constructor(canvas){
  this.canvas=canvas;const gl=this.gl=canvas.getContext('webgl',{alpha:false,antialias:false});if(!gl)throw new Error('进入动画无法初始化');
  const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));return shader;};
  const program=source=>{const p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,source));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;};
  this.program=program(fragment);this.blur=program(PROCEDURAL_LAYER_BLUR);this.optical=program(optical);const p=this.program;gl.useProgram(p);
  const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const loc=gl.getAttribLocation(p,'position');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  this.buffer=b;this.time=gl.getUniformLocation(p,'time');this.view=gl.getUniformLocation(p,'view');this.ready=true;
 }
 target(width,height){
  const gl=this.gl,texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  const framebuffer=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
  if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('入场柔化缓冲创建失败');return{texture,framebuffer};
 }
 bind(program,target){
  const gl=this.gl;gl.bindFramebuffer(gl.FRAMEBUFFER,target?.framebuffer??null);gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
  const location=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,2,gl.FLOAT,false,0,0);
 }
 async load(){this.draw(0);this.gl.finish();this.canvas.dataset.prewarmed='true';}
 draw(time){
  const gl=this.gl,w=innerWidth,h=innerHeight,ratio=Math.min(1.5,devicePixelRatio||1),width=Math.round(w*ratio),height=Math.round(h*ratio);
  if(this.canvas.width!==width||this.canvas.height!==height||!this.field){
   this.canvas.width=width;this.canvas.height=height;
   for(const target of [this.field,this.blurA,this.blurB])if(target){gl.deleteTexture(target.texture);gl.deleteFramebuffer(target.framebuffer);}
   this.field=this.target(width,height);this.blurA=this.target(width,height);this.blurB=this.target(width,height);
  }
  const logicalHeight=h/w*1280,grow=Math.max(0,Math.min(1,(time-.40)/.70)),softness=.8+7.2*grow*grow*(3.-2.*grow);
  gl.viewport(0,0,width,height);this.bind(this.program,this.field);gl.uniform2f(this.view,1280,logicalHeight);gl.uniform1f(this.time,time);gl.drawArrays(gl.TRIANGLES,0,6);
  this.bind(this.blur,this.blurA);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.field.texture);gl.uniform1i(gl.getUniformLocation(this.blur,'uTexture'),0);gl.uniform2f(gl.getUniformLocation(this.blur,'uDirection'),softness/(1.633*1280),0);gl.drawArrays(gl.TRIANGLES,0,6);
  this.bind(this.blur,this.blurB);gl.bindTexture(gl.TEXTURE_2D,this.blurA.texture);gl.uniform2f(gl.getUniformLocation(this.blur,'uDirection'),0,softness/(1.633*logicalHeight));gl.drawArrays(gl.TRIANGLES,0,6);
  this.bind(this.optical,null);gl.bindTexture(gl.TEXTURE_2D,this.blurB.texture);gl.uniform1i(gl.getUniformLocation(this.optical,'uTexture'),0);gl.uniform2f(gl.getUniformLocation(this.optical,'view'),1280,logicalHeight);gl.uniform1f(gl.getUniformLocation(this.optical,'time'),time);gl.drawArrays(gl.TRIANGLES,0,6);
  this.canvas.dataset.opticalBlur=softness.toFixed(6);this.canvas.dataset.opticalMode='separable-gaussian';
  this.canvas.dataset.time=time.toFixed(6);this.canvas.dataset.rendering='procedural-distance-field';this.canvas.dataset.pushProgress='0';this.canvas.dataset.latticeMotion='stationary';this.canvas.dataset.latticePeriod=String(P.periodX);this.canvas.dataset.gridView=`1280,${(h/w*1280).toFixed(6)}`;
 }
}
