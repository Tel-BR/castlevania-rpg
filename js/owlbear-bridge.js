/**
 * OwlbearBridge - Ponte de Comunicação e Broadcast para Owlbear Rodeo v2
 * Sistema Fractal RPG — Castlevania
 *
 * Responsável por:
 * 1. Detecção automática de ambiente (iframe, popover do Owlbear Rodeo, window.OBR)
 * 2. Formatação padronizada do evento de rolagem (FRACTAL_CASTLEVANIA_ROLL)
 * 3. Envio de notificações temáticas (OBR.notification.show) e broadcast (OBR.broadcast.sendMessage)
 * 4. Fallback resiliente via window.parent.postMessage sem travar a interface
 * 5. Recepção e escuta de rolagens de outros jogadores na mesa
 */

export const OWLBEAR_CHANNEL = 'com.castlevania-rpg.dice/roll';
export const SHEET_SYNC_CHANNEL = 'com.castlevania-rpg.sheet/sync';
export const MESSAGE_TYPE = 'FRACTAL_CASTLEVANIA_ROLL';
export const PROTOCOL_VERSION = '1.0.0';

/**
 * Normaliza o resultado bruto de rolagem para o schema oficial de evento do Owlbear Rodeo
 */
export function formatRollPayload(raw = {}) {
  const results = Array.isArray(raw.results) ? [...raw.results] : [];
  const count = typeof raw.count === 'number' ? raw.count : results.length;
  const highest = typeof raw.highest === 'number' ? raw.highest : (results.length > 0 ? Math.max(...results) : 0);
  const sixes = typeof raw.sixesCount === 'number' ? raw.sixesCount : (typeof raw.sixes === 'number' ? raw.sixes : results.filter(v => v === 6).length);
  const outcome = raw.outcome || (highest >= 5 ? 'SUCESSO' : 'FALHA');
  const character = raw.characterName || raw.character || 'Herói Desconhecido';
  const nature = (raw.nature || 'humano').toLowerCase();
  const hasRupture = Boolean(raw.hasRupture !== undefined ? raw.hasRupture : results.includes(1));
  const ruptureApplies = Boolean(raw.ruptureApplies !== undefined ? raw.ruptureApplies : (hasRupture && !raw.isSemFatos));
  const isSuccess = Boolean(raw.isSuccess !== undefined ? raw.isSuccess : (highest >= 5));
  const isCritical = Boolean(raw.isCritical !== undefined ? raw.isCritical : (outcome === 'IMPULSO' || sixes >= 2));
  const isFailure = Boolean(raw.isFailure !== undefined ? raw.isFailure : (outcome === 'FALHA' || highest < 5));
  const xpGained = typeof raw.xpGained === 'number' ? raw.xpGained : (isFailure ? 1 : 0);

  return {
    type: MESSAGE_TYPE,
    version: PROTOCOL_VERSION,
    character,
    nature,
    pool: count,
    results,
    highest,
    sixes,
    outcome,
    outcomeTitle: raw.outcomeTitle || `${outcome}!`,
    outcomeDescription: raw.outcomeDescription || `Dados: [ ${results.join(', ')} ]`,
    hasRupture,
    ruptureApplies,
    isSuccess,
    isCritical,
    isFailure,
    xpGained,
    determination: raw.determination || null,
    timestamp: typeof raw.timestamp === 'number' ? raw.timestamp : Date.now()
  };
}

/**
 * Gera mensagem descritiva e nível de alerta para o sistema de notificações do Owlbear Rodeo
 */
export function formatNotification(payload) {
  const char = payload.character || 'Herói Desconhecido';
  const diceStr = Array.isArray(payload.results) ? payload.results.join(', ') : '';
  const ruptureText = payload.ruptureApplies ? ' 🩸 ALERTA DE RUPTURA!' : '';

  if (payload.outcome === 'IMPULSO') {
    return {
      message: `🔥 ${char}: IMPULSO NARRATIVO! (${payload.sixes} Seis!) [ ${diceStr} ]${ruptureText}`,
      level: 'SUCCESS'
    };
  }

  if (payload.outcome === 'SUCESSO_MILAGROSO') {
    return {
      message: `✨ ${char}: SUCESSO MILAGROSO! (Tirou 6 puro sem Fatos) [ ${diceStr} ]`,
      level: 'SUCCESS'
    };
  }

  if (payload.outcome === 'SUCESSO' || payload.isSuccess) {
    return {
      message: `⚔️ ${char}: SUCESSO! (Maior dado: ${payload.highest}) [ ${diceStr} ]${ruptureText}`,
      level: 'SUCCESS'
    };
  }

  // Falha
  return {
    message: `💀 ${char}: FALHA! (Maior dado: ${payload.highest}) [ ${diceStr} ] (+1 XP)${ruptureText}`,
    level: payload.ruptureApplies ? 'WARNING' : 'DEFAULT'
  };
}

