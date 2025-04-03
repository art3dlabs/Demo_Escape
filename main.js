// START OF FILE main.js (Restored and Corrected)

import * as THREE from "three";
// Import PointerLockControls desde addons
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

// Importar todos los módulos necesarios
import {
  createScene,
  createCamera,
  createRenderer,
  setupLighting,
  setupRoomObjects,
  createExitDoor,
  getRoomSize // Necesario para playerControls
} from "./sceneSetup.js";
import {
  setupPointerLockControls,
  updatePlayerMovement,
  addCollisionObject, // Necesario para sceneSetup
  clearCollisionObjects // Necesario para limpieza
} from "./playerControls.js";
import {
  checkHoverInteraction,
  handleInteraction,
  getHeldObject,
  getHoveredObject,
  clearHoveredObject,
  addInteractableObject, // Necesario para sceneSetup/puzzles
  clearInteractableObjects, // Necesario para limpieza
  placeHeldObject // Necesario para limpieza
} from "./interaction.js";
import {
  updateHUD,
  setupUIEventListeners,
  showOverlay,
  hideOverlay, // Podría usarse internamente
  getDifficultyValue,
  updateMenuPuzzleCountDisplay,
  updatePuzzlesTotalUI,
  setInitialUIState,
  getUIElement // Necesario para mensajes de error
} from "./ui.js";
import {
  setupPuzzles,
  selectPuzzles,
  cleanupPuzzles,
  getActivePuzzlesCount,
  getSolvedPuzzlesCount,
  markPuzzleSolved,
  // Imports específicos de puzzles si son llamados desde aquí
  getPuzzleDefinition,
  getActivePuzzles,
} from "./puzzles.js";
import {
    startTimer,
    stopTimer,
    isTimerRunning,
    getFormattedTime // Usado por HUD
} from "./timer.js";
import {
    setupAudio,
    playSound,
    stopSound
} from "./audio.js";
import { // Imports necesarios para limpieza en startGame/reset
    deselectItem,
    clearInventory
} from './inventory.js';


// --- Constants & Global Variables ---
export const GAME_STATES = {
  MENU: "menu",
  PLAYING: "playing",
  PAUSED: "paused",
  PUZZLE: "puzzle",
  PUZZLE_2D: "puzzle_2d",
  INVENTORY: "inventory",
  VICTORY: "victory",
  MINIGAME: "minigame",
  GAMEOVER_TIMEUP: "gameover_timeup",
  HELP_CONFIRM: "help_confirm",
};
export const PLAYER_HEIGHT = 1.8;
export const INTERACTION_DISTANCE = 2.8;
export const HOVER_CHECK_INTERVAL = 120; // ms

let scene, camera, renderer, controls, clock;
let gameState = GAME_STATES.MENU;
let animationFrameId = null;
let lastHoverCheckTime = 0;
let ignoreNextUnlockFlag = false; // <<< --- ESTA ES LA CORRECTA, MANTENER ---
let hintsEnabled = false;
let ignoreInitialUnlock = false; // <<< --- ESTA ES LA NUEVA, MANTENER ---

// --- Initialization ---
function init() {
  console.log("Escape Room Modular - v3.0 Init");

  // Basic Setup
  scene = createScene();
  camera = createCamera();
  renderer = createRenderer();
  document.body.appendChild(renderer.domElement);
  clock = new THREE.Clock();

  // Lighting & Static Scene
  setupLighting(scene);
  setupRoomObjects(scene);
  createExitDoor(scene);

  // Player Controls
  controls = setupPointerLockControls(camera, document.body);
  console.log("Valor de controls después de setup:", controls); // <<< AÑADIR ESTE LOG
  if (!controls) { // <<< AÑADIR ESTA VERIFICACIÓN
      throw new Error("setupPointerLockControls devolvió undefined!");
  }
  scene.add(controls.getObject()); // Esta línea ahora está después de la verificación

  controls.getObject().position.set(0, PLAYER_HEIGHT, 5); // Empezar a la altura de los ojos
  controls.getObject().rotation.set(0, 0, 0);


  // Audio Setup
  setupAudio(camera);

  // UI Listeners
  setupUIEventListeners();

  // Set Initial State
  setInitialUIState();

  // Start Animation Loop
  animate();
  console.log("Initialization Complete.");
}

