import * as THREE from 'three';
import { getGameState, getCamera, getControls, getScene, GAME_STATES, INTERACTION_DISTANCE, HOVER_CHECK_INTERVAL, areHintsEnabled } from './main.js';
import { updateTooltip, getUIElement } from './ui.js';
import { getCollisionObjects, addCollisionObject, removeCollisionObject } from './playerControls.js';
import { addItemToInventory, removeItemFromInventory, getSelectedItem, deselectItem, createPickupItem as createInvPickupItem } from './inventory.js';
import { getActivePuzzles, checkRequirements, handleBookClick, getPuzzleDefinition, markPuzzleSolved } from './puzzles.js'; // Import puzzle utils
import { playSound } from './audio.js';

// --- State ---
let interactableObjects = []; // Objects that can be hovered over / interacted with
let hoveredObject = null;
let heldObject = null;
const interactionRaycaster = new THREE.Raycaster();

// --- Constants ---
const HOLD_DISTANCE = 1.0;
const HOLD_OFFSET_DOWN = 0.15;
const HOLD_OFFSET_RIGHT = 0.1;

// --- Interactable Object Management ---
export function addInteractableObject(object) {
    if (object && !interactableObjects.includes(object)) {
        interactableObjects.push(object);
    }
}
export function removeInteractableObject(object) {
    const index = interactableObjects.indexOf(object);
    if (index > -1) {
        interactableObjects.splice(index, 1);
    }
}
export function getInteractableObjects() {
    return interactableObjects;
}
export function clearInteractableObjects() {
    interactableObjects = [];
    hoveredObject = null;
    heldObject = null; // Ensure held object is cleared on reset
    console.log("Interactable objects cleared.");
}


// --- Getters ---
export function getHoveredObject() { return hoveredObject; }
export function getHeldObject() { return heldObject; }
export function clearHoveredObject() {
     if (hoveredObject) {
         hoveredObject = null;
         updateTooltip('');
         document.body.classList.remove('interactable-hover');
     }
}

