import * as THREE from "three"; // Needed for object creation in setup
import {
  getScene,
  getCamera,
  setGameState,
  GAME_STATES,
  areHintsEnabled,
} from "./main.js"; // Import game state and utils
import {
  updateTooltip,
  showPuzzleModalContent,
  hidePuzzleModal,
  showMinigameUI,
  hideMinigameUI,
} from "./ui.js";
import {
  addItemToInventory,
  removeItemFromInventory,
  getInventory,
  getSelectedItem,
  deselectItem,
  createPickupItem as createInvPickupItem,
} from "./inventory.js"; // Needs access to inventory
import {
  addInteractableObject,
  removeInteractableObject,
  addCollisionObject,
  removeCollisionObject,
  getHeldObject,
  clearHoveredObject,
} from "./interaction.js"; // Needs to manage objects
import { playSound } from "./audio.js";
import { resetMeshVisualState } from "./sceneSetup.js"; // For resetting static meshes

// --- Global Puzzle State ---
let activePuzzles = []; // Puzzles chosen for the current game instance
let puzzlesSolvedCount = 0;

// --- Puzzle Chain/Reward State (Managed by selectPuzzles) ---
let assignedRewards = {}; // Map: puzzleId -> assignedRewardName

// --- Specific Puzzle States ---
let bookPuzzleSolved = false;
let bookPuzzleEnabled = false; // Controlled by a signal reward
let firstBookClicked = null;
const bookColorNames = ["Red", "Green", "Blue", "Purple"]; // Optional names
const bookSwapCorrectSequence = [0x006400, 0x8b0000, 0x4b0082, 0x00008b]; // Correct (Verde, Rojo, Violeta, Azul)

// --- Available Rewards Pool ---
// This list contains *all* possible items/clues puzzles can grant.
// selectPuzzles will pick from this list to assign rewards dynamically.
const AVAILABLE_REWARDS = [
  "Item_Llave_Dorada", //'Item_Llave_Maestra', // Master Key usually reserved for the end
  "Item_Llave_Pequeña",
  "Item_Destornillador",
  "Clue_Codigo_Vent (789)",
  "Clue_Codigo_Safe (123)",
  "Clue_Riddle (Tengo ojos...)",
  "Clue_Color_Sequence (Rojo, Azul, Verde)",
  "Clue_Book_Sequence (Verde, Rojo, Violeta, Azul)",
  "Item_Linterna_UV",
  "Clue_Password_Panel (HIDDEN)",
  "Item_Diapositiva",
  "Item_Bateria",
  "Clue_Codigo_Final (DOOR456)", // This might also be reserved?
  "Clue_Symbol_Key (Estrella=A...)", // From liftRug description
  "Clue_Under_Cube (Símbolo X?)", // From cube pickup
];
let availableRewardsPool = []; // Will be populated in selectPuzzles

// =============================================================================
// PUZZLE DEFINITIONS (allPuzzles Array)
// =============================================================================
// Structure:
// id: Unique identifier string
// name: Player-facing name
// description: Hint or basic description (can be overridden)
// requires: null, string (Item_X / Clue_Y), or array of strings. Checked by checkRequirements.
// rewardType: 'Item', 'Clue', 'Signal', 'Location', 'Victory', null (indicates *what kind* of reward)
// setup: Function (scene) => {} (Optional: Creates dynamic objects or configures static ones for THIS puzzle)
// interact: Function (object, selectedItem) => {} (Logic when player interacts)
// checkSolution: Function (inputValue) => boolean (For modal puzzles)
// cleanup: Function (scene) => {} (Optional: Specific cleanup needed beyond standard removal)
// difficultyRestriction: null or array ['Difficult', 'Expert'] (Restricts puzzle to these modes)
// -----------------------------------------------------------------------------

