# 02: Resolução de Regras Fractal (Sucesso, Ruptura, XP, Determinação) e Fallback Gracioso

**What to build:** Conectar o callback de finalização da rolagem física (`Box.onRollComplete`) às regras do sistema Fractal RPG. Quando os dados 3D assentam na mesa, o sistema extrai as faces físicas e exibe um banner estético limpo informando o resultado: se houve Sucesso (5 ou 6), Impulso (múltiplos 6s), Ruptura (face 1 presente) ou Falha (+1 XP automático). Se o jogador usou Determinação, desconta 1 ponto da reserva de Espírito ou Sangue. Caso a máquina esteja offline ou sem suporte WebGL, o sistema executa um fallback instantâneo sem quebrar a ficha.

**Blocked by:** 01: Integração de Motor 3D Real com Colisão (@3d-dice/dice-box) e Purga de CSS Fake-3D

**Status:** resolved

- [x] A Seam unificada processa os resultados exatos dos dados 3D quando a física assenta.
- [x] O maior dado define o desfecho: 5 ou 6 é Sucesso; dois ou mais 6s destacam Impulso / Crítico dramático.
- [x] Qualquer dado que termine com a face 1 exibe o alerta de Ruptura de Fato de forma destacada e temática.
- [x] Rolagens de 1 a 4 (sem sucessos) creditam automaticamente +1 ponto de XP na ficha do personagem com feedback discreto.
- [x] A ativação de Determinação consome 1 ponto da reserva correta (Espírito para Humanos, Sangue para Dhampiros/Vampiros) e impede o gasto se a reserva estiver zerada.
- [x] Em caso de falha de carregamento do WebGL/CDN ou modo offline, um fallback matemático leve resolve a rolagem instantaneamente e mantém todas as regras em pleno funcionamento.

## Comments

- Implementada a função universal `resolveFractalRules` em `js/fractal-roll-system.js` e integrada na ficha `ficha-castlevania.html` e `fichas/ficha-castlevania.html`.
- Resolução exata de Sucesso (5 ou 6), Impulso dramático (dois ou mais 6s), Falha (1 a 4 com +1 XP automático creditado na ficha) e Sucesso Milagroso (apenas 6 puro quando em modo Sem Fatos / Desespero).
- Alerta visual temático de Ruptura quando qualquer dado repousa na face 1, com renderização de chips interativos dos Fatos ativos (`🩸 Quebrar: [Nome do Fato]`) para quebra assistida em um clique.
- Determinação unificada: validação preventiva que bloqueia o gasto se a Reserva (Espírito para Humanos, Sangue para Dhampiros/Vampiros) estiver zerada ou em rolagens sem Fatos aplicáveis, debitando automaticamente 1 ponto ao confirmar a rolagem e resetando a seleção.
- Fallback gracioso: quando WebGL/CDN falha ou está offline, a geração matemática de d6 preserva rigorosamente todas as regras do Fractal RPG sem quebrar a interface.
- 17 testes unitários automatizados cobrindo todos os casos em `tests/fractal-roll-system.test.js` passando com 100% de sucesso.
- Testes end-to-end em navegador real (Playwright / Edge) em `.scratch/test-ticket-02.mjs` validando toda a reatividade visual, dedução de reservas, banners e persistência.
