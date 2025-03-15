import * as THREE from 'https://cdn.skypack.dev/three@0.134.0';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.134.0/examples/jsm/controls/OrbitControls.js';
import { createBombModel, updateBombAnimation, createExplosionEffect, updateExplosionEffect } from './bomb-model.js';
import { createFlagModel, updateFlagAnimation } from './flag-model.js';
import { 
    setupPostProcessing, 
    createEnhancedLighting, 
    createEnhancedMaterials, 
    createEnvironmentMap,
    createAmbientParticles,
    createWater
} from './effects.js';

// Game state
let scene, camera, renderer, controls;
let gameBoard, bombs = [];
let score = 0;
let lives = 3;
let isGameOver = false;
let maxScore = 20; // Will be set based on difficulty
let totalCells = 100;
let totalBombs = 15; // Default value, will be set based on difficulty
let explosions = [];
let activeBombs = [];
let activeFlags = [];
let clock = new THREE.Clock();
let currentDifficulty = 'easy'; // Default difficulty
let isMobileDevice = false; // Will be set in checkMobileDevice()
let frameCount = 0; // For performance optimization

// Difficulty settings
const difficultySettings = {
    easy: {
        bombsRange: [10, 15],
        lives: 3,
        maxScoreRange: [15, 20]
    },
    medium: {
        bombsRange: [15, 25],
        lives: 3,
        maxScoreRange: [20, 30]
    },
    hard: {
        bombsRange: [25, 35],
        lives: 2,
        maxScoreRange: [30, 40]
    }
};

// Enhanced rendering
let composer, effects, materials, lights;
let ambientParticles, water;
let envMap;

// Audio
const tapSound = new Audio('./audios/tap.wav');
const winSound = new Audio('./audios/win.mp3');
const loseSound = new Audio('./audios/lose.mp3');
const startSound = new Audio('./audios/start.wav');

// Audio initialization status
let audioInitialized = false;

// Vibration manager
const vibrationManager = {
    isSupported: 'vibrate' in navigator || 'mozVibrate' in navigator,
    
    vibrate: function(pattern) {
        if (!this.isSupported || !isMobileDevice) return;
        
        try {
            // Use navigator.vibrate or navigator.mozVibrate
            const vibrationAPI = navigator.vibrate || navigator.mozVibrate;
            vibrationAPI.call(navigator, pattern);
        } catch (e) {
            console.warn('Vibration failed:', e);
        }
    },
    
    // Vibration patterns
    patterns: {
        tap: 20,
        flag: [20, 30, 40],
        reveal: 30,
        explosion: [50, 20, 100, 20, 50],
        win: [50, 50, 50, 50, 100, 50, 100],
        lose: [100, 30, 100, 30, 100, 30, 200]
    }
};

// Performance optimization settings
const performanceSettings = {
    mobileLowDetail: {
        particleCount: 100,       // Fewer particles
        shadowsEnabled: false,    // Disable shadows
        postProcessing: false,    // Disable post-processing
        ambientParticles: false,  // Disable ambient particles
        updateFrequency: 2        // Update animations every other frame
    },
    mobileHighDetail: {
        particleCount: 200,
        shadowsEnabled: true,
        postProcessing: true,
        ambientParticles: true,
        updateFrequency: 1
    },
    desktop: {
        particleCount: 500,
        shadowsEnabled: true,
        postProcessing: true,
        ambientParticles: true,
        updateFrequency: 1
    }
};

let currentPerformance = performanceSettings.desktop;

// Object pooling for explosion particles
const particlePool = {
    particles: [],
    poolSize: 500,
    
    initialize: function() {
        // Create reusable particle geometries and materials
        const particleGeometry = new THREE.SphereGeometry(0.1, 4, 4);
        const particleMaterial = new THREE.MeshBasicMaterial({ color: 0xff5500 });
        
        for (let i = 0; i < this.poolSize; i++) {
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            particle.visible = false;
            scene.add(particle);
            this.particles.push({
                mesh: particle,
                inUse: false,
                velocity: new THREE.Vector3(),
                lifeTime: 0,
                maxLife: 0
            });
        }
    },
    
    getParticle: function() {
        // Find an available particle
        for (let i = 0; i < this.particles.length; i++) {
            if (!this.particles[i].inUse) {
                this.particles[i].inUse = true;
                this.particles[i].mesh.visible = true;
                return this.particles[i];
            }
        }
        
        // If no particles available, return null
        return null;
    },
    
    releaseParticle: function(particle) {
        particle.inUse = false;
        particle.mesh.visible = false;
    },
    
    update: function(deltaTime) {
        // Update all active particles
        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];
            
            if (particle.inUse) {
                // Update particle position
                particle.mesh.position.add(particle.velocity.clone().multiplyScalar(deltaTime));
                
                // Apply gravity
                particle.velocity.y -= 9.8 * deltaTime;
                
                // Update lifetime
                particle.lifeTime += deltaTime;
                
                // Make particles fade out
                if (particle.lifeTime > particle.maxLife * 0.7) {
                    const opacity = 1 - (particle.lifeTime - particle.maxLife * 0.7) / (particle.maxLife * 0.3);
                    if (particle.mesh.material.opacity !== undefined) {
                        particle.mesh.material.opacity = opacity;
                    }
                }
                
                // Release particle when lifetime expires
                if (particle.lifeTime >= particle.maxLife) {
                    this.releaseParticle(particle);
                }
            }
        }
    }
};

// Function to initialize audio after user interaction
function initializeAudio() {
    if (!audioInitialized) {
        // Create audio context if needed (for future expansion)
        audioInitialized = true;
        
        // Play start sound only after initialization
        if (startSound) startSound.play().catch(e => console.log("Audio play failed:", e));
    }
}

// DOM elements
const scoreCounter = document.querySelector('.score-counter');
const lifeElement = document.querySelector('.life');
const endGameScreen = document.querySelector('.end-game-screen');
const endGameText = document.querySelector('.end-game-text');
const playAgainButton = document.querySelector('.play-again');
const info = document.querySelector(".info");
const loadingScreen = document.querySelector("#loading-screen");

// Add an explosion container to isolate explosion effects from the board
let explosionContainer;

function setupExplosionContainer() {
    // Create a separate container for all explosions
    explosionContainer = new THREE.Group();
    explosionContainer.name = "explosionContainer";
    scene.add(explosionContainer);
}

