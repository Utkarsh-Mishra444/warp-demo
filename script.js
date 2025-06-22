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
        // New elements for warp / heatmap
        this.warpStrength = document.getElementById('warpStrength');
        this.warpStrengthValue = document.getElementById('warpStrengthValue');
        this.applyWarp = document.getElementById('applyWarp');
        this.toggleHeatmap = document.getElementById('toggleHeatmap');
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
        // New listeners
        this.warpStrength.addEventListener('input', (e)=> this.updateWarpStrength(e));
        this.applyWarp.addEventListener('click', ()=> this.runWarp());
        this.toggleHeatmap.addEventListener('change', ()=> this.updateHeatmapVisibility());
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

        // Save references for later warp processing
        this.bgCanvas = bgCanvas;
        this.bgCtx = bgCtx;

        // Heatmap canvas (visual + data)
        this.heatmapCanvas = document.createElement('canvas');
        this.heatmapCanvas.className = 'heatmap-canvas';
        this.heatmapCanvas.width = displayWidth;
        this.heatmapCanvas.height = displayHeight;
        this.heatmapCanvas.style.width = displayWidth + 'px';
        this.heatmapCanvas.style.height = displayHeight + 'px';
        this.heatCtx = this.heatmapCanvas.getContext('2d');

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
        wrapper.appendChild(this.heatmapCanvas);
        wrapper.appendChild(this.canvas);
        this.canvasContainer.appendChild(wrapper);

        // Setup drawing events
        this.setupDrawingEvents();
        this.updateHeatmapVisibility();
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

        // also draw to heatmap
        if(this.heatCtx){
            this.heatCtx.fillStyle = 'rgba(255,0,0,0.2)';
            this.heatCtx.beginPath();
            this.heatCtx.arc(currentX, currentY, this.brushSize.value/2, 0, Math.PI*2);
            this.heatCtx.fill();
        }

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

    updateWarpStrength(e){
        this.warpStrengthValue.textContent = e.target.value;
    }

    updateHeatmapVisibility(){
        if(this.heatmapCanvas){
            this.heatmapCanvas.style.display = this.toggleHeatmap.checked ? 'block' : 'none';
        }
    }

    runWarp(){
        if(!this.bgCanvas || !this.heatmapCanvas) return;
        const bgCtx = this.bgCtx;
        const originalImgData = bgCtx.getImageData(0,0,this.bgCanvas.width,this.bgCanvas.height);
        const attentionData = this.heatCtx.getImageData(0,0,this.heatmapCanvas.width,this.heatmapCanvas.height);
        const strength = parseFloat(this.warpStrength.value);
        warpImageProcessor(originalImgData, attentionData, strength).then((warped)=>{
            bgCtx.putImageData(warped,0,0);
            // clear drawing & heatmap
            this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
            this.heatCtx.clearRect(0,0,this.heatmapCanvas.width,this.heatmapCanvas.height);
        });
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ImageBrushApp();
});

// Add warpImageProcessor util (axis aligned strip warp) minimal version
function warpImageProcessor(originalImageData, attentionMapImageData, warpStrengthFactor){
    return new Promise((resolve)=>{
        const width = originalImageData.width;
        const height = originalImageData.height;
        const warpedImageData = new ImageData(width,height);
        const epsilon=1e-6;
        // Build attention probability distribution from alpha channel
        const attentionProbDist = new Float32Array(width*height);
        let totalAttention=0;
        for(let y=0;y<height;y++){
            for(let x=0;x<width;x++){
                const alpha = attentionMapImageData.data[(y*width+x)*4+3]/255.0;
                attentionProbDist[y*width+x]=alpha;
                totalAttention+=alpha;
            }
        }
        if(totalAttention<epsilon){ // uniform if no attention
            const uniform=1.0/(width*height);
            attentionProbDist.fill(uniform);
        }else{
            for(let i=0;i<attentionProbDist.length;i++){
                attentionProbDist[i]/=totalAttention;
            }
        }
        // Compute PMF X & Y
        const pmfX=new Float32Array(width).fill(0);
        const pmfY=new Float32Array(height).fill(0);
        for(let y=0;y<height;y++){
            for(let x=0;x<width;x++){
                const p = attentionProbDist[y*width+x];
                pmfX[x]+=p;
                pmfY[y]+=p;
            }
        }
        // Blend with uniform
        for(let x=0;x<width;x++) pmfX[x]=(1-warpStrengthFactor)*(1/width)+warpStrengthFactor*pmfX[x];
        for(let y=0;y<height;y++) pmfY[y]=(1-warpStrengthFactor)*(1/height)+warpStrengthFactor*pmfY[y];
        // Normalize
        let sumX=pmfX.reduce((a,b)=>a+b,0);
        for(let x=0;x<width;x++) pmfX[x]/=sumX;
        let sumY=pmfY.reduce((a,b)=>a+b,0);
        for(let y=0;y<height;y++) pmfY[y]/=sumY;
        // Build CDFs
        const cdfX=new Float32Array(width);
        const cdfY=new Float32Array(height);
        cdfX[0]=pmfX[0];
        for(let x=1;x<width;x++) cdfX[x]=cdfX[x-1]+pmfX[x];
        cdfY[0]=pmfY[0];
        for(let y=1;y<height;y++) cdfY[y]=cdfY[y-1]+pmfY[y];
        cdfX[width-1]=1.0; cdfY[height-1]=1.0;
        // Helper inverse CDF function
        function inverseCDF(val, cdfArray){
            for(let i=0;i<cdfArray.length-1;i++){
                if(val<=cdfArray[i]) return i;
                if(val<cdfArray[i+1]){
                    const diff = cdfArray[i+1]-cdfArray[i];
                    if(diff<epsilon) return i;
                    const frac=(val-cdfArray[i])/diff;
                    return i+frac;
                }
            }
            return cdfArray.length-1;
        }
        // Bilinear interpolate function
        function bilinear(imageData,x,y){
            const x0=Math.floor(x), x1=Math.min(Math.ceil(x),width-1);
            const y0=Math.floor(y), y1=Math.min(Math.ceil(y),height-1);
            const xd=x-x0, yd=y-y0;
            function get(ix,iy){
                const i=(iy*width+ix)*4;return [imageData.data[i],imageData.data[i+1],imageData.data[i+2],imageData.data[i+3]];
            }
            const c00=get(x0,y0), c10=get(x1,y0), c01=get(x0,y1), c11=get(x1,y1);
            const out=[0,0,0,0];
            for(let k=0;k<4;k++){
                const top=c00[k]*(1-xd)+c10[k]*xd;
                const bottom=c01[k]*(1-xd)+c11[k]*xd;
                out[k]=top*(1-yd)+bottom*yd;
            }
            return out;
        }
        // Now warp
        for(let ty=0;ty<height;ty++){
            const normY= height<=1?0.5:ty/(height-1);
            const sy=inverseCDF(normY,cdfY);
            for(let tx=0;tx<width;tx++){
                const normX= width<=1?0.5:tx/(width-1);
                const sx=inverseCDF(normX,cdfX);
                const color=bilinear(originalImageData,sx,sy);
                const idx=(ty*width+tx)*4;
                warpedImageData.data[idx]=color[0];
                warpedImageData.data[idx+1]=color[1];
                warpedImageData.data[idx+2]=color[2];
                warpedImageData.data[idx+3]=color[3];
            }
        }
        resolve(warpedImageData);
    });
} 