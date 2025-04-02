// Add this correct import block at the top of sceneSetup.js:
import {
  Scene,
  Color,
  PerspectiveCamera,
  WebGLRenderer,
  SRGBColorSpace,
  PCFSoftShadowMap,
  AmbientLight,
  HemisphereLight,
  PointLight,
  MeshStandardMaterial,
  TextureLoader, // Keep TextureLoader just in case
  RepeatWrapping,
  BoxGeometry,
  PlaneGeometry,
  DoubleSide,
  Vector3,
  CylinderGeometry,
  CircleGeometry,
  ConeGeometry,
  Group,
  Mesh,
  SphereGeometry,
} from "three";

import { addCollisionObject, clearCollisionObjects } from "./playerControls.js";
import {
  addInteractableObject,
  clearInteractableObjects,
} from "./interaction.js";

// --- Constants ---
const ROOM_SIZE = { width: 12, depth: 12, height: 3 };

// --- Texture Loading (Commented Out - Using basic colors) ---
/*
const textureLoader = new TextureLoader();
function loadTexture(path, repeatX = 1, repeatY = 1) {
    // ... (loading logic) ...
}
*/

// --- Basic Color Materials (Placeholder) ---
// Using simpler, less intense colors now
const woodMaterial = new MeshStandardMaterial({
  color: 0x966f33,
  roughness: 0.8,
  metalness: 0.1,
});
const darkWoodMaterial = new MeshStandardMaterial({
  color: 0x5c3a21,
  roughness: 0.8,
  metalness: 0.1,
});
const metalMaterial = new MeshStandardMaterial({
  color: 0xaaaaaa,
  roughness: 0.5,
  metalness: 0.7,
}); // Grey metal
const floorMaterial = new MeshStandardMaterial({
  color: 0x556b2f,
  roughness: 0.9,
  metalness: 0.0,
}); // Dark Olive Green floor
const wallMaterial = new MeshStandardMaterial({
  color: 0xc2b2a0,
  side: DoubleSide,
  roughness: 0.9,
  metalness: 0.0,
}); // Beige/Tan wall
const ceilingMaterial = new MeshStandardMaterial({
  color: 0xd8d8d8,
  side: DoubleSide,
}); // Light grey ceiling
const shelfMaterial = new MeshStandardMaterial({
  color: 0x966f33,
  roughness: 0.6,
});
const creamColor = 0xfff8dc;
const legMaterial = new MeshStandardMaterial({
  color: 0x444444,
  metalness: 0.7,
  roughness: 0.4,
});
const plantPotMaterial = new MeshStandardMaterial({ color: 0x8b4513 });
const plantLeavesMaterial = new MeshStandardMaterial({
  color: 0x228b22,
  roughness: 0.8,
});
const lampBaseMaterial = new MeshStandardMaterial({
  color: 0x505050,
  metalness: 0.8,
  roughness: 0.3,
});
const lampShadeMaterial = new MeshStandardMaterial({
  color: 0xffffe0,
  emissive: 0xffffe0,
  emissiveIntensity: 0.3,
  transparent: true,
  opacity: 0.85,
  side: DoubleSide,
}); // Lower intensity/opacity
const smallTableMaterial = new MeshStandardMaterial({
  color: 0xd2b48c,
  roughness: 0.7,
});
const pictureMaterial = new MeshStandardMaterial({
  color: 0xffcc88,
  roughness: 0.8,
});
const sofaFabricMaterial = new MeshStandardMaterial({
  color: 0x708090,
  roughness: 0.9,
}); // Slate gray sofa
const pressurePlateMaterial = new MeshStandardMaterial({
  color: 0x444455,
  metalness: 0.8,
  roughness: 0.3,
});
const keypadMaterial = new MeshStandardMaterial({
  color: 0x2a2a3a,
  metalness: 0.5,
  roughness: 0.5,
});
const wiresTriggerMaterial = new MeshStandardMaterial({
  color: 0x661111,
  emissive: 0x220000,
  emissiveIntensity: 0.2,
}); // Dimmer emissive
const simonTriggerMaterial = new MeshStandardMaterial({
  color: 0x111144,
  emissive: 0x000011,
  emissiveIntensity: 0.3,
}); // Dimmer emissive
const symbolBookMaterial = new MeshStandardMaterial({ color: 0xeeeecc });
const projectorMaterial = new MeshStandardMaterial({
  color: 0x303030,
  metalness: 0.6,
});
const ventMaterial = new MeshStandardMaterial({
  color: 0xbbbbbb,
  metalness: 0.7,
  roughness: 0.3,
  side: DoubleSide,
}); // Lighter grey vent

// --- Scene Creation ---
export function createScene() {
  const scene = new Scene();
  scene.background = new Color(0x282c34); // Darker background
  return scene;
}

// --- Camera Creation ---
export function createCamera() {
  const camera = new PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  return camera;
}

// --- Renderer Creation ---
export function createRenderer() {
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  return renderer;
}

// --- Lighting Setup (Dimmer) ---
export function setupLighting(scene) {
  console.log("Setting up lighting...");
  // Lower ambient and hemisphere lights
  const ambientLight = new AmbientLight(0xffffff, 0.1); // Much lower ambient
  scene.add(ambientLight);
  const hemiLight = new HemisphereLight(0xcccccc, 0x444444, 0.2); // Lower intensity
  scene.add(hemiLight);
  // Add PointLights inside setupRoomObjects
  console.log("Base lighting added.");
}