// Three.js setup
async function init() {
    try {
        // Check device capabilities first and set performance level
        detectPerformanceLevel();
        
        // Create scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x050518);
        scene.fog = new THREE.FogExp2(0x050518, 0.02);
        
        // Create camera
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 12, 18);
        
        // Create renderer with appropriate settings based on performance level
        renderer = new THREE.WebGLRenderer({ 
            antialias: currentPerformance === performanceSettings.mobileLowDetail ? false : true,
            alpha: true,
            powerPreference: "high-performance",
            precision: isMobileDevice ? "mediump" : "highp"
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio > 2 ? 2 : window.devicePixelRatio); // Limit pixel ratio for performance
        renderer.shadowMap.enabled = currentPerformance.shadowsEnabled;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        if (currentPerformance !== performanceSettings.mobileLowDetail) {
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.2;
            renderer.outputEncoding = THREE.sRGBEncoding;
        }
        
        document.body.appendChild(renderer.domElement);
        
        // Setup post-processing only if enabled for current performance level
        if (currentPerformance.postProcessing) {
            effects = setupPostProcessing(scene, camera, renderer);
            composer = effects.composer;
        }
        
        // Create environment map if not on low-end mobile
        if (currentPerformance !== performanceSettings.mobileLowDetail) {
            envMap = await createEnvironmentMap(renderer, scene);
        }
        
        // Setup enhanced materials
        materials = createEnhancedMaterials();
        
        // Add orbit controls with enhanced feel
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.1;
        controls.maxPolarAngle = Math.PI / 2 - 0.05;
        controls.minDistance = 5;
        controls.maxDistance = 40;
        controls.rotateSpeed = 0.8;
        controls.zoomSpeed = 1.2;
        controls.autoRotate = true; // Auto-rotate at start for cinematic effect
        controls.autoRotateSpeed = 0.5;
        
        // Detect touch device and adjust controls
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            // Adjust for touch devices
            controls.rotateSpeed = 0.6; // Slower rotation for more precision on touch
            controls.zoomSpeed = 1.0;   // Adjusted zoom speed
            controls.enablePan = false; // Disable panning on touch devices to avoid confusion
            controls.screenSpacePanning = false;
            controls.maxDistance = 30;  // Limit zoom out
        }
        
        // Add enhanced lighting
        lights = createEnhancedLighting(scene);
        
        // Add ambient particles only if enabled for current performance level
        if (currentPerformance.ambientParticles) {
            ambientParticles = createAmbientParticles(currentPerformance.particleCount / 5);
            scene.add(ambientParticles);
        }
        
        // Add water effect with detail based on performance
        const waterDetail = currentPerformance === performanceSettings.mobileLowDetail ? 64 : 150;
        water = createWater(waterDetail);
        scene.add(water);
        
        // Initialize particle pool for explosion effects
        particlePool.poolSize = currentPerformance.particleCount;
        particlePool.initialize();
        
        // Create game board
        await createGameBoard();
        
        // Generate bombs
        generateBombs(totalCells, totalBombs);
        
        // Setup explosion container
        setupExplosionContainer();
        
        // Start animation loop
        animate();
        
        // Event listeners
        window.addEventListener('resize', onWindowResize);
        
        // Setup mouse events
        setupMouseEvents();
        
        // Update UI elements
        updateBombCounter();
        updateWinningScore();
        
        // Hide loading screen once initialization is complete
        if (loadingScreen) {
            loadingScreen.style.opacity = 0;
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }
        
        // Stop auto-rotate after 5 seconds
        setTimeout(() => {
            controls.autoRotate = false;
            // Smoothly transition camera to gameplay position
            new TWEEN.Tween(camera.position)
                .to({ x: 0, y: 15, z: 15 }, 2000)
                .easing(TWEEN.Easing.Cubic.InOut)
                .start();
        }, 5000);
        
        setupDifficultyButtons();
        setupMobileScoreboard();
        
        return Promise.resolve(); // Explicitly return a resolved promise
    } catch (error) {
        console.error("Error during initialization:", error);
        return Promise.reject(error);
    }
}

// Detect performance capabilities of the device
function detectPerformanceLevel() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const lowEndDevice = isMobile && (
        navigator.deviceMemory < 4 || // Low memory 
        window.innerWidth < 400 ||    // Small screen
        (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) // Few CPU cores
    );
    
    if (lowEndDevice) {
        currentPerformance = performanceSettings.mobileLowDetail;
        console.log("Using low detail settings for better performance");
    } else if (isMobile) {
        currentPerformance = performanceSettings.mobileHighDetail;
        console.log("Using mobile high detail settings");
    } else {
        currentPerformance = performanceSettings.desktop;
        console.log("Using desktop high detail settings");
    }
}

function createGameBoard() {
    // Create a 10x10 grid of cells
    gameBoard = new THREE.Group();
    
    // Set a property to prevent rotation issues
    gameBoard.userData = {
        ...gameBoard.userData,
        isGameBoard: true,
        rotationLocked: true
    };
    
    const boardSize = 10;
    const cellSize = 1;
    const spacing = 0.1;
    const totalWidth = boardSize * (cellSize + spacing) - spacing;
    
    // Create board base with enhanced material
    const baseGeometry = new THREE.BoxGeometry(totalWidth + 1.5, 0.8, totalWidth + 1.5);
    baseGeometry.translate(0, -0.4, 0); // Center base lower
    
    const base = new THREE.Mesh(baseGeometry, materials.baseMaterial);
    base.receiveShadow = true;
    gameBoard.add(base);
    
    // Add detailed edges to the base
    const edgeGeometry = new THREE.BoxGeometry(totalWidth + 2, 0.4, totalWidth + 2);
    edgeGeometry.translate(0, -0.6, 0);
    const edgeMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x444455,
        roughness: 0.5,
        metalness: 0.7,
        envMapIntensity: 1.5
    });
    const edge = new THREE.Mesh(edgeGeometry, edgeMaterial);
    edge.receiveShadow = true;
    gameBoard.add(edge);
    
    // Create cells with enhanced materials
    const cellGeometry = new THREE.BoxGeometry(cellSize, 0.25, cellSize);
    cellGeometry.translate(0, 0.125, 0); // Align bottom with y=0
    
    for (let i = 0; i < boardSize; i++) {
        for (let j = 0; j < boardSize; j++) {
            const cell = new THREE.Mesh(cellGeometry, materials.cellMaterials.default.clone());
            
            // Position the cell in the grid
            const x = (i * (cellSize + spacing)) - totalWidth / 2 + cellSize / 2;
            const z = (j * (cellSize + spacing)) - totalWidth / 2 + cellSize / 2;
            
            cell.position.set(x, 0, z);
            cell.castShadow = true;
            cell.receiveShadow = true;
            
            // Add bevel for more realistic look
            const bevelGeometry = new THREE.BoxGeometry(cellSize + 0.03, 0.03, cellSize + 0.03);
            bevelGeometry.translate(0, -0.14, 0);
            const bevelMaterial = new THREE.MeshStandardMaterial({
                color: 0x555566,
                roughness: 0.6,
                metalness: 0.5
            });
            const bevel = new THREE.Mesh(bevelGeometry, bevelMaterial);
            bevel.castShadow = true;
            cell.add(bevel);
            
            // Store cell index
            cell.userData = {
                index: i * boardSize + j + 1,
                revealed: false,
                flagged: false
            };
            
            gameBoard.add(cell);
        }
    }
    
    // Add game board to scene
    scene.add(gameBoard);
    
    // Add environment
    createEnvironment();
    
    // Add a subtle glow to the board
    const boardLight = new THREE.PointLight(0x80c0ff, 1, 20);
    boardLight.position.set(0, 5, 0);
    boardLight.castShadow = false;
    scene.add(boardLight);
    
    // Initial animation - have the board rise up from below
    gameBoard.position.y = -10;
    new TWEEN.Tween(gameBoard.position)
        .to({ y: 0 }, 2000)
        .easing(TWEEN.Easing.Elastic.Out)
        .start();
}

