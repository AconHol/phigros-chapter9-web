// Continuous Gaussian, at actual target-texel spacing; no widely separated
// sparse samples and no accumulation from previous frames.
export const DENSE_BLUR=`precision highp float;varying vec2 uv;uniform sampler2D uTexture;uniform vec2 uStep;uniform float uSigma;
void main(){vec4 sum=texture2D(uTexture,uv);float total=1.,sigma=max(.35,uSigma);
for(int i=1;i<=23;i+=2){float x=float(i),a=exp(-.5*x*x/(sigma*sigma)),b=exp(-.5*(x+1.)*(x+1.)/(sigma*sigma)),weight=a+b;
if(weight>0.000001){float offset=x+b/weight;sum+=(texture2D(uTexture,uv+uStep*offset)+texture2D(uTexture,uv-uStep*offset))*weight;total+=2.*weight;}}
gl_FragColor=sum/total;}`;
export const DOWNSAMPLE=`precision highp float;varying vec2 uv;uniform sampler2D uTexture;uniform vec2 uFootprint;
void main(){vec4 sum=vec4(0.);for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++)sum+=texture2D(uTexture,uv+vec2(float(x),float(y))*uFootprint/3.);gl_FragColor=sum/9.;}`;
export const UNDERLAY_COMPOSITE=`precision highp float;varying vec2 uv;uniform sampler2D uOriginal,uBlurred;uniform float uMix;
void main(){gl_FragColor=mix(texture2D(uOriginal,uv),texture2D(uBlurred,uv),uMix);}`;
