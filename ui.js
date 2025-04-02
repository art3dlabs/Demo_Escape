import {
  getGameState,
  setGameState,
  startGame,
  resetGame,
  GAME_STATES, // Keep the import
  setIgnoreNextUnlockFlag,
  getIgnoreNextUnlockFlag,
  setHintsEnabled,
  areHintsEnabled, // Added areHintsEnabled based on usage
  getCamera, // Added getCamera for resize
  getRenderer, // Added getRenderer for resize
  getControls, // Added getControls for tooltip check/lock events
  // main.js doesn't export lastHoverCheckTime directly, it's internal
  // If needed, main.js would need to export a setter function for it.
  // setLastHoverCheckTime, // Example if main.js provided a setter
} from "./main.js";
import { handleKeyDown, handleKeyUp } from "./playerControls.js";
import { handleInteraction, dropSelectedItem } from "./interaction.js";
import {
  handleInventoryClick, // Keep if used for delegation target
  getSelectedItem,
  deselectItem,
  // Make sure inventory.js exports this:
  updateInventoryUI,
} from "./inventory.js";
import {
  getActivePuzzlesCount,
  getSolvedPuzzlesCount,
  getPuzzleDefinition,
  getActivePuzzles, // Added getActivePuzzles for objective text
  // If updateMenuPuzzleCountDisplay needs total available, import it:
  // getTotalAvailablePuzzles,
} from "./puzzles.js";
import { isTimerRunning, getFormattedTime, applyHelpPenalty } from "./timer.js";
import { playSound } from "./audio.js";

// --- UI Element References Cache ---
let uiElements = {};

function cacheUIElements() {
  const ids = [
    "blocker",
    "instructions",
    "hud",
    "objectiveText",
    "puzzlesSolvedText",
    "puzzlesTotalText",
    "timerDisplay",
    "timerText",
    "inventoryModal",
    "inventoryModalContent",
    "inventoryItems",
    "inventoryCloseButton",
    "tooltip",
    "puzzleModal",
    "puzzleModalContent",
    "puzzleTitle",
    "puzzleDescription",
    "puzzleContent",
    "puzzleInput",
    "puzzleMessage",
    "puzzleSubmitButton",
    "puzzleCloseButton",
    "puzzleOverlay2D",
    "puzzleOverlayContent",
    "puzzleOverlayTitle",
    "puzzleOverlayDescription",
    "puzzleOverlayArea",
    "puzzleOverlayCloseButton",
    "minigameOverlay",
    "minigameContent",
    "minigameTitle",
    "minigameArea",
    "minigameInstructions",
    "minigameCloseButton",
    "victoryScreen",
    "restartButtonVictory",
    "gameoverScreen", // Used for Pause screen
    "gameoverScreenContent",
    "pausePuzzlesCount", // Specific element for pause puzzle count
    "resumeButton",
    "restartButtonPause",
    "timeupOverlay",
    "timeupContent",
    "restartButtonTimeup",
    "pointer", // Crosshair element
    "difficultySelect",
    "menuPuzzleCountDisplay", // Text showing puzzle count on menu
    "startPrompt", // Clickable text/button on menu
    "helpButton", // Button in pause menu
    "helpConfirmModal",
    "helpConfirmContent",
    "confirmHelpBtn",
    "cancelHelpBtn",
  ];
  ids.forEach((id) => {
    uiElements[id] = document.getElementById(id);
    if (!uiElements[id])
      console.warn(`UI element not found during cache: #${id}`);
  });
  // Add specific checks for crucial elements
  if (!uiElements.blocker)
    console.error("CRITICAL UI ELEMENT MISSING: #blocker");
  if (!uiElements.inventoryItems)
    console.error("CRITICAL UI ELEMENT MISSING: #inventoryItems");
}

// Call once on script load to populate the cache
cacheUIElements();

// Getter function to safely access cached elements
export function getUIElement(id) {
  const element = uiElements[id]; // Check cache first
  if (!element) {
    // Don't log excessive warnings here, cacheUIElements handles the initial check
    // console.warn(`UI element #${id} not found when requested.`);
    return null; // Return null if not found
  }
  return element;
}

// --- Overlay Management ---
// <<< STEP 1: Declare overlayMap here, DO NOT initialize >>>
let overlayMap;