function createTexture() {
    // Create a realistic board texture with higher quality
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = 1024; // Higher resolution
    canvas.height = 1024;
    
    // Base color - dark blue metallic
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#1a2a3a');
    gradient.addColorStop(0.5, '#2a3a4a');
    gradient.addColorStop(1, '#1a2a3a');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add metallic noise texture
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 50000; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const size = Math.random() * 1.5 + 0.5;
        ctx.globalAlpha = Math.random() * 0.05 + 0.02;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Add scratched metal effect
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = 0.05;
    ctx.lineWidth = 1;
    
    for (let i = 0; i < 100; i++) {
        const x1 = Math.random() * canvas.width;
        const y1 = Math.random() * canvas.height;
        const x2 = x1 + (Math.random() - 0.5) * 200;
        const y2 = y1 + (Math.random() - 0.5) * 200;
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }
    
    // Add grid pattern - more subtle and refined
    ctx.strokeStyle = '#3a4a5a';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.2;
    
    const gridSize = 64;
    for (let i = 0; i <= canvas.width; i += gridSize) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
    }
    
    for (let j = 0; j <= canvas.height; j += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(canvas.width, j);
        ctx.stroke();
    }
    
    // Add some subtle glow spots
    ctx.fillStyle = '#80c0ff';
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 20; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const radius = Math.random() * 100 + 50;
        
        const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        glowGradient.addColorStop(0, 'rgba(128, 192, 255, 0.2)');
        glowGradient.addColorStop(1, 'rgba(128, 192, 255, 0)');
        
        ctx.fillStyle = glowGradient;
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    
    return texture;
}

function createEnvironment() {
    // Create enhanced ground
    const groundSize = 500;
    const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize, 128, 128);
    const vertices = groundGeometry.attributes.position.array;
    
    // Add terrain variations
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const z = vertices[i + 2];
        
        // Skip the center area where the game board is
        const distFromCenter = Math.sqrt(x * x + z * z);
        if (distFromCenter > 20) {
            vertices[i + 1] = Math.sin(x * 0.05) * Math.cos(z * 0.05) * 2;
            
            // Add some noise
            vertices[i + 1] += (Math.random() - 0.5) * 0.5;
        }
    }
    
    // Update geometry
    groundGeometry.computeVertexNormals();
    
    const ground = new THREE.Mesh(groundGeometry, materials.groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.5;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Add mountains in the distance
    createMountains();
    
    // Add some decorative rocks
    addRocks();
}

function createMountains() {
    // Create distant mountains as a backdrop
    const mountainGeometry = new THREE.BufferGeometry();
    const vertices = [];
    const mountainCount = 10;
    const mountainSize = 200;
    const distance = 200;
    
    for (let i = 0; i < mountainCount; i++) {
        const angle = (i / mountainCount) * Math.PI * 2;
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;
        
        const height = 30 + Math.random() * 50;
        
        // Create a simple triangle for each mountain
        vertices.push(
            x - mountainSize/2, 0, z - mountainSize/2,
            x + mountainSize/2, 0, z - mountainSize/2,
            x, height, z
        );
        
        // Add another adjacent mountain
        const x2 = x + (Math.random() - 0.5) * 50;
        const z2 = z + (Math.random() - 0.5) * 50;
        const height2 = 30 + Math.random() * 30;
        
        vertices.push(
            x2 - mountainSize/2, 0, z2 - mountainSize/2,
            x2 + mountainSize/2, 0, z2 - mountainSize/2,
            x2, height2, z2
        );
    }
    
    mountainGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    mountainGeometry.computeVertexNormals();
    
    const mountainMaterial = new THREE.MeshStandardMaterial({
        color: 0x334455,
        roughness: 1,
        metalness: 0,
        flatShading: true
    });
    
    const mountains = new THREE.Mesh(mountainGeometry, mountainMaterial);
    scene.add(mountains);
}

function addRocks() {
    // Add some decorative rocks around the board
    const rockGroup = new THREE.Group();
    
    const rockCount = 30;
    const minDistance = 15; // Min distance from center
    const maxDistance = 40; // Max distance from center
    
    for (let i = 0; i < rockCount; i++) {
        // Random position in a ring around the center
        const angle = Math.random() * Math.PI * 2;
        const distance = minDistance + Math.random() * (maxDistance - minDistance);
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;
        
        // Create rock
        const rockGeometry = new THREE.DodecahedronGeometry(
            0.5 + Math.random() * 2, // Random size
            0 // No subdivision
        );
        
        // Distort the rock
        const vertices = rockGeometry.attributes.position.array;
        for (let j = 0; j < vertices.length; j += 3) {
            vertices[j] *= 0.8 + Math.random() * 0.4;
            vertices[j + 1] *= 0.8 + Math.random() * 0.4;
            vertices[j + 2] *= 0.8 + Math.random() * 0.4;
        }
        
        rockGeometry.computeVertexNormals();
        
        const rockMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(0.1, 0.1, 0.2 + Math.random() * 0.2),
            roughness: 0.8 + Math.random() * 0.2,
            metalness: 0.1 + Math.random() * 0.1
        });
        
        const rock = new THREE.Mesh(rockGeometry, rockMaterial);
        rock.position.set(x, -1 + Math.random(), z);
        rock.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );
        rock.castShadow = true;
        rock.receiveShadow = true;
        
        rockGroup.add(rock);
    }
    
    scene.add(rockGroup);
}

