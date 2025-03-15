import * as THREE from 'https://cdn.skypack.dev/three@0.134.0';
import { EffectComposer } from 'https://cdn.skypack.dev/three@0.134.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.skypack.dev/three@0.134.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.skypack.dev/three@0.134.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'https://cdn.skypack.dev/three@0.134.0/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'https://cdn.skypack.dev/three@0.134.0/examples/jsm/shaders/FXAAShader.js';

// Post-processing setup
export function setupPostProcessing(scene, camera, renderer) {
    // Create effect composer
    const composer = new EffectComposer(renderer);
    
    // Add render pass
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    
    // Add bloom effect
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.5,    // strength
        0.4,    // radius
        0.85    // threshold
    );
    composer.addPass(bloomPass);
    
    // Add FXAA anti-aliasing
    const fxaaPass = new ShaderPass(FXAAShader);
    fxaaPass.material.uniforms['resolution'].value.set(
        1 / window.innerWidth, 
        1 / window.innerHeight
    );
    composer.addPass(fxaaPass);
    
    // Return composer for use in render loop
    return {
        composer,
        bloomPass,
        fxaaPass,
        resize: () => {
            composer.setSize(window.innerWidth, window.innerHeight);
            fxaaPass.material.uniforms['resolution'].value.set(
                1 / window.innerWidth, 
                1 / window.innerHeight
            );
        }
    };
}

// Enhanced lighting setup
export function createEnhancedLighting(scene) {
    // Check if we're on mobile for simplified lighting
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
    
    // Clear existing lights
    scene.children.forEach(child => {
        if (child.isLight) scene.remove(child);
    });
    
    // Add ambient light - reduced intensity
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    scene.add(ambientLight);
    
    // Add main directional light (sun) - reduced intensity
    const sunLight = new THREE.DirectionalLight(0xffffff, isMobile ? 0.7 : 0.9);
    sunLight.position.set(10, 20, 15);
    sunLight.castShadow = !isMobile; // Disable shadows on mobile for performance
    
    // Enhance shadow quality based on device
    if (isMobile) {
        sunLight.shadow.mapSize.width = 1024;
        sunLight.shadow.mapSize.height = 1024;
    } else {
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
    }
    
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 50;
    sunLight.shadow.camera.left = -20;
    sunLight.shadow.camera.right = 20;
    sunLight.shadow.camera.top = 20;
    sunLight.shadow.camera.bottom = -20;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    
    scene.add(sunLight);
    
    // Add fill light - reduced intensity
    const fillLight = new THREE.DirectionalLight(0x8088ff, 0.3);
    fillLight.position.set(-10, 10, -10);
    fillLight.castShadow = false; // Disable shadows for performance
    scene.add(fillLight);
    
    // Add spotlight for dramatic effect - reduced intensity
    const spotLight = new THREE.SpotLight(0xffa95c, isMobile ? 0.5 : 0.7);
    spotLight.position.set(0, 15, 0);
    spotLight.angle = Math.PI / 6;
    spotLight.penumbra = 0.2;
    spotLight.decay = 2;
    spotLight.distance = 50;
    spotLight.castShadow = !isMobile; // Disable shadow on mobile
    
    if (!isMobile) {
        spotLight.shadow.mapSize.width = 1024;
        spotLight.shadow.mapSize.height = 1024;
    }
    
    scene.add(spotLight);
    
    return { sunLight, fillLight, spotLight };
}

// Enhanced materials
export function createEnhancedMaterials() {
    // Cell materials
    const cellMaterials = {
        default: new THREE.MeshStandardMaterial({
            color: 0xc8e6e6,
            roughness: 0.3,
            metalness: 0.2,
            envMapIntensity: 1.5
        }),
        revealed: new THREE.MeshStandardMaterial({
            color: 0x9dc5c7,
            roughness: 0.7,
            metalness: 0.1,
            envMapIntensity: 1.0
        }),
        bomb: new THREE.MeshStandardMaterial({
            color: 0xf1754e,
            roughness: 0.5,
            metalness: 0.3,
            emissive: 0x331000,
            emissiveIntensity: 0.2,
            envMapIntensity: 1.2
        })
    };
    
    // Base material
    const baseMaterial = new THREE.MeshStandardMaterial({
        color: 0x333344,
        roughness: 0.6,
        metalness: 0.4,
        envMapIntensity: 1.2
    });
    
    // Ground material
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x265151,
        roughness: 0.8,
        metalness: 0.1,
        envMapIntensity: 0.8
    });
    
    return { cellMaterials, baseMaterial, groundMaterial };
}

