// Shared timing curves: DOM masks, GPU uniforms and overlay fades use the same clock.
export const clamp=value=>Math.max(0,Math.min(1,value));
function bezier(value,x1,y1,x2,y2){
 const x=clamp(value);if(x===0||x===1)return x;
 const point=(t,a,b)=>3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t;
 const slope=(t,a,b)=>3*(1-t)*(1-t)*a+6*(1-t)*t*(b-a)+3*t*t*(1-b);
 let t=x,lo=0,hi=1;
 for(let i=0;i<12;i++){
  const error=point(t,x1,x2)-x;if(Math.abs(error)<1e-7)break;
  if(error>0)hi=t;else lo=t;
  const derivative=slope(t,x1,x2),next=t-error/Math.max(1e-7,derivative);
  t=next>lo&&next<hi?next:(lo+hi)*.5;
 }
 return clamp(point(t,y1,y2));
}
export const easeReveal=value=>bezier(value,.30,.04,.36,1);
export const easeFade=value=>bezier(value,.32,0,.48,1);
export const easeOut=value=>1-(1-clamp(value))**3;
export const timedBezier=(time,delay,duration,x1,x2)=>bezier((time-delay)/duration,x1,0,x2,1);
// Monotone Hermite interpolation: preserve recorded times and values without
// constant-speed segments, corner jolts, overshoot or undershoot.
export function sampleCurve(keys,time,column){
 if(time<=keys[0][0])return keys[0][column];
 if(time>=keys.at(-1)[0])return keys.at(-1)[column];
 const secant=i=>(keys[i+1][column]-keys[i][column])/(keys[i+1][0]-keys[i][0]);
 const tangent=i=>{
  if(i===0||i===keys.length-1)return 0;
  const a=secant(i-1),b=secant(i);if(a*b<=0)return 0;
  const left=keys[i][0]-keys[i-1][0],right=keys[i+1][0]-keys[i][0];
  return 3*(left+right)/((2*right+left)/a+(right+2*left)/b);
 };
 for(let i=1;i<keys.length;i++)if(time<keys[i][0]){
  const a=keys[i-1],b=keys[i],duration=b[0]-a[0],p=(time-a[0])/duration;
  return (2*p**3-3*p*p+1)*a[column]+(p**3-2*p*p+p)*duration*tangent(i-1)
   +(-2*p**3+3*p*p)*b[column]+(p**3-p*p)*duration*tangent(i);
 }
}