// Function to show the correct overlay based on game state
export function showOverlay(state) {
  // <<< Safety check for initialization >>>
  if (!overlayMap) {
    console.error(
      "Overlay map is not initialized yet. Call setupUIEventListeners first."
    );
    return;
  }

  // Hide all managed overlays first
  Object.values(overlayMap).forEach((overlayId) => {
    const element = getUIElement(overlayId);
    if (element) element.style.display = "none";
  });

  // Hide HUD elements by default, show them specifically later if needed
  const hud = getUIElement("hud");
  const pointer = getUIElement("pointer");
  const tooltip = getUIElement("tooltip");
  if (hud) hud.style.display = "none";
  if (pointer) pointer.style.display = "none";
  if (tooltip) tooltip.style.display = "none"; // Hide tooltip when overlay shown

  // Show the specific overlay for the current state
  const overlayToShowId = overlayMap[state];
  if (overlayToShowId) {
    const element = getUIElement(overlayToShowId);
    if (element) {
      element.style.display = "flex"; // Use flex for centering content
      console.log(`Showing overlay: ${overlayToShowId} for state: ${state}`);

      // --- Update content specific to the overlay being shown ---
      if (state === GAME_STATES.PAUSED) {
        // Update pause menu info
        const solved = getSolvedPuzzlesCount();
        const total = getActivePuzzlesCount();
        const pauseCountEl = getUIElement("pausePuzzlesCount");
        if (pauseCountEl) pauseCountEl.textContent = `${solved} / ${total}`;
        // Maybe update time too? Handled by updateHUD
        updateHUD(); // Ensure timer display is updated in pause
      } else if (state === GAME_STATES.VICTORY) {
        // Update victory screen info (if needed beyond static HTML)
        // const victoryTimeEl = getUIElement('victoryTimeDisplay');
        // if (victoryTimeEl) victoryTimeEl.textContent = getFormattedTime();
      } else if (state === GAME_STATES.MENU) {
        updateMenuPuzzleCountDisplay(); // Refresh puzzle count on menu show
      }
    } else {
      console.warn(
        `Overlay element ID "${overlayToShowId}" not found for state ${state}`
      );
    }
  } else if (state !== GAME_STATES.PLAYING) {
    // Warn if a non-playing state doesn't have a defined overlay
    console.warn(`No overlay defined in overlayMap for game state: ${state}`);
  }

  // --- Show specific UI elements based on state ---
  // Show HUD only when actively playing
  if (state === GAME_STATES.PLAYING) {
    if (hud) hud.style.display = "block"; // Or 'flex' if it's a flex container
    if (pointer) pointer.style.display = "block";
    updateHUD(); // Ensure HUD content is up-to-date when entering playing state
  }
}

// Optional helper function if needed elsewhere
export function hideOverlay(overlayId) {
  const element = getUIElement(overlayId);
  if (element) element.style.display = "none";
}

// --- HUD Update ---
export function updateHUD() {
  const gameState = getGameState(); // Get current state

  const solvedCount = getSolvedPuzzlesCount();
  const totalCount = getActivePuzzlesCount();
  const puzzlesSolvedText = getUIElement("puzzlesSolvedText");
  const puzzlesTotalText = getUIElement("puzzlesTotalText");
  const objectiveText = getUIElement("objectiveText");
  const timerDisplay = getUIElement("timerDisplay");
  const timerText = getUIElement("timerText");

  // Update puzzle count display in HUD
  if (puzzlesSolvedText) puzzlesSolvedText.textContent = solvedCount;
  if (puzzlesTotalText) puzzlesTotalText.textContent = totalCount;

  // Update Objective Text
  if (objectiveText) {
    let currentObjective = "Explora la habitación...";
    if (gameState === GAME_STATES.PLAYING || gameState === GAME_STATES.PAUSED) {
      const activePuzzles = getActivePuzzles();
      const firstUnsolved = activePuzzles.find(
        (p) => p.id !== "escapeDoor" && !p.isMarkedSolved
      );
      const doorPuzzle = activePuzzles.find((p) => p.id === "escapeDoor");

      if (firstUnsolved) {
        currentObjective = `Resuelve: ${
          firstUnsolved.name || firstUnsolved.id
        }`;
      } else if (doorPuzzle && !doorPuzzle.isMarkedSolved) {
        currentObjective = `Abre la ${doorPuzzle.name || "puerta de salida"}`;
      } else if (doorPuzzle && doorPuzzle.isMarkedSolved) {
        currentObjective = "¡Escapa!"; // Door is open/solved
      } else if (activePuzzles.length > 0) {
        currentObjective = "Busca la salida..."; // All non-door solved, but no door?
      }
    }
    objectiveText.textContent = `Objetivo: ${currentObjective}`;
  }

  // Update Timer Display
  if (timerDisplay && timerText) {
    // Show timer when playing, paused, or on game over screen
    if (
      isTimerRunning() ||
      [
        GAME_STATES.PAUSED,
        GAME_STATES.VICTORY,
        GAME_STATES.GAMEOVER_TIMEUP,
      ].includes(gameState)
    ) {
      timerDisplay.style.display = "block";
      timerText.textContent = getFormattedTime();
    } else {
      timerDisplay.style.display = "none";
    }
  }
}

// Used by main.js to update total puzzle display on HUD when game starts
export function updatePuzzlesTotalUI(total) {
  const puzzlesTotalText = getUIElement("puzzlesTotalText");
  if (puzzlesTotalText) {
    puzzlesTotalText.textContent = total;
  }
}

// --- Tooltip ---
let tooltipTimeoutId = null;
export function updateTooltip(text, duration = null) {
  const tooltip = getUIElement("tooltip");
  if (!tooltip) return;

  const trimmedText = text ? text.trim() : "";

  // Clear previous timeout if any
  if (tooltipTimeoutId) {
    clearTimeout(tooltipTimeoutId);
    tooltipTimeoutId = null;
  }

  // Show tooltip only if playing, pointer locked, and text is not empty
  const controls = getControls(); // Get controls state
  const show =
    trimmedText !== "" &&
    getGameState() === GAME_STATES.PLAYING &&
    controls?.isLocked; // Check if controls exist and are locked

  tooltip.textContent = trimmedText;
  tooltip.style.display = show ? "block" : "none";

  // Set new timeout if duration is provided and tooltip is shown
  if (show && duration && duration > 0) {
    tooltipTimeoutId = setTimeout(() => {
      // Check if tooltip still exists before hiding
      const currentTooltip = getUIElement("tooltip");
      if (currentTooltip) currentTooltip.style.display = "none";
      tooltipTimeoutId = null;
    }, duration);
  }
}

