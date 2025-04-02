import { getGameState, setGameState, startGame, resetGame, GAME_STATES, setIgnoreNextUnlockFlag, getIgnoreNextUnlockFlag, setHintsEnabled } from './main.js';
import { handleKeyDown, handleKeyUp } from './playerControls.js';
import { handleInteraction, dropSelectedItem } from './interaction.js';
import { handleInventoryClick, getSelectedItem, deselectItem } from './inventory.js';
import { getActivePuzzlesCount, getSolvedPuzzlesCount, getPuzzleDefinition } from './puzzles.js'; // To get puzzle info for modals
import { isTimerRunning, getFormattedTime, applyHelpPenalty } from './timer.js'; // Timer info for HUD/Help
import { playSound } from './audio.js'; // For UI sounds

// --- UI Element References ---
let uiElements = {};

function cacheUIElements() {
    const ids = [
        'blocker', 'instructions', 'hud', 'objectiveText', 'puzzlesSolvedText', 'puzzlesTotalText',
        'timerDisplay', 'timerText', 'inventoryModal', 'inventoryModalContent', 'inventoryItems',
        'inventoryCloseButton', 'tooltip', 'puzzleModal', 'puzzleModalContent', 'puzzleTitle',
        'puzzleDescription', 'puzzleContent', 'puzzleInput', 'puzzleMessage', 'puzzleSubmitButton',
        'puzzleCloseButton', 'puzzleOverlay2D', 'puzzleOverlayContent', 'puzzleOverlayTitle',
        'puzzleOverlayDescription', 'puzzleOverlayArea', 'puzzleOverlayCloseButton', 'minigameOverlay',
        'minigameContent', 'minigameTitle', 'minigameArea', 'minigameInstructions', 'minigameCloseButton',
        'victoryScreen', 'restartButtonVictory', 'gameoverScreen', 'gameoverScreenContent',
        'pausePuzzlesCount', 'resumeButton', 'restartButtonPause', 'timeupOverlay', 'timeupContent',
        'restartButtonTimeup', 'pointer', 'difficultySelect', 'menuPuzzleCountDisplay', 'startPrompt',
        'helpButton', 'helpConfirmModal', 'helpConfirmContent', 'confirmHelpBtn', 'cancelHelpBtn'
    ];
    ids.forEach(id => {
        uiElements[id] = document.getElementById(id);
        // if (!uiElements[id]) console.warn(`UI element not found: #${id}`); // Optional warning
    });
     // Add specific checks for crucial elements
     if (!uiElements.blocker) console.error("CRITICAL UI ELEMENT MISSING: #blocker");
     if (!uiElements.inventoryItems) console.error("CRITICAL UI ELEMENT MISSING: #inventoryItems");
}

// Call once on script load
cacheUIElements();

export function getUIElement(id) {
    return uiElements[id];
}

// --- Overlay Management ---
const overlayMap = {
    [GAME_STATES.MENU]: 'blocker',
    [GAME_STATES.PAUSED]: 'gameoverScreen',
    [GAME_STATES.PUZZLE]: 'puzzleModal',
    [GAME_STATES.PUZZLE_2D]: 'puzzleOverlay2D',
    [GAME_STATES.INVENTORY]: 'inventoryModal',
    [GAME_STATES.MINIGAME]: 'minigameOverlay',
    [GAME_STATES.VICTORY]: 'victoryScreen',
    [GAME_STATES.GAMEOVER_TIMEUP]: 'timeupOverlay',
    [GAME_STATES.HELP_CONFIRM]: 'helpConfirmModal',
};