function generateBombs(totalCells, totalBombs) {
    bombs = [];
    while (bombs.length < totalBombs) {
        const randomNum = Math.floor(Math.random() * totalCells) + 1;
        if (bombs.indexOf(randomNum) === -1) bombs.push(randomNum);
    }
}

function updateBombCounter() {
    const totalBombElement = document.querySelector('.total-bomb');
    if (totalBombElement) {
        totalBombElement.textContent = totalBombs;
    } else {
        let tb = document.createElement('h3');
        tb.innerHTML = `Total 💣: <span class="total-bomb">${totalBombs}</span>`;
        document.querySelector('.game-panel').appendChild(tb);
    }
}

function updateWinningScore() {
    const winningScoreElement = document.querySelector('.winning');
    if (winningScoreElement) {
        winningScoreElement.textContent = maxScore;
    } else {
        let winningScore = document.createElement('h2');
        winningScore.innerHTML = `Winning Score:<span class="winning">${maxScore}</span>`;
        document.querySelector('.game-panel').appendChild(winningScore);
    }
}

function updateScore() {
    score++;
    scoreCounter.innerText = score.toString().padStart(5, '0');
    
    // Add visual feedback
    createScorePopup(score);
    
    if (score >= maxScore) {
        endGame(true);
    }
    
    // Update collapsed view if active
    if (checkMobileDevice()) {
        const gameContainer = document.querySelector('.game-container');
        if (gameContainer.classList.contains('collapsed')) {
            updateCollapsedScoreboard();
        }
    }
}

function createScorePopup(score) {
    // Create a score popup at a random position above the board
    const popup = document.createElement('div');
    popup.className = 'score-popup';
    popup.textContent = '+1';
    
    // Random position
    const x = 40 + Math.random() * 20;
    const y = 40 + Math.random() * 10;
    
    popup.style.left = `${x}%`;
    popup.style.top = `${y}%`;
    
    document.body.appendChild(popup);
    
    // Remove after animation
    setTimeout(() => {
        popup.remove();
    }, 1000);
}

function handleCellClick(cell) {
    if (isGameOver || cell.userData.revealed || cell.userData.flagged) return;
    
    // Initialize audio on first interaction
    initializeAudio();
    
    tapSound.play().catch(e => console.log("Audio play failed:", e));
    
    // Add vibration
    vibrationManager.vibrate(vibrationManager.patterns.tap);
    
    // Check if it's a bomb
    if (bombs.includes(cell.userData.index)) {
        // Hit a bomb
        cell.material.copy(materials.cellMaterials.bomb);
        
        // Create explosion effect at the cell position
        try {
            const explosion = createExplosionEffect(cell.position.clone());
            
            // Add to the explosion container instead of directly to the scene
            if (explosionContainer) {
                explosionContainer.add(explosion);
            } else {
                scene.add(explosion);
            }
            
            explosions.push(explosion);
        } catch (error) {
            console.error("Error creating explosion effect:", error);
        }
        
        // Stronger vibration for bomb
        vibrationManager.vibrate(vibrationManager.patterns.explosion);
        
        // Shake camera for impact
        shakeCamera(0.5);
        
        // Remove a life
        lives--;
        updateLives();
        
        if (lives <= 0) {
            endGame(false);
        }
    } else {
        // Reveal safe cell
        cell.userData.revealed = true;
        cell.material.copy(materials.cellMaterials.revealed);
        
        // Animate cell reveal with a tween
        const originalY = cell.position.y;
        
        // First press down
        new TWEEN.Tween(cell.position)
            .to({ y: originalY - 0.15 }, 100)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onComplete(() => {
                // Then bounce back
                new TWEEN.Tween(cell.position)
                    .to({ y: originalY }, 300)
                    .easing(TWEEN.Easing.Elastic.Out)
                    .start();
            })
            .start();
        
        // Small vibration for safe reveal
        vibrationManager.vibrate(vibrationManager.patterns.reveal);
        
        updateScore();
    }
}

function shakeCamera(intensity = 1.0) {
    // Store original position
    const originalPosition = camera.position.clone();
    
    // Shake duration in ms
    const duration = 500;
    const startTime = Date.now();
    
    // Shake function
    function shake() {
        const elapsed = Date.now() - startTime;
        const remaining = duration - elapsed;
        
        if (remaining <= 0) {
            // Reset camera position
            camera.position.copy(originalPosition);
            return;
        }
        
        // Calculate shake intensity (decreases over time)
        const currentIntensity = (remaining / duration) * intensity;
        
        // Apply random offset
        camera.position.set(
            originalPosition.x + (Math.random() - 0.5) * currentIntensity,
            originalPosition.y + (Math.random() - 0.5) * currentIntensity,
            originalPosition.z + (Math.random() - 0.5) * currentIntensity
        );
        
        // Continue shaking
        requestAnimationFrame(shake);
    }
    
    shake();
}

function updateLives() {
    lifeElement.innerText = '♥️'.repeat(lives);
    
    if (lives > 0) {
        lifeElement.classList.add('blink-vibrate');
        setTimeout(() => {
            lifeElement.classList.remove('blink-vibrate');
        }, 2000);
    }
    
    // Update collapsed view if active
    if (checkMobileDevice()) {
        const gameContainer = document.querySelector('.game-container');
        if (gameContainer.classList.contains('collapsed')) {
            updateCollapsedScoreboard();
        }
    }
}

function revealAllBombs() {
    // Get all cell meshes
    gameBoard.children.forEach(child => {
        if (child.userData && bombs.includes(child.userData.index)) {
            // Apply bomb material
            child.material.copy(materials.cellMaterials.bomb);
            
            // Create bomb model
            const bomb = createBombModel();
            const bombPosition = child.position.clone();
            bomb.position.copy(bombPosition);
            bomb.position.y += 0.3;
            scene.add(bomb);
            activeBombs.push(bomb);
            
            // Create explosion with delay for each bomb
            setTimeout(() => {
                // Create explosion at the exact position of the cell
                const explosionPosition = child.position.clone();
                try {
                    const explosion = createExplosionEffect(explosionPosition);
                    
                    // Add to the explosion container instead of directly to the scene
                    if (explosionContainer) {
                        explosionContainer.add(explosion);
                    } else {
                        scene.add(explosion);
                    }
                    
                    explosions.push(explosion);
                } catch (error) {
                    console.error("Error creating explosion effect in revealAllBombs:", error);
                }
                
                // Add light flash for explosion (add to explosion container)
                const explosionLight = new THREE.PointLight(0xff9500, 2, 10);
                explosionLight.position.copy(explosionPosition);
                explosionLight.position.y += 1;
                
                if (explosionContainer) {
                    explosionContainer.add(explosionLight);
                } else {
                    scene.add(explosionLight);
                }
                
                // Remove light after a short time
                setTimeout(() => {
                    if (explosionContainer) {
                        explosionContainer.remove(explosionLight);
                    } else {
                        scene.remove(explosionLight);
                    }
                }, 200);
                
            }, Math.random() * 1500); // Random delay for each explosion
        }
    });
}

