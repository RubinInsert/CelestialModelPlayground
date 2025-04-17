import * as THREE from 'three';
import { OrbitControls } from 'three/examples/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/loaders/GLTFLoader.js';
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 10000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
const light = new THREE.PointLight(0xffffff, 50, 100);
light.position.set(10, 10, 10);
scene.add(light);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Optional: for smoother controls
controls.dampingFactor = 0.05;
controls.update();
camera.position.z = 5; // TODO: Calculate bounding box of Celestial models

const loader = new GLTFLoader();
// loader.load('./modelTest2.glb', (gltf) => {
//     const model = gltf.scene;
//     scene.add(model);
//     // Scale the model down to 0.1
//     model.scale.set(1, 1, 1);
//     // Compute the bounding box of the model
//     // Make the model transparent
//     model.traverse((child) => {
//         if (child.isMesh) {
//             child.material.transparent = true;
//             child.material.opacity = 0.5;
//         }
//     });

// });




export { scene, camera, renderer, controls };