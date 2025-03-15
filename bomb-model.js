import * as THREE from 'https://cdn.skypack.dev/three@0.134.0';

export function createBombModel() {
    // Create a group to hold all bomb parts
    const bombGroup = new THREE.Group();
    
    // Create the main body of the bomb (sphere)
    const bombGeometry = new THREE.SphereGeometry(0.3, 24, 24);
    const bombMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x151515,
        roughness: 0.6,
        metalness: 0.7,
        envMapIntensity: 1.0
    });
    const bombBody = new THREE.Mesh(bombGeometry, bombMaterial);
    bombGroup.add(bombBody);
    
    // Add detailed ridges to the bomb
    const ridgeGeometry = new THREE.TorusGeometry(0.3, 0.02, 16, 24);
    const ridgeMaterial = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.7,
        metalness: 0.3
    });
    
    // Add multiple ridges at different rotations
    for (let i = 0; i < 3; i++) {
        const ridge = new THREE.Mesh(ridgeGeometry, ridgeMaterial);
        ridge.rotation.x = Math.PI / 2 * i;
        ridge.rotation.y = Math.PI / 4 * i;
        bombGroup.add(ridge);
    }
    
    // Create the fuse on top
    const fuseGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.25, 12);
    const fuseMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x8B4513,
        roughness: 1.0,
        metalness: 0.0,
        envMapIntensity: 0.5
    });
    const fuse = new THREE.Mesh(fuseGeometry, fuseMaterial);
    fuse.position.y = 0.33;
    
    // Add twist to the fuse
    const vertices = fuse.geometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
        const y = vertices[i + 1];
        const angle = y * 2;
        const radius = 0.01;
        vertices[i] += Math.sin(angle) * radius;
        vertices[i + 2] += Math.cos(angle) * radius;
    }
    fuse.geometry.attributes.position.needsUpdate = true;
    fuse.geometry.computeVertexNormals();
    
    bombGroup.add(fuse);
    
    // Create the fuse cap
    const capGeometry = new THREE.CylinderGeometry(0.05, 0.03, 0.05, 12);
    const capMaterial = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.5,
        metalness: 0.8
    });
    const fuseCap = new THREE.Mesh(capGeometry, capMaterial);
    fuseCap.position.y = 0.2;
    bombGroup.add(fuseCap);
    
    // Create the spark at the top of the fuse
    const sparkGeometry = new THREE.SphereGeometry(0.05, 16, 16);
    const sparkMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xFF4500,
        emissive: 0xFF4500,
        emissiveIntensity: 1.5,
        roughness: 0.3,
        metalness: 0.0
    });
    const spark = new THREE.Mesh(sparkGeometry, sparkMaterial);
    spark.position.y = 0.47;
    
    // Add animation data to the spark
    spark.userData = {
        originalY: 0.47,
        animation: {
            speedY: 0.005,
            maxOffset: 0.03
        }
    };
    
    bombGroup.add(spark);
    
    // Add glow around the spark
    const glowGeometry = new THREE.SphereGeometry(0.08, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0xFF8000,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.y = 0.47;
    bombGroup.add(glow);
    
    // Add spark light
    const sparkLight = new THREE.PointLight(0xFF4500, 1.5, 2);
    sparkLight.position.y = 0.47;
    sparkLight.name = 'sparkLight';
    bombGroup.add(sparkLight);
    
    // Add highlights to the bomb (reflective spots)
    const highlightGeometry = new THREE.SphereGeometry(0.05, 12, 12);
    const highlightMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xFFFFFF,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending
    });
    
    // Add top highlight
    const topHighlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
    topHighlight.position.set(0.18, 0.18, 0.18);
    topHighlight.scale.set(0.7, 0.7, 0.7);
    bombGroup.add(topHighlight);
    
    // Add bottom highlight
    const bottomHighlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
    bottomHighlight.position.set(-0.12, -0.12, 0.22);
    bottomHighlight.scale.set(0.5, 0.5, 0.5);
    bombGroup.add(bottomHighlight);
    
    // Cast shadows for all parts
    bombBody.castShadow = true;
    fuse.castShadow = true;
    
    // Add a subtle animation to the entire bomb
    bombGroup.userData = {
        rotationSpeed: {
            x: (Math.random() - 0.5) * 0.01,
            y: (Math.random() - 0.5) * 0.01,
            z: (Math.random() - 0.5) * 0.01
        },
        originalPosition: bombGroup.position.clone(),
        originalScale: bombGroup.scale.clone(),
        hoverAnimation: {
            time: Math.random() * Math.PI * 2,
            frequency: 1 + Math.random(),
            amplitude: 0.05 + Math.random() * 0.05
        }
    };
    
    return bombGroup;
}