const allPuzzles = [
  // --- Holdable Cube & Pressure Plate Chain ---
  {
    id: "demo_holdableCube",
    name: "Cubo Azul",
    description: "Un cubo azul pesado.",
    requires: null, // No item needed to pick up initially
    rewardType: null, // The reward is enabling the pressure plate
    difficultyRestriction: null,
    setup: (s) => {
      const g = new THREE.BoxGeometry(0.4, 0.4, 0.4);
      const m = new THREE.MeshStandardMaterial({
        color: 0x0077cc,
        metalness: 0.6,
        roughness: 0.4,
      });
      const c = new THREE.Mesh(g, m);
      c.position.set(-1.5, 0.2, -0.5); // Initial position
      c.name = "demo_holdableCube_Mesh";
      c.castShadow = true;
      c.receiveShadow = true;
      c.userData = {
        puzzleId: "demo_holdableCube", // Link to this definition
        interactable: true,
        holdable: true, // Can be picked up
        hint: "Recoger Cubo Azul [E]",
        baseHint: "Un cubo azul.",
        solved: false,
        name: "Cubo Azul",
      };
      s.add(c);
      addInteractableObject(c);
      addCollisionObject(c);
      console.log("Holdable Cube created by setup.");
    },
    interact: null, // Interaction handled by global pickupHoldableObject in interaction.js
    checkSolution: null, // Solved state handled by placeHeldObject in interaction.js
    cleanup: null, // Dynamically created, removed by main cleanup
  },
  {
    id: "pressurePlate",
    name: "Placa de Presión",
    description: "Una placa en el suelo. Parece necesitar peso.",
    requires: "Item_Cubo_Azul", // Conceptually requires the cube to be placed
    rewardType: "Item", // Grants an item when activated
    difficultyRestriction: null,
    setup: (s) => {
      // Configures the *existing* mesh created in sceneSetup.js
      const plateMesh = s.getObjectByName("pressurePlate");
      if (!plateMesh) {
        console.error("Pressure Plate mesh not found during setup!");
        return;
      }
      // Assign puzzle-specific data for this game instance
      plateMesh.userData = {
        ...plateMesh.userData, // Keep base data (isPressurePlate, originalY, etc.)
        puzzleId: "pressurePlate",
        requires: "Item_Cubo_Azul", // What needs to be placed
        // assignedReward will be added by selectPuzzles
        solved: false, // Reset solved state for this game
        hint: "Una placa de presión. ¿Quizás el cubo azul encaja aquí?", // Update hint
      };
      // Reset visual state (ensure it's up, normal color)
      resetMeshVisualState(plateMesh);
      console.log(`Pressure Plate puzzle configured.`);
    },
    interact: null, // Not directly interacted with; triggered by placeHeldObject
    checkSolution: null,
    cleanup: null, // Static mesh state reset by main cleanup
  },

  // --- Key Lock Chest ---
  {
    id: "demo_keyLock",
    name: "Cofre de Madera",
    description: "Un cofre cerrado con una cerradura dorada.",
    requires: "Item_Llave_Dorada",
    rewardType: "Item", // Contains an item
    difficultyRestriction: null,
    setup: (s) => {
      // Creates the chest mesh dynamically
      const g = new THREE.BoxGeometry(0.9, 0.5, 0.6);
      const chestMat = new THREE.MeshStandardMaterial({
        color: 0x654321,
        roughness: 0.75,
        metalness: 0.05,
      }); // Simple wood
      const c = new THREE.Mesh(g, chestMat);
      c.position.set(1.5, 0.25, 4.8); // Position on the floor
      c.name = "demo_keyLock_Chest";
      c.castShadow = true;
      c.receiveShadow = true;
      c.userData = {
        puzzleId: "demo_keyLock",
        interactable: true,
        hint: `Cofre cerrado (Necesita Llave Dorada)`,
        baseHint: `Un cofre de madera.`,
        solved: false,
        requires: "Item_Llave_Dorada",
      };
      s.add(c);
      addInteractableObject(c);
      addCollisionObject(c);
      console.log("Key Lock Chest created by setup.");
    },
    interact: async (chest, selectedItemName) => {
      const data = chest.userData;
      if (data.solved) {
        updateTooltip("El cofre ya está abierto.");
        return;
      }

      if (selectedItemName === data.requires) {
        data.solved = true;
        playSound("unlock_heavy"); // Sound of opening chest
        // Optional: Animate chest opening (e.g., rotate lid)
        data.hint = `Cofre abierto`;
        updateTooltip(`Usaste ${selectedItemName}, el cofre se abre.`);
        removeItemFromInventory(selectedItemName); // Consume the key
        deselectItem(); // Deselect the used key
        markPuzzleSolved(data.puzzleId);
        // Grant reward (creates pickup inside/nearby)
        const { grantPuzzleReward } = await import("./puzzles.js"); // Dynamic import needed here?
        grantPuzzleReward(
          data.puzzleId,
          chest.position.clone().add(new THREE.Vector3(0, 0.3, 0))
        ); // Spawn above chest
      } else if (getInventory().includes(data.requires)) {
        // Has key but not selected
        updateTooltip(
          `Necesitas seleccionar la ${data.requires} del inventario [I].`
        );
        playSound("click_soft");
      } else {
        // Doesn't have key
        updateTooltip(data.hint); // "Needs Golden Key"
        playSound("locked_drawer"); // Locked sound
      }
    },
    checkSolution: null,
    cleanup: null, // Dynamic, removed by main cleanup
  },

  // --- Simple Button ---
  {
    id: "demo_simpleButton",
    name: "Botón de Pared",
    description: "Un simple botón rojo en la pared.",
    requires: null,
    rewardType: "Item", // Reveals an item
    difficultyRestriction: null,
    setup: (s) => {
      const g = new THREE.CylinderGeometry(0.1, 0.1, 0.08, 16);
      const m = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        metalness: 0.3,
        roughness: 0.7,
      });
      const b = new THREE.Mesh(g, m);
      b.position.set(
        getScene().getObjectByName("wallRight").position.x - 0.05,
        1.5,
        2.5
      ); // On right wall
      b.rotation.set(0, 0, Math.PI / 2); // Orient button correctly
      b.name = "demo_simpleButton_Mesh";
      b.castShadow = true;
      b.userData = {
        puzzleId: "demo_simpleButton",
        interactable: true,
        hint: "Pulsar botón rojo [E]",
        baseHint: "Un botón rojo.",
        solved: false,
        requires: null,
      };
      s.add(b);
      addInteractableObject(b);
      console.log("Simple Button created by setup.");
    },
    interact: async (button) => {
      const data = button.userData;
      if (!data.solved) {
        data.solved = true;
        playSound("button_press");
        // Visual feedback: Button press animation (e.g., move slightly)
        button.position.x -= 0.02; // Simple press in animation
        button.material.color.setHex(0x880000); // Darken color
        data.hint = "Botón pulsado";
        updateTooltip("Has pulsado el botón.");
        markPuzzleSolved(data.puzzleId);
        // Grant reward (create pickup nearby)
        const { grantPuzzleReward } = await import("./puzzles.js");
        grantPuzzleReward(
          data.puzzleId,
          button.position.clone().add(new THREE.Vector3(0, -0.5, 0.5))
        ); // Spawn below/front

        // Reset visual state after a delay (optional)
        setTimeout(() => {
          if (button.parent) {
            // Check if still exists
            button.position.x += 0.02;
          }
        }, 300);
      } else {
        updateTooltip("El botón ya ha sido pulsado.");
        playSound("click_soft");
      }
    },
    checkSolution: null,
    cleanup: null, // Dynamic, removed by main cleanup
  },

  // --- Desk Drawer ---
  {
    id: "deskDrawer",
    name: "Cajón del Escritorio",
    description: "Un cajón en el escritorio.",
    requires: "Item_Llave_Pequeña",
    rewardType: "Item", // Contains an item
    difficultyRestriction: null,
    setup: (s) => {
      const drawerMesh = s.getObjectByName("deskDrawer");
      if (!drawerMesh) {
        console.error("Desk Drawer mesh not found during setup!");
        return;
      }
      drawerMesh.userData = {
        ...drawerMesh.userData, // Keep base data (hint, etc.)
        puzzleId: "deskDrawer",
        requires: "Item_Llave_Pequeña",
        solved: false, // Reset state
        hint: `Un cajón (Necesita Llave Pequeña)`, // Update hint
        originalPos: drawerMesh.position.clone(), // Store original position
      };
      resetMeshVisualState(drawerMesh); // Ensure closed appearance
      console.log(`Desk Drawer puzzle configured.`);
    },
    interact: async (drawer, selectedItemName) => {
      const data = drawer.userData;
      if (data.solved) {
        updateTooltip("El cajón ya está abierto.");
        return;
      }

      if (selectedItemName === data.requires) {
        data.solved = true;
        playSound("unlock_short");
        // Animate drawer opening
        // Example: Move drawer forward slightly
        drawer.position.z += 0.3; // Adjust based on drawer orientation
        data.hint = `Cajón abierto`;
        updateTooltip(`Usaste ${selectedItemName}, el cajón se abre.`);
        removeItemFromInventory(selectedItemName);
        deselectItem();
        markPuzzleSolved(data.puzzleId);
        // Grant reward
        const { grantPuzzleReward } = await import("./puzzles.js");
        grantPuzzleReward(
          data.puzzleId,
          drawer.position.clone().add(new THREE.Vector3(0, 0, -0.1))
        ); // Spawn inside
      } else if (getInventory().includes(data.requires)) {
        updateTooltip(`Necesitas seleccionar la ${data.requires}...`);
        playSound("click_soft");
      } else {
        updateTooltip(data.hint); // Needs Small Key
        playSound("locked_drawer");
      }
    },
    checkSolution: null,
    cleanup: (s) => {
      // Ensure drawer is reset visually if game restarts
      const drawerMesh = s.getObjectByName("deskDrawer");
      if (drawerMesh && drawerMesh.userData.originalPos) {
        drawerMesh.position.copy(drawerMesh.userData.originalPos);
      }
    },
  },

  // --- Air Vent ---
  {
    id: "airVent",
    name: "Rejilla de Ventilación",
    description: "Una rejilla metálica en lo alto de la pared.",
    requires: ["Item_Destornillador", "Item_Linterna_UV"], // Two steps
    rewardType: "Clue", // Gives a clue written inside
    difficultyRestriction: ["Difficult", "Expert"], // ONLY for Hard/Expert
    setup: (s) => {
      const ventMesh = s.getObjectByName("airVent");
      if (!ventMesh) {
        console.error("Air Vent mesh not found during setup!");
        return;
      }
      ventMesh.userData = {
        ...ventMesh.userData, // Keep base hint
        puzzleId: "airVent",
        requires_open: "Item_Destornillador",
        requires_reveal: "Item_Linterna_UV",
        solved: false, // Overall puzzle solved state
        opened: false, // Internal state: Is vent physically open?
        revealed: false, // Internal state: Has clue inside been seen?
        hint: `Una rejilla (Necesita Destornillador)`, // Initial hint
        originalRot: ventMesh.rotation.clone(), // Store initial state
        originalPos: ventMesh.position.clone(),
      };
      resetMeshVisualState(ventMesh); // Ensure closed/normal appearance
      console.log(`Air Vent puzzle configured.`);
    },
    interact: async (vent, selectedItemName) => {
      const data = vent.userData;
      if (data.revealed) {
        // Clue already found
        updateTooltip(`Ya encontraste la pista en la rejilla.`);
        playSound("click_soft");
        return;
      }

      if (!data.opened) {
        // --- Trying to Open ---
        if (selectedItemName === data.requires_open) {
          data.opened = true;
          playSound("unscrew"); // Sound of unscrewing
          // Visual feedback: Rotate vent slightly or move it
          vent.rotation.z += Math.PI / 16;
          vent.position.y -= 0.05;
          data.hint = `Rejilla abierta (Necesita Linterna UV para ver dentro)`;
          updateTooltip(
            `Usaste el ${selectedItemName}. La rejilla está abierta pero dentro está oscuro.`
          );
          removeItemFromInventory(selectedItemName);
          deselectItem();
          // Don't mark solved yet, need step 2
        } else if (getInventory().includes(data.requires_open)) {
          updateTooltip(`Necesitas seleccionar el ${data.requires_open}.`);
          playSound("click_soft");
        } else {
          updateTooltip(data.hint); // Needs Screwdriver
          playSound("error_short");
        }
      } else {
        // --- Vent is Open, Trying to Reveal ---
        if (selectedItemName === data.requires_reveal) {
          data.revealed = true;
          data.solved = true; // Mark puzzle fully solved now
          playSound("uv_reveal"); // Sound of UV light revealing something

          // Grant reward (Adds Clue to inventory)
          const { grantPuzzleReward } = await import("./puzzles.js");
          grantPuzzleReward(data.puzzleId, null); // Adds clue to inventory

          data.hint = `Rejilla abierta (Pista encontrada)`;
          updateTooltip(
            `Alumbras dentro con la ${selectedItemName}... ¡Hay una pista escrita! (Añadida al inventario)`
          );
          removeItemFromInventory(selectedItemName); // Consume UV light? Or keep it? Let's keep it for UV message.
          deselectItem();
          markPuzzleSolved(data.puzzleId); // Mark solved globally

          // Visual feedback: Maybe change vent appearance slightly?
          vent.material.color.setHex(0x33aa33); // Greenish tint
          vent.material.emissive.setHex(0x33aa33);
          vent.material.emissiveIntensity = 0.3;
        } else if (getInventory().includes(data.requires_reveal)) {
          updateTooltip(
            `Está oscuro ahí dentro. Necesitas seleccionar la ${data.requires_reveal}.`
          );
          playSound("click_soft");
        } else {
          updateTooltip("Está muy oscuro ahí dentro.");
          playSound("click_soft");
        }
      }
    },
    checkSolution: null,
    cleanup: (s) => {
      // Ensure reset if game restarts
      const ventMesh = s.getObjectByName("airVent");
      if (
        ventMesh &&
        ventMesh.userData.originalPos &&
        ventMesh.userData.originalRot
      ) {
        ventMesh.position.copy(ventMesh.userData.originalPos);
        ventMesh.rotation.copy(ventMesh.userData.originalRot);
        resetMeshVisualState(ventMesh);
      }
    },
  },

  // --- Lift Rug ---
  {
    id: "liftRug",
    name: "Levantar Alfombra",
    description: "Una alfombra vieja y polvorienta en el suelo.",
    requires: null,
    rewardType: "Clue", // Reveals a clue underneath
    difficultyRestriction: null,
    setup: (s) => {
      const rugMesh = s.getObjectByName("rug");
      if (!rugMesh) {
        console.error("Rug mesh not found!");
        return;
      }
      rugMesh.userData = {
        ...rugMesh.userData, // Keep base hint, originalY, canBeLifted
        puzzleId: "liftRug",
        requires: null,
        solved: false,
        hint: "Una alfombra vieja. ¿Habrá algo debajo? [E]",
      };
      resetMeshVisualState(rugMesh); // Ensure flat/visible
      console.log("Lift Rug puzzle configured.");
    },
    interact: async (rug) => {
      const data = rug.userData;
      if (data.solved) {
        updateTooltip("Ya miraste debajo de la alfombra.");
        return;
      }

      data.solved = true;
      playSound("cloth_rustle");
      // Visual feedback: Make it look lifted (move up, or hide, or swap model)
      rug.position.y += 0.05; // Lift slightly
      // OR rug.material.visible = false; // Hide it

      markPuzzleSolved(data.puzzleId);
      // Grant reward (adds clue)
      const { grantPuzzleReward } = await import("./puzzles.js");
      grantPuzzleReward(data.puzzleId, null); // Adds assigned clue to inventory

      data.hint = `Alfombra levantada (Pista encontrada)`;
      updateTooltip(
        `Levantas la alfombra y encuentras una pista escrita en el suelo. (Añadida al inventario)`
      );
    },
    checkSolution: null,
    cleanup: (s) => {
      // Ensure reset
      const rugMesh = s.getObjectByName("rug");
      if (rugMesh) resetMeshVisualState(rugMesh);
    },
  },

  // --- Move Picture ---
  {
    id: "movePicture",
    name: "Mover Cuadro",
    description: "Un cuadro que parece ligeramente torcido.",
    requires: null,
    rewardType: "Item", // Reveals an item behind it
    difficultyRestriction: null,
    setup: (s) => {
      const picGroup = s.getObjectByName("pictureOnWall");
      if (!picGroup) {
        console.error("Picture Group not found!");
        return;
      }
      picGroup.userData = {
        ...picGroup.userData, // Keep base hint, originalPos, canBeMoved
        puzzleId: "movePicture",
        requires: null,
        solved: false,
        hint: "Un cuadro torcido. ¿Se podrá mover? [E]",
      };
      resetMeshVisualState(picGroup); // Ensure original position/rotation
      console.log("Move Picture puzzle configured.");
    },
    interact: async (picGroup) => {
      const data = picGroup.userData;
      if (data.solved) {
        updateTooltip("Ya moviste este cuadro.");
        return;
      }

      data.solved = true;
      playSound("slide_heavy"); // Sound of moving picture
      // Visual feedback: Move/rotate the picture
      picGroup.rotation.z += Math.PI / 12; // Rotate
      picGroup.position.x += 0.1; // Move sideways

      markPuzzleSolved(data.puzzleId);
      // Grant reward (spawns pickup item behind)
      const { grantPuzzleReward } = await import("./puzzles.js");
      // Calculate position behind the picture
      const rewardPos = picGroup.position.clone();
      // Need to adjust based on wall orientation - Assuming back wall
      rewardPos.z += 0.1; // Slightly in front of wall
      rewardPos.y -= 0.1; // Slightly below center
      grantPuzzleReward(data.puzzleId, rewardPos);

      data.hint = `Cuadro movido (Algo apareció detrás)`;
      updateTooltip(`Mueves el cuadro y algo cae al suelo detrás de él.`);
    },
    checkSolution: null,
    cleanup: (s) => {
      // Ensure reset
      const picGroup = s.getObjectByName("pictureOnWall");
      if (picGroup) resetMeshVisualState(picGroup);
    },
  },

  // --- Symbol Matching Book ---
  {
    id: "symbolMatching",
    name: "Libro de Símbolos",
    description: "Un libro con símbolos extraños y un espacio para escribir.",
    requires: "Clue_Symbol_Key", // Needs the key found under the rug
    rewardType: "Clue", // Grants the Safe Code Clue
    difficultyRestriction: null,
    setup: (s) => {
      const bookMesh = s.getObjectByName("symbolMatching_Object");
      if (!bookMesh) {
        console.error("Symbol Matching object not found!");
        return;
      }
      bookMesh.userData = {
        ...bookMesh.userData, // Keep base hint
        puzzleId: "symbolMatching",
        requires: "Clue_Symbol_Key",
        solved: false,
        hint: "Un libro con símbolos extraños (Necesita Clave)",
        correctCodeWord: "SECRETO", // The word to decipher
      };
      resetMeshVisualState(bookMesh);
      console.log(`Symbol Matching puzzle configured.`);
    },
    interact: (book) => {
      const data = book.userData;
      if (data.solved) {
        updateTooltip("Libro de símbolos ya descifrado.");
        return;
      }

      // Check requirement (Symbol Key Clue)
      const reqCheck = checkRequirements(data.requires);
      if (!reqCheck.met) {
        updateTooltip(`Necesito la clave de símbolos para entender esto.`);
        playSound("error_short");
        return;
      }

      // Requirement met, open puzzle modal
      showPuzzleModalContent(
        "symbolMatching", // ID for reference
        data.puzzleId, // Puzzle ID
        "Libro de Símbolos", // Title
        "Usa la clave de símbolos para descifrar la palabra.", // Description
        "text", // Input type
        "Palabra descifrada..." // Placeholder
      );
    },
    checkSolution: async (inputValue) => {
      // Called by puzzle modal submit
      const bookMesh = getScene().getObjectByName("symbolMatching_Object"); // Find the mesh again
      if (!bookMesh || !bookMesh.userData) return false; // Safety check
      const data = bookMesh.userData;
      if (data.solved) return false; // Already solved

      const correct = data.correctCodeWord || "FAIL";
      if (inputValue.toUpperCase().trim() === correct) {
        data.solved = true;
        playSound("success_chime");
        markPuzzleSolved(data.puzzleId);
        // Grant Reward (Safe Code Clue)
        const { grantPuzzleReward } = await import("./puzzles.js");
        grantPuzzleReward(data.puzzleId, null); // Adds clue to inventory
        data.hint = "Libro descifrado (Pista Obtenida)";
        // Update modal message and close after delay
        const puzzleMessage = getUIElement("puzzleMessage");
        if (puzzleMessage)
          puzzleMessage.textContent = `¡Correcto! Has descifrado la palabra. (Pista añadida)`;
        setTimeout(hidePuzzleModal, 1800);
        return true;
      } else {
        playSound("error_short");
        const puzzleMessage = getUIElement("puzzleMessage");
        if (puzzleMessage) puzzleMessage.textContent = "Palabra incorrecta.";
        const puzzleInput = getUIElement("puzzleInput");
        if (puzzleInput) puzzleInput.value = ""; // Clear input
        return false;
      }
    },
    cleanup: null, // Static mesh reset by main cleanup
  },

  // --- Combination Lock Safe ---
  {
    id: "demo_comboLock",
    name: "Caja Fuerte",
    description: "Una pequeña caja fuerte con un dial numérico.",
    requires: "Clue_Codigo_Safe", // Needs the clue from symbol book
    rewardType: "Item", // Contains an item
    difficultyRestriction: null,
    setup: (s) => {
      // Creates the safe mesh dynamically
      const safeGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
      const safeMat = new THREE.MeshStandardMaterial({
        color: 0xd3d3d3,
        metalness: 0.7,
        roughness: 0.4,
      });
      const safeMesh = new THREE.Mesh(safeGeo, safeMat);
      safeMesh.name = "demo_comboLock_Safe";
      safeMesh.castShadow = true;
      safeMesh.receiveShadow = true;
      const shelfMesh = s.getObjectByName("safeShelfMesh"); // Place on shelf
      if (shelfMesh) {
        safeMesh.position.set(
          shelfMesh.position.x,
          shelfMesh.position.y + 0.04 / 2 + 0.6 / 2 + 0.01,
          shelfMesh.position.z
        );
      } else {
        safeMesh.position.set(-3.0, 1.3, -5.5);
      } // Fallback position

      safeMesh.userData = {
        puzzleId: "demo_comboLock",
        interactable: true,
        hint: "Caja fuerte (Necesita Código)",
        baseHint: "Una caja fuerte.",
        solved: false,
        requires: "Clue_Codigo_Safe",
        correctCode: "123", // Store correct code here
      };
      s.add(safeMesh);
      addInteractableObject(safeMesh);
      addCollisionObject(safeMesh);
      console.log("Safe mesh created by setup.");
    },
    interact: (safe) => {
      const data = safe.userData;
      if (data.solved) {
        updateTooltip("La caja fuerte ya está abierta.");
        return;
      }

      // Check requirement (Safe Code Clue)
      const reqCheck = checkRequirements(data.requires);
      if (!reqCheck.met) {
        updateTooltip(
          `Necesitas la pista "${data.requires}" para saber el código.`
        );
        playSound("error_short");
        return;
      }
      // Extract code from clue in inventory
      const clueItem = getInventory().find((item) =>
        item.startsWith(data.requires)
      );
      const match = clueItem ? clueItem.match(/\(([^)]+)\)/) : null;
      const codeFromClue = match && match[1] ? match[1] : null;

      if (!codeFromClue) {
        updateTooltip(
          `Error: No se pudo extraer el código de la pista "${clueItem}".`
        );
        playSound("error_short");
        return;
      }
      data.correctCode = codeFromClue; // Update correct code based on inventory

      // Requirement met, open puzzle modal
      showPuzzleModalContent(
        "demo_comboLock",
        data.puzzleId,
        "Caja Fuerte",
        `Introduce el código de ${data.correctCode.length} dígitos.`, // Use length from actual code
        "number",
        "Código..."
      );
    },
    checkSolution: async (inputValue) => {
      const safeMesh = getScene().getObjectByName("demo_comboLock_Safe");
      if (!safeMesh || !safeMesh.userData) return false;
      const data = safeMesh.userData;
      if (data.solved) return false;

      const correct = data.correctCode || "FAIL";
      if (inputValue.trim() === correct) {
        data.solved = true;
        playSound("unlock_heavy");
        markPuzzleSolved(data.puzzleId);
        // Grant Reward (Item inside)
        const { grantPuzzleReward } = await import("./puzzles.js");
        grantPuzzleReward(
          data.puzzleId,
          safeMesh.position.clone().add(new THREE.Vector3(0, 0, 0.4))
        ); // Spawn in front

        data.hint = "Caja fuerte abierta";
        // Update modal and close
        const puzzleMessage = getUIElement("puzzleMessage");
        if (puzzleMessage)
          puzzleMessage.textContent = "¡Código Correcto! La caja se abre.";
        setTimeout(hidePuzzleModal, 1500);
        return true;
      } else {
        playSound("error_short");
        const puzzleMessage = getUIElement("puzzleMessage");
        if (puzzleMessage) puzzleMessage.textContent = "Código incorrecto.";
        const puzzleInput = getUIElement("puzzleInput");
        if (puzzleInput) puzzleInput.value = "";
        return false;
      }
    },
    cleanup: null, // Dynamic, removed by main cleanup
  },

  // --- Picture Frame (Simple Interaction Clue) ---
  {
    id: "demo_2DPuzzleTrigger",
    name: "Marco de Fotos",
    description: "Un marco de fotos sencillo sobre una estantería.",
    requires: null,
    rewardType: "Clue", // Gives the Riddle Clue
    difficultyRestriction: null,
    setup: (s) => {
      // Creates the frame dynamically
      const g = new THREE.PlaneGeometry(0.6, 0.4); // Smaller frame
      const m = new THREE.MeshStandardMaterial({ color: 0xd2b48c }); // Simple material
      const f = new THREE.Mesh(g, m);
      // Place on one of the item shelves
      const targetShelf = s.getObjectByName("itemShelf_0"); // Example: lowest shelf
      if (targetShelf) {
        f.position.set(
          targetShelf.position.x,
          targetShelf.position.y + 0.04 / 2 + 0.4 / 2 + 0.01,
          targetShelf.position.z + 0.1
        );
        f.rotation.copy(targetShelf.rotation);
        f.rotation.x += Math.PI / 12; // Lean against wall slightly
      } else {
        f.position.set(-ROOM_SIZE.width / 2 + 0.15, 1.8, 2);
        f.rotation.y = Math.PI / 2; // Fallback position
      }
      f.name = "demo_2DPuzzleTrigger_Frame";
      f.userData = {
        puzzleId: "demo_2DPuzzleTrigger",
        interactable: true,
        hint: "Examinar Marco de Fotos [E]",
        baseHint: "Un marco de fotos.",
        solved: false,
        requires: null,
      };
      s.add(f);
      addInteractableObject(f);
      console.log("Frame Trigger created by setup.");
    },
    interact: async (frame) => {
      const data = frame.userData;
      if (data.solved) {
        updateTooltip("Ya examinaste este marco.");
        playSound("click_soft");
        return;
      }
      data.solved = true;
      playSound("pickup_clue"); // Sound for finding clue
      markPuzzleSolved(data.puzzleId);
      // Grant Reward (Add Riddle Clue to inventory)
      const { grantPuzzleReward } = await import("./puzzles.js");
      grantPuzzleReward(data.puzzleId, null); // Adds clue to inventory

      data.hint = "Marco examinado (Pista encontrada)";
      updateTooltip(
        "Miras detrás del marco y encuentras un papel con algo escrito. (Pista añadida al inventario)"
      );
    },
    checkSolution: null,
    cleanup: null, // Dynamic, removed by main cleanup
  },

  // --- Riddle Panel ---
  {
    id: "demo_riddle",
    name: "Panel de Acertijo",
    description: "Una placa de madera con un acertijo grabado.",
    requires: "Clue_Riddle", // Needs the clue from the frame
    rewardType: "Clue", // Grants the Color Sequence Clue
    difficultyRestriction: null,
    setup: (s) => {
      // Creates the panel dynamically
      const g = new THREE.PlaneGeometry(1.5, 1);
      // Use basic material, text comes from description/modal
      const m = new THREE.MeshStandardMaterial({ color: 0x8b4513 }); // Wood color
      const p = new THREE.Mesh(g, m);
      p.position.set(2.5, 1.4, -getRoomSize().depth / 2 + 0.1); // On back wall
      p.name = "demo_riddle_Panel";
      p.userData = {
        puzzleId: "demo_riddle",
        interactable: true,
        hint: "Leer acertijo (Necesita Pista)",
        baseHint: "Un panel con un acertijo.",
        solved: false,
        requires: "Clue_Riddle",
        correctCode: "aguja", // Answer to the riddle
        riddleText: "¿Qué tiene ojos pero no puede ver?", // Store riddle text
      };
      s.add(p);
      addInteractableObject(p);
      console.log("Riddle Panel created by setup.");
    },
    interact: (panel) => {
      const data = panel.userData;
      if (data.solved) {
        updateTooltip("Acertijo ya resuelto.");
        return;
      }

      const reqCheck = checkRequirements(data.requires);
      if (!reqCheck.met) {
        updateTooltip(`Necesitas la pista "${data.requires}" para leer esto.`);
        playSound("error_short");
        return;
      }

      // Requirement met, open puzzle modal with the riddle
      showPuzzleModalContent(
        "demo_riddle",
        data.puzzleId,
        "Acertijo",
        data.riddleText || "Resuelve el acertijo.", // Show the riddle
        "text",
        "Respuesta..."
      );
    },
    checkSolution: async (inputValue) => {
      const panel = getScene().getObjectByName("demo_riddle_Panel");
      if (!panel || !panel.userData) return false;
      const data = panel.userData;
      if (data.solved) return false;

      const correct = data.correctCode || "FAIL";
      if (inputValue.toLowerCase().trim() === correct) {
        data.solved = true;
        playSound("success");
        markPuzzleSolved(data.puzzleId);
        // Grant Reward (Color Sequence Clue)
        const { grantPuzzleReward } = await import("./puzzles.js");
        grantPuzzleReward(data.puzzleId, null); // Adds clue to inventory

        data.hint = "Acertijo resuelto (Pista Obtenida)";
        // Update modal and close
        const puzzleMessage = getUIElement("puzzleMessage");
        if (puzzleMessage)
          puzzleMessage.textContent = `¡Correcto! La respuesta es ${correct}. (Pista añadida)`;
        setTimeout(hidePuzzleModal, 1800);
        return true;
      } else {
        playSound("error_short");
        const puzzleMessage = getUIElement("puzzleMessage");
        if (puzzleMessage) puzzleMessage.textContent = "Respuesta incorrecta.";
        const puzzleInput = getUIElement("puzzleInput");
        if (puzzleInput) puzzleInput.value = "";
        return false;
      }
    },
    cleanup: null, // Dynamic, removed by main cleanup
  },

  // --- Color Sequence Buttons ---
  {
    id: "demo_colorSequence",
    name: "Secuencia de Botones",
    description: "Una serie de botones de colores en la pared.",
    requires: "Clue_Color_Sequence", // Needs the clue from the riddle
    rewardType: "Signal", // Grants the Enable_Book_Puzzle signal
    difficultyRestriction: null,
    setup: (s) => {
      const colors = {
        red: 0xff0000,
        blue: 0x0000ff,
        green: 0x00ff00,
        yellow: 0xffff00,
      }; // Available button colors
      const correctSequence = ["red", "blue", "green"]; // The solution
      const state = {
        // Shared state for all buttons of this puzzle
        correctSequence: correctSequence,
        currentAttempt: [],
        buttons: [], // References to the button meshes
        solved: false,
      };

      // Create button meshes
      Object.keys(colors).forEach((id, index) => {
        const g = new THREE.SphereGeometry(0.12, 16, 8);
        const initialColor = colors[id];
        const m = new THREE.MeshStandardMaterial({
          color: initialColor,
          metalness: 0.2,
          roughness: 0.6,
          emissive: initialColor, // Make them glow slightly
          emissiveIntensity: 0.1,
        });
        const b = new THREE.Mesh(g, m);
        // Position them horizontally on a wall (e.g., front wall)
        const spacing = 0.4;
        const startX = (-(Object.keys(colors).length - 1) * spacing) / 2;
        b.position.set(
          startX + index * spacing,
          1.8,
          getRoomSize().depth / 2 - 0.1
        ); // On front wall
        b.name = `demo_colorButton_${id}`;
        b.castShadow = true;
        b.userData = {
          puzzleId: "demo_colorSequence",
          interactable: true,
          hint: `Pulsar botón ${id}`,
          baseHint: `Un botón ${id}.`,
          buttonId: id, // Identifier for this button's color/role
          stateRef: state, // Reference to the shared state object
          requires: "Clue_Color_Sequence", // Requirement check needed
        };
        s.add(b);
        addInteractableObject(b);
        state.buttons.push(b); // Add mesh to state for potential feedback
      });
      console.log("Color Sequence Buttons created by setup.");
    },
    interact: (button) => {
      const data = button.userData;
      const state = data.stateRef;

      if (!state || state.solved) {
        updateTooltip(
          state?.solved
            ? "Secuencia ya completada."
            : "Error de estado del puzzle."
        );
        return;
      }

      // Check requirement (Color Sequence Clue)
      const reqCheck = checkRequirements(data.requires);
      if (!reqCheck.met) {
        updateTooltip(
          `Necesitas la pista "${data.requires}" para saber la secuencia.`
        );
        playSound("error_short");
        return;
      }

      // Requirement met, process button press
      const buttonId = data.buttonId;
      state.currentAttempt.push(buttonId);
      console.log(
        `Button pressed: ${buttonId}. Attempt: [${state.currentAttempt.join(
          ", "
        )}]`
      );
      playSound("button_press");

      // Animate button press (optional visual feedback)
      button.scale.set(0.9, 0.9, 0.9);
      button.material.emissiveIntensity = 0.5; // Brighter flash
      setTimeout(() => {
        if (button.parent) {
          // Check if exists
          button.scale.set(1, 1, 1);
          button.material.emissiveIntensity = 0.1; // Back to normal glow
        }
      }, 150);

      // Check if current press matches the expected sequence position
      const expectedButton =
        state.correctSequence[state.currentAttempt.length - 1];
      if (buttonId !== expectedButton) {
        // Incorrect button press
        console.log("Incorrect sequence.");
        playSound("error_short");
        updateTooltip("Secuencia incorrecta. Intenta de nuevo.");
        state.currentAttempt = []; // Reset attempt
        // Optional: Flash buttons red or provide other visual error feedback
      } else if (state.currentAttempt.length === state.correctSequence.length) {
        // Correct button AND sequence completed
        console.log("Correct sequence!");
        state.solved = true;
        playSound("success_chime");
        markPuzzleSolved(data.puzzleId);

        // Grant Reward (Enable Book Puzzle Signal)
        // Signals don't use grantPuzzleReward directly
        bookPuzzleEnabled = true; // Set the global flag
        console.log("Book Puzzle Enabled via Signal.");
        updateTooltip("¡Secuencia correcta! Algo hizo click en la estantería.");

        // Update hints and disable buttons
        state.buttons.forEach((btn) => {
          btn.userData.interactable = false;
          btn.userData.hint = "Botón (Secuencia completa)";
          // Optional: Make completed sequence glow brighter
          if (state.correctSequence.includes(btn.userData.buttonId)) {
            btn.material.emissiveIntensity = 0.6;
          }
        });
      } else {
        // Correct button, but sequence not yet complete
        updateTooltip(
          `Correcto (${state.currentAttempt.length}/${state.correctSequence.length}). Siguiente...`
        );
        // Sound feedback for correct step (optional)
        // playSound('click_soft');
      }
    },
    checkSolution: null, // Interaction handles solution
    cleanup: (s) => {
      // Remove buttons dynamically created
      const firstButton = s.children.find((o) =>
        o.name?.startsWith("demo_colorButton_")
      );
      if (firstButton?.userData?.stateRef?.buttons) {
        console.log("Cleaning up color sequence buttons...");
        firstButton.userData.stateRef.buttons.forEach((btn) => {
          removeInteractableObject(btn);
          if (btn.parent) btn.parent.remove(btn);
          btn.geometry?.dispose();
          btn.material?.dispose();
        });
      }
    },
  },

  // --- Book Swap Puzzle ---
  {
    id: "bookSwap",
    name: "Estantería de Libros",
    description: "Libros de colores en una estantería. Parecen fuera de lugar.",
    requires: ["Clue_Book_Sequence", "Enable_Book_Puzzle"], // Needs clue AND signal
    rewardType: "Item", // Grants an item (UV Light)
    difficultyRestriction: null,
    setup: (s) => {
      console.log("Configuring bookSwap puzzle...");
      bookPuzzleSolved = false; // Reset internal state
      firstBookClicked = null;
      // Books are created in sceneSetup, just configure them here if puzzle active
      let booksFound = 0;
      s.traverse((obj) => {
        if (obj.name && obj.name.startsWith("bookPuzzle_")) {
          booksFound++;
          obj.userData = {
            ...obj.userData, // Keep initialColor, bookIndex
            puzzleId: "bookSwap", // Assign ID for this game
            interactable: true, // Ensure interactable
            hint: `Examinar Libro ${obj.userData.bookIndex + 1}`,
            baseHint: `Un libro ${bookColorNames[obj.userData.bookIndex]}.`,
            requires: ["Clue_Book_Sequence", "Enable_Book_Puzzle"], // Link requirements
          };
          // Reset appearance (color, emissive)
          obj.material.color.setHex(obj.userData.initialColor || 0x888888);
          obj.material.emissiveIntensity = 0;
          obj.material.needsUpdate = true;
        }
      });
      // Start disabled, requires signal from color sequence
      bookPuzzleEnabled = false;
      console.log(
        `Book puzzle configured for ${booksFound} books. Waiting for enable signal.`
      );
    },
    interact: null, // Handled by handleBookClick (called from interaction.js)
    checkSolution: null, // Handled by checkBookSequence
    cleanup: (s) => {
      // Reset book appearance on cleanup
      s.traverse((obj) => {
        if (obj.name && obj.name.startsWith("bookPuzzle_") && obj.material) {
          obj.material.color.setHex(obj.userData?.initialColor || 0x888888);
          obj.material.emissiveIntensity = 0;
          obj.material.needsUpdate = true;
          // Reset interactable state? Maybe keep base hint?
          // obj.userData.interactable = true;
          // obj.userData.hint = obj.userData.baseHint;
        }
      });
      bookPuzzleEnabled = false; // Ensure disabled on reset
      bookPuzzleSolved = false;
      firstBookClicked = null;
    },
  },

  // --- UV Hidden Message ---
  {
    id: "demo_uvMessage",
    name: "Mensaje Oculto en Pared",
    description: "Una zona extraña en la pared, casi invisible.",
    requires: "Item_Linterna_UV",
    rewardType: "Clue", // Grants Password Panel Clue
    difficultyRestriction: null,
    setup: (s) => {
      // Creates the plane dynamically
      const g = new THREE.PlaneGeometry(1, 1);
      // Store password here, grant clue with this value
      const passwordValue = "HIDDEN";
      // Create textures (invisible initially)
      const tI = createTextTexture(" ", 256, 256, "#AAAAEE", "#AAAAEE"); // Match wall?
      const tH = createTextTexture(
        `PASSWORD:\n${passwordValue}`,
        256,
        256,
        "#AAAAEE",
        "#800080",
        "bold 40px Consolas"
      ); // Hidden text style
      const m = new THREE.MeshStandardMaterial({
        map: tI,
        transparent: true,
        opacity: 0.1,
        side: THREE.DoubleSide,
      }); // Almost transparent
      const surface = new THREE.Mesh(g, m);
      surface.position.set(-1.5, 1.2, -getRoomSize().depth / 2 + 0.1); // On back wall
      surface.name = "demo_uvMessage_Surface";
      surface.userData = {
        puzzleId: "demo_uvMessage",
        interactable: true,
        hint: "Una marca extraña en la pared...",
        baseHint: "Una marca extraña.",
        solved: false,
        requires: "Item_Linterna_UV",
        texture_initial: tI,
        texture_hidden: tH,
        revealTimeoutId: null,
        correctCode: passwordValue, // Store the actual password here
      };
      s.add(surface);
      addInteractableObject(surface);
      console.log("UV Message Surface created by setup.");
    },
    interact: async (surface, selectedItemName) => {
      const data = surface.userData;
      let clueRevealed = false; // Flag to check if clue was already revealed

      // Check if the clue reward has already been granted
      const clueRewardName =
        assignedRewards[data.puzzleId] ||
        `Clue_Password_Panel (${data.correctCode})`;
      if (getInventory().includes(clueRewardName)) {
        clueRevealed = true;
      }

      if (selectedItemName === data.requires) {
        playSound("uv_reveal");
        // Visual feedback: Swap texture
        surface.material.map = data.texture_hidden;
        surface.material.opacity = 1.0;
        surface.material.needsUpdate = true;
        updateTooltip(
          `Alumbras con la ${selectedItemName}... ¡Aparece un mensaje!`
        );

        // Grant Reward Clue (only if not already revealed/granted)
        if (!clueRevealed) {
          data.solved = true; // Mark solved when clue granted
          markPuzzleSolved(data.puzzleId);
          const { grantPuzzleReward } = await import("./puzzles.js");
          grantPuzzleReward(data.puzzleId, null); // Adds clue to inventory
          data.hint = "Mensaje revelado (Pista encontrada)";
        } else {
          data.hint = "Mensaje revelado"; // Update hint even if clue was already found
        }

        // Hide message after a delay
        if (data.revealTimeoutId) clearTimeout(data.revealTimeoutId);
        data.revealTimeoutId = setTimeout(() => {
          if (surface.parent) {
            // Check if still exists
            surface.material.map = data.texture_initial;
            surface.material.opacity = 0.1;
            surface.material.needsUpdate = true;
            if (!clueRevealed)
              updateTooltip("El mensaje vuelve a desaparecer..."); // Only show fade message if it was newly revealed
          }
          data.revealTimeoutId = null;
        }, 5000); // Hide after 5 seconds

        // Don't consume UV light? Usually reusable.
        deselectItem(); // Deselect the light after use
      } else if (getInventory().includes(data.requires)) {
        updateTooltip(`Necesitas seleccionar la ${data.requires}.`);
        playSound("click_soft");
      } else {
        updateTooltip(data.hint); // Strange mark...
        playSound("click_soft");
      }
    },
    checkSolution: null,
    cleanup: (s) => {
      // Dispose textures, clear timeout
      const surface = s.getObjectByName("demo_uvMessage_Surface");
      if (surface) {
        if (surface.userData.revealTimeoutId)
          clearTimeout(surface.userData.revealTimeoutId);
        surface.userData.texture_initial?.dispose();
        surface.userData.texture_hidden?.dispose();
      }
      // Also remove from dynamic objects list
      removeInteractableObject(surface);
      if (surface?.parent) surface.parent.remove(surface);
      surface?.geometry?.dispose();
      surface?.material?.dispose();
    },
  },

  // --- Password Panel ---
  {
    id: "demo_passwordPanel",
    name: "Panel de Acceso",
    description: "Un panel con teclado numérico o de texto.",
    // Requires the clue from the UV message
    // The clue format is 'Clue_Password_Panel (XYZ)'
    requires: "Clue_Password_Panel",
    rewardType: "Item", // Example: Grants a key or another item
    difficultyRestriction: null,
    setup: (s) => {
      // Creates the panel dynamically
      const g = new THREE.PlaneGeometry(1.2, 0.6);
      // Textures managed internally now
      const m = new THREE.MeshStandardMaterial({
        color: 0x401111,
        emissive: "#110000",
        emissiveIntensity: 0.8,
      }); // Reddish locked state
      const p = new THREE.Mesh(g, m);
      p.position.set(getRoomSize().width / 2 - 0.1, 1.5, -2); // On right wall
      p.rotation.y = -Math.PI / 2;
      p.name = "demo_passwordPanel_Plane";
      p.userData = {
        puzzleId: "demo_passwordPanel",
        interactable: true,
        hint: "Panel bloqueado (Necesita Contraseña)",
        baseHint: "Un panel de acceso.",
        solved: false,
        requires: "Clue_Password_Panel",
        // correctCode stored/checked dynamically in checkSolution
      };
      s.add(p);
      addInteractableObject(p);
      console.log("Password Panel created by setup.");
    },
    interact: (panel) => {
      const data = panel.userData;
      if (data.solved) {
        updateTooltip("Panel desbloqueado.");
        return;
      }

      const reqCheck = checkRequirements(data.requires);
      if (!reqCheck.met) {
        updateTooltip(
          `Necesitas la pista "${data.requires}" para saber la contraseña.`
        );
        playSound("error_short");
        return;
      }

      // Requirement met, open puzzle modal
      showPuzzleModalContent(
        "demo_passwordPanel",
        data.puzzleId,
        "Panel de Acceso",
        "Introduce la contraseña.",
        "text", // Use text input
        "Contraseña..."
      );
    },
    checkSolution: async (inputValue) => {
      const panel = getScene().getObjectByName("demo_passwordPanel_Plane");
      if (!panel || !panel.userData) return false;
      const data = panel.userData;
      if (data.solved) return false;

      // Find the clue item in inventory
      const clueItem = getInventory().find((item) =>
        item.startsWith(data.requires)
      );
      if (!clueItem) {
        console.error(
          "Password panel check failed: Required clue not found in inventory!"
        );
        const puzzleMessage = getUIElement("puzzleMessage");
        if (puzzleMessage)
          puzzleMessage.textContent = "Error: Falta la pista de la contraseña.";
        return false; // Should not happen if interact check passed
      }

      // Extract the password from the clue string (e.g., "Clue_Password_Panel (HIDDEN)")
      const match = clueItem.match(/\(([^)]+)\)/);
      const correctPassword = match && match[1] ? match[1] : "FAIL"; // Get value inside ()

      if (inputValue.toUpperCase().trim() === correctPassword) {
        data.solved = true;
        playSound("success"); // Access granted sound
        markPuzzleSolved(data.puzzleId);
        // Grant Reward
        const { grantPuzzleReward } = await import("./puzzles.js");
        grantPuzzleReward(data.puzzleId, panel.position); // Spawn near panel

        data.hint = "Panel desbloqueado";
        // Visual feedback: Change panel color/appearance
        panel.material.color.setHex(0x114011); // Greenish unlocked
        panel.material.emissive.setHex("#AAFFAA");
        panel.material.needsUpdate = true;
        // Update modal and close
        const puzzleMessage = getUIElement("puzzleMessage");
        if (puzzleMessage) puzzleMessage.textContent = "¡Acceso Concedido!";
        setTimeout(hidePuzzleModal, 1200);
        return true;
      } else {
        playSound("error_short");
        const puzzleMessage = getUIElement("puzzleMessage");
        if (puzzleMessage) puzzleMessage.textContent = "Contraseña incorrecta.";
        const puzzleInput = getUIElement("puzzleInput");
        if (puzzleInput) puzzleInput.value = "";
        return false;
      }
    },
    cleanup: (s) => {
      // Reset visual state
      const panel = s.getObjectByName("demo_passwordPanel_Plane");
      if (panel && panel.material) {
        panel.material.color.setHex(0x401111); // Back to red
        panel.material.emissive.setHex("#110000");
        panel.material.needsUpdate = true;
      }
      // Remove dynamic object
      removeInteractableObject(panel);
      if (panel?.parent) panel.parent.remove(panel);
      panel?.geometry?.dispose();
      panel?.material?.dispose();
    },
  },

  // --- Wires Minigame Trigger ---
  {
    id: "wiresPuzzle",
    name: "Panel de Cables",
    description: "Un panel con cables sueltos y conectores.",
    requires: null, // No item needed to start
    rewardType: "Item", // Grants an item on completion
    difficultyRestriction: null,
    setup: (s) => {
      const triggerMesh = s.getObjectByName("wiresPuzzle_Trigger");
      if (!triggerMesh) {
        console.error("Wires Trigger mesh not found!");
        return;
      }
      triggerMesh.userData = {
        ...triggerMesh.userData, // Keep base hint
        puzzleId: "wiresPuzzle",
        requires: null,
        solved: false,
        isMinigameTrigger: true, // Mark as minigame trigger
        minigameId: "wires", // ID for the minigame logic
        hint: "Examinar panel de cables [E]",
      };
      resetMeshVisualState(triggerMesh); // Ensure default appearance
      console.log(`Wires Puzzle Trigger configured.`);
    },
    interact: (trigger) => {
      const data = trigger.userData;
      if (data.solved) {
        updateTooltip("Ya arreglaste los cables.");
        return;
      }

      console.log(`Triggering minigame: ${data.minigameId}`);
      showMinigameUI(data.minigameId, async () => {
        // --- This is the SUCCESS CALLBACK ---
        // Called by the minigame logic when the player wins
        console.log(`${data.minigameId} minigame SUCCESS callback executed.`);
        if (data.solved) return; // Prevent multiple triggers

        data.solved = true;
        markPuzzleSolved(data.puzzleId);
        // Grant Reward
        const { grantPuzzleReward } = await import("./puzzles.js");
        grantPuzzleReward(data.puzzleId, trigger.position); // Spawn near trigger

        data.hint = "Panel de cables reparado";
        // Visual feedback on the trigger object (optional)
        trigger.material.color.setHex(0x116611); // Change color to green
        trigger.material.emissive.setHex(0x002200);
        trigger.material.needsUpdate = true;
        updateTooltip("¡Has conectado los cables correctamente!"); // Tooltip shown briefly after minigame closes
      });
    },
    checkSolution: null, // Solved by minigame callback
    cleanup: null, // Static mesh reset by main cleanup
  },

  // --- Simon Says Minigame Trigger ---
  {
    id: "simonSays",
    name: "Panel Simon Says",
    description: "Un panel con cuatro luces de colores que parpadean.",
    requires: null,
    rewardType: "Item",
    difficultyRestriction: null,
    setup: (s) => {
      const triggerMesh = s.getObjectByName("simonSays_Trigger");
      if (!triggerMesh) {
        console.error("Simon Says Trigger mesh not found!");
        return;
      }
      triggerMesh.userData = {
        ...triggerMesh.userData,
        puzzleId: "simonSays",
        requires: null,
        solved: false,
        isMinigameTrigger: true,
        minigameId: "simon",
        hint: "Examinar panel de luces [E]",
      };
      resetMeshVisualState(triggerMesh);
      console.log(`Simon Says Trigger configured.`);
    },
    interact: (trigger) => {
      const data = trigger.userData;
      if (data.solved) {
        updateTooltip("Ya completaste la secuencia Simon Says.");
        return;
      }

      console.log(`Triggering minigame: ${data.minigameId}`);
      showMinigameUI(data.minigameId, async () => {
        // --- SUCCESS CALLBACK ---
        console.log(`${data.minigameId} minigame SUCCESS callback executed.`);
        if (data.solved) return;
        data.solved = true;
        markPuzzleSolved(data.puzzleId);
        // Grant Reward
        const { grantPuzzleReward } = await import("./puzzles.js");
        grantPuzzleReward(data.puzzleId, trigger.position);

        data.hint = "Panel Simon Says completado";
        trigger.material.color.setHex(0x4444aa); // Change color
        trigger.material.emissive.setHex(0x111155);
        trigger.material.needsUpdate = true;
        updateTooltip("¡Secuencia Simon Says correcta!");
      });
    },
    checkSolution: null,
    cleanup: null,
  },

  // --- Projector Puzzle ---
  {
    id: "projectorPuzzle",
    name: "Proyector Antiguo",
    description: "Un viejo proyector de diapositivas.",
    requires: ["Item_Bateria", "Item_Diapositiva"], // Requires both items
    rewardType: "Clue", // Shows a clue (Vent Code)
    difficultyRestriction: ["Difficult", "Expert"], // ONLY for Hard/Expert
    setup: (s) => {
      const projMesh = s.getObjectByName("projectorPuzzle_Object");
      if (!projMesh) {
        console.error("Projector mesh not found!");
        return;
      }
      projMesh.userData = {
        ...projMesh.userData, // Keep base hint
        puzzleId: "projectorPuzzle",
        requires: ["Item_Bateria", "Item_Diapositiva"],
        solved: false,
        hasBattery: false, // Track internal state
        hasSlide: false, // Track internal state
        hint: "Un viejo proyector (Necesita Batería, Diapositiva).",
      };
      resetMeshVisualState(projMesh); // Ensure off state
      console.log(`Projector puzzle configured.`);
    },
    interact: async (projector, selectedItemName) => {
      const data = projector.userData;
      if (data.solved) {
        updateTooltip("Ya has usado el proyector.");
        return;
      }

      let interacted = false;

      // Check if trying to insert Battery
      if (selectedItemName === "Item_Bateria" && !data.hasBattery) {
        data.hasBattery = true;
        removeItemFromInventory(selectedItemName);
        deselectItem();
        updateTooltip("Has insertado la Batería en el proyector.");
        playSound("insert_item"); // Generic insert sound
        data.hint = `Proyector (Tiene Batería, necesita Diapositiva)`;
        interacted = true;
      }
      // Check if trying to insert Slide
      else if (selectedItemName === "Item_Diapositiva" && !data.hasSlide) {
        data.hasSlide = true;
        removeItemFromInventory(selectedItemName);
        deselectItem();
        updateTooltip("Has insertado la Diapositiva en el proyector.");
        playSound("insert_item");
        data.hint = `Proyector (Tiene Diapositiva, necesita Batería)`;
        interacted = true;
      }
      // If both parts are inserted, check on interaction (even without selecting item)
      else if (data.hasBattery && data.hasSlide && !selectedItemName) {
        // Player interacts after inserting both parts
        interacted = true; // Fall through to activate
      } else if (
        selectedItemName &&
        (selectedItemName === "Item_Bateria" ||
          selectedItemName === "Item_Diapositiva")
      ) {
        // Trying to insert item that's already inserted
        updateTooltip(`El proyector ya tiene ${selectedItemName}.`);
        playSound("error_short");
        return; // Prevent further checks
      } else if (selectedItemName) {
        // Trying to use unrelated item
        updateTooltip(`No puedes usar ${selectedItemName} aquí.`);
        playSound("error_short");
        return;
      }

      // --- Activate if both parts are in ---
      if (data.hasBattery && data.hasSlide) {
        console.log("Activating projector...");
        data.solved = true;
        markPuzzleSolved(data.puzzleId);
        playSound("projector_on"); // Play sound

        // Grant Reward (Vent Code Clue)
        const { grantPuzzleReward } = await import("./puzzles.js");
        grantPuzzleReward(data.puzzleId, null); // Adds clue to inventory

        data.hint = "Proyector mostrando imagen (Pista encontrada)";
        updateTooltip(
          `El proyector se enciende y muestra una imagen con una pista. (Añadida al inventario)`
        );

        // Visual Feedback
        projector.material.emissive.setHex(0xffffdd);
        projector.material.emissiveIntensity = 0.7;
        projector.material.needsUpdate = true;
        // Optionally create a light beam or projected image plane
      } else if (!interacted) {
        // Interacted without selecting an item and missing parts
        const missing = [];
        if (!data.hasBattery) missing.push("Batería");
        if (!data.hasSlide) missing.push("Diapositiva");
        updateTooltip(`Al proyector le falta: ${missing.join(", ")}`);
        playSound("click_soft");
      }
    },
    checkSolution: null,
    cleanup: null, // Static mesh reset
  },

  // --- Final Keypad ---
  {
    id: "finalKeypad",
    name: "Teclado Final",
    description: "Un teclado numérico junto a la puerta de salida.",
    // Requires clues from Safe and Vent
    requires: ["Clue_Codigo_Safe", "Clue_Codigo_Vent"],
    rewardType: "Clue", // Grants the final escape code/key name
    difficultyRestriction: ["Difficult", "Expert"], // ONLY for Hard/Expert
    setup: (s) => {
      const keypadMesh = s.getObjectByName("finalKeypad");
      if (!keypadMesh) {
        console.error("Final Keypad mesh not found!");
        return;
      }
      keypadMesh.userData = {
        ...keypadMesh.userData, // Keep base hint
        puzzleId: "finalKeypad",
        requires: ["Clue_Codigo_Safe", "Clue_Codigo_Vent"],
        solved: false,
        hint: "Un teclado numérico final (Necesita pistas combinadas).",
      };
      resetMeshVisualState(keypadMesh); // Ensure default appearance
      console.log(`Final Keypad puzzle configured.`);
    },
    interact: (keypad) => {
      const data = keypad.userData;
      if (data.solved) {
        updateTooltip("Teclado final ya utilizado.");
        return;
      }

      // Check requirements (Both clues needed)
      const reqCheck = checkRequirements(data.requires);
      if (!reqCheck.met) {
        updateTooltip(`Necesitas las pistas: ${reqCheck.missing.join(", ")}.`);
        playSound("error_short");
        return;
      }

      // Requirements met, open puzzle modal
      showPuzzleModalContent(
        "finalKeypad",
        data.puzzleId,
        "Teclado Final",
        "Introduce el código combinado.",
        "number",
        "Código..." // Number input
      );
    },
    checkSolution: async (inputValue) => {
      const keypad = getScene().getObjectByName("finalKeypad");
      if (!keypad || !keypad.userData) return false;
      const data = keypad.userData;
      if (data.solved) return false;

      // Find the required clue items
      const clueSafeItem = getInventory().find((item) =>
        item.startsWith("Clue_Codigo_Safe")
      );
      const clueVentItem = getInventory().find((item) =>
        item.startsWith("Clue_Codigo_Vent")
      );

      if (!clueSafeItem || !clueVentItem) {
        console.error(
          "Final keypad check failed: Missing required clues in inventory!"
        );
        const puzzleMessage = getUIElement("puzzleMessage");
        if (puzzleMessage)
          puzzleMessage.textContent = "Error: Faltan pistas necesarias.";
        return false; // Should not happen if interact check passed
      }

      // Extract codes from clues
      const matchSafe = clueSafeItem.match(/\(([^)]+)\)/);
      const codeSafe = matchSafe && matchSafe[1] ? matchSafe[1] : null;
      const matchVent = clueVentItem.match(/\(([^)]+)\)/);
      const codeVent = matchVent && matchVent[1] ? matchVent[1] : null;

      if (!codeSafe || !codeVent) {
        console.error(
          "Final keypad check failed: Could not extract codes from clues."
        );
        const puzzleMessage = getUIElement("puzzleMessage");
        if (puzzleMessage) puzzleMessage.textContent = "Error al leer pistas.";
        return false;
      }

      // Combine codes (Safe code first, then Vent code as per spec)
      const correctCombinedCode = `${codeSafe}${codeVent}`; // "123" + "789" = "123789"

      if (inputValue.trim() === correctCombinedCode) {
        data.solved = true;
        playSound("success_chime"); // Keypad accept sound
        markPuzzleSolved(data.puzzleId);
        // Grant Reward (Final Escape Code/Master Key Clue)
        const { grantPuzzleReward } = await import("./puzzles.js");
        grantPuzzleReward(data.puzzleId, null); // Adds clue/item to inventory

        data.hint = "Teclado final activado";
        // Visual feedback
        keypad.material.color.setHex(0x77dd77); // Green light
        keypad.material.emissive.setHex(0x33aa33);
        keypad.material.needsUpdate = true;
        // Update modal and close
        const puzzleMessage = getUIElement("puzzleMessage");
        if (puzzleMessage)
          puzzleMessage.textContent = `¡Código Combinado Correcto!`;
        setTimeout(hidePuzzleModal, 1800);
        return true;
      } else {
        playSound("error_short"); // Keypad reject sound
        const puzzleMessage = getUIElement("puzzleMessage");
        if (puzzleMessage)
          puzzleMessage.textContent = "Código Combinado Incorrecto.";
        const puzzleInput = getUIElement("puzzleInput");
        if (puzzleInput) puzzleInput.value = "";
        return false;
      }
    },
    cleanup: null, // Static mesh reset
  },

  // --- Escape Door (Always Last) ---
  {
    id: "escapeDoor",
    name: "Puerta de Salida",
    description:
      "La única salida. Parece necesitar una llave maestra o un código final.",
    requires: null, // Set dynamically by selectPuzzles based on the LAST puzzle's reward
    rewardType: "Victory", // Triggers game win state
    difficultyRestriction: null, // Always present
    setup: (s) => {
      // Configures the existing door mesh
      const doorMesh = s.getObjectByName("exitDoor");
      if (!doorMesh) {
        console.error("Exit Door mesh not found during setup!");
        return;
      }
      // Reset state for the new game
      doorMesh.userData.solved = false;
      // Requirement and hint are set dynamically by selectPuzzles *after* chain generation
      // Set a default hint here which will be overwritten
      doorMesh.userData.hint =
        doorMesh.userData.baseHint || "La puerta de salida...";
      doorMesh.userData.puzzleId = "escapeDoor"; // Ensure puzzleId is set
      resetMeshVisualState(doorMesh); // Ensure closed color/state
      console.log(
        `Escape Door puzzle state reset. Requirement will be set by selectPuzzles.`
      );
    },
    interact: (door, selectedItemName) => {
      const data = door.userData;
      const actualRequirement = data.requires; // This is set by selectPuzzles

      if (!actualRequirement) {
        console.error("Escape Door has no requirement set!");
        updateTooltip("Error: La puerta no sabe qué necesita.");
        return;
      }

      if (data.solved) {
        updateTooltip("La puerta ya está abierta.");
        return;
      }

      let canOpen = false;
      let usedItem = null;

      // Check if requirement is an item and if player selected it
      if (
        actualRequirement.startsWith("Item_") &&
        selectedItemName === actualRequirement
      ) {
        canOpen = true;
        usedItem = selectedItemName;
      }
      // Check if requirement is a clue and player has it (doesn't need selection)
      else if (
        actualRequirement.startsWith("Clue_") &&
        getInventory().includes(actualRequirement)
      ) {
        // Special case: If it's the Final Code clue, maybe open a modal? Or just unlock?
        // For simplicity, let's assume having the clue is enough to interact and unlock.
        canOpen = true;
        usedItem = actualRequirement; // The clue itself is "used"
      }

      if (canOpen) {
        data.solved = true;
        playSound("unlock_heavy"); // Door unlock sound
        markPuzzleSolved(data.puzzleId); // Mark door solved

        // Consume the item/clue used
        if (usedItem) {
          removeItemFromInventory(usedItem);
          if (selectedItemName === usedItem) deselectItem();
        }

        data.hint = "Puerta abierta";
        updateTooltip("¡Has desbloqueado la puerta de salida!");
        // Visual Feedback: Open the door (animate rotation/position)
        // Example: door.rotation.y += Math.PI / 2.5; // Swing open
        door.material.color.setHex(0x333333); // Darker color for open gap?

        // Trigger VICTORY state after a short delay
        setTimeout(() => {
          setGameState(GAME_STATES.VICTORY);
        }, 1000); // 1 second delay
      } else {
        // Cannot open yet
        if (actualRequirement.startsWith("Item_")) {
          if (getInventory().includes(actualRequirement)) {
            updateTooltip(
              `Selecciona la ${actualRequirement} para usarla aquí.`
            );
          } else {
            updateTooltip(`La puerta necesita: ${actualRequirement}.`);
          }
        } else if (actualRequirement.startsWith("Clue_")) {
          if (!getInventory().includes(actualRequirement)) {
            updateTooltip(`La puerta necesita la pista: ${actualRequirement}.`);
          } else {
            // Has the clue, but interaction didn't unlock it directly?
            // This might happen if we required a modal for the final code clue.
            updateTooltip(
              `Tienes la pista "${actualRequirement}", pero necesitas activarla en la puerta.`
            );
          }
        } else {
          updateTooltip(
            `La puerta está cerrada. Necesita: ${actualRequirement}`
          );
        }
        playSound("locked_drawer"); // Locked sound
      }
    },
    checkSolution: null, // Not a modal puzzle (unless final code is modal)
    cleanup: null, // Static mesh reset
  },
]; // --- END OF allPuzzles ARRAY ---

