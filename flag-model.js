import * as THREE from 'https://cdn.skypack.dev/three@0.134.0';

export function createFlagModel() {
    // Create a group to hold all flag parts
    const flagGroup = new THREE.Group();
    
    // Create flag pole with enhanced detail
    const poleGeometry = new THREE.CylinderGeometry(0.02, 0.025, 0.5, 12);
    const poleMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x8B4513,
        roughness: 0.8,
        metalness: 0.2,
        envMapIntensity: 0.8
    });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.y = 0.25;
    pole.castShadow = true;
    
    // Add wood grain texture to pole
    addWoodGrainToGeometry(poleGeometry);
    flagGroup.add(pole);
    
    // Create flag base with more detail
    const baseGeometry = new THREE.CylinderGeometry(0.08, 0.1, 0.05, 16);
    const baseMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x555555,
        roughness: 0.7,
        metalness: 0.5,
        envMapIntensity: 1.0
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 0.025;
    base.castShadow = true;
    
    // Add ridge details to base
    const baseDetailGeometry = new THREE.TorusGeometry(0.09, 0.01, 8, 24);
    const baseDetailMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x444444,
        roughness: 0.6,
        metalness: 0.7
    });
    const baseDetail = new THREE.Mesh(baseDetailGeometry, baseDetailMaterial);
    baseDetail.position.y = 0.03;
    baseDetail.rotation.x = Math.PI / 2;
    base.add(baseDetail);
    
    flagGroup.add(base);
    
    // Add a rivet to the top of the pole
    const rivetGeometry = new THREE.SphereGeometry(0.025, 8, 8);
    const rivetMaterial = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.5,
        metalness: 0.7
    });
    const rivet = new THREE.Mesh(rivetGeometry, rivetMaterial);
    rivet.position.y = 0.5;
    rivet.castShadow = true;
    flagGroup.add(rivet);
    
    // Create flag cloth with higher detail
    const clothGeometry = new THREE.PlaneGeometry(0.3, 0.2, 20, 10);
    const clothMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xCC0000,
        roughness: 0.8,
        metalness: 0.0,
        side: THREE.DoubleSide,
        envMapIntensity: 0.7
    });
    
    // Add cloth texture for more realism
    addClothTextureToMaterial(clothMaterial);
    
    const cloth = new THREE.Mesh(clothGeometry, clothMaterial);
    cloth.position.set(0.15, 0.4, 0);
    cloth.castShadow = true;
    
    // Add initial wave shape to the cloth
    const vertices = clothGeometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const y = vertices[i + 1];
        
        // Only waves for points not on the pole
        if (x > 0) {
            vertices[i + 2] = Math.sin(x * 20) * 0.01 * x * x + 
                             Math.cos(y * 15) * 0.01 * x;
        }
    }
    clothGeometry.computeVertexNormals();
    
    // Store animation data with improved parameters
    cloth.userData = {
        animation: {
            time: Math.random() * Math.PI * 2, // Random start phase
            amplitude: 0.015,
            frequency: 3.5,
            noiseScale: 0.5,  // For more natural movement
            waveSpeed: 2.0    // Speed of wave propagation
        },
        vertices: Array.from(vertices) // Store original positions
    };
    
    flagGroup.add(cloth);
    
    // Add subtle emblem to the flag
    addEmblemToFlag(cloth);
    
    // Add rippling animation to the entire flag
    flagGroup.userData = {
        bobAnimation: {
            time: Math.random() * Math.PI * 2,
            amplitude: 0.02,
            frequency: 1.5
        }
    };
    
    return flagGroup;
}

function addWoodGrainToGeometry(geometry) {
    // Add subtle wood grain effect to the pole
    const vertices = geometry.attributes.position.array;
    const radius = 0.02;
    
    for (let i = 0; i < vertices.length; i += 3) {
        const y = vertices[i + 1];
        
        // Add subtle longitudinal ridges
        const angle = Math.atan2(vertices[i], vertices[i + 2]);
        const noiseScale = 0.002;
        const noise = (Math.sin(angle * 8) * Math.sin(y * 50)) * noiseScale;
        
        // Apply noise as small displacement along radius
        const distFromCenter = Math.sqrt(vertices[i] * vertices[i] + vertices[i + 2] * vertices[i + 2]);
        if (distFromCenter > 0) {
            const normalizedX = vertices[i] / distFromCenter;
            const normalizedZ = vertices[i + 2] / distFromCenter;
            
            vertices[i] += normalizedX * noise;
            vertices[i + 2] += normalizedZ * noise;
        }
    }
    
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
}