// --- Game Loop ---
function animate() {
  animationFrameId = requestAnimationFrame(animate);
  if (!clock || !renderer || !scene || !camera) {
    console.error("Animation loop cancelled - core missing.");
    cancelAnimationFrame(animationFrameId);
    return;
  }
  const delta = Math.min(0.05, clock.getDelta());
  const currentTime = performance.now();

  // Timer se actualiza solo

  // Update Player Movement (if playing and controls are enabled)
  if (
    controls &&
    gameState === GAME_STATES.PLAYING // Mover solo si estamos en PLAYING
    // La comprobación interna de updatePlayerMovement usará controls.enabled (isLocked)
  ) {
    updatePlayerMovement(delta, controls, scene);
  }

  // Check Interactions (only when playing and locked)
  if (gameState === GAME_STATES.PLAYING && controls?.isLocked) {
    if (currentTime - lastHoverCheckTime >= HOVER_CHECK_INTERVAL) {
      checkHoverInteraction(camera, scene);
      lastHoverCheckTime = currentTime;
    }
     // Actualizar posición del objeto sostenido si existe
     const held = getHeldObject();
     if (held && held.parent === camera) { // Asegurarse que está adjunto a la cámara
         // interaction.js debería tener una función para esto o hacerla aquí
         // Ejemplo:
         // held.position.set(HOLD_OFFSET_RIGHT, -HOLD_OFFSET_DOWN, -HOLD_DISTANCE);
         // held.rotation.set(0,0,0); // O alinear con cámara si se desea
         // Si interaction.js no exporta una función para esto, la lógica va aquí.
         // Por simplicidad, asumimos que updateHeldObjectPosition se llama internamente
         // o no es estrictamente necesaria en cada frame.
     }
  } else if (getHoveredObject()) {
    clearHoveredObject();
  }

  // Render Scene
  try {
    renderer.render(scene, camera);
  } catch (e) {
    console.error("Render error:", e);
    cancelAnimationFrame(animationFrameId);
    try {
        setGameState(GAME_STATES.MENU); // Intentar volver al menú
        const instructions = getUIElement("instructions");
        if (instructions)
        instructions.innerHTML = `<h1>Render Error</h1><p>Error durante el renderizado.</p><p>${e.message}</p><span id="restartButtonError" style="font-size: 20px; cursor: pointer; color: #ffdd57;">Reiniciar Juego</span>`;
        const restartBtn = document.getElementById("restartButtonError");
        if(restartBtn) restartBtn.addEventListener('click', resetGame);
    } catch (recoveryError) {
        console.error("Error during error recovery:", recoveryError);
        alert(`Error Crítico de Renderizado:\n${e.message}\n\nPor favor, recarga la página.`);
    }
  }
}

// --- Game State Management ---
export function getGameState() {
  return gameState;
}

