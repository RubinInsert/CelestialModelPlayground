import * as THREE from 'https://cdn.jsdelivr.net/npm/three@latest/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@latest/examples/jsm/loaders/GLTFLoader.js';
import { GPUComputationRenderer } from 'https://cdn.jsdelivr.net/npm/three@latest/examples/jsm/misc/GPUComputationRenderer.js';

let scene, camera, renderer;
let positionShaderCode, vertexShaderCode, fragmentShaderCode; // Only get this code once in init function, reduce network requests
let isInitialized = false;
let clock = new THREE.Clock();
// START - * Helper Functions *
async function loadShader(url) {
    const response = await fetch(url);
    return await response.text();
}
function rand() { // Shorthand for Math.random()
    return Math.random(); // uniform random in [0, 1)
}

function fillTextures(positionTexture, velocityTexture, orbitalLevel = 1) {
    const posArray = positionTexture.image.data;
    const velArray = velocityTexture.image.data;

    for (let i = 0; i < posArray.length; i += 4) {
        // Random positions
        let point = generateRandomPointInRange(-orbitalLevel / 2, orbitalLevel / 2);
        posArray[i] = point.x; // x
        posArray[i + 1] = point.y; // y
        posArray[i + 2] = point.z; // z
        posArray[i + 3] = 1; // w (not used)

        // Random velocities
        velArray[i] = Math.random() * 2 - 1; // vx
        velArray[i + 1] = Math.random() * 2 - 1; // vy
        velArray[i + 2] = Math.random() * 2 - 1; // vz
        velArray[i + 3] = 1; // w (not used)
    }
}
function generatePointOnPxOrbital(PSI_SQ_MAX = 0.135, RADIUS = 0.1, THRESHOLD = 0.01) {
    while (true) {
        // Generate random angles for spherical coordinates
        const theta = Math.acos(2 * rand() - 1); // Uniform distribution over the sphere
        const phi = 2 * Math.PI * rand(); // Uniform azimuthal angle

        // Calculate r based on the orbital's PDF
        const r = -Math.log(rand()) / 2; // Inverse transform sampling for exp(-2r)

        // Convert spherical coordinates to Cartesian coordinates
        const x = r * Math.sin(theta) * Math.cos(phi);
        const y = r * Math.sin(theta) * Math.sin(phi);
        const z = r * Math.cos(theta);

        // Calculate the probability density for the Px orbital
        const psiSquared = x * x * Math.exp(-2 * r);

        // Normalize the probability density and compare with a random threshold
        if (psiSquared / PSI_SQ_MAX > rand()) {
            return new THREE.Vector3(x, y, z); // Accept the point
        }
        // Otherwise, reject the point and try again
    }
}
function generateRandomPointInRange(min, max) {
    const x = Math.random() * (max - min) + min;
    const y = Math.random() * (max - min) + min;
    const z = Math.random() * (max - min) + min;
    return new THREE.Vector3(x, y, z);
}
// END - * Helper Functions *
const allRunningComputeShaders = [];
const OrbitalType = Object.freeze({
    S: 'S',
    Px: 'Px',
    Py: 'Py',
    Pz: 'Pz',
    Dxy: 'Dxy', // TODO Alignments
    Dx2y2: 'Dx2y2', // TODO Alignments
    Dxz: 'Dxz', // TODO Alignments\
    Dyz: 'Dyz', // TODO Alignments
    Dz2: 'Dz2', // TODO Alignments
    F: 'F', // TODO Alignments
});


async function init(inputScene, inputRenderer) {
    scene = inputScene;
    renderer = inputRenderer;
    [positionShaderCode, vertexShaderCode, fragmentShaderCode] = await Promise.all([
        loadShader('./shaders/positionShader.glsl'),
        loadShader('./shaders/vertexShader.glsl'),
        loadShader('./shaders/fragmentShader.glsl')
    ]);
    isInitialized = true;
}
// Create a GPUComputeRenderer
async function createOrbital(numParticlesSqrt = 64, orbitalType = OrbitalType.S, orbitalLevel = 1) {
    if(!isInitialized) return false; // Ensure the module is initialized before creating an orbital
const velocityShaderCode = await loadShader(`./shaders/${orbitalType}/velocityShader.glsl`);
const PARTICLES = numParticlesSqrt * numParticlesSqrt; // Total number of particles in orbital
const gpuCompute = new GPUComputationRenderer(numParticlesSqrt, numParticlesSqrt, renderer);

// Create data textures for positions and velocities
const positionTexture = gpuCompute.createTexture();
const velocityTexture = gpuCompute.createTexture();


const THRESHOLD = 5 * 0.01; // Adjust threshold based on energy level

fillTextures(positionTexture, velocityTexture, orbitalLevel);


// Add position and velocity variables to the Compute Shaders
const positionVariable = gpuCompute.addVariable(
    'texturePosition',
    positionShaderCode,
    positionTexture
);

const velocityVariable = gpuCompute.addVariable(
    'textureVelocity',
    velocityShaderCode,
    velocityTexture
);
velocityVariable.material.uniforms.threshold = { value: THRESHOLD };
positionVariable.material.uniforms.deltaTime = { value: 0.0 }; // Initialize deltaTime
// Set dependencies between variables
gpuCompute.setVariableDependencies(positionVariable, [positionVariable, velocityVariable]);
gpuCompute.setVariableDependencies(velocityVariable, [positionVariable, velocityVariable]);


// Initialize the GPU computation renderer
const error = gpuCompute.init();
if (error !== null) {
    console.error(error);
}

// Create a particle system to visualize the particles
const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(PARTICLES * 3);
const uvs = new Float32Array(PARTICLES * 2);

let p = 0;
for (let i = 0; i < PARTICLES; i++) {
    const x = (i % numParticlesSqrt) / numParticlesSqrt;
    const y = Math.floor(i / numParticlesSqrt) / numParticlesSqrt;

    positions[p] = 0;
    positions[p + 1] = 0;
    positions[p + 2] = 0;

    uvs[p / 3 * 2] = x;
    uvs[p / 3 * 2 + 1] = y;

    p += 3;
}

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

const material = new THREE.ShaderMaterial({
    uniforms: {
        texturePosition: { value: null },
        scale: { value: Math.pow(orbitalLevel, 2) },
    },
    vertexShader: vertexShaderCode,
    fragmentShader: fragmentShaderCode,
    transparent: true
});

const particles = new THREE.Points(geometry, material);
scene.add(particles);

allRunningComputeShaders.push({computeShader: gpuCompute, material: material, positionVariable: positionVariable}); // Store the GPUComputeRenderer for later use
return {orbitalType: orbitalType, orbitalLevel: orbitalLevel, particles: particles};
}

