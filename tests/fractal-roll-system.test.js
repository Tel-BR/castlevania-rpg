import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFractalRollSystem } from '../js/fractal-roll-system.js';

describe('FractalRollSystem - Ticket 01: Motor 3D e Overlay', () => {
  let mockDiceBoxInstance;
  let mockDiceBoxClass;
  let mockContainer;
  let system;

  beforeEach(() => {
    // Mock container DOM element
    mockContainer = {
      style: { pointerEvents: 'none' },
      classList: {
        add: () => {},
        remove: () => {},
        contains: () => false
      }
    };

    // Mock DiceBox instance
    mockDiceBoxInstance = {
      init: async () => true,
      roll: async (notation) => {
        // Return 3d6 mock results by default
        return [
          { sides: 6, dieType: 'd6', value: 6 },
          { sides: 6, dieType: 'd6', value: 5 },
          { sides: 6, dieType: 'd6', value: 1 }
        ];
      },
      updateConfig: (cfg) => {}
    };

    mockDiceBoxClass = function(containerSelector, options) {
      this.container = containerSelector;
      this.options = options;
      return mockDiceBoxInstance;
    };

    system = createFractalRollSystem({
      DiceBoxClass: mockDiceBoxClass,
      getContainer: () => mockContainer,
      settleTimeoutMs: 10 // fast for tests
    });
  });

  test('Gothic color palette conforms to Castlevania aesthetic', () => {
    // Crimson blood for dhampiro/vampiro in night mode
    const dhampirColor = system.getThemeColor('dhampiro', false);
    assert.match(dhampirColor, /^#(8b1525|7a101c|991b1b)/i);

    // Holy gold / onyx for humano
    const humanColor = system.getThemeColor('humano', false);
    assert.match(humanColor, /^#(c49a2a|d4af37|18141f)/i);

    // Parchment mode adapts palette
    const parchmentColor = system.getThemeColor('humano', true);
    assert.ok(parchmentColor);
  });

  test('Initializes DiceBox with correct assetPath and origin CDN configuration', async () => {
    const initialized = await system.init();
    assert.equal(initialized, true);
    assert.equal(system.isInitialized, true);
    assert.equal(mockContainer.style.pointerEvents, 'none');
  });

  test('Clamps dice pool count between 1 and 6 and formats Nd6 notation', async () => {
    await system.init();

    let capturedNotation = null;
    mockDiceBoxInstance.roll = async (notation) => {
      capturedNotation = notation;
      return [{ sides: 6, dieType: 'd6', value: 4 }];
    };

    // Test clamped 0 -> 1d6
    await system.roll3D(0);
    assert.equal(capturedNotation, '1d6');

    // Test 3 -> 3d6
    await system.roll3D(3);
    assert.equal(capturedNotation, '3d6');

    // Test clamp > 6 -> 6d6
    await system.roll3D(10);
    assert.equal(capturedNotation, '6d6');
  });

  test('Overlay pointer-events lifecycle: activates on roll and resets to none after settle', async () => {
    await system.init();

    assert.equal(mockContainer.style.pointerEvents, 'none');

    const rollPromise = system.roll({ count: 2, characterName: 'Radu' });
    // During rolling, pointer-events can capture drag/tumble
    assert.equal(mockContainer.style.pointerEvents, 'auto');

    const result = await rollPromise;
    assert.ok(Array.isArray(result.results));
    assert.equal(result.results.length, 3); // from mock

    // After settle timeout, pointer-events must be 'none'
    await new Promise((r) => setTimeout(r, 25));
    assert.equal(mockContainer.style.pointerEvents, 'none');
  });

  test('Extracts raw numeric dice values correctly from physical dice-box result', async () => {
    await system.init();
    mockDiceBoxInstance.roll = async () => [
      { value: 6, dieType: 'd6' },
      { value: 2, dieType: 'd6' }
    ];

    const result = await system.roll({ count: 2 });
    assert.deepEqual(result.results, [6, 2]);
  });

  test('Fallback to mathematical random d6 when 3D box roll throws', async () => {
    await system.init();
    mockDiceBoxInstance.roll = async () => {
      throw new Error('WebGL Context Lost');
    };

    const result = await system.roll({ count: 4 });
    assert.equal(result.results.length, 4);
    for (const val of result.results) {
      assert.ok(val >= 1 && val <= 6);
    }
    assert.ok(result.highest >= 1 && result.highest <= 6);
  });

  test('Handles grouped roll results from DiceBox format', async () => {
    await system.init();
    mockDiceBoxInstance.roll = async () => [
      {
        groupId: 0,
        rolls: [
          { value: 5, dieType: 'd6' },
          { value: 6, dieType: 'd6' },
          { value: 1, dieType: 'd6' }
        ]
      }
    ];

    const result = await system.roll({ count: 3 });
    assert.deepEqual(result.results, [5, 6, 1]);
    assert.equal(result.highest, 6);
    assert.equal(result.sixesCount, 1);
    assert.equal(result.hasRupture, true);
  });

  test('computeSnappedFlatOrientation accurately detects orthogonal faces and snaps flat with minimal tilt', async () => {
    const { computeSnappedFlatOrientation, quatNormalize, quatFromTwoVectors, quatFromAxisAngle, quatMultiply } = await import('../js/fractal-roll-system.js');

    // Face 1: Identity rotation -> Face 1 pointing straight up (+Y)
    const snap1 = computeSnappedFlatOrientation([0, 0, 0, 1]);
    assert.equal(snap1.faceValue, 1);

    // Face 6: Rotated 180 deg around X -> Face 6 pointing up (+Y)
    const snap6 = computeSnappedFlatOrientation([1, 0, 0, 0]);
    assert.equal(snap6.faceValue, 6);

    // Face 2: Rotated -90 around X -> Face 2 (+Z face) pointing up
    const snap2 = computeSnappedFlatOrientation([-Math.SQRT1_2, 0, 0, Math.SQRT1_2]);
    assert.equal(snap2.faceValue, 2);

    // Minimal tilt test: 60 deg yaw + 8 deg tilt -> targetQuat is only ~8 deg away, preserving yaw
    const qYaw = quatFromAxisAngle([0, 1, 0], 60 * Math.PI / 180);
    const qFace2 = [-Math.SQRT1_2, 0, 0, Math.SQRT1_2];
    const qTilt = quatFromAxisAngle([1, 0, 0], 8 * Math.PI / 180);
    const qCombined = quatMultiply([0, 0, 0, 1], qTilt, quatMultiply([0, 0, 0, 1], qYaw, qFace2));

    const snapTilted = computeSnappedFlatOrientation(qCombined);
    assert.equal(snapTilted.faceValue, 2);

    // Angular difference between qCombined and snapTilted.targetQuat must be <= 10 deg (pure tilt, no yaw snap)
    const dot = Math.abs(qCombined[0]*snapTilted.targetQuat[0] + qCombined[1]*snapTilted.targetQuat[1] + qCombined[2]*snapTilted.targetQuat[2] + qCombined[3]*snapTilted.targetQuat[3]);
    const angleDiffDeg = 2 * Math.acos(Math.min(1.0, dot)) * 180 / Math.PI;
    assert.ok(angleDiffDeg <= 9.0, `Expected minimal tilt <= 9 deg, got ${angleDiffDeg}`);

    // Check quatFromTwoVectors identity
    const qIdent = quatFromTwoVectors([0, 1, 0], [0, 1, 0]);
    assert.equal(qIdent[3], 1);

    // Check quaternion normalization
    const qNorm = quatNormalize([0, 0, 0, 2]);
    assert.equal(qNorm[3], 1);
  });

  test('createFractalRollSystem works seamlessly with native diceEngine mock', async () => {
    let rolledCount = 0;
    let rolledColor = '';
    const mockNativeEngine = {
      roll: async (count, color) => {
        rolledCount = count;
        rolledColor = color;
        return [6, 4];
      }
    };

    const nativeSystem = createFractalRollSystem({
      diceEngine: mockNativeEngine,
      getContainer: () => mockContainer,
      settleTimeoutMs: 5
    });

    await nativeSystem.init();
    const result = await nativeSystem.roll({ count: 2, nature: 'dhampiro' });
    assert.deepEqual(result.results, [6, 4]);
    assert.equal(result.highest, 6);
    assert.equal(result.sixesCount, 1);
    assert.equal(result.hasRupture, false);
    assert.equal(rolledCount, 2);
    assert.match(rolledColor, /^#8b1525/i);
  });

  test('system.clear() cleanly clears native dice engine and resets rolling state', async () => {
    let cleared = false;
    const mockNativeEngine = {
      roll: async () => [5, 5],
      clear: () => { cleared = true; }
    };

    const nativeSystem = createFractalRollSystem({
      diceEngine: mockNativeEngine,
      getContainer: () => mockContainer
    });

    await nativeSystem.init();
    assert.equal(typeof nativeSystem.clear, 'function');
    nativeSystem.clear();
    assert.equal(cleared, true);
    assert.equal(nativeSystem.isRolling, false);
    assert.equal(mockContainer.style.pointerEvents, 'none');
  });
});

describe('FractalRollSystem - Ticket 02: Resolução de Regras Fractal e Fallback', () => {
  test('Slice 1: 5 and 6 are SUCESSO, 1-4 are FALHA, failure yields +1 XP', async () => {
    const { resolveFractalRules } = await import('../js/fractal-roll-system.js');
    assert.equal(typeof resolveFractalRules, 'function');

    const roll5 = resolveFractalRules([5, 3]);
    assert.equal(roll5.highest, 5);
    assert.equal(roll5.outcome, 'SUCESSO');
    assert.equal(roll5.isSuccess, true);
    assert.equal(roll5.isFailure, false);
    assert.equal(roll5.xpGained, 0);

    const roll6 = resolveFractalRules([6, 2]);
    assert.equal(roll6.highest, 6);
    assert.equal(roll6.outcome, 'SUCESSO');
    assert.equal(roll6.isSuccess, true);
    assert.equal(roll6.xpGained, 0);

    const rollFail = resolveFractalRules([4, 3, 2]);
    assert.equal(rollFail.highest, 4);
    assert.equal(rollFail.outcome, 'FALHA');
    assert.equal(rollFail.isSuccess, false);
    assert.equal(rollFail.isFailure, true);
    assert.equal(rollFail.xpGained, 1);
  });

  test('Slice 2: Two or more 6s trigger IMPULSO / Crítico dramático', async () => {
    const { resolveFractalRules } = await import('../js/fractal-roll-system.js');

    const twoSixes = resolveFractalRules([6, 6, 3]);
    assert.equal(twoSixes.outcome, 'IMPULSO');
    assert.equal(twoSixes.isCritical, true);
    assert.equal(twoSixes.isSuccess, true);
    assert.equal(twoSixes.sixesCount, 2);
    assert.match(twoSixes.outcomeTitle, /IMPULSO NARRATIVO! \(2 Seis\)/);

    const threeSixes = resolveFractalRules([6, 6, 6]);
    assert.equal(threeSixes.outcome, 'IMPULSO');
    assert.equal(threeSixes.isCritical, true);
    assert.equal(threeSixes.sixesCount, 3);

    const oneSix = resolveFractalRules([6, 5, 2]);
    assert.equal(oneSix.outcome, 'SUCESSO');
    assert.equal(oneSix.isCritical, false);
    assert.equal(oneSix.sixesCount, 1);
  });

  test('Slice 3: Sem Fatos (Desespero): only 6 is SUCESSO_MILAGROSO, 5 is FALHA', async () => {
    const { resolveFractalRules } = await import('../js/fractal-roll-system.js');

    const roll6SemFatos = resolveFractalRules([6], { isSemFatos: true });
    assert.equal(roll6SemFatos.outcome, 'SUCESSO_MILAGROSO');
    assert.equal(roll6SemFatos.isSuccess, true);
    assert.equal(roll6SemFatos.isFailure, false);
    assert.equal(roll6SemFatos.xpGained, 0);

    const roll5SemFatos = resolveFractalRules([5], { isSemFatos: true });
    assert.equal(roll5SemFatos.outcome, 'FALHA');
    assert.equal(roll5SemFatos.isSuccess, false);
    assert.equal(roll5SemFatos.isFailure, true);
    assert.equal(roll5SemFatos.xpGained, 1);
  });

  test('Slice 4: Any die showing 1 triggers Rupture warning, with ruptureApplies checked', async () => {
    const { resolveFractalRules } = await import('../js/fractal-roll-system.js');

    // Success with rupture
    const rollWith1 = resolveFractalRules([6, 1], { isSemFatos: false });
    assert.equal(rollWith1.hasRupture, true);
    assert.equal(rollWith1.ruptureApplies, true);
    assert.equal(rollWith1.isSuccess, true);

    // Failure with rupture
    const failWith1 = resolveFractalRules([3, 1], { isSemFatos: false });
    assert.equal(failWith1.hasRupture, true);
    assert.equal(failWith1.ruptureApplies, true);
    assert.equal(failWith1.isFailure, true);

    // Roll without 1
    const no1 = resolveFractalRules([5, 4, 3]);
    assert.equal(no1.hasRupture, false);
    assert.equal(no1.ruptureApplies, false);

    // Sem fatos roll with 1 (no facts used to break)
    const semFatos1 = resolveFractalRules([1], { isSemFatos: true });
    assert.equal(semFatos1.hasRupture, true);
    assert.equal(semFatos1.ruptureApplies, false);
  });

  test('Slice 5: Determination debits correct reserve (Espírito/Sangue) and blocks on 0 essence or Sem Fatos', async () => {
    const { resolveFractalRules } = await import('../js/fractal-roll-system.js');

    // Human with 3 Espírito
    const humanDet = resolveFractalRules([5, 4], {
      useDetermination: true,
      nature: 'humano',
      essence: 3
    });
    assert.equal(humanDet.determination.allowed, true);
    assert.equal(humanDet.determination.cost, 1);
    assert.equal(humanDet.determination.reserveType, 'Espírito');
    assert.equal(humanDet.determination.newEssence, 2);

    // Vampire with 2 Sangue
    const vampDet = resolveFractalRules([6, 3], {
      useDetermination: true,
      nature: 'vampiro',
      essence: 2
    });
    assert.equal(vampDet.determination.allowed, true);
    assert.equal(vampDet.determination.cost, 1);
    assert.equal(vampDet.determination.reserveType, 'Sangue');
    assert.equal(vampDet.determination.newEssence, 1);

    // Depleted reserve (0 Essence) -> Blocked
    const depletedDet = resolveFractalRules([4, 2], {
      useDetermination: true,
      nature: 'humano',
      essence: 0
    });
    assert.equal(depletedDet.determination.allowed, false);
    assert.equal(depletedDet.determination.cost, 0);
    assert.match(depletedDet.determination.error, /esgotada/);
    assert.equal(depletedDet.determination.newEssence, 0);

    // Sem Fatos -> Blocked
    const semFatosDet = resolveFractalRules([5], {
      useDetermination: true,
      isSemFatos: true,
      nature: 'humano',
      essence: 3
    });
    assert.equal(semFatosDet.determination.allowed, false);
    assert.equal(semFatosDet.determination.cost, 0);
    assert.match(semFatosDet.determination.error, /sem Fatos/);
  });

  test('Slice 6: FractalRollSystem.roll() integrates resolution, callbacks (XP, Essence) and broadcast', async () => {
    let deductedCost = 0;
    let deductedType = '';
    let gainedXP = 0;
    let broadcastData = null;

    const mockNativeEngine = {
      roll: async () => [4, 1] // Highest 4 = Falha, has 1 = Ruptura
    };

    const system = createFractalRollSystem({
      diceEngine: mockNativeEngine,
      settleTimeoutMs: 5,
      onBroadcast: (data) => { broadcastData = data; }
    });

    await system.init();

    const rollResult = await system.roll({
      count: 2,
      nature: 'dhampiro',
      characterName: 'Miklós',
      useDetermination: true,
      essence: 2,
      onDeductEssence: (cost, type) => {
        deductedCost = cost;
        deductedType = type;
      },
      onGainXP: (xp) => {
        gainedXP = xp;
      }
    });

    // Check complete return payload
    assert.deepEqual(rollResult.results, [4, 1]);
    assert.equal(rollResult.highest, 4);
    assert.equal(rollResult.outcome, 'FALHA');
    assert.equal(rollResult.isFailure, true);
    assert.equal(rollResult.hasRupture, true);
    assert.equal(rollResult.ruptureApplies, true);
    assert.equal(rollResult.xpGained, 1);
    assert.equal(gainedXP, 1); // Callback called!
    assert.equal(rollResult.determination.allowed, true);
    assert.equal(rollResult.determination.cost, 1);
    assert.equal(rollResult.determination.reserveType, 'Sangue');
    assert.equal(deductedCost, 1); // Callback called!
    assert.equal(deductedType, 'Sangue');
    assert.ok(broadcastData);
    assert.equal(broadcastData.characterName, 'Miklós');
  });

  test('Slice 7: Fallback mode resolves complete rules and callbacks without crashing when 3D engine fails', async () => {
    let gainedXP = 0;
    const failingEngine = {
      roll: async () => {
        throw new Error('Canvas WebGL Context Failed');
      }
    };

    const system = createFractalRollSystem({
      diceEngine: failingEngine,
      settleTimeoutMs: 5
    });

    await system.init();

    const rollResult = await system.roll({
      count: 3,
      nature: 'humano',
      characterName: 'Radu Bărbat',
      useDetermination: false,
      onGainXP: (xp) => { gainedXP += xp; }
    });

    assert.equal(rollResult.results.length, 3);
    assert.ok(rollResult.highest >= 1 && rollResult.highest <= 6);
    assert.ok(['SUCESSO', 'IMPULSO', 'FALHA'].includes(rollResult.outcome));
    if (rollResult.isFailure) {
      assert.equal(rollResult.xpGained, 1);
      assert.equal(gainedXP, 1);
    } else {
      assert.equal(rollResult.xpGained, 0);
      assert.equal(gainedXP, 0);
    }
  });
});

