# 03: Ponte e Broadcast de Rolagens com Owlbear Rodeo (VTT Bridge)

**What to build:** Conectar as rolagens físicas 3D ao ecossistema do Owlbear Rodeo. Quando a ficha estiver rodando como extensão ou iframe no Owlbear Rodeo, o término da rolagem física emite uma notificação em tempo real para a sala virtual via Owlbear SDK (`OBR`) e `postMessage`, exibindo no chat/notificações da mesa o nome do personagem, natureza da ação, faces obtidas pelos dados 3D, desfecho e avisos de Ruptura para que o Arquiteto e os outros jogadores vejam na hora.

**Blocked by:** 02: Resolução de Regras Fractal (Sucesso, Ruptura, XP, Determinação) e Fallback Gracioso

**Status:** resolved

- [x] A ficha detecta se está rodando dentro do Owlbear Rodeo (`window.OBR` ou iframe).
- [x] Ao término da rolagem de dados 3D, uma mensagem estruturada é enviada para a sala do Owlbear contendo: nome do personagem, pool, resultados individuais dos dados, desfecho (Sucesso/Falha/Impulso) e status de Ruptura.
- [x] O layout da ficha é responsivo e funciona perfeitamente em painel lateral / popover do Owlbear sem barras de rolagem desnecessárias.
- [x] Um manifesto compatível com Owlbear Rodeo v2 (`manifest.json`) é disponibilizado para facilitar a instalação da ficha na sala do VTT.

## Comments

- Implementado o módulo `OwlbearBridge` (`js/owlbear-bridge.js`) para detecção automática de ambiente (`window.self !== window.top`, `window.OBR` e query params de VTT), formatação padronizada e broadcast bidirecional.
- O formato estruturado de evento `FRACTAL_CASTLEVANIA_ROLL` encapsula: nome do personagem, espécie/natureza, pool de dados, faces obtidas, desfecho categorizado (Sucesso, Impulso, Falha, Sucesso Milagroso), status de Ruptura de Fatos, consumo de Determinação e ganho de XP.
- Suporte simultâneo a `window.parent.postMessage` (resiliente e universal para iframes) e chamadas nativas do Owlbear Rodeo SDK (`OBR.broadcast.sendMessage` para todos na sala e `OBR.notification.show` com banners temáticos e níveis de severidade).
- Escuta ativa de eventos de mesa virtual: rolagens enviadas por outros jogadores exibem avisos no rodapé da ficha (`showToast`) sem interferir na rolagem local.
- O modo compacto `mode-vtt-compact` foi aprimorado com layout responsivo ajustado para contêineres de 400px–480px (popover/painel lateral do Owlbear), eliminando barras de rolagem horizontais e mantendo todos os campos acessíveis.
- Criado o arquivo `manifest.json` compatível com Owlbear Rodeo v2 (`manifest_version: 1`), com metadados, ícone e definição de ação com popover de 480x760.
- Bateria de 26 testes unitários com TDD automatizado em Node.js (`tests/fractal-roll-system.test.js` e `tests/owlbear-bridge.test.js`) cobrindo 100% dos cenários com sucesso.
- Teste end-to-end com Playwright e Edge (`.scratch/test-ticket-03.mjs`) validando a execução em sala virtual simulada, detecção de iframe, zero transbordamento horizontal, broadcast pós-rolagem e recepção de eventos de pares.
