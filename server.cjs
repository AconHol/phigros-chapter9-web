'use strict';
// Local-only static server. No packages or internet connection are required.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const root=__dirname,app='phigros-chapter-nine',rootHash=crypto.createHash('sha256').update(root).digest('hex').slice(0,20);
const marker=path.join(root,'.local-preview.json'),noOpen=process.argv.includes('--no-open');
const portOption=process.argv.find(a=>a.startsWith('--port=')),listenPort=portOption?Number(portOption.slice(7)):0;
if(!Number.isInteger(listenPort)||listenPort<0||listenPort>65535)throw new Error('无效的本机端口');
function openBrowser(url){if(noOpen)return;if(process.platform==='win32')spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{windowsHide:true,stdio:'ignore'}).unref();else console.log(url);}
function findExisting(){return new Promise(resolve=>{try{const previous=JSON.parse(fs.readFileSync(marker,'utf8'));if(previous.rootHash!==rootHash||!/^http:\/\/127\.0\.0\.1:\d+$/.test(previous.url))return resolve(null);const request=http.get(previous.url+'/__chapter_alive',res=>{let body='';res.on('data',c=>{body+=c;if(body.length>4096)request.destroy();});res.on('end',()=>{try{const info=JSON.parse(body);resolve(info.app===app&&info.rootHash===rootHash?previous.url:null);}catch{resolve(null);}});});request.setTimeout(700,()=>request.destroy());request.on('error',()=>resolve(null));}catch{resolve(null);}});}
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.mp4':'video/mp4','.m4a':'audio/mp4','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'};
async function start(){
  const previous=await findExisting();if(previous){openBrowser(previous);console.log(JSON.stringify({url:previous,reused:true}));return;}
  const server=http.createServer((req,res)=>{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
    let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch{res.writeHead(400);return res.end();}
    if(pathname==='/__chapter_alive'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify({app,rootHash}));}
    const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root+path.sep)||path.basename(file).startsWith('.')||!types[path.extname(file).toLowerCase()]){res.writeHead(404);return res.end();}
    fs.stat(file,(error,stat)=>{
      if(error||!stat.isFile()){res.writeHead(404);return res.end();}
      const headers={'Content-Type':types[path.extname(file).toLowerCase()],'Accept-Ranges':'bytes','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'};
      let start=0,end=stat.size-1,status=200;
      if(req.headers.range){const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);if(!match||(!match[1]&&!match[2])){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});return res.end();}
        if(!match[1])start=Math.max(0,stat.size-Number(match[2]));else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}
        if(start>end||start>=stat.size||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});return res.end();}
        status=206;headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;
      }
      headers['Content-Length']=end-start+1;res.writeHead(status,headers);if(req.method==='HEAD')return res.end();const stream=fs.createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
    });
  });
  server.listen(listenPort,'127.0.0.1',()=>{const url=`http://127.0.0.1:${server.address().port}`;fs.writeFileSync(marker,JSON.stringify({url,rootHash,pid:process.pid}));console.log(JSON.stringify({url,pid:process.pid}));openBrowser(url);});
  const cleanup=()=>{try{const info=JSON.parse(fs.readFileSync(marker,'utf8'));if(info.pid===process.pid)fs.unlinkSync(marker);}catch{}server.close(()=>process.exit());setTimeout(()=>process.exit(),500).unref();};process.on('SIGINT',cleanup);process.on('SIGTERM',cleanup);
}
start().catch(error=>{console.error(error.message);process.exitCode=1;});
