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
            CelestialModel.#positionShaderCode,
            CelestialModel.#vertexShaderCode,
            CelestialModel.#fragmentShaderCode,
            CelestialModel.#debugFragShader,
            CelestialModel.#emissionSpectrumData,
            CelestialModel.#electronConfigData,
        ] = await Promise.all([
            CelestialModel.#loadShader('./shaders/positionShader.glsl'),
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

    async #createOrbital(numParticlesSqrt = 64, orbitalType = CelestialModel.OrbitalType.S, orbitalLevel = 1) {
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
                atomicEmissionSpectrum: { value: CelestialModel.createSpectrumTexture(CelestialModel.#emissionSpectrumData[this.chemSymbol]) },
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
    static wavelengthToRGB(wavelength) {
        let R = 0, G = 0, B = 0;
    
        if (wavelength >= 380 && wavelength < 440) {
            R = -(wavelength - 440) / (440 - 380);
            G = 0.0;
            B = 1.0;
        } else if (wavelength >= 440 && wavelength < 490) {
            R = 0.0;
            G = (wavelength - 440) / (490 - 440);
            B = 1.0;
        } else if (wavelength >= 490 && wavelength < 510) {
            R = 0.0;
            G = 1.0;
            B = -(wavelength - 510) / (510 - 490);
        } else if (wavelength >= 510 && wavelength < 580) {
            R = (wavelength - 510) / (580 - 510);
            G = 1.0;
            B = 0.0;
        } else if (wavelength >= 580 && wavelength < 645) {
            R = 1.0;
            G = -(wavelength - 645) / (645 - 580);
            B = 0.0;
        } else if (wavelength >= 645 && wavelength <= 750) {
            R = 1.0;
            G = 0.0;
            B = 0.0;
        }
    
        // Adjust intensity for wavelengths near the edges of the visible spectrum
        let factor = 1.0;    
        R = Math.pow(R * factor, 0.8);
        G = Math.pow(G * factor, 0.8);
        B = Math.pow(B * factor, 0.8);
        
        return [R * 255, G * 255, B * 255]; // Return RGB values as an array
    }
    static hexToRgb(hex) {
        // Remove the '#' if it exists
        hex = hex.replace(/^#/, '');
    
        // Parse the red, green, and blue components
        const r = parseInt(hex.substring(0, 2), 16); // Red
        const g = parseInt(hex.substring(2, 4), 16); // Green
        const b = parseInt(hex.substring(4, 6), 16); // Blue
    
        return [r, g, b]; // Return as an array
    }
    static createSpectrumTexture(wavelengths) {
        const size = wavelengths.length;
        const data = new Uint8Array(size * 4); // RGB values for each wavelength
        // Map each wavelength to RGB and store in the texture data
        wavelengths.forEach((wavelength, i) => {
            const [R, G, B] = CelestialModel.hexToRgb(wavelength);
            
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
    static visualizeTexture(texture, scene) {
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
    static getEmissionSpectrum(elementName) {
        const elementWaveLengths = CelestialModel.#emissionSpectrumData[elementName];
        if (!elementWaveLengths) {
            console.error(`No emission spectrum data found for element: ${elementName}`);
            return;
        }
        let spectrumTexture = CelestialModel.createSpectrumTexture(elementWaveLengths);
        CelestialModel.visualizeTexture(spectrumTexture, CelestialModel.scene);
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