function addClothTextureToMaterial(material) {
    // Create canvas for cloth texture
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 256;
    
    // Fill with base color
    ctx.fillStyle = '#cc0000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add subtle fabric pattern
    ctx.fillStyle = '#bb0000';
    ctx.globalAlpha = 0.4;
    
    // Horizontal threads
    for (let y = 0; y < canvas.height; y += 2) {
        ctx.fillRect(0, y, canvas.width, 1);
    }
    
    // Vertical threads
    for (let x = 0; x < canvas.width; x += 2) {
        ctx.fillRect(x, 0, 1, canvas.height);
    }
    
    // Add some random variations
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 5000; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const size = Math.random() * 2 + 0.5;
        ctx.fillRect(x, y, size, size);
    }
    
    // Create texture
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 2);
    
    material.map = texture;
}

function addEmblemToFlag(cloth) {
    // Create a simple emblem for the flag
    const emblemGeometry = new THREE.CircleGeometry(0.07, 16);
    const emblemMaterial = new THREE.MeshBasicMaterial({
        color: 0xFFFFFF,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
    });
    
    const emblem = new THREE.Mesh(emblemGeometry, emblemMaterial);
    emblem.position.set(0.15, 0, 0.002);
    emblem.rotation.y = Math.PI / 2;
    
    // Add star shape inside
    const starGeometry = new THREE.BufferGeometry();
    const starPoints = [];
    const starRadius = 0.05;
    const starInnerRadius = 0.02;
    const starPoints2 = 5;
    
    for (let i = 0; i < starPoints2 * 2; i++) {
        const radius = i % 2 === 0 ? starRadius : starInnerRadius;
        const angle = (i / starPoints2) * Math.PI;
        starPoints.push(
            Math.cos(angle) * radius, 
            Math.sin(angle) * radius,
            0.003
        );
    }
    
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPoints, 3));
    const starMaterial = new THREE.LineBasicMaterial({ color: 0xCC0000 });
    const star = new THREE.Line(starGeometry, starMaterial);
    
    emblem.add(star);
    cloth.add(emblem);
}

export function updateFlagAnimation(flag, deltaTime) {
    // Apply bobbing animation to the entire flag
    if (flag.userData.bobAnimation) {
        const anim = flag.userData.bobAnimation;
        anim.time += deltaTime * anim.frequency;
        
        // Make the flag gently bob up and down
        flag.position.y = Math.sin(anim.time) * anim.amplitude;
        
        // Slight swaying rotation
        flag.rotation.z = Math.sin(anim.time * 0.8) * 0.02;
    }
    
    // Find the cloth part (flag)
    const cloth = flag.children.find(child => 
        child.geometry && child.geometry.type === 'PlaneGeometry');
    
    if (cloth && cloth.userData.animation) {
        // Update animation time
        const anim = cloth.userData.animation;
        anim.time += deltaTime * anim.frequency;
        
        // Create natural waving effect with multiple wave components
        const vertices = cloth.geometry.attributes.position.array;
        const originalVertices = cloth.userData.vertices;
        
        for (let i = 0; i < vertices.length; i += 3) {
            // Only affect vertices that are not on the left edge (attached to pole)
            const x = originalVertices[i];
            if (x > 0) {
                const y = originalVertices[i + 1];
                
                // Create wave pattern with multiple sine waves for natural movement
                const waveTime = anim.time * anim.waveSpeed;
                
                // Primary wave
                const wave1 = Math.sin(waveTime + x * 10) * 
                              Math.cos(waveTime * 0.5 + y * 5) * 
                              anim.amplitude * x * 2;
                              
                // Secondary wave (higher frequency, smaller amplitude)
                const wave2 = Math.sin(waveTime * 1.5 + x * 20) * 
                              Math.cos(waveTime * 0.7 + y * 8) * 
                              anim.amplitude * x * 0.5;
                              
                // Add some noise based on position for natural fluttering
                const noise = (Math.sin(x * 50 + waveTime) * Math.cos(y * 40 + waveTime * 0.8)) * 
                               anim.noiseScale * anim.amplitude * x;
                
                // Combine all effects
                const displacement = wave1 + wave2 + noise;
                
                // Apply displacement to z coordinate
                vertices[i + 2] = displacement;
                
                // Slight x displacement for more realistic cloth behavior
                vertices[i] = originalVertices[i] + noise * 0.1;
            }
        }
        
        // Update geometry
        cloth.geometry.attributes.position.needsUpdate = true;
        cloth.geometry.computeVertexNormals();
    }
} 