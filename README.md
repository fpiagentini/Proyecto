# Guerra de Hormigas (p5.js)

Simulación interactiva de guerra entre colonias de hormigas (Negras vs Rojas) implementada en p5.js, con roles (Reina, Soldados, Excavadoras/Diggers), combate y generación procedural de túneles mediante autómatas celulares.

Basado en el proyecto original de p5.js Web Editor: [fpiagentini/sketches/iKlHhwmMn](https://editor.p5js.org/fpiagentini/sketches/iKlHhwmMn).

## Características
- **Pantalla Completa (Fullscreen)**: El lienzo se ajusta automáticamente al tamaño de la ventana (`windowWidth`, `windowHeight`).
- **Controles**:
  - `ESPACIO`: Regenera el mapa y reinicia la simulación.
  - `F`: Activa o desactiva la pantalla completa del navegador.
- **Roles en la Colonia**:
  - **Reina**: Unidad principal a defender o destruir.
  - **Soldados**: Forman escuadrones de asalto contra el nido rival y defienden a su reina.
  - **Excavadoras (Diggers)**: Abren túneles a través de las paredes de roca.

## Cómo ejecutar
Basta con abrir `index.html` en cualquier navegador web moderno, o iniciar un servidor local (por ejemplo con `python -m http.server` o la extensión Live Server de VS Code).