// --- Interaction Check ---
export function checkHoverInteraction(camera, scene) { // Pass camera and scene
    const gameState = getGameState();
    const controls = getControls();

    if (gameState !== GAME_STATES.PLAYING || !controls?.isLocked || !camera) {
        if (hoveredObject) clearHoveredObject();
        return;
    }

    // If holding an object, tooltip shows holding hint
    if (heldObject) {
        const holdHint = `Llevando: ${heldObject.userData?.name || 'objeto'}. [E] / Clic Izq para soltar.`;
        updateTooltip(holdHint); // updateTooltip handles showing/hiding
        if (document.body.classList.contains('interactable-hover')) {
             document.body.classList.remove('interactable-hover');
        }
        if (hoveredObject) hoveredObject = null; // Clear hover if holding starts
        return;
    }

    // Raycast from camera center
    interactionRaycaster.setFromCamera({ x: 0, y: 0 }, camera);
    interactionRaycaster.far = INTERACTION_DISTANCE + 0.5; // Set max distance
    const hits = interactionRaycaster.intersectObjects(interactableObjects, true); // Recursive check

    let currentHoverTarget = null;
    let hitDistance = Infinity;

    // Find the closest valid interactable hit
    for (const hit of hits) {
        if (hit.distance > INTERACTION_DISTANCE) continue; // Ignore hits beyond interaction range

        let obj = hit.object;
        // Traverse up to find the registered interactable parent if hit child mesh
        while (obj && !interactableObjects.includes(obj)) {
            obj = obj.parent;
        }

        if (obj && obj.userData && hit.distance < hitDistance) { // Check if it's a registered interactable
             // Additional check: ensure object is reasonably visible (not fully occluded)
             // More complex visibility checks could be added here if needed
            currentHoverTarget = obj;
            hitDistance = hit.distance;
            // Don't break, allow finding the absolute closest if multiple overlap
        }
    }


    // --- Determine Hint and Interaction State ---
    let hint = '';
    let canInteractNow = false;
    const hintsOn = areHintsEnabled();
    const selectedItem = getSelectedItem();
    const activePuzzles = getActivePuzzles(); // Get current active puzzles

    if (currentHoverTarget) {
        const data = currentHoverTarget.userData;
        const puzzleId = data.puzzleId; // Puzzle ID assigned by setupPuzzles
        const isActivePuzzle = puzzleId && activePuzzles.some(p => p.id === puzzleId);
        const puzzleDef = isActivePuzzle ? activePuzzles.find(p => p.id === puzzleId) : null;
        const baseHint = data.hint || (puzzleDef ? puzzleDef.name : "Examinar");

        // --- Logic based on object type and puzzle state ---

        // 1. Puzzle Objects (Active in current game)
        if (isActivePuzzle && puzzleDef) {
             const isSolved = data.solved || puzzleDef.isMarkedSolved; // Check both mesh state and global state
             if (isSolved && puzzleId !== 'airVent' && puzzleId !== 'demo_uvMessage') { // Allow re-interaction for some
                 hint = hintsOn ? `PISTA: ${baseHint} (Ya resuelto)` : `${baseHint} (Resuelto)`;
                 canInteractNow = false; // Cannot interact with most solved puzzles
             } else {
                 // Check Requirements for the *active* puzzle definition
                 const reqCheckResult = checkRequirements(puzzleDef.requires); // Use check from puzzles.js

                 if (!reqCheckResult.met) {
                      hint = hintsOn ? `PISTA: Falta ${reqCheckResult.missing.join(', ')}` : `Necesitas ${reqCheckResult.missing.join(', ')}`;
                      canInteractNow = true; // Can still interact to get the message
                 } else {
                     const needsItemSelected = reqCheckResult.needsItem && !data.holdable && !data.isPickup && !data.isMinigameTrigger;
                     const requiredItemPrefix = reqCheckResult.itemNeeded ? reqCheckResult.itemNeeded.split(' ')[0] : null;
                     const selectedItemPrefix = selectedItem ? selectedItem.split(' ')[0] : null;

                     if (needsItemSelected && !selectedItem) {
                         hint = hintsOn ? `PISTA: Selecciona ${reqCheckResult.itemNeeded} del inventario [I]` : `Selecciona ${reqCheckResult.itemNeeded}`;
                         canInteractNow = true; // Interact shows this message
                     } else if (needsItemSelected && selectedItem && requiredItemPrefix !== selectedItemPrefix) {
                          hint = hintsOn ? `PISTA: No puedes usar ${selectedItem}. Necesitas ${reqCheckResult.itemNeeded}` : `Objeto incorrecto: ${selectedItem}`;
                          canInteractNow = false; // Cannot interact with wrong item selected
                     } else if (needsItemSelected && selectedItem && requiredItemPrefix === selectedItemPrefix) {
                         hint = `Usar ${selectedItem} en ${puzzleDef.name}`;
                         canInteractNow = true;
                     } else if (data.isMinigameTrigger) {
                          hint = hintsOn ? `PISTA: Activa el minijuego "${puzzleDef.name}" [E]` : `Activar ${puzzleDef.name} [E]`;
                          canInteractNow = true;
                     } else {
                         // Requirements met, no specific item needed or correct item selected
                         hint = hintsOn ? `PISTA: Interactúa con ${puzzleDef.name} [E]` : (data.hint || puzzleDef.description || `Interactuar [E]`);
                         canInteractNow = true;
                     }
                 }
                  // Special case: Book puzzle requires enabling signal
                  if (puzzleId === 'bookSwap' && puzzleDef.requires?.includes('Enable_Book_Puzzle') && !checkRequirements('Enable_Book_Puzzle').met && !isSolved) {
                       hint = hintsOn ? "PISTA: Estos libros no se moverán hasta que actives algo más." : "Estos libros no se mueven...";
                       canInteractNow = false;
                  }
             }
        }
        // 2. Holdable Objects
        else if (data.holdable) {
             hint = hintsOn ? `PISTA: Puedes recoger ${data.name || 'este objeto'} [E]` : `Recoger ${data.name || 'objeto'} [E]`;
             canInteractNow = true;
        }
        // 3. Pickup Items
        else if (data.isPickup && data.itemName) {
            hint = hintsOn ? `PISTA: Recoge ${data.itemName} [E]` : `Recoger ${data.itemName} [E]`;
            canInteractNow = true;
        }
        // 4. Static Furniture / Non-Puzzle Interactables
        else if (data.interactable && !puzzleId) { // It's interactable but not part of the current puzzle chain
             hint = hintsOn ? `PISTA: Puedes examinar ${data.hint || 'esto'}. No parece útil ahora.` : data.hint || "Examinar";
             canInteractNow = false; // Usually cannot interact if not part of the active chain
             // Special hints for known static items if hints are on
             if (hintsOn) {
                  if(data.canBeMoved) hint = `PISTA: Este cuadro (${currentHoverTarget.name}) parece que puede moverse...`;
                  if(data.canBeLifted) hint = `PISTA: Quizás haya algo debajo de esta alfombra (${currentHoverTarget.name})...`;
                  // Add more specific hints for clock, sofa etc. if desired
             }
        }
         // 5. Puzzle Objects NOT Active in current game (e.g., keypad on easy mode)
         else if (data.interactable && puzzleId && !isActivePuzzle) {
              hint = hintsOn ? `PISTA: ${data.baseHint || 'Esto'} no es necesario para escapar en esta dificultad.` : data.baseHint || "No parece útil ahora.";
              canInteractNow = false;
         }
        // 6. Non-Interactable
        else {
            hint = hintsOn ? "PISTA: Esto no se puede usar." : ""; // Show nothing if not interactable unless hints are on
            canInteractNow = false;
        }

    } else {
        // No object hovered
        hint = '';
        canInteractNow = false;
    }

    // --- Update UI ---
    // Update tooltip only if text changes or object changes
    const tooltipElement = getUIElement('tooltip'); // Use getter from ui.js
    const currentTooltipText = tooltipElement ? tooltipElement.textContent : '';
    if (currentHoverTarget !== hoveredObject || hint !== currentTooltipText) {
         hoveredObject = currentHoverTarget; // Update stored hovered object
         updateTooltip(hint); // Update displayed text
    }

    // Update cursor style
    document.body.classList.toggle('interactable-hover', canInteractNow);

}


