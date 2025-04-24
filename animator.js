class Animator {
    constructor(spriteSheet, frameWidth, frameHeight) {
        this.spriteSheet = spriteSheet;
        this.frameWidth = frameWidth;
        this.frameHeight = frameHeight;
        this.states = {};
        this.currentState = null;
        this.currentFrame = 0;
        this.frameTimer = 0;
        this.x = 0;
        this.y = 0;
    }

    addState(stateName, row, frameCount, frameDelay) {
        this.states[stateName] = {
            row: row,
            frameCount: frameCount,
            frameDelay: frameDelay
        };

        // Set as current state if it's the first one added
        if (this.currentState === null) {
            this.setState(stateName);
        }
    }

    setState(stateName) {
        if (this.states[stateName]) {
            // Don't do anything if setting to the current state
            if (this.currentState === stateName) {
                return;
            }
            this.currentState = stateName;
            this.currentFrame = 0;
            this.frameTimer = 0;
        } else {
            console.error(`Animation state "${stateName}" does not exist`);
        }
    }

    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }

    update(deltaTime) {
        if (!this.currentState) return;

        const state = this.states[this.currentState];
        
        this.frameTimer += deltaTime;
        
        if (this.frameTimer >= state.frameDelay) {
            // Move to next frame
            this.currentFrame = (this.currentFrame + 1) % state.frameCount;
            this.frameTimer = 0;
        }
    }

    draw(ctx) {
        if (!this.currentState) return;
        
        const state = this.states[this.currentState];
        
        // Calculate source rectangle from sprite sheet
        const sx = this.currentFrame * this.frameWidth;
        const sy = state.row * this.frameHeight;
        
        ctx.drawImage(
            this.spriteSheet,
            sx, sy, this.frameWidth, this.frameHeight,
            this.x, this.y, this.frameWidth, this.frameHeight
        );
    }
}
