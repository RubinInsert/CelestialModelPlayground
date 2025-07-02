//if(typeof window==="object"&&!window.require)window.require=()=>window.THREE;
import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/examples/misc/GPUComputationRenderer.js';

class CelestialModel {
    static isInitialized = false;
    static scene = null;
    static camera = null;
    static renderer = null;
    static timeStep = 5.0;
    static spinStateFadeFactor = 0.25;
    static clock = new THREE.Clock();
    static allModels = [];
    static OrbitalType = Object.freeze({
        S: 'S',
        Px: 'Px',
        Py: 'Py',
        Pz: 'Pz',
        Dxy: 'Dxy', 
        Dx2y2: 'Dx2y2', 
        Dxz: 'Dxz', 
        Dyz: 'Dyz', 
        Dz2: 'Dz2', 
        Fxyz: 'Fxyz', 
        Fx_x2_minus_3y2: 'Fx_x2_minus_3y2',
        Fxz2: 'Fxz2', 
        Fz_x2_minus_y2: 'Fz_x2_minus_y2', 
        Fy3: 'Fy3', 
        Fyz2: 'Fyz2', 
        Fz3: 'Fz3', 
    });
    static #orbitalShaderCode = { // Caching the shader codes on first load reduces network requests and speeds up rendering - TO BE REPLACED WITH A SINGLE SHADER POSSIBLY
        "S": null,
        "Px": null,
        "Py": null,
        "Pz": null,
        "Dxy": null,
        "Dx2y2": null,
        "Dxz": null,
        "Dyz": null,
        "Dz2": null,
        "Fxyz": null,
        "Fx_x2_minus_3y2": null,
        "Fxz2": null,
        "Fz_x2_minus_y2": null,
        "Fy3": null,
        "Fyz2": null,
        "Fz3": null,
    }
    // Only get this code once in init function, reduce network requests
    static #vertexShaderCode = null;
    static #fragmentShaderCode = null;
    static #debugFragShader = null;
    static #spinStateFragShaderCode = null;
    static #protonFieldShaderCode = null;
    static #elementData = null;
    #scaleFactor = 1;
    constructor(chemSymbol = "H", particleRatio = 1024, ) {
        this.chemSymbol = chemSymbol.charAt(0).toUpperCase() + chemSymbol.slice(1).toLowerCase();
        if (!CelestialModel.isInitialized) {
            throw new Error("CelestialModel.init() must be called before creating instances.");
        }
        if (!CelestialModel.#elementData[this.chemSymbol]) {
            throw new Error(`Invalid chemical symbol.`);
        }
        this.electronConfig = CelestialModel.#elementData[this.chemSymbol].electronConfig;
        this.protonFieldRadius = CelestialModel.#elementData[this.chemSymbol].protonFieldRadius ?? null;
        this.particleRatio = particleRatio;
        this.orbitals = [];
        this.highestOrbitalLevel = CelestialModel.#getHighestOrbitalLevel(this.electronConfig);
        this.#scaleFactor = CelestialModel.#elementData[this.chemSymbol].radius / (Math.pow(this.highestOrbitalLevel, 2)); // Used to scale the shader positions to the correct size internally
        this.maxDistance =  Math.pow(this.highestOrbitalLevel, 2) * this.#scaleFactor;
        this.boundingBox = new THREE.Box3(new THREE.Vector3(-this.maxDistance, -this.maxDistance, -this.maxDistance),
                                         new THREE.Vector3(this.maxDistance, this.maxDistance, this.maxDistance));
        this.spinState = 0.0;
                                       
        this.THREEObject = new THREE.Object3D();
        this.computeShaders = [];
        this.protonField = this.#createProtonField();
        CelestialModel.allModels.push(this);
        CelestialModel.scene.add(this.THREEObject);
    }
    static async init(scene, renderer) {
        CelestialModel.scene = scene;
        CelestialModel.renderer = renderer;

        // Load shaders once for all instances
        [
            CelestialModel.#vertexShaderCode,
            CelestialModel.#fragmentShaderCode,
            CelestialModel.#spinStateFragShaderCode,
            CelestialModel.#protonFieldShaderCode,
            CelestialModel.#elementData,

        ] = await Promise.all([
            CelestialModel.#loadShader('./shaders/vertexShader.glsl'),
            CelestialModel.#loadShader('./shaders/fragmentShader.glsl'),
            CelestialModel.#loadShader('./shaders/SPINSTATE_fragmentShader.glsl'),
            CelestialModel.#loadShader('./shaders/protonFieldShader.glsl'),
            CelestialModel.#loadJSON('./ElementData.json'),
        ]);

        CelestialModel.isInitialized = true;
    }
    static updateParticles() {
        if (!CelestialModel.isInitialized) {
            throw new Error("CelestialModel.init() must be called before using this method.");
        }
        CelestialModel.allModels.forEach(model => model.update());
    }
    update() {
    if (!CelestialModel.isInitialized) return;
    const elapsedTime = CelestialModel.clock.getElapsedTime();
    // Fade towards chosen spin state (For when the user changes the state)
    if (Math.abs(this.spinState - this.#targetSpinState) > 0.01) {
        const direction = Math.sign(this.#targetSpinState - this.spinState);
        this.spinState += direction * 0.01;
        this.spinState = Math.max(-1.0, Math.min(1.0, this.spinState)); // Clamp
    } else {
        this.spinState = this.#targetSpinState; // Snap to target when close enough
    }

        for (const shaderData of this.computeShaders) {
            if (!shaderData.material.visible) continue;
            shaderData.computeShader.compute();
            shaderData.material.uniforms.texturePosition.value = shaderData.computeShader.getCurrentRenderTarget(shaderData.positionVariable).texture;
            shaderData.positionVariable.material.uniforms.elapsedTime.value = elapsedTime;
            shaderData.positionVariable.material.uniforms.timeStep = { value: CelestialModel.timeStep };
            if (shaderData.material.uniforms.mode) {
                shaderData.material.uniforms.mode.value = this.spinState;
            }
        }
    }
    static async #loadShader(url) {
        const response = await fetch(new URL(url, import.meta.url).href);
        if (!response.ok) {
            throw new Error(`Failed to load shader from ${new URL(url, import.meta.url).href}: ${response.statusText}`);
        }
        return await response.text();
    }
    static async #loadOrbitalShader(orbitalType) {
        if(CelestialModel.#orbitalShaderCode[orbitalType] !== null) return CelestialModel.#orbitalShaderCode[orbitalType];
        const response = await fetch(new URL(`./shaders/${orbitalType}/positionShader.glsl`, import.meta.url).href);
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

    async #createOrbital(numParticles = 4096, orbitalType = CelestialModel.OrbitalType.S, orbitalLevel = 1) {
        if (!CelestialModel.isInitialized) return false;
        const positionShaderCode = await CelestialModel.#loadOrbitalShader(orbitalType);
        const numParticlesSqrt = Math.ceil(Math.sqrt(numParticles));
        const PARTICLES = numParticlesSqrt * numParticlesSqrt; // Pad to next square for texture

        const gpuCompute = new GPUComputationRenderer(numParticlesSqrt, numParticlesSqrt, CelestialModel.renderer);
        // Create data textures for positions and velocities
        const positionTexture = gpuCompute.createTexture();


        CelestialModel.#fillTextures(positionTexture, orbitalLevel);

        // Add position variables to the Compute Shaders
        const positionVariable = gpuCompute.addVariable(
            'texturePosition',
            positionShaderCode,
            positionTexture
        );
        positionVariable.material.uniforms.elapsedTime = { value: 0.0 }; // Initialize deltaTime
        positionVariable.material.uniforms.timeStep = { value: CelestialModel.timeStep }; // Initialize deltaTime
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
                atomicEmissionSpectrum: { value: CelestialModel.#createSpectrumTexture(CelestialModel.#elementData[this.chemSymbol].emissionSpectra) },
                texturePosition: { value: null },
                scale: { value: Math.pow(orbitalLevel, 2) * this.#scaleFactor / 41.0 }, // Dividing by 41.0 is necessary because the orbital 1s has a max distribution of 41 units - Simply due to how I created the shader (So we scale down to a unit sphere)
                mode: { value: 0.0}, // 0.0 for normal emission mode, 1.0 for negative spin state, 2.0 for positive spin state
                spinStateFadeFactor: { value: 1.0 }, // Used to fade the spin state color
                pointSize: { value: 2.0 },
            },
            vertexShader: CelestialModel.#vertexShaderCode,
            fragmentShader: CelestialModel.#fragmentShaderCode,
            transparent: true,
        });
        
        const particles = new THREE.Points(geometry, material);
        this.THREEObject.add(particles);

        this.computeShaders.push({
            computeShader: gpuCompute,
            material: material,
            positionVariable: positionVariable,
        }); // Store the GPUComputeRenderer for later use
        particles.material.uniforms.maxDistance = { value: this.maxDistance };
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
    #createProtonField() {
        if (!this.protonFieldRadius) {
            console.warn(`No proton field radius defined for ${this.chemSymbol}. Proton field will not be created.`);
        }
        const protonFieldGeometry = new THREE.SphereGeometry(this.protonFieldRadius, 64, 64);
        // Define the number of steps for the fresnel effect

        const thicknessMaterial = new THREE.ShaderMaterial({
            vertexShader: `
            varying vec3 vNormal;
            varying vec3 vWorldPosition;

            void main() {
                vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz); // Transform normal to world space
                vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz; // Transform position to world space
                gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPosition, 1.0);
            }
            `,
            fragmentShader: CelestialModel.#protonFieldShaderCode,
            uniforms: {
            uCameraPosition: { value: new THREE.Vector3() }, // Initialize the uniform
            uColor: { value: new THREE.Color(CelestialModel.#elementData[this.chemSymbol].emissionSpectra.at(-1)) }, // Pass the color as a uniform
            },
            transparent: true, // Enable transparency
            depthWrite: false
        });
                /**
                 * Animate the proton field's fresnel effect and color based on camera position.
                 * This section should be called in your main animation/render loop.
                 */
                thicknessMaterial.onBeforeCompile = (shader) => {
                    shader.uniforms.uCameraPosition = { value: new THREE.Vector3() };
                    thicknessMaterial.userData.shader = shader;
                };
                thicknessMaterial.onBeforeRender = (renderer, scene, camera) => {
                    if (thicknessMaterial.userData.shader) {
                        thicknessMaterial.userData.shader.uniforms.uCameraPosition.value.copy(camera.position);
                    }
                };
        const protonFieldMaterial = new THREE.MeshBasicMaterial({
            color: CelestialModel.#elementData[this.chemSymbol].emissionSpectra.at(-1), // Default to red if no color is defined
            transparent: true,
            opacity: 0.5,
            depthWrite: false
        });
        const protonField = new THREE.Mesh(protonFieldGeometry, thicknessMaterial);
        protonField.name = `${this.chemSymbol} Proton Field`;
        protonField.visible = false; // Initially set to not visible
        this.THREEObject.add(protonField);
        return protonField;
        
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
        const elementWaveLengths = CelestialModel.#elementData[elementName].emissionSpectra;
        if (!elementWaveLengths) {
            console.error(`No emission spectrum data found for element: ${elementName}`);
            return;
        }
        let spectrumTexture = CelestialModel.#createSpectrumTexture(elementWaveLengths);
        CelestialModel.#visualizeTexture(spectrumTexture, CelestialModel.scene);
    }
    async #createFromElectronConfig() {
        const individualOrbits = this.electronConfig.split(' ');
        const lastTwoShells = individualOrbits.slice(-2); // Get the last two orbitals for visualization
        const orbitalPromises = [];

        lastTwoShells.forEach((orbit) => {
            const orbitalLevel = parseInt(orbit[0]);
            this.highestOrbitalLevel = Math.max(this.highestOrbitalLevel, orbitalLevel);
            const orbitalType = orbit[1].toUpperCase();
            const orbitalElectronCount = parseInt(orbit.slice(2));
            let particlesPerSuborbital;

            switch (orbitalType) {
                case 'S':
                    orbitalPromises.push(this.#createOrbital(this.particleRatio * orbitalElectronCount, 'S', orbitalLevel));
                    break;
                case 'P':
                    particlesPerSuborbital = Math.max(1, Math.floor((this.particleRatio * orbitalElectronCount) / 3));
                    orbitalPromises.push(this.#createOrbital(particlesPerSuborbital, 'Px', orbitalLevel));
                    orbitalPromises.push(this.#createOrbital(particlesPerSuborbital, 'Py', orbitalLevel));
                    orbitalPromises.push(this.#createOrbital(particlesPerSuborbital, 'Pz', orbitalLevel));
                    break;
                case 'D':
                    particlesPerSuborbital = Math.max(1, Math.floor((this.particleRatio * orbitalElectronCount) / 5));
                    orbitalPromises.push(this.#createOrbital(particlesPerSuborbital, 'Dxy', orbitalLevel));
                    orbitalPromises.push(this.#createOrbital(particlesPerSuborbital, 'Dxz', orbitalLevel));
                    orbitalPromises.push(this.#createOrbital(particlesPerSuborbital, 'Dyz', orbitalLevel));
                    orbitalPromises.push(this.#createOrbital(particlesPerSuborbital, 'Dx2y2', orbitalLevel));
                    orbitalPromises.push(this.#createOrbital(particlesPerSuborbital, 'Dz2', orbitalLevel));
                    break;
                case 'F':
                    particlesPerSuborbital = Math.max(1, Math.floor((this.particleRatio * orbitalElectronCount) / 7));
                    orbitalPromises.push(this.#createOrbital(particlesPerSuborbital, 'Fx_x2_minus_3y2', orbitalLevel));
                    orbitalPromises.push(this.#createOrbital(particlesPerSuborbital, 'Fxyz', orbitalLevel));
                    orbitalPromises.push(this.#createOrbital(particlesPerSuborbital, 'Fxz2', orbitalLevel));
                    orbitalPromises.push(this.#createOrbital(particlesPerSuborbital, 'Fy3', orbitalLevel));
                    orbitalPromises.push(this.#createOrbital(particlesPerSuborbital, 'Fyz2', orbitalLevel));
                    orbitalPromises.push(this.#createOrbital(particlesPerSuborbital, 'Fz_x2_minus_y2', orbitalLevel));
                    orbitalPromises.push(this.#createOrbital(particlesPerSuborbital, 'Fz3', orbitalLevel));
                    break;
                default:
                    console.error(`Unknown orbital type: ${orbitalType}`);
            }
        });

        this.orbitals = await Promise.all(orbitalPromises);
        // this.orbitals.forEach((orbit) => { // Replaced by setting directly in the createOrbital function
        //     orbit.particles.material.uniforms.maxDistance = { value: this.maxDistance };
        // });
        this.showTopTwoOrbitals(); // Show only the top two orbitals by default
        this.orbitals.forEach((orbit) => {
            this.THREEObject.add(orbit.particles);
        });
    }

    async create() {
        if (!CelestialModel.isInitialized) {
            throw new Error("CelestialModel.init() must be called before using this method.");
        }
        this.#createProtonField();
        return await this.#createFromElectronConfig(this.electronConfig, this.sqrtElectronRatio);
    }
    remove() {
    // Remove all orbital particle systems and dispose resources
    this.THREEObject.traverse((child) => {
        console.log(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (Array.isArray(child.material)) {
            child.material.forEach(mat => mat.dispose());
            } else {
            child.material.dispose();
            }
            child.visible = false; // Hide the material
        }
    });
    console.log(this.THREEObject.children);
    CelestialModel.scene.remove(this.THREEObject);
    this.orbitals = [];
    // Remove the main THREEObject from the scene
}
    hideOrbital(index) {
        if (this.orbitals[index]) {
            this.orbitals[index].particles.visible = false;
            this.orbitals[index].particles.material.visible = false; // The index of the compute shader matches the particle index as they are added at the same point in code
        } else {
            console.error(`Orbital at index ${index} does not exist.`);
        }
    }
    showOrbital(index) {
        if (this.orbitals[index]) {
            this.orbitals[index].particles.visible = true;
            this.orbitals[index].particles.material.visible = true; // The index of the compute shader matches the particle index as they are added at the same point in code
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
        // this.orbitals.forEach((orbit, index) => { //        // Show only the top two ENERGY LEVELS
        //     if(orbit.orbitalLevel <= (this.highestOrbitalLevel - 2)) {
        //         this.hideOrbital(index);
        //     }
        //     else {
        //         this.showOrbital(index);
        //     }
        // });
        this.orbitals.forEach(orbit => {
            orbit.particles.visible = false; // Hide all orbitals first
            orbit.particles.material.visible = false; // Ensure the material is also hidden
        });
        const orbitalOrderOfFilling = this.electronConfig.match(/\d+[spdf]\d+/g);
        if (orbitalOrderOfFilling) {
            const lastTwo = orbitalOrderOfFilling.slice(-2);
            lastTwo.forEach(orbitStr => {
                const [, level, type] = orbitStr.match(/(\d+)([spdf])/);
                this.getOrbitals(type, parseInt(level)).forEach(orbit => {
                    console.log(orbit);
                    orbit.particles.visible = true;
                    orbit.particles.material.visible = true; // Ensure the material is also visible
                });
            });
        }
    }
    getTopTwoOrbitals() {
        return this.orbitals.filter(orbit => orbit.orbitalLevel >= (this.highestOrbitalLevel - 2));
    }
    setProtonFieldVisibility(visible) {
        if (!this.protonField) {
            console.warn(`No proton field defined for ${this.chemSymbol}. Cannot set visibility.`);
            return;
        }
        this.protonField.visible = visible;
    }
    setSpinStateVisualization(isEnabled) {
        const unpairedElectronsInfo = this.getUnpairedElectrons();
        if (unpairedElectronsInfo.totalUnpaired === 0) return; // No unpaired electrons, no need to visualize spin state
        unpairedElectronsInfo.unpairedOrbitals.forEach(orbit => {
            let spinStateColor = Math.random() < 0.5 ? new THREE.Color(0x0000ff) : new THREE.Color(0xff0000); // Randomly choose blue or red
            const orbitalObjects = this.getOrbitals(orbit.type, orbit.level);
            if(isEnabled) {            
                orbitalObjects.forEach(orbitObject => {
                    if (orbitObject.particles && orbitObject.particles.material) {
                        console.log(orbit.probabilityUnpaired)
                        orbitObject.particles.material.fragmentShader = CelestialModel.#spinStateFragShaderCode;
                        orbitObject.particles.material.uniforms.spinStateColor = { value: spinStateColor };
                        orbitObject.particles.material.uniforms.spinStateRatio = { value: orbit.probabilityUnpaired };
                        orbitObject.particles.material.needsUpdate = true;

                    }
                });
                this.orbitals.forEach(orbit => {
                    if (orbit.particles && orbit.particles.material) {
                        orbit.particles.material.uniforms.spinStateFadeFactor = { value: CelestialModel.spinStateFadeFactor }; // Set all paired particles to a faded/muted color.
                        orbit.particles.material.needsUpdate = true;
                    }
                });
            } else {
                orbitalObjects.forEach(orbitObject => {
                    if (orbitObject.particles && orbitObject.particles.material) {
                        orbitObject.particles.material.fragmentShader = CelestialModel.#fragmentShaderCode;
                        orbitObject.particles.material.needsUpdate = true;
                    }
                });
                this.orbitals.forEach(orbit => {
                    if (orbit.particles && orbit.particles.material) {
                        orbit.particles.material.uniforms.spinStateFadeFactor = { value: 1.0 }; // Set the faded particles back to normal color.
                        orbit.particles.material.needsUpdate = true;
                    }
                });
            }
        });

        
    }
    // Returns an array of orbitals which fit the orbitalType and orbitalLevel
    getOrbitals(orbitalType, orbitalLevel) {
        orbitalType = orbitalType.toUpperCase(); // Ensure the orbital type is uppercase
        return this.orbitals.filter(orbit =>
            orbit.orbitalLevel === orbitalLevel &&
            (
                orbit.orbitalType === orbitalType ||
                (
                    // For "P", match Px, Py, Pz; for "D", match Dxy, Dxz, Dyz, Dx2y2, Dz2; for "F", match all F* orbitals
                    (orbitalType === "S" && orbit.orbitalType === "S") ||
                    (orbitalType === "P" && ["Px", "Py", "Pz"].includes(orbit.orbitalType)) ||
                    (orbitalType === "D" && ["Dxy", "Dxz", "Dyz", "Dx2y2", "Dz2"].includes(orbit.orbitalType)) ||
                    (orbitalType === "F" && orbit.orbitalType.startsWith("F"))
                )
            )
        );
    }
    getUnpairedElectrons() {
        // Maximum electrons per orbital type
        const maxElectrons = { s: 2, p: 6, d: 10, f: 14 };
        // Number of suborbitals per type
        const suborbitals = { s: 1, p: 3, d: 5, f: 7 };

        // Parse the string into [level, type, count]
        const orbitals = this.electronConfig.match(/\d+[spdf]\d+/g)
            .map(str => {
                const [, level, type, count] = str.match(/(\d+)([spdf])(\d+)/);
                return { level: parseInt(level), type, count: parseInt(count) };
            });

        let unpaired = [];
        orbitals.forEach(({ level, type, count }) => {
            const nSub = suborbitals[type];
            // Fill each suborbital with 1 before pairing (Hund's rule)
            let pairs = Math.floor(count / 2);
            let unpairedInThis = count % 2 === 0 ? 0 : 1;
            // For p, d, f, unpaired = suborbitals - pairs if not fully filled
            if (count < maxElectrons[type]) {
                // Distribute electrons singly first, then pair
                if (count <= nSub) {
                    unpairedInThis = count;
                } else {
                    unpairedInThis = nSub - (count - nSub);
                }
            } else {
                unpairedInThis = 0;
            }
            if (unpairedInThis > 0) {
                unpaired.push({ level,
                                type,
                                unpaired: unpairedInThis,
                                probabilityUnpaired: count === 0 ? 0 : unpairedInThis / count });
            }
        });
        const totalUnpaired = unpaired.reduce((sum, u) => sum + u.unpaired, 0);
        return {
            totalUnpaired,
            unpairedOrbitals: unpaired,
        };
    }
    #targetSpinState = 0.0;
    // This function is used to set the spin state of the element: 0 = no visualisation, 1 = negative spin state, 2 = positive spin state
    setSpinState(value) {
        // Set targetMode to -1 (red), 0 (off), or 1 (blue)
        this.#targetSpinState = Math.max(-1.0, Math.min(1.0, value));
    }
}
export default CelestialModel;