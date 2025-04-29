import * as THREE from 'three';
import CelestialModel from './CelestialModel/CelestialModel.js';
import * as SceneLoader from './SceneLoader.js';

//CelestialModel.createOrbital(64, CelestialModel.OrbitalType.Dxy, 1);
//CelestialModel.createOrbital(64, CelestialModel.OrbitalType.Px, 1);
const scaleFactor = 1;
let currentElement = null;
document.getElementById('load-config').addEventListener('click', async () => {
    const chemName = document.getElementById('electron-config').value.trim();
    if (chemName) {
        // Call createFromElectronConfig with the input value
        if(currentElement) {
            currentElement.remove();
        }
        currentElement = new CelestialModel(chemName, 16);
        await currentElement.create();
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
        currentElement = new CelestialModel("Mo", 16);
        await currentElement.create();
        console.log(currentElement);
        // const boxHelper = new THREE.Box3Helper(currentElement.boundingBox, 0xffff00); // Yellow wireframe
        // SceneLoader.scene.add(boxHelper);
         SceneLoader.fitCameraToBoundingBox(currentElement.boundingBox);
})();
// const axesHelper = new THREE.AxesHelper(5);
// SceneLoader.scene.add(axesHelper);