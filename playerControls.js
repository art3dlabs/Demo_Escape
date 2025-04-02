import * as THREE from "three";
import { PointerLockControls as BasePointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { PLAYER_HEIGHT } from "./main.js"; // Import constants
import { getRoomSize } from "./sceneSetup.js";

// --- Constants ---
const PLAYER_RADIUS = 0.4;
const GRAVITY = 30.0;
const MOVE_SPEED = 8.0; // Increased speed slightly
const JUMP_HEIGHT = 8.0;

// --- State Variables ---
let playerVelocity = new THREE.Vector3();
let playerDirection = new THREE.Vector3();
let moveForward = false,
  moveBackward = false,
  moveLeft = false,
  moveRight = false;
let canJump = true;
let onGround = false;
let collisionObjects = []; // Objects player collides with
const raycasterGround = new THREE.Raycaster(
  new THREE.Vector3(),
  new THREE.Vector3(0, -1, 0),
  0,
  PLAYER_HEIGHT + 0.1
); // Ground check raycaster

// --- Custom PointerLockControls ---
// Extend base controls if needed, or just use composition
class PointerLockControls extends BasePointerLockControls {
  constructor(camera, domElement) {
    super(camera, domElement);
    this.velocity = playerVelocity; // Expose velocity
    // Add any custom methods or properties here if needed
  }
  // Add a reset method if needed by main.js startGame
  resetState() {
    this.velocity.set(0, 0, 0);
    onGround = false;
    canJump = true;
  }
}

// --- Setup ---
export function setupPointerLockControls(camera, domElement) {
  const controls = new PointerLockControls(camera, domElement);
  // Add listeners inside main.js or ui.js where gameState is managed
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
  // scene might not be needed if collisions managed here
  if (!controls || !controls.isLocked) {
    // Apply damping even when not locked, but less aggressively
    playerVelocity.x -= playerVelocity.x * 5.0 * deltaTime;
    playerVelocity.z -= playerVelocity.z * 5.0 * deltaTime;
    // Gravity still applies if in air
    if (!onGround) {
      playerVelocity.y -= GRAVITY * deltaTime;
      controls.getObject().position.y += playerVelocity.y * deltaTime;
      // Basic floor collision even when paused/not locked
      if (controls.getObject().position.y < PLAYER_HEIGHT) {
        controls.getObject().position.y = PLAYER_HEIGHT;
        playerVelocity.y = 0;
        onGround = true;
        canJump = true;
      }
    }
    return; // Don't process movement input if not locked
  }

  const playerPosition = controls.getObject().position;

  // --- Apply Gravity & Ground Check ---
  raycasterGround.ray.origin.copy(playerPosition);
  raycasterGround.ray.origin.y += 0.1; // Start slightly above feet
  const groundIntersections = raycasterGround.intersectObjects(
    collisionObjects,
    true
  ); // Check against scene collision objects
  const groundHit = groundIntersections.find((i) => i.distance < 0.2); // Check within 0.2 units below origin+offset

  if (onGround) {
    // If was on ground last frame
    playerVelocity.y = Math.max(0, playerVelocity.y); // Prevent accumulating downward velocity
  }

  if (groundHit) {
    // Landed on something
    const groundY = groundHit.point.y;
    if (playerPosition.y <= groundY + PLAYER_HEIGHT + 0.01) {
      // Check if feet are at or slightly below ground
      playerVelocity.y = 0;
      playerPosition.y = groundY + PLAYER_HEIGHT; // Snap to ground
      onGround = true;
      canJump = true;
    } else {
      // In air, but ground detected below (e.g., jumping up)
      playerVelocity.y -= GRAVITY * deltaTime;
      onGround = false;
    }
  } else {
    // No ground detected below
    playerVelocity.y -= GRAVITY * deltaTime;
    onGround = false;
  }

  // --- Movement Input ---
  // Damping (reduces sliding)
  playerVelocity.x -= playerVelocity.x * 10.0 * deltaTime;
  playerVelocity.z -= playerVelocity.z * 10.0 * deltaTime;

  playerDirection.z = Number(moveForward) - Number(moveBackward);
  playerDirection.x = Number(moveLeft) - Number(moveRight);
  playerDirection.normalize(); // Ensure consistent speed diagonally

  const currentMoveSpeed = MOVE_SPEED * (onGround ? 1.0 : 0.7); // Slower air control

  if (moveForward || moveBackward) {
    playerVelocity.z -= playerDirection.z * currentMoveSpeed * 10.0 * deltaTime;
  }
  if (moveLeft || moveRight) {
    playerVelocity.x -= playerDirection.x * currentMoveSpeed * 10.0 * deltaTime;
  }

  // --- Apply Movement using Controls ---
  // Controls.moveRight applies movement perpendicular to look direction
  // Controls.moveForward applies movement parallel to look direction
  controls.moveRight(-playerVelocity.x * deltaTime);
  controls.moveForward(-playerVelocity.z * deltaTime);

  // Apply vertical velocity
  playerPosition.y += playerVelocity.y * deltaTime;

  // --- Boundary Collision ---
  checkWallCollision(playerPosition, playerVelocity);

  // --- Object Collision (Simple AABB - Placeholder) ---
  // More complex collision (e.g., capsule vs objects) is advanced
  // This is a very basic example, often better handled by physics engine
  /*
     const playerBox = new THREE.Box3().setFromCenterAndSize(
          playerPosition,
          new THREE.Vector3(PLAYER_RADIUS * 2, PLAYER_HEIGHT, PLAYER_RADIUS * 2)
     );
     collisionObjects.forEach(obj => {
          if (obj.geometry && obj !== getSceneObjectByName('floor')) { // Ignore floor
               const objBox = new THREE.Box3().setFromObject(obj);
               if (playerBox.intersectsBox(objBox)) {
                    // Basic collision response: Stop movement towards object
                    // This is complex to get right without a physics engine
                    console.log("Collision with", obj.name);
                    // Simplistic pushback (needs refinement)
                    // playerVelocity.x = 0; playerVelocity.z = 0;
               }
          }
     });
     */
}

// --- Wall Collision ---
function checkWallCollision(position, velocity) {
  const ROOM_SIZE = getRoomSize();
  const checkPos = (axis, limit) => {
    const positiveLimit = limit / 2 - PLAYER_RADIUS;
    const negativeLimit = -limit / 2 + PLAYER_RADIUS;
    if (position[axis] > positiveLimit) {
      position[axis] = positiveLimit;
      velocity[axis] = 0;
    } else if (position[axis] < negativeLimit) {
      position[axis] = negativeLimit;
      velocity[axis] = 0;
    }
  };
  checkPos("x", ROOM_SIZE.width);
  checkPos("z", ROOM_SIZE.depth);
  // Ceiling collision (optional)
  // if (position.y > ROOM_SIZE.height - 0.1) {
  //      position.y = ROOM_SIZE.height - 0.1;
  //      velocity.y = Math.min(0, velocity.y); // Stop upward movement
  // }
}

// --- Input Event Handlers (Called by ui.js listeners) ---
// Add async keyword here:
export async function handleKeyDown(key) {
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
        onGround = false;
        // Play jump sound (dynamic import is now valid)
        try {
          const { playSound } = await import("./audio.js"); // Dynamic import example
          playSound("jump");
        } catch (e) {
          console.error("Failed to play jump sound", e);
        }
      }
      break;
  }
}

export function handleKeyUp(key) {
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
      canJump = true;
      break; // Allow jumping again when space is released
  }
}
