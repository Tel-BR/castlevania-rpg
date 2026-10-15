# Spec: Rolador 3D com Física Real (Dice-Box Open Source) e Integração Owlbear Rodeo

Status: completed

## Problem Statement

A tentativa anterior de simulação de dados utilizando transformações manuais de CSS (`rotateX`, `rotateY`, `perspective`) resultou em uma estética tosca e visualmente artificial: os dados não colidiam entre si, não tinham peso nem física real e a interface flutuante (FAB) obstruía os elementos da ficha de personagem. 

Para que a experiência seja imersiva e prazerosa, os dados precisam ser objetos tridimensionais autênticos renderizados via WebGL com motor de física (Cannon-es / Three.js), com colisão mútua realista, ricochete nas bordas e temas visuais compatíveis com a estética gótica de Castlevania. Além disso, a rolagem deve ocorrer de maneira fluida e não invasiva (em overlay transparente sobre a tela ou bandeja dedicada), reportando os resultados para o sistema Fractal RPG (Sucessos, Impulsos, Rupturas e XP) e conectando-se ao ecossistema de mesas virtuais do Owlbear Rodeo.

## Solution

1. **Adoção de Biblioteca Open-Source Consagrada (`@3d-dice/dice-box`)**:
   - Integrar a biblioteca open-source `@3d-dice/dice-box` (Three.js + Cannon-es physics worker).
   - Renderização 3D real via WebGL com iluminação dinâmica, sombras, quique e colisão realista entre múltiplos dados d6.
   - Personalização temática gótica: faces e texturas temáticas (sangue carmesim, ônix gótico e detalhes em ouro).

2. **Overlay Não-Obstrutivo & Disparo Ágil**:
   - Eliminar o botão flutuante intrusivo e o painel expansível pesado.
   - O canvas 3D opera em uma camada transparente com `pointer-events: none` por padrão, ativando-se apenas durante a rolagem e sumindo suavemente após os dados repousarem.
   - A Parada de Dados é disparada diretamente por uma barra de ação compacta na ficha (1d6 base + Fato aplicável + Determinação opcional).

3. **Resolução de Regras Fractal no Callback de Física**:
   - No evento `onRollComplete`, os valores reais calculados pelo motor de física são lidos e processados pelo sistema:
     - Maior dado: 5-6 (Sucesso), múltiplos 6s (Impulso/Crítico), 1-4 (Falha).
     - Ruptura: qualquer dado que mostre 1 aciona o aviso visual de Ruptura de Fato.
     - Aprendizado com a Falha: falha (1 a 4) adiciona automaticamente +1 ponto de XP.
     - Determinação: consome 1 ponto da reserva de Espírito ou Sangue (com verificação de saldo).

4. **Integração com Owlbear Rodeo (VTT Bridge)**:
   - Emissão de eventos estruturados via `postMessage` e compatibilidade com Owlbear Rodeo SDK (`window.OBR`).
   - O Arquiteto e outros jogadores recebem o resultado da rolagem no chat/notificações da sala do Owlbear Rodeo com o nome do personagem, pool de dados, faces físicas obtidas e desfecho narrativo.

5. **Resiliência Offline / Fallback Gracioso**:
   - Caso a máquina do jogador esteja offline ou em ambiente com restrição de WebGL, o sistema aciona um fallback instantâneo que resolve os dados matematicamente sem travar a interface.

## User Stories

1. As a player, I want dice to look and behave like real 3D objects with physical collisions and bounces, so that rolling dice in the sheet feels tangible, tactile, and satisfying.
2. As a player, I want multiple dice to collide with one another and the tray boundaries, so that the physics simulation looks natural and unscripted.
3. As a player, I want gothic-themed dice colors (crimson, obsidian, antique bone), so that the dice aesthetic matches the Castlevania dark gothic fantasy tone.
4. As a player, I want the dice canvas to stay completely out of the way of my character sheet when not rolling, so that my stats, facts, and notes are never obstructed.
5. As a player, I want to compose my action dice pool quickly with base d6, facts, and determination, so that preparing a roll takes only a couple of seconds.
6. As a player, I want Determination to automatically deduct 1 Spirit or Blood point from my reserves only when the roll is confirmed, preventing invalid rolls when my pool is depleted.
7. As a player, I want to clearly see when a 1 is rolled so I know an active Fact has suffered a Rupture and requires immediate narrative attention.
8. As a player, I want any failure roll (highest die 1 to 4) to automatically add +1 XP to my sheet, so that character progression through failure is handled seamlessly.
9. As a Game Master (Architect) in an Owlbear Rodeo room, I want the results of the 3D roll to broadcast to the room chat/notification stream, so that I don't have to ask the player what they rolled.
10. As a player, I want the sheet to function reliably even if WebGL is disabled or the network is slow, falling back to instant calculation without throwing errors.

## Implementation Decisions

- **Physics Engine**: Use `@3d-dice/dice-box` loaded via ESM CDN (`https://cdn.jsdelivr.net/npm/@3d-dice/dice-box@1/dist/dice-box.es.js`) with dynamic fallback to instant random math if CDN/WebGL is unavailable.
- **Canvas Lifecycle**: A full-viewport transparent canvas overlay (`#dice-box-canvas`) that activates `pointer-events: auto` only during active rolling/dragging and fades back to `pointer-events: none` 3 seconds after dice settle.
- **Seam Definition (`FractalRollSystem`)**:
  - `FractalRollSystem.roll({ count, nature, useDetermination, characterName })`
  - Encapsulates physics execution, reserve deduction, rule resolution (success/failure/rupture/XP), and Owlbear broadcast.
- **Owlbear Event Contract**:
  - Broadcast via `window.parent.postMessage({ type: 'FRACTAL_CASTLEVANIA_ROLL', ... }, '*')` and `OBR.notification` if running within an Owlbear Rodeo room.
- **Theme Configuration**: Dark theme uses obsidian/gold dice; Light theme uses aged parchment/crimson dice.

## Testing Decisions

- **Seam Testing**: Test `FractalRollSystem` by mocking the `DiceBox.roll()` promise response (`[{ value: 6 }, { value: 1 }]`) and verifying:
  - Highest value identification (`6` = Sucesso).
  - Rupture flag (`true` because a `1` was present).
  - XP increment (not triggered on 6, triggered on highest <= 4).
  - Determination debit (Reserve -1).
- **Fallback Verification**: Verify that when `DiceBox` fails to initialize (e.g. mock error), the fallback mathematically generates random d6s and processes identical rule logic without UI crash.
- **OWlbear Message Verification**: Verify `postMessage` payload schema conforms to expected VTT broadcast structure.

## Out of Scope

- Writing a custom physics engine from scratch (we explicitly leverage `@3d-dice/dice-box`).
- Modifying the core Fractal RPG rulebook formulas.
- Storing roll logs in a remote persistent database (rolls are local and broadcast to the current live session).

## Further Notes

- By adopting `@3d-dice/dice-box`, we avoid the fragile, manual CSS transformations that caused the visual ugliness, replacing them with production-grade Cannon-es physics, realistic inertia, and authentic 3D dice meshes.