// --- Handle Interaction Action ---
export function handleInteraction() {
    const gameState = getGameState();
    if (gameState !== GAME_STATES.PLAYING || !getControls()?.isLocked) return;

    // Action 1: Place held object
    if (heldObject) {
        placeHeldObject();
        return;
    }

    // Action 2: Interact with hovered object
    if (hoveredObject && hoveredObject.userData) {
        const obj = hoveredObject;
        const data = obj.userData;
        const puzzleId = data.puzzleId;
        const isActivePuzzle = puzzleId && getActivePuzzles().some(p => p.id === puzzleId);
        const selectedItem = getSelectedItem(); // Get currently selected inventory item

        console.log(`Attempting interaction with: ${obj.name || 'Unnamed'} (Active: ${isActivePuzzle}, PuzzleID: ${puzzleId || 'None'})`);

        // --- Specific Object Types First ---
        if (data.holdable) {
            pickupHoldableObject(obj);
            return;
        }
        if (data.isPickup && data.itemName) {
            pickupItem(obj);
            return;
        }
        // Book swap interaction (only if active puzzle)
        if (obj.name?.startsWith('bookPuzzle_') && isActivePuzzle) {
            handleBookClick(obj); // Call function from puzzles.js
            return;
        }

        // --- General Puzzle Interaction ---
        const puzzleDef = getPuzzleDefinition(puzzleId); // Get definition (active or not)

        if (puzzleDef) {
            // Check requirements AGAIN before executing interaction
            const reqCheck = checkRequirements(puzzleDef.requires);
            if (!reqCheck.met) {
                updateTooltip(`Necesitas: ${reqCheck.missing.join(', ')}`);
                playSound('error_short');
                return; // Stop interaction if requirements unmet
            }
             // Check if specific item needed is selected
             const needsItemSelected = reqCheck.needsItem && !data.holdable && !data.isPickup && !data.isMinigameTrigger;
             if (needsItemSelected && !selectedItem) {
                  updateTooltip(`Selecciona ${reqCheck.itemNeeded} [I] para usar aquí.`);
                  playSound('click_soft');
                  return; // Stop, needs selection
             }
             if (needsItemSelected && selectedItem && !reqCheck.itemNeeded.startsWith(selectedItem.split(' ')[0])) {
                 updateTooltip(`No puedes usar ${selectedItem} aquí. Necesitas ${reqCheck.itemNeeded}.`);
                 playSound('error_short');
                 return; // Holding wrong item type
             }


            // Execute interact function (defined in puzzles.js)
            if (typeof puzzleDef.interact === 'function') {
                // Allow interaction only if the puzzle is *active* in the current game
                if (isActivePuzzle) {
                     // Prevent interaction if solved (unless interact handles solved state itself)
                     if (!data.solved || puzzleId === 'airVent' || puzzleId === 'demo_uvMessage') {
                          puzzleDef.interact(obj, selectedItem); // Pass selected item
                     } else {
                          updateTooltip(`${puzzleDef.name} (Resuelto)`);
                          playSound('click_soft');
                     }
                } else {
                    // Object is a puzzle element but not active for this difficulty
                     updateTooltip(data.baseHint || "No parece hacer nada útil ahora.");
                     playSound('click_soft');
                     console.log(`Interaction stopped: ${obj.name} (${puzzleId}) is not an active puzzle.`);
                }
            } else {
                 // Interactable puzzle object but no interact function defined? (Should not happen often)
                 console.warn(`No interact function defined for puzzle: ${puzzleId}`);
                 if (isActivePuzzle) updateTooltip(`Examinas ${puzzleDef.name}...`);
                 playSound('click_soft');
            }

        } else if (data.interactable) {
            // Interactable object, but not a puzzle (e.g., static furniture, clock)
            // Or a puzzle element not found in definitions (error)
             updateTooltip(data.hint || "No parece hacer nada útil.");
             playSound('click_soft');
        }

        return; // Interaction handled (or intentionally stopped)
    }

    // Action 3: Use selected item on nothing (if applicable) -> Now handled by dropSelectedItem 'G' key
    // if (selectedItem) {
    //     updateTooltip(`No puedes usar ${selectedItem} aquí. Pulsa [G] para soltar.`);
    //     playSound('error_short');
    //     return;
    // }

     // Clicked on nothing interactable
     playSound('click_soft'); // Soft click for empty interaction
}


