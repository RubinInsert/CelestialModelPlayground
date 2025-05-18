import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/examples/misc/GPUComputationRenderer.js';

class CelestialModel {
    static isInitialized = false;
    static scene = null;
    static camera = null;
    static renderer = null;
    static clock = new THREE.Clock();
    static allRunningComputeShaders = [];
    static OrbitalType = Object.freeze({
        S: 'S',
        Px: 'Px',
        Py: 'Py',
        Pz: 'Pz',
        Dxy: 'Dxy', // TODO Alignments
        Dx2y2: 'Dx2y2', // TODO Alignments
        Dxz: 'Dxz', // TODO Alignments\
        Dyz: 'Dyz', // TODO Alignments
        Dz2: 'Dz2', // TODO Alignments
        Fxyz: 'Fxyz', // TODO Alignments
        Fx_z2_minus_y2: 'Fx_z2_minus_y2', // TODO Alignments
        Fy_z2_minus_x2: 'Fy_z2_minus_x2', // TODO Alignments
        Fz_x2_minus_y2: 'Fz_x2_minus_y2', // TODO Alignments
        Fy3: 'Fy3', // TODO Alignments
        Fx3: 'Fx3', // TODO Alignments
        Fz3: 'Fz3', // TODO Alignments
    });
    static OrbitalScale = Object.freeze({
        "S": 1,
        "Px": 1,
        "Py": 1,
        "Pz": 1,
        "Dxy": 1,
        "Dx2y2": 1,
        "Dxz": 1,
        "Dyz": 1,
        "Dz2": 1,
        "Fxyz": 1,
        "Fx_z2_minus_y2": 1,
        "Fy_z2_minus_x2": 1,
        "Fz_x2_minus_y2": 1,
        "Fy3": 1,
        "Fx3": 1,
        "Fz3": 1,
    });
    // Only get this code once in init function, reduce network requests
    static #vertexShaderCode = null;
    static #fragmentShaderCode = null;
    static #debugFragShader = null;
    static #emissionSpectrumData = null;
    static #electronConfigData = null;
    constructor(chemSymbol = "H", sqrtElectronRatio = 32, ) {
        this.chemSymbol = chemSymbol.charAt(0).toUpperCase() + chemSymbol.slice(1).toLowerCase();
        if (!CelestialModel.isInitialized) {
            throw new Error("CelestialModel.init() must be called before creating instances.");
        }
        if (!CelestialModel.#electronConfigData[this.chemSymbol]) {
            throw new Error(`Invalid chemical symbol.`);
        }
        this.electronConfig = CelestialModel.#electronConfigData[this.chemSymbol];
        this.sqrtElectronRatio = sqrtElectronRatio;
        this.orbitals = [];
        this.highestOrbitalLevel = CelestialModel.#getHighestOrbitalLevel(this.electronConfig);
        let maxDistance = Math.pow(this.highestOrbitalLevel, 2) * 2.5;
        this.boundingBox = new THREE.Box3(new THREE.Vector3(-maxDistance, -maxDistance, -maxDistance),
                                         new THREE.Vector3(maxDistance, maxDistance, maxDistance));
    }

    static async init(scene, renderer) {
        CelestialModel.scene = scene;
        CelestialModel.renderer = renderer;

        // Load shaders once for all instances
        [
            CelestialModel.#vertexShaderCode,
            CelestialModel.#fragmentShaderCode,
            CelestialModel.#debugFragShader,
            CelestialModel.#emissionSpectrumData,
            CelestialModel.#electronConfigData,
        ] = await Promise.all([
            CelestialModel.#loadShader('./shaders/vertexShader.glsl'),
            CelestialModel.#loadShader('./shaders/fragmentShader.glsl'),
            CelestialModel.#loadShader('./shaders/debugFragShader.glsl'),
            CelestialModel.#loadJSON('./EmissionSpectra.json'),
            CelestialModel.#loadJSON('./ElectronConfig.json'),
        ]);

        CelestialModel.isInitialized = true;
    }

