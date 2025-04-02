import { updateTooltip, getUIElement } from "./ui.js";
import { playSound } from "./audio.js";
import { getGameState, GAME_STATES } from "./main.js";
import {
  addInteractableObject,
  removeInteractableObject,
} from "./interaction.js"; // To manage pickup objects
import * as THREE from "three"; // Needed for pickup geometry/material

let inventory = [];
let selectedItem = null;

// --- Core Functions ---
export function addItemToInventory(itemName) {
  if (!itemName) {
    console.warn("addItemToInventory called with null/empty itemName");
    return false;
  }
  if (!inventory.includes(itemName)) {
    inventory.push(itemName);
    updateInventoryUI();
    console.log(`Item added to inventory: ${itemName}`);
    // Don't play sound/tooltip here, let the caller handle context
    return true;
  }
  console.warn(`Attempted to add duplicate item: ${itemName}`);
  // Provide feedback if trying to add duplicate (optional)
  updateTooltip(`Ya tienes ${itemName}.`);
  playSound("error_short");
  return false;
}

export function removeItemFromInventory(itemName) {
  const index = inventory.indexOf(itemName);
  if (index > -1) {
    const removed = inventory.splice(index, 1)[0];
    if (selectedItem === itemName) {
      deselectItem(false); // Deselect if it was the active item, no sound needed here
    }
    updateInventoryUI();
    console.log(`Removed from inventory: ${removed}`);
    // Don't play sound/tooltip here
    return true;
  }
  console.warn(`Attempted to remove item not in inventory: ${itemName}`);
  return false;
}

export function getInventory() {
  return [...inventory]; // Return copy
}

export function clearInventory() {
  inventory = [];
  selectedItem = null;
  updateInventoryUI();
  console.log("Inventory cleared.");
}

// --- Selection ---
export async function selectItem(itemName) {
  // <<< Añade async
  if (inventory.includes(itemName)) {
    if (selectedItem === itemName) return; // Already selected

    const previouslySelected = selectedItem;
    selectedItem = itemName;
    updateInventoryUI(); // Update highlight
    document.body.classList.toggle(
      "item-selected",
      getGameState() === GAME_STATES.PLAYING
    );
    console.log(`Selected: ${itemName}`);
    playSound("inventory_select");

    // Update hover interaction immediately if playing
    if (getGameState() === GAME_STATES.PLAYING) {
      try {
        const { getCamera, getScene, checkHoverInteraction } = await import(
          "./interaction.js"
        ); // Use dynamic import? Or pass camera/scene
        checkHoverInteraction(getCamera(), getScene());
      } catch (e) {
        console.error("Error updating hover on item select:", e);
      }
    }
  } else {
    console.warn(`Attempted to select item not in inventory: ${itemName}`);
  }
}

export async function deselectItem(playSoundEffect = true) {
  // <<< Añade async
  if (selectedItem) {
    console.log(`Deselected: ${selectedItem}`);
    const deselected = selectedItem;
    selectedItem = null;
    updateInventoryUI();
    document.body.classList.remove("item-selected");
    if (playSoundEffect) playSound("inventory_deselect");

    // Update hover interaction immediately if playing
    if (getGameState() === GAME_STATES.PLAYING) {
      try {
        const { getCamera, getScene, checkHoverInteraction } = await import(
          "./interaction.js"
        );
        checkHoverInteraction(getCamera(), getScene());
      } catch (e) {
        console.error("Error updating hover on item deselect:", e);
      }
    }
  }
}

export function getSelectedItem() {
  return selectedItem;
}

// --- UI Update ---
export function updateInventoryUI() {
  const inventoryItemsList = getUIElement("inventoryItems");
  if (!inventoryItemsList) return;

  inventoryItemsList.innerHTML = ""; // Clear previous list
  inventory.forEach((item) => {
    const li = document.createElement("li");
    // Basic name cleanup (remove details in parentheses for display)
    const displayName = item.replace(/\s\(.*?\)/, "");
    li.textContent = displayName;
    li.title = item; // Show full name on hover (tooltip)
    li.dataset.itemName = item; // Store full name for logic
    if (item === selectedItem) {
      li.classList.add("selected");
    }
    inventoryItemsList.appendChild(li);
  });

  if (inventory.length === 0) {
    const li = document.createElement("li");
    li.textContent = "(Vacío)";
    li.classList.add("empty");
    inventoryItemsList.appendChild(li);
  }
}

// --- UI Interaction ---
export function handleInventoryClick(event) {
  if (
    getGameState() === GAME_STATES.INVENTORY &&
    event.target.tagName === "LI" &&
    event.target.dataset.itemName
  ) {
    const itemName = event.target.dataset.itemName;
    if (selectedItem === itemName) {
      deselectItem(); // Click selected -> deselect
    } else {
      selectItem(itemName); // Click other -> select
    }
  }
}

// --- Create Pickup Object ---
// Moved here as it relates to inventory items appearing in the world
export function createPickupItem(
  scene,
  itemName,
  itemDescription,
  position,
  color = 0xffff00
) {
  if (!scene) return null;
  console.log(`Creating pickup mesh for: ${itemName}`);
  // Simple sphere geometry for pickups
  const pickupGeo = new THREE.SphereGeometry(0.12, 16, 8);
  const pickupMat = new THREE.MeshStandardMaterial({
    color: color,
    emissive: color, // Make it glow slightly
    emissiveIntensity: 0.6,
    metalness: 0.1,
    roughness: 0.4,
  });
  const pickupMesh = new THREE.Mesh(pickupGeo, pickupMat);
  pickupMesh.position.copy(position);
  pickupMesh.name = `${itemName}_pickup`; // Unique name
  pickupMesh.userData = {
    isPickup: true,
    interactable: true, // Can be hovered/clicked
    itemName: itemName,
    itemDescription: itemDescription,
    hint: `Recoger ${itemName} [E]`,
  };
  pickupMesh.castShadow = true;
  scene.add(pickupMesh);
  addInteractableObject(pickupMesh); // Make it hoverable/clickable
  console.log(
    `${itemName} pickup created at ${position.x.toFixed(
      1
    )}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}`
  );
  return pickupMesh;
}