function endGame(isVictory) {
    isGameOver = true;
    
    // Add vibration based on game outcome
    vibrationManager.vibrate(isVictory ? vibrationManager.patterns.win : vibrationManager.patterns.lose);
    
    if (isVictory) {
        winSound.play().catch(e => console.log("Audio play failed:", e));
        endGameText.innerHTML = 'YOU<br>WON';
        endGameScreen.classList.add('win');
        
        // Create victory particle effects
        const particleCount = currentPerformance === performanceSettings.mobileLowDetail ? 5 : 10;
        for (let i = 0; i < particleCount; i++) {
            setTimeout(() => {
                // Random position for celebratory explosions
                const position = new THREE.Vector3(
                    (Math.random() - 0.5) * 20,
                    2 + Math.random() * 8,
                    (Math.random() - 0.5) * 20
                );
                
                try {
                    const explosion = createExplosionEffect(position);
                    
                    // Add to the explosion container instead of directly to the scene
                    if (explosionContainer) {
                        explosionContainer.add(explosion);
                    } else {
                        scene.add(explosion);
                    }
                    
                    explosions.push(explosion);
                } catch (error) {
                    console.error("Error creating victory explosion effect:", error);
                }
                
                // Add light flash for fireworks (add to explosion container)
                const fireworkLight = new THREE.PointLight(
                    new THREE.Color().setHSL(Math.random(), 1, 0.5), // Random color
                    2, 
                    15
                );
                fireworkLight.position.copy(position);
                
                if (explosionContainer) {
                    explosionContainer.add(fireworkLight);
                } else {
                    scene.add(fireworkLight);
                }
                
                // Remove light after a short time
                setTimeout(() => {
                    if (explosionContainer) {
                        explosionContainer.remove(fireworkLight);
                    } else {
                        scene.remove(fireworkLight);
                    }
                }, 300);
                
            }, i * 300);
        }
        
        // Cinematic camera movement for victory
        new TWEEN.Tween(camera.position)
            .to({ x: 0, y: 25, z: 0 }, 3000)
            .easing(TWEEN.Easing.Cubic.InOut)
            .start();
        
        new TWEEN.Tween(controls.target)
            .to({ x: 0, y: 0, z: 0 }, 3000)
            .easing(TWEEN.Easing.Cubic.InOut)
            .start();
    } else {
        loseSound.play().catch(e => console.log("Audio play failed:", e));
        revealAllBombs();
        
        // Dramatic camera movement for loss
        new TWEEN.Tween(camera.position)
            .to({ x: 0, y: 8, z: 20 }, 2000)
            .easing(TWEEN.Easing.Cubic.InOut)
            .start();
    }
    
    endGameScreen.classList.remove('hidden');
    saveHighScore();
}

function saveHighScore() {
    let highestScore;
    try {
        highestScore = JSON.parse(localStorage.getItem('highestScore')) || [];
        
        // Check if highestScore is an array
        if (!Array.isArray(highestScore)) {
            highestScore = [];
        }
    } catch (e) {
        highestScore = [];
    }
    
    // Add current score
    highestScore.push(score);
    
    // Save to localStorage
    localStorage.setItem('highestScore', JSON.stringify(highestScore));
}

function showHighestScore() {
    try {
        let storedHighestScore = JSON.parse(localStorage.getItem('highestScore')) || [];
        
        // Check if storedHighestScore is an array with values
        if (Array.isArray(storedHighestScore) && storedHighestScore.length > 0) {
            const highest = Math.max(...storedHighestScore);
            
            // Display highest score
            const existingHighScore = document.querySelector('.highest-score');
            if (existingHighScore) {
                existingHighScore.innerText = `Highest Score: ${highest}`;
            } else {
                let h3 = document.createElement('h3');
                h3.className = 'highest-score';
                h3.innerText = `Highest Score: ${highest}`;
                document.querySelector('.game-panel').appendChild(h3);
            }
        }
    } catch (e) {
        console.error("Error showing highest score:", e);
    }
}

function onWindowResize() {
    // Safety checks to prevent errors when objects aren't yet initialized
    if (!camera || !renderer) {
        console.warn("Camera or renderer not initialized in onWindowResize");
        return;
    }
    
    // Update camera
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    
    // Update renderer
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Update post-processing
    if (effects && effects.resize) {
        effects.resize();
    }
    
    // Re-check for mobile device in case of orientation change
    checkMobileDevice();
}

// Add orientation change event handler
window.addEventListener('orientationchange', function() {
    // Short delay to ensure the browser has completed orientation
    setTimeout(onWindowResize, 300);
});