// Create environment map
export async function createEnvironmentMap(renderer, scene) {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    
    // Create simple environment 
    const envScene = new THREE.Scene();
    const gradientTexture = createGradientTexture();
    const skyMaterial = new THREE.MeshBasicMaterial({ 
        map: gradientTexture, 
        side: THREE.BackSide 
    });
    const skySphere = new THREE.Mesh(
        new THREE.SphereGeometry(50, 32, 32),
        skyMaterial
    );
    envScene.add(skySphere);
    
    // Generate environment map
    const renderTarget = pmremGenerator.fromScene(envScene);
    const envMap = renderTarget.texture;
    
    // Set environment map for scene
    scene.environment = envMap;
    
    return envMap;
}

// Create a gradient sky texture
function createGradientTexture() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = 512;
    canvas.height = 512;
    
    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#1e3c72');
    gradient.addColorStop(0.5, '#2a5298');
    gradient.addColorStop(1, '#7db9e8');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add stars to the sky
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 200; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height * 0.5; // Stars only in top half
        const size = Math.random() * 1.5;
        ctx.globalAlpha = Math.random() * 0.8 + 0.2;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    
    return texture;
}

// Particle system for ambient effects
export function createAmbientParticles() {
    const particleCount = 500;
    const particles = new THREE.Group();
    
    const geometry = new THREE.SphereGeometry(0.03, 8, 8);
    const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.4
    });
    
    for (let i = 0; i < particleCount; i++) {
        const particle = new THREE.Mesh(geometry, material.clone());
        
        // Random position in a volume above the board
        particle.position.set(
            (Math.random() - 0.5) * 30,
            Math.random() * 15 + 5,
            (Math.random() - 0.5) * 30
        );
        
        // Add animation data
        particle.userData = {
            speed: Math.random() * 0.02 + 0.005,
            rotationSpeed: Math.random() * 0.01,
            originalY: particle.position.y,
            amplitude: Math.random() * 0.2 + 0.1,
            phase: Math.random() * Math.PI * 2
        };
        
        particles.add(particle);
    }
    
    // Update function for animation
    particles.userData = {
        update: (time) => {
            particles.children.forEach(particle => {
                // Slow drift in Y direction
                particle.position.y = particle.userData.originalY + 
                    Math.sin(time * particle.userData.speed + particle.userData.phase) * 
                    particle.userData.amplitude;
                
                // Slow rotation
                particle.rotation.y += particle.userData.rotationSpeed;
                
                // Opacity pulsing
                particle.material.opacity = 0.3 + 
                    Math.sin(time * 2 + particle.userData.phase) * 0.2;
            });
        }
    };
    
    return particles;
}

// Water effect for enhanced environment
export function createWater(size = 100) {
    // Create water plane
    const waterGeometry = new THREE.PlaneGeometry(size, size, 32, 32);
    
    // Update vertices for wave effect
    const vertices = waterGeometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const z = vertices[i + 2];
        // Add small height variations to create initial waves
        vertices[i + 1] = Math.sin(x * 0.5) * 0.2 + Math.cos(z * 0.5) * 0.2;
    }
    
    // Update normals
    waterGeometry.computeVertexNormals();
    
    // Create custom water material
    const waterMaterial = new THREE.MeshStandardMaterial({
        color: 0x0077be,
        roughness: 0.1,
        metalness: 0.8,
        transparent: true,
        opacity: 0.8
    });
    
    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -3;
    
    // Animation function
    water.userData = {
        time: 0,
        update: (deltaTime) => {
            water.userData.time += deltaTime;
            
            const time = water.userData.time;
            const vertices = water.geometry.attributes.position.array;
            
            for (let i = 0; i < vertices.length; i += 3) {
                const x = vertices[i];
                const z = vertices[i + 2];
                
                // Create dynamic wave pattern
                vertices[i + 1] = 
                    Math.sin(x * 0.5 + time) * 0.2 + 
                    Math.cos(z * 0.5 + time * 0.8) * 0.2;
            }
            
            water.geometry.attributes.position.needsUpdate = true;
            water.geometry.computeVertexNormals();
        }
    };
    
    return water;
} 