// =============================================================================
// PUZZLE MANAGEMENT FUNCTIONS
// =============================================================================

export function getPuzzleDefinition(puzzleId) {
  return allPuzzles.find((p) => p.id === puzzleId);
}

export function getActivePuzzles() {
  return [...activePuzzles]; // Return copy
}

export function getActivePuzzlesCount() {
  // Count puzzles excluding the escape door
  return activePuzzles.filter((p) => p.id !== "escapeDoor").length;
}
export function getSolvedPuzzlesCount() {
  return puzzlesSolvedCount;
}

// --- Puzzle Selection Logic ---
export function selectPuzzles(difficultyValue, scene) {
  console.log(
    `--- Selecting Puzzles (Difficulty Value: ${difficultyValue}) ---`
  );
  activePuzzles = [];
  assignedRewards = {}; // Reset assigned rewards
  availableRewardsPool = [...AVAILABLE_REWARDS]; // Reset available rewards pool
  puzzlesSolvedCount = 0;

  let targetPuzzleCount;
  let difficultyName;

  // Determine target count and filter pool based on difficulty
  const basePuzzlePool = allPuzzles.filter((p) => p.id !== "escapeDoor"); // Exclude door initially
  let filteredPuzzlePool = [...basePuzzlePool];

  if (difficultyValue === 4) {
    // Easy
    targetPuzzleCount = 4;
    difficultyName = "Easy";
    filteredPuzzlePool = filteredPuzzlePool.filter(
      (p) => !p.difficultyRestriction
    ); // Remove restricted
  } else if (difficultyValue === 7) {
    // Medium
    targetPuzzleCount = 7;
    difficultyName = "Medium";
    filteredPuzzlePool = filteredPuzzlePool.filter(
      (p) => !p.difficultyRestriction
    ); // Remove restricted
  } else if (difficultyValue === 10) {
    // Difficult
    targetPuzzleCount = 10;
    difficultyName = "Difficult";
    // No filter needed, all puzzles allowed
  } else {
    // Expert (All) or Invalid -> Default to Expert
    targetPuzzleCount = basePuzzlePool.length; // Use all available non-door puzzles
    difficultyName = "Expert";
    // No filter needed
  }

  // Ensure target count doesn't exceed available filtered puzzles
  if (targetPuzzleCount > filteredPuzzlePool.length) {
    console.warn(
      `Requested ${targetPuzzleCount} puzzles for ${difficultyName}, but only ${filteredPuzzlePool.length} suitable puzzles available. Using ${filteredPuzzlePool.length}.`
    );
    targetPuzzleCount = filteredPuzzlePool.length;
  }

  console.log(
    `Targeting ${targetPuzzleCount} puzzles for ${difficultyName} difficulty.`
  );

  // --- Forward Chain Generation ---
  let puzzleChainIds = [];
  let currentSimulatedInventory = []; // Simulate item/clue/signal acquisition
  let remainingPool = [...filteredPuzzlePool]; // Puzzles left to choose from
  let safetyCounter = 0;
  const maxLoops = targetPuzzleCount * 3; // Safety break

  while (
    puzzleChainIds.length < targetPuzzleCount &&
    remainingPool.length > 0 &&
    safetyCounter < maxLoops
  ) {
    safetyCounter++;

    // Find candidates whose requirements are met by simulated inventory
    let candidates = remainingPool.filter((p) => {
      const reqCheck = checkRequirementsSimulated(
        p.requires,
        currentSimulatedInventory
      );
      return reqCheck.met;
    });

    // console.log(` Loop ${safetyCounter}: Chain ${puzzleChainIds.length}/${targetPuzzleCount}. SimInv: [${currentSimulatedInventory.join(', ')}]. Candidates: [${candidates.map(p=>p.id).join(', ')}]`);

    if (candidates.length > 0) {
      // Select one candidate randomly
      let randomIndex = Math.floor(Math.random() * candidates.length);
      let nextPuzzle = candidates[randomIndex];
      console.log(`  Selected candidate: ${nextPuzzle.id}`);

      // Add to chain
      puzzleChainIds.push(nextPuzzle.id);

      // Assign Reward if applicable
      if (
        nextPuzzle.rewardType === "Item" ||
        nextPuzzle.rewardType === "Clue"
      ) {
        if (availableRewardsPool.length > 0) {
          // Simple random assignment for now
          // TODO: Could be smarter - prioritize required items/clues for later puzzles?
          let rewardIndex = Math.floor(
            Math.random() * availableRewardsPool.length
          );
          let rewardToAssign = availableRewardsPool.splice(rewardIndex, 1)[0]; // Remove and get reward
          assignedRewards[nextPuzzle.id] = rewardToAssign;
          console.log(
            `   Assigned reward: ${rewardToAssign} to ${nextPuzzle.id}`
          );
          // Add reward to simulated inventory for next checks
          // Use prefix for items/clues, full name for signals
          const rewardIdentifier = rewardToAssign.startsWith("Enable_")
            ? rewardToAssign
            : rewardToAssign.split(" ")[0];
          currentSimulatedInventory.push(rewardIdentifier);
        } else {
          console.warn(
            `   No available rewards left to assign to ${nextPuzzle.id}!`
          );
          // This might make the chain unsolvable if later puzzles need items.
        }
      } else if (nextPuzzle.rewardType === "Signal") {
        // Add signal to simulated inventory
        if (nextPuzzle.id === "demo_colorSequence") {
          // Assuming color sequence gives book enable signal
          const signal = "Enable_Book_Puzzle";
          console.log(`   Adding signal: ${signal} from ${nextPuzzle.id}`);
          currentSimulatedInventory.push(signal);
        }
        // Add other signals here if needed
      }

      // Remove selected puzzle from the remaining pool
      remainingPool = remainingPool.filter((p) => p.id !== nextPuzzle.id);
    } else {
      // No solvable candidates found with current simulated inventory
      console.error(
        `Chain generation stuck at ${
          puzzleChainIds.length
        } puzzles. No candidates found with inventory: [${currentSimulatedInventory.join(
          ", "
        )}]. Remaining pool: [${remainingPool.map((p) => p.id).join(", ")}]`
      );
      break; // Stop generation
    }
  } // End while loop

  if (safetyCounter >= maxLoops) {
    console.error(
      "Puzzle chain generation exceeded max loops. Chain may be incomplete or broken."
    );
  }
  if (puzzleChainIds.length < targetPuzzleCount) {
    console.warn(
      `Generated chain is shorter (${puzzleChainIds.length}) than targeted (${targetPuzzleCount}).`
    );
    // Update the target count to reflect the actual generated length for UI consistency
    targetPuzzleCount = puzzleChainIds.length;
  }

  // --- Populate activePuzzles Array ---
  puzzleChainIds.forEach((id) => {
    const puzzleDef = allPuzzles.find((p) => p.id === id);
    if (puzzleDef) {
      activePuzzles.push({
        ...puzzleDef, // Copy definition
        isSolved: false,
        isMarkedSolved: false,
        assignedReward: assignedRewards[id] || null, // Add the assigned reward
      });
    }
  });

  // --- Configure and Add Escape Door ---
  const doorMesh = getScene().getObjectByName("exitDoor");
  const doorPuzzleDef = allPuzzles.find((p) => p.id === "escapeDoor");
  let finalRequirement = "Item_Llave_Maestra"; // Default

  if (activePuzzles.length > 0) {
    const lastPuzzleInChain = activePuzzles[activePuzzles.length - 1];
    const lastPuzzleReward = lastPuzzleInChain.assignedReward; // Get the dynamically assigned reward
    // Check if the last reward is suitable for the door (Master Key or Final Code Clue)
    if (
      lastPuzzleReward &&
      (lastPuzzleReward === "Item_Llave_Maestra" ||
        lastPuzzleReward.startsWith("Clue_Codigo_Final"))
    ) {
      finalRequirement = lastPuzzleReward;
    } else {
      console.warn(
        `Last puzzle (${lastPuzzleInChain.id}) reward "${lastPuzzleReward}" is not Master Key or Final Code. Defaulting door requirement to ${finalRequirement}.`
      );
      // Force assign master key as reward to *something* if possible? Or ensure final keypad is last?
      // For now, just default. This might make Expert mode impossible if final keypad isn't last AND doesn't grant the final code clue.
      // Need to refine reward assignment logic for expert maybe.
    }
  } else {
    console.warn(
      "No puzzles generated in chain! Door requirement will be default."
    );
  }

  if (doorMesh && doorMesh.userData && doorPuzzleDef) {
    doorMesh.userData.requires = finalRequirement; // SET THE DYNAMIC REQUIREMENT
    doorMesh.userData.hint = `La puerta de salida... (Necesita ${finalRequirement})`; // Update hint
    doorMesh.userData.solved = false; // Ensure reset
    activePuzzles.push({
      ...doorPuzzleDef,
      requires: finalRequirement,
      isSolved: false,
      isMarkedSolved: false,
    }); // Add door to active list
    console.log(`Escape Door configured. Requires: ${finalRequirement}`);
  } else {
    console.error(
      "Exit door mesh or definition not found during final configuration!"
    );
  }

  console.log(`--- Puzzle Selection Complete ---`);
  console.log(
    `Active Puzzles (${activePuzzles.length}): [${activePuzzles
      .map((p) => `${p.id}${p.assignedReward ? "->" + p.assignedReward : ""}`)
      .join(", ")}]`
  );
  console.log(`Assigned Rewards Map:`, assignedRewards);
  console.log(
    `Effective puzzle count for this game (excluding door): ${getActivePuzzlesCount()}`
  );
}

