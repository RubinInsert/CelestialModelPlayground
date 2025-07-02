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
        currentElement = new CelestialModel(chemName, 128);
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
    if(document.getElementById("enable-spin-state").checked) {
        currentElement.setSpinStateVisualization(true);
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
document.getElementById('enable-spin-state').addEventListener('change', (event) => {
    const isChecked = event.target.checked;
    if (currentElement) {
        currentElement.setSpinStateVisualization(isChecked);
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
                currentElement = new CelestialModel("Fe", 64);
                await currentElement.create();

        //  auxilaryElement.THREEObject.position.set(5, 0, 0);

         window.currentObject = currentElement.THREEObject;
         currentElement.setSpinState(1.0);
        document.getElementById("currentElementDisplay").innerText = currentElement.chemSymbol;
//         SceneLoader.fitCameraToBoundingBox(currentElement.boundingBox);
//         console.log(currentElement);
//         const axesHelper = new THREE.AxesHelper(5);
// SceneLoader.scene.add(axesHelper);
        //axesHelper.position.set(currentElement.maxDistance, 0, 0); // Set position of the axes helper

})();


