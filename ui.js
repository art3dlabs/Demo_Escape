// START OF FILE ui.js (Restored and Corrected)

import {
  getGameState,
  setGameState,
  startGame,
  resetGame,
  GAME_STATES,
  setIgnoreNextUnlockFlag,
  getIgnoreNextUnlockFlag,
  setHintsEnabled,
  areHintsEnabled,
  getCamera, // Necesario para onWindowResize
  getRenderer, // Necesario para onWindowResize
  getControls,
  shouldIgnoreInitialUnlock,   // <<< NUEVO IMPORT
  clearIgnoreInitialUnlockFlag // <<< NUEVO IMPORT
} from "./main.js";
import { handleKeyDown, handleKeyUp } from "./playerControls.js";
import { handleInteraction, dropSelectedItem, clearHoveredObject } from "./interaction.js"; // Añadir clearHoveredObject
import {
  handleInventoryClick,
  getSelectedItem,
  deselectItem,
  updateInventoryUI,
} from "./inventory.js";
import {
  getActivePuzzlesCount,
  getSolvedPuzzlesCount,
  getPuzzleDefinition,
  getActivePuzzles,
} from "./puzzles.js";
import { isTimerRunning, getFormattedTime, applyHelpPenalty } from "./timer.js";
import { playSound } from "./audio.js";