/**
 * Cria a ponte OwlbearBridge para gerenciamento de ambiente, eventos e notificações
 */
export function createOwlbearBridge(options = {}) {
  const win = options.windowObj !== undefined ? options.windowObj : (typeof window !== 'undefined' ? window : null);
  let obrInstance = options.OBR || (win && win.OBR ? win.OBR : null);
  const channel = options.channel || OWLBEAR_CHANNEL;
  const sheetSyncChannel = options.sheetSyncChannel || SHEET_SYNC_CHANNEL;
  const onStatusChange = options.onStatusChange || null;

  let isReady = false;
  let currentUser = null;
  const subscribers = new Set();
  const sheetSubscribers = new Set();
  let obrUnsubscribe = null;
  let obrSheetUnsubscribe = null;

  function detectEnvironment() {
    if (!win) {
      return { isIframe: false, hasOBR: false, isOwlbear: false, mode: 'standalone' };
    }

    let isIframe = false;
    try {
      isIframe = win.self !== win.top;
    } catch {
      // Se houver restrição cross-origin ao acessar win.top, é certamente um iframe
      isIframe = true;
    }

    const hasOBR = Boolean(obrInstance || win.OBR || win.__OBR_INITIALIZED__);
    const isOwlbearQuery = Boolean(
      win.location &&
      win.location.search &&
      (win.location.search.includes('owlbear') || win.location.search.includes('vtt'))
    );

    const isOwlbear = isIframe || hasOBR || isOwlbearQuery;

    let mode = 'standalone';
    if (hasOBR) {
      mode = 'owlbear-sdk';
    } else if (isIframe) {
      mode = 'iframe';
    }

    return {
      isIframe,
      hasOBR,
      isOwlbear,
      mode
    };
  }

  async function waitForObrReady(timeoutMs = 2500) {
    const activeOBR = obrInstance || (win && win.OBR ? win.OBR : null);
    if (!activeOBR) return false;
    if (activeOBR.isReady === true) return true;

    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve(Boolean(activeOBR.isReady));
        }
      }, timeoutMs);

      if (typeof activeOBR.onReady === 'function') {
        activeOBR.onReady(() => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(true);
          }
        });
      } else {
        clearTimeout(timer);
        resolve(Boolean(activeOBR.isReady));
      }
    });
  }

  async function init() {
    const env = detectEnvironment();

    // Se OBR não estiver definido no win, mas estivermos em iframe/Owlbear, tentar carregar via ESM
    if (!obrInstance && win && win.OBR) {
      obrInstance = win.OBR;
    }

    if (!obrInstance && env.isOwlbear && typeof importScripts === 'undefined' && typeof document !== 'undefined') {
      try {
        const module = await import(/* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk/+esm');
        if (module && (module.default || module.OBR)) {
          obrInstance = module.default || module.OBR;
          win.OBR = obrInstance;
        }
      } catch (err) {
        // Modo offline ou rede restrita — silencia erro e opera via postMessage fallback
      }
    }

    if (obrInstance) {
      try {
        function subscribeBroadcast() {
          if (obrInstance && obrInstance.broadcast && typeof obrInstance.broadcast.onMessage === 'function') {
            try {
              obrUnsubscribe = obrInstance.broadcast.onMessage(channel, (event) => {
                if (event && event.data) {
                  notifySubscribers(event.data);
                }
              });
              obrSheetUnsubscribe = obrInstance.broadcast.onMessage(sheetSyncChannel, (event) => {
                if (event && event.data) {
                  notifySheetSubscribers(event.data);
                }
              });
            } catch (err) {
              console.warn('[OwlbearBridge] Erro ao subscrever broadcast:', err);
            }
          }
        }

        if (typeof obrInstance.onReady === 'function') {
          obrInstance.onReady(async (user) => {
            isReady = true;
            subscribeBroadcast();
            try {
              if (obrInstance.player) {
                const role = typeof obrInstance.player.getRole === 'function' ? await obrInstance.player.getRole() : (user && user.role);
                const name = typeof obrInstance.player.getName === 'function' ? await obrInstance.player.getName() : (user && user.name);
                const id = typeof obrInstance.player.getId === 'function' ? await obrInstance.player.getId() : (user && user.id);
                currentUser = { role, name, id };
              }
            } catch (e) {}

            if (typeof onStatusChange === 'function') {
              onStatusChange({ connected: true, user: currentUser, mode: 'owlbear-sdk' });
            }
          });
        }

        // Aguarda de forma assíncrona a inicialização do SDK para que getPlayerRole não falhe por corrida
        await waitForObrReady(1500);

        if (obrInstance.isReady) {
          isReady = true;
          subscribeBroadcast();
          try {
            if (obrInstance.player) {
              const role = typeof obrInstance.player.getRole === 'function' ? await obrInstance.player.getRole() : null;
              const name = typeof obrInstance.player.getName === 'function' ? await obrInstance.player.getName() : null;
              const id = typeof obrInstance.player.getId === 'function' ? await obrInstance.player.getId() : null;
              currentUser = { role, name, id };
            }
          } catch (e) {}
          if (typeof onStatusChange === 'function') {
            onStatusChange({ connected: true, user: currentUser, mode: 'owlbear-sdk' });
          }
        }
      } catch (err) {
        console.warn('[OwlbearBridge] Erro ao inicializar SDK Owlbear:', err);
      }
    }

    setupWindowListener();
    return isReady || env.isOwlbear;
  }

  let windowListenerAttached = false;
  function setupWindowListener() {
    if (windowListenerAttached) return;
    if (win && typeof win.addEventListener === 'function') {
      win.addEventListener('message', (event) => {
        if (event && event.data) {
          if (event.data.type === MESSAGE_TYPE) {
            notifySubscribers(event.data);
          } else if (event.data.type === 'PLAYER_SHEET_UPDATE' || event.data.type === 'REQUEST_ALL_SHEETS') {
            notifySheetSubscribers(event.data);
          }
        }
      });
      windowListenerAttached = true;
    }
  }

  function notifySubscribers(payload) {
    for (const callback of subscribers) {
      try {
        callback(payload);
      } catch (err) {
        console.warn('[OwlbearBridge] Erro no callback de recepção:', err);
      }
    }
  }

  function notifySheetSubscribers(payload) {
    for (const callback of sheetSubscribers) {
      try {
        callback(payload);
      } catch (err) {
        console.warn('[OwlbearBridge] Erro no callback de sheetSubscribers:', err);
      }
    }
  }

  async function getPlayerRole() {
    await waitForObrReady(1000);
    const activeOBR = obrInstance || (win && win.OBR ? win.OBR : null);
    if (activeOBR && activeOBR.player && typeof activeOBR.player.getRole === 'function') {
      try {
        return await activeOBR.player.getRole();
      } catch (err) {
        console.warn('[OwlbearBridge] Erro ao obter player.getRole:', err);
      }
    }
    return (currentUser && currentUser.role) || 'PLAYER';
  }

  async function getPlayerId() {
    await waitForObrReady(1000);
    const activeOBR = obrInstance || (win && win.OBR ? win.OBR : null);
    if (activeOBR && activeOBR.player && typeof activeOBR.player.getId === 'function') {
      try {
        return await activeOBR.player.getId();
      } catch (err) {
        console.warn('[OwlbearBridge] Erro ao obter player.getId:', err);
      }
    }
    return (currentUser && currentUser.id) || 'local-user';
  }

  async function getPlayerName() {
    await waitForObrReady(1000);
    const activeOBR = obrInstance || (win && win.OBR ? win.OBR : null);
    if (activeOBR && activeOBR.player && typeof activeOBR.player.getName === 'function') {
      try {
        return await activeOBR.player.getName();
      } catch (err) {
        console.warn('[OwlbearBridge] Erro ao obter player.getName:', err);
      }
    }
    return (currentUser && currentUser.name) || 'Jogador';
  }

  async function broadcastSheet(sheetData, metadata = {}) {
    const activeOBR = obrInstance || (win && win.OBR ? win.OBR : null);
    const pid = metadata.playerId || await getPlayerId();
    const pname = metadata.playerName || await getPlayerName();
    const payload = {
      type: 'PLAYER_SHEET_UPDATE',
      version: PROTOCOL_VERSION,
      playerId: pid,
      playerName: pname,
      characterName: metadata.characterName || (sheetData && sheetData.name) || 'Herói',
      nature: metadata.nature || (sheetData && sheetData.species) || 'humano',
      sheetData: sheetData,
      timestamp: Date.now()
    };

    if (activeOBR && activeOBR.broadcast && typeof activeOBR.broadcast.sendMessage === 'function') {
      try {
        await activeOBR.broadcast.sendMessage(sheetSyncChannel, payload, { destination: 'ALL' });
      } catch (err) {
        console.warn('[OwlbearBridge] Erro ao enviar broadcast de ficha:', err);
      }
    }

    if (win && win.parent && typeof win.parent.postMessage === 'function') {
      try {
        win.parent.postMessage(payload, '*');
      } catch (err) {}
    }

    return payload;
  }

  async function requestSheets() {
    const activeOBR = obrInstance || (win && win.OBR ? win.OBR : null);
    const pid = await getPlayerId();
    const payload = {
      type: 'REQUEST_ALL_SHEETS',
      version: PROTOCOL_VERSION,
      from: pid,
      timestamp: Date.now()
    };

    if (activeOBR && activeOBR.broadcast && typeof activeOBR.broadcast.sendMessage === 'function') {
      try {
        await activeOBR.broadcast.sendMessage(sheetSyncChannel, payload, { destination: 'ALL' });
      } catch (err) {
        console.warn('[OwlbearBridge] Erro ao solicitar fichas:', err);
      }
    }

    if (win && win.parent && typeof win.parent.postMessage === 'function') {
      try {
        win.parent.postMessage(payload, '*');
      } catch (err) {}
    }

    return payload;
  }

  function onReceiveSheet(callback) {
    if (typeof callback !== 'function') return () => {};
    setupWindowListener();
    sheetSubscribers.add(callback);
    return () => {
      sheetSubscribers.delete(callback);
    };
  }

  async function broadcastRoll(rollData) {
    const payload = formatRollPayload(rollData);
    const notification = formatNotification(payload);
    const dispatchedVia = [];
    const errors = [];

    // 1. Envio via window.parent.postMessage
    if (win && win.parent && typeof win.parent.postMessage === 'function') {
      try {
        win.parent.postMessage(payload, '*');
        dispatchedVia.push('postMessage');
      } catch (err) {
        errors.push({ target: 'postMessage', error: err });
      }
    }

    // 2. Envio via Owlbear SDK (Broadcast e Notificação de Toast na mesa)
    const activeOBR = obrInstance || (win && win.OBR ? win.OBR : null);
    if (activeOBR) {
      // Broadcast para todos os jogadores na sala
      if (activeOBR.broadcast && typeof activeOBR.broadcast.sendMessage === 'function') {
        try {
          await activeOBR.broadcast.sendMessage(channel, payload, { destination: 'ALL' });
          dispatchedVia.push('obr-broadcast');
        } catch (err) {
          errors.push({ target: 'obr-broadcast', error: err });
        }
      }

      // Notificação nativa no Owlbear Rodeo
      if (activeOBR.notification && typeof activeOBR.notification.show === 'function') {
        try {
          await activeOBR.notification.show(notification.message, notification.level);
          dispatchedVia.push('obr-notification');
        } catch (err) {
          errors.push({ target: 'obr-notification', error: err });
        }
      }
    }

    return {
      success: errors.length === 0,
      payload,
      notification,
      dispatchedVia,
      errors
    };
  }

  function onReceiveBroadcast(callback) {
    if (typeof callback !== 'function') return () => {};
    setupWindowListener();
    subscribers.add(callback);
    return () => {
      subscribers.delete(callback);
    };
  }

  function destroy() {
    subscribers.clear();
    sheetSubscribers.clear();
    if (typeof obrUnsubscribe === 'function') {
      obrUnsubscribe();
      obrUnsubscribe = null;
    }
    if (typeof obrSheetUnsubscribe === 'function') {
      obrSheetUnsubscribe();
      obrSheetUnsubscribe = null;
    }
  }

  return {
    get isReady() { return isReady; },
    get currentUser() { return currentUser; },
    get obrInstance() { return obrInstance; },
    detectEnvironment,
    init,
    broadcastRoll,
    onReceiveBroadcast,
    broadcastSheet,
    requestSheets,
    onReceiveSheet,
    getPlayerRole,
    getPlayerId,
    getPlayerName,
    waitForObrReady,
    destroy
  };
}

// Exportações globais para compatibilidade direta no navegador
if (typeof window !== 'undefined') {
  window.createOwlbearBridge = createOwlbearBridge;
  window.OwlbearBridge = createOwlbearBridge();
}
