import * as THREE from 'https://unpkg.com/three@0.180.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.180.0/examples/jsm/controls/OrbitControls.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x89b2e6);
scene.fog = new THREE.Fog(0x89b2e6, 90, 220);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 8, 14);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
controls.enableDamping = true;
controls.minDistance = 6;
controls.maxDistance = 16;
controls.maxPolarAngle = Math.PI / 2.15;
controls.target.set(0, 3, 0);

const clock = new THREE.Clock();

const keys = {};
const playerVelocity = new THREE.Vector3();
const moveDir = new THREE.Vector3();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
let onGround = true;
let cluesFound = 0;
let gameWon = false;

const missionEl = document.getElementById('mission');
const objectiveEl = document.getElementById('objective');
const messageBox = document.getElementById('messageBox');

function showMessage(text, ms = 2400) {
  messageBox.textContent = text;
  messageBox.classList.remove('hidden');
  if (showMessage.timer) clearTimeout(showMessage.timer);
  showMessage.timer = setTimeout(() => messageBox.classList.add('hidden'), ms);
}

const hemi = new THREE.HemisphereLight(0xffffff, 0x335577, 1.1);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffffff, 1.3);
sun.position.set(30, 60, 15);
sun.castShadow = true;
sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(500, 500),
  new THREE.MeshStandardMaterial({ color: 0x2f6f3e })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

function makeRoad(x, z, w, h) {
  const road = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.12, h),
    new THREE.MeshStandardMaterial({ color: 0x2b2b2b })
  );
  road.position.set(x, 0.06, z);
  road.receiveShadow = true;
  scene.add(road);
}

for (let i = -120; i <= 120; i += 30) {
  makeRoad(i, 0, 16, 260);
  makeRoad(0, i, 260, 16);
}

const obstacles = [];
const interactables = [];
const jumpPads = [];
const floatingOrbs = [];

function addBoxObstacle(x, y, z, sx, sy, sz, color = 0xa8a8a8) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(sx, sy, sz),
    new THREE.MeshStandardMaterial({ color })
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  obstacles.push({ mesh, size: new THREE.Vector3(sx, sy, sz) });
  return mesh;
}

function addBuildingBlock(cx, cz) {
  const count = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) {
    const sx = 8 + Math.random() * 10;
    const sz = 8 + Math.random() * 10;
    const sy = 10 + Math.random() * 35;
    const ox = cx + (Math.random() - 0.5) * 18;
    const oz = cz + (Math.random() - 0.5) * 18;
    addBoxObstacle(
      ox,
      sy / 2,
      oz,
      sx,
      sy,
      sz,
      new THREE.Color().setHSL(Math.random(), 0.15, 0.45)
    );
  }
}

for (let x = -90; x <= 90; x += 30) {
  for (let z = -90; z <= 90; z += 30) {
    if (Math.abs(x) < 20 || Math.abs(z) < 20) continue;
    addBuildingBlock(x, z);
  }
}

for (let i = 0; i < 40; i++) {
  const tree = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.7, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0x6b4326 })
  );
  trunk.position.y = 2;

  const top = new THREE.Mesh(
    new THREE.SphereGeometry(2.5 + Math.random(), 10, 10),
    new THREE.MeshStandardMaterial({ color: 0x2a7d38 })
  );
  top.position.y = 5.3;

  tree.add(trunk, top);
  tree.position.set((Math.random() - 0.5) * 210, 0, (Math.random() - 0.5) * 210);
  scene.add(tree);
}

function makePlayer() {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(1.1, 2.0, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0x243447 })
  );
  body.castShadow = true;
  body.position.y = 2.2;

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xf0c9a5 })
  );
  head.position.y = 4.3;
  head.castShadow = true;

  const mustache = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.18, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x1b120d })
  );
  mustache.position.set(0, 4.1, 0.78);
  mustache.castShadow = true;

  group.add(body, head, mustache);
  group.position.set(0, 0, 0);
  scene.add(group);
  return group;
}

const player = makePlayer();

