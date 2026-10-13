import {TRANSITION_GRID as G} from './transition-geometry.js';
// All lattice, haze, seams and masks are calculated per fragment.
// This module samples only complete original illustration textures.
const NOISE=`float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.52;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.03+vec2(12.7,7.3);a*=.48;}return v;}`;
const TRI=`float periodic(float x,float p){return abs(mod(x+p*.5,p)-p*.5);}
vec4 triangle(vec2 p,float cell){float h=cell*.8660254;vec2 b=vec2(p.x/cell-p.y/(2.*h),p.y/h),f=fract(b),id=floor(b);float up=step(1.,f.x+f.y);vec3 weights=mix(vec3(f,1.-f.x-f.y),vec3(1.-f.x,1.-f.y,f.x+f.y-1.),up);return vec4(id,up,min(weights.x,min(weights.y,weights.z))*h);}
float seam(vec2 p,float cell){float h=cell*.8660254;return min(periodic(p.y,h),min(periodic(p.x+p.y*.5773503,cell),periodic(p.x-p.y*.5773503,cell))*.8660254);}
float exitWipe(float y,float progress){return 1.-clamp(progress,0.,1.);}`;
export const PROCEDURAL_FIELD=`precision highp float;varying vec2 uv;uniform vec2 uView,uEffect;uniform vec3 uLayers;uniform float uExit,uKind,uPlane;
${NOISE}${TRI}
vec4 layer(vec2 p,float scale,float lower){
 float height=uView.y/uView.x*1280.,y=p.y/height;
 p=(p-vec2(640.,uView.y/uView.x*640.))/scale+vec2(640.,uView.y/uView.x*640.);
 vec2 origin=mix(vec2(${G.origin[0]},${G.origin[1]}),vec2(${G.lowerOrigin[0]},${G.lowerOrigin[1]}),lower)+vec2(0.,(height-${G.referenceHeight}.)*.5);
 vec4 tile=triangle(p-origin,${G.cell}.),macro=triangle(p-origin,${G.cell*G.artCells}.);
 float seed=hash(macro.xy+macro.z*vec2(7.,3.)),facetSeed=hash(tile.xy+tile.z*vec2(13.,7.)),d=tile.w;
 float latticeDistance=mix(d,seam(p-origin,${G.lowerCell}.),lower);
 float edge=exp(-.5*pow(latticeDistance/.55,2.)),halo=exp(-.5*pow(latticeDistance/2.4,2.));
 float shapeShade=.025+.026*seed;
 vec3 color=vec3(.004,.013,.019)+vec3(.13,.21,.24)*shapeShade;
 float fog=fbm(p*vec2(.009,.021)+vec2(.4,-uEffect.y*.025));
 float bottom=smoothstep(.23,.92,y);
 float band=exp(-pow((y-.860-sin(p.x*.005)*.025)/.16,2.));
 float face=mix(.74,1.,facetSeed*facetSeed);
 float illumination=.22+.78*smoothstep(.10,.75,p.x/1280.);
 float gap=pow(clamp(1.-d/${G.cell*Math.sqrt(3)/6},0.,1.),1.65);
 float lightGain=mix(.14,1.,uKind);
 float materialBlur=clamp(uLayers.z/12.,0.,1.),seamScale=mix(.08,1.,materialBlur);
 color+=lower*lightGain*(vec3(.040,.065,.080)+vec3(.12,.21,.24)*fog*face)*bottom*illumination;
 color+=lower*lightGain*vec3(.50,.74,.80)*band*(.25+.75*fog)*face*illumination;
 color+=lower*lightGain*vec3(.18,.29,.31)*gap*(.30+.70*facetSeed)*bottom*illumination*(.30+.70*band)*seamScale;
 vec3 rimColor=mix(vec3(.055,.085,.095),vec3(.36,.53,.56)*lightGain,lower);
 float seamGain=.24+.76*fog;
 float rim=edge*.12+halo*.07;

 float lowerHalo=exp(-.5*pow(latticeDistance/mix(1.8,6.5,materialBlur),2.));
 rim=mix(rim,(edge*.025+lowerHalo*.075+gap*.018)*seamScale,lower);
 color+=rimColor*seamGain*rim*mix(1.,4.8*illumination*(.22+.78*band),lower);
 // Diffuse blue-grey light, rather than a saturated cyan wireframe.
 float luminance=dot(color,vec3(.2126,.7152,.0722));
 color=mix(vec3(luminance),color,mix(.72,.52,lower));
 color*=mix(vec3(1.),vec3(.95,.93,.80),lower);
 float weight=lower>.5?smoothstep(.18,.84,y)*.40:(1.-smoothstep(mix(.21,.50,uKind),.86,y))*mix(.78,.90,uKind)+.08;
 float tileY=(tile.y+mix(1./3.,2./3.,tile.z))*${G.cell*Math.sqrt(3)/2}+origin.y;
 float rowY=((tileY-height*.5)*scale+height*.5)/height;
 float front=-.08+uEffect.x*1.16;
 float appearance=(1.-smoothstep(front-.06,front+.06,rowY))*smoothstep(0.,.12,uEffect.x);
 // Keep lower parts transparent, including while the lower seams spread.
 float materialAlpha=lower>.5?1.:(.82+.18*smoothstep(.8,3.5,macro.w))*(.58+.42*smoothstep(.25,.70,seed));
 // Independent lower-plane strokes, not subdivisions or inset copies of
 // the upper lattice. They sharpen through the actual RGBA blur pass.
 float fineEdge=exp(-.5*pow(latticeDistance/1.,2.));
 color+=lower*vec3(.105,.12125,.11875)*fineEdge*mix(1.,.55,uKind);
 float alpha=weight*appearance*materialAlpha;
 return vec4(color,alpha);
}
void main(){
 vec2 screen=vec2(uv.x,1.-uv.y)*vec2(1280.,uView.y/uView.x*1280.);float y=1.-uv.y;
 vec4 material=uPlane<.5?layer(screen,uLayers.x,0.):layer(screen,uLayers.y,1.);
 vec2 lens=uv*2.-1.;float radius=lens.x*lens.x*.85+lens.y*lens.y*.65;
 material.rgb*=1.-smoothstep(.35,1.50,radius)*.42;
 material.rgb+=(hash(floor(gl_FragCoord.xy)+floor(uEffect.y*30.))-.5)*.003;
 float alpha=material.a*exitWipe(y,uExit);
 gl_FragColor=vec4(material.rgb*alpha,alpha);
}`;
export const PROCEDURAL_LAYER_BLUR=`precision highp float;varying vec2 uv;uniform sampler2D uTexture;uniform vec2 uDirection;
void main(){vec4 c=texture2D(uTexture,uv)*.227027;
c+=(texture2D(uTexture,uv+uDirection*1.384615)+texture2D(uTexture,uv-uDirection*1.384615))*.316216;
c+=(texture2D(uTexture,uv+uDirection*3.230769)+texture2D(uTexture,uv-uDirection*3.230769))*.070270;
gl_FragColor=c;}`;
export const PROCEDURAL_LAYER_COMPOSITE=`precision highp float;varying vec2 uv;uniform sampler2D uTexture;uniform float uExit;
${TRI}
void main(){gl_FragColor=texture2D(uTexture,uv)*exitWipe(1.-uv.y,uExit);}`;
export const PROCEDURAL_READER_ART=`precision highp float;varying vec2 uv;uniform sampler2D uArt,uArtDetail;uniform vec2 uView,uImage;uniform vec4 uDetailRect,uArtPlacement;uniform float uWipe,uExit,uKind,uTime,uUpperScale,uHasDetail,uEmbeddedMaterial;
${NOISE}${TRI}
vec2 hexCenter(vec2 p,float size){
 // Flat-top hexagons consist of six cells of the shared triangle lattice.
 vec2 axial=vec2(p.x*2./(3.*size),(.5773503*p.y-p.x/3.)/size);vec3 cube=vec3(axial.x,-axial.x-axial.y,axial.y),rounded=floor(cube+.5),error=abs(cube-rounded);
 if(error.x>error.y&&error.x>error.z)rounded.x=-rounded.y-rounded.z;else if(error.y>error.z)rounded.y=-rounded.x-rounded.z;else rounded.z=-rounded.x-rounded.y;
 return vec2(1.5*rounded.x,1.7320508*(rounded.z+rounded.x*.5))*size;
}
void main(){
 vec2 s=vec2(uv.x,1.-uv.y),p=s*vec2(1280.,uView.y/uView.x*1280.);float portrait=step(.85,uView.y/uView.x);
 float expansion=.965+.035*(1.-pow(1.-clamp(uTime/1.22,0.,1.),3.));vec2 center=vec2(640.,180.);vec2 samplePoint=(p-center)/expansion+center;
 float ratio=uImage.x/uImage.y;vec2 imageUv;float mask,reveal;
 float height=uView.y/uView.x*1280.;vec2 origin=vec2(${G.origin[0]},${G.origin[1]})+vec2(0.,(height-${G.referenceHeight}.)*.5);
 vec2 gridCenter=vec2(640.,height*.5),gridPoint=(p-gridCenter)/uUpperScale+gridCenter;
 vec4 tri=triangle(gridPoint-origin,${G.cell}.);float seed=hash(tri.xy+tri.z*vec2(8.,3.));
 if(uKind<.5){
   imageUv=uArtPlacement.z>0.?(samplePoint-uArtPlacement.xy)/uArtPlacement.zw:vec2(samplePoint.x/1280.,samplePoint.y/(1280./ratio));
   // A continuous upper picture with dark lattice seams and a long soft skirt.
   float front=-130.+uWipe*860.;reveal=1.-smoothstep(front-115.,front+115.,p.y+p.x*.065);
   mask=(1.-smoothstep(230.,435.,p.y))*(.90+.10*seed);
 }else{
   float displayHeight=mix(uView.y/uView.x*1280.,1280./ratio,portrait);float displayWidth=displayHeight*ratio;
   imageUv=vec2((samplePoint.x+displayWidth*.16)/displayWidth,samplePoint.y/displayHeight);
   float boundary=mix(650.,1280.,portrait);vec2 hex=hexCenter(gridPoint-origin,${G.cell}.)+origin;float hexSeed=hash(hex);
   float hexX=(hex.x-gridCenter.x)*uUpperScale+gridCenter.x;
   float hexMask=1.-smoothstep(boundary-100.+hexSeed*55.,boundary+70.+hexSeed*55.,hexX);
   // A soft image edge carries faint aligned hex remnants. Quantizing the
   // whole opacity to hex centers made the picture end in large steps.
   float continuousMask=1.-smoothstep(boundary-100.,boundary+70.,p.x);
   float edgeBand=1.-smoothstep(160.,240.,abs(p.x-boundary));
   mask=mix(continuousMask,hexMask,.18*edgeBand);
   mask*=1.-smoothstep(displayHeight*.78,displayHeight*1.02,p.y);
   // Broad continuous front follows the oblique picture edge.
   float front=-155.+uWipe*(boundary+displayHeight*.30+340.);
   reveal=1.-smoothstep(front-115.,front+115.,p.x+p.y*.30);
   // Screen-aligned nested triangles penetrate the art at its right edge.
   vec4 intrusion=triangle(gridPoint-origin,${G.cell}.);
   float intrusionSeed=hash(intrusion.xy+intrusion.z*vec2(13.,7.));
   float edgeZone=smoothstep(boundary-270.,boundary+15.,p.x+p.y*.09);
   float darkFacet=smoothstep(.43,.72,intrusionSeed)*(.34+.30*(1.-smoothstep(.8,5.,intrusion.w)));
   float insetShade=exp(-.5*pow((intrusion.w-7.5)/1.5,2.))*.28;
   mask*=1.-edgeZone*clamp(darkFacet+insetShade,0.,.72);
 }
 reveal=uWipe<=0.?0.:uWipe>=1.?1.:reveal;
 vec4 artwork=texture2D(uArt,clamp(imageUv,vec2(0.),vec2(1.)));vec3 color=artwork.rgb;
 float artLuminance=dot(color,vec3(.2126,.7152,.0722));
 color=mix(vec3(artLuminance),color,mix(.38,.78,step(.5,uKind)))*mix(.96,.90,step(.5,uKind));
 if(uKind<.5)color*=.17+.83*smoothstep(.6,2.3,seam(gridPoint-origin,${G.cell}.));
 vec2 nativeUv=(samplePoint-uDetailRect.xy)/max(uDetailRect.zw,vec2(1.));float nativeEdge=min(min(nativeUv.x*uDetailRect.z,(1.-nativeUv.x)*uDetailRect.z),min(nativeUv.y*uDetailRect.w,(1.-nativeUv.y)*uDetailRect.w));float nativeWeight=uHasDetail*smoothstep(0.,8.,nativeEdge);vec4 nativeArt=texture2D(uArtDetail,clamp(nativeUv,vec2(0.),vec2(1.)));color=mix(color,nativeArt.rgb,nativeWeight);mask=mix(mask,1.,nativeWeight*uEmbeddedMaterial);artwork.a=mix(artwork.a,nativeArt.a,nativeWeight);
 float valid=step(0.,imageUv.x)*step(imageUv.x,1.)*step(0.,imageUv.y)*step(imageUv.y,1.);
 gl_FragColor=vec4(color,mask*reveal*valid*artwork.a*exitWipe(s.y,uExit));
}`;
export const PROCEDURAL_DETAIL=`precision highp float;varying vec2 uv;uniform sampler2D uMapScene,uArt;uniform vec2 uView;uniform vec3 uProfile;uniform float uArtFraction,uArtOffset,uExit,uArtVignette;uniform mat3 uArtMatrix;uniform vec3 uArtGradeBias,uArtGain,uArtBias;
${TRI}
void main(){
 vec2 s=vec2(uv.x,1.-uv.y);vec3 background=texture2D(uMapScene,uv).rgb;
 float width=max(uArtFraction,.01),left=(width<1.?1.-width:(1.-width)*.5)+uArtOffset;vec2 artUv=vec2((s.x-left)/width,s.y);
 vec3 art=texture2D(uArt,clamp(artUv,vec2(0.),vec2(1.))).rgb;art=clamp((uArtMatrix*art+uArtGradeBias)*uArtGain+uArtBias,0.,1.);vec2 optical=s*2.-1.;float radius=optical.x*optical.x*.85+optical.y*optical.y*.65;art*=1.-smoothstep(.34,1.62,radius)*uArtVignette;
 float diagonal=s.x+s.y*uView.y/uView.x*.35;float region=smoothstep(.34,.66,diagonal)*smoothstep(left-.04,left+.04,s.x);
 float front=1.42-uProfile.y*1.42;
 float reveal=uProfile.y<=0.?0.:uProfile.y>=1.?1.:smoothstep(front-.19,front+.19,diagonal);
 float wipe=reveal*exitWipe(s.y,uExit)*uProfile.x;
 gl_FragColor=vec4(mix(background,art,region*wipe),1.);
}`;
