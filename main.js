import * as THREE from 'three';
import * as CelestialModel from './CelestialModel.js';
import * as SceneLoader from './SceneLoader.js';

//CelestialModel.createOrbital(64, CelestialModel.OrbitalType.Dxy, 1);
//CelestialModel.createOrbital(64, CelestialModel.OrbitalType.Px, 1);
const scaleFactor = 1;
let currentElement = null;
document.getElementById('load-config').addEventListener('click', async () => {
    const electronConfig = document.getElementById('electron-config').value.trim();
    if (electronConfig) {
        // Call createFromElectronConfig with the input value
        if(currentElement) {
            currentElement.remove();
        }
        currentElement = await CelestialModel.createFromElectronConfig(electronConfig, 16);
    } else {
        console.error('Electron configuration input is empty.');
    }
});
function animate() {
    requestAnimationFrame(animate);
    CelestialModel.updateParticles()
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
    currentElement = await CelestialModel.createFromElectronConfig("1s2 2s2 2p6 3s2 3p6 3d10 4s2 4p6 4d5 5s1", 16); // Molybdenum example
})();