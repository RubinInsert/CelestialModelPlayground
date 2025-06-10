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
        currentElement = new CelestialModel(chemName, 64);
        await currentElement.create();
        window.curE = currentElement;
        console.log('Scene objects:', SceneLoader.scene.children);
        document.getElementById("currentElementDisplay").innerText = currentElement.chemSymbol;
        console.log(currentElement);
        //SceneLoader.fitCameraToBoundingBox(currentElement.boundingBox);
        document.getElementById('electron-config').value = ''; // Clear the input field after loading
    } else {
        console.error('Electron configuration input is empty.');
    }
    if(document.getElementById("enable-proton-fields").checked) {
        currentElement.setProtonFieldVisibility(true);
    }
});
document.getElementById('timestep-slider').addEventListener('input', (event) => {
    CelestialModel.timeStep = parseFloat(event.target.value);
});
document.getElementById('enable-proton-fields').addEventListener('change', (event) => {
    const isChecked = event.target.checked;
    if (currentElement) {
        currentElement.setProtonFieldVisibility(isChecked);
    }
});
function animate() {
    requestAnimationFrame(animate);
    CelestialModel.updateParticles();
    SceneLoader.renderer.render(SceneLoader.scene, SceneLoader.camera);
    SceneLoader.controls.update(); // Only required if controls.enableDamping = true, or if controls.autoRotate = true
}



window.addEventListener('resize', () => {
    SceneLoader.camera.aspect = window.innerWidth / window.innerHeight;
    SceneLoader.camera.updateProjectionMatrix();
    SceneLoader.renderer.setSize(window.innerWidth, window.innerHeight);
});
(async () => {
    await CelestialModel.init(SceneLoader.scene, SceneLoader.renderer);
    animate();
        // let auxilaryElement = new CelestialModel("H", 64);
        // await auxilaryElement.create();
//         // Bounding box
// //         const boxHelper = new THREE.Box3Helper(currentElement.boundingBox, 0xffff00); // Yellow color
// // SceneLoader.scene.add(boxHelper);


        //  auxilaryElement.THREEObject.position.set(5, 0, 0);
         currentElement = new CelestialModel("Fe", 64);
         await currentElement.create();
         window.currentObject = currentElement.THREEObject;
         currentElement.setSpinState(1.0);
        document.getElementById("currentElementDisplay").innerText = currentElement.chemSymbol;
//         SceneLoader.fitCameraToBoundingBox(currentElement.boundingBox);
//         console.log(currentElement);
//         const axesHelper = new THREE.AxesHelper(5);
// SceneLoader.scene.add(axesHelper);
        //axesHelper.position.set(currentElement.maxDistance, 0, 0); // Set position of the axes helper

})();



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
const sphere1 = new THREE.Mesh(ironGeometry, ironMaterial); // Dark Turquoise color
SceneLoader.scene.add(sphere1);
sphere1.visible = false; // Initially set to not visible
const oxygenGeometry = new THREE.SphereGeometry(12, 64, 64);
const oxygenMaterial = new THREE.MeshBasicMaterial({
    color: 0xffa500, // Dark Turquoise color
    transparent: true,
    opacity: 0.3, // Adjust opacity for transparency
});
const sphere2 = new THREE.Mesh(oxygenGeometry, oxygenMaterial);
sphere2.visible = false; // Initially set to not visible
SceneLoader.scene.add(sphere2);
sphere1.renderOrder = 999;
sphere2.renderOrder = 1000; // Set render order to ensure correct rendering (Opacity)
}