import * as THREE from 'three';
import CelestialModel from './CelestialModel/CelestialModel.js';
import * as SceneLoader from './SceneLoader.js';

//CelestialModel.createOrbital(64, CelestialModel.OrbitalType.Dxy, 1);
//CelestialModel.createOrbital(64, CelestialModel.OrbitalType.Px, 1);
const scaleFactor = 1;
let currentElement = null;
document.getElementById('electron-config').addEventListener('change', async () => {
    const chemName = document.getElementById('electron-config').value.trim();
    if (chemName) {
        // Call createFromElectronConfig with the input value
        if(currentElement) {
            currentElement.remove();
        }
        currentElement = new CelestialModel(chemName, 16);
        await currentElement.create();
        console.log(currentElement);
        SceneLoader.fitCameraToBoundingBox(currentElement.boundingBox);
        document.getElementById('electron-config').value = ''; // Clear the input field after loading
    } else {
        console.error('Electron configuration input is empty.');
    }
});
function animate() {
    requestAnimationFrame(animate);
    CelestialModel.updateParticles();
    SceneLoader.renderer.render(SceneLoader.scene, SceneLoader.camera);
    SceneLoader.controls.update(); // Only required if controls.enableDamping = true, or if controls.autoRotate = true
}

animate();

window.addEventListener('resize', () => {
    SceneLoader.camera.aspect = window.innerWidth / window.innerHeight;
    SceneLoader.camera.updateProjectionMatrix();
    SceneLoader.renderer.setSize(window.innerWidth, window.innerHeight);
});
(async () => {
    await CelestialModel.init(SceneLoader.scene, SceneLoader.renderer);
     //currentElement = await CelestialModel.createFromElectronConfig("1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p6 5s2 4d10 5p6 6s2 4f14 5d10", 16)
    //CelestialModel.createOrbital(64, CelestialModel.OrbitalType.S, 5, new THREE.Vector4(0, 0, 1.0, 1.0));
    const colors = [
        new THREE.Vector4(1.0, 0, 0, 1.0), // Red
        new THREE.Vector4(0, 1.0, 0, 1.0), // Green
        new THREE.Vector4(0, 0, 1.0, 1.0), // Blue
        new THREE.Vector4(1.0, 1.0, 0, 1.0), // Yellow
        new THREE.Vector4(1.0, 0, 1.0, 1.0), // Magenta
        new THREE.Vector4(0, 1.0, 1.0, 1.0), // Cyan
        new THREE.Vector4(0.5, 0.5, 0.5, 1.0) // Gray
    ];
        currentElement = new CelestialModel("Fe", 16);
        await currentElement.create();
        prototypeElementProtonField();
        console.log(currentElement);
        // const boxHelper = new THREE.Box3Helper(currentElement.boundingBox, 0xffff00); // Yellow wireframe
        // SceneLoader.scene.add(boxHelper);
         SceneLoader.fitCameraToBoundingBox(currentElement.boundingBox);
})();
// const axesHelper = new THREE.AxesHelper(5);
// SceneLoader.scene.add(axesHelper);


function prototypeElementProtonField() {
    const createFresnelMaterial = (color) => {
        return new THREE.ShaderMaterial({
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vWorldPosition;

                void main() {
                    vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz); // Transform normal to world space
                    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz; // Transform position to world space
                    gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPosition, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 uCameraPosition; // Camera position passed as a uniform
                uniform vec3 uColor; // Color passed as a uniform
                varying vec3 vNormal;
                varying vec3 vWorldPosition;

                void main() {
                    vec3 cameraDirection = normalize(uCameraPosition - vWorldPosition); // Calculate direction to the camera
                    float fresnel = pow(1.0 - abs(dot(normalize(vNormal), cameraDirection)), 3.0); // Fresnel effect (absolute value for both sides)

                    vec3 color = mix(vec3(0.0, 0.0, 0.0), uColor, fresnel); // Use uColor for the gradient
                    gl_FragColor = vec4(color, fresnel); // Use fresnel for opacity
                }
            `,
            uniforms: {
                uCameraPosition: { value: new THREE.Vector3() }, // Initialize the uniform
                uColor: { value: new THREE.Color(color) }, // Pass the color as a uniform
            },
            transparent: true, // Enable transparency
        });
    };
    
    // Create two spheres
    const ironGeometry = new THREE.SphereGeometry(40 - 5, 64, 64);
const sphere1 = new THREE.Mesh(ironGeometry, createFresnelMaterial(0x00ced1)); // Dark Turquoise color
SceneLoader.scene.add(sphere1);

const oxygenGeometry = new THREE.SphereGeometry(12, 64, 64);
const sphere2 = new THREE.Mesh(oxygenGeometry, createFresnelMaterial(0xffa500));
sphere2.visible = false; // Initially set to not visible
SceneLoader.scene.add(sphere2);
SceneLoader.renderer.setAnimationLoop(() => {
    sphere1.material.uniforms.uCameraPosition.value.copy(SceneLoader.camera.position);
    sphere2.material.uniforms.uCameraPosition.value.copy(SceneLoader.camera.position);
});
sphere1.renderOrder = 999;
sphere2.renderOrder = 1000; // Set render order to ensure correct rendering (Opacity)
// Add event listeners for checkboxes
document.getElementById('toggle-sphere-1').addEventListener('change', (event) => {
    sphere1.visible = event.target.checked; // Toggle visibility of Sphere 1
});

document.getElementById('toggle-sphere-2').addEventListener('change', (event) => {
    sphere2.visible = event.target.checked; // Toggle visibility of Sphere 2
});
}