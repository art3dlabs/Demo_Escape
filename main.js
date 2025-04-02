import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

// Import modules
import {
  createScene,
  createCamera,
  createRenderer,
  setupLighting,
  setupRoomObjects,
  createExitDoor,
} from "./sceneSetup.js";
import {
  setupPointerLockControls,
  updatePlayerMovement,
} from "./playerControls.js";
import {
  checkHoverInteraction,
  handleInteraction,
  getHeldObject,
  getHoveredObject,
  clearHoveredObject,
} from "./interaction.js";
import {
  updateHUD,
  setupUIEventListeners,
  showOverlay,
  hideOverlay,
  getDifficultyValue,
  updateMenuPuzzleCountDisplay,
  updatePuzzlesTotalUI,
} from "./ui.js";
import {
  setupPuzzles,
  selectPuzzles,
  cleanupPuzzles,
  getActivePuzzlesCount,
  getSolvedPuzzlesCount,
  markPuzzleSolved,
} from "./puzzles.js";
// <<< REMOVE updateTimer FROM HERE >>>
import { startTimer, stopTimer, isTimerRunning } from "./timer.js";
import { setupAudio, playSound, stopSound } from "./audio.js";

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
let ignoreNextUnlockFlag = false; // For intentional pointer unlocks
let hintsEnabled = false; // For help system

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
  setupRoomObjects(scene); // Creates static meshes ONLY
  createExitDoor(scene); // Creates the door mesh

  // Player Controls
  controls = setupPointerLockControls(camera, document.body);
  scene.add(controls.getObject());

  // Audio Setup
  setupAudio(camera); // Pass camera for AudioListener

  // UI Listeners
  setupUIEventListeners();

  // Set Initial State
  updateMenuPuzzleCountDisplay(); // Update count based on default difficulty
  setGameState(GAME_STATES.MENU);

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
  const delta = Math.min(0.05, clock.getDelta()); // Clamp delta time
  const currentTime = performance.now();

  // Update Timer (only if running)
  // <<< REMOVE THIS BLOCK - Timer updates itself via setInterval >>>
  // if (isTimerRunning()) {
  //   updateTimer(); // No longer needed
  // }
  // <<< END OF REMOVAL >>>

  // Update Player Movement (always update physics unless menu/victory)
  if (
    controls &&
    gameState !== GAME_STATES.MENU &&
    gameState !== GAME_STATES.VICTORY
  ) {
    updatePlayerMovement(delta, controls, scene); // Pass scene for collisions
  }

  // Check Interactions (only when playing and locked)
  if (gameState === GAME_STATES.PLAYING && controls?.isLocked) {
    if (currentTime - lastHoverCheckTime >= HOVER_CHECK_INTERVAL) {
      checkHoverInteraction(camera, scene); // Pass scene for interactables list
      lastHoverCheckTime = currentTime;
    }
  } else if (getHoveredObject()) {
    // Clear hover state if not actively playing/locked
    clearHoveredObject();
  }

  // Render Scene
  try {
    renderer.render(scene, camera);
  } catch (e) {
    console.error("Render error:", e);
    cancelAnimationFrame(animationFrameId);
    setGameState(GAME_STATES.MENU); // Go back to menu on error
    const instructions = document.getElementById("instructions");
    if (instructions)
      instructions.innerHTML = `<h1>Render Error</h1><p>Check console (F12).</p><p>${e.message}</p>`;
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
    document.body.classList.add(newState);

    showOverlay(newState);

    // --- Revised Pointer Lock Logic ---
    const shouldBeLocked = newState === GAME_STATES.PLAYING;
    const currentlyLocked = controls?.isLocked;

    try {
         // Unlock if needed (e.g., going to PAUSED, MENU, etc.)
        if (!shouldBeLocked && currentlyLocked) {
            console.log(`Unlocking controls for state: ${newState}...`);
            controls.unlock();
        }
        // <<< REMOVED the lock attempt when newState === GAME_STATES.PLAYING >>>
        // <<< The 'lock' event handler now manages setting the PLAYING state >>>

    } catch (e) {
        console.error("Controls lock/unlock error:", e);
    }
    // --- End Revised Logic ---


    // State-specific actions (keep the rest)
    switch (newState) {
         case GAME_STATES.PLAYING:
             document.body.classList.toggle("holding-object", !!getHeldObject());
             updateHUD();
             break;
        // ... rest of switch cases ...
    }

    // Clear hover/held object cursor styles if not playing
    if (newState !== GAME_STATES.PLAYING) {
        // ... (keep this logic) ...
    }

    // Log final status *after* potential unlock call
    console.log(`Finished setting state: ${newState}. Pointer locked: ${controls?.isLocked}`);
}

