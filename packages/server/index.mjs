import http from 'node:http';
import crypto from 'node:crypto';
import {safeFile,verify} from '../core/index.mjs';
const safeEqual=(a,b)=>{const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length && crypto.timingSafeEqual(aa,bb);};
export function startServer({file,port=4318,token=process.env.DEPLOYSUTRA_TOKEN,host='127.0.0.1'}){
 if(host!=='127.0.0.1'&&host!=='::1')throw new Error('Only loopback listen addresses supported');
 if(!token||token.length<20)throw new Error('DEPLOYSUTRA_TOKEN must be set to a strong 20+ char bearer token');
 const loaded=safeFile(file);const report=JSON.parse(loaded.text);if(!verify(report))throw new Error('Report checksum invalid');
 if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid port');
 const server=http.createServer((req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'none'");
  const auth=String(req.headers.authorization||'').replace(/^Bearer /,'');
  if(!safeEqual(auth,token)){res.writeHead(401,{'Content-Type':'application/json'});res.end('{"error":"unauthorized"}');return;}
  if(req.method!=='GET'){res.writeHead(405);res.end();return;}
  const route=String(req.url||'').split('?')[0];
  if(route==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,host:'loopback',readOnly:true}));return;}
  if(route==='/report'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(report));return;}
  res.writeHead(404);res.end();
 });
 return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>resolve(server));});
}