// --- Difficulty Selector ---
export function getDifficultyValue() {
  const selector = getUIElement("difficultySelect");
  // Return the value directly (main.js/puzzles.js will interpret it)
  return selector ? selector.value : "medium"; // Default to medium if error
}

// Updates the text next to the difficulty selector on the main menu
export function updateMenuPuzzleCountDisplay() {
  const displayElement = getUIElement("menuPuzzleCountDisplay");
  const selector = getUIElement("difficultySelect");
  if (!displayElement || !selector) return;

  const difficulty = selector.value;
  let displayCount = "?";

  // Logic to determine puzzle count based on difficulty value
  // This might need adjustment based on how puzzles.js defines difficulties
  if (difficulty === "easy") displayCount = "4";
  else if (difficulty === "medium") displayCount = "7";
  else if (difficulty === "hard") displayCount = "10";
  // else if (difficulty === '-1') displayCount = 'Todos'; // Example for "All" option

  displayElement.textContent = `(${displayCount} Puzzles)`;
}

// --- Puzzle Modal ---
let currentPuzzleModalRef = null; // Store reference to the active puzzle config for checkSolution

// Shows the standard puzzle modal with an input field
export function showPuzzleModalContent(
  puzzleRefId, // ID of the specific interactable object triggering the puzzle
  puzzleId, // ID of the puzzle definition (from puzzles.js)
  title,
  description,
  inputType = "text", // 'text', 'password', 'number'
  placeholder = "Introduce la respuesta..."
) {
  currentPuzzleModalRef = {
    id: puzzleRefId,
    puzzleId: puzzleId,
  };

  const puzzleTitleEl = getUIElement("puzzleTitle");
  const puzzleDescriptionEl = getUIElement("puzzleDescription");
  const puzzleMessageEl = getUIElement("puzzleMessage");
  const puzzleInputEl = getUIElement("puzzleInput");

  if (puzzleTitleEl) puzzleTitleEl.textContent = title;
  if (puzzleDescriptionEl) puzzleDescriptionEl.textContent = description;
  if (puzzleMessageEl) {
    puzzleMessageEl.textContent = ""; // Clear previous feedback
    puzzleMessageEl.style.display = "none"; // Hide feedback area
  }
  if (puzzleInputEl) {
    puzzleInputEl.type = inputType;
    puzzleInputEl.placeholder = placeholder;
    puzzleInputEl.value = ""; // Clear previous input
    puzzleInputEl.style.display = "block"; // Ensure input is visible
    // Focus input after short delay to allow modal transition
    setTimeout(() => puzzleInputEl.focus(), 100);
  } else {
    console.error("Puzzle Input Element not found!");
  }

  playSound("ui_modal_open");
  setGameState(GAME_STATES.PUZZLE); // This shows the modal via showOverlay
}

// Hides the standard puzzle modal
export function hidePuzzleModal() {
  if (getGameState() === GAME_STATES.PUZZLE) {
    playSound("ui_cancel"); // Closing sound
    currentPuzzleModalRef = null; // Clear reference
    setGameState(GAME_STATES.PLAYING); // Return to playing state
  }
}

// Function called when the puzzle modal submit button is clicked or Enter is pressed
function submitPuzzleModalInput() {
  const puzzleInputEl = getUIElement("puzzleInput");
  if (
    getGameState() === GAME_STATES.PUZZLE &&
    currentPuzzleModalRef?.puzzleId &&
    puzzleInputEl
  ) {
    const puzzleDef = getPuzzleDefinition(currentPuzzleModalRef.puzzleId);
    if (puzzleDef && typeof puzzleDef.checkSolution === "function") {
      const userAnswer = puzzleInputEl.value;
      console.log(
        `Submitting answer "${userAnswer}" for puzzle ${currentPuzzleModalRef.puzzleId}`
      );
      // Call the puzzle's checkSolution function (defined in puzzles.js)
      puzzleDef.checkSolution(userAnswer);
      // The checkSolution function MUST handle:
      // - Displaying feedback via setPuzzleFeedback()
      // - Playing success/failure sounds
      // - Granting rewards (e.g., adding items) via inventory functions
      // - Marking the puzzle as solved via markPuzzleSolved()
      // - Potentially calling hidePuzzleModal() on success.
    } else {
      console.warn(
        `No checkSolution function found for puzzle: ${currentPuzzleModalRef.puzzleId}`
      );
      setPuzzleFeedback("Error: No se puede verificar la solución.", true); // Show error in modal
    }
  } else {
    console.warn(
      "Submit puzzle called in wrong state or without reference/input."
    );
    setPuzzleFeedback("Error al enviar.", true);
  }
}