export function updateBombAnimation(bomb, deltaTime) {
    // Apply subtle rotation
    if (bomb.userData.rotationSpeed) {
        bomb.rotation.x += bomb.userData.rotationSpeed.x;
        bomb.rotation.y += bomb.userData.rotationSpeed.y;
        bomb.rotation.z += bomb.userData.rotationSpeed.z;
    }
    
    // Apply hover animation
    if (bomb.userData.hoverAnimation) {
        const anim = bomb.userData.hoverAnimation;
        anim.time += deltaTime * anim.frequency;
        
        // Subtle floating movement
        bomb.position.y = bomb.userData.originalPosition.y + 
                          Math.sin(anim.time) * anim.amplitude;
                          
        // Subtle pulsing
        const scale = 1 + Math.sin(anim.time * 1.5) * 0.03;
        bomb.scale.set(scale, scale, scale);
    }
    
    // Animate the spark
    const spark = bomb.children.find(child => 
        child.material && child.material.emissive && 
        child.material.emissive.r > 0.9);
    
    if (spark && spark.userData.animation) {
        const { originalY, animation } = spark.userData;
        spark.position.y += animation.speedY;
        
        // Reverse direction if reached limits
        if (spark.position.y > originalY + animation.maxOffset || 
            spark.position.y < originalY - animation.maxOffset) {
            animation.speedY *= -1;
        }
        
        // Make the spark flicker
        const flickerIntensity = 1.0 + Math.random() * 1.0;
        spark.material.emissiveIntensity = flickerIntensity;
        
        // Update spark light
        const sparkLight = bomb.getObjectByName('sparkLight');
        if (sparkLight) {
            sparkLight.intensity = 1.0 + Math.random() * 1.0;
            sparkLight.position.copy(spark.position);
        }
        
        // Update glow
        const glow = bomb.children.find(child => 
            child.material && child.material.transparent && 
            child.material.blending === THREE.AdditiveBlending);
            
        if (glow) {
            glow.position.copy(spark.position);
            glow.material.opacity = 0.3 + Math.random() * 0.3;
            
            // Pulse the glow size
            const glowPulse = 1 + Math.sin(Date.now() * 0.01) * 0.2;
            glow.scale.set(glowPulse, glowPulse, glowPulse);
        }
    }
}

