const scoreCounter = document.querySelector('.score-counter');

const board = document.querySelector('.game-panel');

const grid = document.querySelector('.grid');

const endGameScreen = document.querySelector('.end-game-screen');

const endGameText = document.querySelector('.end-game-text');

const playAgainButton = document.querySelector('.play-again');

const info = document.querySelector(".info");

const lifes = document.querySelector('.life');


let isInstructionsVisible = false;

info.addEventListener('pointerup', () => {
  console.log("pressed");
  const instructions = document.querySelector('#Instructions');
  
  if (isInstructionsVisible) {
    instructions.style.transform = "scale(0)";
    isInstructionsVisible = false;
  } else {
    instructions.style.transform = "scale(1)";
    isInstructionsVisible = true;
  }
});

let tb = document.createElement('h3');
let winningScore = document.createElement('h2');
board.appendChild(winningScore);

board.appendChild(tb);


const totalCells = 100;
const totalBomb = Math.floor(Math.random() * 50) + 1;

tb.innerHTML = `Total 💣: <span class="total-bomb">${totalBomb}</span>`;
const maxScore = 20;
winningScore.innerHTML = `Winning Score:<span class = "winning"> ${maxScore}</span>`;


const start = new Audio('./audios/start.wav');




let highestScore;
try {
  highestScore = JSON.parse(localStorage.getItem('highestScore')) || []; 
} catch (e) {
  highestScore = [];
}
// Check if highestScore is an array
if (!Array.isArray(highestScore)) {
  highestScore = [];
}

// Convert the array to a string and store it in localStorage
localStorage.setItem('highestScore', JSON.stringify(highestScore));
let counter = 0;


function generateBombs(totalCells, totalBombs) {
  let bombs = [];
  while(bombs.length < totalBombs){
    let randomNum = Math.floor(Math.random() * totalCells) + 1;
    if(bombs.indexOf(randomNum) === -1) bombs.push(randomNum);
  }
  return bombs;
}

let bombsList = generateBombs(totalCells, totalBomb);

let score = 0;

function updateScore() {
  score++;
  scoreCounter.innerText = score.toString().padStart(5, '0');

 
  if (score == maxScore) {
    endGame(true);
  }
}

function revealAllBombs(){
  const cells  = document.querySelectorAll('.cell');
  for (let i = 1; i <= cells.length; i++){
    const cell = cells[i-1];
    if(bombsList.includes(i)) {
      console.log(i);
      cell.classList.add('cell-bomb');
    }
  }
}

function tapSound(){
  const audio = new Audio("./audios/tap.wav");
  audio.play();
}


function winSound(){
  const audio = new Audio("./audios/win.mp3");
  audio.play();
}

function showHighestScore(){
  let storedHighestScore = JSON.parse(localStorage.getItem('highestScore')) || [];
   // Check if storedHighestScore is an array
   if (Array.isArray(storedHighestScore) && storedHighestScore.length > 0) {
    let highest = Math.max(...storedHighestScore);

    // Save highest score to localStorage
    localStorage.setItem('highestScore', JSON.stringify(highest));

    let h3 = document.createElement('h3');
    h3.innerText = `Highest Score: ${highest}`;
    console.log(`Highest Score: ${highest}`);
    board.appendChild(h3);
  } else {
    console.log("No valid highest score data found.");
  }

}

for (let i = 1; i <= totalCells; i++) {

  const cell = document.createElement('div');
  cell.classList.add('cell');

  cell.addEventListener('pointerup', () => {
    tapSound();
    start.play();
    if (bombsList.includes(i)) {
      cell.classList.add('cell-bomb');
  

      // Remove one heart
      const hearts = lifes.innerText;
      lifes.innerText = hearts.slice(0, -2); 
      lifes.classList.add('blink-vibrate');
      setInterval(()=>{
        lifes.classList.remove('blink-vibrate');
      },2000);

      // Check if all hearts are removed
      if (lifes.innerText === '') {
        endGame(false); // Trigger end game with loss
        Loseaudio();
      }
    } else {
      if (!cell.classList.contains('cell-clicked')) {
        cell.classList.add('cell-clicked');

        score++;
        scoreCounter.innerText = score.toString().padStart(5, '0');

        highestScore.push(score);
        localStorage.setItem('highestScore', JSON.stringify(highestScore));

        if (score == maxScore) {
          endGame(true);
          winSound();
        }
      }
    }
  });
  grid.appendChild(cell);
}

function Loseaudio(){
  try {
    const sound = new Audio('./audios/lose.mp3');
    sound.play();
    start.pause();
  }
  catch(E){
    console.log(`error:${E}`);
  }
}

if(endGame == false){
  showHighestScore(highestScore);
}
 function endGame(isVictory) {
  if (isVictory) {
    winSound();
    endGameText.innerHTML = 'YOU<br>WON';
    endGameScreen.classList.add('win');
  }
  revealAllBombs();
  Loseaudio();
  endGameScreen.classList.remove('hidden');
}

playAgainButton.addEventListener('pointerup', () => {
  window.location.reload();
});

playAgainButton.addEventListener('pointerup', () => {
  window.location.reload();
});

window.onload = function() {
  showHighestScore();
}