export function showOverlay(state) {
    // Hide all overlays first
    Object.values(overlayMap).forEach(overlayId => {
        const element = uiElements[overlayId];
        if (element) element.style.display = 'none';
    });
    // Hide HUD by default
    if (uiElements.hud) uiElements.hud.style.display = 'none';
    if (uiElements.pointer) uiElements.pointer.style.display = 'none';
     if (uiElements.tooltip) uiElements.tooltip.style.display = 'none'; // Hide tooltip when overlay shown


    // Show the specific overlay for the current state
    const overlayToShowId = overlayMap[state];
    if (overlayToShowId) {
        const element = uiElements[overlayToShowId];
        if (element) element.style.display = 'flex'; // Use flex for centering
    }

    // Show HUD specifically for these states
    if ([GAME_STATES.PLAYING, GAME_STATES.PUZZLE, GAME_STATES.PUZZLE_2D, GAME_STATES.MINIGAME].includes(state)) {
         if (uiElements.hud) uiElements.hud.style.display = 'block';
    }
    // Show pointer only when playing
     if (state === GAME_STATES.PLAYING) {
          if (uiElements.pointer) uiElements.pointer.style.display = 'block';
     }

}

export function hideOverlay(overlayId) { // Helper if needed
     const element = uiElements[overlayId];
     if (element) element.style.display = 'none';
}

// --- HUD Update ---
export function updateHUD() {
    const gameState = getGameState(); // Get current state

    if (!uiElements.puzzlesSolvedText || !uiElements.objectiveText || !uiElements.timerText) return;

    const solvedCount = getSolvedPuzzlesCount();
    const totalCount = getActivePuzzlesCount(); // Excluding door

    // Update puzzle count display (both in HUD and Pause Menu)
    uiElements.puzzlesSolvedText.textContent = solvedCount;
     if(uiElements.puzzlesTotalText) uiElements.puzzlesTotalText.textContent = totalCount; // Update total in HUD
    if (uiElements.pausePuzzlesCount) uiElements.pausePuzzlesCount.textContent = solvedCount; // Update pause menu count

    // Update Objective Text (Simplified for now)
    let currentObjective = "Explora la habitación...";
    // TODO: Add more sophisticated objective logic based on active puzzles and inventory
    const activePuzzles = getActivePuzzles();
    const firstUnsolved = activePuzzles.find(p => p.id !== 'escapeDoor' && !p.isMarkedSolved);
    if (firstUnsolved) {
         // Requires check can be complex, keep it simple or enhance later
         currentObjective = `Resuelve: ${firstUnsolved.name || firstUnsolved.id}`;
    } else if (activePuzzles.length > 0) { // All non-door puzzles solved
         const door = activePuzzles.find(p => p.id === 'escapeDoor');
         currentObjective = door ? `Abre la ${door.name}` : "Encuentra la salida!";
    }
    uiElements.objectiveText.textContent = `Objetivo: ${currentObjective}`;

    // Update Timer Display
    if (isTimerRunning() || gameState === GAME_STATES.PAUSED || gameState === GAME_STATES.GAMEOVER_TIMEUP) {
        if (uiElements.timerDisplay) uiElements.timerDisplay.style.display = 'block';
        uiElements.timerText.textContent = getFormattedTime();
    } else {
        if (uiElements.timerDisplay) uiElements.timerDisplay.style.display = 'none';
    }
}

export function updatePuzzlesTotalUI(total) {
     if(uiElements.puzzlesTotalText) {
          uiElements.puzzlesTotalText.textContent = total;
     }
}


// --- Tooltip ---
let tooltipTimeoutId = null;
export function updateTooltip(text, duration = null) {
    if (!uiElements.tooltip) return;
    const trimmedText = text ? text.trim() : '';

    // Clear previous timeout if any
    if (tooltipTimeoutId) {
        clearTimeout(tooltipTimeoutId);
        tooltipTimeoutId = null;
    }

    // Show tooltip only if playing, pointer locked, and text is not empty
    const show = trimmedText !== '' && getGameState() === GAME_STATES.PLAYING && getControls()?.isLocked;

    uiElements.tooltip.textContent = trimmedText;
    uiElements.tooltip.style.display = show ? 'block' : 'none';

    // Set new timeout if duration is provided
    if (show && duration && duration > 0) {
        tooltipTimeoutId = setTimeout(() => {
            if (uiElements.tooltip) uiElements.tooltip.style.display = 'none';
            tooltipTimeoutId = null;
        }, duration);
    }
}

