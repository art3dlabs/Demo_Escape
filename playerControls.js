import * as THREE from "three";
import { PointerLockControls as BasePointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { PLAYER_HEIGHT } from "./main.js";
import { getRoomSize } from "./sceneSetup.js";
import { getGameState, GAME_STATES } from './main.js';


// --- Constants ---
const PLAYER_RADIUS = 0.4;
const GRAVITY = 30.0;
const MOVE_SPEED = 3.2;
const JUMP_HEIGHT = 8.0;
const GROUND_CHECK_DISTANCE = 0.3;

// --- State Variables ---
let playerVelocity = new THREE.Vector3();
let playerDirection = new THREE.Vector3();
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let canJump = false;
let onGround = false;
let collisionObjects = []; // <<< ¡LA VARIABLE YA ESTABA! Solo faltaban las funciones.
let raycasterGround;

// --- Collision Object Management (AÑADIR ESTE BLOQUE ENTERO) ---
export function addCollisionObject(object) {
  if (!collisionObjects.includes(object)) {
    collisionObjects.push(object);
    // console.log("Added collision object:", object.name || object.uuid);
  }
}

export function removeCollisionObject(object) { // Exportar por si acaso
  const index = collisionObjects.indexOf(object);
  if (index > -1) {
    collisionObjects.splice(index, 1);
    // console.log("Removed collision object:", object.name || object.uuid);
  }
}

export function clearCollisionObjects() {
  // console.log("Clearing all collision objects.");
  collisionObjects = [];
}

export function getCollisionObjects() { // Añadir esta también, puede ser útil
    return collisionObjects;
}
// --- FIN DEL BLOQUE A AÑADIR ---


// --- Initialization (AÑADIR ESTA FUNCIÓN ENTERA) ---
export function setupPointerLockControls(camera, domElement) {
  // Initialize the Raycaster for ground check here
  raycasterGround = new THREE.Raycaster(
    new THREE.Vector3(),
    new THREE.Vector3(0, -1, 0), // Ray points straight down
    0,
    GROUND_CHECK_DISTANCE // Check only slightly below feet
  );

  const controls = new PointerLockControls(camera, domElement);
  // Event listeners for lock/unlock are usually handled in ui.js or main.js now
  return controls;
}
// --- FIN DE LA FUNCIÓN A AÑADIR ---



// --- Custom PointerLockControls --- (Sin cambios respecto a R.11)
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

// --- Player Update ---
// --- Player Update --- (Adaptado de la versión HTML funcional)
export function updatePlayerMovement(deltaTime, controls, scene) {
  if (!controls) return; // Salir si no hay controles

  const playerObject = controls.getObject();
  if (!playerObject) return; // Salir si el objeto del control no existe

  const playerPosition = playerObject.position;

  // --- Gravedad (Siempre se aplica si no está en el suelo) ---
  if (!onGround) {
      playerVelocity.y -= GRAVITY * deltaTime;
  }

  // --- Lógica de Movimiento Horizontal (Solo si está bloqueado y jugando) ---
  if (controls.isLocked && getGameState() === GAME_STATES.PLAYING) {
    // Amortiguación (Damping)
      playerVelocity.x -= playerVelocity.x * 10.0 * deltaTime;
      playerVelocity.z -= playerVelocity.z * 10.0 * deltaTime;

      // Dirección basada en input
      playerDirection.z = Number(moveForward) - Number(moveBackward);
      playerDirection.x = Number(moveRight) - Number(moveLeft);
      playerDirection.normalize(); // Evita velocidad diagonal extra

      // Aplicar velocidad basada en input usando el método del HTML
      const currentMoveSpeed = MOVE_SPEED * (onGround ? 1.0 : 0.8); // Más lento en aire
      // Nota: El HTML usaba 10.0 como multiplicador aquí, parece mucho, usamos currentMoveSpeed
      if (moveForward || moveBackward) playerVelocity.z -= playerDirection.z * currentMoveSpeed * 10.0 * deltaTime; // Ajusta el 10.0 si es muy rápido/lento
      if (moveLeft || moveRight)     playerVelocity.x -= playerDirection.x * currentMoveSpeed * 10.0 * deltaTime; // Ajusta el 10.0 si es muy rápido/lento

      // Salto
      if (canJump && onGround && moveForward === false && moveBackward === false && moveLeft === false && moveRight === false) { // Verificar si ' ' está presionado para saltar (handleKeyDown lo maneja)
           // La lógica de salto está en handleKeyDown, aquí solo gestionamos onGround/canJump
      }

  } else {
       // Si no está bloqueado o jugando, detener velocidad horizontal
       playerVelocity.x = 0;
       playerVelocity.z = 0;
  }

  // --- Aplicar Movimiento y Colisión con Suelo Simple ---
  const deltaX = playerVelocity.x * deltaTime;
  const deltaY = playerVelocity.y * deltaTime;
  const deltaZ = playerVelocity.z * deltaTime;

  // Aplicar movimiento horizontal usando el método de controls
  if (controls.isLocked) { // Solo mover con moveRight/Forward si está bloqueado
       controls.moveRight(-deltaX);
       controls.moveForward(-deltaZ);
  }

  // Aplicar movimiento vertical directamente a la posición
  playerPosition.y += deltaY;

  // --- Chequeo de Suelo SIMPLE (como en HTML) ---
  const groundLevel = 0.0; // Asumimos que el suelo está en Y=0
  if (playerPosition.y < groundLevel + PLAYER_HEIGHT) {
      playerVelocity.y = 0; // Detener caída
      playerPosition.y = groundLevel + PLAYER_HEIGHT; // Colocar justo a la altura correcta
      if (!onGround) { // Si ACABA de tocar el suelo
           console.log("Landed (Simple Check)");
           onGround = true;
           canJump = true; // Puede saltar de nuevo
      }
  } else {
      if (onGround) { // Si ACABA de despegarse
           console.log("Left ground (Simple Check)");
           onGround = false;
      }
  }

  // --- Colisión con Paredes (Sin cambios) ---
  checkWallCollision(playerPosition, playerVelocity); // Pasar velocidad para detenerla si choca

  // --- Actualizar Objeto Sostenido (Si existe - lógica de interaction.js) ---
  // Esta lógica debería estar ahora en interaction.js o main.js/animate
  // if (heldObject) updateHeldObjectPosition();
}

// Asegúrate que gameState sea accesible aquí, importándolo si es necesario
// import { getGameState, GAME_STATES } from './main.js'; al inicio del archivo
// O pásalo como argumento a updatePlayerMovement si prefieres:
// export function updatePlayerMovement(deltaTime, controls, scene, gameState) { ... }
// Y ajústalo en la llamada en main.js: updatePlayerMovement(delta, controls, scene, getGameState());



// --- Wall Collision (Solo X/Z) ---
function checkWallCollision(position, velocity) {
    // ... (sin cambios respecto a R.11)
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