// Updates the feedback message area in the puzzle modal
export function setPuzzleFeedback(message, isError = false) {
  const feedbackEl = getUIElement("puzzleMessage");
  if (!feedbackEl) return;
  feedbackEl.textContent = message;
  feedbackEl.className = isError ? "error-message" : "success-message"; // Use classes for styling
  feedbackEl.style.display = message ? "block" : "none";
  if (message) {
    playSound(isError ? "error_short" : "success_short"); // Play sound based on type
  }
}

// --- Minigame UI Handling ---
let currentMinigameSuccessCallback = null;
let currentMinigameId = null; // Keep track of which minigame is active

// Placeholder implementations - Replace with actual logic imports
const minigameImplementations = {
  wires: {
    init: (areaElement, instructionsElement, winCallback, loseCallback) => {
      /* Placeholder */ areaElement.innerHTML = `<div class="placeholder-minigame">Wires Minigame UI<br/><button onclick="this.dispatchEvent(new CustomEvent('minigame-win', {bubbles:true}))">Win</button> <button onclick="this.dispatchEvent(new CustomEvent('minigame-lose', {bubbles:true}))">Lose</button></div>`;
      instructionsElement.textContent = "Connect the wires.";
    },
    cleanup: (areaElement) => {
      /* Placeholder */ areaElement.innerHTML = "";
    },
  },
  simon: {
    init: (areaElement, instructionsElement, winCallback, loseCallback) => {
      /* Placeholder */ areaElement.innerHTML = `<div class="placeholder-minigame">Simon Says Minigame UI<br/><button onclick="this.dispatchEvent(new CustomEvent('minigame-win', {bubbles:true}))">Win</button> <button onclick="this.dispatchEvent(new CustomEvent('minigame-lose', {bubbles:true}))">Lose</button></div>`;
      instructionsElement.textContent = "Repeat the sequence.";
    },
    cleanup: (areaElement) => {
      /* Placeholder */ areaElement.innerHTML = "";
    },
  },
};

// Shows the minigame overlay and initializes the specific minigame UI
export function showMinigameUI(minigameId, successCallback) {
  const areaElement = getUIElement("minigameArea");
  const titleElement = getUIElement("minigameTitle");
  const instructionsElement = getUIElement("minigameInstructions");

  if (!areaElement || !titleElement || !instructionsElement) {
    console.error("Minigame UI elements not found!");
    return;
  }
  const implementation = minigameImplementations[minigameId];
  if (!implementation) {
    console.error(`Minigame implementation not found for ID: ${minigameId}`);
    areaElement.innerHTML = `<div>Error: Minijuego "${minigameId}" no implementado.</div>`;
    titleElement.textContent = "Error Minijuego";
    instructionsElement.textContent = "";
    setGameState(GAME_STATES.MINIGAME); // Show the overlay even on error
    return;
  }

  currentMinigameSuccessCallback = successCallback; // Store callback for success action
  currentMinigameId = minigameId; // Store active minigame ID

  // Set title (could be dynamic based on implementation)
  titleElement.textContent =
    minigameId === "wires"
      ? "Conectar Cables"
      : minigameId === "simon"
      ? "Simon Says"
      : "Minijuego"; // Default title

  // Define win/lose handlers that close the UI and trigger callbacks
  const handleWin = () => {
    playSound("success"); // Play win sound
    if (currentMinigameSuccessCallback) {
      currentMinigameSuccessCallback(); // Execute the puzzle's success logic
    }
    hideMinigameUI(true); // Close the UI, indicate success=true
  };
  const handleLose = () => {
    playSound("error_short"); // Play lose sound
    // Maybe add a small delay before closing on loss?
    hideMinigameUI(false); // Close the UI, indicate success=false
    updateTooltip("Minijuego fallido. Inténtalo de nuevo.", 2500); // Show tooltip AFTER closing
  };

  // Add event listeners to the minigame area to catch custom win/lose events (for placeholders)
  // Replace this with actual minigame logic passing win/lose callbacks
  const winListener = () => handleWin();
  const loseListener = () => handleLose();
  areaElement.addEventListener("minigame-win", winListener);
  areaElement.addEventListener("minigame-lose", loseListener);
  // Store listeners to remove them on cleanup
  areaElement._minigameListeners = { win: winListener, lose: loseListener };

  // Initialize the specific minigame's UI
  try {
    implementation.init(
      areaElement,
      instructionsElement,
      handleWin, // Pass callbacks directly if implementation uses them
      handleLose
    );
  } catch (error) {
    console.error(`Error initializing minigame "${minigameId}":`, error);
    areaElement.innerHTML = `<div>Error al cargar minijuego.</div>`;
    // Remove listeners if init fails
    areaElement.removeEventListener("minigame-win", winListener);
    areaElement.removeEventListener("minigame-lose", loseListener);
    areaElement._minigameListeners = null;
  }

  playSound("ui_modal_open"); // Sound for opening minigame
  setGameState(GAME_STATES.MINIGAME); // Show the overlay
}