    static updateParticles() {
        if (!CelestialModel.isInitialized) return;
        const deltaTime = CelestialModel.clock.getElapsedTime(); // Call once per frame - limit to 0.05 seconds per frame to avoid large time steps when tab is inactive

        for (let i = 0; i < CelestialModel.allRunningComputeShaders.length; i++) {
            if(!CelestialModel.allRunningComputeShaders[i].material.visible) continue; // Skip if the material is not visible
            CelestialModel.allRunningComputeShaders[i].computeShader.compute();
            CelestialModel.allRunningComputeShaders[i].material.uniforms.texturePosition.value = CelestialModel.allRunningComputeShaders[i].computeShader.getCurrentRenderTarget(CelestialModel.allRunningComputeShaders[i].positionVariable).texture;
            CelestialModel.allRunningComputeShaders[i].positionVariable.material.uniforms.elapsedTime.value = deltaTime;
        }
    }
    static async #loadShader(url) {
        const response = await fetch(new URL(url, import.meta.url).href);
        if (!response.ok) {
            throw new Error(`Failed to load shader from ${new URL(url, import.meta.url).href}: ${response.statusText}`);
        }
        return await response.text();
    }
    static async #loadJSON(url) {
        const response = await fetch(new URL(url, import.meta.url).href);
        if (!response.ok) {
            throw new Error(`Failed to load JSON from ${new URL(url, import.meta.url).href}: ${response.statusText}`);
        }
        return await response.json();
    }

    static #rand() {
        return Math.random(); // Uniform random in [0, 1)
    }

    static #getHighestOrbitalLevel(electronConfig) {
        const individualOrbits = electronConfig.split(' ');
        let highestOrbitalLevel = 1;
        individualOrbits.forEach((orbit) => {
            const orbitalLevel = parseInt(orbit[0]);
            highestOrbitalLevel = Math.max(highestOrbitalLevel, orbitalLevel);
        });
        return highestOrbitalLevel;
    }

    static #fillTextures(positionTexture, orbitalLevel = 1) {
        const posArray = positionTexture.image.data;

        for (let i = 0; i < posArray.length; i += 4) {
            // Random positions
            let point = CelestialModel.#generateRandomPointInRange(-orbitalLevel / 2, orbitalLevel / 2);
            posArray[i] = point.x; // x
            posArray[i + 1] = point.y; // y
            posArray[i + 2] = point.z; // z
            posArray[i + 3] = 1; // w (not used)
        }
    }

    static #generateRandomPointInRange(min, max) {
        const x = Math.random() * (max - min) + min;
        const y = Math.random() * (max - min) + min;
        const z = Math.random() * (max - min) + min;
        return new THREE.Vector3(x, y, z);
    }

    async createOrbital(numParticlesSqrt = 64, orbitalType = CelestialModel.OrbitalType.S, orbitalLevel = 1) {
        if (!CelestialModel.isInitialized) return false; // Ensure the module is initialized before creating an orbital
        const positionShaderCode = await CelestialModel.#loadShader(`./shaders/${orbitalType}/positionShader.glsl`);
        const PARTICLES = numParticlesSqrt * numParticlesSqrt; // Total number of particles in orbital
        const gpuCompute = new GPUComputationRenderer(numParticlesSqrt, numParticlesSqrt, CelestialModel.renderer);

        // Create data textures for positions and velocities
        const positionTexture = gpuCompute.createTexture();

        const THRESHOLD = 5 * 0.01; // Adjust threshold based on energy level

        CelestialModel.#fillTextures(positionTexture, orbitalLevel);

        // Add position variables to the Compute Shaders
        const positionVariable = gpuCompute.addVariable(
            'texturePosition',
            positionShaderCode,
            positionTexture
        );
        positionVariable.material.uniforms.elapsedTime = { value: 0.0 }; // Initialize deltaTime
        positionVariable.material.uniforms.resolution = { value: new THREE.Vector2(window.innerWidth, window.innerHeight) };

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

            uvs[(p / 3) * 2] = x;
            uvs[(p / 3) * 2 + 1] = y;

            p += 3;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        const material = new THREE.ShaderMaterial({
            uniforms: {
                atomicEmissionSpectrum: { value: CelestialModel.#createSpectrumTexture(CelestialModel.#emissionSpectrumData[this.chemSymbol]) },
                texturePosition: { value: null },
                scale: { value: Math.pow(orbitalLevel, 2) * CelestialModel.OrbitalScale[orbitalType] },
            },
            vertexShader: CelestialModel.#vertexShaderCode,
            fragmentShader: CelestialModel.#fragmentShaderCode,
            transparent: true,
        });
        
        const particles = new THREE.Points(geometry, material);
        CelestialModel.scene.add(particles);

        CelestialModel.allRunningComputeShaders.push({
            computeShader: gpuCompute,
            material: material,
            positionVariable: positionVariable,
        }); // Store the GPUComputeRenderer for later use
        return { orbitalType: orbitalType, orbitalLevel: orbitalLevel, particles: particles };
    }
    static #hexToRgb(hex) {
        // Remove the '#' if it exists
        hex = hex.replace(/^#/, '');
    
        // Parse the red, green, and blue components
        const r = parseInt(hex.substring(0, 2), 16); // Red
        const g = parseInt(hex.substring(2, 4), 16); // Green
        const b = parseInt(hex.substring(4, 6), 16); // Blue
    
        return [r, g, b]; // Return as an array
    }
    static #createSpectrumTexture(rgbCodes) {
        const size = rgbCodes.length;
        const data = new Uint8Array(size * 4); // RGB values for each wavelength
        // Map each wavelength to RGB and store in the texture data
        rgbCodes.forEach((rgbCode, i) => {
            const [R, G, B] = CelestialModel.#hexToRgb(rgbCode);
            
            data[i * 4] = R;     // Red
            data[i * 4 + 1] = G; // Green
            data[i * 4 + 2] = B; // Blue
            data[i * 4 + 3] = 255; // Alpha
        });
    
        // Create the texture
        const texture = new THREE.DataTexture(data, size, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
        texture.generateMipmaps = false; // Disable mipmaps for non-POT textures
        texture.minFilter = THREE.LinearFilter; // Blends the colours in the texture
        texture.magFilter = THREE.LinearFilter;
        texture.needsUpdate = true; // Mark the texture as needing an update
        return texture;
    }
    static #visualizeTexture(texture, scene) { // This is for DEBUGGING ONLY - REMOVE LATER
        // Create a plane geometry
        const planeGeometry = new THREE.PlaneGeometry(2, 2); // Size of the plane
    
        // Create a material using the texture
        const planeMaterial = new THREE.MeshBasicMaterial({
            map: texture, // Use the texture
        });
    
        // Create a mesh with the geometry and material
        const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    
        // Add the plane to the scene
        CelestialModel.scene.add(plane);
    
        // Position the plane in front of the camera
        plane.position.set(0, 0, -2); // Adjust the Z position as needed
    }
    static #getEmissionSpectrum(elementName) { // This is for DEBUGGING ONLY - REMOVE LATER
        const elementWaveLengths = CelestialModel.#emissionSpectrumData[elementName];
        if (!elementWaveLengths) {
            console.error(`No emission spectrum data found for element: ${elementName}`);
            return;
        }
        let spectrumTexture = CelestialModel.#createSpectrumTexture(elementWaveLengths);
        CelestialModel.#visualizeTexture(spectrumTexture, CelestialModel.scene);
    }
    async #createFromElectronConfig() {
        const individualOrbits = this.electronConfig.split(' ');
        const orbitalPromises = [];

        individualOrbits.forEach((orbit) => {
            const orbitalLevel = parseInt(orbit[0]);
            this.highestOrbitalLevel = Math.max(this.highestOrbitalLevel, orbitalLevel);
            const orbitalType = orbit[1].toUpperCase();
            const orbitalElectronCount = parseInt(orbit.slice(2));
            let electronSqrtPerOrbital;

            // switch (orbitalType) {
            //     case 'S':
            //         orbitalPromises.push(this.#createOrbital(this.sqrtElectronRatio, 'S', orbitalLevel));
            //         break;
            //     case 'P':
            //         electronSqrtPerOrbital = Math.floor(this.sqrtElectronRatio * orbitalElectronCount / 3);
            //         orbitalPromises.push(this.#createOrbital(electronSqrtPerOrbital, 'Px', orbitalLevel));
            //         orbitalPromises.push(this.#createOrbital(electronSqrtPerOrbital, 'Py', orbitalLevel));
            //         orbitalPromises.push(this.#createOrbital(electronSqrtPerOrbital, 'Pz', orbitalLevel));
            //         break;
            //     case 'D':
            //         electronSqrtPerOrbital = Math.floor(this.sqrtElectronRatio * orbitalElectronCount / 5);
            //         orbitalPromises.push(this.#createOrbital(electronSqrtPerOrbital, 'Dxy', orbitalLevel));
            //         orbitalPromises.push(this.#createOrbital(electronSqrtPerOrbital, 'Dxz', orbitalLevel));
            //         orbitalPromises.push(this.#createOrbital(electronSqrtPerOrbital, 'Dyz', orbitalLevel));
            //         orbitalPromises.push(this.#createOrbital(electronSqrtPerOrbital, 'Dx2y2', orbitalLevel));
            //         orbitalPromises.push(this.#createOrbital(electronSqrtPerOrbital, 'Dz2', orbitalLevel));
            //         break;
            //     case 'F':
            //         electronSqrtPerOrbital = Math.floor(this.sqrtElectronRatio * orbitalElectronCount / 7);
            //         orbitalPromises.push(this.#createOrbital(electronSqrtPerOrbital, 'Fxyz', orbitalLevel));
            //         orbitalPromises.push(this.#createOrbital(electronSqrtPerOrbital, 'Fx_z2_minus_y2', orbitalLevel));
            //         orbitalPromises.push(this.#createOrbital(electronSqrtPerOrbital, 'Fy_z2_minus_x2', orbitalLevel));
            //         orbitalPromises.push(this.#createOrbital(electronSqrtPerOrbital, 'Fz_x2_minus_y2', orbitalLevel));
            //         orbitalPromises.push(this.#createOrbital(electronSqrtPerOrbital, 'Fy3', orbitalLevel));
            //         orbitalPromises.push(this.#createOrbital(electronSqrtPerOrbital, 'Fx3', orbitalLevel));
            //         orbitalPromises.push(this.#createOrbital(electronSqrtPerOrbital, 'Fz3', orbitalLevel));
            //         break;
            //     default:
            //         console.error(`Unknown orbital type: ${orbitalType}`);
            // }
        });

        this.orbitals = await Promise.all(orbitalPromises);
        const maxDistance = Math.pow(this.highestOrbitalLevel, 2) * 2.5;
        this.orbitals.forEach((orbit) => {
            orbit.particles.material.uniforms.maxDistance = { value: maxDistance };
        });
        this.showTopTwoOrbitals(); // Show only the top two orbitals by default
    }

    async create() {
        if (!CelestialModel.isInitialized) {
            throw new Error("CelestialModel.init() must be called before using this method.");
        }
        return await this.#createFromElectronConfig(this.electronConfig, this.sqrtElectronRatio);
    }
    remove() {
        this.orbitals.forEach((orbit) => {
            CelestialModel.scene.remove(orbit.particles);
            orbit.particles.geometry.dispose();
            orbit.particles.material.dispose();
        // Dispose of textures in the material (if any)
        if (orbit.particles.material.uniforms?.texturePosition?.value) {
            orbit.particles.material.uniforms.texturePosition.value.dispose();
        }
        });
        this.orbitals = [];
    }
    hideOrbital(index) {
        if (this.orbitals[index]) {
            this.orbitals[index].particles.visible = false;
            CelestialModel.allRunningComputeShaders[index].material.visible = false; // The index of the compute shader matches the particle index as they are added at the same point in code
        } else {
            console.error(`Orbital at index ${index} does not exist.`);
        }
    }
    showOrbital(index) {
        if (this.orbitals[index]) {
            this.orbitals[index].particles.visible = true;
            CelestialModel.allRunningComputeShaders[index].material.visible = true; // The index of the compute shader matches the particle index as they are added at the same point in code
        } else {
            console.error(`Orbital at index ${index} does not exist.`);
        }
    }
    showAllOrbitals() {
        this.orbitals.forEach((orbit, index) => {
            this.showOrbital(index);
        });
    }
    showTopTwoOrbitals() {
        this.orbitals.forEach((orbit, index) => {
            if(orbit.orbitalLevel <= (this.highestOrbitalLevel - 2)) {
                this.hideOrbital(index);
            }
            else {
                this.showOrbital(index);
            }
        });
    }
}
export default CelestialModel;