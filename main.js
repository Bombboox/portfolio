const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");

// Set canvas styles to position it properly
canvas.style.position = "fixed";
canvas.style.bottom = "0";
canvas.style.left = "0";
canvas.style.zIndex = "1"; // Above background but below content
canvas.style.pointerEvents = "none"; // Allow clicking through the canvas

// Sprite animation constants
const SPRITE_WIDTH = 32;
const SPRITE_HEIGHT = 32;
const FPS = 24;
const FRAME_TIME = 1000 / FPS;

// Animation states
const STATES = {
    WALKING: 0,
    IDLE: 1,
    JUMPING: 2
};

// Animation frames per state
const FRAMES = {
    [STATES.WALKING]: 14,
    [STATES.IDLE]: 1,
    [STATES.JUMPING]: 1
};

// Physics constants
const GRAVITY = 0.5;
const JUMP_FORCE = -12;
const MOVE_SPEED = 5;

// Lighting constants
const LIGHT_RADIUS = 150;
const LIGHT_INTENSITY = 0.8;
const PIXEL_SIZE = 8; // Increased pixel size for better performance
const LIGHT_ANIMATION_DURATION = 2000; // Duration of light animation in ms
const MAX_LIGHT_RADIUS = 2000; // Maximum radius for the light when collected
const FLASH_DURATION = 1000; // Duration of white flash in ms
const LEVEL_TRANSITION_DELAY = 1000; // Delay before showing next level (reduced to 2 seconds)

// Game state
const GAME_STATE = {
    PLAYING: 0,
    FLASHING: 1,
    TRANSITIONING: 2,
    VICTORY: 3
};

// Level design
const LEVELS = [
    {
        name: "home",
        platforms: [
            { x: 100, y: 400, width: 200, height: 20 },
            { x: 350, y: 350, width: 150, height: 20 },
            { x: 550, y: 300, width: 200, height: 20 },
            { x: 800, y: 250, width: 150, height: 20 }
        ],
        lightbulb: { x: 850, y: 220 },
        startPosition: { x: 50, y: 100 },
        completed: false
    },
    {
        name: "about",
        platforms: [
            { x: 100, y: 400, width: 150, height: 20 },
            { x: 300, y: 380, width: 120, height: 20 },
            { x: 470, y: 350, width: 100, height: 20 },
            { x: 620, y: 320, width: 100, height: 20 },
            { x: 770, y: 290, width: 150, height: 20 }
        ],
        lightbulb: { x: 820, y: 260 },
        startPosition: { x: 50, y: 100 },
        completed: false
    },
    {
        name: "projects",
        platforms: [
            { x: 100, y: 400, width: 120, height: 20 },
            { x: 270, y: 350, width: 100, height: 20 },
            { x: 420, y: 400, width: 100, height: 20 },
            { x: 570, y: 350, width: 100, height: 20 },
            { x: 720, y: 300, width: 100, height: 20 },
            { x: 870, y: 250, width: 150, height: 20 }
        ],
        lightbulb: { x: 920, y: 220 },
        startPosition: { x: 50, y: 100 },
        completed: false
    },
    {
        name: "contact",
        platforms: [
            { x: 100, y: 400, width: 100, height: 20 },
            { x: 250, y: 350, width: 80, height: 20 },
            { x: 380, y: 400, width: 80, height: 20 },
            { x: 510, y: 350, width: 80, height: 20 },
            { x: 640, y: 400, width: 80, height: 20 },
            { x: 770, y: 350, width: 80, height: 20 },
            { x: 900, y: 300, width: 150, height: 20 }
        ],
        lightbulb: { x: 950, y: 270 },
        startPosition: { x: 50, y: 100 },
        completed: false
    }
];

// Current level
let currentLevelIndex = 0;
let currentLevel = LEVELS[currentLevelIndex];
let gameState = GAME_STATE.PLAYING;
let flashStartTime = 0;
let transitionStartTime = 0;
let gameCompleted = false;

// Audio elements
const backgroundMusic = new Audio("music.mp3");
backgroundMusic.loop = true;
backgroundMusic.volume = 0.3;

