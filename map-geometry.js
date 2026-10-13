export const VIEW={width:2048,height:943.229};
export const GRID={cell:42.1,height:42.1*Math.sqrt(3)/2,x:1024,y:398};
export const OPTICS={lens:-.073620867,focusLens:-.074400106,tallFocusLens:-.0625,focusZoom:3.08279775,radialX:.96,radialY:1,chromatic:.00055,edgeSoftness:3.25,tallFocusSoftness:2.68,bloom:.54,grain:.015};
export function cameraLens(zoom=1,view=VIEW){const t=Math.max(0,Math.min(1,(zoom-1)/(OPTICS.focusZoom-1))),aspect=Math.max(0,Math.min(1,(view.height/view.width-VIEW.height/VIEW.width)/(1344/2048-VIEW.height/VIEW.width))),focus=OPTICS.focusLens+(OPTICS.tallFocusLens-OPTICS.focusLens)*aspect;return OPTICS.lens+(focus-OPTICS.lens)*t;}
export function cameraSoftness(zoom=1,view=VIEW){const t=Math.max(0,Math.min(1,(zoom-1)/(OPTICS.focusZoom-1))),aspect=Math.max(0,Math.min(1,(view.height/view.width-VIEW.height/VIEW.width)/(1344/2048-VIEW.height/VIEW.width)));return OPTICS.edgeSoftness+(OPTICS.tallFocusSoftness-OPTICS.edgeSoftness)*t*aspect;}
export const lattice=(q,r)=>[GRID.x+GRID.cell*(q+r/2),GRID.y+GRID.height*r];
export function snap(point){const r=Math.round((point[1]-GRID.y)/GRID.height),q=Math.round((point[0]-GRID.x)/GRID.cell-r/2);return [q,r];}
export function sourceAtScreen(point,lens=OPTICS.lens,lean=[0,0],view=VIEW){
  const x=(point[0]/view.width-.5)*2,y=(point[1]/view.height-.5)*2;
  const perspective=1/(1+lean[0]*x+lean[1]*y),r2=x*x*OPTICS.radialX*view.width/VIEW.width+y*y*OPTICS.radialY,k=1+lens*r2;
  return [view.width*(.5+x*perspective*k*.5),view.height*(.5+y*perspective*k*.5)];
}
export function screenAtSource(point,lens=OPTICS.lens,lean=[0,0],view=VIEW){
  let dest=[...point];for(let i=0;i<32;i++){const sample=sourceAtScreen(dest,lens,lean,view);dest=[dest[0]+point[0]-sample[0],dest[1]+point[1]-sample[1]];if(!dest.every(Number.isFinite)||Math.max(Math.abs(dest[0]/view.width-.5),Math.abs(dest[1]/view.height-.5))>1.5)return point.map((v,j)=>[view.width,view.height][j]/2+(v-[view.width,view.height][j]/2)*1.15);}return dest;
}
export function project(point,camera,lean=[0,0]){const view={width:camera.viewWidth||VIEW.width,height:camera.viewHeight||VIEW.height},lens=Number.isFinite(camera.lens)?camera.lens:cameraLens(camera.zoom,view);return screenAtSource([view.width/2+(point[0]-camera.x)*camera.zoom,view.height/2+(point[1]-camera.y)*camera.zoom],lens,lean,view);}
export function unproject(point,camera,lean=[0,0]){const view={width:camera.viewWidth||VIEW.width,height:camera.viewHeight||VIEW.height},lens=Number.isFinite(camera.lens)?camera.lens:cameraLens(camera.zoom,view),source=sourceAtScreen(point,lens,lean,view);return [camera.x+(source[0]-view.width/2)/camera.zoom,camera.y+(source[1]-view.height/2)/camera.zoom];}
export function inside(point,polygon){let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function makeNode(input){
  const desired=sourceAtScreen([input.x,input.y]);let axial;
  if(input.shape==='hexagon'||['story','clue'].includes(input.type)){
    const [q,r]=snap(desired),radius=1;
    axial=[[q,r-radius],[q+radius,r-radius],[q+radius,r],[q,r+radius],[q-radius,r+radius],[q-radius,r]];
  }else{
    const sourceHeight=sourceAtScreen([input.x,input.y+input.height/2])[1]-sourceAtScreen([input.x,input.y-input.height/2])[1];
    const sourceWidth=sourceAtScreen([input.x+input.width/2,input.y])[0]-sourceAtScreen([input.x-input.width/2,input.y])[0];
    const rows=['document','password'].includes(input.type)?1:Math.max(1,Math.round(sourceHeight/GRID.height));
    const columns=['document','password'].includes(input.type)?1:Math.max(2,Math.round(sourceWidth/GRID.cell-rows/2));
    const top=[desired[0]-(columns-rows/2)*GRID.cell/2,desired[1]-rows*GRID.height/2];const [q,r]=snap(top);
    const initialCamera={x:VIEW.width/2,y:VIEW.height/2,zoom:1};let best=Infinity;
    for(let dq=-1;dq<=1;dq++)for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
      const cq=q+dq,cr=r+dr,cols=columns+dc;if(cols<1)continue;
      const candidate=[[cq,cr],[cq+cols,cr],[cq+cols-rows,cr+rows],[cq-rows,cr+rows]];
      const screen=candidate.map(p=>project(lattice(...p),initialCamera)),xs=screen.map(p=>p[0]),ys=screen.map(p=>p[1]);
      const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
      const error=((left+right)/2-input.x)**2+((top+bottom)/2-input.y)**2+.35*(right-left-input.width)**2+.5*(bottom-top-input.height)**2;
      if(error<best){best=error;axial=candidate;}
    }
  }
  const polygon=axial.map(p=>lattice(...p));const xs=polygon.map(p=>p[0]),ys=polygon.map(p=>p[1]);
  const bounds={left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys)};
  const center=[(bounds.left+bounds.right)/2,(bounds.top+bounds.bottom)/2];
  const ports=[];
  for(let i=0;i<axial.length;i++){const a=axial[i],b=axial[(i+1)%axial.length],steps=Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]));for(let s=0;s<steps;s++)ports.push([a[0]+(b[0]-a[0])*s/steps,a[1]+(b[1]-a[1])*s/steps]);}
  return {...input,axial,polygon,bounds,center,ports,document:['document','password'].includes(input.type)};
}
function straight(a,b){const q=b[0]-a[0],r=b[1]-a[1];return q===0||r===0||q+r===0;}
function routeOptions(a,b){
  if(straight(a,b))return [[a,b]];
  return [[a,[b[0],a[1]],b],[a,[a[0],b[1]],b],[a,[a[0]-(b[1]-a[1]),b[1]],b],[a,[b[0],a[1]-(b[0]-a[0])],b]];
}
function routeScore(path){return path.slice(1).reduce((sum,p,i)=>sum+dist(lattice(...path[i]),lattice(...p)),0)+(path.length-2)*90;}
function bestRoute(a,b,via=[]){
  let best=null,score=Infinity;
  for(const start of a.ports)for(const end of b.ports){
    const stops=[start,...via,end],path=[start];
    for(let i=1;i<stops.length;i++){const option=routeOptions(stops[i-1],stops[i]).sort((u,v)=>routeScore(u)-routeScore(v))[0];path.push(...option.slice(1));}
    const cost=routeScore(path)+dist(lattice(...start),a.center)*.03+dist(lattice(...end),b.center)*.03;
    if(cost<score){score=cost;best=path;}
  }
  const cleaned=[];for(const p of best){if(!cleaned.length||p[0]!==cleaned.at(-1)[0]||p[1]!==cleaned.at(-1)[1])cleaned.push(p);}
  for(let i=1;i<cleaned.length-1;){if(straight(cleaned[i-1],cleaned[i+1]))cleaned.splice(i,1);else i++;}
  return {axial:cleaned,points:cleaned.map(p=>lattice(...p))};
}
export function buildScene(config){
  const nodes=config.nodes.map(makeNode),lookup=new Map(nodes.map(n=>[n.id,n]));
  const links=config.links.filter(l=>l.style!=='faint').map(l=>({...l,...bestRoute(lookup.get(l.from),lookup.get(l.to),(l.via||[]).map(p=>snap(sourceAtScreen(p))))}));
  return {nodes,links};
}
export function strokeMesh(points,width,closed=false){
  const data=[];let length=0,steps=closed?points.length:points.length-1;
  for(let i=0;i<steps;i++){
    const a=points[i],b=points[(i+1)%points.length],len=dist(a,b);if(len<.001)continue;const dx=(b[0]-a[0])/len,dy=(b[1]-a[1])/len,n=[-dy*width,dx*width];
    const verts=[[a[0]+n[0],a[1]+n[1],-1,length],[a[0]-n[0],a[1]-n[1],1,length],[b[0]+n[0],b[1]+n[1],-1,length+len],[b[0]-n[0],b[1]-n[1],1,length+len]];
    for(const j of [0,1,2,2,1,3])data.push(...verts[j]);length+=len;
  }
  return new Float32Array(data);
}
