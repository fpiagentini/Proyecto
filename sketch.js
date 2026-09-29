let cols, rows;
let cellSize = 10;
let grid = [];
let generation = 0;
let maxGenerations = 5;
let frameCounter = 0;
let stepInterval = 15;
let fillProbability = 0.45;
let isGenerating = true;

// --- Guerra de hormigas con roles ---
let colonies = [];
let warRunning = false;
let winner = null;
let battleMarks = [];
let raidMarks = [];
let totalKills = { negras: 0, rojas: 0 };

const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];

// Parámetros de IA
let visionRadius = 9;
let patrolRadius = 12;
let scareRadius = 4;
let digChance = 0.05;
let numDiggers = 16;
let numSoldiers = 12;
let bias = 5; // qué tanto pesa acercarse al objetivo vs moverse random

let raidInterval = 240;
let raidSize = 4;

function setup() {
  createCanvas(windowWidth, windowHeight);
  cols = floor(width / cellSize);
  rows = floor(height / cellSize);
  initGrid();
}

function initGrid() {
  grid = [];
  for (let x = 0; x < cols; x++) {
    grid[x] = [];
    for (let y = 0; y < rows; y++) {
      if (x === 0 || x === cols - 1 || y === 0 || y === rows - 1) {
        grid[x][y] = 1;
      } else {
        grid[x][y] = random() < fillProbability ? 1 : 0;
      }
    }
  }
  generation = 0;
  isGenerating = true;
  frameCounter = 0;
  warRunning = false;
  winner = null;
  battleMarks = [];
  raidMarks = [];
  totalKills = { negras: 0, rojas: 0 };
}

function countWallNeighbors(x, y) {
  let count = 0;
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      if (i === 0 && j === 0) continue;
      let nx = x + i, ny = y + j;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) count++;
      else count += grid[nx][ny];
    }
  }
  return count;
}

function stepAutomaton() {
  let newGrid = [];
  for (let x = 0; x < cols; x++) {
    newGrid[x] = [];
    for (let y = 0; y < rows; y++) {
      if (x === 0 || x === cols - 1 || y === 0 || y === rows - 1) {
        newGrid[x][y] = 1;
        continue;
      }
      let wallCount = countWallNeighbors(x, y);
      if (wallCount > 4) newGrid[x][y] = 1;
      else if (wallCount < 4) newGrid[x][y] = 0;
      else newGrid[x][y] = grid[x][y];
    }
  }
  grid = newGrid;
  generation++;
}

// ---------- SETUP DE LA GUERRA ----------

function findOpenCellNear(px, py) {
  for (let r = 0; r < max(cols, rows); r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        let x = px + dx, y = py + dy;
        if (x > 0 && x < cols - 1 && y > 0 && y < rows - 1 && grid[x][y] === 0) {
          return { x: x, y: y };
        }
      }
    }
  }
  return { x: 1, y: 1 };
}

function manhattan(x1, y1, x2, y2) {
  return abs(x1 - x2) + abs(y1 - y2);
}

function makeAnt(role, pos) {
  let hp, dmg;
  if (role === "queen") { hp = 15; dmg = 2; }
  else if (role === "soldier") { hp = 3; dmg = 1; }
  else { hp = 1; dmg = 0; }

  return {
    x: pos.x, y: pos.y, role: role, hp: hp, maxHp: hp, dmg: dmg,
    visited: [], mode: "defend"
  };
}

function makeColony(name, nestPos, col) {
  let colony = { name: name, color: col, nest: nestPos, enemy: null, ants: [], raidTimer: 0 };
  colony.ants.push(makeAnt("queen", nestPos));
  for (let i = 0; i < numSoldiers; i++) colony.ants.push(makeAnt("soldier", nestPos));
  for (let i = 0; i < numDiggers; i++) colony.ants.push(makeAnt("digger", nestPos));
  return colony;
}

function setupWar() {
  let nestA = findOpenCellNear(2, 2);
  let nestB = findOpenCellNear(cols - 3, rows - 3);

  let negras = makeColony("negras", nestA, color(235, 235, 235));
  let rojas = makeColony("rojas", nestB, color(255, 70, 60));
  negras.enemy = rojas;
  rojas.enemy = negras;
  colonies = [negras, rojas];
  warRunning = true;
  winner = null;
}

function getOpenNeighbors(x, y) {
  let neighbors = [];
  for (let d = 0; d < DIRS.length; d++) {
    let nx = x + DIRS[d][0];
    let ny = y + DIRS[d][1];
    if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && grid[nx][ny] === 0) {
      neighbors.push({ x: nx, y: ny });
    }
  }
  return neighbors;
}