// --- Setup & Cleanup ---
export function setupPuzzles(scene) {
  console.log(`Setting up ${activePuzzles.length} active puzzles/objects...`);
  puzzlesSolvedCount = 0; // Reset counter for new game
  // Ensure puzzle-specific states are reset before setup
  bookPuzzleSolved = false;
  firstBookClicked = null;
  bookPuzzleEnabled = false;

  activePuzzles.forEach((p) => {
    if (p.setup) {
      try {
        p.setup(scene);
      } catch (e) {
        console.error(`Error during setup for puzzle ${p.id}:`, e);
      }
    }
  });
  console.log("Finished setupPuzzles.");
}

// Cleans dynamic elements AND resets static puzzle elements
export function cleanupPuzzles(scene) {
  console.log("Cleaning up puzzles and resetting static elements...");
  const objectsToRemove = []; // Dynamic meshes created by puzzle setups
  const staticPuzzleMeshNames = [
    // Names of meshes created in sceneSetup that are configured by puzzles
    "deskDrawer",
    "airVent",
    "pressurePlate",
    "finalKeypad",
    "wiresPuzzle_Trigger",
    "simonSays_Trigger",
    "symbolMatching_Object",
    "projectorPuzzle_Object",
    "pictureOnWall",
    "rug",
    "exitDoor",
    // Add book names if they are static
    // "bookPuzzle_0", "bookPuzzle_1", ... (Need a pattern check)
  ];

  // 1. Identify dynamic objects to remove
  scene.traverse((child) => {
    if (
      child.userData &&
      (child.userData.puzzleId ||
        child.userData.isPickup ||
        child.userData.holdable)
    ) {
      // Don't remove static meshes configured by puzzles or the books
      const isStaticPuzzleMesh = staticPuzzleMeshNames.includes(child.name);
      const isBookMesh = child.name?.startsWith("bookPuzzle_"); // Keep books

      if (!isStaticPuzzleMesh && !isBookMesh) {
        objectsToRemove.push(child);
      }
    }
  });

  // 2. Remove dynamic objects and dispose resources
  console.log(
    `Removing ${objectsToRemove.length} dynamic puzzle/pickup objects.`
  );
  objectsToRemove.forEach((o) => {
    removeInteractableObject(o);
    removeCollisionObject(o);
    if (o === getHeldObject()) {
      // Make sure interaction.js exports this getter or manages it
      // If cleaning up while holding, force drop? Or just clear? Clear for now.
      // placeHeldObject(true); // This might cause issues during cleanup
      heldObject = null; // Assuming direct access or setter
    }
    if (o.parent) o.parent.remove(o);
    o.geometry?.dispose();
    // Dispose materials and textures (carefully)
    if (o.material) {
      let materials = Array.isArray(o.material) ? o.material : [o.material];
      materials.forEach((m) => {
        if (m) {
          // Dispose textures within the material
          Object.values(m).forEach((value) => {
            if (value instanceof THREE.Texture) {
              value.dispose();
            }
          });
          m.dispose(); // Dispose the material itself
        }
      });
    }
  });

  // 3. Reset state and visuals of static puzzle elements and books
  staticPuzzleMeshNames.forEach((name) => {
    const mesh = scene.getObjectByName(name);
    if (mesh && mesh.userData) {
      // Reset puzzle-specific data only if it was added
      if (mesh.userData.puzzleId) {
        mesh.userData.solved = false;
        mesh.userData.puzzleId = null; // Remove link
        mesh.userData.requires = null; // Clear specific requirements
        // Keep baseHint, originalPos, etc.
      }
      if (mesh.userData.opened !== undefined) mesh.userData.opened = false;
      if (mesh.userData.revealed !== undefined) mesh.userData.revealed = false;
      if (mesh.userData.hasBattery !== undefined)
        mesh.userData.hasBattery = false;
      if (mesh.userData.hasSlide !== undefined) mesh.userData.hasSlide = false;
      resetMeshVisualState(mesh); // Reset appearance
    }
  });
  // Reset Books specifically
  scene.traverse((obj) => {
    if (obj.name?.startsWith("bookPuzzle_")) {
      if (obj.userData) {
        obj.userData.puzzleId = null; // Remove link for this game
        obj.userData.interactable = true; // Re-enable base interaction? Or keep disabled until configured?
        obj.userData.hint = obj.userData.baseHint;
      }
      resetMeshVisualState(obj); // Reset color/emissive using its initialColor
    }
  });

  // 4. Reset puzzle system state
  activePuzzles = [];
  assignedRewards = {};
  puzzlesSolvedCount = 0;
  // Reset specific puzzle module states
  bookPuzzleEnabled = false;
  bookPuzzleSolved = false;
  firstBookClicked = null;
  clearInventory(); // Clear player inventory

  console.log("Puzzle cleanup finished.");
}