function makeNPC(x, z, color = 0x7c2d2d, scale = 1) {
  const g = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(1.0 * scale, 2.2 * scale, 8, 16),
    new THREE.MeshStandardMaterial({ color })
  );
  body.position.y = 2.1 * scale;

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.85 * scale, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xf0c9a5 })
  );
  head.position.y = 4.1 * scale;

  const mustache = new THREE.Mesh(
    new THREE.BoxGeometry(0.95 * scale, 0.18 * scale, 0.18 * scale),
    new THREE.MeshStandardMaterial({ color: 0x1b120d })
  );
  mustache.position.set(0, 3.9 * scale, 0.72 * scale);

  g.add(body, head, mustache);
  g.position.set(x, 0, z);
  g.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });

  scene.add(g);
  return g;
}

function makeClue(x, z, text, color = 0xf5d142) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 0.8, 1.2, 20),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.35
    })
  );

  mesh.position.set(x, 0.7, z);
  mesh.castShadow = true;
  mesh.userData = { type: 'clue', text, collected: false };
  scene.add(mesh);
  interactables.push(mesh);
  return mesh;
}

function makeJumpPad(x, z) {
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(2, 2, 0.4, 20),
    new THREE.MeshStandardMaterial({
      color: 0x27b7ff,
      emissive: 0x27b7ff,
      emissiveIntensity: 0.25
    })
  );
  pad.position.set(x, 0.2, z);
  pad.userData = { type: 'jumppad' };
  scene.add(pad);
  jumpPads.push(pad);
}

const clue1 = makeClue(-72, 42, 'Clue 1: The vanished hero was seen near the old fountain district.');
const clue2 = makeClue(58, -62, 'Clue 2: A rooftop watcher heard the hero humming near memorial park.');
const clue3 = makeClue(82, 76, 'Clue 3: He hides where the city touches the sky.');

makeJumpPad(-16, -20);
makeJumpPad(44, 14);
makeJumpPad(-58, 74);

const vanishedHero = makeNPC(96, 96, 0x385d8a, 1.05);
vanishedHero.visible = false;
vanishedHero.userData = { type: 'hero' };
interactables.push(vanishedHero);

const fountainBase = new THREE.Mesh(
  new THREE.CylinderGeometry(8, 10, 1.5, 24),
  new THREE.MeshStandardMaterial({ color: 0x7d8fa3 })
);
fountainBase.position.set(-55, 0.75, 55);
scene.add(fountainBase);

const fountainTop = new THREE.Mesh(
  new THREE.CylinderGeometry(3.2, 3.6, 5.5, 18),
  new THREE.MeshStandardMaterial({
    color: 0xaec9df,
    emissive: 0x4477aa,
    emissiveIntensity: 0.15
  })
);
fountainTop.position.set(-55, 3.8, 55);
scene.add(fountainTop);

function distance2D(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function getNearestInteractable() {
  let nearest = null;
  let best = Infinity;

  for (const obj of interactables) {
    if (obj.userData?.type === 'clue' && obj.userData.collected) continue;
    if (obj.userData?.type === 'hero' && !vanishedHero.visible) continue;

    const d = distance2D(player.position, obj.position);
    if (d < best) {
      best = d;
      nearest = obj;
    }
  }

  return best < 7 ? nearest : null;
}

function updateObjective() {
  objectiveEl.textContent = `Clues found: ${cluesFound} / 3`;

  if (cluesFound === 3 && !vanishedHero.visible) {
    vanishedHero.visible = true;
    missionEl.textContent = 'Mission: The final clue opened the trail. Find the vanished hero in the far northeast tower district.';
    showMessage('The trail is alive. The vanished hero can now be found in the northeast corner.', 4000);
  }
}

function interact() {
  const near = getNearestInteractable();

  if (!near) {
    showMessage('Nothing here but wind and concrete.');
    return;
  }

  if (near.userData.type === 'clue') {
    if (!near.userData.collected) {
      near.userData.collected = true;
      near.visible = false;
      cluesFound += 1;
      updateObjective();
      showMessage(near.userData.text, 4200);
    }
  } else if (near.userData.type === 'hero' && !gameWon) {
    gameWon = true;
    missionEl.textContent = 'Mission complete: You found the vanished hero.';
    showMessage('You found him. The legend breathes again. Free roam unlocked forever.', 5200);
    spawnCelebration();
  }
}

function spawnCelebration() {
  for (let i = 0; i < 30; i++) {
    const color = new THREE.Color().setHSL(Math.random(), 0.8, 0.6);

    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.4 + Math.random() * 0.4, 10, 10),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.4
      })
    );

    orb.position.copy(vanishedHero.position).add(
      new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        3 + Math.random() * 8,
        (Math.random() - 0.5) * 8
      )
    );

    orb.userData.floaty = 0.5 + Math.random() * 1.8;
    scene.add(orb);
    floatingOrbs.push(orb);
  }
}