function animate() {
    requestAnimationFrame(animate);
    
    const deltaTime = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();
    
    // Increment frame counter
    frameCount++;
    
    // Update TWEEN animations
    TWEEN.update();
    
    // Update controls
    controls.update();
    
    // Lock game board rotation to prevent tilting during explosions
    lockGameBoardRotation();
    
    // Only update animations based on the current performance setting's update frequency
    const shouldUpdateThisFrame = frameCount % currentPerformance.updateFrequency === 0;
    
    if (shouldUpdateThisFrame) {
        // Update explosion effects
        for (let i = explosions.length - 1; i >= 0; i--) {
            // Skip if explosion doesn't exist
            if (!explosions[i]) {
                explosions.splice(i, 1);
                continue;
            }
            
            const isActive = updateExplosionEffect(explosions[i], deltaTime * currentPerformance.updateFrequency);
            
            if (!isActive) {
                // Remove and clean up inactive explosions
                if (explosionContainer) {
                    explosionContainer.remove(explosions[i]);
                } else {
                    scene.remove(explosions[i]);
                }
                
                // Ensure proper cleanup to prevent memory leaks
                if (explosions[i].geometry) explosions[i].geometry.dispose();
                if (explosions[i].material) {
                    if (Array.isArray(explosions[i].material)) {
                        explosions[i].material.forEach(material => material.dispose());
                    } else {
                        explosions[i].material.dispose();
                    }
                }
                
                explosions.splice(i, 1);
            }
        }
        
        // Update particle pool
        particlePool.update(deltaTime * currentPerformance.updateFrequency);
        
        // Update bomb animations
        activeBombs.forEach(bomb => {
            updateBombAnimation(bomb, deltaTime * currentPerformance.updateFrequency);
        });
        
        // Update flag animations
        activeFlags.forEach(flag => {
            updateFlagAnimation(flag, deltaTime * currentPerformance.updateFrequency);
        });
        
        // Update ambient particles
        if (ambientParticles && currentPerformance.ambientParticles) {
            ambientParticles.userData.update(elapsedTime);
        }
        
        // Update water
        if (water) {
            water.userData.update(deltaTime * currentPerformance.updateFrequency);
        }
        
        // Update lights for dynamic effects - only if not low detail mode
        if (lights && lights.spotLight && currentPerformance !== performanceSettings.mobileLowDetail) {
            // Move spotlight in a circular pattern
            const spotLightAngle = elapsedTime * 0.2;
            const spotLightRadius = 20;
            lights.spotLight.position.x = Math.cos(spotLightAngle) * spotLightRadius;
            lights.spotLight.position.z = Math.sin(spotLightAngle) * spotLightRadius;
            
            // Always look at the center
            lights.spotLight.target.position.set(0, 0, 0);
            lights.spotLight.target.updateMatrixWorld();
        }
    }
    
    // Frustum culling for optimization - don't render what's not visible
    const frustum = new THREE.Frustum();
    const matrix = new THREE.Matrix4().multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(matrix);
    
    // Only check every 30 frames to save CPU
    if (frameCount % 30 === 0) {
        scene.traverse(function(object) {
            if (object.isMesh && object.userData && object.userData.checkVisibility) {
                object.visible = frustum.intersectsObject(object);
            }
        });
    }
    
    // Render with post-processing if enabled, otherwise regular rendering
    if (composer && currentPerformance.postProcessing) {
        composer.render();
    } else {
        renderer.render(scene, camera);
    }
}

// RayCasting for mouse interactions
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function setupMouseEvents() {
    // Click event
    window.addEventListener('click', onMouseClick);
    
    // Right-click for flags
    window.addEventListener('contextmenu', onRightClick);
    
    // Mouse move for hover effects
    window.addEventListener('mousemove', onMouseMove);
    
    // Touch events for mobile
    window.addEventListener('touchstart', onTouchStart);
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchmove', onTouchMove);
    
    // Check if we're on mobile device and adjust UI
    checkMobileDevice();
}

function onMouseMove(event) {
    // Calculate mouse position in normalized device coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);
    
    // Calculate objects intersecting the picking ray
    const intersects = raycaster.intersectObjects(gameBoard.children);
    
    // Reset all cell hover states
    gameBoard.children.forEach(child => {
        if (child.userData && typeof child.userData.index === 'number') {
            if (!child.userData.revealed && !child.userData.flagged && !child.userData.isHovered) {
                child.scale.set(1, 1, 1);
            }
        }
    });
    
    if (intersects.length > 0) {
        // Check if it's a cell
        const cell = intersects[0].object;
        if (cell.userData && typeof cell.userData.index === 'number' && 
            !cell.userData.revealed && !cell.userData.flagged && !isGameOver) {
            
            // Add hover effect
            cell.scale.set(1.05, 1.1, 1.05);
            cell.userData.isHovered = true;
        }
    }
}

function onMouseClick(event) {
    if (isGameOver) return;
    
    // Calculate mouse position in normalized device coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);
    
    // Calculate objects intersecting the picking ray
    const intersects = raycaster.intersectObjects(gameBoard.children);
    
    if (intersects.length > 0) {
        // Check if it's a cell
        const cell = intersects[0].object;
        if (cell.userData && typeof cell.userData.index === 'number') {
            handleCellClick(cell);
        }
    }
}

function onRightClick(event) {
    event.preventDefault();
    
    if (isGameOver) return;
    
    // Calculate mouse position in normalized device coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);
    
    // Calculate objects intersecting the picking ray
    const intersects = raycaster.intersectObjects(gameBoard.children);
    
    if (intersects.length > 0) {
        // Check if it's a cell
        const cell = intersects[0].object;
        if (cell.userData && typeof cell.userData.index === 'number' && !cell.userData.revealed) {
            // Initialize audio on first interaction
            initializeAudio();
            
            // Toggle flag
            cell.userData.flagged = !cell.userData.flagged;
            
            if (cell.userData.flagged) {
                // Create flag using our model
                const flag = createFlagModel();
                flag.position.copy(cell.position);
                flag.name = `flag-${cell.userData.index}`;
                scene.add(flag);
                activeFlags.push(flag);
                
                // Add flagging effect
                const light = new THREE.PointLight(0xff0000, 1, 5);
                light.position.copy(cell.position);
                light.position.y += 1;
                scene.add(light);
                
                // Remove light after a short time
                setTimeout(() => {
                    scene.remove(light);
                }, 200);
            } else {
                // Remove flag
                const flag = scene.getObjectByName(`flag-${cell.userData.index}`);
                if (flag) {
                    scene.remove(flag);
                    const flagIndex = activeFlags.findIndex(f => f.name === `flag-${cell.userData.index}`);
                    if (flagIndex !== -1) {
                        activeFlags.splice(flagIndex, 1);
                    }
                }
            }
            
            tapSound.play().catch(e => console.log("Audio play failed:", e));
        }
    }
}

// Touch event handling
let touchTimeout = null; // For distinguishing between tap and long-press

// Handle touch start
function onTouchStart(event) {
    // Prevent default only for game board interactions
    if (event.target.tagName === 'CANVAS') {
        event.preventDefault();
    }
    
    // Get the first touch
    const touch = event.touches[0];
    
    // Update mouse position for raycaster
    updateMousePositionFromTouch(touch);
    
    // Handle touch and hold for flagging (right-click equivalent)
    if (touchTimeout !== null) {
        clearTimeout(touchTimeout);
    }
    
    touchTimeout = setTimeout(() => {
        handleLongPress(touch);
        touchTimeout = null;
    }, 500); // 500ms long press to flag
}

// Handle touch end
function onTouchEnd(event) {
    // If touchTimeout still exists, it was a regular tap, not a long press
    if (touchTimeout !== null) {
        clearTimeout(touchTimeout);
        
        // Prevent default for game interactions
        if (event.target.tagName === 'CANVAS') {
            event.preventDefault();
        }
        
        // Regular tap is equivalent to left click
        if (event.changedTouches.length > 0) {
            const touch = event.changedTouches[0];
            updateMousePositionFromTouch(touch);
            handleTap();
        }
        
        touchTimeout = null;
    }
}

// Handle touch move
function onTouchMove(event) {
    // Only prevent default for game board
    if (event.target.tagName === 'CANVAS') {
        event.preventDefault();
    }
    
    if (event.touches.length === 1) {
        const touch = event.touches[0];
        updateMousePositionFromTouch(touch);
    }
}