// --- Difficulty Selector ---
export function getDifficultyValue() {
    return uiElements.difficultySelect ? parseInt(uiElements.difficultySelect.value, 10) : 4; // Default Easy
}

export function updateMenuPuzzleCountDisplay() {
    if (!uiElements.menuPuzzleCountDisplay || !uiElements.difficultySelect) return;
    const value = uiElements.difficultySelect.value;
    let displayCount = "?";
    if (value === "-1") {
        displayCount = "Todos";
    } else {
        const count = parseInt(value, 10);
        if (!isNaN(count)) displayCount = count;
    }
    uiElements.menuPuzzleCountDisplay.textContent = displayCount;
}


// --- Puzzle Modal ---
let currentPuzzleModalRef = null; // Store reference to the active puzzle config for checkSolution

export function showPuzzleModalContent(puzzleRefId, puzzleId, title, description, inputType = 'text', placeholder = 'Introduce...') {
    currentPuzzleModalRef = { // Store required info
        id: puzzleRefId, // The specific instance/object ID if needed, often same as puzzleId
        puzzleId: puzzleId, // The puzzle definition ID
    };

    if (uiElements.puzzleTitle) uiElements.puzzleTitle.textContent = title;
    if (uiElements.puzzleDescription) uiElements.puzzleDescription.textContent = description;
    if (uiElements.puzzleMessage) uiElements.puzzleMessage.textContent = ''; // Clear message
    if (uiElements.puzzleInput) {
        uiElements.puzzleInput.type = inputType;
        uiElements.puzzleInput.placeholder = placeholder;
        uiElements.puzzleInput.value = ''; // Clear previous input
        uiElements.puzzleInput.style.display = 'block'; // Ensure visible
    }
    setGameState(GAME_STATES.PUZZLE); // This shows the modal via showOverlay
     // Focus input after short delay
     if (uiElements.puzzleInput) {
          setTimeout(() => uiElements.puzzleInput.focus(), 100);
     }
}

export function hidePuzzleModal() {
     if (getGameState() === GAME_STATES.PUZZLE) {
          playSound('ui_cancel'); // Closing sound
          currentPuzzleModalRef = null; // Clear reference
          setGameState(GAME_STATES.PLAYING); // Return to playing state
     }
}

function submitPuzzleModalInput() {
    if (getGameState() === GAME_STATES.PUZZLE && currentPuzzleModalRef?.puzzleId && uiElements.puzzleInput) {
        const puzzleDef = getPuzzleDefinition(currentPuzzleModalRef.puzzleId);
        if (puzzleDef && typeof puzzleDef.checkSolution === 'function') {
             // Call the puzzle's checkSolution function from puzzles.js
             puzzleDef.checkSolution(uiElements.puzzleInput.value);
             // The checkSolution function should handle updating the puzzleMessage,
             // playing sounds, granting rewards, and potentially closing the modal on success.
        } else {
            console.warn(`No checkSolution function found for puzzle: ${currentPuzzleModalRef.puzzleId}`);
            playSound('error_short');
             if (uiElements.puzzleMessage) uiElements.puzzleMessage.textContent = 'Error: No se puede verificar la solución.';
        }
    } else {
         console.warn("Submit puzzle called in wrong state or without reference/input.");
         playSound('error_short');
    }
}


// --- Minigame UI Handling ---
let currentMinigameSuccessCallback = null;

