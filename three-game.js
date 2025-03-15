import * as THREE from 'https://cdn.skypack.dev/three@0.134.0';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.134.0/examples/jsm/controls/OrbitControls.js';
import { createBombModel, updateBombAnimation, createExplosionEffect, updateExplosionEffect } from './bomb-model.js';
import { createFlagModel, updateFlagAnimation } from './flag-model.js';

// Game state
let scene, camera, renderer, controls;
let gameBoard, bombs = [];
let score = 0;
let lives = 3;
let isGameOver = false;
const maxScore = 20;
let totalCells = 100;
let totalBombs = Math.floor(Math.random() * 20) + 10; // Between 10-30 bombs
let explosions = [];
let activeBombs = [];
let activeFlags = [];
let clock = new THREE.Clock();

// Audio
const tapSound = new Audio('./audios/tap.wav');
const winSound = new Audio('./audios/win.mp3');
const loseSound = new Audio('./audios/lose.mp3');
const startSound = new Audio('./audios/start.wav');

// DOM elements
const scoreCounter = document.querySelector('.score-counter');
const lifeElement = document.querySelector('.life');
const endGameScreen = document.querySelector('.end-game-screen');
const endGameText = document.querySelector('.end-game-text');
const playAgainButton = document.querySelector('.play-again');
const info = document.querySelector(".info");

// Three.js setup
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x637074);
    
    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 10, 15);
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);
    
    // Add orbit controls for camera
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.1; // Prevent going below ground
    controls.minDistance = 5;
    controls.maxDistance = 30;
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -15;
    directionalLight.shadow.camera.right = 15;
    directionalLight.shadow.camera.top = 15;
    directionalLight.shadow.camera.bottom = -15;
    scene.add(directionalLight);
    
    // Create game board
    createGameBoard();
    
    // Generate bombs
    generateBombs(totalCells, totalBombs);
    
    // Start animation loop
    animate();
    
    // Event listeners
    window.addEventListener('resize', onWindowResize);
    
    // Update UI elements
    updateBombCounter();
    updateWinningScore();
}