// --- Room Geometry and Static Objects ---
export function setupRoomObjects(scene) {
  console.log("Setting up room objects...");
  clearCollisionObjects();
  clearInteractableObjects();

  // --- Floor ---
  const floorGeo = new PlaneGeometry(ROOM_SIZE.width, ROOM_SIZE.depth);
  const floor = new Mesh(floorGeo, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.name = "floor";
  floor.userData = { isGround: true };
  scene.add(floor);
  addCollisionObject(floor);

  // --- Walls ---
  const wallGeoNS = new BoxGeometry(ROOM_SIZE.width, ROOM_SIZE.height, 0.1);
  const wallGeoEW = new BoxGeometry(ROOM_SIZE.depth, ROOM_SIZE.height, 0.1);
  const wallBack = new Mesh(wallGeoNS, wallMaterial.clone());
  wallBack.position.set(0, ROOM_SIZE.height / 2, -ROOM_SIZE.depth / 2);
  wallBack.receiveShadow = true;
  wallBack.castShadow = true;
  wallBack.name = "wallBack";
  scene.add(wallBack);
  addCollisionObject(wallBack);
  const wallLeft = new Mesh(wallGeoEW, wallMaterial.clone());
  wallLeft.position.set(-ROOM_SIZE.width / 2, ROOM_SIZE.height / 2, 0);
  wallLeft.rotation.y = Math.PI / 2;
  wallLeft.receiveShadow = true;
  wallLeft.castShadow = true;
  wallLeft.name = "wallLeft";
  scene.add(wallLeft);
  addCollisionObject(wallLeft);
  const wallRight = new Mesh(wallGeoEW, wallMaterial.clone());
  wallRight.position.set(ROOM_SIZE.width / 2, ROOM_SIZE.height / 2, 0);
  wallRight.rotation.y = Math.PI / 2;
  wallRight.receiveShadow = true;
  wallRight.castShadow = true;
  wallRight.name = "wallRight";
  scene.add(wallRight);
  addCollisionObject(wallRight);
  const wallFront = new Mesh(wallGeoNS, wallMaterial.clone());
  wallFront.position.set(0, ROOM_SIZE.height / 2, ROOM_SIZE.depth / 2);
  wallFront.receiveShadow = true;
  wallFront.castShadow = true;
  wallFront.name = "wallFront";
  scene.add(wallFront);
  addCollisionObject(wallFront);

  // --- Ceiling ---
  const ceilingGeo = new PlaneGeometry(ROOM_SIZE.width, ROOM_SIZE.depth);
  const ceiling = new Mesh(ceilingGeo, ceilingMaterial);
  ceiling.position.y = ROOM_SIZE.height;
  ceiling.rotation.x = Math.PI / 2;
  ceiling.name = "ceiling";
  scene.add(ceiling);

  // --- Furniture & Static Elements ---
  // Desk
  const deskHeight = 0.8;
  const tabletopWidth = 1.5;
  const tabletopHeight = 0.05;
  const tabletopDepth = 0.7;
  const legWidth = 0.08;
  const legDepth = 0.6;
  const legHeight = deskHeight - tabletopHeight;
  const tabletopGeo = new BoxGeometry(
    tabletopWidth,
    tabletopHeight,
    tabletopDepth
  );
  const tabletopMesh = new Mesh(tabletopGeo, woodMaterial);
  tabletopMesh.position.set(2.5, deskHeight - tabletopHeight / 2, 3.0);
  tabletopMesh.castShadow = true;
  tabletopMesh.receiveShadow = true;
  tabletopMesh.name = "deskTabletop";
  const legGeo = new BoxGeometry(legWidth, legHeight, legDepth);
  const legLeftMesh = new Mesh(legGeo, legMaterial);
  legLeftMesh.position.set(
    tabletopMesh.position.x - tabletopWidth / 2 + legWidth / 2 + 0.05,
    legHeight / 2,
    tabletopMesh.position.z
  );
  legLeftMesh.castShadow = true;
  legLeftMesh.receiveShadow = true;
  legLeftMesh.name = "deskLegLeft";
  const legRightMesh = new Mesh(legGeo, legMaterial);
  legRightMesh.position.set(
    tabletopMesh.position.x + tabletopWidth / 2 - legWidth / 2 - 0.05,
    legHeight / 2,
    tabletopMesh.position.z
  );
  legRightMesh.castShadow = true;
  legRightMesh.receiveShadow = true;
  legRightMesh.name = "deskLegRight";
  const newDeskGroup = new Group();
  newDeskGroup.add(tabletopMesh);
  newDeskGroup.add(legLeftMesh);
  newDeskGroup.add(legRightMesh);
  newDeskGroup.name = "newDesk";
  newDeskGroup.userData = {
    interactable: false,
    hint: "Un escritorio moderno",
    isStaticFurniture: true,
  };
  scene.add(newDeskGroup);
  addCollisionObject(tabletopMesh);
  addCollisionObject(legLeftMesh);
  addCollisionObject(legRightMesh);

  // Drawer Mesh
  const drawerWidth = 0.6;
  const drawerHeight = 0.15;
  const drawerDepth = 0.6;
  const drawerGeo = new BoxGeometry(drawerWidth, drawerHeight, drawerDepth);
  const drawer = new Mesh(drawerGeo, darkWoodMaterial);
  drawer.position.set(
    tabletopMesh.position.x,
    tabletopMesh.position.y - tabletopHeight / 2 - drawerHeight / 2 - 0.02,
    tabletopMesh.position.z - tabletopDepth / 2 + drawerDepth / 2 + 0.05
  );
  drawer.castShadow = true;
  drawer.receiveShadow = true;
  drawer.name = "deskDrawer";
  drawer.userData = {
    interactable: true,
    hint: "Un cajón cerrado.",
    baseHint: "Un cajón cerrado.",
  };
  scene.add(drawer);
  addInteractableObject(drawer);
  addCollisionObject(drawer);

  // Chair... (keep as is)
  const chairSeatHeight = 0.45;
  const chairSeatGeo = new BoxGeometry(0.4, 0.05, 0.4);
  const chairSeat = new Mesh(chairSeatGeo, woodMaterial);
  chairSeat.position.set(2.3, chairSeatHeight, 3.0 - 0.4);
  chairSeat.castShadow = true;
  chairSeat.receiveShadow = true;
  chairSeat.name = "chairSeat";
  const chairBackGeo = new BoxGeometry(0.4, 0.5, 0.05);
  const chairBack = new Mesh(chairBackGeo, woodMaterial);
  chairBack.position.set(2.3, chairSeatHeight + 0.25 + 0.025, 3.0 - 0.6);
  chairBack.castShadow = true;
  chairBack.receiveShadow = true;
  chairBack.name = "chairBack";
  const chair = new Group();
  chair.add(chairSeat);
  chair.add(chairBack);
  chair.position.y = 0;
  chair.name = "chair";
  chair.userData = {
    interactable: true,
    hint: "Una silla de madera",
    isStaticFurniture: true,
  };
  scene.add(chair);
  addInteractableObject(chair);
  addCollisionObject(chairSeat);

  // Item Shelves... (keep as is)
  const itemShelfWidth = 1.0;
  const itemShelfHeight = 0.04;
  const itemShelfDepth = 0.25;
  const itemShelfGeo = new BoxGeometry(
    itemShelfWidth,
    itemShelfHeight,
    itemShelfDepth
  );
  const itemShelfYPositions = [0.7, 1.2, 1.7];
  itemShelfYPositions.forEach((yPos, index) => {
    const shelf = new Mesh(itemShelfGeo, shelfMaterial);
    shelf.position.set(
      -ROOM_SIZE.width / 2 + itemShelfDepth / 2 + 0.01,
      yPos,
      0
    );
    shelf.rotation.y = Math.PI / 2;
    shelf.name = `itemShelf_${index}`;
    shelf.castShadow = true;
    shelf.receiveShadow = true;
    shelf.userData = { interactable: false };
    scene.add(shelf);
    addCollisionObject(shelf);
  });

  // Bookshelf... (keep as is)
  const bookShelfUnitWidth = 1.4;
  const bookShelfHeight = 0.04;
  const bookShelfDepth = 0.25;
  const bookShelfSupportWidth = 0.05;
  const bookShelfStructureHeight = 1.6;
  const bookShelfYPositions = [0.6, 1.1, 1.6];
  const bookShelfStructure = new Group();
  bookShelfStructure.name = "bookShelfStructure";
  const bookShelves = [];
  const bookShelfGeo = new BoxGeometry(
    bookShelfUnitWidth,
    bookShelfHeight,
    bookShelfDepth
  );
  bookShelfYPositions.forEach((yPos, index) => {
    const shelf = new Mesh(bookShelfGeo, shelfMaterial);
    shelf.position.y = yPos;
    shelf.name = `bookShelf_${index}`;
    shelf.castShadow = true;
    shelf.receiveShadow = true;
    bookShelfStructure.add(shelf);
    addCollisionObject(shelf);
    bookShelves.push(shelf);
  });
  const supportHeight = bookShelfStructureHeight + bookShelfHeight;
  const supportGeo = new BoxGeometry(
    bookShelfSupportWidth,
    supportHeight,
    bookShelfDepth * 0.8
  );
  const supportLeft = new Mesh(supportGeo, darkWoodMaterial);
  supportLeft.position.set(
    -bookShelfUnitWidth / 2 + bookShelfSupportWidth / 2,
    supportHeight / 2,
    0
  );
  supportLeft.castShadow = true;
  supportLeft.receiveShadow = true;
  bookShelfStructure.add(supportLeft);
  addCollisionObject(supportLeft);
  const supportRight = new Mesh(supportGeo, darkWoodMaterial);
  supportRight.position.set(
    bookShelfUnitWidth / 2 - bookShelfSupportWidth / 2,
    supportHeight / 2,
    0
  );
  supportRight.castShadow = true;
  supportRight.receiveShadow = true;
  bookShelfStructure.add(supportRight);
  addCollisionObject(supportRight);
  bookShelfStructure.position.set(
    -3.0,
    0,
    ROOM_SIZE.depth / 2 - bookShelfDepth / 2 - 0.01
  );
  scene.add(bookShelfStructure);
  bookShelfStructure.userData = { isStaticFurniture: true };

  // Safe Shelf... (keep as is)
  const safeShelfWidthEnlarged = 1.0;
  const safeShelfHeight = 0.04;
  const safeShelfDepthEnlarged = 0.7;
  const safeShelfGeo = new BoxGeometry(
    safeShelfWidthEnlarged,
    safeShelfHeight,
    safeShelfDepthEnlarged
  );
  const safeShelfY = 1.0;
  const safeShelfX = -3.0;
  const safeShelf = new Mesh(safeShelfGeo, shelfMaterial);
  safeShelf.position.set(
    safeShelfX,
    safeShelfY,
    -ROOM_SIZE.depth / 2 + safeShelfDepthEnlarged / 2 + 0.01
  );
  safeShelf.name = `safeShelfMesh`;
  safeShelf.castShadow = true;
  safeShelf.receiveShadow = true;
  safeShelf.userData = { interactable: false };
  scene.add(safeShelf);
  addCollisionObject(safeShelf);

  // Sofa... (keep as is)
  const sofaWidth = 1.8;
  const sofaDepth = 0.8;
  const sofaHeight = 0.7;
  const seatHeightSofa = 0.35;
  const armrestWidth = 0.2;
  const backHeightSofa = sofaHeight - seatHeightSofa;
  const sofaGroup = new Group();
  sofaGroup.name = "sofa";
  const seatGeo = new BoxGeometry(
    sofaWidth - 2 * armrestWidth,
    seatHeightSofa,
    sofaDepth
  );
  const seatMesh = new Mesh(seatGeo, sofaFabricMaterial);
  seatMesh.position.y = seatHeightSofa / 2;
  seatMesh.castShadow = true;
  seatMesh.receiveShadow = true;
  sofaGroup.add(seatMesh);
  addCollisionObject(seatMesh);
  const backGeo = new BoxGeometry(
    sofaWidth - 2 * armrestWidth,
    backHeightSofa,
    sofaDepth * 0.2
  );
  const backMesh = new Mesh(backGeo, sofaFabricMaterial);
  backMesh.position.y = seatHeightSofa + backHeightSofa / 2;
  backMesh.position.z = -sofaDepth / 2 + (sofaDepth * 0.2) / 2;
  backMesh.castShadow = true;
  backMesh.receiveShadow = true;
  sofaGroup.add(backMesh);
  addCollisionObject(backMesh);
  const armGeo = new BoxGeometry(armrestWidth, sofaHeight * 0.8, sofaDepth);
  const armLeft = new Mesh(armGeo, sofaFabricMaterial);
  armLeft.position.x = -sofaWidth / 2 + armrestWidth / 2;
  armLeft.position.y = (sofaHeight * 0.8) / 2;
  armLeft.castShadow = true;
  armLeft.receiveShadow = true;
  sofaGroup.add(armLeft);
  addCollisionObject(armLeft);
  const armRight = new Mesh(armGeo, sofaFabricMaterial);
  armRight.position.x = sofaWidth / 2 - armrestWidth / 2;
  armRight.position.y = (sofaHeight * 0.8) / 2;
  armRight.castShadow = true;
  armRight.receiveShadow = true;
  sofaGroup.add(armRight);
  addCollisionObject(armRight);
  sofaGroup.position.set(0, 0, 0);
  sofaGroup.userData = {
    interactable: true,
    hint: "Un sofá cómodo.",
    isStaticFurniture: true,
  };
  scene.add(sofaGroup);
  addInteractableObject(sofaGroup);

  // Small Table... (keep as is)
  const tableRadius = 0.3;
  const tableHeight = 0.5;
  const tableTopHeight = 0.04;
  const tableLegRadius = 0.03;
  const tableLegHeight = tableHeight - tableTopHeight;
  const tableTopGeo = new CylinderGeometry(
    tableRadius,
    tableRadius,
    tableTopHeight,
    24
  );
  const tableTop = new Mesh(tableTopGeo, smallTableMaterial);
  const tableLegGeo = new CylinderGeometry(
    tableLegRadius,
    tableLegRadius,
    tableLegHeight,
    12
  );
  const tableLeg = new Mesh(tableLegGeo, smallTableMaterial);
  const smallTable = new Group();
  smallTable.add(tableTop);
  smallTable.add(tableLeg);
  smallTable.position.set(
    sofaGroup.position.x,
    0,
    sofaGroup.position.z + sofaDepth / 2 + tableRadius + 0.2
  );
  const smallTableWorldPos = new Vector3();
  smallTable.getWorldPosition(smallTableWorldPos); // Calculate world pos before setting relative child positions
  tableTop.position.y = tableHeight - tableTopHeight / 2;
  tableLeg.position.y = tableLegHeight / 2;
  tableTop.castShadow = true;
  tableTop.receiveShadow = true;
  tableLeg.castShadow = true;
  tableLeg.receiveShadow = true;
  smallTable.name = "smallTable";
  smallTable.userData = {
    interactable: true,
    hint: "Una mesita auxiliar.",
    isStaticFurniture: true,
  };
  scene.add(smallTable);
  addInteractableObject(smallTable);
  addCollisionObject(tableTop);
  addCollisionObject(tableLeg);

  // Picture on Wall... (keep as is)
  const pictureGeo = new PlaneGeometry(0.8, 0.6);
  const picture = new Mesh(pictureGeo, pictureMaterial);
  const pictureFrameGeo = new BoxGeometry(0.8 + 0.05, 0.6 + 0.05, 0.03);
  const pictureFrame = new Mesh(pictureFrameGeo, darkWoodMaterial);
  picture.position.z = 0.016;
  const pictureGroup = new Group();
  pictureGroup.add(picture);
  pictureGroup.add(pictureFrame);
  pictureGroup.position.set(0, 1.5, -ROOM_SIZE.depth / 2 + 0.1);
  pictureGroup.name = "pictureOnWall";
  pictureGroup.userData = {
    interactable: true,
    hint: "Un cuadro colgado",
    baseHint: "Un cuadro colgado",
    canBeMoved: true,
    originalPos: pictureGroup.position.clone(),
  };
  scene.add(pictureGroup);
  addInteractableObject(pictureGroup);

  // Rug... (keep as is)
  const rugGeo = new PlaneGeometry(2.5, 1.8);
  const rugMat = new MeshStandardMaterial({ color: 0x6b2a3b, roughness: 0.9 });
  const rug = new Mesh(rugGeo, rugMat);
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.01, 0);
  rug.receiveShadow = true;
  rug.name = "rug";
  rug.userData = {
    interactable: true,
    hint: "Una alfombra vieja",
    baseHint: "Una alfombra vieja",
    canBeLifted: true,
    originalY: rug.position.y,
  };
  scene.add(rug);
  addInteractableObject(rug);

  // Wall Clock... (keep as is)
  const clockFaceGeo = new CircleGeometry(0.2, 32);
  const clockFaceMat = new MeshStandardMaterial({ color: 0xfff8dc });
  const clockFace = new Mesh(clockFaceGeo, clockFaceMat);
  const clockFrameGeo = new CylinderGeometry(0.22, 0.22, 0.04, 32);
  const clockFrameMat = new MeshStandardMaterial({ color: 0x5c3a21 });
  const clockFrame = new Mesh(clockFrameGeo, clockFrameMat);
  clockFrame.rotation.x = Math.PI / 2;
  clockFace.position.z = 0.021;
  const clockGroup = new Group();
  clockGroup.add(clockFace);
  clockGroup.add(clockFrame);
  clockGroup.position.set(4, 2.0, -ROOM_SIZE.depth / 2 + 0.1);
  clockGroup.name = "wallClock";
  clockGroup.userData = {
    interactable: true,
    hint: "Un reloj de pared. Marca las 3:00.",
    isStaticFurniture: true,
  };
  scene.add(clockGroup);
  addInteractableObject(clockGroup);

  // Air Vent Mesh... (keep as is)
  const ventGeo = new PlaneGeometry(0.4, 0.3);
  const airVent = new Mesh(ventGeo, ventMaterial);
  const airVentY = ROOM_SIZE.height - 0.3;
  const airVentZ = ROOM_SIZE.depth / 2 - 0.1;
  airVent.position.set(0, airVentY, airVentZ);
  airVent.name = "airVent";
  airVent.userData = {
    interactable: true,
    hint: "Una rejilla de ventilación.",
    baseHint: "Una rejilla de ventilación.",
  };
  scene.add(airVent);
  addInteractableObject(airVent);

  // Potted Plant... (keep as is)
  const potHeight = 0.3;
  const potRadius = 0.15;
  const potGeo = new CylinderGeometry(
    potRadius * 0.8,
    potRadius,
    potHeight,
    12
  );
  const plantPot = new Mesh(potGeo, plantPotMaterial);
  plantPot.position.set(
    ROOM_SIZE.width / 2 - 0.5,
    potHeight / 2,
    ROOM_SIZE.depth / 2 - 0.5
  );
  plantPot.castShadow = true;
  plantPot.receiveShadow = true;
  plantPot.name = "plantPot";
  const leavesGroup = new Group();
  const leafGeo = new SphereGeometry(0.1, 8, 6);
  for (let i = 0; i < 5; i++) {
    const leaf = new Mesh(leafGeo, plantLeavesMaterial);
    leaf.position.set(
      (Math.random() - 0.5) * 0.2,
      potHeight + Math.random() * 0.15,
      (Math.random() - 0.5) * 0.2
    );
    leaf.castShadow = true;
    leavesGroup.add(leaf);
  }
  leavesGroup.position.copy(plantPot.position);
  leavesGroup.name = "plantLeaves";
  const plant = new Group();
  plant.add(plantPot);
  plant.add(leavesGroup);
  plant.name = "pottedPlant";
  plant.userData = {
    interactable: true,
    hint: "Una planta de interior.",
    isStaticFurniture: true,
  };
  scene.add(plant);
  addInteractableObject(plant);
  addCollisionObject(plantPot);

  // --- Lamps with Lights (Dimmer) ---
  const lampLightColor = 0xffeedd;
  const lampIntensity = 3; // <<< REDUCED INTENSITY
  const lampDistance = 5; // <<< Reduced distance slightly
  const lampDecay = 2; // Standard decay

  // Floor Lamps
  const floorLampPositions = [
    new Vector3(-ROOM_SIZE.width / 2 + 1, 0, -ROOM_SIZE.depth / 2 + 1),
    new Vector3(ROOM_SIZE.width / 2 - 1, 0, -ROOM_SIZE.depth / 2 + 1),
    new Vector3(-ROOM_SIZE.width / 2 + 1, 0, ROOM_SIZE.depth / 2 - 1),
    new Vector3(ROOM_SIZE.width / 2 - 1, 0, ROOM_SIZE.depth / 2 - 1),
  ];
  const floorLampBaseHeight = 0.1;
  const floorLampBaseRadius = 0.2;
  const floorLampStemHeight = 1.3;
  const floorLampStemRadius = 0.03;
  const floorLampShadeHeight = 0.25;
  const floorLampShadeRadius = 0.25;
  floorLampPositions.forEach((pos, index) => {
    const lampBaseGeo = new CylinderGeometry(
      floorLampBaseRadius,
      floorLampBaseRadius,
      floorLampBaseHeight,
      20
    );
    const lampBase = new Mesh(lampBaseGeo, lampBaseMaterial);
    lampBase.position.set(pos.x, floorLampBaseHeight / 2, pos.z);
    lampBase.castShadow = true;
    lampBase.receiveShadow = true;
    const lampStemGeo = new CylinderGeometry(
      floorLampStemRadius,
      floorLampStemRadius,
      floorLampStemHeight,
      12
    );
    const lampStem = new Mesh(lampStemGeo, lampBaseMaterial);
    lampStem.position.set(
      pos.x,
      floorLampBaseHeight + floorLampStemHeight / 2,
      pos.z
    );
    lampStem.castShadow = true;
    lampStem.receiveShadow = true;
    const lampShadeGeo = new CylinderGeometry(
      floorLampShadeRadius * 0.8,
      floorLampShadeRadius,
      floorLampShadeHeight,
      20,
      1,
      true
    );
    const lampShade = new Mesh(lampShadeGeo, lampShadeMaterial);
    const shadeY =
      floorLampBaseHeight +
      floorLampStemHeight +
      floorLampShadeHeight / 2 -
      0.05;
    lampShade.position.set(pos.x, shadeY, pos.z);
    const floorLampGroup = new Group();
    floorLampGroup.add(lampBase);
    floorLampGroup.add(lampStem);
    floorLampGroup.add(lampShade);
    floorLampGroup.name = `floorLamp_${index}`;
    floorLampGroup.userData = {
      interactable: true,
      hint: "Una lámpara de pie.",
      isStaticFurniture: true,
    };
    const lampLight = new PointLight(
      lampLightColor,
      lampIntensity,
      lampDistance,
      lampDecay
    );
    lampLight.position.set(pos.x, shadeY - 0.1, pos.z);
    lampLight.castShadow = true;
    lampLight.shadow.mapSize.width = 256;
    lampLight.shadow.mapSize.height = 256;
    lampLight.shadow.bias = -0.005; // Lower shadow map size for performance if needed
    lampLight.name = `floorLampLight_${index}`;
    scene.add(lampLight);
    scene.add(floorLampGroup);
    addInteractableObject(floorLampGroup);
    addCollisionObject(lampBase);
    addCollisionObject(lampStem);
  });

  // Desk Lamp
  const deskLampBaseHeight = 0.04;
  const deskLampBaseRadius = 0.08;
  const deskLampArmHeight = 0.3;
  const deskLampArmRadius = 0.015;
  const deskLampShadeHeight = 0.08;
  const deskLampShadeRadius = 0.07;
  const deskLampGroup = new Group();
  const deskLampBaseGeo = new CylinderGeometry(
    deskLampBaseRadius,
    deskLampBaseRadius * 0.8,
    deskLampBaseHeight,
    16
  );
  const deskLampBase = new Mesh(deskLampBaseGeo, lampBaseMaterial);
  deskLampBase.castShadow = true;
  const deskLampArmGeo = new CylinderGeometry(
    deskLampArmRadius,
    deskLampArmRadius,
    deskLampArmHeight,
    8
  );
  const deskLampArm = new Mesh(deskLampArmGeo, lampBaseMaterial);
  deskLampArm.position.y = deskLampBaseHeight + deskLampArmHeight / 2;
  deskLampArm.castShadow = true;
  const deskLampShadeGeo = new ConeGeometry(
    deskLampShadeRadius,
    deskLampShadeHeight,
    16,
    1,
    true
  );
  const deskLampShade = new Mesh(deskLampShadeGeo, lampShadeMaterial);
  const deskLampShadeY =
    deskLampBaseHeight + deskLampArmHeight + deskLampShadeHeight / 2 - 0.02;
  deskLampShade.position.y = deskLampShadeY;
  deskLampShade.rotation.x = Math.PI / 12;
  deskLampGroup.add(deskLampBase);
  deskLampGroup.add(deskLampArm);
  deskLampGroup.add(deskLampShade);
  deskLampGroup.name = "deskLamp";
  deskLampGroup.userData = {
    interactable: true,
    hint: "Una lámpara de escritorio.",
    isStaticFurniture: true,
  };
  const deskPos = new Vector3();
  tabletopMesh.getWorldPosition(deskPos); // Use position of tabletop mesh
  deskLampGroup.position.set(
    deskPos.x - tabletopWidth / 2 + deskLampBaseRadius + 0.1,
    deskPos.y + tabletopHeight / 2,
    deskPos.z + tabletopDepth / 2 - deskLampBaseRadius - 0.1
  );
  const deskLampLight = new PointLight(
    lampLightColor,
    lampIntensity * 0.7,
    lampDistance * 0.6,
    lampDecay
  ); // Dimmer desk lamp
  deskLampLight.position.set(0, deskLampShadeY - 0.05, 0);
  deskLampLight.castShadow = true;
  deskLampLight.shadow.mapSize.width = 256;
  deskLampLight.shadow.mapSize.height = 256;
  deskLampLight.shadow.bias = -0.005;
  deskLampLight.name = "deskLampLight";
  deskLampGroup.add(deskLampLight);
  scene.add(deskLampGroup);
  addInteractableObject(deskLampGroup);
  addCollisionObject(deskLampBase);
  addCollisionObject(deskLampArm);

  // Table Lamp
  const tableLampBaseHeight = 0.03;
  const tableLampBaseRadius = 0.07;
  const tableLampStemHeight = 0.2;
  const tableLampStemRadius = 0.02;
  const tableLampShadeHeight = 0.1;
  const tableLampShadeRadius = 0.1;
  const tableLampGroup = new Group();
  const tableLampBaseGeo = new BoxGeometry(
    tableLampBaseRadius * 1.5,
    tableLampBaseHeight,
    tableLampBaseRadius * 1.5
  );
  const tableLampBase = new Mesh(tableLampBaseGeo, smallTableMaterial);
  tableLampBase.castShadow = true;
  const tableLampStemGeo = new CylinderGeometry(
    tableLampStemRadius,
    tableLampStemRadius,
    tableLampStemHeight,
    8
  );
  const tableLampStem = new Mesh(tableLampStemGeo, lampBaseMaterial);
  tableLampStem.position.y = tableLampBaseHeight + tableLampStemHeight / 2;
  tableLampStem.castShadow = true;
  const tableLampShadeGeo = new CylinderGeometry(
    tableLampShadeRadius * 0.7,
    tableLampShadeRadius,
    tableLampShadeHeight,
    16,
    1,
    true
  );
  const tableLampShade = new Mesh(tableLampShadeGeo, lampShadeMaterial);
  const tableLampShadeY_Table =
    tableLampBaseHeight + tableLampStemHeight + tableLampShadeHeight / 2 - 0.03;
  tableLampShade.position.y = tableLampShadeY_Table;
  tableLampGroup.add(tableLampBase);
  tableLampGroup.add(tableLampStem);
  tableLampGroup.add(tableLampShade);
  tableLampGroup.name = "tableLamp";
  tableLampGroup.userData = {
    interactable: true,
    hint: "Una pequeña lámpara.",
    isStaticFurniture: true,
  };
  tableLampGroup.position.set(
    smallTableWorldPos.x,
    tableHeight,
    smallTableWorldPos.z
  ); // Use calculated position
  const tableLampLight = new PointLight(
    lampLightColor,
    lampIntensity * 0.6,
    lampDistance * 0.5,
    lampDecay
  ); // Dimmer table lamp
  tableLampLight.position.set(0, tableLampShadeY_Table - 0.05, 0);
  tableLampLight.castShadow = true;
  tableLampLight.shadow.mapSize.width = 256;
  tableLampLight.shadow.mapSize.height = 256;
  tableLampLight.shadow.bias = -0.005;
  tableLampLight.name = "tableLampLight";
  tableLampGroup.add(tableLampLight);
  scene.add(tableLampGroup);
  addInteractableObject(tableLampGroup);
  addCollisionObject(tableLampBase);
  addCollisionObject(tableLampStem);

  // --- STATIC MESHES for Puzzles ---
  console.log("Creating static meshes for potential puzzles...");
  // Pressure Plate Mesh
  const plateSize = 0.6;
  const plateThickness = 0.05;
  const plateGeo = new BoxGeometry(plateSize, plateThickness, plateSize);
  const pressurePlateMesh = new Mesh(plateGeo, pressurePlateMaterial);
  pressurePlateMesh.position.set(-2.0, plateThickness / 2 + 0.01, -1.0);
  pressurePlateMesh.name = "pressurePlate";
  pressurePlateMesh.userData = {
    interactable: false,
    hint: "Una placa de presión.",
    baseHint: "Una placa de presión.",
    isPressurePlate: true,
    originalY: pressurePlateMesh.position.y,
  };
  pressurePlateMesh.receiveShadow = true;
  scene.add(pressurePlateMesh);
  addCollisionObject(pressurePlateMesh);
  // Final Keypad Mesh
  const keypadWidth = 0.4;
  const keypadHeight = 0.5;
  const keypadDepth = 0.08;
  const keypadGeo = new BoxGeometry(keypadWidth, keypadHeight, keypadDepth);
  const finalKeypadMesh = new Mesh(keypadGeo, keypadMaterial);
  finalKeypadMesh.position.set(
    ROOM_SIZE.width / 2 - keypadDepth / 2 - 0.1,
    1.2,
    1.5
  );
  finalKeypadMesh.rotation.y = Math.PI / 2;
  finalKeypadMesh.name = "finalKeypad";
  finalKeypadMesh.castShadow = true;
  finalKeypadMesh.userData = {
    interactable: true,
    hint: "Un teclado numérico.",
    baseHint: "Un teclado numérico.",
  };
  scene.add(finalKeypadMesh);
  addInteractableObject(finalKeypadMesh);
  addCollisionObject(finalKeypadMesh);
  // Wires Panel Trigger Mesh
  const wiresTriggerGeo = new PlaneGeometry(0.5, 0.7);
  const wiresTriggerMesh = new Mesh(wiresTriggerGeo, wiresTriggerMaterial);
  wiresTriggerMesh.position.set(-ROOM_SIZE.width / 2 + 0.1, 1.5, -3.0);
  wiresTriggerMesh.rotation.y = Math.PI / 2;
  wiresTriggerMesh.name = "wiresPuzzle_Trigger";
  wiresTriggerMesh.userData = {
    interactable: true,
    hint: "Un panel eléctrico dañado.",
    baseHint: "Un panel eléctrico dañado.",
  };
  scene.add(wiresTriggerMesh);
  addInteractableObject(wiresTriggerMesh);
  // Simon Says Trigger Mesh
  const simonTriggerGeo = new BoxGeometry(0.6, 0.6, 0.05);
  const simonTriggerMesh = new Mesh(simonTriggerGeo, simonTriggerMaterial);
  simonTriggerMesh.position.set(1.0, 1.8, -ROOM_SIZE.depth / 2 + 0.1);
  simonTriggerMesh.name = "simonSays_Trigger";
  simonTriggerMesh.userData = {
    interactable: true,
    hint: "Un panel con luces.",
    baseHint: "Un panel con luces.",
  };
  scene.add(simonTriggerMesh);
  addInteractableObject(simonTriggerMesh);
  addCollisionObject(simonTriggerMesh);
  // Symbol Matching Object Mesh (Book)
  const symbolBookGeo = new BoxGeometry(0.4, 0.05, 0.3);
  const symbolBookMesh = new Mesh(symbolBookGeo, symbolBookMaterial);
  symbolBookMesh.position.set(
    tabletopMesh.position.x + 0.3,
    tabletopMesh.position.y + tabletopHeight / 2 + 0.025,
    tabletopMesh.position.z
  );
  symbolBookMesh.rotation.y = -Math.PI / 16;
  symbolBookMesh.name = "symbolMatching_Object";
  symbolBookMesh.castShadow = true;
  symbolBookMesh.receiveShadow = true;
  symbolBookMesh.userData = {
    interactable: true,
    hint: "Un libro abierto.",
    baseHint: "Un libro abierto.",
  };
  scene.add(symbolBookMesh);
  addInteractableObject(symbolBookMesh);
  addCollisionObject(symbolBookMesh);
  // Projector Puzzle Object Mesh
  const projectorGeo = new BoxGeometry(0.3, 0.25, 0.4);
  const projectorMesh = new Mesh(projectorGeo, projectorMaterial);
  projectorMesh.position.set(
    safeShelf.position.x + 0.3,
    safeShelf.position.y + safeShelfHeight / 2 + 0.125,
    safeShelf.position.z
  );
  projectorMesh.name = "projectorPuzzle_Object";
  projectorMesh.castShadow = true;
  projectorMesh.userData = {
    interactable: true,
    hint: "Un proyector.",
    baseHint: "Un proyector.",
  };
  scene.add(projectorMesh);
  addInteractableObject(projectorMesh);
  addCollisionObject(projectorMesh);

  console.log("Room objects setup complete.");
}

