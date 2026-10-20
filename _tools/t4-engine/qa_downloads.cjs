const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const modelDirectories={default:'assets/models/vw-t4-engine/r9/',powertrain:'assets/models/vw-t4-powertrain/r13/',vehicle:'assets/models/vw-t4-vehicle/r13/'};

function publishedFile(variant,file){
  const directory=modelDirectories[variant];assert(directory,`Unknown assembly: ${variant}`);
  const publication=JSON.parse(fs.readFileSync(path.join(root,directory,'publication.json'),'utf8'));
  const record=publication.files.find(record=>record.path===directory+file);
  assert(record,`Missing publication hash: ${variant}/${file}`);return record;
}

async function downloadPublished({page,output,assetUrl},variant,id,file){
  const link=page.locator('#t4Engine #'+id),expected=publishedFile(variant,file);
  const panel=page.locator('[data-engine-panel=catalogue]');if(await panel.isVisible())await panel.click();
  const closed=await link.evaluate(element=>{const ids=[];for(let node=element.parentElement;node;node=node.parentElement)if(node.tagName==='DETAILS'&&!node.open)ids.push(node.id);return ids.reverse();});
  for(const id of closed)await page.locator('#'+id+'>summary').click();
  assert.equal(await link.evaluate(element=>element.href),assetUrl(variant,file));
  const pending=page.waitForEvent('download');await link.click();const download=await pending;
  const destination=path.join(output,variant+'-'+path.basename(file));await download.saveAs(destination);
  assert.equal(await download.failure(),null);
  const bytes=fs.readFileSync(destination),sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  assert.equal(bytes.length,expected.bytes,file);assert.equal(sha256,expected.sha256,file);
  return {file,filename:download.suggestedFilename(),bytes:bytes.length,sha256};
}

module.exports={modelDirectories,publishedFile,downloadPublished};
