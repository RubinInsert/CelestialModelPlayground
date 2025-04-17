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
        "Dxy": 0.85,
        "Dx2y2": 0.85,
        "Dxz": 0.85,
        "Dyz": 0.85,
        "Dz2": 1,
        "Fxyz": 0.7,
        "Fx_z2_minus_y2": 1,
        "Fy_z2_minus_x2": 1,
        "Fz_x2_minus_y2": 1,
        "Fy3": 0.7,
        "Fx3": 0.7,
        "Fz3": 0.7,
    });
    // Only get this code once in init function, reduce network requests
    static #positionShaderCode = null;
    static #vertexShaderCode = null;
    static #fragmentShaderCode = null;
    static #debugFragShader = null;

    constructor(electronConfig = "1s1", sqrtElectronRatio = 32) {
        if (!CelestialModel.isInitialized) {
            throw new Error("CelestialModel.init() must be called before creating instances.");
        }
        if (!/^\d+[spdf]\d+(\s\d+[spdf]\d+)*$/.test(electronConfig)) {
            throw new Error(`Invalid electron configuration: ${electronConfig}`);
        }
        this.electronConfig = electronConfig;
        this.sqrtElectronRatio = sqrtElectronRatio;
        this.orbitals = [];
        this.highestOrbitalLevel = CelestialModel.#getHighestOrbitalLevel(electronConfig);
    }

    static async init(scene, renderer) {
        CelestialModel.scene = scene;
        CelestialModel.renderer = renderer;

        // Load shaders once for all instances
        [
            CelestialModel.#positionShaderCode,
            CelestialModel.#vertexShaderCode,
            CelestialModel.#fragmentShaderCode,
            CelestialModel.#debugFragShader,
        ] = await Promise.all([
            CelestialModel.#loadShader('./shaders/positionShader.glsl'),
            CelestialModel.#loadShader('./shaders/vertexShader.glsl'),
            CelestialModel.#loadShader('./shaders/fragmentShader.glsl'),
            CelestialModel.#loadShader('./shaders/debugFragShader.glsl'),
        ]);

        CelestialModel.isInitialized = true;
    }

    static updateParticles() {
        if (!CelestialModel.isInitialized) return;
        const deltaTime = Math.min(CelestialModel.clock.getDelta(), 0.05); // Call once per frame - limit to 0.05 seconds per frame to avoid large time steps when tab is inactive

        for (let i = 0; i < CelestialModel.allRunningComputeShaders.length; i++) {
            CelestialModel.allRunningComputeShaders[i].computeShader.compute();
            CelestialModel.allRunningComputeShaders[i].material.uniforms.texturePosition.value = CelestialModel.allRunningComputeShaders[i].computeShader.getCurrentRenderTarget(CelestialModel.allRunningComputeShaders[i].positionVariable).texture;
            CelestialModel.allRunningComputeShaders[i].positionVariable.material.uniforms.deltaTime.value = deltaTime;
        }
    }
    static async #loadShader(url) {
        const response = await fetch(new URL(url, import.meta.url).href);
        if (!response.ok) {
            throw new Error(`Failed to load shader from ${url}: ${response.statusText}`);
        }
        return await response.text();
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

    static #fillTextures(positionTexture, velocityTexture, orbitalLevel = 1) {
        const posArray = positionTexture.image.data;
        const velArray = velocityTexture.image.data;

        for (let i = 0; i < posArray.length; i += 4) {
            // Random positions
            let point = CelestialModel.#generateRandomPointInRange(-orbitalLevel / 2, orbitalLevel / 2);
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

    static #generateRandomPointInRange(min, max) {
        const x = Math.random() * (max - min) + min;
        const y = Math.random() * (max - min) + min;
        const z = Math.random() * (max - min) + min;
        return new THREE.Vector3(x, y, z);
    }

    async #createOrbital(numParticlesSqrt = 64, orbitalType = CelestialModel.OrbitalType.S, orbitalLevel = 1, colour = new THREE.Vector4(1, 1, 1, 1)) {
        if (!CelestialModel.isInitialized) return false; // Ensure the module is initialized before creating an orbital
        const velocityShaderCode = await CelestialModel.#loadShader(`./shaders/${orbitalType}/velocityShader.glsl`);
        const PARTICLES = numParticlesSqrt * numParticlesSqrt; // Total number of particles in orbital
        const gpuCompute = new GPUComputationRenderer(numParticlesSqrt, numParticlesSqrt, CelestialModel.renderer);

        // Create data textures for positions and velocities
        const positionTexture = gpuCompute.createTexture();
        const velocityTexture = gpuCompute.createTexture();

        const THRESHOLD = 5 * 0.01; // Adjust threshold based on energy level

        CelestialModel.#fillTextures(positionTexture, velocityTexture, orbitalLevel);

        // Add position and velocity variables to the Compute Shaders
        const positionVariable = gpuCompute.addVariable(
            'texturePosition',
            CelestialModel.#positionShaderCode,
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

            uvs[(p / 3) * 2] = x;
            uvs[(p / 3) * 2 + 1] = y;

            p += 3;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

        const material = new THREE.ShaderMaterial({
            uniforms: {
                colour: { value: colour },
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

    async #createFromElectronConfig() {
        const individualOrbits = this.electronConfig.split(' ');
        const orbitalPromises = [];

        individualOrbits.forEach((orbit) => {
            const orbitalLevel = parseInt(orbit[0]);
            this.highestOrbitalLevel = Math.max(this.highestOrbitalLevel, orbitalLevel);
            const orbitalType = orbit[1].toUpperCase();
            const orbitalElectronCount = parseInt(orbit.slice(2));
            let electronSqrtPerOrbital;

            switch (orbitalType) {
                case 'S':
                    orbitalPromises.push(this.#createOrbital(this.sqrtElectronRatio, 'S', orbitalLevel));
                    break;
                case 'P':
                    electronSqrtPerOrbital = Math.floor(this.sqrtElectronRatio * orbitalElectronCount / 3);
                    orbitalPromises.push(this.#createOrbital(electronSqrtPerOrbital, 'Px', orbitalLevel));
                    orbitalPromises.push(this.#createOrbital(electronSqrtPerOrbital, 'Py', orbitalLevel));
                    orbitalPromises.push(this.#createOrbital(electronSqrtPerOrbital, 'Pz', orbitalLevel));
                    break;
                case 'D':
                    electronSqrtPerOrbital = Math.floor(this.sqrtElectronRatio * orbitalElectronCount / 5);
                    orbitalPromises.push(this.#createOrbital(electronSqrtPerOrbital, 'Dxy', orbitalLevel));
                    orbitalPromises.push(this.#createOrbital(electronSqrtPerOrbital, 'Dxz', orbitalLevel));
                    orbitalPromises.push(this.#createOrbital(electronSqrtPerOrbital, 'Dyz', orbitalLevel));
                    orbitalPromises.push(this.#createOrbital(electronSqrtPerOrbital, 'Dx2y2', orbitalLevel));
                    orbitalPromises.push(this.#createOrbital(electronSqrtPerOrbital, 'Dz2', orbitalLevel));
                    break;
                case 'F':
                    electronSqrtPerOrbital = Math.floor(this.sqrtElectronRatio * orbitalElectronCount / 7);
                    orbitalPromises.push(this.#createOrbital(electronSqrtPerOrbital, 'Fxyz', orbitalLevel));
                    orbitalPromises.push(this.#createOrbital(electronSqrtPerOrbital, 'Fx_z2_minus_y2', orbitalLevel));
                    orbitalPromises.push(this.#createOrbital(electronSqrtPerOrbital, 'Fy_z2_minus_x2', orbitalLevel));
                    orbitalPromises.push(this.#createOrbital(electronSqrtPerOrbital, 'Fz_x2_minus_y2', orbitalLevel));
                    orbitalPromises.push(this.#createOrbital(electronSqrtPerOrbital, 'Fy3', orbitalLevel));
                    orbitalPromises.push(this.#createOrbital(electronSqrtPerOrbital, 'Fx3', orbitalLevel));
                    orbitalPromises.push(this.#createOrbital(electronSqrtPerOrbital, 'Fz3', orbitalLevel));
                    break;
                default:
                    console.error(`Unknown orbital type: ${orbitalType}`);
            }
        });

        this.orbitals = await Promise.all(orbitalPromises);
        const maxDistance = Math.pow(this.highestOrbitalLevel, 2) * 2.5;
        this.orbitals.forEach((orbit) => {
            orbit.particles.material.uniforms.maxDistance = { value: maxDistance };
        });
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
}
export default CelestialModel;