export function setGameState(newState) {
  if (gameState === newState) return;
  const previousState = gameState;
  gameState = newState;
  console.log(`State changed: ${previousState} -> ${newState}`);

  document.body.className = "";
  document.body.classList.add(`state-${newState}`);

  // Mostrar overlay correspondiente (ui.js se encarga)
  showOverlay(newState);

  // Manejo de Pointer Lock
  const shouldBeLocked = newState === GAME_STATES.PLAYING;
  const currentlyLocked = controls?.isLocked;

  try {
    if (!shouldBeLocked && currentlyLocked) {
      console.log(`Unlocking controls for state: ${newState}...`);
       setIgnoreNextUnlockFlag(true); // Marcar como desbloqueo intencional
      controls.unlock();
    }
    // El bloqueo se intenta/maneja en startGame o en los listeners de UI (Resume)
    // y el evento 'lock' confirma el cambio a PLAYING
  } catch (e) {
    console.error("Controls lock/unlock error during state change:", e);
  }

  // Acciones específicas de estado
  switch (newState) {
    case GAME_STATES.PLAYING:
       document.body.classList.toggle("holding-object", !!getHeldObject());
       updateHUD(); // Actualizar HUD al entrar/volver a jugar
      // playSound("background_ambient", true, 0.3); // Reanudar sonido ambiente?
      break;
    case GAME_STATES.PAUSED:
      stopSound("background_ambient");
      updateHUD(); // Actualizar HUD (especialmente timer) en pausa
      break;
    case GAME_STATES.VICTORY:
      stopSound("background_ambient");
      playSound("victory_fanfare");
      stopTimer();
      updateHUD();
      if(controls?.isLocked) controls.unlock(); // Asegurar desbloqueo
      break;
     case GAME_STATES.GAMEOVER_TIMEUP:
       stopSound("background_ambient");
       playSound("game_over");
       stopTimer();
       updateHUD();
       if(controls?.isLocked) controls.unlock(); // Asegurar desbloqueo
      break;
     case GAME_STATES.MENU:
        // Limpieza profunda al volver al menú principal
        cleanupPuzzles(scene); // Elimina objetos de puzzles, resetea estados
        clearInteractableObjects(); // Limpia lista de interaccionables
        clearCollisionObjects(); // Limpia lista de colisiones
        // Añadir de nuevo colisiones base (suelo, paredes) si cleanup las quita
        const floor = scene.getObjectByName('floor') || scene.getObjectByName('debug_floor');
        const wallB = scene.getObjectByName('wallBack'); /* ...etc ... */
        if(floor && !getCollisionObjects().includes(floor)) addCollisionObject(floor);
        /* ... añadir otras paredes si es necesario ... */

        if (controls) {
            if(controls.isLocked) controls.unlock(); // Desbloquear
            controls.resetState?.();
            controls.getObject().position.set(0, PLAYER_HEIGHT - 0.1, 5); // Resetear pos
            controls.getObject().rotation.set(0, 0, 0);
        }
        if (getHeldObject()) { // Forzar soltar objeto
            try { placeHeldObject(true); } catch(e){}
        }
        try { // Limpiar inventario
             deselectItem(false);
             clearInventory();
        } catch(e){}

        stopTimer();
        stopSound("background_ambient");
        hintsEnabled = false;
        setInitialUIState(); // Restaura UI del menú (botones, etc.)
       break;
    // Otros estados (PUZZLE, INVENTORY, MINIGAME) usualmente pausan la música si se desea
    // case GAME_STATES.INVENTORY:
    // case GAME_STATES.PUZZLE:
    //     stopSound("background_ambient");
    //     break;
  }

    // Limpiar estilos de cursor si no se está jugando activamente
    if (newState !== GAME_STATES.PLAYING) {
        ignoreInitialUnlock = false; // <<< --- Resetear bandera al volver a menú ---

         document.body.classList.remove("interactable-hover");
         document.body.classList.remove("holding-object");
         clearHoveredObject();
    }

  console.log(`Finished setting state: ${newState}. Pointer locked: ${controls?.isLocked}`);
}


