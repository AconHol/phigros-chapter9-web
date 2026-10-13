export function createNodeArtwork(node){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=444;
 const context=canvas.getContext('2d'),gradient=context.createLinearGradient(0,0,512,444);
 gradient.addColorStop(0,'#132a32');gradient.addColorStop(.55,'#071820');gradient.addColorStop(1,'#1b3943');context.fillStyle=gradient;context.fillRect(0,0,512,444);
 context.strokeStyle='#a4d8e51c';context.lineWidth=1.4;
 for(let y=-32;y<480;y+=64){context.beginPath();context.moveTo(0,y);context.lineTo(512,y);context.stroke();}
 for(let x=-384;x<900;x+=74){context.beginPath();context.moveTo(x,0);context.lineTo(x+256,444);context.moveTo(x,0);context.lineTo(x-256,444);context.stroke();}
 const lines=Array.isArray(node.mapText)?node.mapText:[node.mapText??node.title];context.textAlign='center';context.textBaseline='middle';
 lines.slice(0,3).forEach((line,index)=>{
  const main=index===0;let size=main?94:50;context.font=`${main?500:400} ${size}px "Microsoft YaHei","Saira UI",sans-serif`;
  const measured=context.measureText(String(line)).width;if(measured>390)size*=390/measured;
  context.font=`${main?500:400} ${size}px "Microsoft YaHei","Saira UI",sans-serif`;context.fillStyle=main?'#e9f3f5':'#b5ccd3';context.shadowColor='#91e8ff30';context.shadowBlur=main?5:0;context.fillText(String(line),256,lines.length===1?216:190+index*91);
 });
 context.shadowBlur=0;context.fillStyle='#739eac';context.font='24px "Saira UI",sans-serif';context.fillText(node.artworkCode??node.id.toUpperCase().replace('ARCHIVE-','LOG '),256,367);
 return canvas;
}
