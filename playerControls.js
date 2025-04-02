import * as THREE from "three";
import { PointerLockControls as BasePointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { PLAYER_HEIGHT } from "./main.js"; // Import constants
import { getRoomSize } from "./sceneSetup.js";

// --- Constants ---
const PLAYER_RADIUS = 0.4;
const GRAVITY = 30.0;
const MOVE_SPEED = 8.0;
const JUMP_HEIGHT = 8.0;
const GROUND_CHECK_DISTANCE = 0.2; // How far below origin to check for ground

// --- State Variables ---
let playerVelocity = new THREE.Vector3();
let playerDirection = new THREE.Vector3();
let moveForward = false,
  moveBackward = false,
  moveLeft = false,
  moveRight = false;
let canJump = true; // Start assuming jump is possible until proven otherwise
let onGround = false;
let collisionObjects = []; // Objects player collides with

// <<< --- STEP 1: Declare raycasterGround but DO NOT initialize --- >>>
let raycasterGround;

// --- Custom PointerLockControls ---
class PointerLockControls extends BasePointerLockControls {
  constructor(camera, domElement) {
    super(camera, domElement);
    this.velocity = playerVelocity; // Expose velocity
  }
  resetState() {
    this.velocity.set(0, 0, 0);
    onGround = false;
    canJump = true; // Reset jump state
    // Reset movement flags if needed (depends if key handlers are managed externally)
    moveForward = moveBackward = moveLeft = moveRight = false;
  }
}

// --- Setup ---
export function setupPointerLockControls(camera, domElement) {
  const controls = new PointerLockControls(camera, domElement);

  // <<< --- STEP 2: Initialize raycasterGround HERE --- >>>
  // PLAYER_HEIGHT is now guaranteed to be loaded from main.js
  raycasterGround = new THREE.Raycaster(
    new THREE.Vector3(), // Origin will be set dynamically
    new THREE.Vector3(0, -1, 0), // Direction is down
    0, // Near plane
    GROUND_CHECK_DISTANCE + 0.1 // Far plane (check slightly more than needed)
    // The actual check distance is handled in updatePlayerMovement
  );

  // NOTE: Event listeners for keys (handleKeyDown/Up) should be added
  // in main.js or ui.js, ideally associated with the controls.lock/unlock events
  // or globally if always active when not in menu.

  return controls;
}

// --- Collision Object Management ---
export function addCollisionObject(object) {
  if (object && !collisionObjects.includes(object)) {
    collisionObjects.push(object);
  }
}

export function removeCollisionObject(object) {
  const index = collisionObjects.indexOf(object);
  if (index > -1) {
    collisionObjects.splice(index, 1);
  }
}

export function getCollisionObjects() {
  return collisionObjects;
}

export function clearCollisionObjects() {
  collisionObjects = [];
  console.log("Collision objects cleared.");
}

// --- Player Update ---
export function updatePlayerMovement(deltaTime, controls, scene) {
  if (!controls || !controls.enabled) {
    // Check controls.enabled instead of just isLocked
    // Simplified logic when controls are disabled (e.g., in menu)
    playerVelocity.set(0, 0, 0); // Stop movement completely
    // You might still want basic gravity/floor clamp if player can be in air in non-playing state
    return;
  }

  const playerPosition = controls.getObject().position;

  // --- Apply Gravity & Ground Check ---
  raycasterGround.ray.origin.copy(playerPosition);
  // Adjust origin Y if player pivot is not at feet level
  // raycasterGround.ray.origin.y -= PLAYER_HEIGHT / 2; // Example if origin is center mass

  const groundIntersections = raycasterGround.intersectObjects(
    collisionObjects,
    true
  );
  // Find the closest valid hit below the player
  let closestGroundHit = null;
  for (const hit of groundIntersections) {
    if (hit.distance > 0 && hit.distance < GROUND_CHECK_DISTANCE) {
      // Ensure hit is below origin and within range
      // Additional checks? e.g., hit.face.normal.y > 0.7 (mostly flat surface)
      closestGroundHit = hit;
      break; // Take the first valid one
    }
  }

  const wasOnGround = onGround; // Store previous state
  onGround = !!closestGroundHit; // Update current state

  if (onGround) {
    // Landed or is on ground
    playerVelocity.y = Math.max(0, playerVelocity.y); // Stop downward velocity
    // Snap to ground surface precisely using hit distance
    playerPosition.y -= closestGroundHit.distance - 0.01; // Adjust position based on ray distance
    if (!wasOnGround) {
      playSoundSafe("land"); // Play land sound only on transition
    }
    canJump = true; // Allow jumping
  } else {
    // In air
    playerVelocity.y -= GRAVITY * deltaTime;
    canJump = false; // Cannot jump mid-air (usually)
  }

  // --- Movement Input ---
  // Damping applies more strongly on ground
  const dampingFactor = onGround ? 15.0 : 5.0;
  playerVelocity.x -= playerVelocity.x * dampingFactor * deltaTime;
  playerVelocity.z -= playerVelocity.z * dampingFactor * deltaTime;

  playerDirection.z = Number(moveForward) - Number(moveBackward);
  playerDirection.x = Number(moveLeft) - Number(moveRight);
  playerDirection.normalize(); // Ensure consistent speed diagonally

  // Adjust speed based on ground/air state
  const currentMoveSpeed = MOVE_SPEED * (onGround ? 1.0 : 0.6); // Less air control

  // Apply movement forces based on input direction relative to camera
  // Need to get camera direction
  const cameraDirection = new THREE.Vector3();
  controls.getDirection(cameraDirection);
  const rightDirection = new THREE.Vector3()
    .crossVectors(controls.getObject().up, cameraDirection)
    .normalize();

  if (moveForward || moveBackward) {
    const forwardComponent = cameraDirection.multiplyScalar(
      playerDirection.z * currentMoveSpeed * 10.0 * deltaTime
    );
    playerVelocity.add(forwardComponent);
  }
  if (moveLeft || moveRight) {
    const rightComponent = rightDirection.multiplyScalar(
      playerDirection.x * currentMoveSpeed * 10.0 * deltaTime
    );
    playerVelocity.add(rightComponent);
  }

  // --- Apply Movement using Velocity directly (PointerLockControls doesn't handle velocity well) ---
  // Calculate displacement based on world velocity and delta time
  const deltaPosition = playerVelocity.clone().multiplyScalar(deltaTime);

  // Get current position
  const oldPosition = playerPosition.clone();

  // Apply displacement separately for X, Y, Z for collision checks
  // Apply Y first
  playerPosition.y += deltaPosition.y;
  // Check vertical collisions (floor handled by ground check, maybe ceiling?)
  // checkVerticalCollisions(playerPosition, oldPosition, playerVelocity);

  // Apply X
  playerPosition.x += deltaPosition.x;
  // Check horizontal collisions on X axis
  // checkHorizontalCollisions(playerPosition, oldPosition, playerVelocity, 'x');

  // Apply Z
  playerPosition.z += deltaPosition.z;
  // Check horizontal collisions on Z axis
  // checkHorizontalCollisions(playerPosition, oldPosition, playerVelocity, 'z');

  // --- Boundary Collision (Keep Simple Version) ---
  checkWallCollision(playerPosition, playerVelocity); // This clamps position
}

// --- Wall Collision ---
function checkWallCollision(position, velocity) {
  const ROOM_SIZE = getRoomSize();
  const checkPos = (axis, limit) => {
    const positiveLimit = limit / 2 - PLAYER_RADIUS;
    const negativeLimit = -limit / 2 + PLAYER_RADIUS;
    if (position[axis] > positiveLimit) {
      position[axis] = positiveLimit;
      velocity[axis] = 0; // Stop velocity on impact
    } else if (position[axis] < negativeLimit) {
      position[axis] = negativeLimit;
      velocity[axis] = 0; // Stop velocity on impact
    }
  };
  checkPos("x", ROOM_SIZE.width);
  checkPos("z", ROOM_SIZE.depth);
}

// --- Input Event Handlers ---
// These need to be connected to actual DOM event listeners (e.g., in main.js or ui.js)
export async function handleKeyDown(key) {
  // Made async for dynamic import
  key = key.toLowerCase(); // Normalize key
  switch (key) {
    case "w":
    case "arrowup":
      moveForward = true;
      break;
    case "s":
    case "arrowdown":
      moveBackward = true;
      break;
    case "a":
    case "arrowleft":
      moveLeft = true;
      break;
    case "d":
    case "arrowright":
      moveRight = true;
      break;
    case " ": // Space for Jump
      if (canJump && onGround) {
        playerVelocity.y = JUMP_HEIGHT;
        canJump = false;
        onGround = false; // Will be set true next frame if still grounded
        playSoundSafe("jump"); // Use helper for dynamic import
      }
      break;
  }
}

export function handleKeyUp(key) {
  key = key.toLowerCase(); // Normalize key
  switch (key) {
    case "w":
    case "arrowup":
      moveForward = false;
      break;
    case "s":
    case "arrowdown":
      moveBackward = false;
      break;
    case "a":
    case "arrowleft":
      moveLeft = false;
      break;
    case "d":
    case "arrowright":
      moveRight = false;
      break;
    case " ":
      break; // No action needed on space up usually
  }
}

// Helper for safely playing sounds with dynamic import
async function playSoundSafe(soundName) {
  try {
    const { playSound } = await import("./audio.js");
    playSound(soundName);
  } catch (e) {
    console.error(`Failed to play sound '${soundName}'`, e);
  }
}