// Hides the minigame overlay and cleans up its UI
export function hideMinigameUI(success = false, manuallyClosed = false) {
  if (getGameState() !== GAME_STATES.MINIGAME || !currentMinigameId) return;

  if (manuallyClosed) playSound("ui_cancel");

  const areaElement = getUIElement("minigameArea");
  const implementation = minigameImplementations[currentMinigameId];

  // Remove placeholder listeners
  if (areaElement && areaElement._minigameListeners) {
    areaElement.removeEventListener(
      "minigame-win",
      areaElement._minigameListeners.win
    );
    areaElement.removeEventListener(
      "minigame-lose",
      areaElement._minigameListeners.lose
    );
    areaElement._minigameListeners = null;
  }

  // Call the specific cleanup function for the minigame
  if (implementation && implementation.cleanup) {
    try {
      implementation.cleanup(areaElement);
    } catch (error) {
      console.error(
        `Error cleaning up minigame "${currentMinigameId}":`,
        error
      );
    }
  } else {
    if (areaElement) areaElement.innerHTML = ""; // Default cleanup: clear content
  }

  currentMinigameSuccessCallback = null;
  const previousMinigameId = currentMinigameId; // Store before clearing
  currentMinigameId = null; // Clear active minigame ID

  setGameState(GAME_STATES.PLAYING); // Return to game
  setIgnoreNextUnlockFlag(true); // Prevent pause screen immediately after closing

  console.log(`Minigame ${previousMinigameId} closed. Success: ${success}`);
}

// --- Event Listener Setup ---
export function setupUIEventListeners() {
  console.log("Setting up UI event listeners...");

  // <<< Initialize overlayMap HERE >>>
  overlayMap = {
    [GAME_STATES.MENU]: "blocker",
    [GAME_STATES.PAUSED]: "gameoverScreen", // Reusing game over screen structure for Pause
    [GAME_STATES.PUZZLE]: "puzzleModal",
    [GAME_STATES.PUZZLE_2D]: "puzzleOverlay2D",
    [GAME_STATES.INVENTORY]: "inventoryModal",
    [GAME_STATES.MINIGAME]: "minigameOverlay",
    [GAME_STATES.VICTORY]: "victoryScreen",
    [GAME_STATES.GAMEOVER_TIMEUP]: "timeupOverlay",
    [GAME_STATES.HELP_CONFIRM]: "helpConfirmModal",
  };
  console.log("Overlay map initialized.");

  const controls = getControls(); // Get controls early for lock/unlock

  // Inside ui.js -> setupUIEventListeners()

  // --- Blocker / Start ---
  const blocker = getUIElement("blocker");
  const startPrompt = getUIElement("startPrompt");
  if (blocker && startPrompt) {
    blocker.addEventListener("click", (e) => {
      // Only trigger game start if the click target IS the start prompt
      if (getGameState() === GAME_STATES.MENU && e.target === startPrompt) {
        console.log("StartPrompt clicked: Calling startGame...");
        playSound("button_confirm"); // Play start sound
        startGame(); // <<< CALL startGame DIRECTLY
        // startGame will call setGameState(PLAYING), which will handle the controls.lock() attempt.
        // REMOVED: if (controls && !controls.isLocked) controls.lock();
      }
    });
  } else {
    console.error(
      "Required menu elements (#blocker or #startPrompt) not found!"
    );
  }

  // Inside ui.js -> setupUIEventListeners()

  // --- Pointer Lock/Unlock Events ---
  if (controls) {
    controls.addEventListener("lock", () => {
      console.log("Pointer locked event received.");
      const currentState = getGameState();

      // *** CRITICAL CHANGE: Set state to PLAYING on successful lock ***
      // This handles both starting the game AND resuming from pause/modals
      if (currentState !== GAME_STATES.PLAYING) {
        console.log(
          `Pointer locked - Setting state to PLAYING from ${currentState}.`
        );
        setGameState(GAME_STATES.PLAYING); // <<< SET STATE HERE
      } else {
        console.log(
          "Pointer locked while already PLAYING (no state change needed)."
        );
      }
      // Optionally reset interaction check timer here if needed
      // const { setLastHoverCheckTime } = await import('./main.js'); // If exported
      // setLastHoverCheckTime(performance.now());
    });

    controls.addEventListener("unlock", () => {
      const lockedStatusRightAfterUnlockEvent = controls?.isLocked;
      console.log(
        `Pointer unlocked event received. controls.isLocked is NOW: ${lockedStatusRightAfterUnlockEvent}`
      ); // Check status timing

      const ignoreUnlock = getIgnoreNextUnlockFlag();
      if (ignoreUnlock) {
        setIgnoreNextUnlockFlag(false);
        console.log("Unlock event intentionally ignored.");
        return;
      }
      // If playing and unlock was unexpected, pause
      // Check current state *before* changing it
      const currentStateBeforePause = getGameState();
      if (currentStateBeforePause === GAME_STATES.PLAYING) {
        console.log("Unexpected unlock while playing -> Setting PAUSED state.");
        setGameState(GAME_STATES.PAUSED); // This will call showOverlay, etc.
      } else {
        console.log(
          `Unlock event in state ${currentStateBeforePause} (ignored or handled by state logic).`
        );
      }
      updateTooltip(""); // Hide tooltip on unlock
    });
  } else {
    console.error("PointerLockControls not found during UI listener setup!");
  }

  // --- Keyboard Listeners ---
  document.addEventListener("keydown", (e) => {
    const gameState = getGameState();
    const controlsInstance = getControls(); // Use a consistent variable name
    const isLocked = controlsInstance?.isLocked;
    const keyLower = e.key.toLowerCase(); // Lowercase once

    // --- ADD DETAILED LOGGING (Keep this for testing) ---
    console.log(
      `KEYDOWN -> Key: ${e.key}, State: ${gameState}, Locked: ${isLocked}`
    );
    // ---

    // --- Escape Key Handler ---
    if (e.key === "Escape") {
      // Use e.key directly for Escape
      console.log(`Escape key pressed in state: ${gameState}`);
      switch (gameState) {
        case GAME_STATES.PLAYING:
          setGameState(GAME_STATES.PAUSED);
          break;
        case GAME_STATES.PAUSED:
          // Request lock to resume
          if (controlsInstance && !isLocked) {
            // Check if already locked
            try {
              console.log("Resuming from PAUSED: Attempting lock...");
              controlsInstance.lock(); // Lock attempt will trigger 'lock' event handler
            } catch (err) {
              console.error("Lock error on resume:", err);
            }
          }
          break; // Lock handler sets PLAYING state
        // ... (rest of escape cases) ...
      }
      e.preventDefault();
      return;
    }

    // --- Inventory Key Handler ---
    if (keyLower === "i" || e.key === "Tab") {
      // Check lowercase 'i'
      // ... inventory logic ...
      e.preventDefault();
      return;
    }

    // --- Gameplay Keys (Check state and lock status) ---
    if (gameState === GAME_STATES.PLAYING && isLocked) {
      console.log(`   ✅ Processing Gameplay key: ${keyLower}`); // Confirmation log

      if (
        [
          "w",
          "a",
          "s",
          "d",
          " ",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
        ].includes(keyLower)
      ) {
        console.log(`      -> Calling handleKeyDown for movement: ${keyLower}`);
        handleKeyDown(keyLower);
        e.preventDefault();
      } else if (keyLower === "e") {
        console.log(`      -> Calling handleInteraction`);
        handleInteraction();
        e.preventDefault();
      } else if (keyLower === "g") {
        console.log(`      -> Calling dropSelectedItem`);
        dropSelectedItem();
        e.preventDefault();
      } else if (keyLower === "q") {
        console.log(`      -> Calling deselectItem`);
        deselectItem();
        e.preventDefault();
      }
    } else if (
      [
        "w",
        "a",
        "s",
        "d",
        "e",
        "g",
        "q",
        " ",
        "arrowup",
        "arrowdown",
        "arrowleft",
        "arrowright",
      ].includes(keyLower)
    ) {
      // Log only if it *was* a gameplay key but conditions failed
      console.warn(
        `   ❌ Gameplay key '${keyLower}' ignored. State=${gameState}, Locked=${isLocked}`
      );
    }

    // --- Puzzle Modal Enter Key ---
    if (gameState === GAME_STATES.PUZZLE && e.key === "Enter") {
      const puzzleInput = getUIElement("puzzleInput");
      if (puzzleInput && document.activeElement === puzzleInput) {
        submitPuzzleModalInput();
        e.preventDefault();
      }
    }
  });
}