export function createExplosionEffect(position) {
    // Create a container for the explosion that won't affect the game board
    const explosionContainer = new THREE.Group();
    explosionContainer.position.copy(position);
    
    // Detect mobile directly inside this function instead of using global variable
    const isCurrentDeviceMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
    
    // Store container's original position for reference
    explosionContainer.userData = {
        originalPosition: position.clone(),
        age: 0,
        maxAge: isCurrentDeviceMobile ? 1.5 : 2.0, // Shorter on mobile
        // Store the mobile detection result
        isMobile: isCurrentDeviceMobile
    };
    
    // Flash
    const flashGeometry = new THREE.SphereGeometry(0.5, 16, 16);
    const flashMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });
    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
    // Add to the container rather than directly to the scene
    explosionContainer.add(flash);
    
    // Create shockwave
    const shockwaveSize = explosionContainer.userData.isMobile ? 32 : 64;
    const shockwaveGeometry = new THREE.RingGeometry(0.1, 0.5, shockwaveSize, 1);
    const shockwaveMaterial = new THREE.MeshBasicMaterial({
        color: 0xff9500,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
    });
    const shockwave = new THREE.Mesh(shockwaveGeometry, shockwaveMaterial);
    shockwave.rotation.x = -Math.PI / 2; // Rotate to horizontal plane
    // Add to container rather than directly modifying scene
    explosionContainer.add(shockwave);
    
    // Create particles
    const particleCount = explosionContainer.userData.isMobile ? 20 : 80; // Fewer on mobile
    
    for (let i = 0; i < particleCount; i++) {
        // Determine particle type - some are fire, some are smoke, some are debris
        const particleType = Math.random() < 0.4 ? 'fire' : (Math.random() < 0.7 ? 'smoke' : 'debris');
        
        // Create geometry based on type
        let particleGeometry;
        
        if (particleType === 'debris') {
            // Use simpler geometry for mobile
            particleGeometry = explosionContainer.userData.isMobile ? 
                new THREE.TetrahedronGeometry(0.05 + Math.random() * 0.1, 0) : 
                new THREE.TetrahedronGeometry(0.05 + Math.random() * 0.1, 1);
        } else {
            // Simpler sphere for mobile
            const sphereDetail = explosionContainer.userData.isMobile ? 4 : 8;
            particleGeometry = new THREE.SphereGeometry(
                0.05 + Math.random() * 0.1, 
                sphereDetail, 
                sphereDetail
            );
        }
        
        // Create material based on type
        let particleMaterial;
        
        if (explosionContainer.userData.isMobile) {
            // Use MeshBasicMaterial for mobile for better performance
            if (particleType === 'fire') {
                particleMaterial = new THREE.MeshBasicMaterial({
                    color: new THREE.Color(0xff5500),
                    transparent: true,
                    opacity: 0.8
                });
            } else if (particleType === 'smoke') {
                particleMaterial = new THREE.MeshBasicMaterial({
                    color: new THREE.Color(0x222222),
                    transparent: true,
                    opacity: 0.6
                });
            } else {
                particleMaterial = new THREE.MeshBasicMaterial({
                    color: new THREE.Color(0x777777),
                    transparent: true,
                    opacity: 0.9
                });
            }
        } else {
            // Use MeshStandardMaterial for desktop for better visuals
            if (particleType === 'fire') {
                particleMaterial = new THREE.MeshStandardMaterial({
                    color: new THREE.Color(0xff5500),
                    emissive: new THREE.Color(0xff2200),
                    emissiveIntensity: 0.5,
                    transparent: true,
                    opacity: 0.8
                });
            } else if (particleType === 'smoke') {
                particleMaterial = new THREE.MeshStandardMaterial({
                    color: new THREE.Color(0x222222),
                    transparent: true,
                    opacity: 0.6
                });
            } else {
                particleMaterial = new THREE.MeshStandardMaterial({
                    color: new THREE.Color(0x777777),
                    metalness: 0.7,
                    roughness: 0.3,
                    transparent: true,
                    opacity: 0.9
                });
            }
        }
        
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        
        // Random initial position within a small sphere
        const offset = new THREE.Vector3(
            (Math.random() - 0.5) * 0.2,
            (Math.random() - 0.5) * 0.2,
            (Math.random() - 0.5) * 0.2
        );
        particle.position.copy(offset);
        
        // Calculate velocity vector - slightly lower velocity on mobile
        const velocityMultiplier = explosionContainer.userData.isMobile ? 2 : 3;
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * velocityMultiplier,
            Math.random() * velocityMultiplier,
            (Math.random() - 0.5) * velocityMultiplier
        );
        
        // Store velocity and other data with the particle
        particle.userData = {
            velocity: velocity,
            drag: 0.98, // Air resistance
            gravity: 0.15, // Gravity strength
            age: 0,
            maxAge: 0.5 + Math.random() * 1.5,
            type: particleType
        };
        
        // Add to container rather than directly to scene
        explosionContainer.add(particle);
    }
    
    // Create a point light for illumination
    const light = new THREE.PointLight(0xff7700, 2, 5);
    light.position.set(0, 0.5, 0);
    explosionContainer.add(light);
    
    // Add secondary flash with delay (for desktop only)
    if (!explosionContainer.userData.isMobile) {
        setTimeout(() => {
            const secondaryFlash = new THREE.PointLight(0xff5500, 1.5, 6);
            secondaryFlash.position.set(0, 0.2, 0);
            explosionContainer.add(secondaryFlash);
            
            // Track for removal
            explosionContainer.userData.secondaryFlash = secondaryFlash;
        }, 100);
    }
    
    return explosionContainer;
}