// Update mouse position from touch event
function updateMousePositionFromTouch(touch) {
    mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
}

// Handle tap (left click equivalent)
function handleTap() {
    if (isGameOver) return;
    
    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);
    
    // Calculate objects intersecting the picking ray
    const intersects = raycaster.intersectObjects(gameBoard.children);
    
    if (intersects.length > 0) {
        // Check if it's a cell
        const cell = intersects[0].object;
        if (cell.userData && typeof cell.userData.index === 'number') {
            handleCellClick(cell);
        }
    }
}

// Handle long press (right click equivalent)
function handleLongPress(touch) {
    if (isGameOver) return;
    
    // Update mouse position
    updateMousePositionFromTouch(touch);
    
    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);
    
    // Calculate objects intersecting the picking ray
    const intersects = raycaster.intersectObjects(gameBoard.children);
    
    if (intersects.length > 0) {
        // Check if it's a cell
        const cell = intersects[0].object;
        if (cell.userData && typeof cell.userData.index === 'number' && !cell.userData.revealed) {
            // Vibrate device with flag pattern
            vibrationManager.vibrate(vibrationManager.patterns.flag);
            
            // Toggle flag
            cell.userData.flagged = !cell.userData.flagged;
            
            if (cell.userData.flagged) {
                // Create flag using our model
                const flag = createFlagModel();
                flag.position.copy(cell.position);
                flag.name = `flag-${cell.userData.index}`;
                scene.add(flag);
                activeFlags.push(flag);
                
                // Add flagging effect
                const light = new THREE.PointLight(0xff0000, 1, 5);
                light.position.copy(cell.position);
                light.position.y += 1;
                scene.add(light);
                
                // Remove light after a short time
                setTimeout(() => {
                    scene.remove(light);
                }, 200);
            } else {
                // Remove flag
                const flag = scene.getObjectByName(`flag-${cell.userData.index}`);
                if (flag) {
                    scene.remove(flag);
                    const flagIndex = activeFlags.findIndex(f => f.name === `flag-${cell.userData.index}`);
                    if (flagIndex !== -1) {
                        activeFlags.splice(flagIndex, 1);
                    }
                }
            }
            
            // Initialize audio on first interaction
            initializeAudio();
            tapSound.play().catch(e => console.log("Audio play failed:", e));
        }
    }
}

// Check if the device is mobile and adjust UI accordingly
function checkMobileDevice() {
    // More comprehensive mobile detection
    const isMobileByUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isMobileBySize = window.innerWidth < 768;
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    const isMobile = (isMobileByUA || isMobileBySize) && isTouchDevice;
    
    // Set the global flag
    isMobileDevice = isMobile;
    
    if (isMobile) {
        // Adjust camera for better mobile experience
        if (camera) {
            camera.position.set(0, 18, 18); // Higher camera for better view on mobile
        }
        
        // Adjust controls for touch
        if (controls) {
            controls.rotateSpeed = 0.7;
            controls.minDistance = 10;
            controls.maxDistance = 30;
        }
        
        // Add CSS class to body for mobile-specific styles
        document.body.classList.add('mobile-device');
    } else {
        // Remove mobile class if it was added
        document.body.classList.remove('mobile-device');
    }
    
    return isMobile;
}

// Initialize game on load
window.addEventListener('load', () => {
    // Ensure TWEEN.js is loaded before initializing the game
    const tweenScript = document.createElement('script');
    tweenScript.src = 'https://cdn.jsdelivr.net/npm/@tweenjs/tween.js@18.6.4/dist/tween.umd.js';
    
    // Set a backup timer to hide loading screen if initialization takes too long
    const loadingTimeout = setTimeout(() => {
        const loadingScreen = document.querySelector("#loading-screen");
        if (loadingScreen && loadingScreen.style.display !== 'none') {
            console.log("Loading timeout reached, hiding loading screen...");
            loadingScreen.style.opacity = 0;
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }
    }, 10000); // 10 second timeout
    
    tweenScript.onload = () => {
        // Initialize the game first, then set difficulty
        init().then(() => {
            // Only set difficulty after init is complete and gameBoard exists
            setDifficulty('easy');
            
            // Setup difficulty buttons
            setupDifficultyButtons();
            setupMobileScoreboard();
            
            // Show highest score from localStorage
            showHighestScore();
            
            // Setup play again button
            const playAgainButton = document.querySelector('.play-again');
            if (playAgainButton) {
                playAgainButton.addEventListener('pointerup', () => {
                    window.location.reload();
                });
            }
            
            // Clear the timeout since init completed successfully
            clearTimeout(loadingTimeout);
        }).catch(err => {
            console.error("Error during initialization:", err);
            // Hide loading screen even if initialization fails
            const loadingScreen = document.querySelector("#loading-screen");
            if (loadingScreen) {
                loadingScreen.style.opacity = 0;
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 500);
            }
        });
    };
    
    document.head.appendChild(tweenScript);
});

// Handle instructions
let isInstructionsVisible = false;
info.addEventListener('pointerup', () => {
    // Initialize audio on first interaction
    initializeAudio();
    
    const instructions = document.querySelector('#Instructions');
    
    if (isInstructionsVisible) {
        instructions.style.transform = "scale(0)";
        isInstructionsVisible = false;
    } else {
        instructions.style.transform = "scale(1)";
        isInstructionsVisible = true;
    }
});

// Add a global click handler to initialize audio
document.addEventListener('click', initializeAudio, { once: true });
document.addEventListener('touchstart', initializeAudio, { once: true });

// Function to set up difficulty buttons
function setupDifficultyButtons() {
    const modeButtons = document.querySelectorAll('.mode-btn');
    
    modeButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons
            modeButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            button.classList.add('active');
            
            // Get difficulty mode
            const mode = button.getAttribute('data-mode');
            
            // Only restart game if difficulty has actually changed
            if (mode !== currentDifficulty) {
                // Set new difficulty
                setDifficulty(mode);
                
                // Reset game with new difficulty
                resetGame();
            }
        });
    });
}