const victorySound = new Audio("victory.mp3");
victorySound.volume = 0.5;

// Lightbulb object
const LIGHTBULB = { 
    x: currentLevel.lightbulb.x, 
    y: currentLevel.lightbulb.y, 
    width: 30, 
    height: 30, 
    collected: false,
    collectedTime: 0 
};

// Arrow animation
const ARROW = {
    y: 0,
    animationOffset: 0,
    visible: false
};

// Pre-render the light gradient for better performance
const createLightGradient = (radius) => {
    const gradientCanvas = document.createElement('canvas');
    gradientCanvas.width = radius * 2;
    gradientCanvas.height = radius * 2;
    const gradientCtx = gradientCanvas.getContext('2d');
    
    const gradient = gradientCtx.createRadialGradient(
        radius, radius, 0,
        radius, radius, radius
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.53)');
    gradient.addColorStop(1, 'rgba(255, 255, 200, 0)');
    
    gradientCtx.fillStyle = gradient;
    gradientCtx.fillRect(0, 0, radius * 2, radius * 2);
    
    return gradientCanvas;
};

// Pre-render light gradients of different sizes
const lightGradients = {};
for (let r = LIGHT_RADIUS; r <= MAX_LIGHT_RADIUS; r += 100) {
    lightGradients[r] = createLightGradient(r);
}

// Sprite class to handle animations
class Sprite {
    constructor(imageSrc, width, height) {
        this.image = new Image();
        this.image.src = imageSrc;
        this.width = width;
        this.height = height;
        this.currentState = STATES.IDLE;
        this.currentFrame = 0;
        this.lastFrameTime = 0;
        this.x = currentLevel.startPosition.x;
        this.y = currentLevel.startPosition.y;
        this.scale = 2.5; // Scale up the sprite for visibility
        
        // Physics properties
        this.velocityX = 0;
        this.velocityY = 0;
        this.isJumping = false;
        this.direction = 1; // 1 for right, -1 for left
    }