//else {
//  console.error("PointerLockControls not found during UI listener setup!");
//  }

// --- Keyboard Listeners ---
document.addEventListener("keydown", (e) => {
  const gameState = getGameState();
  const puzzleInput = getUIElement("puzzleInput"); // Cache for check

  // --- Escape Key Handler ---
  if (e.key === "Escape") {
    console.log(`Escape key pressed in state: ${gameState}`);
    switch (gameState) {
      case GAME_STATES.PLAYING:
        setGameState(GAME_STATES.PAUSED);
        break;
      case GAME_STATES.PAUSED:
        if (controls) {
          try {
            controls.lock();
          } catch (err) {
            console.error("Lock error on resume:", err);
          }
        }
        break; // Resume
      case GAME_STATES.PUZZLE:
        setIgnoreNextUnlockFlag(true);
        hidePuzzleModal();
        break;
      case GAME_STATES.PUZZLE_2D:
        setIgnoreNextUnlockFlag(true);
        setGameState(GAME_STATES.PLAYING);
        break; // Close 2D overlay
      case GAME_STATES.INVENTORY:
        setIgnoreNextUnlockFlag(true);
        hideInventoryModal();
        break;
      case GAME_STATES.MINIGAME:
        setIgnoreNextUnlockFlag(true);
        hideMinigameUI(false, true);
        break; // Close minigame (manually)
      case GAME_STATES.HELP_CONFIRM:
        setIgnoreNextUnlockFlag(true);
        hideHelpConfirmModal();
        break;
      // No Escape action needed for MENU, VICTORY, GAMEOVER_TIMEUP
    }
    e.preventDefault(); // Prevent default browser actions for Escape
    return; // Stop further key processing for Escape
  }

  // --- Inventory Key Handler ---
  if (e.key.toLowerCase() === "i" || e.key === "Tab") {
    if (gameState === GAME_STATES.PLAYING) {
      showInventoryModal(); // Handles async import and state change
    } else if (gameState === GAME_STATES.INVENTORY) {
      setIgnoreNextUnlockFlag(true); // Prevent pause on unlock
      hideInventoryModal();
    }
    e.preventDefault(); // Prevent default Tab behavior, 'i' typing
    return;
  }

  // --- Gameplay Keys (Only when Playing and Locked) ---
  if (gameState === GAME_STATES.PLAYING && controls?.isLocked) {
    const keyLower = e.key.toLowerCase();
    if (
      [
        "w",
        "a",
        "s",
        "d",
        " ",
        "arrowup",
        "arrowdown",
        "arrowleft",
        "arrowright",
      ].includes(keyLower)
    ) {
      handleKeyDown(keyLower); // Pass movement keys
      e.preventDefault();
    } else if (keyLower === "e") {
      handleInteraction();
      e.preventDefault();
    } // Interact
    else if (keyLower === "g") {
      dropSelectedItem();
      e.preventDefault();
    } // Drop selected
    else if (keyLower === "q") {
      deselectItem();
      e.preventDefault();
    } // Deselect (no drop)
  }

  // --- Puzzle Modal Enter Key ---
  if (gameState === GAME_STATES.PUZZLE && e.key === "Enter") {
    // Check if the puzzle input is focused
    if (puzzleInput && document.activeElement === puzzleInput) {
      submitPuzzleModalInput();
      e.preventDefault(); // Prevent potential form submission
    }
  }
});