// Function to reset the game
function resetGame() {
    // Clear game state
    score = 0;
    scoreCounter.innerText = '00000';
    isGameOver = false;
    
    // Clear existing bombs and flags
    bombs = [];
    
    // Check if we have a valid scene before trying to modify it
    if (!scene) {
        console.error("Scene not initialized in resetGame");
        return;
    }
    
    // Remove all active flags and bombs
    if (activeFlags && activeFlags.length) {
        activeFlags.forEach(flag => {
            scene.remove(flag);
        });
    }
    activeFlags = [];
    
    if (activeBombs && activeBombs.length) {
        activeBombs.forEach(bomb => {
            scene.remove(bomb);
        });
    }
    activeBombs = [];
    
    // Reset lives based on difficulty
    lives = difficultySettings[currentDifficulty].lives;
    updateLives();
    
    // Generate new bombs
    generateBombs(totalCells, totalBombs);
    
    // Update UI
    updateBombCounter();
    updateWinningScore();
    
    // Hide end game screen if visible
    if (endGameScreen) {
        endGameScreen.classList.add('hidden');
        endGameScreen.classList.remove('win');
    }
    
    // Reset all cells
    if (gameBoard && gameBoard.children) {
        gameBoard.children.forEach(child => {
            if (child.userData && typeof child.userData.index === 'number') {
                child.userData.revealed = false;
                child.userData.flagged = false;
                // Reset material
                if (child.material) {
                    child.material.copy(materials.cellMaterials.default);
                }
            }
        });
        
        // Add a visual effect for the reset
        const resetLight = new THREE.PointLight(0x80c0ff, 2, 50);
        resetLight.position.set(0, 10, 0);
        scene.add(resetLight);
        
        // Animate camera for reset effect if camera exists
        if (camera && TWEEN) {
            new TWEEN.Tween(camera.position)
                .to({ x: 0, y: 15, z: 15 }, 1500)
                .easing(TWEEN.Easing.Cubic.InOut)
                .start();
        }
        
        // Remove the light after a short time
        setTimeout(() => {
            scene.remove(resetLight);
        }, 1000);
    } else {
        console.warn("gameBoard or its children not available during reset");
    }
    
    // Update scoreboard
    updateScore();
    updateLives();
    updateBombCounter();
    updateWinningScore();
    showHighestScore();
    
    // If on mobile, maintain the collapsed state
    if (checkMobileDevice()) {
        const gameContainer = document.querySelector('.game-container');
        // If it was collapsed before, keep it collapsed
        if (gameContainer && gameContainer.classList.contains('collapsed')) {
            // Update collapsed view with latest info
            updateCollapsedScoreboard();
        }
    }
}

// Function to set difficulty
function setDifficulty(difficulty) {
    if (!difficultySettings[difficulty]) {
        console.error(`Invalid difficulty: ${difficulty}`);
        return;
    }
    
    currentDifficulty = difficulty;
    const settings = difficultySettings[difficulty];
    
    // Set bombs count based on difficulty
    const [minBombs, maxBombs] = settings.bombsRange;
    totalBombs = Math.floor(Math.random() * (maxBombs - minBombs + 1)) + minBombs;
    
    // Set max score based on difficulty
    const [minScore, maxScoreValue] = settings.maxScoreRange;
    maxScore = Math.floor(Math.random() * (maxScoreValue - minScore + 1)) + minScore;
    
    // Set lives based on difficulty
    lives = settings.lives;
    
    // Update UI
    updateLives();
    updateBombCounter();
    updateWinningScore();
    
    resetGame();
}

function setupMobileScoreboard() {
    // Ensure mobile detection is accurate
    const isMobile = checkMobileDevice();
    
    if (isMobile) {
        const gameContainer = document.querySelector('.game-container');
        if (!gameContainer) return; // Safety check
        
        // Add mobile device class to body for CSS targeting
        document.body.classList.add('mobile-device');
        
        // Add collapse badge element
        const collapseBadge = document.createElement('div');
        collapseBadge.className = 'collapse-badge';
        collapseBadge.textContent = '×';
        collapseBadge.setAttribute('aria-label', 'Collapse scoreboard');
        gameContainer.appendChild(collapseBadge);
        
        // Initial state - collapsed
        gameContainer.classList.add('collapsed');
        
        // Event handler for expanding the scoreboard
        gameContainer.addEventListener('click', function(e) {
            // Only expand if in collapsed state and not clicking other interactive elements
            if (gameContainer.classList.contains('collapsed') && 
                !e.target.closest('.mode-btn') && 
                !e.target.closest('.btn') &&
                !e.target.closest('.collapse-badge')) {
                gameContainer.classList.remove('collapsed');
                gameContainer.classList.add('expanded');
                
                // Prevent this click from affecting game board
                e.preventDefault();
                e.stopPropagation();
            }
        });
        
        // Event handler for collapsing via the badge
        collapseBadge.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent bubble to container click
            e.preventDefault();
            gameContainer.classList.remove('expanded');
            gameContainer.classList.add('collapsed');
        });
        
        // Add a swipe down gesture for collapsing
        let touchStartY = 0;
        gameContainer.addEventListener('touchstart', function(e) {
            if (gameContainer.classList.contains('expanded')) {
                touchStartY = e.touches[0].clientY;
            }
        });
        
        gameContainer.addEventListener('touchmove', function(e) {
            if (gameContainer.classList.contains('expanded')) {
                const touchY = e.touches[0].clientY;
                const diffY = touchY - touchStartY;
                
                // If swiping down by at least 30px, collapse
                if (diffY > 30) {
                    gameContainer.classList.remove('expanded');
                    gameContainer.classList.add('collapsed');
                    touchStartY = 0;
                }
            }
        });
    }
}

// Function to update the important info in collapsed scoreboard
function updateCollapsedScoreboard() {
    if (!checkMobileDevice()) return;
    
    // Just ensure the most critical info is up to date
    // Score and lives are already updated in their respective functions
    
    // Ensure we animate the collapse indicator to draw attention
    const gameContainer = document.querySelector('.game-container');
    if (gameContainer.classList.contains('collapsed')) {
        // Quick animation to indicate update
        const indicator = document.createElement('div');
        indicator.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 100%;
            background: rgba(160, 208, 255, 0.1);
            pointer-events: none;
            animation: flash-update 0.6s ease-out;
        `;
        
        gameContainer.appendChild(indicator);
        
        // Remove after animation
        setTimeout(() => {
            if (indicator.parentNode) {
                indicator.parentNode.removeChild(indicator);
            }
        }, 700);
    }
}

// Add this to the stylesheet dynamically
(function addFlashAnimation() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes flash-update {
            0% { opacity: 0.8; }
            100% { opacity: 0; }
        }
    `;
    document.head.appendChild(style);
})();

// Add a function that runs every frame to keep the game board's rotation fixed
function lockGameBoardRotation() {
    if (gameBoard && gameBoard.userData && gameBoard.userData.rotationLocked) {
        // Reset rotation to default values or desired fixed orientation
        gameBoard.rotation.set(0, 0, 0);
    }
} 