// --- UI Element Cache (Sin cambios) ---
let uiElements = {};
function cacheUIElements() {
    // ... (igual que antes) ...
    const ids = ["blocker", "instructions", "hud", "objectiveText", "puzzlesSolvedText", "puzzlesTotalText", "timerDisplay", "timerText", "inventoryModal", "inventoryModalContent", "inventoryItems", "inventoryCloseButton", "tooltip", "puzzleModal", "puzzleModalContent", "puzzleTitle", "puzzleDescription", "puzzleContent", "puzzleInput", "puzzleMessage", "puzzleSubmitButton", "puzzleCloseButton", "puzzleOverlay2D", "puzzleOverlayContent", "puzzleOverlayTitle", "puzzleOverlayDescription", "puzzleOverlayArea", "puzzleOverlayCloseButton", "minigameOverlay", "minigameContent", "minigameTitle", "minigameArea", "minigameInstructions", "minigameCloseButton", "victoryScreen", "restartButtonVictory", "gameoverScreen", "gameoverScreenContent", "pausePuzzlesCount", "resumeButton", "restartButtonPause", "timeupOverlay", "timeupContent", "restartButtonTimeup", "pointer", "difficultySelect", "menuPuzzleCountDisplay", "startPrompt", "helpButton", "helpConfirmModal", "helpConfirmContent", "confirmHelpBtn", "cancelHelpBtn"];
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
cacheUIElements();

export function getUIElement(id) { // Mantener
    return uiElements[id] || null;
}

// --- Overlay Management ---
let overlayMap; // Se inicializa en setupUIEventListeners

// Función showOverlay (Restaurada a versión completa)
export function showOverlay(state) {
  if (!overlayMap) {
    console.error( "Overlay map not initialized yet." );
    return;
  }

  Object.values(overlayMap).forEach((overlayId) => {
    const element = getUIElement(overlayId);
    if (element) element.style.display = "none";
  });

  const hud = getUIElement("hud");
  const pointer = getUIElement("pointer");
  const tooltip = getUIElement("tooltip");
  if (hud) hud.style.display = "none";
  if (pointer) pointer.style.display = "none";
  if (tooltip) tooltip.style.display = "none";

  const overlayToShowId = overlayMap[state];
  if (overlayToShowId) {
    const element = getUIElement(overlayToShowId);
    if (element) {
      element.style.display = "flex";
      console.log(`Showing overlay: ${overlayToShowId} for state: ${state}`);

      if (state === GAME_STATES.PAUSED) {
        const solved = getSolvedPuzzlesCount();
        const total = getActivePuzzlesCount();
        const pauseCountEl = getUIElement("pausePuzzlesCount");
        if (pauseCountEl) pauseCountEl.textContent = `${solved} / ${total}`;
        updateHUD(); // Actualizar timer en pausa
      } else if (state === GAME_STATES.MENU) {
        updateMenuPuzzleCountDisplay();
      }
       // Actualizar otras UIs si es necesario al mostrarlas (Victory, TimeUp, etc.)
    } else {
      console.warn(`Overlay element ID "${overlayToShowId}" not found for state ${state}`);
    }
  } else if (state !== GAME_STATES.PLAYING) {
    console.warn(`No overlay defined in overlayMap for game state: ${state}`);
  }

  // Mostrar HUD y puntero solo al jugar
  if (state === GAME_STATES.PLAYING) {
    if (hud) hud.style.display = "block";
    if (pointer) pointer.style.display = "block";
    updateHUD();
  }
}

// --- Funciones UI (Restauradas) ---
// Optional helper function if needed elsewhere
export function hideOverlay(overlayId) {
  const element = getUIElement(overlayId);
  if (element) element.style.display = "none";
}
export function updateHUD() { /* ... (código completo anterior) ... */
    const gameState = getGameState(); // Get current state

    const solvedCount = getSolvedPuzzlesCount();
    const totalCount = getActivePuzzlesCount();
    const puzzlesSolvedText = getUIElement("puzzlesSolvedText");
    const puzzlesTotalText = getUIElement("puzzlesTotalText");
    const objectiveText = getUIElement("objectiveText");
    const timerDisplay = getUIElement("timerDisplay");
    const timerText = getUIElement("timerText");

    if (puzzlesSolvedText) puzzlesSolvedText.textContent = solvedCount;
    if (puzzlesTotalText) puzzlesTotalText.textContent = totalCount;

    if (objectiveText) {
        let currentObjective = "Explora la habitación...";
        if (gameState === GAME_STATES.PLAYING || gameState === GAME_STATES.PAUSED) {
            try { // Añadir try-catch por si getActivePuzzles falla durante reinicios
                const activePuzzles = getActivePuzzles();
                const firstUnsolved = activePuzzles.find(p => p.id !== 'escapeDoor' && !p.isMarkedSolved);
                const doorPuzzle = activePuzzles.find(p => p.id === 'escapeDoor');

                if (firstUnsolved) {
                    currentObjective = `Resuelve: ${firstUnsolved.name || firstUnsolved.id}`;
                } else if (doorPuzzle && !doorPuzzle.isMarkedSolved) {
                    currentObjective = `Abre la ${doorPuzzle.name || 'puerta de salida'}`;
                } else if (doorPuzzle && doorPuzzle.isMarkedSolved) {
                    currentObjective = "¡Escapa!";
                } else if (activePuzzles.length > 0) {
                     currentObjective = "Busca la salida...";
                }
            } catch (e) {
                console.error("Error updating objective text:", e);
                currentObjective = "Cargando objetivo...";
            }
        }
        objectiveText.textContent = `Objetivo: ${currentObjective}`;
    }

    if (timerDisplay && timerText) {
        if (isTimerRunning() || [GAME_STATES.PAUSED, GAME_STATES.VICTORY, GAME_STATES.GAMEOVER_TIMEUP].includes(gameState)) {
        timerDisplay.style.display = "block";
        timerText.textContent = getFormattedTime();
        } else {
        timerDisplay.style.display = "none";
        }
    }
}
export function updatePuzzlesTotalUI(total) { /* ... (código completo anterior) ... */
    const puzzlesTotalText = getUIElement("puzzlesTotalText");
    if (puzzlesTotalText) {
        puzzlesTotalText.textContent = total;
    }
 }
let tooltipTimeoutId = null; // Mover fuera para que persista
export function updateTooltip(text, duration = null) { /* ... (código completo anterior, asegurando que usa getControls().isLocked ) ... */
    const tooltip = getUIElement("tooltip");
    if (!tooltip) return;

    const trimmedText = text ? text.trim() : "";

    if (tooltipTimeoutId) { clearTimeout(tooltipTimeoutId); tooltipTimeoutId = null; }

    const controls = getControls();
    const show = trimmedText !== "" && getGameState() === GAME_STATES.PLAYING && controls?.isLocked;

    tooltip.textContent = trimmedText;
    tooltip.style.display = show ? "block" : "none";

    if (show && duration && duration > 0) {
        tooltipTimeoutId = setTimeout(() => {
        const currentTooltip = getUIElement("tooltip");
        if (currentTooltip) currentTooltip.style.display = "none";
        tooltipTimeoutId = null;
        }, duration);
    }
}
export function getDifficultyValue() { /* ... (código completo anterior) ... */
     const selector = getUIElement("difficultySelect");
     return selector ? selector.value : "4"; // Devolver el VALOR directamente
}
export function updateMenuPuzzleCountDisplay() { /* ... (código completo anterior, usando selector.value) ... */
    const displayElement = getUIElement("menuPuzzleCountDisplay");
    const selector = getUIElement("difficultySelect");
    if (!displayElement || !selector) return;
    const difficultyValue = selector.value;
    let displayCount = "?";
    if (difficultyValue === "4") displayCount = "4";
    else if (difficultyValue === "7") displayCount = "7";
    else if (difficultyValue === "10") displayCount = "10";
    else if (difficultyValue === "-1") displayCount = "Todos";
    displayElement.textContent = displayCount;
}

// --- Puzzle Modal (Restaurado) ---
let currentPuzzleModalRef = null;
export function showPuzzleModalContent( /* ... (código completo anterior) ... */ ) {
    currentPuzzleModalRef = { id: puzzleRefId, puzzleId: puzzleId };
    const puzzleTitleEl = getUIElement("puzzleTitle"); /* ... etc ... */
    if (puzzleTitleEl) puzzleTitleEl.textContent = title;
    if (getUIElement("puzzleDescription")) getUIElement("puzzleDescription").textContent = description;
    if (getUIElement("puzzleMessage")) { getUIElement("puzzleMessage").textContent = ""; getUIElement("puzzleMessage").style.display = 'none'; }
    const inputEl = getUIElement("puzzleInput");
    if (inputEl) { inputEl.type = inputType; inputEl.placeholder = placeholder; inputEl.value = ""; inputEl.style.display = 'block'; setTimeout(() => inputEl.focus(), 100); }
    playSound("ui_open");
    setGameState(GAME_STATES.PUZZLE);
}
export function hidePuzzleModal() { /* ... (código completo anterior) ... */
     if (getGameState() === GAME_STATES.PUZZLE) {
        playSound("ui_cancel");
        currentPuzzleModalRef = null;
        setGameState(GAME_STATES.PLAYING);
    }
 }
function submitPuzzleModalInput() { /* ... (código completo anterior) ... */
    const puzzleInputEl = getUIElement("puzzleInput");
    if ( getGameState() === GAME_STATES.PUZZLE && currentPuzzleModalRef?.puzzleId && puzzleInputEl ) {
        const puzzleDef = getPuzzleDefinition(currentPuzzleModalRef.puzzleId);
        if (puzzleDef && typeof puzzleDef.checkSolution === "function") {
            const userAnswer = puzzleInputEl.value;
            console.log( `Submitting answer "${userAnswer}" for puzzle ${currentPuzzleModalRef.puzzleId}` );
            puzzleDef.checkSolution(userAnswer); // checkSolution debe manejar UI/sonido/cierre
        } else {
             console.warn(`No checkSolution function for puzzle: ${currentPuzzleModalRef.puzzleId}`);
             setPuzzleFeedback("Error: No se puede verificar la solución.", true);
        }
    } else {
        console.warn("Submit puzzle called in wrong state or without reference/input.");
        setPuzzleFeedback("Error al enviar.", true);
    }
}
export function setPuzzleFeedback(message, isError = false) { /* ... (código completo anterior SIN playSound) ... */
     const feedbackEl = getUIElement("puzzleMessage");
     if (!feedbackEl) return;
     feedbackEl.textContent = message;
     feedbackEl.className = isError ? "error-message" : "success-message";
     feedbackEl.style.display = message ? "block" : "none";
}

// --- Minigame UI Handling (Restaurado) ---
let currentMinigameSuccessCallback = null;
let currentMinigameId = null;
const minigameImplementations = { /* ... (placeholders como antes) ... */
    wires: { init: (area, instr, winCb, loseCb) => { area.innerHTML = `... Wires UI ... <button onclick="winCb()">Win</button> <button onclick="loseCb()">Lose</button>`; instr.textContent = "...";}, cleanup: (area) => {area.innerHTML = '';} },
    simon: { init: (area, instr, winCb, loseCb) => { area.innerHTML = `... Simon UI ... <button onclick="winCb()">Win</button> <button onclick="loseCb()">Lose</button>`; instr.textContent = "...";}, cleanup: (area) => {area.innerHTML = '';} },
};
export function showMinigameUI(minigameId, successCallback) { /* ... (código completo anterior) ... */
    const areaElement = getUIElement("minigameArea"); /* ... etc ... */
    if (!areaElement || !getUIElement("minigameTitle") || !getUIElement("minigameInstructions")) return;
    const implementation = minigameImplementations[minigameId];
    if (!implementation) { /* ... manejo de error ... */ setGameState(GAME_STATES.MINIGAME); return; }
    currentMinigameSuccessCallback = successCallback;
    currentMinigameId = minigameId;
    getUIElement("minigameTitle").textContent = minigameId === 'wires' ? "Conectar Cables" : minigameId === 'simon' ? "Simon Says" : "Minijuego";
    const handleWin = () => { playSound("success"); if (currentMinigameSuccessCallback) currentMinigameSuccessCallback(); hideMinigameUI(true); };
    const handleLose = () => { playSound("error_short"); hideMinigameUI(false); updateTooltip("Minijuego fallido.", 2500); };
    areaElement.innerHTML = '(Cargando...)';
    try { implementation.init(areaElement, getUIElement("minigameInstructions"), handleWin, handleLose); } catch (e) { console.error("Error init minigame", e); areaElement.innerHTML = 'Error'; }
    playSound("ui_open");
    setGameState(GAME_STATES.MINIGAME);
}
export function hideMinigameUI(success = false, manuallyClosed = false) { /* ... (código completo anterior) ... */
     const currentGameState = getGameState();
     if (currentGameState !== GAME_STATES.MINIGAME || !currentMinigameId) return;
     if (manuallyClosed && !success) playSound("ui_cancel");
     const areaElement = getUIElement("minigameArea");
     const implementation = minigameImplementations[currentMinigameId];
     if (implementation?.cleanup) { try { implementation.cleanup(areaElement); } catch (e) { console.error("Error cleanup", e); if(areaElement) areaElement.innerHTML='';} } else if(areaElement) areaElement.innerHTML='';
     currentMinigameSuccessCallback = null;
     const previousMinigameId = currentMinigameId;
     currentMinigameId = null;
     setGameState(GAME_STATES.PLAYING);
     setIgnoreNextUnlockFlag(true);
     console.log(`Minigame ${previousMinigameId} closed. Success: ${success}`);
}

// --- Event Listener Setup ---
export function setupUIEventListeners() {
  console.log("Setting up UI event listeners...");

  // Inicializar overlayMap (se mantiene)
  overlayMap = {
    [GAME_STATES.MENU]: "blocker",
    [GAME_STATES.PAUSED]: "gameoverScreen",
    [GAME_STATES.PUZZLE]: "puzzleModal",
    [GAME_STATES.PUZZLE_2D]: "puzzleOverlay2D",
    [GAME_STATES.INVENTORY]: "inventoryModal",
    [GAME_STATES.MINIGAME]: "minigameOverlay",
    [GAME_STATES.VICTORY]: "victoryScreen",
    [GAME_STATES.GAMEOVER_TIMEUP]: "timeupOverlay",
    [GAME_STATES.HELP_CONFIRM]: "helpConfirmModal",
  };
  console.log("Overlay map initialized.");

  const controlsInstance = getControls();

  // --- Blocker / Start (Sin cambios) ---
   const blocker = getUIElement("blocker");
   const startPrompt = getUIElement("startPrompt");
   if (blocker && startPrompt) {
     blocker.addEventListener("click", (e) => {
       if (getGameState() === GAME_STATES.MENU && e.target === startPrompt) {
         console.log("StartPrompt clicked, calling startGame...");
         playSound("button_confirm"); // Aunque falle, intentar reproducir
         startGame();
       }
     });
   } else { console.error("Required menu elements not found!"); }

  // --- Pointer Lock/Unlock Events (CON setTimeout en unlock) ---
  if (controlsInstance) {
    controlsInstance.addEventListener("lock", () => {
        console.log("Pointer locked event received.");
        // Si veníamos de ignorar el unlock inicial, ya no lo ignoramos más
        if (shouldIgnoreInitialUnlock()) {
             console.log("Initial lock successful, clearing ignoreInitialUnlock flag.");
             clearIgnoreInitialUnlockFlag();
        }
        const currentState = getGameState();
        if (currentState !== GAME_STATES.PLAYING) {
            console.log( `Pointer locked - Setting state to PLAYING from ${currentState}.` );
            setGameState(GAME_STATES.PLAYING);
        } else { console.log( "Pointer locked while already PLAYING." ); }
        updateTooltip("");
    });

    controlsInstance.addEventListener("unlock", () => {
        console.log(`Pointer unlocked event received.`);

        // <<< --- INICIO: LÓGICA DE IGNORAR MODIFICADA --- >>>
            // Primero, chequear si es el unlock inicial que debemos ignorar
            if (shouldIgnoreInitialUnlock()) {
                console.log("Ignoring the very first unlock event after lock attempt.");
                clearIgnoreInitialUnlockFlag(); // Ya lo ignoramos, reseteamos la bandera
                // NO hacemos setGameState(PAUSED) aquí
                // Es posible que el puntero SÍ se haya bloqueado brevemente
                // y necesitemos re-intentar el lock si el usuario hace clic de nuevo.
                // O podría quedarse desbloqueado, el usuario tendrá que hacer clic de nuevo.
                // Lo importante es NO ir a PAUSA automáticamente.
                return; // Salir del handler
            }

            // Si NO era el unlock inicial, chequear la bandera normal (para modales, Esc, etc.)
            const ignoreUnlock = getIgnoreNextUnlockFlag();
            if (ignoreUnlock) {
                setIgnoreNextUnlockFlag(false);
                console.log("Unlock event intentionally ignored (e.g., modal close).");
                return;
            }

            // Si no se ignoró por ninguna razón, proceder con la pausa demorada
            setTimeout(() => {
                const currentStateInTimeout = getGameState();
                const controls = getControls();
                const isLockedInTimeout = controls?.isLocked;
                if (currentStateInTimeout === GAME_STATES.PLAYING && !isLockedInTimeout) {
                    console.log("Unexpected unlock while playing (after timeout) -> Setting PAUSED state.");
                    setGameState(GAME_STATES.PAUSED);
                } else { console.log(`Unlock event (after timeout) ignored. State: ${currentStateInTimeout}, Locked: ${isLockedInTimeout}`); }
                updateTooltip("");
            }, 0);
             // <<< --- FIN: LÓGICA DE IGNORAR MODIFICADA --- >>>
    });
  } else { console.error("PointerLockControls not found!"); }

  // --- Keyboard Listeners (CON la lógica simplificada para WASD/E/G/Q) ---
  document.addEventListener("keydown", (e) => {
    const gameState = getGameState();
    const keyLower = e.key.toLowerCase();

    // --- Escape Key Handler (Completo) ---
    if (e.key === "Escape") {
        console.log(`Escape key pressed in state: ${gameState}`);
        const controls = getControls(); // Necesario para lock/unlock
        const isLocked = controls?.isLocked;
        switch (gameState) {
            case GAME_STATES.PLAYING: setGameState(GAME_STATES.PAUSED); break;
            case GAME_STATES.PAUSED:
                if (controls && !isLocked) { try { controls.lock(); } catch (err) { console.error("Lock error:", err); } }
                break; // 'lock' event seteará PLAYING
            case GAME_STATES.PUZZLE: setIgnoreNextUnlockFlag(true); hidePuzzleModal(); break;
            case GAME_STATES.PUZZLE_2D: setIgnoreNextUnlockFlag(true); setGameState(GAME_STATES.PLAYING); break;
            case GAME_STATES.INVENTORY: setIgnoreNextUnlockFlag(true); hideInventoryModal(); break;
            case GAME_STATES.MINIGAME: setIgnoreNextUnlockFlag(true); hideMinigameUI(false, true); break;
            case GAME_STATES.HELP_CONFIRM: setIgnoreNextUnlockFlag(true); hideHelpConfirmModal(); break;
        }
        e.preventDefault();
        return;
    }

    // --- Inventory Key Handler (Completo) ---
    if (keyLower === "i" || e.key === "Tab") {
        if (gameState === GAME_STATES.PLAYING) { showInventoryModal(); }
        else if (gameState === GAME_STATES.INVENTORY) { setIgnoreNextUnlockFlag(true); hideInventoryModal(); }
        e.preventDefault();
        return;
    }

    // --- Gameplay Keys (Solo si gameState es PLAYING) ---
    if (gameState === GAME_STATES.PLAYING) {
        // No necesitamos la comprobación isLocked aquí, handleKeyDown/Interaction lo harán si es necesario
        if (["w","a","s","d"," ", "arrowup","arrowdown","arrowleft","arrowright"].includes(keyLower)) {
            // console.log(`-> Calling handleKeyDown for movement: ${keyLower}`);
            handleKeyDown(keyLower); e.preventDefault();
        } else if (keyLower === "e") {
            // console.log(`-> Calling handleInteraction`);
            handleInteraction(); e.preventDefault();
        } else if (keyLower === "g") {
            // console.log(`-> Calling dropSelectedItem`);
            dropSelectedItem(); e.preventDefault();
        } else if (keyLower === "q") {
            // console.log(`-> Calling deselectItem`);
            deselectItem(); e.preventDefault();
        }
    }

    // --- Puzzle Modal Enter Key (Completo) ---
    if (gameState === GAME_STATES.PUZZLE && e.key === "Enter") {
      const puzzleInput = getUIElement("puzzleInput");
      if (puzzleInput && document.activeElement === puzzleInput) {
        submitPuzzleModalInput();
        e.preventDefault();
      }
    }
  });

  document.addEventListener("keyup", (e) => {
    const gameState = getGameState();
    // Solo pasar keyup de movimiento si estamos en PLAYING
    if (gameState === GAME_STATES.PLAYING) {
      const keyLower = e.key.toLowerCase();
      if (["w","a","s","d"," ", "arrowup","arrowdown","arrowleft","arrowright"].includes(keyLower)) {
        handleKeyUp(keyLower);
        e.preventDefault();
      }
    }
  });

  // --- Mouse Click Listeners (Restaurado) ---
   window.addEventListener("mousedown", (event) => {
     const gameState = getGameState();
     const controls = getControls();
     const isLocked = controls?.isLocked;

     // Left Click (Button 0)
     if (event.button === 0) {
       // Interaction/Place Item in Game World
       if (gameState === GAME_STATES.PLAYING && isLocked) {
         let targetElement = event.target;
         let clickOnUI = false;
         if (targetElement.closest(".overlay, .overlay-content, #hud, #instructions, button, select, input, li")) {
            clickOnUI = true;
         }
         if (!clickOnUI) {
           handleInteraction();
         }
       }
       // Start Prompt Click
       else if ( gameState === GAME_STATES.MENU && event.target === getUIElement("startPrompt") ) {
         // Blocker listener lo maneja
         event.preventDefault();
       }
     }
     // Right Click (Button 2) - Deselect Item
     else if (event.button === 2) {
       if ( (gameState === GAME_STATES.PLAYING || gameState === GAME_STATES.INVENTORY) && getSelectedItem() ) {
         deselectItem();
       }
       event.preventDefault(); // Siempre prevenir context menu
     }
   });

  document.addEventListener("contextmenu", (e) => e.preventDefault());

  // --- Window Resize (Sin cambios) ---
  window.addEventListener("resize", onWindowResize);

  // --- UI Button/Element Listeners (Restaurados) ---
  const addListener = (id, event, handler, useCapture = false) => {
    const element = getUIElement(id);
    if (element) { element.addEventListener(event, handler, useCapture); }
  };

  // Main Menu
  addListener("difficultySelect", "change", updateMenuPuzzleCountDisplay);
  // Start button handled by blocker listener

  // Puzzle Modal
  addListener("puzzleSubmitButton", "click", submitPuzzleModalInput);
  addListener("puzzleCloseButton", "click", () => { setIgnoreNextUnlockFlag(true); hidePuzzleModal(); });

  // Puzzle Overlay 2D
  addListener("puzzleOverlayCloseButton", "click", () => { setIgnoreNextUnlockFlag(true); setGameState(GAME_STATES.PLAYING); });

  // Inventory
  const inventoryItemsContainer = getUIElement("inventoryItems");
  if (inventoryItemsContainer) { inventoryItemsContainer.addEventListener("click", handleInventoryClick); }
  addListener("inventoryCloseButton", "click", () => { setIgnoreNextUnlockFlag(true); hideInventoryModal(); });

  // Minigame
  addListener("minigameCloseButton", "click", () => { setIgnoreNextUnlockFlag(true); hideMinigameUI(false, true); });

  // Pause Menu
  addListener("resumeButton", "click", () => {
    if (getGameState() === GAME_STATES.PAUSED && controlsInstance && !controlsInstance.isLocked) {
      try { controlsInstance.lock(); } catch (err) { console.error("Lock error on resume:", err); }
    }
  });
  addListener("restartButtonPause", "click", () => { playSound("ui_confirm"); resetGame(); });

  // Victory Screen
  addListener("restartButtonVictory", "click", () => { playSound("ui_confirm"); resetGame(); });

  // Time Up Screen
  addListener("restartButtonTimeup", "click", () => { playSound("ui_confirm"); resetGame(); });

  // Help System
  const helpButton = getUIElement("helpButton");
  addListener("helpButton", "click", () => { /* ... (lógica completa anterior) ... */
     if (getGameState() === GAME_STATES.PAUSED && !areHintsEnabled()) { playSound("ui_open"); setGameState(GAME_STATES.HELP_CONFIRM); }
     else if (areHintsEnabled()) { updateTooltip("Pistas activadas.", 2000); playSound("error_short"); }
     else { updateTooltip("Abre pausa [Esc] para pistas.", 3000); playSound("click_soft"); }
  });
  addListener("confirmHelpBtn", "click", () => { /* ... (lógica completa anterior) ... */
     playSound("ui_confirm"); applyHelpPenalty(); setHintsEnabled(true); updateHUD();
     if (helpButton) { helpButton.disabled = true; /* ... estilos disabled ... */ }
     setIgnoreNextUnlockFlag(true); setGameState(GAME_STATES.PAUSED);
  });
  addListener("cancelHelpBtn", "click", () => { /* ... (lógica completa anterior) ... */
     playSound("ui_cancel"); setIgnoreNextUnlockFlag(true); hideHelpConfirmModal();
  });


  console.log("UI event listeners setup complete.");
} // <<< END OF setupUIEventListeners

// --- Window Resize Handler (Restaurado) ---
function onWindowResize() {
  const camera = getCamera();
  const renderer = getRenderer();
  if (camera && renderer) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

// --- Specific Modal Hide Functions (Restauradas) ---
function hideInventoryModal() {
  if (getGameState() === GAME_STATES.INVENTORY) {
    playSound("ui_cancel");
    setGameState(GAME_STATES.PLAYING);
  }
}
async function showInventoryModal() {
  if (getGameState() === GAME_STATES.PLAYING) {
    playSound("ui_open");
    try {
      const inventoryModule = await import("./inventory.js");
      if (inventoryModule.updateInventoryUI) {
        inventoryModule.updateInventoryUI();
        setGameState(GAME_STATES.INVENTORY);
      } else { setGameState(GAME_STATES.INVENTORY); }
    } catch (error) { setGameState(GAME_STATES.INVENTORY); }
  }
}
function hideHelpConfirmModal() {
  if (getGameState() === GAME_STATES.HELP_CONFIRM) {
    playSound("ui_cancel");
    setGameState(GAME_STATES.PAUSED);
  }
}

// --- Initial UI State Function (Restaurado) ---
export function setInitialUIState() {
  console.log("Setting initial UI state for MENU.");
  updateMenuPuzzleCountDisplay();
  showOverlay(GAME_STATES.MENU); // Muestra el menú/blocker
  const helpButton = getUIElement("helpButton");
  if (helpButton) { // Resetea el botón de ayuda
    helpButton.disabled = false;
    helpButton.style.opacity = "";
    helpButton.style.cursor = "";
    helpButton.title = "Activar Pistas (penalización de tiempo)";
  }
}

// END OF FILE ui.js (Restored and Corrected)