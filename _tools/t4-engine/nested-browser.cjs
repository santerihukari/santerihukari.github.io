const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'../../output/t4-engine/nested-site'),prefix='/nested-test/';
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.glb':'model/gltf-binary','.stl':'model/stl','.step':'application/step','.zip':'application/zip'};
const server=http.createServer(async(request,response)=>{
  try{
    const url=new URL(request.url,'http://127.0.0.1'),pathname=decodeURIComponent(url.pathname);
    if(!['GET','HEAD'].includes(request.method)||!pathname.startsWith(prefix)){response.writeHead(404);response.end();return;}
    const relative=pathname.slice(prefix.length),target=path.resolve(root,relative+(pathname.endsWith('/')?'index.html':''));
    if(target!==root&&!target.startsWith(root+path.sep)){response.writeHead(403);response.end();return;}
    const bytes=await fs.readFile(target);response.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Content-Length':bytes.length,'Cache-Control':'no-store'});
    response.end(request.method==='HEAD'?undefined:bytes);
  }catch{response.writeHead(404);response.end();}
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    process.env.ENGINE_URL=`http://127.0.0.1:${server.address().port}${prefix}tools/t4-engine/`;process.env.QA_LABEL='nested';
    await require('./site-browser.cjs')();
    for(const name of ['qa_cycle.cjs','qa_audio_mix.cjs','qa_audio_issues.cjs','qa_rpm_controls.cjs']){
      await new Promise((resolve,reject)=>{
        const child=spawn(process.execPath,[path.join(__dirname,name)],{stdio:'inherit',env:{...process.env,T4_QA_LABEL:'nested'}});
        child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(name+' exited '+code)));
      });
    }
  }finally{await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
