// Add this correct import block at the top of sceneSetup.js:
import {
  Scene,
  Color,
  PerspectiveCamera, // Make sure this is imported if createCamera is here
  WebGLRenderer,
  SRGBColorSpace,
  PCFSoftShadowMap,
  AmbientLight,
  HemisphereLight,
  PointLight,
  MeshStandardMaterial,
  TextureLoader,
  RepeatWrapping,
  NearestFilter, // Keep if needed, though less common with PBR maps
  BoxGeometry,
  PlaneGeometry,
  DoubleSide,
  Vector3,
  CylinderGeometry,
  CircleGeometry,
  ConeGeometry,
  Group,
  Mesh, // Import the base Mesh class
  SphereGeometry, // Import SphereGeometry used for plant leaves etc.
  // Add any other THREE classes/constants used *directly* in sceneSetup.js
} from "three";

// --- The rest of your sceneSetup.js file follows ---
import { addCollisionObject, clearCollisionObjects } from "./playerControls.js"; // Import collision management
import {
  addInteractableObject,
  clearInteractableObjects,
} from "./interaction.js"; // Import interactable management
// --- Constants ---
const ROOM_SIZE = { width: 12, depth: 12, height: 3 };

// --- Texture Loading ---
const textureLoader = new TextureLoader();

function loadTexture(path, repeatX = 1, repeatY = 1) {
  try {
    const texture = textureLoader.load(path);
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.colorSpace = SRGBColorSpace; // Ensure correct color space
    texture.anisotropy = 16; // Improve texture quality at angles
    return texture;
  } catch (error) {
    console.error(`Failed to load texture: ${path}`, error);
    // Return a fallback or handle error appropriately
    return null;
  }
}

// --- Materials (Using Placeholders - Replace paths in assets/) ---
// Basic PBR setup example
const woodMaterial = new MeshStandardMaterial({
  map: loadTexture("assets/textures/wood_color.jpg", 2, 1), // Example repeat
  roughnessMap: loadTexture("assets/textures/wood_roughness.jpg", 2, 1),
  // normalMap: loadTexture('assets/textures/wood_normal.jpg', 2, 1), // Optional Normal Map
  metalness: 0.1,
  roughness: 0.7,
});
const darkWoodMaterial = new MeshStandardMaterial({
  color: 0x5c3a21,
  roughness: 0.75,
  metalness: 0.1,
});
const metalMaterial = new MeshStandardMaterial({
  map: loadTexture("assets/textures/metal_color.jpg"),
  metalnessMap: loadTexture("assets/textures/metal_metalness.jpg"), // Use if available
  roughness: 0.4,
  metalness: 0.8, // Higher for metal
});
const floorMaterial = new MeshStandardMaterial({
  map: loadTexture(
    "assets/textures/floor_color.jpg",
    ROOM_SIZE.width / 2,
    ROOM_SIZE.depth / 2
  ),
  roughnessMap: loadTexture(
    "assets/textures/floor_roughness.jpg",
    ROOM_SIZE.width / 2,
    ROOM_SIZE.depth / 2
  ),
  roughness: 0.8,
  metalness: 0.1,
});
const wallMaterial = new MeshStandardMaterial({
  color: 0xaaaaaa,
  side: DoubleSide,
  roughness: 0.8,
  metalness: 0.0,
}); // Simple wall
const ceilingMaterial = new MeshStandardMaterial({
  color: 0xdddddd,
  side: DoubleSide,
});
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
  emissiveIntensity: 0.4,
  transparent: true,
  opacity: 0.9,
  side: DoubleSide,
});
const smallTableMaterial = new MeshStandardMaterial({
  color: 0xd2b48c,
  roughness: 0.7,
});
const pictureMaterial = new MeshStandardMaterial({
  color: 0xffcc88,
  roughness: 0.8,
}); // Placeholder picture
const sofaFabricMaterial = new MeshStandardMaterial({
  color: 0x708090,
  roughness: 0.9,
});
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
  emissiveIntensity: 0.5,
});
const simonTriggerMaterial = new MeshStandardMaterial({
  color: 0x111144,
  emissive: 0x000011,
  emissiveIntensity: 0.6,
});
const symbolBookMaterial = new MeshStandardMaterial({ color: 0xeeeecc });
const projectorMaterial = new MeshStandardMaterial({
  color: 0x303030,
  metalness: 0.6,
});
const ventMaterial = new MeshStandardMaterial({
  color: creamColor,
  map: metalMaterial.map,
  metalness: 0.3,
  side: DoubleSide,
  emissive: creamColor,
  emissiveIntensity: 0.1,
}); // Use metal texture maybe

