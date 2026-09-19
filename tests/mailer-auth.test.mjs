import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
test('mailer rejects the public anonymous key before attempting delivery',async()=>{
 let handler;let sent=0;
 const source=stripTypeScriptTypes(readFileSync(new URL('../supabase/functions/mailer/index.ts',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,''));
 vm.runInNewContext(source,{Response,Request,Date,createClient:()=>({auth:{getUser:async()=>({data:{user:null},error:new Error('not signed in')})}}),sendEmail:async()=>{sent++;},Deno:{env:{get:()=> 'test'},serve:fn=>handler=fn}});
 const result=await handler(new Request('https://example.com',{method:'POST',headers:{authorization:'Bearer anonymous-project-key'},body:JSON.stringify({to:'student@example.com'})}));
 assert.equal(result.status,401);assert.equal(sent,0);
});