document.addEventListener("keyup", (e) => {
  const gameState = getGameState();
  // *** FIX: Get controls instance inside this handler's scope ***
  const controlsInstance = getControls();
  const isLocked = controlsInstance?.isLocked;
  // *** END FIX ***

  // Pass movement keyup events ONLY when playing and locked
  // *** FIX: Use the locally fetched controlsInstance and isLocked ***
  if (gameState === GAME_STATES.PLAYING && isLocked) {
    const keyLower = e.key.toLowerCase();
    if (
      [
        "w",
        "a",
        "s",
        "d",
        " ",
        "arrowup",
        "arrowdown",
        "arrowleft",
        "arrowright",
      ].includes(keyLower)
    ) {
      // console.log(`   ✅ Processing KeyUp for movement: ${keyLower}`); // Optional log
      handleKeyUp(keyLower);
      e.preventDefault();
    }
  }
  // else { // Optional: Log ignored keyup
  //    if (["w", "a", "s", "d", " ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(e.key.toLowerCase())) {
  //        console.warn(`   ❌ KeyUp '${e.key}' ignored. State=${gameState}, Locked=${isLocked}`);
  //    }
  // }
});

// --- Mouse Click Listeners ---
window.addEventListener("mousedown", (event) => {
  const gameState = getGameState();

  // Left Click (Button 0)
  if (event.button === 0) {
    // Interaction/Place Item in Game World
    if (gameState === GAME_STATES.PLAYING && controls?.isLocked) {
      // Check if click originated on an interactive UI element (modal, button inside HUD etc.)
      let targetElement = event.target;
      let clickOnUI = false;
      while (targetElement && targetElement !== document.body) {
        // Check common UI containers or elements that should block world interaction
        if (
          targetElement.closest(
            ".modal-overlay, .overlay-content, #hud button, #hud select"
          )
        ) {
          clickOnUI = true;
          break;
        }
        targetElement = targetElement.parentElement;
      }

      if (!clickOnUI) {
        handleInteraction(); // Interact with world
        // event.preventDefault(); // Prevent text selection if needed
      } else {
        console.log("Ignoring world interaction click on UI element.");
      }
    }
    // Start Prompt Click (handled by blocker listener, but catch here too)
    else if (
      gameState === GAME_STATES.MENU &&
      event.target === getUIElement("startPrompt")
    ) {
      // Blocker listener should handle lock attempt
      event.preventDefault();
    }
  }
  // Right Click (Button 2) - Deselect Item
  else if (event.button === 2) {
    if (
      (gameState === GAME_STATES.PLAYING ||
        gameState === GAME_STATES.INVENTORY) &&
      getSelectedItem()
    ) {
      deselectItem(); // Deselect current item
    }
    event.preventDefault(); // Always prevent context menu
  }
});

// Prevent context menu globally (right-click already handled)
document.addEventListener("contextmenu", (e) => e.preventDefault());

// --- Window Resize ---
window.addEventListener("resize", onWindowResize);

// --- UI Button/Element Listeners ---
// Helper to add listener if element exists
const addListener = (id, event, handler, useCapture = false) => {
  const element = getUIElement(id);
  if (element) {
    element.addEventListener(event, handler, useCapture);
  } else {
    // Warn only once if element is missing during setup
    // console.warn(`Listener not added: Element #${id} not found.`);
  }
};

// Main Menu
addListener("difficultySelect", "change", updateMenuPuzzleCountDisplay);
// Start button click is handled by the blocker overlay listener targeting #startPrompt

// Puzzle Modal
addListener("puzzleSubmitButton", "click", submitPuzzleModalInput);
addListener("puzzleCloseButton", "click", () => {
  setIgnoreNextUnlockFlag(true);
  hidePuzzleModal();
});

