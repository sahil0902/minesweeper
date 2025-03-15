import * as THREE from 'https://cdn.skypack.dev/three@0.134.0';

export function createFlagModel() {
    // Create a group to hold all flag parts
    const flagGroup = new THREE.Group();
    
    // Create flag pole
    const poleGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8);
    const poleMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x8B4513,
        roughness: 0.8,
        metalness: 0.2
    });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.y = 0.25;
    pole.castShadow = true;
    flagGroup.add(pole);
    
    // Create flag base
    const baseGeometry = new THREE.CylinderGeometry(0.08, 0.1, 0.05, 16);
    const baseMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x555555,
        roughness: 0.7,
        metalness: 0.5
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 0.025;
    base.castShadow = true;
    flagGroup.add(base);
    
    // Create flag cloth
    const clothGeometry = new THREE.PlaneGeometry(0.3, 0.2);
    const clothMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xFF0000,
        roughness: 0.8,
        metalness: 0.0,
        side: THREE.DoubleSide,
    });
    const cloth = new THREE.Mesh(clothGeometry, clothMaterial);
    cloth.position.set(0.15, 0.4, 0);
    cloth.castShadow = true;
    
    // Store animation data
    cloth.userData = {
        animation: {
            time: 0,
            amplitude: 0.01,
            frequency: 3
        }
    };
    
    flagGroup.add(cloth);
    
    return flagGroup;
}

export function updateFlagAnimation(flag, deltaTime) {
    // Find the cloth part (flag)
    const cloth = flag.children.find(child => 
        child.geometry && child.geometry.type === 'PlaneGeometry');
    
    if (cloth && cloth.userData.animation) {
        // Update animation time
        cloth.userData.animation.time += deltaTime * cloth.userData.animation.frequency;
        
        // Create waving effect
        for (let i = 0; i < cloth.geometry.attributes.position.count; i++) {
            // Only affect vertices that are not on the left edge (attached to pole)
            if (cloth.geometry.attributes.position.getX(i) > 0) {
                // Create wave pattern based on x and y position
                const xPos = cloth.geometry.attributes.position.getX(i);
                const yPos = cloth.geometry.attributes.position.getY(i);
                
                // Calculate wave displacement
                const displacement = 
                    Math.sin(cloth.userData.animation.time + xPos * 10) * 
                    Math.cos(cloth.userData.animation.time * 0.5 + yPos * 5) * 
                    cloth.userData.animation.amplitude * xPos * 2;
                
                // Apply displacement to z coordinate
                cloth.geometry.attributes.position.setZ(i, displacement);
            }
        }
        
        // Update geometry
        cloth.geometry.attributes.position.needsUpdate = true;
        cloth.geometry.computeVertexNormals();
    }
} 