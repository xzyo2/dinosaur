"use strict";

// Preload images from the "Sprite" folder.
const dinoImage = new Image();
const birdImage = new Image();
const cactusImage = new Image();
const backgroundImage = new Image();
const backgroundImage2 = new Image();  // second background for transition

dinoImage.src = "Sprite/dino.png";
birdImage.src = "Sprite/bird.png";
cactusImage.src = "Sprite/cactus.png";
backgroundImage.src = "Sprite/background.png";
backgroundImage2.src = "Sprite/background2.png";

// Load sound files from the "Sounds" folder.
const soundStart = new Audio("Sounds/start.mp4");
const soundHappy = new Audio("Sounds/happy.mp4");
soundHappy.loop = true;
const soundJump = new Audio("Sounds/jump.mp4");
const soundDead = new Audio("Sounds/dead.mp4");
const soundCreep = new Audio("Sounds/creep.mp4");
soundCreep.loop = true;
const soundCongrats = new Audio("Sounds/congrats.mp4");
const soundAboutToEnd = new Audio("Sounds/abouttoend.mp4");

// Utility: play a sound if not already playing.
function playSound(sound) {
  if (sound.paused) {
    sound.currentTime = 0;
    sound.play();
  }
}

// Particle class for visual effects.
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 4;
    this.vy = (Math.random() - 0.5) * 4;
    this.life = 50 + Math.random() * 30;
    this.color = color;
    this.alpha = 1;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
    this.alpha = this.life / 80;
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Main Game class.
class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.resize();
    window.addEventListener("resize", () => this.resize());

    // Base settings.
    this.baseSpeed = 8;
    this.gameSpeed = this.baseSpeed;
    this.gravity = 0.6; // Increased gravity for a snappier jump.
    this.score = 0;
    this.highScore = localStorage.getItem("highScore") || 0;
    this.scoreTimer = 0; // For time-based score increment.
    this.gameOver = false;
    this.lastTime = 0;
    this.obstacleTimer = 0;
    this.obstacleInterval = 1500; // Initial interval.
    this.backgroundX = 0;
    
    // Effects & particles.
    this.particles = [];
    this.lastScoreEffect = 0; // Trigger burst effect every +100 score.
    
    // Sound state.
    this.bgm = "happy"; // "happy" or "creep"
    this.aboutToEndPlayed = false;
    
    // Create player and obstacle list.
    this.player = new Player(this);
    this.obstacles = [];
    
    this.initControls();
    
    // Start audio: play start sound, then happy bg music.
    playSound(soundStart);
    soundStart.addEventListener("ended", () => {
      playSound(soundHappy);
    });
    // Also ensure happy music plays if start finishes quickly.
    playSound(soundHappy);
    
    this.lastTime = performance.now();
    requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
  }
  
  initControls() {
    // Keyboard controls: jump (Space/Up) and duck (Down)
    window.addEventListener("keydown", (e) => {
      if (!this.gameOver) {
        if (e.code === "Space" || e.code === "ArrowUp") {
          this.player.jump();
        }
        if (e.code === "ArrowDown") {
          this.player.startDuck();
        }
      }
      if (e.code === "KeyR" && this.gameOver) {
        this.resetGame();
      }
    });
    window.addEventListener("keyup", (e) => {
      if (e.code === "ArrowDown") {
        this.player.endDuck();
      }
    });
    // Touch controls: tap to jump; hold to duck.
    let touchTimer;
    window.addEventListener("touchstart", (e) => {
      e.preventDefault();
      if (!this.gameOver) {
        touchTimer = setTimeout(() => {
          this.player.startDuck();
        }, 200);
      } else {
        this.resetGame();
      }
    });
    window.addEventListener("touchend", (e) => {
      clearTimeout(touchTimer);
      if (this.player.ducking) {
        this.player.endDuck();
      } else if (!this.player.hasJumped) {
        this.player.jump();
      }
      this.player.hasJumped = false;
    });
  }
  
  resetGame() {
    this.score = 0;
    this.gameOver = false;
    this.obstacles = [];
    this.gameSpeed = this.baseSpeed;
    this.player.reset();
    this.lastScoreEffect = 0;
    this.particles = [];
    this.scoreTimer = 0;
    this.aboutToEndPlayed = false;
    // Reset background music.
    this.bgm = "happy";
    soundCreep.pause();
    soundHappy.currentTime = 0;
    playSound(soundHappy);
    this.lastTime = performance.now();
    requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
  }
  
  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }
  
  gameLoop(timestamp) {
    if (this.gameOver) {
      this.displayGameOver();
      return;
    }
    const deltaTime = timestamp - this.lastTime;
    this.lastTime = timestamp;
    
    this.update(deltaTime);
    this.draw();
    requestAnimationFrame((ts) => this.gameLoop(ts));
  }
  
  update(deltaTime) {
    // Gradually increase speed, but cap at 15.
    this.gameSpeed = Math.min(this.baseSpeed + (this.score * 0.02), 15);
    
    // Scroll background.
    this.backgroundX -= this.gameSpeed / 2;
    if (this.backgroundX <= -this.canvas.width) {
      this.backgroundX = 0;
    }
    
    this.player.update(deltaTime);
    
    // Spawn obstacles with a minimum interval of 1000ms.
    this.obstacleTimer += deltaTime;
    let currentInterval = Math.max(1000, this.obstacleInterval - (this.score * 5));
    if (this.obstacleTimer > currentInterval) {
      this.spawnObstacle();
      this.obstacleTimer = 0;
    }
    
    // Update obstacles and check collisions.
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      let obs = this.obstacles[i];
      obs.update(deltaTime);
      if (obs.x + obs.width < 0) {
        this.obstacles.splice(i, 1);
      }
      if (obs.collidesWith(this.player)) {
        // Spawn collision confetti at player's center.
        if (!this.gameOver) {
          let playerWidth = this.player.ducking ? this.player.duckWidth : this.player.standWidth;
          let playerHeight = this.player.ducking ? this.player.duckHeight : this.player.standHeight;
          let centerX = this.player.x + playerWidth / 2;
          let centerY = this.player.y + playerHeight / 2;
          this.spawnCollisionEffect(centerX, centerY);
        }
        playSound(soundDead);
        soundHappy.pause();
        soundCreep.pause();
        this.gameOver = true;
      }
    }
    
    // Increase score over time: +1 every 100ms.
    this.scoreTimer += deltaTime;
    if (this.scoreTimer >= 100) {
      let inc = Math.floor(this.scoreTimer / 100);
      this.score += inc;
      this.scoreTimer %= 100;
      if (this.score > this.highScore) {
        this.highScore = this.score;
        localStorage.setItem("highScore", this.highScore);
      }
      // Cap score at 2000 (winning condition).
      if (this.score >= 2000) {
        this.score = 2000;
        this.gameOver = true;
      }
    }
    
    // Every +100 score, trigger burst effect and play congrats sound.
    if (this.score >= this.lastScoreEffect + 100) {
      this.spawnScoreEffect();
      playSound(soundCongrats);
      this.lastScoreEffect = this.score;
    }
    
    // Manage background music transitions.
    if (this.score >= 1000 && this.score < 1500) {
      if (this.bgm !== "creep") {
        soundHappy.pause();
        soundCreep.currentTime = 0;
        playSound(soundCreep);
        this.bgm = "creep";
        this.aboutToEndPlayed = false;
      }
      if (this.score >= 1400 && !this.aboutToEndPlayed) {
        playSound(soundAboutToEnd);
        this.aboutToEndPlayed = true;
      }
    } else {
      if (this.bgm !== "happy") {
        soundCreep.pause();
        soundHappy.currentTime = 0;
        playSound(soundHappy);
        this.bgm = "happy";
      }
    }
    
    // Update particles.
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update();
      if (this.particles[i].life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }
  
  spawnScoreEffect() {
    const numParticles = 30;
    const x = this.canvas.width / 2;
    const y = this.canvas.height / 2;
    for (let i = 0; i < numParticles; i++) {
      let color = `hsl(${Math.random() * 360}, 100%, 50%)`;
      this.particles.push(new Particle(x, y, color));
    }
  }
  
  spawnCollisionEffect(x, y) {
    const numParticles = 80;
    for (let i = 0; i < numParticles; i++) {
      let color = `hsl(${Math.random() * 360}, 100%, 50%)`;
      this.particles.push(new Particle(x, y, color));
    }
  }
  
  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw background with smooth transition.
    if (this.score < 1000 || this.score >= 1500) {
      this.ctx.drawImage(backgroundImage, this.backgroundX, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(backgroundImage, this.backgroundX + this.canvas.width, 0, this.canvas.width, this.canvas.height);
    } else {
      let alpha;
      if (this.score < 1250) {
        alpha = (this.score - 1000) / 250;
      } else {
        alpha = (1500 - this.score) / 250;
      }
      this.ctx.drawImage(backgroundImage, this.backgroundX, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(backgroundImage, this.backgroundX + this.canvas.width, 0, this.canvas.width, this.canvas.height);
      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.drawImage(backgroundImage2, this.backgroundX, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(backgroundImage2, this.backgroundX + this.canvas.width, 0, this.canvas.width, this.canvas.height);
      this.ctx.restore();
    }
    
    // Draw ground.
    this.ctx.fillStyle = "#333";
    this.ctx.fillRect(0, this.canvas.height - 50, this.canvas.width, 50);
    
    // Draw player and obstacles.
    this.player.draw(this.ctx);
    this.obstacles.forEach(obs => obs.draw(this.ctx));
    
    // Draw particles.
    this.particles.forEach(p => p.draw(this.ctx));
    
    // Special overlay when score is between 1000 and 1500.
    if (this.score >= 1000 && this.score < 1500) {
      let pulse = (Math.sin(this.lastTime / 200) + 1) / 2;
      let gradient = this.ctx.createRadialGradient(
        this.canvas.width / 2, this.canvas.height / 2, 0,
        this.canvas.width / 2, this.canvas.height / 2, this.canvas.width / 1.5
      );
      gradient.addColorStop(0, `rgba(255, 215, 0, ${0.3 * pulse})`);
      gradient.addColorStop(1, `rgba(255, 69, 0, 0)`);
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    // Draw score text.
    this.drawScore();
  }
  
  drawScore() {
    let gradient = this.ctx.createLinearGradient(20, 0, 220, 0);
    gradient.addColorStop("0", "#ff8c00");
    gradient.addColorStop("0.5", "#ffd700");
    gradient.addColorStop("1.0", "#ff8c00");
    this.ctx.fillStyle = gradient;
    this.ctx.font = "bold 40px Helvetica";
    this.ctx.shadowColor = "rgba(0,0,0,0.5)";
    this.ctx.shadowBlur = 4;
    this.ctx.textAlign = "left";
    this.ctx.fillText("Score: " + this.score, 20, 50);
    this.ctx.fillText("High Score: " + this.highScore, 20, 100);
    this.ctx.shadowBlur = 0;
  }
  
  displayGameOver() {
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = "#FFF";
    this.ctx.font = "bold 60px Helvetica";
    this.ctx.textAlign = "center";
    let message = this.score >= 2000 ? "YEY!" : "patay";
    let pulse = (Math.sin(this.lastTime / 300) + 1) / 2;
    this.ctx.fillText(message, this.canvas.width / 2, this.canvas.height / 2 - 50 - pulse * 10);
    this.ctx.font = "30px Helvetica";
    this.ctx.fillText("Press R to Restart", this.canvas.width / 2, this.canvas.height / 2 + 20);
  }
  
  spawnObstacle() {
    const obstacleType = Math.random() < 0.6 ? "cactus" : "bird";
    if (obstacleType === "cactus") {
      const groupCount = Math.random() < 0.3 ? Math.floor(Math.random() * 2) + 2 : 1;
      const gap = 10;
      for (let i = 0; i < groupCount; i++) {
        let obs = new Obstacle(this, "cactus", groupCount > 1);
        obs.x += i * (obs.width + gap);
        this.obstacles.push(obs);
      }
    } else if (obstacleType === "bird") {
      this.obstacles.push(new Obstacle(this, "bird"));
    }
  }
}

// Player class.
class Player {
  constructor(game) {
    this.game = game;
    this.standWidth = 100;
    this.standHeight = 100;
    this.duckWidth = 120;
    this.duckHeight = 60;
    this.x = 50;
    this.y = game.canvas.height - 50 - this.standHeight;
    this.vy = 0;
    this.grounded = true;
    this.ducking = false;
    this.hasJumped = false;
  }
  reset() {
    this.x = 50;
    this.vy = 0;
    this.grounded = true;
    this.ducking = false;
    this.y = this.game.canvas.height - 50 - this.standHeight;
  }
  jump() {
    if (this.grounded && !this.ducking) {
      this.vy = -15;
      this.grounded = false;
      this.hasJumped = true;
      playSound(soundJump);
    }
  }
  startDuck() {
    if (this.grounded) {
      this.ducking = true;
      this.y = this.game.canvas.height - 50 - this.duckHeight;
    }
  }
  endDuck() {
    if (this.ducking) {
      this.ducking = false;
      this.y = this.game.canvas.height - 50 - this.standHeight;
    }
  }
  update(deltaTime) {
    this.vy += this.game.gravity;
    // If in air and ducking, apply extra gravity for a fast fall.
    if (!this.grounded && this.ducking) {
      this.vy += this.game.gravity;
    }
    this.y += this.vy;
    const currentHeight = this.ducking ? this.duckHeight : this.standHeight;
    if (this.y + currentHeight >= this.game.canvas.height - 50) {
      this.y = this.game.canvas.height - 50 - currentHeight;
      this.vy = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }
  }
  draw(ctx) {
    const drawWidth = this.ducking ? this.duckWidth : this.standWidth;
    const drawHeight = this.ducking ? this.duckHeight : this.standHeight;
    ctx.drawImage(dinoImage, this.x, this.y, drawWidth, drawHeight);
  }
}

// Obstacle class.
class Obstacle {
  constructor(game, type, isGroup = false) {
    this.game = game;
    this.type = type;
    this.x = game.canvas.width;
    if (type === "cactus") {
      this.baseWidth = 50;
      this.baseHeight = 50;
      this.scale = isGroup ? (1 + Math.random() * 0.3) : (1 + Math.random() * 0.5);
      this.width = this.baseWidth * this.scale;
      this.height = this.baseHeight * this.scale;
      this.y = game.canvas.height - 50 - this.height;
      this.image = cactusImage;
    } else if (type === "bird") {
      this.width = 50;
      this.height = 50;
      this.y = game.canvas.height - 200 - Math.random() * 50;
      this.image = birdImage;
      this.oscillation = Math.random() * Math.PI * 2;
    }
  }
  update(deltaTime) {
    this.x -= this.game.gameSpeed;
    if (this.type === "bird") {
      this.y += Math.sin(Date.now() / 200 + this.oscillation) * 1.5;
    }
  }
  draw(ctx) {
    ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
  }
  collidesWith(player) {
    const playerWidth = player.ducking ? player.duckWidth : player.standWidth;
    const playerHeight = player.ducking ? player.duckHeight : player.standHeight;
    return !(
      player.x > this.x + this.width ||
      player.x + playerWidth < this.x ||
      player.y > this.y + this.height ||
      player.y + playerHeight < this.y
    );
  }
}

// Wait for images to load before starting.
let imagesLoaded = 0;
const totalImages = 5;
[dinoImage, birdImage, cactusImage, backgroundImage, backgroundImage2].forEach((img) => {
  img.onload = () => {
    imagesLoaded++;
    if (imagesLoaded === totalImages) {
      const canvas = document.getElementById("gameCanvas");
      new Game(canvas);
    }
  };
});