// Puzzle Overlay 2D
addListener("puzzleOverlayCloseButton", "click", () => {
  setIgnoreNextUnlockFlag(true);
  setGameState(GAME_STATES.PLAYING);
});

// Inventory
const inventoryItemsContainer = getUIElement("inventoryItems");
if (inventoryItemsContainer) {
  // Use delegation: listen on container, let inventory.js handle clicks on items
  inventoryItemsContainer.addEventListener("click", (event) => {
    // Pass the clicked element to inventory.js handler if needed
    handleInventoryClick(event); // Ensure handleInventoryClick handles event target
  });
}
addListener("inventoryCloseButton", "click", () => {
  setIgnoreNextUnlockFlag(true);
  hideInventoryModal();
});

// Minigame
addListener("minigameCloseButton", "click", () => {
  setIgnoreNextUnlockFlag(true);
  hideMinigameUI(false, true);
}); // Manually closed

// Pause Menu (uses gameoverScreen elements)
addListener("resumeButton", "click", () => {
  if (getGameState() === GAME_STATES.PAUSED && controls && !controls.isLocked) {
    try {
      controls.lock();
    } catch (err) {
      console.error("Lock error on resume:", err);
    }
  }
});
addListener("restartButtonPause", "click", () => {
  playSound("ui_confirm");
  resetGame();
});

// Victory Screen
addListener("restartButtonVictory", "click", () => {
  playSound("ui_confirm");
  resetGame();
});

// Time Up Screen
addListener("restartButtonTimeup", "click", () => {
  playSound("ui_confirm");
  resetGame();
});

// Help System
const helpButton = getUIElement("helpButton"); // Cache ref
addListener("helpButton", "click", () => {
  if (getGameState() === GAME_STATES.PAUSED && !areHintsEnabled()) {
    playSound("ui_modal_open");
    setGameState(GAME_STATES.HELP_CONFIRM);
  } else if (areHintsEnabled()) {
    updateTooltip("Las pistas ya están activadas.", 2000);
  } else {
    updateTooltip("Abre el menú de pausa [Esc] para activar las pistas.", 3000);
  }
});
addListener("confirmHelpBtn", "click", () => {
  playSound("ui_confirm");
  applyHelpPenalty();
  setHintsEnabled(true);
  updateHUD(); // Update timer/indicators
  // Disable help button after confirmation
  if (helpButton) {
    helpButton.disabled = true;
    helpButton.title = "Pistas Activadas";
    helpButton.style.opacity = "0.5";
    helpButton.style.cursor = "default";
  }
  setIgnoreNextUnlockFlag(true);
  setGameState(GAME_STATES.PAUSED); // Return to pause menu
});
addListener("cancelHelpBtn", "click", () => {
  playSound("ui_cancel");
  setIgnoreNextUnlockFlag(true);
  hideHelpConfirmModal(); // Go back to pause menu
});

console.log("UI event listeners setup complete.");

// --- Window Resize Handler ---
function onWindowResize() {
  const camera = getCamera();
  const renderer = getRenderer();
  if (camera && renderer) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

// --- Specific Modal Hide Functions ---
function hideInventoryModal() {
  if (getGameState() === GAME_STATES.INVENTORY) {
    playSound("ui_cancel"); // Or specific close sound
    setGameState(GAME_STATES.PLAYING);
  }
}

// Make showInventoryModal async to handle dynamic import of UI update function
async function showInventoryModal() {
  if (getGameState() === GAME_STATES.PLAYING) {
    playSound("ui_modal_open"); // Or specific inventory open sound
    try {
      // Dynamically import updateInventoryUI from inventory.js
      // Ensure inventory.js exports it!
      const inventoryModule = await import("./inventory.js");
      if (inventoryModule.updateInventoryUI) {
        inventoryModule.updateInventoryUI(); // Update display content
        setGameState(GAME_STATES.INVENTORY); // THEN change state to show modal
      } else {
        console.error("Function updateInventoryUI not found in inventory.js");
        // Fallback: Show modal anyway, might be empty/stale
        setGameState(GAME_STATES.INVENTORY);
      }
    } catch (error) {
      console.error("Failed to load or run updateInventoryUI:", error);
      // Fallback: Show modal anyway
      setGameState(GAME_STATES.INVENTORY);
    }
  }
}

function hideHelpConfirmModal() {
  if (getGameState() === GAME_STATES.HELP_CONFIRM) {
    playSound("ui_cancel");
    setGameState(GAME_STATES.PAUSED); // Return to pause menu
  }
}

// --- Initial UI State Function ---
// Should be called at the end of main.js's init function.
export function setInitialUIState() {
  console.log("Setting initial UI state for MENU.");
  updateMenuPuzzleCountDisplay(); // Update puzzle count on menu based on default difficulty
  showOverlay(GAME_STATES.MENU); // Show the main menu/blocker
  // Ensure help button is reset/enabled visually on new game start
  const helpButton = getUIElement("helpButton");
  if (helpButton) {
    helpButton.disabled = false;
    helpButton.style.opacity = "";
    helpButton.style.cursor = "";
    helpButton.title = "Activar Pistas (penalización de tiempo)";
  }
}

// Ensure necessary functions are exported for use by other modules
// Exports are already handled by the 'export' keyword before each function/const.