// --- Scene Creation ---
export function createScene() {
  const scene = new Scene();
  scene.background = new Color(0x333840);
  // scene.fog = new THREE.Fog(0x333840, 10, 30); // Optional fog
  return scene;
}

// --- Camera Creation ---
export function createCamera() {
  const camera = new PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  ); // Adjust far plane if needed
  // Position set in main.js startGame
  return camera;
}

// --- Renderer Creation ---
export function createRenderer() {
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = SRGBColorSpace; // Correct output colors
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap; // Softer shadows
  // renderer.toneMapping = THREE.ACESFilmicToneMapping; // Optional: Better HDR handling
  // renderer.toneMappingExposure = 1.0;
  return renderer;
}

// --- Lighting Setup ---
export function setupLighting(scene) {
  console.log("Setting up lighting...");
  // Ambient light (provides overall base light)
  const ambientLight = new AmbientLight(0xffffff, 0.2); // Lower intensity if using env map
  scene.add(ambientLight);

  // Hemisphere light (simulates sky/ground bounce)
  const hemiLight = new HemisphereLight(0xcccccc, 0x444444, 0.5); // Sky, Ground, Intensity
  scene.add(hemiLight);

  // Main directional light (simulates sun/moon) - Optional
  // const dirLight = new THREE.DirectionalLight(0xffeedd, 0.8);
  // dirLight.position.set(5, 10, 7);
  // dirLight.castShadow = true;
  // dirLight.shadow.mapSize.width = 2048;
  // dirLight.shadow.mapSize.height = 2048;
  // scene.add(dirLight);
  // scene.add(dirLight.target); // Add target for better control

  // Placeholder for HDR environment map loading
  // const rgbeLoader = new RGBELoader();
  // rgbeLoader.load('assets/textures/environment.hdr', (texture) => {
  //     texture.mapping = THREE.EquirectangularReflectionMapping;
  //     scene.environment = texture;
  //     scene.background = texture; // Or keep solid color background
  //     console.log("Environment map loaded.");
  // });

  // Lamps (Point Lights) - Moved inside setupRoomObjects where lamps are created
  console.log("Base lighting added.");
}