// --- Granting Rewards ---
// Called by puzzle interaction/checkSolution when puzzle is successfully completed
export function grantPuzzleReward(solvedPuzzleId, position) {
  const puzzleInstance = activePuzzles.find((p) => p.id === solvedPuzzleId);
  const rewardName = puzzleInstance?.assignedReward; // Get the reward assigned during selectPuzzles

  if (!rewardName) {
    console.warn(
      `Cannot grant reward: No assigned reward found for puzzle ${solvedPuzzleId}`
    );
    return;
  }

  console.log(`Granting reward for ${solvedPuzzleId}: ${rewardName}`);

  if (rewardName.startsWith("Item_")) {
    // Create a pickup item at the specified position (or a default if null)
    const spawnPos = position
      ? position.clone().add(new THREE.Vector3(0, 0.2, 0))
      : new THREE.Vector3(0, 0.5, 0); // Adjust offset
    let itemColor = 0xffff00; // Default color - Customize based on item name
    if (rewardName.includes("Llave_Dorada")) itemColor = 0xffd700;
    else if (rewardName.includes("Llave_Maestra")) itemColor = 0xe0e0e0;
    else if (rewardName.includes("Llave_Pequeña")) itemColor = 0xcd7f32;
    else if (rewardName.includes("Destornillador")) itemColor = 0x808080;
    else if (rewardName.includes("Linterna_UV")) itemColor = 0x9400d3;
    else if (rewardName.includes("Diapositiva")) itemColor = 0xadd8e6;
    else if (rewardName.includes("Bateria")) itemColor = 0x00ff00;

    createInvPickupItem(
      getScene(),
      rewardName,
      `Un ${rewardName}`,
      spawnPos,
      itemColor
    ); // Use inventory's function
    updateTooltip(`¡Has conseguido un ${rewardName}! Busca dónde recogerlo.`);
  } else if (rewardName.startsWith("Clue_")) {
    // Add the clue directly to the inventory
    if (addItemToInventory(rewardName)) {
      updateTooltip(`Pista añadida al inventario: ${rewardName.split(" ")[0]}`); // Show short name
      playSound("pickup_clue");
    }
  } else if (rewardName.startsWith("Signal_")) {
    // Handle signals (like enabling book puzzle) - This might be better handled directly where the signal is relevant
    console.log(
      `Signal reward type used for ${solvedPuzzleId}: ${rewardName}. Signal should be handled by receiving logic.`
    );
    // Example: if (rewardName === 'Signal_Enable_Books') bookPuzzleEnabled = true;
    // This logic might live where the signal is *checked* instead.
  } else {
    console.warn(
      `Unknown reward type assigned to ${solvedPuzzleId}: ${rewardName}`
    );
  }
}

