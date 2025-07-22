import * as THREE from "three";
import { OrbitControls } from "three/examples/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/postprocessing/OutputPass.js";
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.01,
  10000
);
const renderer = new THREE.WebGLRenderer({ antialias: true });
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 7.5); // Set position of the directional light
directionalLight.target.position.set(0, 0, 0); // Set the target to the origin
scene.add(directionalLight);
scene.add(directionalLight.target);
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Add ambient light with lower intensity
scene.add(ambientLight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ReinhardToneMapping;
document.body.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true; // Optional: for smoother controls
controls.enablePan = false;
controls.enableZoom = true;
controls.enableRotate = true;
controls.dampingFactor = 0.05;
controls.update();
camera.position.set(0, 0, 10); // TODO: Calculate bounding box of Celestial models
camera.near = 0.01;
camera.far = 1000;

const renderScene = new RenderPass(scene, camera);
// const bloomPass = new UnrealBloomPass(
//   new THREE.Vector2(window.innerWidth, window.innerHeight),
//   0.1, // strength
//   0.01, // radius
//   0.00 // threshold
// );

const composer = new EffectComposer(renderer);
// composer.addPass(renderScene);
// composer.addPass(bloomPass);

function fitCameraToBoundingBox(boundingBox) {
  const boxSize = new THREE.Vector3();
  boundingBox.getSize(boxSize);
  const boxCenter = new THREE.Vector3();
  boundingBox.getCenter(boxCenter);

  const maxDim = Math.max(boxSize.x, boxSize.y, boxSize.z);
  const fov = camera.fov * (Math.PI / 180);
  const distance = maxDim / (2 * Math.tan(fov / 2));

  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  camera.position.copy(
    boxCenter.clone().sub(direction.multiplyScalar(distance * 1.5))
  );

  camera.updateProjectionMatrix();

  if (controls) {
    controls.target.copy(boxCenter);
    controls.update();
  }
}
export { scene, camera, renderer, controls, fitCameraToBoundingBox, composer };