// Placeholder: Actual minigame implementations (like wires, simon says)
// would live in separate files and be imported/called here.
const minigameImplementations = {
    wires: {
        init: (areaElement, instructionsElement, winCallback, loseCallback) => {
             areaElement.innerHTML = `
              <div style="color: white; font-size: 16px; padding: 15px; border: 1px dashed #88a;">
                  <h4>Minijuego: Conectar Cables</h4>
                  <p style="font-size:14px; color:#ccc;">(Simulación - Implementación Pendiente)</p>
                  <p style="font-size:12px; color:#aaa;">Conecta los puntos del mismo color sin cruzar los cables.</p>
                  <br/>
                  <button class="minigame-sim-btn">Simular Victoria</button>
                  <button class="minigame-sim-btn">Simular Derrota</button>
              </div>`;
             instructionsElement.textContent = "Conecta los cables del mismo color.";
             // Add listeners for simulation buttons (REMOVE LATER)
             areaElement.querySelectorAll('.minigame-sim-btn').forEach((btn, index) => {
                  btn.onclick = () => {
                       if (index === 0) winCallback(); else loseCallback();
                  };
             });
        },
        cleanup: (areaElement) => { areaElement.innerHTML = ''; /* Remove specific listeners */ }
    },
    simon: {
         init: (areaElement, instructionsElement, winCallback, loseCallback) => {
              areaElement.innerHTML = `
               <div style="color: white; font-size: 16px; padding: 15px; border: 1px dashed #8a8;">
                   <h4>Minijuego: Simon Says</h4>
                   <p style="font-size:14px; color:#ccc;">(Simulación - Implementación Pendiente)</p>
                   <p style="font-size:12px; color:#aaa;">Observa la secuencia de luces y repítela correctamente.</p>
                   <br/>
                   <button class="minigame-sim-btn">Simular Victoria</button>
                   <button class="minigame-sim-btn">Simular Derrota</button>
               </div>`;
              instructionsElement.textContent = "Repite la secuencia de luces.";
               // Add listeners for simulation buttons (REMOVE LATER)
               areaElement.querySelectorAll('.minigame-sim-btn').forEach((btn, index) => {
                    btn.onclick = () => {
                         if (index === 0) winCallback(); else loseCallback();
                    };
               });
         },
         cleanup: (areaElement) => { areaElement.innerHTML = ''; }
     }
    // Add more minigame implementations here
};

export function showMinigameUI(minigameId, successCallback) {
    if (!uiElements.minigameArea || !uiElements.minigameTitle || !uiElements.minigameInstructions) {
         console.error("Minigame UI elements not found!"); return;
    }
    const implementation = minigameImplementations[minigameId];
    if (!implementation) {
         console.error(`Minigame implementation not found for ID: ${minigameId}`);
         uiElements.minigameArea.innerHTML = `<div>Error: Minijuego "${minigameId}" no implementado.</div>`;
         uiElements.minigameTitle.textContent = "Error Minijuego";
         uiElements.minigameInstructions.textContent = "";
         setGameState(GAME_STATES.MINIGAME); // Show the overlay even on error
         return;
    }

    currentMinigameSuccessCallback = successCallback; // Store callback

    // Set title (could be dynamic based on implementation)
    uiElements.minigameTitle.textContent = minigameId === 'wires' ? "Conectar Cables" : minigameId === 'simon' ? "Simon Says" : "Minijuego";

    // Define win/lose handlers that close the UI
    const handleWin = () => {
         playSound('success'); // Play win sound
         if (currentMinigameSuccessCallback) {
              currentMinigameSuccessCallback(); // Execute the puzzle's success logic
         }
         hideMinigameUI(minigameId); // Close the UI
    };
    const handleLose = () => {
         playSound('error_short'); // Play lose sound
         updateTooltip("Minijuego fallido. Inténtalo de nuevo."); // Show tooltip briefly after closing
         hideMinigameUI(minigameId); // Close the UI
    };

    // Initialize the specific minigame's UI
    try {
         implementation.init(uiElements.minigameArea, uiElements.minigameInstructions, handleWin, handleLose);
    } catch (error) {
         console.error(`Error initializing minigame "${minigameId}":`, error);
         uiElements.minigameArea.innerHTML = `<div>Error al cargar minijuego.</div>`;
    }

    playSound('ui_open'); // Sound for opening minigame
    setGameState(GAME_STATES.MINIGAME); // Show the overlay
}

