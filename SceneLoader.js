import * as THREE from 'three';
import { OrbitControls } from 'three/examples/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/loaders/GLTFLoader.js';
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 10000);
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
    camera.position.copy(boxCenter.clone().sub(direction.multiplyScalar(distance * 1.2)));

    camera.near = 0.1;
    camera.far = distance * 10;
    camera.updateProjectionMatrix();

    if (controls) {
        controls.target.copy(boxCenter);
        controls.update();
    }
}
export { scene, camera, renderer, controls, fitCameraToBoundingBox};