// --- Pickup/Drop Logic ---

function pickupItem(itemMesh) {
    if (!itemMesh?.userData?.isPickup || !itemMesh.userData.itemName) {
        console.warn("pickupItem failed: Invalid mesh or data."); return;
    }
    const itemName = itemMesh.userData.itemName;
    console.log(`Picking up item: ${itemName}`);

    if (addItemToInventory(itemName)) { // addItemToInventory handles checks & UI update
        playSound('pickup_item');
        updateTooltip(`Recogido: ${itemName}`);

        // Remove mesh from scene and lists
        removeInteractableObject(itemMesh); // Remove from interactables
        if (itemMesh.parent) itemMesh.parent.remove(itemMesh);
        itemMesh.geometry?.dispose();
        if(Array.isArray(itemMesh.material)) {
            itemMesh.material.forEach(m => m.dispose());
        } else {
            itemMesh.material?.dispose();
        }
        if (hoveredObject === itemMesh) clearHoveredObject(); // Clear hover if it was this item
        console.log(`${itemName} added to inventory and mesh removed.`);
    } else {
         // addItemToInventory failed (e.g., duplicate) - it will show its own message/sound
         console.log(`Failed to add ${itemName} to inventory.`);
    }
}


function pickupHoldableObject(obj) {
    const gameState = getGameState();
    if (gameState !== GAME_STATES.PLAYING || heldObject || !obj?.userData?.holdable) return;

    console.log(`Picking up holdable: ${obj.name}`);
    heldObject = obj; // Assign to global held object state
    playSound('pickup_object');

    // Special: Add clue when picking up the cube
    let pickupMessage = `Recogiste: ${heldObject.userData.name || 'objeto'}`;
    if (obj.name === 'demo_holdableCube_Mesh') {
        const clueName = "Clue_Under_Cube (Símbolo X?)"; // Define the specific clue name
        if (addItemToInventory(clueName)) {
            pickupMessage += `\nEncontraste: ${clueName}`;
            console.log(`Added ${clueName} to inventory.`);
        }
    }
     updateTooltip(pickupMessage, 3000); // Show message for 3 seconds


    // Remove from world lists and scene graph
    removeInteractableObject(heldObject);
    removeCollisionObject(heldObject); // Stop colliding while held
    if (heldObject.parent) heldObject.parent.remove(heldObject);

    // Add to camera
    const camera = getCamera();
    camera.add(heldObject);
    updateHeldObjectPosition(); // Position relative to camera

    document.body.classList.add('holding-object');
    if (hoveredObject === heldObject) clearHoveredObject(); // Clear hover state

     // Set persistent holding tooltip AFTER the temporary pickup message fades
     setTimeout(() => {
          if (heldObject === obj && getGameState() === GAME_STATES.PLAYING) { // Check if still holding and playing
              const holdHint = `Llevando: ${heldObject.userData.name||'objeto'}. [E] / Clic Izq para soltar.`;
              updateTooltip(holdHint);
          }
     }, 3100); // Slightly longer than the pickup message duration
}


