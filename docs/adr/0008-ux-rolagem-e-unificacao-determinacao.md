# 0008. Redesenho de UX da Rolagem, Unificação de Determinação e Compatibilidade VTT

> Status: Accepted

Decidimos reformular a experiência do usuário (UX) e o design visual da ficha de personagem em HTML, eliminando redundâncias mecânicas críticas e preparando o sistema para mesas virtuais.

## 1. Contexto e Motivação
A versão anterior apresentava:
- **Redundância Tripla de Determinação**: Aparecia como botão de ação na Reserva, como slot genérico na lista de "Poderes de Raça" e como checkbox no rolador de dados.
- **Descompasso de Rolagem**: Checkboxes em cada Fato competiam com botões de quantidade de dados no painel flutuante, gerando atrito cognitivo.
- **Resolução Manual de Ruptura**: Resultados 1 apenas emitiam avisos de texto passivos, sem facilitar a marcação do Fato quebrado.
- **Poluição Visual no Rodapé**: Painel flutuante largo que cobria campos da ficha e animação 2D básica de dados.

## 2. Decisões de Design (Modo Operate & Impeccable)
1. **Unificação da Determinação**:
   - Removida dos slots de Poderes de Raça, liberando os 3 slots exclusivamente para poderes sobrenaturais e técnicas autênticas.
   - Definida como uso de regra universal do sistema (gastando 1 ponto de Espírito ou Sangue).
2. **Card de Espírito / Sangue Ultralimpo**:
   - Removida a grade de botões redundantes. O card opera no formato ultralimpo, centralizado nos pips interativos clicáveis e no indicador numérico.
3. **Fatos da Ficha Despoluídos**:
   - Removidos os checkboxes `[ ] Rolar (+1d6)` de todos os Fatos, deixando a lista mais limpa, legível e focada na narrativa, preservando apenas o botão `⚡ Ruptura`.
4. **Rolador em Cápsula Flutuante Compacta com Dados 3D**:
   - Ancorado no canto inferior direito, recolhível para um botão circular (FAB) com ícone de d6 dourado.
   - Efeito visual de rolagem em **3D com tumble e física** de queda em multi-eixos.
   - Resolução assistida de **Ruptura** (dado 1): exibe chips/botões com os nomes dos Fatos ativos da ficha para quebrar o fato com 1 clique imediato.
   - Soma de **+1 XP automática em caso de Falha** (1 a 4) com badge visual de aprendizado.
5. **Identidade Visual e Texturas Autênticas**:
   - Logo oficial de Castlevania reposicionado à esquerda no topo, ampliado e imponente, sem o ícone avulso redundante.
   - Texturas seamless procedurais offline (Ardósia/Pedra gótica no tema escuro e Pergaminho envelhecido no tema claro) via SVG procedural data-URI (zero dependências de rede).
6. **Pronto para Owlbear Rodeo (VTT Ready)**:
   - Emissão de eventos `window.parent.postMessage` para transmissão de rolagens para salas virtuais do Owlbear Rodeo.
   - Modo de layout VTT Compacto otimizado para iframes e popovers de VTTs.
