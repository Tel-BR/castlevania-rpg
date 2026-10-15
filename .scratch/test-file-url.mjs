import { spawn } from 'node:child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const fileUrl = 'file:///C:/Users/Admin/Vaults/Sync/Castlevania%20RPG/ficha-castlevania.html';

const edge = spawn(edgePath, [
  '--headless=new',
  '--remote-debugging-port=9222',
  '--user-data-dir=C:\\Users\\Admin\\.gemini\\antigravity\\edge_temp_profile',
  '--no-first-run',
  '--no-default-browser-check',
  fileUrl
]);

setTimeout(async () => {
  try {
    const listRes = await fetch('http://localhost:9222/json/list').then(r => r.json());
    const target = listRes.find(t => t.type === 'page');
    if (!target) {
      console.log('No page target found');
      edge.kill();
      return;
    }
    
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ id: 1, method: 'Console.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Runtime.enable' }));
      ws.send(JSON.stringify({ id: 3, method: 'Log.enable' }));
    });
    
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        console.log('[BROWSER CONSOLE]', msg.params.type, msg.params.args.map(a => a.value || a.description));
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        console.log('[BROWSER EXCEPTION]', msg.params.exceptionDetails.text, msg.params.exceptionDetails.exception?.description);
      }
      if (msg.method === 'Log.entryAdded') {
        console.log('[BROWSER LOG]', msg.params.entry.level, msg.params.entry.text);
      }
    });

    setTimeout(() => {
      edge.kill();
      process.exit(0);
    }, 4000);
  } catch (err) {
    console.error('Debug error:', err);
    edge.kill();
    process.exit(1);
  }
}, 1500);
