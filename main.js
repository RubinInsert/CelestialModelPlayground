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
    currentElement = await CelestialModel.createFromElectronConfig("1s2 2s2 2p6 3s2 3p6 4s1 3d5", 16);
    for (let level = 1; level <= 7; level++) {
        //CelestialModel.createOrbital(64, CelestialModel.OrbitalType.S, level, colors[level - 1]);
    }
    //CelestialModel.createOrbital(64, CelestialModel.OrbitalType.Dxy, 4);
    //CelestialModel.createOrbital(64, CelestialModel.OrbitalType.Fz_x2_minus_y2, 4);
})();
const axesHelper = new THREE.AxesHelper(5);
SceneLoader.scene.add(axesHelper);