function updateHeldObjectPosition() {
    if (!heldObject || !getCamera()) return;
    const camera = getCamera();
    // Position relative to camera using local coordinates
    heldObject.position.set(HOLD_OFFSET_RIGHT, -HOLD_OFFSET_DOWN, -HOLD_DISTANCE);
    // Make object look forward relative to camera (or fixed rotation)
    heldObject.rotation.set(0, 0, 0); // Simpler: Keep object upright relative to camera
    // heldObject.quaternion.copy(camera.quaternion); // Option: Match camera rotation exactly
}


export function placeHeldObject(forceDrop = false) {
    const gameState = getGameState();
    if (!heldObject || (gameState !== GAME_STATES.PLAYING && !forceDrop)) return;

    const placingObject = heldObject; // Keep reference
    const placingObjectName = placingObject.name || 'Unnamed Object';
    const placingObjectData = placingObject.userData || {};
    console.log(`Attempting to place/drop: ${placingObjectName}`);
    playSound('place_object');
    let placedSuccessfully = false;
    let placedOnPressurePlate = false;

    const camera = getCamera();
    const scene = getScene();
    const controls = getControls();
    const DIST_PLACE = INTERACTION_DISTANCE * 0.9; // Slightly shorter than hover distance

    // Remove from camera FIRST
    if (placingObject.parent === camera) {
        camera.remove(placingObject);
    } else {
         console.warn("Held object was not parented to camera during placement!");
    }

    // 1. Attempt Raycast Placement (if not forced drop)
    if (!forceDrop && gameState === GAME_STATES.PLAYING) {
        interactionRaycaster.setFromCamera({ x: 0, y: 0 }, camera);
        interactionRaycaster.far = DIST_PLACE;
        const hits = interactionRaycaster.intersectObjects(getCollisionObjects(), true); // Intersect with COLLISION objects
        let surfaceHit = null;

        for (const hit of hits) {
            // Ensure we are not hitting the object being held itself (shouldn't happen now)
            if (hit.object !== placingObject && hit.distance <= DIST_PLACE) {
                // Check if the surface normal is pointing mostly upwards (flat enough surface)
                const norm = hit.face?.normal.clone() || new THREE.Vector3(0, 1, 0);
                 // Check if the hit object is NOT the player (important if player capsule added to collisions)
                 const isPlayerHit = hit.object === controls?.getObject(); // Simple check if player object itself is collision object

                 // Check normal and ensure it's not the player object being hit
                if (norm.y > 0.7 && !isPlayerHit) { // Angle threshold for 'flat enough'
                    surfaceHit = hit;
                    break; // Found a suitable surface
                }
            }
        }

        if (surfaceHit) {
            const targetSurface = surfaceHit.object;
            const placementPoint = surfaceHit.point;
            console.log(`Found surface to place on: ${targetSurface.name || 'Unnamed Surface'}`);

            // Calculate object's bounding box *in world space* before adding to scene
            // Temporarily add to scene at origin to calculate bounds, then remove
             scene.add(placingObject);
             placingObject.updateMatrixWorld(); // Ensure world matrix is up-to-date
             const bb = new THREE.Box3().setFromObject(placingObject);
             scene.remove(placingObject); // Remove immediately after calculation
             const objectHeight = bb.max.y - bb.min.y;


            // Calculate final position: directly on the hit point + half height along normal
            const finalPos = placementPoint.clone().add(surfaceHit.face.normal.multiplyScalar(objectHeight / 2 + 0.01)); // Add tiny offset too

            // Set position and add to scene
            placingObject.position.copy(finalPos);
            // Set rotation - align with player view or keep upright? Keep upright.
            placingObject.rotation.set(0, camera.rotation.y + Math.PI, 0); // Face the player roughly
            scene.add(placingObject); // Add back to the main scene

            console.log(`Placed ${placingObjectName} at ${finalPos.x.toFixed(2)}, ${finalPos.y.toFixed(2)}, ${finalPos.z.toFixed(2)}`);
            placedSuccessfully = true;

            // *** PRESSURE PLATE LOGIC ***
            if (targetSurface.name === "pressurePlate" && placingObjectData.puzzleId === 'demo_holdableCube') {
                 console.log("Cube placed on Pressure Plate!");
                 placedOnPressurePlate = true;
                 const plateObject = scene.getObjectByName("pressurePlate"); // Get the plate mesh
                 const platePuzzleDef = getPuzzleDefinition('pressurePlate'); // Find active puzzle def

                 if (plateObject && plateObject.userData && !plateObject.userData.solved && platePuzzleDef) {
                     plateObject.userData.solved = true; // Mark the PLATE puzzle as solved
                     playSound('success_chime');
                     // Visual feedback for the plate
                     plateObject.position.y -= 0.03; // Sink the plate slightly
                     plateObject.material.color.setHex(0x77dd77); // Change color
                     plateObject.userData.hint = "Placa de presión (Activada)";

                     // Grant Reward for the PLATE puzzle
                     if(platePuzzleDef.assignedReward) { // Check if a reward was assigned
                          const { grantPuzzleReward } = await import('./puzzles.js'); // Dynamic import needed here?
                          grantPuzzleReward('pressurePlate', plateObject.position); // Grant plate's reward
                     } else {
                          console.warn("Pressure plate solved, but no reward was assigned!");
                     }
                     markPuzzleSolved('pressurePlate'); // Mark PLATE solved
                     updateTooltip(`Colocaste el cubo. ¡La placa se activó!`); // Combine message later maybe
                 } else if (plateObject?.userData.solved) {
                     updateTooltip("La placa de presión ya está activada.");
                 }
            }
            // *** END PRESSURE PLATE LOGIC ***
        }
    }

    // 2. If not placed on surface or forceDrop, drop in front of player
    if (!placedSuccessfully) {
        console.log(forceDrop ? "Forcing drop." : "No suitable surface found, dropping object.");
        const dropOffsetForward = 0.7; // How far in front
        const playerPos = controls.getObject().position;
        const cameraDir = new THREE.Vector3(); camera.getWorldDirection(cameraDir);
        cameraDir.y = 0; cameraDir.normalize(); // Horizontal direction player is facing

        const dropPosBase = playerPos.clone().add(cameraDir.multiplyScalar(dropOffsetForward));
        dropPosBase.y += PLAYER_HEIGHT * 0.5; // Start check slightly higher

        // Raycast downwards from potential drop point to find ground
        const downRay = new THREE.Raycaster(dropPosBase, new THREE.Vector3(0, -1, 0), 0, PLAYER_HEIGHT * 1.5);
        const groundHits = downRay.intersectObjects(getCollisionObjects(), true);

         // Calculate object height again (might be redundant if calculated above, but safe)
         scene.add(placingObject); placingObject.updateMatrixWorld();
         const bb = new THREE.Box3().setFromObject(placingObject);
         scene.remove(placingObject);
         const objectHeight = bb.max.y - bb.min.y;

        let groundY = 0.01; // Default height slightly above origin
        if (groundHits.length > 0) {
            // Find the highest valid intersection point below the drop start
             const firstValidHit = groundHits.find(hit => hit.object !== placingObject); // Don't hit self
             if(firstValidHit) {
                 groundY = firstValidHit.point.y;
             }
        }

        const finalDropPos = new THREE.Vector3(dropPosBase.x, groundY + objectHeight / 2 + 0.01, dropPosBase.z);

        // Perform the drop
        placingObject.position.copy(finalDropPos);
        placingObject.rotation.set(0, camera.rotation.y + Math.PI, 0); // Align roughly facing player
        scene.add(placingObject); // Add to scene
        placedSuccessfully = true;
        console.log(`Dropped ${placingObjectName} at ${finalDropPos.x.toFixed(2)}, ${finalDropPos.y.toFixed(2)}, ${finalDropPos.z.toFixed(2)}`);
    }

    // 3. Finalize placement/drop
    if (placedSuccessfully) {
        heldObject = null; // Clear the reference to the held object
        document.body.classList.remove('holding-object'); // Update cursor style

        // Restore interactability and collision
        if (placingObjectData.holdable) { // Only add back if it was originally holdable
             addInteractableObject(placingObject);
        }
        addCollisionObject(placingObject); // Assume dropped objects are obstacles


        // --- Mark the CUBE puzzle itself as solved upon successful drop/placement ---
        if (placingObjectData.puzzleId === 'demo_holdableCube' && !placingObjectData.solved) {
            placingObjectData.solved = true; // Mark cube's own state
            placingObjectData.hint = "Cubo Azul (colocado)"; // Update hint
            markPuzzleSolved('demo_holdableCube'); // Mark CUBE solved globally
            console.log("Holdable Cube puzzle marked as solved upon being placed/dropped.");
        }
        // --- End Cube Solve Logic ---

        // Update tooltip (unless pressure plate showed its own message)
        if (!placedOnPressurePlate) {
             updateTooltip(`Soltaste: ${placingObjectName}`);
        }
        // Re-check hover immediately
        if (gameState === GAME_STATES.PLAYING) {
             checkHoverInteraction(camera, scene);
        }

    } else {
         console.error(`Failed to place or drop ${placingObjectName}! Object remains held.`);
         // Re-attach to camera if placement failed completely
         camera.add(placingObject);
         updateHeldObjectPosition();
    }
}