function createGameBoard() {
    // Create a 10x10 grid of cells
    gameBoard = new THREE.Group();
    
    const boardSize = 10;
    const cellSize = 1;
    const spacing = 0.1;
    const totalWidth = boardSize * (cellSize + spacing) - spacing;
    
    // Create board base
    const baseGeometry = new THREE.BoxGeometry(totalWidth + 1, 0.5, totalWidth + 1);
    const baseMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x333333,
        bumpMap: createTexture()
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = -0.5;
    base.receiveShadow = true;
    gameBoard.add(base);
    
    // Create cells
    const cellGeometry = new THREE.BoxGeometry(cellSize, 0.2, cellSize);
    const cellMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xd8eee8,
        shininess: 60,
        specular: 0x111111
    });
    
    for (let i = 0; i < boardSize; i++) {
        for (let j = 0; j < boardSize; j++) {
            const cell = new THREE.Mesh(cellGeometry, cellMaterial.clone());
            
            // Position the cell in the grid
            const x = (i * (cellSize + spacing)) - totalWidth / 2 + cellSize / 2;
            const z = (j * (cellSize + spacing)) - totalWidth / 2 + cellSize / 2;
            
            cell.position.set(x, 0, z);
            cell.castShadow = true;
            cell.receiveShadow = true;
            
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
}

function createTexture() {
    // Create a simple bump texture for the board base
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = 256;
    canvas.height = 256;
    
    // Fill with dark color
    ctx.fillStyle = '#222222';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add noise pattern
    ctx.fillStyle = '#333333';
    for (let i = 0; i < 5000; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const size = Math.random() * 3;
        ctx.fillRect(x, y, size, size);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    
    return texture;
}

function createEnvironment() {
    // Add a ground plane
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x265151,
        side: THREE.DoubleSide
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = Math.PI / 2;
    ground.position.y = -1;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Add simple sky background
    const skyGeometry = new THREE.SphereGeometry(50, 32, 32);
    const skyMaterial = new THREE.MeshBasicMaterial({
        color: 0x87CEEB,
        side: THREE.BackSide
    });
    const sky = new THREE.Mesh(skyGeometry, skyMaterial);
    scene.add(sky);
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
    
    if (score >= maxScore) {
        endGame(true);
    }
}

function handleCellClick(cell) {
    if (isGameOver || cell.userData.revealed || cell.userData.flagged) return;
    
    tapSound.play();
    
    // Check if it's a bomb
    if (bombs.includes(cell.userData.index)) {
        // Hit a bomb
        cell.material.color.set(0xf1754e);
        
        // Create explosion effect
        const explosion = createExplosionEffect(cell.position);
        scene.add(explosion);
        explosions.push(explosion);
        
        // Remove a life
        lives--;
        updateLives();
        
        if (lives <= 0) {
            endGame(false);
        }
    } else {
        // Reveal safe cell
        cell.userData.revealed = true;
        cell.material.color.set(0x9dc5c7);
        
        // Animate cell reveal
        const originalY = cell.position.y;
        cell.position.y = originalY - 0.1;
        
        setTimeout(() => {
            cell.position.y = originalY;
        }, 150);
        
        updateScore();
    }
}

function updateLives() {
    lifeElement.innerText = '♥️'.repeat(lives);
    
    if (lives > 0) {
        lifeElement.classList.add('blink-vibrate');
        setTimeout(() => {
            lifeElement.classList.remove('blink-vibrate');
        }, 2000);
    }
}

function revealAllBombs() {
    // Get all cell meshes
    gameBoard.children.forEach(child => {
        if (child.userData && bombs.includes(child.userData.index)) {
            child.material.color.set(0xf1754e);
            
            // Create bomb model
            const bomb = createBombModel();
            bomb.position.copy(child.position);
            bomb.position.y += 0.3;
            scene.add(bomb);
            activeBombs.push(bomb);
            
            // Create explosion with delay for each bomb
            setTimeout(() => {
                const explosion = createExplosionEffect(child.position);
                scene.add(explosion);
                explosions.push(explosion);
            }, Math.random() * 1000); // Random delay for each explosion
        }
    });
}

function endGame(isVictory) {
    isGameOver = true;
    
    if (isVictory) {
        winSound.play();
        endGameText.innerHTML = 'YOU<br>WON';
        endGameScreen.classList.add('win');
        
        // Create victory particle effects
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                // Random position for celebratory explosions
                const position = new THREE.Vector3(
                    (Math.random() - 0.5) * 10,
                    2 + Math.random() * 3,
                    (Math.random() - 0.5) * 10
                );
                
                const explosion = createExplosionEffect(position);
                scene.add(explosion);
                explosions.push(explosion);
            }, i * 300);
        }
    } else {
        loseSound.play();
        revealAllBombs();
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
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    
    const deltaTime = clock.getDelta();
    
    // Update controls
    controls.update();
    
    // Update explosion effects
    for (let i = explosions.length - 1; i >= 0; i--) {
        const isActive = updateExplosionEffect(explosions[i], deltaTime);
        
        if (!isActive) {
            // Remove inactive explosions
            scene.remove(explosions[i]);
            explosions.splice(i, 1);
        }
    }
    
    // Update bomb animations
    activeBombs.forEach(bomb => {
        updateBombAnimation(bomb, deltaTime);
    });
    
    // Update flag animations
    activeFlags.forEach(flag => {
        updateFlagAnimation(flag, deltaTime);
    });
    
    renderer.render(scene, camera);
}

// RayCasting for mouse interactions
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

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

// Event listeners
window.addEventListener('click', onMouseClick);

// Handle right-click for flags
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
            // Toggle flag
            cell.userData.flagged = !cell.userData.flagged;
            
            if (cell.userData.flagged) {
                // Create flag using our model
                const flag = createFlagModel();
                flag.position.copy(cell.position);
                flag.name = `flag-${cell.userData.index}`;
                scene.add(flag);
                activeFlags.push(flag);
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
            
            tapSound.play();
        }
    }
}

window.addEventListener('contextmenu', onRightClick);

// Initialize game on load
window.addEventListener('load', () => {
    init();
    showHighestScore();
    
    // Setup play again button
    playAgainButton.addEventListener('pointerup', () => {
        window.location.reload();
    });
    
    // Play start sound
    startSound.play();
});

// Handle instructions
let isInstructionsVisible = false;
info.addEventListener('pointerup', () => {
    const instructions = document.querySelector('#Instructions');
    
    if (isInstructionsVisible) {
        instructions.style.transform = "scale(0)";
        isInstructionsVisible = false;
    } else {
        instructions.style.transform = "scale(1)";
        isInstructionsVisible = true;
    }
}); 