function getWallNeighbors(x, y) {
  let neighbors = [];
  for (let d = 0; d < DIRS.length; d++) {
    let nx = x + DIRS[d][0];
    let ny = y + DIRS[d][1];
    if (nx > 0 && nx < cols - 1 && ny > 0 && ny < rows - 1 && grid[nx][ny] === 1) {
      neighbors.push({ x: nx, y: ny });
    }
  }
  return neighbors;
}

function pickFarthestFrom(options, tx, ty) {
  let best = options[0];
  let bestDist = manhattan(best.x, best.y, tx, ty);
  for (let i = 1; i < options.length; i++) {
    let d = manhattan(options[i].x, options[i].y, tx, ty);
    if (d > bestDist) { bestDist = d; best = options[i]; }
  }
  return best;
}

function findNearestEnemy(ant, enemyAnts, radius) {
  let nearest = null;
  let bestDist = radius + 1;
  for (let i = 0; i < enemyAnts.length; i++) {
    let e = enemyAnts[i];
    let d = manhattan(ant.x, ant.y, e.x, e.y);
    if (d <= radius && d < bestDist) { bestDist = d; nearest = e; }
  }
  return nearest;
}

// Movimiento probabilístico con sesgo hacia un objetivo (tx,ty) y memoria anti-loop.
// Esto reemplaza al greedy determinístico que causaba el rebote infinito A<->B.
function stepToward(ant, tx, ty, digProb) {
  let openNeighbors = getOpenNeighbors(ant.x, ant.y);

  if (openNeighbors.length === 0 || random() < digProb) {
    let wallNeighbors = getWallNeighbors(ant.x, ant.y);
    if (wallNeighbors.length > 0) {
      let dug = tx !== null ? pickBiasedClosest(wallNeighbors, tx, ty) : random(wallNeighbors);
      grid[dug.x][dug.y] = 0;
      ant.x = dug.x; ant.y = dug.y;
      ant.visited.push(dug.x + "," + dug.y);
      if (ant.visited.length > 10) ant.visited.shift();
      return;
    }
  }

  if (openNeighbors.length === 0) return;

  let unvisited = openNeighbors.filter(function(n) {
    return ant.visited.indexOf(n.x + "," + n.y) === -1;
  });
  let options = unvisited.length > 0 ? unvisited : openNeighbors;

  let currentDist = tx !== null ? manhattan(ant.x, ant.y, tx, ty) : 0;
  let weights = [];
  for (let i = 0; i < options.length; i++) {
    let w = 1;
    if (tx !== null) {
      let nd = manhattan(options[i].x, options[i].y, tx, ty);
      if (nd < currentDist) w += bias;
    }
    weights.push(w);
  }
  let total = weights.reduce(function(a, b) { return a + b; }, 0);
  let r = random(total);
  let acc = 0;
  let chosen = options[0];
  for (let i = 0; i < options.length; i++) {
    acc += weights[i];
    if (r <= acc) { chosen = options[i]; break; }
  }

  ant.x = chosen.x;
  ant.y = chosen.y;
  ant.visited.push(chosen.x + "," + chosen.y);
  if (ant.visited.length > 10) ant.visited.shift();
}

function pickBiasedClosest(options, tx, ty) {
  let best = options[0];
  let bestDist = manhattan(best.x, best.y, tx, ty);
  for (let i = 1; i < options.length; i++) {
    let d = manhattan(options[i].x, options[i].y, tx, ty);
    if (d < bestDist) { bestDist = d; best = options[i]; }
  }
  return best;
}

// ---------- FORMACIÓN DE ESCUADRONES ----------

function formRaidSquad(colony) {
  let candidates = [];
  for (let i = 0; i < colony.ants.length; i++) {
    let a = colony.ants[i];
    if (a.role === "soldier" && a.mode === "defend") candidates.push(a);
  }
  if (candidates.length < 3) return;

  let squadCount = min(raidSize, floor(candidates.length / 2));
  for (let i = 0; i < squadCount; i++) {
    let idx = floor(random(candidates.length));
    candidates[idx].mode = "raid";
    candidates[idx].visited = [];
    candidates.splice(idx, 1);
  }
  raidMarks.push({ x: colony.nest.x, y: colony.nest.y, life: 30, color: colony.color });
}

