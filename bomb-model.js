import * as THREE from 'https://cdn.skypack.dev/three@0.134.0';

export function createBombModel() {
    // Create a group to hold all bomb parts
    const bombGroup = new THREE.Group();
    
    // Create the main body of the bomb (sphere)
    const bombGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const bombMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x111111,
        roughness: 0.7,
        metalness: 0.5
    });
    const bombBody = new THREE.Mesh(bombGeometry, bombMaterial);
    bombGroup.add(bombBody);
    
    // Create the fuse on top
    const fuseGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8);
    const fuseMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x8B4513,
        roughness: 1.0,
        metalness: 0.0
    });
    const fuse = new THREE.Mesh(fuseGeometry, fuseMaterial);
    fuse.position.y = 0.3;
    bombGroup.add(fuse);
    
    // Create the spark at the top of the fuse
    const sparkGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const sparkMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xFF4500,
        emissive: 0xFF4500,
        emissiveIntensity: 1
    });
    const spark = new THREE.Mesh(sparkGeometry, sparkMaterial);
    spark.position.y = 0.45;
    
    // Add animation data to the spark
    spark.userData = {
        originalY: 0.45,
        animation: {
            speedY: 0.005,
            maxOffset: 0.03
        }
    };
    
    bombGroup.add(spark);
    
    // Add highlights to the bomb (reflective spots)
    const highlightGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const highlightMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xFFFFFF,
        transparent: true,
        opacity: 0.7
    });
    
    // Add top highlight
    const topHighlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
    topHighlight.position.set(0.15, 0.15, 0.15);
    bombGroup.add(topHighlight);
    
    // Add bottom highlight
    const bottomHighlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
    bottomHighlight.position.set(-0.1, -0.1, 0.2);
    bottomHighlight.scale.set(0.7, 0.7, 0.7);
    bombGroup.add(bottomHighlight);
    
    // Cast shadows for all parts
    bombBody.castShadow = true;
    fuse.castShadow = true;
    
    return bombGroup;
}

export function updateBombAnimation(bomb, deltaTime) {
    // Animate the spark
    const spark = bomb.children.find(child => child.material && child.material.emissive);
    
    if (spark && spark.userData.animation) {
        const { originalY, animation } = spark.userData;
        spark.position.y += animation.speedY;
        
        // Reverse direction if reached limits
        if (spark.position.y > originalY + animation.maxOffset || 
            spark.position.y < originalY - animation.maxOffset) {
            animation.speedY *= -1;
        }
        
        // Make the spark flicker
        const flickerIntensity = 0.7 + Math.random() * 0.3;
        spark.material.emissiveIntensity = flickerIntensity;
    }
}

export function createExplosionEffect(position) {
    const group = new THREE.Group();
    group.position.copy(position);
    
    // Create the explosion flash
    const flashGeometry = new THREE.SphereGeometry(0.5, 16, 16);
    const flashMaterial = new THREE.MeshBasicMaterial({
        color: 0xFFFF00,
        transparent: true,
        opacity: 0.8
    });
    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
    group.add(flash);
    
    // Add explosion data
    group.userData = {
        age: 0,
        maxAge: 1, // in seconds
        flash: flash
    };
    
    // Create particle system for smoke and debris
    const particleCount = 50;
    const particles = [];
    
    for (let i = 0; i < particleCount; i++) {
        const size = 0.03 + Math.random() * 0.05;
        const geometry = new THREE.SphereGeometry(size, 8, 8);
        
        // Random color for particles
        const color = new THREE.Color();
        const hue = i < particleCount / 3 ? 0.05 : 0.1; // First third are fire colored, rest are smoke
        const saturation = i < particleCount / 3 ? 0.8 : 0.2;
        const lightness = i < particleCount / 3 ? 0.5 : 0.3;
        color.setHSL(hue, saturation, lightness);
        
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true
        });
        
        const particle = new THREE.Mesh(geometry, material);
        particle.position.set(0, 0, 0);
        
        // Random velocity
        const speed = 0.05 + Math.random() * 0.15;
        const angle = Math.random() * Math.PI * 2;
        const height = Math.random() * 0.1;
        
        particle.userData = {
            velocity: new THREE.Vector3(
                Math.cos(angle) * speed,
                height + Math.random() * 0.2,
                Math.sin(angle) * speed
            ),
            spin: new THREE.Vector3(
                Math.random() * 0.2 - 0.1,
                Math.random() * 0.2 - 0.1,
                Math.random() * 0.2 - 0.1
            )
        };
        
        group.add(particle);
        particles.push(particle);
    }
    
    group.userData.particles = particles;
    
    return group;
}

export function updateExplosionEffect(explosion, deltaTime) {
    if (!explosion || !explosion.userData) return false;
    
    explosion.userData.age += deltaTime;
    
    if (explosion.userData.age > explosion.userData.maxAge) {
        return false; // Signal to remove the explosion
    }
    
    // Calculate progress from 0 to 1
    const progress = explosion.userData.age / explosion.userData.maxAge;
    
    // Update flash
    if (explosion.userData.flash) {
        explosion.userData.flash.material.opacity = 0.8 * (1 - progress);
        explosion.userData.flash.scale.set(1 + progress, 1 + progress, 1 + progress);
    }
    
    // Update particles
    if (explosion.userData.particles) {
        explosion.userData.particles.forEach(particle => {
            // Apply velocity
            particle.position.add(particle.userData.velocity);
            
            // Apply gravity
            particle.userData.velocity.y -= 0.01;
            
            // Apply rotation
            particle.rotation.x += particle.userData.spin.x;
            particle.rotation.y += particle.userData.spin.y;
            particle.rotation.z += particle.userData.spin.z;
            
            // Fade out based on progress
            particle.material.opacity = 1 - progress;
        });
    }
    
    return true; // Explosion is still active
} 