# 01: Integração de Motor 3D Real com Colisão (@3d-dice/dice-box) e Purga de CSS Fake-3D

**What to build:** Eliminar o antigo botão flutuante expansível (FAB) e as transformações de CSS fake-3D que tornavam a estética artificial. No lugar, integrar o motor open-source `@3d-dice/dice-box` (Three.js + física Cannon-es) em um overlay transparente de tela inteira (`pointer-events: none` por padrão). Quando o jogador clica para rolar, os dados d6 são atirados em 3D de verdade, colidem uns com os outros e com os limites da tela com gravidade e inércia autênticas, e assentam de forma natural.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] O botão flutuante anterior (FAB) e as animações de CSS `rotateX`/`rotateY` estáticas foram completamente removidos da ficha.
- [x] A biblioteca `@3d-dice/dice-box` é carregada via ESM CDN com assetPath configurado e inicializada com sucesso.
- [x] O canvas de rolagem funciona em camada transparente sobre a ficha sem bloquear o clique nos campos ou leitura de texto.
- [x] Ao disparar uma rolagem de 1 a 6 dados d6, os dados são lançados no espaço 3D, colidem fisicamente entre si e com a mesa, e desaceleram com física realista.
- [x] Os dados possuem textura/estética gótica elegante (faces carmesim/ônix/douradas) compatível com o tema de Castlevania.

## Comments

- Antigo botão FAB flutuante e animações CSS 3D estáticas (`@keyframes diceTumble3D`, `.die-rolling`) foram purgados da ficha.
- Nova barra de ação compacta dock `.dice-action-dock` estilizada na paleta gótica (sangue carmesim, ônix e ouro) integrada de forma não-obstrutiva na base da tela.
- Overlay full-viewport transparente (`#dice-box-overlay`) com `pointer-events: none` por padrão implementado para não obstruir campos de texto ou pips interativos.
- Módulo `FractalRollSystem` (`js/fractal-roll-system.js`) implementado com suporte à inicialização assíncrona do `@3d-dice/dice-box` via ESM CDN, fallback matemático resiliente e ciclo de vida interativo dos ponteiros.
- Testes unitários com TDD implementados em `tests/fractal-roll-system.test.js` passando com 100% de sucesso (7 testes passando).
- Validação end-to-end em navegador real (Playwright) confirmando o carregamento dos assets WebGL/Wasm, rolagem de dados 3D autêntica, colisão e resolução correta.