function moveAnt(ant, colony, enemyAnts) {
  if (ant.role === "queen") return;

  if (ant.role === "soldier") {
    let target = findNearestEnemy(ant, enemyAnts, visionRadius);

    if (target) {
      stepToward(ant, target.x, target.y, 0.15);
      return;
    }

    if (ant.mode === "raid") {
      stepToward(ant, colony.enemy.nest.x, colony.enemy.nest.y, 0.08);
      return;
    }

    // modo defensa: patrulla libre pero sin alejarse del nido
    let distNest = manhattan(ant.x, ant.y, colony.nest.x, colony.nest.y);
    if (distNest > patrolRadius) {
      stepToward(ant, colony.nest.x, colony.nest.y, 0.03);
    } else {
      stepToward(ant, null, null, 0.02); // deambula random cerca del nido
    }
    return;
  }

  // ---- digger ----
  let threat = findNearestEnemy(ant, enemyAnts, scareRadius);
  if (threat) {
    let openNeighbors = getOpenNeighbors(ant.x, ant.y);
    if (openNeighbors.length > 0) {
      let chosen = pickFarthestFrom(openNeighbors, threat.x, threat.y);
      ant.x = chosen.x; ant.y = chosen.y;
      return;
    }
  }
  stepToward(ant, null, null, digChance);
}

// ---------- COMBATE ----------

function resolveCombat() {
  let negras = colonies[0];
  let rojas = colonies[1];

  let dmgNegras = [];
  for (let i = 0; i < negras.ants.length; i++) dmgNegras.push(0);
  let dmgRojas = [];
  for (let j = 0; j < rojas.ants.length; j++) dmgRojas.push(0);

  for (let i = 0; i < negras.ants.length; i++) {
    let a = negras.ants[i];
    for (let j = 0; j < rojas.ants.length; j++) {
      let b = rojas.ants[j];
      if (manhattan(a.x, a.y, b.x, b.y) <= 1) {
        dmgRojas[j] += a.dmg;
        dmgNegras[i] += b.dmg;
        battleMarks.push({ x: b.x, y: b.y, life: 15 });
      }
    }
  }

  for (let i = 0; i < negras.ants.length; i++) negras.ants[i].hp -= dmgNegras[i];
  for (let j = 0; j < rojas.ants.length; j++) rojas.ants[j].hp -= dmgRojas[j];

  negras.ants = negras.ants.filter(function(a) {
    if (a.hp <= 0) { if (a.role !== "digger") totalKills.rojas++; return false; }
    return true;
  });
  rojas.ants = rojas.ants.filter(function(a) {
    if (a.hp <= 0) { if (a.role !== "digger") totalKills.negras++; return false; }
    return true;
  });

  if (!winner) {
    let queenNegrasAlive = false, queenRojasAlive = false;
    for (let i = 0; i < negras.ants.length; i++) if (negras.ants[i].role === "queen") queenNegrasAlive = true;
    for (let j = 0; j < rojas.ants.length; j++) if (rojas.ants[j].role === "queen") queenRojasAlive = true;

    if (!queenNegrasAlive && !queenRojasAlive) winner = "empate";
    else if (!queenNegrasAlive) winner = "rojas";
    else if (!queenRojasAlive) winner = "negras";
  }
}

// ---------- DRAW ----------