// --- Puzzle Solved Tracking ---
export function markPuzzleSolved(puzzleId) {
  const puzzleIndex = activePuzzles.findIndex((p) => p.id === puzzleId);

  if (puzzleIndex > -1 && !activePuzzles[puzzleIndex].isMarkedSolved) {
    activePuzzles[puzzleIndex].isMarkedSolved = true;
    puzzlesSolvedCount++;
    updateHUD(); // Update HUD display (uses getSolvedPuzzlesCount)
    console.log(
      `Puzzle "${
        activePuzzles[puzzleIndex].name || puzzleId
      }" marked solved. Total Solved: ${puzzlesSolvedCount}/${getActivePuzzlesCount()}`
    );

    // Check win condition ONLY if the solved puzzle was the door itself
    if (puzzleId === "escapeDoor") {
      // Victory state is set by the door's interact logic, this is just logging
      console.log(
        "Escape Door marked solved, victory sequence should trigger."
      );
    }
  } else if (puzzleIndex > -1 && activePuzzles[puzzleIndex].isMarkedSolved) {
    console.log(`Puzzle ${puzzleId} was already marked as solved.`);
  } else {
    console.warn(
      `Attempted to mark puzzle solved which is not active or not found: ${puzzleId}`
    );
  }
}

// --- Requirement Checking ---
// Checks inventory/state against puzzle requirements
export function checkRequirements(requirements) {
  if (!requirements)
    return { met: true, missing: [], needsItem: false, itemNeeded: null };

  const reqArray = Array.isArray(requirements) ? requirements : [requirements];
  const currentInventory = getInventory(); // Get current inventory
  let missing = [];
  let needsItem = false; // Does it require an Item_* or Clue_*?
  let itemNeeded = null; // The first Item_/Clue_ required
  let met = true;

  reqArray.forEach((req) => {
    let requirementMet = false;
    if (req === "Enable_Book_Puzzle") {
      if (bookPuzzleEnabled) {
        // Check the global flag
        requirementMet = true;
      } else {
        missing.push("Activación Libros");
      }
    } else if (req.startsWith("Item_") || req.startsWith("Clue_")) {
      needsItem = true;
      const prefix = req.split(" ")[0]; // Check for "Item_Llave" or "Clue_Codigo" etc.
      if (currentInventory.some((item) => item.startsWith(prefix))) {
        requirementMet = true;
        if (!itemNeeded) itemNeeded = req; // Store the first item/clue needed for hint purposes
      } else {
        missing.push(req); // Add the full required item/clue name to missing list
      }
    }
    // Add checks for other signal types ('Signal_Something') if needed

    if (!requirementMet) {
      met = false;
    }
  });

  return { met, missing, needsItem, itemNeeded };
}