export function updateExplosionEffect(explosion, deltaTime) {
    if (!explosion || !explosion.userData) return false;
    
    explosion.userData.age += deltaTime;
    
    if (explosion.userData.age >= explosion.userData.maxAge) {
        // Make sure to properly dispose of all geometries and materials
        explosion.children.forEach(child => {
            if (child.geometry) {
                child.geometry.dispose();
            }
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => mat.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
        return false; // Effect is finished
    }
    
    // Calculate progress as a value from 0 to 1
    const progress = explosion.userData.age / explosion.userData.maxAge;
    
    // Update flash
    if (explosion.children[0]) {
        const flash = explosion.children[0];
        flash.scale.set(
            1 + progress * 3,
            1 + progress * 3,
            1 + progress * 3
        );
        
        if (flash.material) {
            flash.material.opacity = Math.max(0, 0.8 - progress * 2);
        }
    }
    
    // Update shockwave
    if (explosion.children[1]) {
        const shockwave = explosion.children[1];
        shockwave.scale.set(
            1 + progress * 5,
            1 + progress * 5,
            1 + progress * 5
        );
        
        if (shockwave.material) {
            shockwave.material.opacity = Math.max(0, 0.6 - progress * 1.5);
        }
    }
    
    // Update particles (starting from index 2 since 0 is flash and 1 is shockwave)
    for (let i = 2; i < explosion.children.length; i++) {
        const particle = explosion.children[i];
        
        // Skip non-particle objects like lights
        if (!particle.userData || !particle.userData.velocity) continue;
        
        // Apply velocity
        particle.position.x += particle.userData.velocity.x * deltaTime;
        particle.position.y += particle.userData.velocity.y * deltaTime;
        particle.position.z += particle.userData.velocity.z * deltaTime;
        
        // Apply drag (air resistance)
        particle.userData.velocity.multiplyScalar(particle.userData.drag);
        
        // Apply gravity
        particle.userData.velocity.y -= particle.userData.gravity * deltaTime;
        
        // Age the particle
        particle.userData.age += deltaTime;
        
        // Fade out based on age
        if (particle.material && particle.userData.age > particle.userData.maxAge * 0.5) {
            particle.material.opacity = Math.max(0, 1 - (particle.userData.age - particle.userData.maxAge * 0.5) / (particle.userData.maxAge * 0.5));
        }
        
        // Simple rotation for debris particles
        if (particle.userData.type === 'debris') {
            particle.rotation.x += deltaTime * 2;
            particle.rotation.z += deltaTime * 3;
        }
    }
    
    // Update lights
    const light = explosion.children.find(child => child.isPointLight && child !== explosion.userData.secondaryFlash);
    if (light) {
        light.intensity = Math.max(0, 2 - progress * 4);
    }
    
    // Update secondary flash if it exists
    if (explosion.userData.secondaryFlash) {
        explosion.userData.secondaryFlash.intensity = Math.max(0, 1.5 - (progress - 0.1) * 5);
        
        // Remove it when faded
        if (explosion.userData.secondaryFlash.intensity <= 0) {
            explosion.remove(explosion.userData.secondaryFlash);
            explosion.userData.secondaryFlash = null;
        }
    }
    
    return true; // Effect is still active
}

// Easing function for smoother animations
function easeOutQuart(x) {
    return 1 - Math.pow(1 - x, 4);
} 