// --- Exit Door ---
export function createExitDoor(scene) {
  console.log("Creating Exit Door...");
  const doorWidth = 1;
  const doorHeight = 2.1;
  const doorDepth = 0.1;
  const doorGeo = new BoxGeometry(doorWidth, doorHeight, doorDepth);
  const doorMat = new MeshStandardMaterial({
    color: 0x6f4e37,
    roughness: 0.8,
    metalness: 0.1,
  }); // Darker wood door
  const exitDoor = new Mesh(doorGeo, doorMat);
  // Position on right wall edge, slightly recessed
  exitDoor.position.set(ROOM_SIZE.width / 2 - 0.05, doorHeight / 2, 0);
  exitDoor.rotation.y = Math.PI / 2;
  exitDoor.castShadow = true;
  exitDoor.receiveShadow = true;
  exitDoor.name = "exitDoor";
  exitDoor.userData = {
    interactable: true,
    hint: "La puerta de salida...",
    baseHint: "La puerta de salida...",
    puzzleId: "escapeDoor",
    solved: false,
    requires: "Item_Llave_Maestra",
  };
  scene.add(exitDoor);
  addInteractableObject(exitDoor);
  addCollisionObject(exitDoor);
  console.log("Exit Door created.");
}

// --- Helpers ---
export function getRoomSize() {
  return ROOM_SIZE;
}