    update(timestamp) {
        if (gameState !== GAME_STATE.PLAYING && gameState !== GAME_STATE.VICTORY) return;
        
        if (timestamp - this.lastFrameTime > FRAME_TIME) {
            this.currentFrame = (this.currentFrame + 1) % FRAMES[this.currentState];
            this.lastFrameTime = timestamp;
        }
        
        // Apply physics
        this.velocityY += GRAVITY;
        this.y += this.velocityY;
        this.x += this.velocityX;
        
        // Platform collision - only check if level is not completed
        let onPlatform = false;
        if (!currentLevel.completed) {
            for (const platform of currentLevel.platforms) {
                // Check if player is on a platform
                if (this.velocityY >= 0 && 
                    this.x + this.width * this.scale > platform.x && 
                    this.x < platform.x + platform.width &&
                    this.y + this.height * this.scale > platform.y && 
                    this.y + this.height * this.scale < platform.y + platform.height + 10) {
                    this.y = platform.y - this.height * this.scale;
                    this.velocityY = 0;
                    this.isJumping = false;
                    onPlatform = true;
                }
            }
        }
        
        // Ground collision
        const ground = canvas.height - this.height * this.scale;
        if (this.y > ground) {
            this.y = ground;
            this.velocityY = 0;
            this.isJumping = false;
        }
        
        // Wall collision
        if (this.x < 0) {
            if (gameCompleted || currentLevelIndex > 0) {
                // Allow moving left to previous level if game is completed or not on first level
                if (currentLevelIndex > 0) {
                    currentLevelIndex--;
                    currentLevel = LEVELS[currentLevelIndex];
                    LIGHTBULB.x = currentLevel.lightbulb.x;
                    LIGHTBULB.y = currentLevel.lightbulb.y;
                    LIGHTBULB.collected = currentLevel.completed;
                    this.x = canvas.width - this.width * this.scale - 10;
                    this.y = currentLevel.startPosition.y;
                    
                    // Reset velocities and state
                    this.velocityX = 0;
                    this.velocityY = 0;
                    this.isJumping = false;
                    this.setState(STATES.IDLE);
                    
                    // Show the corresponding page
                    showPage(currentLevel.name);
                }
            } else {
                this.x = 0;
            }
        }
        
        // Level transition when moving right past canvas edge
        if (this.x > canvas.width - this.width * this.scale) {
            if (currentLevel.completed && currentLevelIndex < LEVELS.length - 1) {
                // Move to next level
                currentLevelIndex++;
                currentLevel = LEVELS[currentLevelIndex];
                LIGHTBULB.x = currentLevel.lightbulb.x;
                LIGHTBULB.y = currentLevel.lightbulb.y;
                LIGHTBULB.collected = currentLevel.completed;
                this.x = currentLevel.startPosition.x;
                this.y = currentLevel.startPosition.y;
                
                // Reset velocities and state
                this.velocityX = 0;
                this.velocityY = 0;
                this.isJumping = false;
                this.setState(STATES.IDLE);
                
                // Reset arrow visibility
                ARROW.visible = false;
                
                // Show the corresponding page
                showPage(currentLevel.name);
            } else {
                this.x = canvas.width - this.width * this.scale;
            }
        }
        
        // Lightbulb collision
        if (!LIGHTBULB.collected &&
            this.x + this.width * this.scale > LIGHTBULB.x && 
            this.x < LIGHTBULB.x + LIGHTBULB.width &&
            this.y + this.height * this.scale > LIGHTBULB.y && 
            this.y < LIGHTBULB.y + LIGHTBULB.height) {
            LIGHTBULB.collected = true;
            LIGHTBULB.collectedTime = timestamp;
            gameState = GAME_STATE.FLASHING;
            flashStartTime = timestamp;
            
            // Mark level as completed
            currentLevel.completed = true;
            
            // Check if this is the last level
            if (currentLevelIndex === LEVELS.length - 1) {
                gameCompleted = true;
                // Play victory sound
                victorySound.play();
                // Show navigation bar
                document.querySelector('nav').style.display = 'block';
                // Make the navigation bar visible when game is completed
                document.querySelector('nav').style.opacity = '1';
                document.querySelector('nav').style.visibility = 'visible';
            } else {
                // Show arrow to indicate next level only if not the last level
                ARROW.visible = true;
            }
            
            // Show the corresponding page only when lightbulb is collected
            showPage(currentLevel.name);
            
            // Set up email functionality for contact form if this is the contact level
            if (currentLevel.name === "contact") {
                setupContactForm();
            }
        }
    }

    setState(state) {
        if (this.currentState !== state) {
            this.currentState = state;
            this.currentFrame = 0;
        }
    }
    
    jump() {
        if (!this.isJumping && (gameState === GAME_STATE.PLAYING || gameState === GAME_STATE.VICTORY)) {
            this.velocityY = JUMP_FORCE;
            this.isJumping = true;
            this.setState(STATES.JUMPING);
        }
    }
    
    moveLeft() {
        if (gameState === GAME_STATE.PLAYING || gameState === GAME_STATE.VICTORY) {
            this.velocityX = -MOVE_SPEED;
            this.direction = -1;
            if (!this.isJumping) {
                this.setState(STATES.WALKING);
            }
        }
    }
    
    moveRight() {
        if (gameState === GAME_STATE.PLAYING || gameState === GAME_STATE.VICTORY) {
            this.velocityX = MOVE_SPEED;
            this.direction = 1;
            if (!this.isJumping) {
                this.setState(STATES.WALKING);
            }
        }
    }
    
    stop() {
        if (gameState === GAME_STATE.PLAYING || gameState === GAME_STATE.VICTORY) {
            this.velocityX = 0;
            if (!this.isJumping) {
                this.setState(STATES.IDLE);
            }
        }
    }

