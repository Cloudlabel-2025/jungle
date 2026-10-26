// This builds sandbox documents; it never evaluates the edited application.
export function labDocument({
  runtime,
  code,
  tests = "",
  css,
  runId,
  runTests = false,
}) {
  const safeScript = (value) => value.replace(/<\/script/gi, "<\\/script");
  const bridge = `const runId=${JSON.stringify(runId)}; const emit=(type,payload)=>parent.postMessage({codewild:true,runId,type,payload},'*');window.addEventListener('error',e=>emit('error',e.message));window.addEventListener('unhandledrejection',e=>emit('error',String(e.reason)));`;
  const harness = runTests
    ? `(async()=>{
  const results=[],queue=[];
  const assert={equal:(a,b)=>{if(!Object.is(a,b))throw Error('Expected '+JSON.stringify(b)+', received '+JSON.stringify(a));},throws:fn=>{let threw=false;try{fn();}catch{threw=true;}if(!threw)throw Error('Expected an exception.');}};
  const {transfer,parseAmount}=module.exports;
  function test(name,fn){if(queue.length>=100)throw Error('A run supports at most 100 tests.');queue.push({name,fn});}
  try{${tests}}catch(e){results.push({name:'Test file execution',ok:false,error:e.message,ms:0});}
  for(const {name,fn} of queue){const start=performance.now();try{await fn();results.push({name:String(name),ok:true,ms:performance.now()-start});}catch(e){results.push({name:String(name),ok:false,error:e.message,ms:performance.now()-start});}}
  emit('tests',results);
 })().catch(e=>emit('error',e.message));`
    : `createRoot(window.document.getElementById('root')).render(React.createElement(module.exports.default));`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none';"><style>${css.replace(/<\/style/gi, "<\\/style")}</style></head><body><div id="root"></div><script>${safeScript(runtime)}</script><script>${safeScript(bridge)}try{const exports={};const module={exports};${safeScript(code)};${safeScript(harness)}}catch(e){emit('error',e.message);window.document.getElementById('root').textContent=e.message;}</script></body></html>`;
}