// Resets visual state of static puzzle meshes
export function resetMeshVisualState(mesh) {
  if (!mesh || !mesh.material || !mesh.userData) return;
  const baseHint = mesh.userData.baseHint || "Interactuar";
  mesh.userData.hint = baseHint;

  try {
    const mat = mesh.material; // Simplify access
    switch (mesh.name) {
      case "deskDrawer":
        if (mesh.userData.originalPos)
          mesh.position.copy(mesh.userData.originalPos);
        break;
      case "airVent":
        mat.color?.setHex(0xbbbbbb); // Grey metallic color
        mat.emissive?.setHex(0x000000);
        mat.emissiveIntensity = 0;
        if (mesh.userData.originalPos)
          mesh.position.copy(mesh.userData.originalPos);
        if (mesh.userData.originalRot)
          mesh.rotation.copy(mesh.userData.originalRot);
        break;
      case "pressurePlate":
        mesh.position.y = mesh.userData.originalY || 0.05 / 2 + 0.01;
        mat.color?.setHex(0x444455); // Reset color
        break;
      case "finalKeypad":
        mat.color?.setHex(0x2a2a3a);
        mat.emissive?.setHex(0x000000);
        break;
      case "wiresPuzzle_Trigger":
        mat.color?.setHex(0x661111);
        mat.emissive?.setHex(0x220000);
        mat.emissiveIntensity = 0.2;
        break; // Restore base emissive
      case "simonSays_Trigger":
        mat.color?.setHex(0x111144);
        mat.emissive?.setHex(0x000011);
        mat.emissiveIntensity = 0.3;
        break; // Restore base emissive
      case "symbolMatching_Object":
        mat.color?.setHex(0xeeeecc);
        break;
      case "projectorPuzzle_Object":
        mat.emissive?.setHex(0x000000);
        mat.emissiveIntensity = 0;
        break;
      case "pictureOnWall":
        if (mesh.userData.originalPos)
          mesh.position.copy(mesh.userData.originalPos);
        mesh.rotation.z = 0;
        break;
      case "rug":
        mesh.position.y = mesh.userData.originalY || 0.01;
        mat.visible = true;
        break;
      case "exitDoor":
        mat.color?.setHex(0x6f4e37);
        break; // Reset color
      // Books handled separately in puzzles.js cleanup
    }
    if (mat.needsUpdate !== undefined) mat.needsUpdate = true;
  } catch (error) {
    console.error(`Error resetting visual state for ${mesh.name}:`, error);
  }
}
