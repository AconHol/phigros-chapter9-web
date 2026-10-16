const clamp=value=>Math.max(0,Math.min(1,value));
// Shared 1280px coordinates for the GPU illustration and DOM text. The stable
// recording places the 1277x716 illustration at (-350, 60), not a cover crop.
export function storyLayoutAt(height,placement=null){
 const source=placement??{x:-350,y:60.06,width:1277,height:716};
 const compact=height/1280>.85;
 if(compact){
  const artHeight=Math.min(660,height*.36),artWidth=artHeight*source.width/source.height;
  return{compact,art:{x:(1280-artWidth)/2,y:76,width:artWidth,height:artHeight},text:{left:110,right:110,top:76+artHeight+35,bottom:60,font:30},expand:{left:60,top:76+artHeight-44}};
 }
 const amount=clamp((height-589.518)/(737-589.518)),mix=(a,b)=>a+(b-a)*amount;
 return{compact,art:{x:mix(-218.75,source.x),y:mix(0,source.y),width:mix(1052.14,source.width),height:mix(589.518,source.height)},text:{left:mix(605.44,597),right:64,top:mix(78.75,126),bottom:60,font:mix(18.666667,23.333333)},expand:{left:56,top:height-85}};
}