export function hideMinigameUI(minigameId, manuallyClosed = false) {
     if (getGameState() !== GAME_STATES.MINIGAME) return;

     if(manuallyClosed) playSound('ui_cancel');

     const implementation = minigameImplementations[minigameId];
     if (implementation && implementation.cleanup) {
          try {
               implementation.cleanup(uiElements.minigameArea);
          } catch (error) {
               console.error(`Error cleaning up minigame "${minigameId}":`, error);
          }
     } else {
          if (uiElements.minigameArea) uiElements.minigameArea.innerHTML = ''; // Default cleanup
     }

     currentMinigameSuccessCallback = null;
     setGameState(GAME_STATES.PLAYING); // Return to game
}


// --- Event Listener Setup ---
export function setupUIEventListeners() {
    console.log("Setting up UI event listeners...");
    const controls = getControls(); // Need controls for locking/unlocking

    // --- Blocker / Start ---
    if (uiElements.blocker && uiElements.startPrompt) {
        uiElements.blocker.addEventListener('click', (e) => {
            if (getGameState() === GAME_STATES.MENU && e.target === uiElements.startPrompt) {
                console.log("StartPrompt clicked: Attempting lock...");
                 if (controls && !controls.isLocked) controls.lock(); // Lock triggers startGame via 'lock' event
            }
        });
    }

    // --- Pointer Lock/Unlock Events (Managed by Controls) ---
    if (controls) {
        controls.addEventListener('lock', () => {
            console.log("Pointer locked event.");
            // If lock happens from specific states, transition to PLAYING
            const currentState = getGameState();
            if (currentState === GAME_STATES.MENU) {
                 startGame(); // First lock from menu starts game
            } else if ([GAME_STATES.PAUSED, GAME_STATES.PUZZLE, GAME_STATES.PUZZLE_2D, GAME_STATES.INVENTORY, GAME_STATES.MINIGAME, GAME_STATES.HELP_CONFIRM].includes(currentState)) {
                 setGameState(GAME_STATES.PLAYING); // Resume from overlays/modals
            }
            // Refresh hover check timer on lock/resume
             lastHoverCheckTime = performance.now(); // Use variable from main.js or pass setter
        });

        controls.addEventListener('unlock', () => {
            console.log("Pointer unlocked event.");
             const ignoreUnlock = getIgnoreNextUnlockFlag();
            if (ignoreUnlock) {
                setIgnoreNextUnlockFlag(false); // Reset flag
                console.log("Unlock event ignored (intentional modal/overlay close).");
                return;
            }
            // If playing and unlock wasn't intentional, pause
            if (getGameState() === GAME_STATES.PLAYING) {
                console.log("Unexpected unlock while playing -> PAUSED.");
                setGameState(GAME_STATES.PAUSED);
            }
             // If in another state (MENU, already PAUSED), unlock is expected/handled
        });
    }

    // --- Keyboard Listeners ---
    document.addEventListener('keydown', (e) => {
        const gameState = getGameState();

        // --- Escape Key Logic ---
        if (e.key === 'Escape') {
            console.log(`Escape key pressed in state: ${gameState}`);
            switch (gameState) {
                case GAME_STATES.PLAYING:
                    setGameState(GAME_STATES.PAUSED); break;
                case GAME_STATES.PUZZLE:
                    setIgnoreNextUnlockFlag(true); hidePuzzleModal(); break;
                case GAME_STATES.PUZZLE_2D:
                     // No specific function needed, handled by button/lock event
                     console.warn("Escape in PUZZLE_2D - No specific handler, should use button or lock."); break;
                case GAME_STATES.INVENTORY:
                    setIgnoreNextUnlockFlag(true); hideInventoryModal(); break; // Call specific hide function
                case GAME_STATES.MINIGAME:
                     setIgnoreNextUnlockFlag(true);
                     const minigameId = uiElements.minigameTitle.textContent === "Conectar Cables" ? "wires" : uiElements.minigameTitle.textContent === "Simon Says" ? "simon" : null; // Infer ID hackily
                     if(minigameId) hideMinigameUI(minigameId, true); else console.warn("Could not determine minigame ID to close on Escape.");
                     break;
                 case GAME_STATES.HELP_CONFIRM:
                      setIgnoreNextUnlockFlag(true); hideHelpConfirmModal(); break; // Hide help modal
                case GAME_STATES.PAUSED:
                    console.log("Escape in PAUSED: attempting lock to resume...");
                    if (controls && !controls.isLocked) controls.lock(); break;
                // No action needed for MENU, VICTORY, GAMEOVER_TIMEUP
            }
            e.preventDefault(); // Prevent potential browser actions for Escape
            return;
        }

        // --- Inventory Key ---
        if (e.key.toLowerCase() === 'i') {
            if (gameState === GAME_STATES.PLAYING) {
                showInventoryModal();
            } else if (gameState === GAME_STATES.INVENTORY) {
                setIgnoreNextUnlockFlag(true); hideInventoryModal();
            }
            e.preventDefault(); return;
        }

        // --- Gameplay Keys (Movement, Interaction) ---
        if (gameState === GAME_STATES.PLAYING) {
            const keyLower = e.key.toLowerCase();
            if (['w', 'a', 's', 'd', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(keyLower)) {
                 handleKeyDown(keyLower); // Pass to player controls
                 e.preventDefault(); // Prevent space scrolling page
            } else if (keyLower === 'e') {
                 handleInteraction(); e.preventDefault();
            } else if (keyLower === 'g') {
                 dropSelectedItem(); e.preventDefault();
            } else if (keyLower === 'q') {
                 deselectItem(); e.preventDefault();
            }
        }

        // --- Puzzle Modal Input ---
        if (gameState === GAME_STATES.PUZZLE && e.key === 'Enter' && document.activeElement === uiElements.puzzleInput) {
             submitPuzzleModalInput();
             e.preventDefault();
        }
    });

    document.addEventListener('keyup', (e) => {
        // Pass keyup events for movement to playerControls
         const keyLower = e.key.toLowerCase();
         if (['w', 'a', 's', 'd', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(keyLower)) {
              handleKeyUp(keyLower);
              e.preventDefault();
         }
    });

    // --- Mouse Click Listeners ---
    window.addEventListener('mousedown', (event) => { // Use mousedown for interaction responsiveness
        const gameState = getGameState();
        const controls = getControls();
        // Left Click (Interaction/Place)
        if (event.button === 0 && gameState === GAME_STATES.PLAYING && controls?.isLocked) {
             // Check if click is on UI overlay elements - if so, ignore world interaction
             const isClickOnOverlay = event.target.closest('.overlay, #hud'); // Check if target or ancestor is overlay/hud
             if (isClickOnOverlay) {
                  console.log("Ignoring world interaction click on UI element."); return;
             }
             handleInteraction(); // Perform world interaction or place held object
             event.preventDefault(); // Prevent text selection etc.
        }
        // Right Click (Deselect Item)
        else if (event.button === 2) {
             if ((gameState === GAME_STATES.PLAYING || gameState === GAME_STATES.INVENTORY) && getSelectedItem()) {
                  deselectItem();
             }
             event.preventDefault(); // Prevent context menu always
        }
    });

    // Prevent context menu globally (right-click already handled above)
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    // --- Window Resize ---
    window.addEventListener('resize', onWindowResize);

    // --- UI Button/Element Listeners ---
    // Helper to add listener if element exists
    const addListener = (id, event, handler) => {
        const element = uiElements[id];
        if (element) element.addEventListener(event, handler);
        else console.warn(`Listener not added: Element #${id} not found.`);
    };

    addListener('difficultySelect', 'change', updateMenuPuzzleCountDisplay);

    // Puzzle Modal
    addListener('puzzleSubmitButton', 'click', submitPuzzleModalInput);
    addListener('puzzleCloseButton', 'click', () => { setIgnoreNextUnlockFlag(true); hidePuzzleModal(); });

    // Puzzle Overlay 2D
    addListener('puzzleOverlayCloseButton', 'click', () => {
        setIgnoreNextUnlockFlag(true);
        // Need a way to hide this - maybe a generic hideOverlay or specific function?
        // hide2DPuzzleOverlay(); // Assuming this exists or use setGameState(PLAYING)
         setGameState(GAME_STATES.PLAYING); // Simpler: just go back to playing
    });

    // Inventory
    addListener('inventoryItems', 'click', handleInventoryClick);
    addListener('inventoryCloseButton', 'click', () => { setIgnoreNextUnlockFlag(true); hideInventoryModal(); });

     // Minigame
     addListener('minigameCloseButton', 'click', () => {
          setIgnoreNextUnlockFlag(true);
          // Need to know which minigame is active to call cleanup
          const minigameId = uiElements.minigameTitle.textContent === "Conectar Cables" ? "wires" : uiElements.minigameTitle.textContent === "Simon Says" ? "simon" : null;
          if (minigameId) hideMinigameUI(minigameId, true); else console.warn("Could not determine minigame ID to close.");
     });

    // Pause Menu
    addListener('resumeButton', 'click', () => {
        if (getGameState() === GAME_STATES.PAUSED) {
             if (controls && !controls.isLocked) controls.lock(); // Lock triggers resume
        }
    });
    addListener('restartButtonPause', 'click', resetGame);

    // Victory Screen
    addListener('restartButtonVictory', 'click', resetGame);

    // Time Up Screen
    addListener('restartButtonTimeup', 'click', resetGame);

     // Help Button & Modal
     addListener('helpButton', 'click', () => {
          if (getGameState() === GAME_STATES.PAUSED && !areHintsEnabled()) {
              setGameState(GAME_STATES.HELP_CONFIRM); // Show confirmation modal
          } else if (areHintsEnabled()) {
              updateTooltip("Las pistas ya están activadas.", 2000);
          }
     });
     addListener('confirmHelpBtn', 'click', () => {
          applyHelpPenalty(); // Halve timer
          setHintsEnabled(true); // Enable hints globally
          updateHUD(); // Update timer display
          // Disable help button visually
          if(uiElements.helpButton) { uiElements.helpButton.disabled = true; uiElements.helpButton.style.opacity = 0.6; uiElements.helpButton.style.cursor = 'not-allowed'; uiElements.helpButton.textContent = "Pistas Activadas"; }
          playSound('ui_confirm');
           setIgnoreNextUnlockFlag(true); // Prevent immediate pause if lock was released
          setGameState(GAME_STATES.PAUSED); // Go back to pause menu state
     });
      addListener('cancelHelpBtn', 'click', () => {
           playSound('ui_cancel');
            setIgnoreNextUnlockFlag(true);
          setGameState(GAME_STATES.PAUSED); // Go back to pause menu state
      });


    console.log("UI event listeners setup complete.");
}

// --- Window Resize Handler ---
function onWindowResize() {
    const camera = getCamera();
    const renderer = getRenderer();
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        console.log("Window resized.");
    }
}

// --- Specific Modal Hide Functions (called by Escape key handler etc) ---
function hideInventoryModal() {
     if (getGameState() === GAME_STATES.INVENTORY) {
          playSound('ui_cancel');
          setGameState(GAME_STATES.PLAYING);
     }
}
function showInventoryModal() {
     if (getGameState() === GAME_STATES.PLAYING) {
          // Update UI before showing
          const { updateInventoryUI } = await import('./inventory.js');
          updateInventoryUI();
          setGameState(GAME_STATES.INVENTORY);
     }
}
 function hideHelpConfirmModal() {
      if (getGameState() === GAME_STATES.HELP_CONFIRM) {
           // Go back to paused state without applying penalty
           playSound('ui_cancel');
           setGameState(GAME_STATES.PAUSED);
      }
 }

// Make sure relevant functions are exported if needed by other modules
// (e.g., updateHUD, updateTooltip, showPuzzleModalContent, showMinigameUI)