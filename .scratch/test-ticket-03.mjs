import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'file:///C:/Users/Admin/AppData/Roaming/npm/node_modules/@playwright/mcp/node_modules/playwright/index.mjs';

const PORT = 8092;
const root = process.cwd();

// Spin up a test server serving the workspace and a parent wrapper page
const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];

  // Parent simulator page for Owlbear Rodeo iframe
  if (urlPath === '/owlbear-room.html') {
    res.writeHead(200, { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' });
    res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Owlbear Rodeo Virtual Room Simulator</title>
  <style>
    body { background: #1e1e24; color: #fff; font-family: sans-serif; margin: 0; padding: 20px; }
    .vtt-container { display: flex; gap: 20px; }
    .vtt-board { flex: 1; height: 750px; background: #2b2b36; border-radius: 8px; padding: 20px; }
    .vtt-popover { width: 440px; height: 750px; border: 2px solid #555; border-radius: 8px; overflow: hidden; }
    iframe { width: 100%; height: 100%; border: none; }
  </style>
</head>
<body>
  <h1>🦉 Owlbear Rodeo Room (Test Simulator)</h1>
  <div class="vtt-container">
    <div class="vtt-board">
      <h2>Mesa Virtual Castlevania</h2>
      <div id="vttLog">Log de eventos:</div>
    </div>
    <div class="vtt-popover">
      <iframe id="sheetFrame" src="/ficha-castlevania.html"></iframe>
    </div>
  </div>
  <script>
    window.receivedRolls = [];
    window.addEventListener('message', (event) => {
      console.log('[PARENT ROOM RECEIVED EVENT]', event.data);
      if (event.data && event.data.type === 'FRACTAL_CASTLEVANIA_ROLL') {
        window.receivedRolls.push(event.data);
        const log = document.getElementById('vttLog');
        const p = document.createElement('p');
        p.textContent = \`[\${new Date().toLocaleTimeString()}] \${event.data.character} rolou [\${event.data.results.join(', ')}] -> \${event.data.outcome} (Ruptura: \${event.data.hasRupture})\`;
        log.appendChild(p);
      }
    });
  </script>
</body>
</html>`);
    return;
  }

  let filePath = path.join(root, decodeURIComponent(urlPath));
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = path.extname(filePath);
  const mime = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml'
  }[ext] || 'application/octet-stream';

  res.writeHead(200, {
    'Content-Type': mime,
    'Access-Control-Allow-Origin': '*'
  });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, async () => {
  console.log(`Owlbear Test Server listening on http://localhost:${PORT}`);
  try {
    await runE2ETests();
    console.log('✅ ALL TICKET 03 E2E TESTS PASSED!');
    process.exit(0);
  } catch (err) {
    console.error('❌ E2E TEST FAILED:', err);
    process.exit(1);
  } finally {
    server.close();
  }
});

async function runE2ETests() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err));

  console.log('1. Loading Owlbear Rodeo simulation room with embedded sheet iframe...');
  await page.goto(`http://localhost:${PORT}/owlbear-room.html`);
  await page.waitForLoadState('networkidle');

  // Locate the embedded sheet frame
  const frameElement = await page.$('#sheetFrame');
  const sheetFrame = await frameElement.contentFrame();
  if (!sheetFrame) throw new Error('Could not access iframe content frame');

  // Verify auto-detection of iframe and automatic mode-vtt-compact
  console.log('2. Verifying automatic VTT compact mode detection in iframe...');
  await sheetFrame.waitForSelector('body.mode-vtt-compact', { timeout: 4000 });
  const isCompact = await sheetFrame.$eval('body', el => el.classList.contains('mode-vtt-compact'));
  console.log(`body.mode-vtt-compact active: ${isCompact}`);
  if (!isCompact) throw new Error('body.mode-vtt-compact was not activated inside iframe!');

  // Verify responsive layout without horizontal overflow
  console.log('3. Verifying responsive layout without horizontal overflow in 440px popover...');
  const overflowCheck = await sheetFrame.evaluate(() => {
    const docWidth = document.documentElement.clientWidth;
    const scrollWidth = document.documentElement.scrollWidth;
    const bodyScrollWidth = document.body.scrollWidth;
    const bodyClientWidth = document.body.clientWidth;
    return {
      docWidth,
      scrollWidth,
      bodyScrollWidth,
      bodyClientWidth,
      hasOverflow: scrollWidth > docWidth + 2 || bodyScrollWidth > bodyClientWidth + 2
    };
  });
  console.log('Overflow check metrics:', overflowCheck);
  if (overflowCheck.hasOverflow) {
    throw new Error(`Horizontal overflow detected! scrollWidth=${overflowCheck.scrollWidth}, clientWidth=${overflowCheck.docWidth}`);
  }

  // Load preset hero Radu Bărbat
  console.log('4. Selecting preset hero Radu Bărbat...');
  await sheetFrame.selectOption('#presetHeroSelect', 'radu');
  await page.waitForTimeout(300);

  // Configure roll and trigger it
  console.log('5. Triggering 3D roll inside popover...');
  await sheetFrame.click('.btn-dock-pool[data-dice="2"]');
  await page.waitForTimeout(150);

  // Click Roll button (opens confirmation modal)
  await sheetFrame.click('#btnRoll3D');
  await sheetFrame.waitForSelector('#rollConfirmOverlay.show', { timeout: 3000 });

  // Confirm roll in modal
  await sheetFrame.click('#btnExecuteConfirmedRoll');

  // Wait for 3D physics to tumble and settle (approx 3-4s)
  console.log('6. Waiting for physical dice to settle and broadcast message...');
  await page.waitForFunction(() => window.receivedRolls && window.receivedRolls.length > 0, { timeout: 8000 });

  // Inspect the received broadcast in parent room
  const receivedRolls = await page.evaluate(() => window.receivedRolls);
  console.log('Received broadcast payload in parent room:', receivedRolls[0]);

  const payload = receivedRolls[0];
  if (payload.type !== 'FRACTAL_CASTLEVANIA_ROLL') {
    throw new Error(`Unexpected message type: ${payload.type}`);
  }
  if (!payload.character.includes('Radu')) {
    throw new Error(`Expected Radu character name, got ${payload.character}`);
  }
  if (!Array.isArray(payload.results) || payload.results.length !== 2) {
    throw new Error(`Expected results array with 2 dice, got ${JSON.stringify(payload.results)}`);
  }
  if (typeof payload.highest !== 'number' || payload.highest < 1 || payload.highest > 6) {
    throw new Error(`Invalid highest die: ${payload.highest}`);
  }
  if (!['SUCESSO', 'IMPULSO', 'FALHA'].includes(payload.outcome)) {
    throw new Error(`Invalid outcome: ${payload.outcome}`);
  }
  if (typeof payload.hasRupture !== 'boolean') {
    throw new Error(`Invalid hasRupture flag: ${payload.hasRupture}`);
  }
  console.log('✅ Structured broadcast payload strictly conforms to Owlbear Rodeo event contract!');

  // Test peer broadcast reception
  console.log('7. Testing peer broadcast reception (another player rolls)...');
  await page.evaluate(() => {
    const frame = document.getElementById('sheetFrame');
    frame.contentWindow.postMessage({
      type: 'FRACTAL_CASTLEVANIA_ROLL',
      version: '1.0.0',
      character: 'Elena dos Oradores',
      nature: 'humana',
      pool: 2,
      results: [6, 5],
      highest: 6,
      sixes: 1,
      outcome: 'SUCESSO',
      hasRupture: false,
      ruptureApplies: false,
      timestamp: Date.now()
    }, '*');
  });

  await page.waitForTimeout(500);

  // Verify toast inside iframe
  const toastText = await sheetFrame.$eval('#toastMessage', el => el.textContent.trim());
  console.log(`Peer roll notification toast text: "${toastText}"`);
  if (!toastText.includes('Elena') || !toastText.includes('SUCESSO')) {
    throw new Error(`Expected peer roll toast to mention Elena and SUCESSO, got "${toastText}"`);
  }
  console.log('✅ In-sheet peer broadcast reception verified successfully!');

  await browser.close();
}