function handleMovement(delta) {
  const speed = keys.ShiftLeft || keys.ShiftRight ? 18 : 11;
  moveDir.set(0, 0, 0);

  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

  if (keys.KeyW || keys.ArrowUp) moveDir.add(forward);
  if (keys.KeyS || keys.ArrowDown) moveDir.sub(forward);
  if (keys.KeyA || keys.ArrowLeft) moveDir.sub(right);
  if (keys.KeyD || keys.ArrowRight) moveDir.add(right);

  if (moveDir.lengthSq() > 0) {
    moveDir.normalize();
    playerVelocity.x = moveDir.x * speed;
    playerVelocity.z = moveDir.z * speed;

    const facing = Math.atan2(moveDir.x, moveDir.z);
    player.rotation.y = facing;
  } else {
    playerVelocity.x *= 0.82;
    playerVelocity.z *= 0.82;
  }

  if (!onGround) playerVelocity.y -= 28 * delta;

  const next = player.position.clone().addScaledVector(playerVelocity, delta);

  if (next.y <= 0) {
    next.y = 0;
    playerVelocity.y = 0;
    onGround = true;
  }

  for (const pad of jumpPads) {
    if (distance2D(next, pad.position) < 2.4 && onGround) {
      playerVelocity.y = 16;
      onGround = false;
      showMessage('Boing. The city throws you upward.');
    }
  }

  const playerRadius = 1.4;

  for (const o of obstacles) {
    const half = o.size.clone().multiplyScalar(0.5);
    const minX = o.mesh.position.x - half.x - playerRadius;
    const maxX = o.mesh.position.x + half.x + playerRadius;
    const minZ = o.mesh.position.z - half.z - playerRadius;
    const maxZ = o.mesh.position.z + half.z + playerRadius;
    const maxY = o.mesh.position.y + half.y;

    if (next.x > minX && next.x < maxX && next.z > minZ && next.z < maxZ && next.y < maxY) {
      const dx = Math.min(Math.abs(next.x - minX), Math.abs(next.x - maxX));
      const dz = Math.min(Math.abs(next.z - minZ), Math.abs(next.z - maxZ));

      if (dx < dz) {
        next.x = player.position.x;
        playerVelocity.x = 0;
      } else {
        next.z = player.position.z;
        playerVelocity.z = 0;
      }
    }
  }

  next.x = THREE.MathUtils.clamp(next.x, -118, 118);
  next.z = THREE.MathUtils.clamp(next.z, -118, 118);

  player.position.copy(next);
  controls.target.lerp(
    new THREE.Vector3(player.position.x, player.position.y + 3.2, player.position.z),
    0.12
  );
}

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;

  if (e.code === 'Space' && onGround) {
    playerVelocity.y = 12;
    onGround = false;
  }

  if (e.code === 'KeyE') interact();
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

showMessage('Welcome to Mustache Man. Three clues. One vanished legend.', 4200);
updateObjective();

function animate() {
  const delta = Math.min(clock.getDelta(), 0.05);
  handleMovement(delta);
  controls.update();

  for (const clue of [clue1, clue2, clue3]) {
    if (clue.visible) {
      clue.rotation.y += delta * 1.8;
      clue.position.y = 0.9 + Math.sin(clock.elapsedTime * 2.3 + clue.position.x) * 0.12;
    }
  }

  if (vanishedHero.visible) {
    vanishedHero.rotation.y += delta * 0.5;
  }

  for (const orb of floatingOrbs) {
    orb.position.y += delta * orb.userData.floaty;
    orb.rotation.x += delta * 1.2;
    orb.rotation.y += delta * 1.6;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