function draw() {
  background(20);

  noStroke();
  fill(65, 55, 45);
  rect(0, 0, cols * cellSize, rows * cellSize);
  fill(40, 40, 60);
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      if (grid[x][y] === 1) {
        rect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
  }

  if (isGenerating) {
    frameCounter++;
    if (frameCounter >= stepInterval) {
      frameCounter = 0;
      if (generation < maxGenerations) stepAutomaton();
      else { isGenerating = false; setupWar(); }
    }
  } else if (warRunning) {
    if (!winner) {
      let negras = colonies[0], rojas = colonies[1];

      negras.raidTimer++;
      rojas.raidTimer++;
      if (negras.raidTimer >= raidInterval) { negras.raidTimer = 0; formRaidSquad(negras); }
      if (rojas.raidTimer >= raidInterval) { rojas.raidTimer = 0; formRaidSquad(rojas); }

      for (let i = 0; i < negras.ants.length; i++) moveAnt(negras.ants[i], negras, rojas.ants);
      for (let j = 0; j < rojas.ants.length; j++) moveAnt(rojas.ants[j], rojas, negras.ants);
      resolveCombat();
    }

    noStroke();
    for (let m = 0; m < battleMarks.length; m++) {
      let mk = battleMarks[m];
      fill(255, 200, 0, map(mk.life, 0, 15, 0, 255));
      circle(mk.x * cellSize + cellSize / 2, mk.y * cellSize + cellSize / 2, cellSize * 1.8);
      mk.life--;
    }
    battleMarks = battleMarks.filter(function(m) { return m.life > 0; });

    noFill();
    strokeWeight(2);
    for (let r = 0; r < raidMarks.length; r++) {
      let rm = raidMarks[r];
      stroke(red(rm.color), green(rm.color), blue(rm.color), map(rm.life, 0, 30, 0, 255));
      circle(rm.x * cellSize + cellSize / 2, rm.y * cellSize + cellSize / 2, (30 - rm.life) * 3);
      rm.life--;
    }
    raidMarks = raidMarks.filter(function(r) { return r.life > 0; });
    noStroke();

    for (let c = 0; c < colonies.length; c++) {
      let colony = colonies[c];
      for (let i = 0; i < colony.ants.length; i++) {
        let ant = colony.ants[i];
        let cx = ant.x * cellSize + cellSize / 2;
        let cy = ant.y * cellSize + cellSize / 2;

        if (ant.role === "queen") {
          stroke(255, 220, 0);
          strokeWeight(2);
          fill(colony.color);
          circle(cx, cy, cellSize * 1.6);
          noStroke();
        } else if (ant.role === "soldier") {
          if (ant.mode === "raid") {
            stroke(255, 220, 0);
            strokeWeight(1.5);
          } else {
            stroke(0);
            strokeWeight(1);
          }
          fill(colony.color);
          circle(cx, cy, cellSize * 0.9);
          noStroke();
        } else {
          noStroke();
          fill(red(colony.color), green(colony.color), blue(colony.color), 140);
          circle(cx, cy, cellSize * 0.4);
        }
      }
    }

    noFill();
    strokeWeight(2);
    for (let c = 0; c < colonies.length; c++) {
      let colony = colonies[c];
      stroke(colony.color);
      circle(colony.nest.x * cellSize + cellSize / 2, colony.nest.y * cellSize + cellSize / 2, cellSize * 2.2);
    }
    noStroke();
  }

  // HUD
  fill(255);
  textSize(13);
  textAlign(LEFT, TOP);
  if (isGenerating) {
    text(`Generación del autómata: ${generation}/${maxGenerations}`, 10, 10);
  } else if (warRunning) {
    let negras = colonies[0], rojas = colonies[1];
    let queenN = null, queenR = null;
    let raidN = 0, raidR = 0;
    for (let i = 0; i < negras.ants.length; i++) {
      if (negras.ants[i].role === "queen") queenN = negras.ants[i];
      if (negras.ants[i].role === "soldier" && negras.ants[i].mode === "raid") raidN++;
    }
    for (let j = 0; j < rojas.ants.length; j++) {
      if (rojas.ants[j].role === "queen") queenR = rojas.ants[j];
      if (rojas.ants[j].role === "soldier" && rojas.ants[j].mode === "raid") raidR++;
    }

    fill(230, 230, 230);
    text(`NEGRAS — Reina: ${queenN ? queenN.hp + "/" + queenN.maxHp + " HP" : "MUERTA"} | vivas: ${negras.ants.length} | en escuadrón: ${raidN} | bajas causadas: ${totalKills.negras}`, 10, 10);
    fill(255, 70, 60);
    text(`ROJAS — Reina: ${queenR ? queenR.hp + "/" + queenR.maxHp + " HP" : "MUERTA"} | vivas: ${rojas.ants.length} | en escuadrón: ${raidR} | bajas causadas: ${totalKills.rojas}`, 10, 28);

    if (winner) {
      textAlign(CENTER, CENTER);
      textSize(28);
      if (winner === "empate") {
        fill(255);
        text("AMBAS REINAS CAYERON", width / 2, height / 2);
      } else {
        fill(winner === "negras" ? color(235, 235, 235) : color(255, 70, 60));
        text("¡CAYÓ LA REINA " + (winner === "negras" ? "ROJA" : "NEGRA") + "! GANARON LAS " + winner.toUpperCase(), width / 2, height / 2);
      }
      textAlign(LEFT, TOP);
      textSize(13);
    }
  }
  fill(255);
  text("ESPACIO = regenerar todo | F = pantalla completa", 10, height - 20);
}

function keyPressed() {
  if (key === ' ') {
    initGrid();
  } else if (key === 'f' || key === 'F') {
    let fs = fullscreen();
    fullscreen(!fs);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  cols = floor(width / cellSize);
  rows = floor(height / cellSize);
  initGrid();
}