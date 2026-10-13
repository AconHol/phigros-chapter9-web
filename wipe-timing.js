// Keep the measured entry, then allocate extra time by revealed distance.
// The clock is smooth throughout; it does not insert a pause or a speed step.
export function timedReveal(time,delay,duration,x1,x2,settle=0,settlePower=3){
 const elapsed=time-delay;if(elapsed<=0)return 0;if(elapsed>=duration+settle)return 1;
 const distance=u=>u*u*(3-2*u);
 const clock=u=>duration*(3*(1-u)*(1-u)*u*x1+3*(1-u)*u*u*x2+u*u*u)+settle*distance(u)**settlePower;
 let lo=0,hi=1;
 for(let i=0;i<22;i++){const u=(lo+hi)*.5;if(clock(u)<elapsed)lo=u;else hi=u;}
 return distance((lo+hi)*.5);
}