// Helper for puzzle selection simulation (uses simulated inventory)
function checkRequirementsSimulated(requirements, simulatedInventory) {
  if (!requirements) return { met: true };
  const reqArray = Array.isArray(requirements) ? requirements : [requirements];
  let met = true;
  reqArray.forEach((req) => {
    let requirementMet = false;
    if (req === "Enable_Book_Puzzle") {
      if (simulatedInventory.includes("Enable_Book_Puzzle"))
        requirementMet = true;
    } else if (req.startsWith("Item_") || req.startsWith("Clue_")) {
      const prefix = req.split(" ")[0];
      // Check if the *prefix* exists in the simulated inventory
      if (simulatedInventory.some((itemPrefix) => itemPrefix === prefix))
        requirementMet = true;
    }
    // Add other signal checks if needed
    if (!requirementMet) met = false;
  });
  return { met };
}

// --- Specific Puzzle Logic Helpers ---

// Book Swap Click Handler (Called by interaction.js)
export function handleBookClick(clickedBook) {
  if (
    !bookPuzzleEnabled ||
    bookPuzzleSolved ||
    !clickedBook ||
    !clickedBook.userData?.interactable
  ) {
    if (!bookPuzzleEnabled && !bookPuzzleSolved) {
      updateTooltip("Estos libros no parecen moverse...");
    } else if (bookPuzzleSolved) {
      updateTooltip("La secuencia de libros ya es correcta.");
    }
    return;
  }

  // Check Book Sequence Clue requirement first
  const reqCheck = checkRequirements(clickedBook.userData.requires);
  if (!reqCheck.met) {
    updateTooltip(
      `Necesitas la pista ${reqCheck.missing.join(", ")} para saber el orden.`
    );
    playSound("error_short");
    return;
  }

  const bookIndex = clickedBook.userData.bookIndex;
  if (bookIndex === undefined) {
    console.warn("Clicked book is missing bookIndex!", clickedBook);
    return;
  }

  console.log(`Book clicked: index ${bookIndex}`);
  playSound("click_soft");

  if (firstBookClicked === null) {
    // Selecting the first book
    firstBookClicked = clickedBook;
    // Visual feedback: Highlight selected book
    firstBookClicked.material.emissiveIntensity = 0.4; // Make it glow more
    updateTooltip(
      `Seleccionado: Libro ${
        bookIndex + 1
      }. Haz clic en otro para intercambiar.`
    );
  } else {
    // Second book clicked
    firstBookClicked.material.emissiveIntensity = 0; // Remove highlight from first book

    if (firstBookClicked === clickedBook) {
      // Clicked the same book again - Deselect
      console.log("Deselecting book.");
      firstBookClicked = null;
      updateTooltip(""); // Clear tooltip or show default book hint
    } else {
      // Clicked a different book - Swap colors
      console.log(
        `Swapping colors between book ${
          firstBookClicked.userData.bookIndex + 1
        } and ${bookIndex + 1}`
      );
      const firstColorHex = firstBookClicked.material.color.getHex();
      const secondColorHex = clickedBook.material.color.getHex();

      firstBookClicked.material.color.setHex(secondColorHex);
      clickedBook.material.color.setHex(firstColorHex);

      // Reset first book selection state
      firstBookClicked = null;
      playSound("book_slide"); // Sound for swapping
      updateTooltip("Libros intercambiados.");

      // Check if the new sequence is correct
      checkBookSequence();
    }
  }
}