// --- Core Game Flow Functions ---
// Inside main.js

export async function startGame() {
  // <<< ADD async HERE (already present in your code, just confirming)
  console.log("Starting new game...");
  hintsEnabled = false; // Reset help flag

  // ... (Reset previous game state logic) ...
  if (controls) {
    controls
      .getObject()
      .position.set(0, PLAYER_HEIGHT, INTERACTION_DISTANCE * 2);
    const playerVelocity = controls.velocity || new THREE.Vector3();
    playerVelocity.set(0, 0, 0);
    controls.resetState?.();
  }
  if (getHeldObject()) {
    const { placeHeldObject } = await import("./interaction.js");
    placeHeldObject(true);
  }
  const { deselectItem } = await import("./inventory.js");
  deselectItem(false);

  // 2. Determine Difficulty & Select Puzzles
  const difficulty = getDifficultyValue();
  selectPuzzles(difficulty, scene);

  // 3. Setup Puzzles for the new game
  setupPuzzles(scene);

  // 4. Start Timer based on difficulty
  let duration = 1800; // 30 mins (Expert/Default)
  const puzzleCount = getActivePuzzlesCount();
  if (puzzleCount === 4) duration = 1800; // 30 mins Easy
  else if (puzzleCount === 7) duration = 1500; // 25 mins Medium
  else if (puzzleCount === 10) duration = 1200; // 20 mins Difficult
  startTimer(duration);

  // 5. Update UI (HUD elements, but don't show overlay yet)
  updatePuzzlesTotalUI(getActivePuzzlesCount());
  updateHUD(); // Update counts, timer display might be hidden initially

  // 6. <<< REMOVED >>> setGameState(GAME_STATES.PLAYING);

  // 7. Attempt Pointer Lock (The 'lock' event handler will set the state)
  if (controls && !controls.isLocked) {
    try {
      console.log("startGame: Attempting pointer lock...");
      controls.lock();
    } catch (err) {
      console.error("startGame: Error initiating pointer lock:", err);
      // Handle cases where lock fails immediately (e.g., browser settings)
      // Maybe show an error message on the menu overlay?
    }
  } else if (controls?.isLocked) {
    console.warn("startGame: Controls already locked? Unexpected.");
    // If somehow already locked, force state to PLAYING? Or is this an error state?
    // Let's assume the lock() call is needed.
    setGameState(GAME_STATES.PLAYING); // Fallback if already locked? Might hide issues.
  }

  // playSound("background_ambient", true); // <<< COMMENTED OUT
  console.log("Skipping background ambient sound load.");

  console.log(
    "Game started! Waiting for pointer lock event to set PLAYING state."
  );
}

export function resetGame() {
  console.log("Resetting game by reloading page...");
  stopSound("background_ambient"); // Stop loops before reload
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  location.reload();
}

// --- Utility Exports ---
export function getScene() {
  return scene;
}
export function getCamera() {
  return camera;
}
export function getControls() {
  return controls;
}
export function getRenderer() {
  return renderer;
}
export function getClock() {
  return clock;
}
export function setIgnoreNextUnlockFlag(value) {
  ignoreNextUnlockFlag = value;
}
export function getIgnoreNextUnlockFlag() {
  return ignoreNextUnlockFlag;
}
export function areHintsEnabled() {
  return hintsEnabled;
}
export function setHintsEnabled(value) {
  hintsEnabled = value;
}

// --- Start ---
// Ensure DOM is ready before initializing (optional, usually safe with script at end)
// document.addEventListener('DOMContentLoaded', init);
// Or initialize directly
try {
  init();
} catch (e) {
  console.error("FATAL INIT ERROR:", e);
  const blocker = document.getElementById("blocker");
  const instructions = document.getElementById("instructions");
  if (blocker) blocker.style.display = "flex";
  if (instructions) {
    instructions.style.display = "block";
    instructions.innerHTML = `<h1>Init Error</h1><p>Check console (F12).</p><p>${e.message}</p>`;
  }
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
}
