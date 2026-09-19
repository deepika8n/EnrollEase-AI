import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const source=stripTypeScriptTypes(readFileSync(new URL('../supabase/functions/ai-copilot/index.ts',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,''));
function harness(signedIn=true){
 let handler; const calls=[];
 vm.runInNewContext(source,{Request,Response,AbortSignal,encodeURIComponent,
  createClient:()=>({auth:{getUser:async()=>({data:{user:signedIn?{id:'staff'}:null},error:signedIn?null:new Error('invalid')})}}),
  fetch:async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'{"answer":"Ready"}'}]}}]}));},
  Deno:{env:{get:key=>({SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'public-key',GEMINI_API_KEY:'server-only-secret'})[key]},serve:fn=>handler=fn}});
 return {calls,run:body=>handler(new Request('https://example.com',{method:'POST',headers:{authorization:'Bearer session-token','Content-Type':'application/json'},body:JSON.stringify(body)}))};
}
test('AI endpoint rejects unauthenticated requests without contacting provider',async()=>{
 const h=harness(false);assert.equal((await h.run({prompt:'hello',system:'reply'})).status,401);assert.equal(h.calls.length,0);
});
test('AI endpoint keeps provider credential on server and returns only generated content',async()=>{
 const h=harness();const response=await h.run({prompt:'hello',system:'reply'});
 assert.equal(response.status,200);assert.equal(h.calls[0].options.headers['x-goog-api-key'],'server-only-secret');
 const body=await response.text();assert.match(body,/Ready/);assert.doesNotMatch(body,/server-only-secret/);
});
test('AI endpoint rejects oversized input before contacting provider',async()=>{
 const h=harness();assert.equal((await h.run({prompt:'x'.repeat(200001),system:'reply'})).status,400);assert.equal(h.calls.length,0);
});
