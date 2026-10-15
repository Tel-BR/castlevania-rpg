import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR:', err));

  console.log('Navigating to http://localhost:8090/ficha-castlevania.html...');
  await page.goto('http://localhost:8090/ficha-castlevania.html');

  // Verify canvas exists
  const canvas = await page.$('#diceCanvas3D');
  console.log('Canvas #diceCanvas3D found:', !!canvas);

  // Check initial button text
  const initialBtnText = await page.$eval('#btnRoll3D', el => el.textContent.trim());
  console.log('Initial button text:', initialBtnText);

  // Click roll button
  console.log('Clicking #btnRoll3D...');
  await page.click('#btnRoll3D');

  // Immediately check rolling text
  const rollingBtnText = await page.$eval('#btnRoll3D', el => el.textContent.trim());
  console.log('Rolling button text:', rollingBtnText);

  // Take screenshot while rolling (in-flight)
  await page.waitForTimeout(600);
  await page.screenshot({ path: '.scratch/roll-inflight.png' });
  console.log('Screenshot taken: roll-inflight.png');

  // Wait for outcome banner to show
  await page.waitForSelector('.roller-outcome-banner.show', { timeout: 10000 });
  const outcomeText = await page.$eval('#rollerOutcomeBanner', el => el.textContent.trim());
  console.log('Outcome text:', outcomeText);

  // Take screenshot after settled
  await page.screenshot({ path: '.scratch/roll-settled.png' });
  console.log('Screenshot taken: roll-settled.png');

  // Check button text returned to idle
  const finalBtnText = await page.$eval('#btnRoll3D', el => el.textContent.trim());
  console.log('Final button text:', finalBtnText);

  // Verify dice state inside FractalRollSystem / diceEngine
  const diceStats = await page.evaluate(() => {
    const engine = window.FractalRollSystem && window.FractalRollSystem.diceEngine;
    if (!engine) return null;
    return engine.dice.map(d => ({
      pos: d.pos,
      settled: d.settled,
      settleValue: d.settleValue
    }));
  });
  console.log('Dice final stats:', JSON.stringify(diceStats, null, 2));

  await browser.close();
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