// Check Book Sequence (Called after a swap)
async function checkBookSequence() {
  // <<< Añade async
  if (bookPuzzleSolved) return; // Already solved

  const bookMeshes = [];
  getScene().traverse((obj) => {
    // Find all book meshes in the current scene
    if (obj.name?.startsWith("bookPuzzle_")) {
      bookMeshes.push(obj);
    }
  });
  // Sort by original index to ensure consistent order checking
  bookMeshes.sort(
    (a, b) => (a.userData?.bookIndex || 0) - (b.userData?.bookIndex || 0)
  );

  if (bookMeshes.length !== bookSwapCorrectSequence.length) {
    console.error(
      "Book sequence check failed: Mismatch between found books and correct sequence length!"
    );
    return;
  }

  let match = true;
  for (let i = 0; i < bookMeshes.length; i++) {
    if (
      !bookMeshes[i].material ||
      bookMeshes[i].material.color.getHex() !== bookSwapCorrectSequence[i]
    ) {
      match = false;
      break;
    }
  }

  if (match) {
    console.log("Book sequence CORRECT!");
    bookPuzzleSolved = true;
    playSound("success_chime");
    markPuzzleSolved("bookSwap");

    // Grant Reward (UV Light)
    const { grantPuzzleReward } = await import("./puzzles.js");
    grantPuzzleReward("bookSwap", bookMeshes[0].parent.position); // Spawn near bookshelf

    updateTooltip(`¡Secuencia de libros correcta!`);

    // Update book appearances and disable further interaction
    bookMeshes.forEach((book) => {
      book.userData.interactable = false;
      book.userData.hint = "Libro en posición correcta";
      book.material.emissiveIntensity = 0.6; // Final success glow
    });
    firstBookClicked = null; // Clear selection state
  } else {
    console.log("Book sequence incorrect.");
    // Provide feedback (optional)
    // updateTooltip("Hmm, ese orden no parece correcto...");
  }
}

// Utility to create text textures (used by some puzzle setups)
function createTextTexture(
  text,
  width = 256,
  height = 128,
  bgColor = "#333",
  textColor = "#FFF",
  font = "20px Arial"
) {
  // Basic implementation without caching for modularity example
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = width;
  canvas.height = height;
  // Background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);
  // Text
  ctx.font = font;
  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Basic multi-line handling
  const lines = text.split("\n");
  const lineHeight = parseInt(font, 10) * 1.2;
  const startY = height / 2 - (lineHeight * (lines.length - 1)) / 2;
  lines.forEach((line, index) => {
    ctx.fillText(line, width / 2, startY + index * lineHeight);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