    draw() {
        // Save context to apply flip if needed
        ctx.save();
        
        if (this.direction === -1) {
            // Flip horizontally for left direction
            ctx.scale(-1, 1);
            ctx.drawImage(
                this.image,
                this.currentFrame * this.width,
                this.currentState * this.height,
                this.width,
                this.height,
                -this.x - this.width * this.scale, // Adjust x position when flipped
                this.y,
                this.width * this.scale,
                this.height * this.scale
            );
        } else {
            ctx.drawImage(
                this.image,
                this.currentFrame * this.width,
                this.currentState * this.height,
                this.width,
                this.height,
                this.x,
                this.y,
                this.width * this.scale,
                this.height * this.scale
            );
        }
        
        ctx.restore();
        
        // Draw arrow above player if visible and not in victory state
        if (ARROW.visible && gameState === GAME_STATE.PLAYING && !gameCompleted) {
            drawArrow(this.x + (this.width * this.scale) / 2 - 10, this.y - 40); // Moved 10px to the left
        }
    }
}

// Function to set up the contact form email functionality
function setupContactForm() {
    const contactForm = document.querySelector('#contact form');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const message = document.getElementById('message').value;
            const subject = "Contact from Portfolio Website";
            
            // Create mailto link with form data
            const mailtoLink = `mailto:apetrosyan2431@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`)}`;
            
            // Open the user's email client
            window.location.href = mailtoLink;
        });
    }
}

// Function to show a specific page of the portfolio
function showPage(pageName) {
    // Hide all pages
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => {
        page.classList.remove('active');
    });
    
    // Show the specified page only if its level is completed
    const targetLevel = LEVELS.find(level => level.name === pageName);
    if (targetLevel && targetLevel.completed) {
        const targetPage = document.getElementById(pageName);
        if (targetPage) {
            targetPage.classList.add('active');
        }
        
        // Set up contact form if this is the contact page
        if (pageName === "contact") {
            setupContactForm();
        }
    }
}

// Function to draw right arrow
function drawArrow(x, y) {
    // Animate arrow up and down
    ARROW.animationOffset = Math.sin(Date.now() / 200) * 10;
    
    // Draw right arrow
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
    ctx.beginPath();
    ctx.moveTo(x, y + ARROW.animationOffset);
    ctx.lineTo(x + 20, y + 10 + ARROW.animationOffset);
    ctx.lineTo(x, y + 20 + ARROW.animationOffset);
    ctx.fill();
    ctx.restore();
}

// Optimized function to draw the light effect
function drawLight(x, y, radius, intensity, timestamp) {
    ctx.globalCompositeOperation = 'lighter';
    
    // Find the closest pre-rendered gradient
    const closestRadius = Object.keys(lightGradients)
        .map(Number)
        .reduce((prev, curr) => 
            Math.abs(curr - radius) < Math.abs(prev - radius) ? curr : prev
        );
    
    const gradient = lightGradients[closestRadius];
    const scale = radius / closestRadius;
    
    // Draw the gradient at the specified position with appropriate scaling
    ctx.globalAlpha = intensity;
    ctx.drawImage(
        gradient, 
        x - radius, 
        y - radius, 
        radius * 2, 
        radius * 2
    );
    
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';
}

let slime;
const keys = {};
const main = () => {
    canvas.style.backgroundColor = "rgba(0, 0, 0, 0.3)"; // More transparent background to make pages more visible
    document.body.appendChild(canvas);
    resizeCanvas();
    
    // Initialize the slime sprite
    slime = new Sprite("sprites/slime.png", SPRITE_WIDTH, SPRITE_HEIGHT);
    
    // Track key states
    window.addEventListener("keydown", (e) => {
        keys[e.key] = true;
        
        if (e.key === "ArrowUp" || e.key === " ") {
            slime.jump();
        }
        
        // Play background music on first user interaction
        if (backgroundMusic.paused) {
            backgroundMusic.play().catch(error => {
                console.log("Audio playback failed:", error);
            });
        }
    });
    
    window.addEventListener("keyup", (e) => {
        keys[e.key] = false;
    });
    
    // Hide all pages initially
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => {
        page.classList.remove('active');
    });
    
    // Hide navigation bar initially
    document.querySelector('nav').style.display = 'none';
    
    // Don't autoplay music - wait for user interaction
    
    requestAnimationFrame(draw);
}

resizeCanvas = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

const drawPlatforms = (playerX, playerY, lightRadius) => {
    // Only draw platforms if the level is not completed
    if (!currentLevel.completed) {
        for (const platform of currentLevel.platforms) {
            // Calculate distance from player to platform center
            const platformCenterX = platform.x + platform.width / 2;
            const platformCenterY = platform.y + platform.height / 2;
            const dx = platformCenterX - playerX;
            const dy = platformCenterY - playerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Calculate visibility based on distance from light
            const visibility = Math.max(0, 1 - (distance / lightRadius));
            
            // Set platform color based on visibility
            const alpha = 0.2 + visibility * 0.6; // Increased base visibility to 0.2, max of 0.8
            ctx.fillStyle = `rgba(85, 85, 85, ${alpha})`;
            ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
            
            // Add a subtle outline for platforms in light
            if (visibility > 0.3) {
                ctx.strokeStyle = `rgba(120, 120, 120, ${visibility * 0.7})`;
                ctx.lineWidth = 1;
                ctx.strokeRect(platform.x, platform.y, platform.width, platform.height);
            }
        }
    }
}

const drawLightbulb = () => {
    if (!LIGHTBULB.collected) {
        ctx.font = "30px Arial";
        ctx.fillText("💡", LIGHTBULB.x, LIGHTBULB.y + 25);
    }
}

const drawFlash = (timestamp) => {
    const flashProgress = (timestamp - flashStartTime) / FLASH_DURATION;
    
    if (flashProgress < 0.5) {
        // Increasing brightness
        const opacity = flashProgress * 2;
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (flashProgress < 1) {
        // Decreasing brightness
        const opacity = 2 - flashProgress * 2;
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
        // Flash complete, transition to next state
        gameState = gameCompleted ? GAME_STATE.VICTORY : GAME_STATE.TRANSITIONING;
        transitionStartTime = timestamp;
    }
}

const draw = (timestamp) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background
    ctx.fillStyle = "rgba(17, 17, 17, 0.3)"; // More transparent background to make pages more visible
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (slime) {
        // Handle game state
        if (gameState === GAME_STATE.FLASHING) {
            // Draw the flash effect
            drawFlash(timestamp);
        } else if (gameState === GAME_STATE.TRANSITIONING) {
            // Wait for transition period then return to playing
            if (timestamp - transitionStartTime > LEVEL_TRANSITION_DELAY) {
                gameState = GAME_STATE.PLAYING;
            }
        }
        
        // Handle movement based on key states
        if (keys["ArrowLeft"]) {
            slime.moveLeft();
        } else if (keys["ArrowRight"]) {
            slime.moveRight();
        } else {
            slime.stop();
        }
        
        slime.update(timestamp);
        
        // Calculate player center
        const centerX = slime.x + (slime.width * slime.scale) / 2;
        const centerY = slime.y + (slime.height * slime.scale) / 2;
        
        // Calculate current light radius
        let currentRadius = LIGHT_RADIUS;
        
        // Draw platforms with lighting effect only if level is not completed
        drawPlatforms(centerX, centerY, currentRadius);
        
        // Draw lightbulb
        drawLightbulb();
        
        // Draw player
        slime.draw();
        
        // Only draw light if level is not completed
        if (!currentLevel.completed && gameState === GAME_STATE.PLAYING) {
            // Player light only
            drawLight(centerX, centerY, LIGHT_RADIUS, LIGHT_INTENSITY, timestamp);
        }
        
        // Only show instructions if game is not completed
        if (!gameCompleted) {
            ctx.font = "16px Arial";
            ctx.fillStyle = "white";
            ctx.fillText(`Level: ${currentLevelIndex + 1}/${LEVELS.length}`, 20, 30);
            ctx.fillText("Controls:", 20, 55);
            ctx.fillText("← → : Move left/right", 20, 80);
            ctx.fillText("↑ : Jump", 20, 105);
            ctx.fillText("Find the lightbulb 💡 to unlock the next page!", 20, 130);
            
            if (currentLevel.completed && currentLevelIndex < LEVELS.length - 1) {
                ctx.fillText("Level completed! Move right to continue →", 20, 155);
            }
        }
    }
    
    requestAnimationFrame(draw);
}

window.onload = main;
window.addEventListener("resize", resizeCanvas);