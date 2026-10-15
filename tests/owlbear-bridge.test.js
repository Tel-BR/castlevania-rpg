import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOwlbearBridge, OWLBEAR_CHANNEL, formatRollPayload, formatNotification } from '../js/owlbear-bridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('OwlbearBridge - Ticket 03: Detecção, Formatação e Broadcast', () => {
  let mockWindow;
  let mockOBR;
  let sentPostMessages;
  let sentBroadcasts;
  let sentNotifications;

  beforeEach(() => {
    sentPostMessages = [];
    sentBroadcasts = [];
    sentNotifications = [];

    mockWindow = {
      self: {},
      top: {},
      location: { search: '' },
      parent: {
        postMessage: (data, origin) => {
          sentPostMessages.push({ data, origin });
        }
      },
      addEventListener: (evt, handler) => {},
      removeEventListener: (evt, handler) => {}
    };
    mockWindow.self = mockWindow;
    mockWindow.top = mockWindow; // default: standalone top window

    mockOBR = {
      isReady: true,
      onReady: (cb) => { cb({ id: 'user-123', name: 'Arquiteto' }); },
      broadcast: {
        sendMessage: async (channel, data, options) => {
          sentBroadcasts.push({ channel, data, options });
        },
        onMessage: (channel, cb) => {
          return () => {}; // unsubscribe function
        }
      },
      notification: {
        show: async (message, level) => {
          sentNotifications.push({ message, level });
        }
      }
    };
  });

  test('detectEnvironment correctly identifies standalone vs iframe vs window.OBR vs query param', () => {
    // 1. Standalone top window without OBR
    const bridge1 = createOwlbearBridge({ windowObj: mockWindow });
    const env1 = bridge1.detectEnvironment();
    assert.equal(env1.isIframe, false);
    assert.equal(env1.hasOBR, false);
    assert.equal(env1.isOwlbear, false);
    assert.equal(env1.mode, 'standalone');

    // 2. Running inside an iframe (window.self !== window.top)
    mockWindow.top = {}; // different object
    const bridge2 = createOwlbearBridge({ windowObj: mockWindow });
    const env2 = bridge2.detectEnvironment();
    assert.equal(env2.isIframe, true);
    assert.equal(env2.isOwlbear, true);
    assert.equal(env2.mode, 'iframe');

    // 3. Has OBR object attached to window
    mockWindow.top = mockWindow; // back to top
    mockWindow.OBR = mockOBR;
    const bridge3 = createOwlbearBridge({ windowObj: mockWindow });
    const env3 = bridge3.detectEnvironment();
    assert.equal(env3.hasOBR, true);
    assert.equal(env3.isOwlbear, true);
    assert.equal(env3.mode, 'owlbear-sdk');

    // 4. Query param ?owlbear=1
    delete mockWindow.OBR;
    mockWindow.location.search = '?owlbear=1';
    const bridge4 = createOwlbearBridge({ windowObj: mockWindow });
    const env4 = bridge4.detectEnvironment();
    assert.equal(env4.isOwlbear, true);
  });

  test('formatRollPayload normalizes roll result into standardized Owlbear message schema', () => {
    const rawResult = {
      characterName: 'Miklós',
      nature: 'dhampiro',
      count: 2,
      results: [6, 1],
      highest: 6,
      sixesCount: 1,
      outcome: 'SUCESSO',
      outcomeTitle: 'SUCESSO! (Dado: 6)',
      outcomeDescription: 'Dados: [ 6, 1 ] — O objetivo é alcançado com perfeição.',
      hasRupture: true,
      ruptureApplies: true,
      isSuccess: true,
      isCritical: false,
      isFailure: false,
      xpGained: 0,
      determination: { requested: true, allowed: true, cost: 1, reserveType: 'Sangue' }
    };

    const payload = formatRollPayload(rawResult);

    assert.equal(payload.type, 'FRACTAL_CASTLEVANIA_ROLL');
    assert.equal(payload.version, '1.0.0');
    assert.equal(payload.character, 'Miklós');
    assert.equal(payload.nature, 'dhampiro');
    assert.equal(payload.pool, 2);
    assert.deepEqual(payload.results, [6, 1]);
    assert.equal(payload.highest, 6);
    assert.equal(payload.sixes, 1);
    assert.equal(payload.outcome, 'SUCESSO');
    assert.equal(payload.hasRupture, true);
    assert.equal(payload.ruptureApplies, true);
    assert.equal(payload.isSuccess, true);
    assert.equal(payload.isFailure, false);
    assert.equal(payload.xpGained, 0);
    assert.equal(payload.determination.cost, 1);
    assert.equal(payload.determination.reserveType, 'Sangue');
    assert.ok(typeof payload.timestamp === 'number');
  });

  test('formatNotification generates thematic text and appropriate level for all outcomes', () => {
    // 1. Impulso (Critical) with rupture
    const notifImpulso = formatNotification({
      character: 'Radu Bărbat',
      results: [6, 6, 1],
      sixes: 2,
      highest: 6,
      outcome: 'IMPULSO',
      ruptureApplies: true
    });
    assert.equal(notifImpulso.level, 'SUCCESS');
    assert.match(notifImpulso.message, /Radu Bărbat/);
    assert.match(notifImpulso.message, /IMPULSO/);
    assert.match(notifImpulso.message, /2 Seis/);
    assert.match(notifImpulso.message, /RUPTURA/);

    // 2. Regular Sucesso without rupture
    const notifSucesso = formatNotification({
      character: 'Elena',
      results: [5, 3],
      sixes: 0,
      highest: 5,
      outcome: 'SUCESSO',
      ruptureApplies: false
    });
    assert.equal(notifSucesso.level, 'SUCCESS');
    assert.match(notifSucesso.message, /Elena/);
    assert.match(notifSucesso.message, /SUCESSO/);
    assert.doesNotMatch(notifSucesso.message, /RUPTURA/);

    // 3. Sucesso Milagroso (Sem Fatos)
    const notifMilagre = formatNotification({
      character: 'Desesperado',
      results: [6],
      sixes: 1,
      highest: 6,
      outcome: 'SUCESSO_MILAGROSO',
      ruptureApplies: false
    });
    assert.equal(notifMilagre.level, 'SUCCESS');
    assert.match(notifMilagre.message, /MILAGROSO/);

    // 4. Falha with rupture
    const notifFalhaRupture = formatNotification({
      character: 'Condessa Vespera',
      results: [3, 1],
      sixes: 0,
      highest: 3,
      outcome: 'FALHA',
      ruptureApplies: true
    });
    assert.equal(notifFalhaRupture.level, 'WARNING');
    assert.match(notifFalhaRupture.message, /FALHA/);
    assert.match(notifFalhaRupture.message, /\+1 XP/);
    assert.match(notifFalhaRupture.message, /RUPTURA/);

    // 5. Clean Falha without rupture
    const notifFalhaClean = formatNotification({
      character: 'Aldeão',
      results: [4, 3],
      sixes: 0,
      highest: 4,
      outcome: 'FALHA',
      ruptureApplies: false
    });
    assert.equal(notifFalhaClean.level, 'DEFAULT');
    assert.match(notifFalhaClean.message, /FALHA/);
    assert.match(notifFalhaClean.message, /\+1 XP/);
  });

  test('broadcastRoll broadcasts via postMessage to parent window', async () => {
    mockWindow.top = {}; // inside iframe
    const bridge = createOwlbearBridge({ windowObj: mockWindow });

    const rollData = {
      characterName: 'Miklós',
      nature: 'dhampiro',
      count: 2,
      results: [6, 4],
      highest: 6,
      outcome: 'SUCESSO',
      isSuccess: true
    };

    const broadcastResult = await bridge.broadcastRoll(rollData);
    assert.equal(broadcastResult.success, true);
    assert.equal(sentPostMessages.length, 1);
    assert.equal(sentPostMessages[0].data.type, 'FRACTAL_CASTLEVANIA_ROLL');
    assert.equal(sentPostMessages[0].data.character, 'Miklós');
    assert.equal(sentPostMessages[0].origin, '*');
  });

  test('broadcastRoll broadcasts via OBR.broadcast and OBR.notification when OBR is present and ready', async () => {
    mockWindow.top = {};
    const bridge = createOwlbearBridge({
      windowObj: mockWindow,
      OBR: mockOBR
    });

    await bridge.init();

    const rollData = {
      characterName: 'Radu',
      nature: 'humano',
      count: 3,
      results: [6, 6, 2],
      highest: 6,
      sixesCount: 2,
      outcome: 'IMPULSO',
      isSuccess: true,
      isCritical: true,
      ruptureApplies: false
    };

    const res = await bridge.broadcastRoll(rollData);
    assert.equal(res.success, true);
    assert.ok(res.dispatchedVia.includes('postMessage'));
    assert.ok(res.dispatchedVia.includes('obr-broadcast'));
    assert.ok(res.dispatchedVia.includes('obr-notification'));

    // Check OBR broadcast
    assert.equal(sentBroadcasts.length, 1);
    assert.equal(sentBroadcasts[0].channel, OWLBEAR_CHANNEL);
    assert.equal(sentBroadcasts[0].data.outcome, 'IMPULSO');
    assert.equal(sentBroadcasts[0].options.destination, 'ALL');

    // Check OBR notification
    assert.equal(sentNotifications.length, 1);
    assert.equal(sentNotifications[0].level, 'SUCCESS');
    assert.match(sentNotifications[0].message, /IMPULSO/);
  });

  test('broadcastRoll does not crash if postMessage or OBR throws an unexpected exception', async () => {
    mockWindow.top = {};
    mockWindow.parent.postMessage = () => {
      throw new Error('Blocked cross-origin iframe security restriction');
    };
    mockOBR.broadcast.sendMessage = async () => {
      throw new Error('Network WebSocket timeout');
    };

    const bridge = createOwlbearBridge({
      windowObj: mockWindow,
      OBR: mockOBR
    });
    await bridge.init();

    // Must not throw:
    const res = await bridge.broadcastRoll({
      characterName: 'Resiliente',
      results: [5]
    });
    assert.equal(res.success, false);
    assert.ok(res.errors.length >= 1);
  });

  test('onReceiveBroadcast registers listeners and fires callback upon receiving a valid roll', () => {
    let capturedEvent = null;
    let registeredHandler = null;

    mockWindow.addEventListener = (evt, handler) => {
      if (evt === 'message') registeredHandler = handler;
    };

    const bridge = createOwlbearBridge({ windowObj: mockWindow });
    bridge.onReceiveBroadcast((payload) => {
      capturedEvent = payload;
    });

    assert.ok(registeredHandler);

    // Simulate incoming valid event
    registeredHandler({
      data: {
        type: 'FRACTAL_CASTLEVANIA_ROLL',
        character: 'Elena',
        results: [6, 5],
        outcome: 'SUCESSO'
      }
    });

    assert.ok(capturedEvent);
    assert.equal(capturedEvent.character, 'Elena');
    assert.equal(capturedEvent.outcome, 'SUCESSO');

    // Non-fractal messages must be ignored
    let ignored = false;
    bridge.onReceiveBroadcast(() => { ignored = true; });
    ignored = false;
    registeredHandler({ data: { type: 'OTHER_VTT_EVENT' } });
    assert.equal(ignored, false);
  });

  test('FractalRollSystem.roll() dispatches to OwlbearBridge seamlessly', async () => {
    const { createFractalRollSystem } = await import('../js/fractal-roll-system.js');
    mockWindow.top = {};
    const bridge = createOwlbearBridge({ windowObj: mockWindow, OBR: mockOBR });
    await bridge.init();

    const mockNativeEngine = {
      roll: async () => [6, 6] // Impulso!
    };

    const rollSystem = createFractalRollSystem({
      diceEngine: mockNativeEngine,
      owlbearBridge: bridge,
      settleTimeoutMs: 5
    });

    await rollSystem.init();

    const result = await rollSystem.roll({
      characterName: 'Simon Belmont',
      nature: 'humano',
      count: 2
    });

    assert.equal(result.outcome, 'IMPULSO');
    assert.equal(sentPostMessages.length, 1);
    assert.equal(sentPostMessages[0].data.character, 'Simon Belmont');
    assert.equal(sentPostMessages[0].data.outcome, 'IMPULSO');

    assert.equal(sentBroadcasts.length, 1);
    assert.equal(sentBroadcasts[0].data.character, 'Simon Belmont');

    assert.equal(sentNotifications.length, 1);
    assert.match(sentNotifications[0].message, /Simon Belmont/);
    assert.match(sentNotifications[0].message, /IMPULSO/);
  });
});