async function createFromElectronConfig(electronConfig = "1s1", sqrtElectronRatio = 32) {
    if (!isInitialized) throw new Error("Module not initialized. Call init() first.");
    let individualOrbits = electronConfig.split(' ');
    let elementObject = {
        highestOrbitalLevel: 1,
        electronConfig: electronConfig,
        orbitals: [],
        remove: function () {
            this.orbitals.forEach((orbital) => {
                if (orbital.particles.parent) {
                    orbital.particles.parent.remove(orbital.particles);
                }
                orbital.particles.geometry.dispose();
                orbital.particles.material.dispose();
            });
            this.orbitals = []; // Clear the orbitals array
        },
    };
    let highestOrbitalLevel = 1;
    const orbitalPromises = []; // Array to hold promises to the function doesn't return before all promises are resolved
    individualOrbits.forEach((orbit) => {
        const orbitalLevel = parseInt(orbit[0]);
        highestOrbitalLevel = Math.max(highestOrbitalLevel, orbitalLevel);
        orbit = orbit.slice(1); // Remove the first character from the string
        const orbitalType = orbit[0].toUpperCase();
        orbit = orbit.slice(1); // Remove the first character from the string
        const orbitalElectronCount = parseInt(orbit);
        let electronSqrtPerOrbital;
        switch (orbitalType) {
            case 'S':
                orbitalPromises.push(createOrbital(sqrtElectronRatio, OrbitalType.S, orbitalLevel));
                break;
            case 'P':
                electronSqrtPerOrbital = Math.floor(sqrtElectronRatio * orbitalElectronCount / 3);
                orbitalPromises.push(createOrbital(electronSqrtPerOrbital, OrbitalType.Px, orbitalLevel));
                orbitalPromises.push(createOrbital(electronSqrtPerOrbital, OrbitalType.Py, orbitalLevel));
                orbitalPromises.push(createOrbital(electronSqrtPerOrbital, OrbitalType.Pz, orbitalLevel));
                break;
            case 'D':
                electronSqrtPerOrbital = Math.floor(sqrtElectronRatio * orbitalElectronCount / 5);
                orbitalPromises.push(createOrbital(electronSqrtPerOrbital, OrbitalType.Dxy, orbitalLevel));
                orbitalPromises.push(createOrbital(electronSqrtPerOrbital, OrbitalType.Dxz, orbitalLevel));
                orbitalPromises.push(createOrbital(electronSqrtPerOrbital, OrbitalType.Dyz, orbitalLevel));
                orbitalPromises.push(createOrbital(electronSqrtPerOrbital, OrbitalType.Dx2y2, orbitalLevel));
                orbitalPromises.push(createOrbital(electronSqrtPerOrbital, OrbitalType.Dz2, orbitalLevel));
                break;
            default:
                console.error(`Unknown orbital type: ${orbitalType}`);
        }
    });
    
    elementObject.orbitals = await Promise.all(orbitalPromises); // Wait for all orbital promises to resolve
    const maxDistance = highestOrbitalLevel * 10; // Adjust the multiplier as needed
    elementObject.highestOrbitalLevel = highestOrbitalLevel;
    elementObject.orbitals.forEach((orbit) => {
        orbit.particles.material.uniforms.maxDistance = { value: maxDistance }; // For the colour visualisation in fragment shader
    });
    return elementObject;
}
// Update function for the animate loop
function updateParticles() {
    if (!isInitialized) return;
    const deltaTime = Math.min(clock.getDelta(), 0.05); // Call once per frame - limit to 0.05 seconds per frame to avoid large time steps when tab is inactive
    
    for (let i = 0; i < allRunningComputeShaders.length; i++) {
        allRunningComputeShaders[i].computeShader.compute();
        allRunningComputeShaders[i].material.uniforms.texturePosition.value = allRunningComputeShaders[i].computeShader.getCurrentRenderTarget(allRunningComputeShaders[i].positionVariable).texture;
        allRunningComputeShaders[i].positionVariable.material.uniforms.deltaTime.value = deltaTime;
    }
}

export {createOrbital, updateParticles, init, OrbitalType, createFromElectronConfig};