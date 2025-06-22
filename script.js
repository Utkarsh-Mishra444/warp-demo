class ImageBrushApp {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.backgroundImage = null;
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;
        
        this.initializeElements();
        this.setupEventListeners();
        this.updateToolValues();
    }

    initializeElements() {
        this.uploadBtn = document.getElementById('uploadBtn');
        this.imageUpload = document.getElementById('imageUpload');
        this.imageInfo = document.getElementById('imageInfo');
        this.canvasContainer = document.getElementById('canvasContainer');
        this.brushSize = document.getElementById('brushSize');
        this.brushSizeValue = document.getElementById('brushSizeValue');
        this.brushColor = document.getElementById('brushColor');
        this.brushOpacity = document.getElementById('brushOpacity');
        this.brushOpacityValue = document.getElementById('brushOpacityValue');
        this.clearCanvas = document.getElementById('clearCanvas');
        this.downloadResult = document.getElementById('downloadResult');
    }

    setupEventListeners() {
        // Upload functionality
        this.uploadBtn.addEventListener('click', () => this.imageUpload.click());
        this.imageUpload.addEventListener('change', (e) => this.handleImageUpload(e));

        // Tool controls
        this.brushSize.addEventListener('input', (e) => this.updateBrushSize(e));
        this.brushOpacity.addEventListener('input', (e) => this.updateBrushOpacity(e));
        this.clearCanvas.addEventListener('click', () => this.clearDrawing());
        this.downloadResult.addEventListener('click', () => this.downloadImage());
    }

    handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            this.loadImage(e.target.result, file.name);
        };
        reader.readAsDataURL(file);
    }

    loadImage(imageSrc, fileName) {
        const img = new Image();
        img.onload = () => {
            this.setupCanvas(img);
            this.showImageInfo(fileName, img.width, img.height);
        };
        img.src = imageSrc;
        this.backgroundImage = img;
    }

    setupCanvas(img) {
        // Clear container
        this.canvasContainer.innerHTML = '';

        // Determine maximum display size (keep within container and viewport)
        const containerWidth = this.canvasContainer.clientWidth || window.innerWidth * 0.9;
        const containerHeight = window.innerHeight * 0.7; // 70% of viewport height

        // Calculate scaling ratio while preserving aspect ratio
        const widthRatio = containerWidth / img.width;
        const heightRatio = containerHeight / img.height;
        const ratio = Math.min(widthRatio, heightRatio, 1); // never upscale

        const displayWidth = Math.round(img.width * ratio);
        const displayHeight = Math.round(img.height * ratio);

        // Create canvas wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'canvas-wrapper';
        // Explicitly set wrapper dimensions so flexbox can center it
        wrapper.style.width = displayWidth + 'px';
        wrapper.style.height = displayHeight + 'px';

        // Background canvas (for the uploaded image)
        const bgCanvas = document.createElement('canvas');
        bgCanvas.className = 'background-image';
        bgCanvas.width = displayWidth;
        bgCanvas.height = displayHeight;
        bgCanvas.style.width = displayWidth + 'px';
        bgCanvas.style.height = displayHeight + 'px';

        const bgCtx = bgCanvas.getContext('2d');
        bgCtx.drawImage(img, 0, 0, displayWidth, displayHeight);

        // Drawing canvas (overlay)
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'drawing-canvas';
        this.canvas.width = displayWidth;
        this.canvas.height = displayHeight;
        this.canvas.style.width = displayWidth + 'px';
        this.canvas.style.height = displayHeight + 'px';
        this.ctx = this.canvas.getContext('2d');
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        // Append canvases
        wrapper.appendChild(bgCanvas);
        wrapper.appendChild(this.canvas);
        this.canvasContainer.appendChild(wrapper);

        // Setup drawing events
        this.setupDrawingEvents();
    }

    setupDrawingEvents() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());

        // Touch events for mobile
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            const mouseEvent = new MouseEvent('mouseup', {});
            this.canvas.dispatchEvent(mouseEvent);
        });
    }

    startDrawing(e) {
        this.isDrawing = true;
        const rect = this.canvas.getBoundingClientRect();
        this.lastX = e.clientX - rect.left;
        this.lastY = e.clientY - rect.top;
    }

    draw(e) {
        if (!this.isDrawing) return;

        const rect = this.canvas.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.strokeStyle = this.brushColor.value;
        this.ctx.lineWidth = this.brushSize.value;
        this.ctx.globalAlpha = this.brushOpacity.value;

        this.ctx.beginPath();
        this.ctx.moveTo(this.lastX, this.lastY);
        this.ctx.lineTo(currentX, currentY);
        this.ctx.stroke();

        this.lastX = currentX;
        this.lastY = currentY;
    }

    stopDrawing() {
        this.isDrawing = false;
    }

    updateBrushSize(e) {
        this.brushSizeValue.textContent = e.target.value;
    }

    updateBrushOpacity(e) {
        this.brushOpacityValue.textContent = e.target.value;
    }

    clearDrawing() {
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    downloadImage() {
        if (!this.canvas || !this.backgroundImage) {
            alert('Please upload an image and draw something first!');
            return;
        }

        // Create a temporary canvas matching the DISPLAY resolution
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');

        // Draw the scaled background image
        tempCtx.drawImage(this.backgroundImage, 0, 0, tempCanvas.width, tempCanvas.height);
        // Draw the drawing layer
        tempCtx.drawImage(this.canvas, 0, 0);

        // Download link
        const link = document.createElement('a');
        link.download = 'edited-image.png';
        link.href = tempCanvas.toDataURL();
        link.click();
    }

    showImageInfo(fileName, width, height) {
        this.imageInfo.innerHTML = `
            <strong>Uploaded:</strong> ${fileName}<br>
            <strong>Dimensions:</strong> ${width} × ${height} pixels
        `;
        this.imageInfo.style.display = 'block';
    }

    updateToolValues() {
        this.brushSizeValue.textContent = this.brushSize.value;
        this.brushOpacityValue.textContent = this.brushOpacity.value;
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ImageBrushApp();
}); 