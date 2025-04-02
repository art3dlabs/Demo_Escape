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
import { startTimer, stopTimer, updateTimer, isTimerRunning } from "./timer.js";
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
  if (isTimerRunning()) {
    updateTimer();
  }

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

  document.body.className = ""; // Clear previous classes
  document.body.classList.add(newState); // Add current state class

  // Show/Hide Overlays based on state
  showOverlay(newState); // ui.js function handles which overlay to show

  // Handle Pointer Lock
  const shouldBeLocked = newState === GAME_STATES.PLAYING;
  try {
    if (shouldBeLocked && controls && !controls.isLocked) {
      // Attempt lock only if changing *to* playing state,
      // not if already playing (avoids re-locking issues)
      if (previousState !== GAME_STATES.PLAYING) {
        console.log("Attempting lock for PLAYING state...");
        controls.lock();
      }
    } else if (!shouldBeLocked && controls?.isLocked) {
      console.log(`Unlocking controls for state: ${newState}...`);
      controls.unlock();
    }
  } catch (e) {
    console.error("Controls lock/unlock error:", e);
  }

  // State-specific actions
  switch (newState) {
    case GAME_STATES.PLAYING:
      document.body.classList.toggle("holding-object", !!getHeldObject());
      // Resume timer handled by updateTimer check
      updateHUD();
      break;
    case GAME_STATES.PAUSED:
      updateHUD(); // Show current progress in pause menu
      // Timer paused implicitly by updateTimer check
      break;
    case GAME_STATES.MENU:
      stopTimer(); // Ensure timer is stopped
      cleanupPuzzles(scene); // Clean up previous game state if returning to menu
      updateMenuPuzzleCountDisplay(); // Update display based on selector
      hintsEnabled = false; // Reset hints
      break;
    case GAME_STATES.VICTORY:
    case GAME_STATES.GAMEOVER_TIMEUP:
      stopTimer(); // Stop timer on game end
      playSound("victory_fanfare"); // Or game_over sound
      break;
    case GAME_STATES.PUZZLE:
      // Focus input if visible
      const puzzleInput = document.getElementById("puzzleInput");
      if (puzzleInput?.style.display !== "none") {
        setTimeout(() => puzzleInput.focus(), 50);
      }
      break;
    // Add cases for PUZZLE_2D, INVENTORY, MINIGAME, HELP_CONFIRM if specific actions needed on entry
  }

  // Clear hover/held object cursor styles if not playing
  if (newState !== GAME_STATES.PLAYING) {
    document.body.classList.remove(
      "interactable-hover",
      "item-selected",
      "holding-object"
    );
    if (getHoveredObject()) clearHoveredObject(); // Clear tooltip too
  }

  console.log(
    `Finished setting state: ${newState}. Pointer locked: ${controls?.isLocked}`
  );
}

// --- Core Game Flow Functions ---
export async function startGame() {
  // <<< ADD async HERE
  console.log("Starting new game...");
  hintsEnabled = false; // Reset help flag

  // 1. Reset previous game state
  cleanupPuzzles(scene); // Remove old dynamic objects/reset static ones
  // Reset inventory is handled within cleanup or inventory module initialization
  // Reset player position & velocity
  if (controls) {
    controls
      .getObject()
      .position.set(0, PLAYER_HEIGHT, INTERACTION_DISTANCE * 2); // Adjust start position
    const playerVelocity = controls.velocity || new THREE.Vector3(); // Assuming velocity is accessible/managed in playerControls
    playerVelocity.set(0, 0, 0);
    controls.resetState?.(); // Add a reset function in playerControls if needed (e.g., for onGround flag)
  }
  if (getHeldObject()) {
    // Force drop if somehow still holding an object (should be cleared by cleanup)
    // Dynamic import is now valid inside an async function
    const { placeHeldObject } = await import("./interaction.js");
    placeHeldObject(true);
  }
  // Dynamic import is now valid inside an async function
  const { deselectItem } = await import("./inventory.js");
  deselectItem(false);

  // 2. Determine Difficulty & Select Puzzles
  const difficulty = getDifficultyValue(); // From ui.js
  selectPuzzles(difficulty, scene); // Selects puzzle chain, assigns rewards

  // 3. Setup Puzzles for the new game
  setupPuzzles(scene); // Calls setup() for each active puzzle

  // 4. Start Timer based on difficulty
  let duration = 1800; // 30 mins (Expert/Default)
  const puzzleCount = getActivePuzzlesCount();
  if (puzzleCount === 4) duration = 1800; // 30 mins Easy (adjust as desired)
  else if (puzzleCount === 7) duration = 1500; // 25 mins Medium
  else if (puzzleCount === 10) duration = 1200; // 20 mins Difficult
  startTimer(duration);

  // 5. Update UI
  updatePuzzlesTotalUI(getActivePuzzlesCount()); // Show total puzzles for this game
  updateHUD();

  // 6. Set state to Playing (will attempt pointer lock)
  setGameState(GAME_STATES.PLAYING);

  playSound("background_ambient", true); // Start background loop

  console.log("Game started!");
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