describe('Owlbear Rodeo v2 manifest.json Verification', () => {
  test('manifest.json exists and strictly satisfies Owlbear Rodeo v2 extension specification', () => {
    const manifestPath = path.resolve(__dirname, '..', 'manifest.json');
    assert.ok(fs.existsSync(manifestPath), 'manifest.json file must exist in repo root');

    const raw = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(raw);

    // Required root fields
    assert.equal(manifest.manifest_version, 1, 'manifest_version must be exactly 1');
    assert.ok(typeof manifest.name === 'string', 'name must be a string');
    assert.ok(manifest.name.length > 0 && manifest.name.length <= 45, `name length must be <= 45 chars (was ${manifest.name.length})`);
    assert.ok(typeof manifest.version === 'string', 'version must be a string');

    // Description limit
    if (manifest.description) {
      assert.ok(manifest.description.length <= 128, `description length must be <= 128 chars (was ${manifest.description.length})`);
    }

    // Action object for Owlbear top-left button and popover
    assert.ok(manifest.action, 'action object must be present');
    assert.ok(typeof manifest.action.title === 'string', 'action.title must be a string');
    assert.ok(typeof manifest.action.popover === 'string', 'action.popover must point to the HTML file');
    assert.ok(typeof manifest.action.icon === 'string', 'action.icon must point to an icon');
    assert.ok(typeof manifest.action.width === 'number' && manifest.action.width >= 320, 'action.width should be >= 320');
    assert.ok(typeof manifest.action.height === 'number' && manifest.action.height >= 400, 'action.height should be >= 400');
  });
});