// --- Core Game Flow Functions ---
export async function startGame() {
  // ... (Reset inicial como estaba) ...
  console.log("Starting new game...");
  hintsEnabled = false;
  cleanupPuzzles(scene);
  clearInteractableObjects();
  clearCollisionObjects();
  if (controls) { /* ... reset controls ... */
      controls.resetState?.();
      controls.getObject().position.set(0, PLAYER_HEIGHT - 0.1, 5); // Asegurar altura inicial
      controls.getObject().rotation.set(0, 0, 0);
      if (controls.velocity) controls.velocity.set(0, 0, 0);
  } else { return; }
  if (getHeldObject()) { try { placeHeldObject(true); } catch(e) {} }
  try { deselectItem(false); clearInventory(); } catch(e) {}

  setupRoomObjects(scene);
  createExitDoor(scene);
  const difficulty = getDifficultyValue();
  selectPuzzles(difficulty, scene);
  setupPuzzles(scene);
  // ... (Timer setup) ...
  // 4. Start Timer based on difficulty
  let duration = 1800; // <<< --- AÑADIR 'let' AQUÍ ---
  const puzzleCount = getActivePuzzlesCount(); // Get count of *selected* puzzles
  const difficultyValueStr = String(difficulty); // Comparar como string
   if (difficultyValueStr === "4") duration = 1800;      // 30 mins Easy (4 puzzles)
   else if (difficultyValueStr === "7") duration = 1500; // 25 mins Medium (7 puzzles)
   else if (difficultyValueStr === "10") duration = 1200;// 20 mins Difficult (10 puzzles)
   // else duration = 1800; // Default for Expert/All (-1) ya está puesto arriba
  startTimer(duration);
  updatePuzzlesTotalUI(getActivePuzzlesCount());
  updateHUD();

  // Set State to PLAYING and Request Lock
  setGameState(GAME_STATES.PLAYING);

  setTimeout(() => {
      if (controls && !controls.isLocked && getGameState() === GAME_STATES.PLAYING) {
          try {
              console.log("startGame: Attempting pointer lock (delayed)...");
              ignoreInitialUnlock = true; // <<< --- MARCAR PARA IGNORAR EL SIGUIENTE UNLOCK ---
              controls.lock();
          } catch (err) {
              console.error("startGame: Error initiating pointer lock:", err);
              ignoreInitialUnlock = false; // <<< --- RESETEAR SI EL LOCK FALLA ---
              // ... (mensaje de error UI) ...
          }
      } else {
           ignoreInitialUnlock = false; // <<< --- RESETEAR SI NO SE INTENTA BLOQUEAR ---
      }
  }, 50);

  console.log("Game start requested. State set to PLAYING. Lock requested (delayed). Will ignore first unlock.");
}



export function resetGame() {
    console.log("Resetting game to MENU state...");
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    setGameState(GAME_STATES.MENU); // Llama a toda la lógica de limpieza del estado MENU
    // setInitialUIState() es llamado dentro de setGameState(MENU)
}


export function getScene() { // <<< 'export' está aquí
  return scene;
}
export function getCamera() { // <<< 'export' está aquí
  return camera;
}
export function getControls() { // <<< 'export' está aquí
  return controls;
}
export function getRenderer() { // <<< 'export' está aquí
  return renderer;
}
export function getClock() { // <<< 'export' está aquí
  return clock;
}
export function setIgnoreNextUnlockFlag(value) { // <<< 'export' está aquí
  ignoreNextUnlockFlag = value;
}
export function getIgnoreNextUnlockFlag() { // <<< 'export' está aquí
  return ignoreNextUnlockFlag;
}
export function areHintsEnabled() { // <<< 'export' está aquí
  return hintsEnabled;
}
export function setHintsEnabled(value) { // <<< 'export' está aquí
  hintsEnabled = value;
}



// --- Nuevas funciones para manejar la bandera ---
export function shouldIgnoreInitialUnlock() {
  return ignoreInitialUnlock;
}
export function clearIgnoreInitialUnlockFlag() {
  ignoreInitialUnlock = false;
}

// --- Start ---
try {
  init();
} catch (e) {
    console.error("FATAL INIT ERROR:", e);
    const blocker = document.getElementById("blocker");
    const instructions = document.getElementById("instructions");
    if (blocker) blocker.style.display = "flex";
    if (instructions) {
        instructions.style.display = "block";
        instructions.innerHTML = `<h1>Error de Inicialización</h1><p>Detalles: ${e.message}</p><button onclick="location.reload()">Recargar</button>`;
    }
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
}

// END OF FILE main.js (Restored and Corrected)