// --- Room Geometry and Static Objects ---
export function setupRoomObjects(scene) {
  console.log("Setting up room objects...");
  clearCollisionObjects(); // Clear previous collision objects
  clearInteractableObjects(); // Clear previous interactables

  // --- Floor ---
  const floorGeo = new PlaneGeometry(ROOM_SIZE.width, ROOM_SIZE.depth);
  const floor = new Mesh(floorGeo, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.name = "floor";
  floor.userData = { isGround: true }; // For ground check
  scene.add(floor);
  addCollisionObject(floor);

  // --- Walls ---
  const wallGeoNS = new BoxGeometry(ROOM_SIZE.width, ROOM_SIZE.height, 0.1);
  const wallGeoEW = new BoxGeometry(ROOM_SIZE.depth, ROOM_SIZE.height, 0.1);
  const wallBack = new Mesh(wallGeoNS, wallMaterial.clone());
  wallBack.position.set(0, ROOM_SIZE.height / 2, -ROOM_SIZE.depth / 2);
  wallBack.receiveShadow = true;
  wallBack.name = "wallBack";
  scene.add(wallBack);
  addCollisionObject(wallBack);
  const wallLeft = new Mesh(wallGeoEW, wallMaterial.clone());
  wallLeft.position.set(-ROOM_SIZE.width / 2, ROOM_SIZE.height / 2, 0);
  wallLeft.rotation.y = Math.PI / 2;
  wallLeft.receiveShadow = true;
  wallLeft.name = "wallLeft";
  scene.add(wallLeft);
  addCollisionObject(wallLeft);
  const wallRight = new Mesh(wallGeoEW, wallMaterial.clone());
  wallRight.position.set(ROOM_SIZE.width / 2, ROOM_SIZE.height / 2, 0);
  wallRight.rotation.y = Math.PI / 2;
  wallRight.receiveShadow = true;
  wallRight.name = "wallRight";
  scene.add(wallRight);
  addCollisionObject(wallRight);
  const wallFront = new Mesh(wallGeoNS, wallMaterial.clone());
  wallFront.position.set(0, ROOM_SIZE.height / 2, ROOM_SIZE.depth / 2);
  wallFront.receiveShadow = true;
  wallFront.name = "wallFront";
  scene.add(wallFront);
  addCollisionObject(wallFront);

  // --- Ceiling ---
  const ceilingGeo = new PlaneGeometry(ROOM_SIZE.width, ROOM_SIZE.depth);
  const ceiling = new Mesh(ceilingGeo, ceilingMaterial);
  ceiling.position.y = ROOM_SIZE.height;
  ceiling.rotation.x = Math.PI / 2;
  ceiling.name = "ceiling";
  scene.add(ceiling); // Usually not a collision object from below

  // --- Furniture & Static Elements (No Puzzle Logic Here) ---
  // Note: userData.hint provides initial text. puzzleId and logic are added by puzzles.js setup

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
  }; // Not interactable itself
  scene.add(newDeskGroup);
  addCollisionObject(tabletopMesh);
  addCollisionObject(legLeftMesh);
  addCollisionObject(legRightMesh);

  // Drawer Mesh (Logic added later if deskDrawer puzzle is active)
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
  drawer.name = "deskDrawer"; // Crucial Name
  drawer.userData = {
    interactable: true,
    hint: "Un cajón cerrado.",
    baseHint: "Un cajón cerrado.",
  }; // Base hint
  scene.add(drawer);
  addInteractableObject(drawer);
  addCollisionObject(drawer);

  // Chair
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
  addCollisionObject(chairSeat); // Seat is main collision

  // Item Shelves
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

  // Bookshelf (Structure Only - Books added by puzzle setup if active)
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
  bookShelfStructure.userData = { isStaticFurniture: true }; // Structure itself isn't interactable

  // Safe Shelf
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

  // Sofa
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

  // Small Table
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
  smallTable.getWorldPosition(smallTableWorldPos);
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

  // Picture on Wall (Logic added later if movePicture puzzle active)
  const pictureGeo = new PlaneGeometry(0.8, 0.6);
  const picture = new Mesh(pictureGeo, pictureMaterial); // Placeholder texture
  const pictureFrameGeo = new BoxGeometry(0.8 + 0.05, 0.6 + 0.05, 0.03);
  const pictureFrame = new Mesh(pictureFrameGeo, darkWoodMaterial);
  picture.position.z = 0.016;
  const pictureGroup = new Group();
  pictureGroup.add(picture);
  pictureGroup.add(pictureFrame);
  pictureGroup.position.set(0, 1.5, -ROOM_SIZE.depth / 2 + 0.1);
  pictureGroup.name = "pictureOnWall"; // Crucial Name
  pictureGroup.userData = {
    interactable: true,
    hint: "Un cuadro colgado",
    baseHint: "Un cuadro colgado",
    canBeMoved: true,
    originalPos: pictureGroup.position.clone(),
  };
  scene.add(pictureGroup);
  addInteractableObject(pictureGroup);

  // Rug (Logic added later if liftRug puzzle active)
  const rugGeo = new PlaneGeometry(2.5, 1.8);
  const rugMat = new MeshStandardMaterial({ color: 0x6b2a3b, roughness: 0.9 });
  const rug = new Mesh(rugGeo, rugMat);
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.01, 0);
  rug.receiveShadow = true;
  rug.name = "rug"; // Crucial Name
  rug.userData = {
    interactable: true,
    hint: "Una alfombra vieja",
    baseHint: "Una alfombra vieja",
    canBeLifted: true,
    originalY: rug.position.y,
  };
  scene.add(rug);
  addInteractableObject(rug); // Not usually a collision object

  // Wall Clock
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

  // Air Vent Mesh (Logic added later if airVent puzzle active)
  const ventGeo = new PlaneGeometry(0.4, 0.3);
  const airVent = new Mesh(ventGeo, ventMaterial);
  const airVentY = ROOM_SIZE.height - 0.3;
  const airVentZ = ROOM_SIZE.depth / 2 - 0.1;
  airVent.position.set(0, airVentY, airVentZ);
  airVent.name = "airVent"; // Crucial Name
  airVent.userData = {
    interactable: true,
    hint: "Una rejilla de ventilación.",
    baseHint: "Una rejilla de ventilación.",
  };
  scene.add(airVent);
  addInteractableObject(airVent);

  // Potted Plant
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

  // --- Lamps with Lights ---
  const lampLightColor = 0xffeedd;
  const lampIntensity = 15; // Adjust intensity (PointLight uses distance units)
  const lampDistance = 6;
  const lampDecay = 1.5; // Physical decay

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
    lampLight.castShadow = true; // Cast shadow
    lampLight.shadow.mapSize.width = 512;
    lampLight.shadow.mapSize.height = 512;
    lampLight.shadow.bias = -0.005;
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
  tabletopMesh.getWorldPosition(deskPos);
  deskLampGroup.position.set(
    deskPos.x - tabletopWidth / 2 + deskLampBaseRadius + 0.1,
    deskPos.y + tabletopHeight / 2,
    deskPos.z + tabletopDepth / 2 - deskLampBaseRadius - 0.1
  );
  const deskLampLight = new PointLight(
    lampLightColor,
    lampIntensity * 0.8,
    lampDistance * 0.8,
    lampDecay
  );
  deskLampLight.position.set(0, deskLampShadeY - 0.05, 0); // Position relative to group
  deskLampLight.castShadow = true;
  deskLampLight.shadow.mapSize.width = 512;
  deskLampLight.shadow.mapSize.height = 512;
  deskLampLight.shadow.bias = -0.005;
  deskLampLight.name = "deskLampLight";
  deskLampGroup.add(deskLampLight); // Add light to group
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
  );
  const tableLampLight = new PointLight(
    lampLightColor,
    lampIntensity * 0.7,
    lampDistance * 0.7,
    lampDecay
  );
  tableLampLight.position.set(0, tableLampShadeY_Table - 0.05, 0); // Relative position
  tableLampLight.castShadow = true;
  tableLampLight.shadow.mapSize.width = 512;
  tableLampLight.shadow.mapSize.height = 512;
  tableLampLight.shadow.bias = -0.005;
  tableLampLight.name = "tableLampLight";
  tableLampGroup.add(tableLampLight); // Add light to group
  scene.add(tableLampGroup);
  addInteractableObject(tableLampGroup);
  addCollisionObject(tableLampBase);
  addCollisionObject(tableLampStem);

  // --- STATIC MESHES for Puzzles (No logic here) ---
  console.log("Creating static meshes for potential puzzles...");

  // Pressure Plate Mesh
  const plateSize = 0.6;
  const plateThickness = 0.05;
  const plateGeo = new BoxGeometry(plateSize, plateThickness, plateSize);
  const pressurePlateMesh = new Mesh(plateGeo, pressurePlateMaterial);
  pressurePlateMesh.position.set(-2.0, plateThickness / 2 + 0.01, -1.0);
  pressurePlateMesh.name = "pressurePlate"; // Crucial Name
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
  finalKeypadMesh.name = "finalKeypad"; // Crucial Name
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
  wiresTriggerMesh.name = "wiresPuzzle_Trigger"; // Crucial Name
  wiresTriggerMesh.userData = {
    interactable: true,
    hint: "Un panel eléctrico dañado.",
    baseHint: "Un panel eléctrico dañado.",
  };
  scene.add(wiresTriggerMesh);
  addInteractableObject(wiresTriggerMesh); // Not a collision object

  // Simon Says Trigger Mesh
  const simonTriggerGeo = new BoxGeometry(0.6, 0.6, 0.05);
  const simonTriggerMesh = new Mesh(simonTriggerGeo, simonTriggerMaterial);
  simonTriggerMesh.position.set(1.0, 1.8, -ROOM_SIZE.depth / 2 + 0.1);
  simonTriggerMesh.name = "simonSays_Trigger"; // Crucial Name
  simonTriggerMesh.userData = {
    interactable: true,
    hint: "Un panel con luces.",
    baseHint: "Un panel con luces.",
  };
  scene.add(simonTriggerMesh);
  addInteractableObject(simonTriggerMesh);
  addCollisionObject(simonTriggerMesh); // Small collision box

  // Symbol Matching Object Mesh (Book)
  const symbolBookGeo = new BoxGeometry(0.4, 0.05, 0.3);
  const symbolBookMesh = new Mesh(symbolBookGeo, symbolBookMaterial);
  symbolBookMesh.position.set(
    tabletopMesh.position.x + 0.3,
    tabletopMesh.position.y + tabletopHeight / 2 + 0.025,
    tabletopMesh.position.z
  );
  symbolBookMesh.rotation.y = -Math.PI / 16;
  symbolBookMesh.name = "symbolMatching_Object"; // Crucial Name
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
  projectorMesh.name = "projectorPuzzle_Object"; // Crucial Name
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
    color: 0x6f4e37, // Brown
    roughness: 0.7,
    metalness: 0.1,
    // map: loadTexture('assets/textures/door_color.jpg'), // Optional texture
    // roughnessMap: loadTexture('assets/textures/door_roughness.jpg'),
  });
  const exitDoor = new Mesh(doorGeo, doorMat);
  exitDoor.position.set(ROOM_SIZE.width / 2 - doorDepth / 2, doorHeight / 2, 0); // Right Wall
  exitDoor.rotation.y = Math.PI / 2;
  exitDoor.castShadow = true;
  exitDoor.receiveShadow = true;
  exitDoor.name = "exitDoor"; // Crucial Name
  // Requirements and logic added by puzzle setup
  exitDoor.userData = {
    interactable: true,
    hint: "La puerta de salida...",
    baseHint: "La puerta de salida...", // Base hint
    puzzleId: "escapeDoor", // Link to puzzle definition
    solved: false,
    requires: "Item_Llave_Maestra", // Default, will be overridden by selectPuzzles
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

// Helper function to reset visual states of static puzzle meshes (called by cleanupPuzzles)
export function resetMeshVisualState(mesh) {
  if (!mesh || !mesh.material || !mesh.userData) return;
  const baseHint = mesh.userData.baseHint || "Interactuar";
  mesh.userData.hint = baseHint; // Reset hint

  try {
    // Add try-catch for safety
    switch (mesh.name) {
      case "deskDrawer":
        // Optionally reset position if animated
        // mesh.position.z = ... initial z ...;
        break;
      case "airVent":
        mesh.material.color?.setHex(creamColor);
        mesh.material.emissive?.setHex(creamColor);
        mesh.material.emissiveIntensity = 0.1;
        // Optionally reset rotation/position if animated
        // mesh.rotation.z = 0; mesh.position.y = ... initial y ...;
        break;
      case "pressurePlate":
        mesh.position.y = mesh.userData.originalY || 0.05 / 2 + 0.01;
        mesh.material.color?.setHex(0x444455);
        break;
      case "finalKeypad":
        mesh.material.color?.setHex(0x2a2a3a);
        mesh.material.emissive?.setHex(0x000000);
        break;
      case "wiresPuzzle_Trigger":
        mesh.material.color?.setHex(0x661111);
        mesh.material.emissive?.setHex(0x220000);
        break;
      case "simonSays_Trigger":
        mesh.material.color?.setHex(0x111144);
        mesh.material.emissive?.setHex(0x000011);
        break;
      case "symbolMatching_Object":
        mesh.material.color?.setHex(0xeeeecc);
        break;
      case "projectorPuzzle_Object":
        mesh.material.emissive?.setHex(0x000000);
        mesh.material.emissiveIntensity = 0;
        break;
      case "pictureOnWall":
        if (mesh.userData.originalPos)
          mesh.position.copy(mesh.userData.originalPos);
        mesh.rotation.z = 0;
        break;
      case "rug":
        mesh.position.y = mesh.userData.originalY || 0.01;
        mesh.material.visible = true;
        break;
      case "exitDoor":
        mesh.material.color?.setHex(0x6f4e37); // Reset color
        // Optionally reset open animation state
        break;
      // Add other static puzzle meshes that need visual reset
    }
    if (mesh.material.needsUpdate !== undefined) {
      mesh.material.needsUpdate = true;
    }
  } catch (error) {
    console.error(`Error resetting visual state for ${mesh.name}:`, error);
  }
}