// Called on 'G' key
export function dropSelectedItem() {
    const gameState = getGameState();
    const selectedItem = getSelectedItem();
    if (gameState !== GAME_STATES.PLAYING || !selectedItem) return;

    console.log(`Attempting to drop selected item: ${selectedItem}`);
    const itemToDrop = selectedItem; // Store name before deselecting

    // Try removing from inventory *first*
    if (removeItemFromInventory(itemToDrop)) { // This also deselects
         // Find position to drop
         const controls = getControls();
         const camera = getCamera();
         const dropOffsetForward = 0.8; const dropOffsetUp = -0.4; // Relative to player eye level
         const playerPos = controls.getObject().position;
         const camDir = new THREE.Vector3(); camera.getWorldDirection(camDir); camDir.y = 0; camDir.normalize();
         const dropPosBase = playerPos.clone().add(camDir.multiplyScalar(dropOffsetForward));
         dropPosBase.y += dropOffsetUp; // Adjust vertical position based on player height/view

         // Raycast downwards to find ground
         const downRay = new THREE.Raycaster(dropPosBase.clone().add(new THREE.Vector3(0, PLAYER_HEIGHT, 0)), new THREE.Vector3(0, -1, 0), 0, PLAYER_HEIGHT * 1.5);
         const groundIntersects = downRay.intersectObjects(getCollisionObjects(), true);
         let dropY = 0.15; // Default height if no ground found
         if (groundIntersects.length > 0) {
             dropY = groundIntersects[0].point.y + 0.15; // Place slightly above ground
         }
         const finalDropPos = new THREE.Vector3(dropPosBase.x, dropY, dropPosBase.z);

         // Create the 3D pickup object in the world
         createInvPickupItem(getScene(), itemToDrop, `Dropped: ${itemToDrop}`, finalDropPos); // Using inventory's create function
         updateTooltip(`Soltaste: ${itemToDrop}`);
         playSound('item_drop'); // Specific drop sound
    } else {
         console.error("Failed to remove item from inventory during drop attempt.");
         updateTooltip("Error al soltar ítem.");
         playSound('error_short');
         // Item remains selected if removal failed
    }
}
