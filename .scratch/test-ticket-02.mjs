import { chromium } from 'file:///C:/Users/Admin/AppData/Roaming/npm/node_modules/@playwright/mcp/node_modules/playwright/index.mjs';

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err));
  page.on('response', resp => {
    if (resp.status() >= 400) console.log(`FAILED RESOURCE: ${resp.status()} ${resp.url()}`);
  });

  console.log('1. Loading ficha-castlevania.html...');
  await page.goto('http://localhost:8090/ficha-castlevania.html');
  await page.waitForLoadState('networkidle');

  // Load hero Radu
  console.log('2. Selecting hero Radu (humano, 3 Espírito)...');
  await page.selectOption('#presetHeroSelect', 'radu');
  await page.waitForTimeout(300);

  const initialEssence = await page.$eval('#essenceValDisplay', el => parseInt(el.textContent, 10));
  const initialXP = await page.$eval('#charXPDisplay', el => parseInt(el.textContent, 10));
  console.log(`Initial Essence: ${initialEssence}, Initial XP: ${initialXP}`);

  // Test 1: Sem Fatos block on Determination
  console.log('3. Testing Determination blocking on Sem Fatos (0 facts)...');
  await page.click('.btn-dock-pool[data-dice="0"]');
  await page.waitForTimeout(100);
  const btnTextSemFatos = await page.$eval('#btnRoll3D', el => el.textContent.trim());
  console.log(`Pool with 0 facts button text: ${btnTextSemFatos}`);

  await page.click('#advantageCheckbox');
  await page.waitForTimeout(100);
  const advCheckedOnSemFatos = await page.$eval('#advantageCheckbox', el => el.checked);
  console.log(`Advantage checked after clicking on 0 facts: ${advCheckedOnSemFatos} (Expected: false)`);
  if (advCheckedOnSemFatos !== false) {
    throw new Error('Determination was allowed on 0 facts (Sem Fatos)!');
  }

  // Test 2: Select 2 Fatos and activate Determination
  console.log('4. Selecting 2 Fatos and activating Determination...');
  await page.click('.btn-dock-pool[data-dice="2"]');
  await page.waitForTimeout(100);
  await page.click('#advantageCheckbox');
  await page.waitForTimeout(100);

  const advChecked = await page.$eval('#advantageCheckbox', el => el.checked);
  const btnTextWithDet = await page.$eval('#btnRoll3D', el => el.textContent.trim());
  console.log(`Advantage checked: ${advChecked}, Button text: ${btnTextWithDet} (Expected: 🎲 Rolar 3d6)`);
  if (!advChecked || !btnTextWithDet.includes('3d6')) {
    throw new Error(`Expected 3d6 pool with Determination, got ${btnTextWithDet}`);
  }

  // Test 3: Roll confirmation modal
  console.log('5. Clicking Roll to trigger confirmation modal...');
  await page.click('#btnRoll3D');
  await page.waitForSelector('#rollConfirmOverlay.show', { timeout: 3000 });

  const modalBody = await page.$eval('#rollConfirmBody', el => el.textContent.trim());
  console.log('Modal text:', modalBody);
  if (!modalBody.includes('Determinação') || !modalBody.includes('Espírito')) {
    throw new Error('Modal does not mention Determination/Espírito consumption!');
  }

  // Test 4: Confirm roll and observe physical settlement
  console.log('6. Confirming roll and awaiting 3D settlement...');
  await page.click('#btnExecuteConfirmedRoll');

  await page.waitForSelector('.roller-outcome-banner.show', { timeout: 12000 });
  const outcomeBannerText = await page.$eval('#rollerOutcomeBanner', el => el.textContent.trim());
  console.log('Outcome banner displayed:', outcomeBannerText);

  // Check Essence deduction
  const postRollEssence = await page.$eval('#essenceValDisplay', el => parseInt(el.textContent, 10));
  console.log(`Post-roll Essence: ${postRollEssence} (Expected: ${initialEssence - 1})`);
  if (postRollEssence !== initialEssence - 1) {
    throw new Error(`Expected essence to decrease by 1 from ${initialEssence} to ${initialEssence - 1}, but got ${postRollEssence}`);
  }

  // Check that advantageCheckbox is reset
  const advPostRoll = await page.$eval('#advantageCheckbox', el => el.checked);
  console.log(`Advantage checked post roll: ${advPostRoll} (Expected: false)`);
  if (advPostRoll !== false) {
    throw new Error('Advantage checkbox remained checked after roll!');
  }

  // Test 5: Depleted essence blocks Determination
  console.log('7. Testing depleted essence (0 Essence) blocking Determination...');
  // Force essence to 0 by clicking pip
  await page.evaluate(() => {
    setEssence(0);
  });
  await page.waitForTimeout(100);

  const currentEss0 = await page.$eval('#essenceValDisplay', el => parseInt(el.textContent, 10));
  console.log(`Forced Essence: ${currentEss0}`);

  await page.click('#advantageCheckbox');
  await page.waitForTimeout(100);
  const advCheckedWhenDepleted = await page.$eval('#advantageCheckbox', el => el.checked);
  console.log(`Advantage checked when essence 0: ${advCheckedWhenDepleted} (Expected: false)`);
  if (advCheckedWhenDepleted !== false) {
    throw new Error('Determination was allowed when essence is depleted (0)!');
  }

  // Test 6: Clear dice button cleans up
  console.log('8. Testing Clear button and banner dismissal...');
  await page.click('#btnClearDice');
  await page.waitForTimeout(200);

  const bannerVisible = await page.$eval('#rollerOutcomeBanner', el => el.classList.contains('show'));
  console.log(`Banner visible after clear: ${bannerVisible} (Expected: false)`);
  if (bannerVisible) {
    throw new Error('Banner still visible after clearing dice!');
  }

  // Test 7: Simulated Failure roll grants +1 XP automatically
  console.log('9. Testing Failure roll (+1 XP automatic credit)...');
  const xpBeforeFail = await page.$eval('#charXPDisplay', el => parseInt(el.textContent, 10));
  
  // Inject mock dice roll returning [3, 2] (Failure) via diceEngine.roll
  await page.evaluate(async () => {
    const engine = window.FractalRollSystem.diceEngine;
    const origRoll = engine.roll;
    engine.roll = async () => [3, 2];
    await rollFractalRisk();
    engine.roll = origRoll;
  });

  await page.waitForSelector('.roller-outcome-banner.show', { timeout: 3000 });
  const failBanner = await page.$eval('#rollerOutcomeBanner', el => el.textContent.trim());
  console.log('Failure banner text:', failBanner);
  if (!failBanner.includes('FALHA') || !failBanner.includes('+1 XP')) {
    throw new Error('Failure banner missing FALHA or +1 XP text!');
  }

  const xpAfterFail = await page.$eval('#charXPDisplay', el => parseInt(el.textContent, 10));
  console.log(`XP before: ${xpBeforeFail}, XP after failure: ${xpAfterFail} (Expected: ${xpBeforeFail + 1})`);
  if (xpAfterFail !== xpBeforeFail + 1) {
    throw new Error(`Expected XP to increase by 1 from ${xpBeforeFail} to ${xpBeforeFail + 1}, but got ${xpAfterFail}`);
  }

  // Test 8: Simulated Rupture roll and clicking Rupture chip
  console.log('10. Testing Rupture chip interactive click...');
  await page.evaluate(async () => {
    const engine = window.FractalRollSystem.diceEngine;
    const origRoll = engine.roll;
    engine.roll = async () => [5, 1]; // Success with rupture on fact
    await rollFractalRisk();
    engine.roll = origRoll;
  });

  await page.waitForSelector('.chip-rupture-item', { timeout: 3000 });
  const chipCount = await page.$$eval('.chip-rupture-item', chips => chips.length);
  console.log(`Rupture chips found: ${chipCount}`);
  if (chipCount === 0) {
    throw new Error('No rupture chips found after rolling a 1!');
  }

  // Click the first rupture chip
  await page.click('.chip-rupture-item');
  await page.waitForTimeout(200);

  // Check that the corresponding fact card has .fact-broken class
  const brokenCount = await page.$$eval('.fact-card.fact-broken', cards => cards.length);
  console.log(`Broken fact cards: ${brokenCount} (Expected: >= 1)`);
  if (brokenCount < 1) {
    throw new Error('No fact marked as broken after clicking rupture chip!');
  }

  console.log('✅ ALL TICKET 02 END-TO-END BROWSER CHECKS PASSED!');
  await browser.close();
}

main().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
