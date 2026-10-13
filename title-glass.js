// A mask in SVG user coordinates: CSS masks on the outer SVG did not
// reliably mask its filtered paths in the native browser rendering.
export function setTitleGlassWipe(svg,progress){
 const p=Math.max(0,Math.min(1,progress)),mask=svg.querySelector('#title-enter-mask');
 const gradient=svg.querySelector('#title-enter-gradient'),layer=svg.querySelector('#title-enter-layer');
 const slope=.30,feather=76.8,extent=1090+slope*180,front=-feather+p*(extent+2*feather);
 const start=(front-feather)/(1+slope*slope),end=(front+feather)/(1+slope*slope);
 for(const [name,value] of [['x1',start],['y1',start*slope],['x2',end],['y2',end*slope]])gradient.setAttribute(name,String(value));
 mask.querySelector('rect').setAttribute('fill',p<=0?'black':p>=1?'white':'url(#title-enter-gradient)');
 layer.setAttribute('mask','url(#title-enter-mask)');svg.style.maskImage='none';
 svg.dataset.front=front.toFixed(6);svg.dataset.progress=p.toFixed(6);svg.dataset.direction='left-to-right';
}
