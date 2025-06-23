class ImageBrushApp {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.backgroundImage = null;
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;
        
        this.baseVal = 1; // uniform base weight per pixel
        
        this.initializeElements();
        this.setupEventListeners();
        this.updateToolValues();
    }

    initializeElements() {
        this.uploadBtn = document.getElementById('uploadBtn');
        this.imageUpload = document.getElementById('imageUpload');
        this.imageInfo = document.getElementById('imageInfo');
        this.canvasContainer = document.getElementById('canvasContainer');
        this.outputCanvasContainer = document.getElementById('outputCanvasContainer');
        this.brushSize = document.getElementById('brushSize');
        this.brushSizeValue = document.getElementById('brushSizeValue');
        this.brushOpacity = null;
        this.brushOpacityValue = null;
        this.clearCanvas = document.getElementById('clearCanvas');
        this.downloadResult = document.getElementById('downloadResult');
        this.applyWarp = document.getElementById('applyWarp');
        this.toggleHeatmap = document.getElementById('toggleHeatmap');
        this.fixedWarpStrength = 0.3;
        
        this.outputCanvas = null;
    }

    setupEventListeners() {
        this.uploadBtn.addEventListener('click', () => this.imageUpload.click());
        this.imageUpload.addEventListener('change', (e) => this.handleImageUpload(e));

        this.brushSize.addEventListener('input', (e) => this.updateBrushSize(e));
        this.clearCanvas.addEventListener('click', () => this.clearDrawing());
        this.downloadResult.addEventListener('click', () => this.downloadImage());
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
        this.canvasContainer.innerHTML = '';
        this.outputCanvasContainer.innerHTML = `<div class="placeholder"><p>Result will appear here</p></div>`;
        this.outputCanvas = null;
        document.getElementById('downloadResult').disabled = true;

        const containerWidth = this.canvasContainer.clientWidth;
        const containerHeight = this.canvasContainer.clientHeight;

        const widthRatio = containerWidth / img.width;
        const heightRatio = containerHeight / img.height;
        const ratio = Math.min(widthRatio, heightRatio, 1);

        const displayWidth = Math.round(img.width * ratio);
        const displayHeight = Math.round(img.height * ratio);

        const bgCanvas = document.createElement('canvas');
        bgCanvas.width = displayWidth;
        bgCanvas.height = displayHeight;
        bgCanvas.style.position = 'absolute';
        const bgCtx = bgCanvas.getContext('2d');
        bgCtx.drawImage(img, 0, 0, displayWidth, displayHeight);

        this.bgCanvas = bgCanvas;
        this.bgCtx = bgCtx;

        this.heatmapCanvas = document.createElement('canvas');
        this.heatmapCanvas.width = displayWidth;
        this.heatmapCanvas.height = displayHeight;
        this.heatmapCanvas.style.position = 'absolute';
        this.heatmapCanvas.style.pointerEvents = 'none';
        this.heatCtx = this.heatmapCanvas.getContext('2d');

        const totalPix = displayWidth*displayHeight;
        this.paintAccum = new Float32Array(totalPix).fill(0);
        this.renderHeatmap();

        this.canvas = document.createElement('canvas');
        this.canvas.width = displayWidth;
        this.canvas.height = displayHeight;
        this.canvas.style.position = 'absolute';
        this.canvas.style.cursor = 'crosshair';
        this.ctx = this.canvas.getContext('2d');
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this.canvasContainer.appendChild(bgCanvas);
        this.canvasContainer.appendChild(this.heatmapCanvas);
        this.canvasContainer.appendChild(this.canvas);

        this.setupDrawingEvents();
        this.updateHeatmapVisibility();
    }

    setupDrawingEvents() {
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());

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

        this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);

        this.addAttention(currentX, currentY);
        this.renderHeatmap();

        this.lastX = currentX;
        this.lastY = currentY;
    }

    stopDrawing() {
        this.isDrawing = false;
    }

    updateBrushSize(e) {
        this.brushSizeValue.textContent = e.target.value + 'px';
    }

    clearDrawing() {
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        if (this.paintAccum) {
            this.paintAccum.fill(0);
            this.renderHeatmap();
        }
        if (this.outputCanvasContainer) {
            this.outputCanvasContainer.innerHTML = `<div class="placeholder"><p>Result will appear here</p></div>`;
            this.outputCanvas = null;
            document.getElementById('downloadResult').disabled = true;
        }
    }

    downloadImage() {
        if (!this.outputCanvas) {
            alert('Please apply the warp to generate a result first!');
            return;
        }

        const link = document.createElement('a');
        link.download = 'warped-image.png';
        link.href = this.outputCanvas.toDataURL();
        link.click();
    }

    showImageInfo(fileName, width, height) {
        this.imageInfo.innerHTML = `
            <strong>Uploaded:</strong> ${fileName}<br>
            <strong>Dimensions:</strong> ${width} × ${height} pixels
        `;
        this.imageInfo.style.display = 'block';
        this.runWarpSync();
    }

    updateToolValues() {
        this.brushSizeValue.textContent = this.brushSize.value;
    }

    updateHeatmapVisibility(){
        if(!this.heatmapCanvas) return;
        this.heatmapCanvas.style.display = this.toggleHeatmap.checked ? 'block' : 'none';
    }

    addAttention(x,y){
        const radius = this.brushSize.value/2;
        const sigma = radius/2;
        const twoSigma2 = 2*sigma*sigma;
        const width = this.heatmapCanvas.width;
        const height = this.heatmapCanvas.height;
        const strokeStrength = 5;

        for(let dy=-radius; dy<=radius; dy++){
            const yIdx = Math.round(y+dy);
            if(yIdx<0 || yIdx>=height) continue;
            for(let dx=-radius; dx<=radius; dx++){
                const xIdx = Math.round(x+dx);
                if(xIdx<0 || xIdx>=width) continue;
                const dist2 = dx*dx + dy*dy;
                if(dist2 > radius*radius) continue;
                const weight = Math.exp(-dist2 / twoSigma2);
                const idx = yIdx*width + xIdx;
                this.paintAccum[idx] += strokeStrength * weight;
            }
        }
    }

    renderHeatmap(){
        const width = this.heatmapCanvas.width;
        const height = this.heatmapCanvas.height;
        const imgData = this.heatCtx.createImageData(width,height);

        let minP = Infinity, maxP = 0;
        const combined = new Float32Array(this.paintAccum.length);
        for(let i=0;i<combined.length;i++){
            const p = this.baseVal + this.paintAccum[i];
            combined[i]=p;
            if(p<minP) minP=p;
            if(p>maxP) maxP=p;
        }
        const uniformMode = (maxP - minP) < 1e-12;
        const logMax = Math.log10(maxP + 1e-12);
        const logMin = Math.log10(minP + 1e-12);
        const logRange = logMax - logMin || 1e-8;

        for(let i=0;i<combined.length;i++){
            const p = combined[i];
            let v;
            if(uniformMode){
                v = 0.5;
            } else {
                v = (Math.log10(p + 1e-12) - logMin) / logRange;
            }
            const rgb = jetColorMap(v);
            imgData.data[i*4]   = rgb[0];
            imgData.data[i*4+1] = rgb[1];
            imgData.data[i*4+2] = rgb[2];
            imgData.data[i*4+3] = 60 + Math.round(v*150);
        }
        this.heatCtx.putImageData(imgData,0,0);
    }

    runWarp(){
        this.runWarpSync();
    }

    runWarpSync(){
        if (!this.bgCanvas) {
            alert("Please upload an image first.");
            return;
        }

        const W = this.bgCanvas.width;
        const H = this.bgCanvas.height;

        // Build probability array including base uniform component
        const probArray = new Float32Array(this.paintAccum.length);
        for (let i = 0; i < probArray.length; i++) {
            probArray[i] = this.baseVal + this.paintAccum[i];
        }
        // Normalize to sum to 1
        let total = 0;
        for (let v of probArray) total += v;
        const invTotal = 1 / total;
        for (let i = 0; i < probArray.length; i++) probArray[i] *= invTotal;

        const originalImageData = this.bgCtx.getImageData(0, 0, W, H);
        const warpedImageData = warpFromProbSync(originalImageData, probArray, this.fixedWarpStrength);
        
        if (!this.outputCanvas) {
            this.outputCanvas = document.createElement('canvas');
            this.outputCanvas.width = W;
            this.outputCanvas.height = H;
            this.outputCanvasContainer.innerHTML = '';
            this.outputCanvasContainer.appendChild(this.outputCanvas);
        }
        
        const outCtx = this.outputCanvas.getContext('2d');
        outCtx.putImageData(warpedImageData, 0, 0);

        document.getElementById('downloadResult').disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ImageBrushApp();
});

function warpFromProb(originalImageData, attentionMapImageData, warpStrengthFactor){
    return new Promise((resolve)=>{
        const W = originalImageData.width;
        const H = originalImageData.height;
        const output = new ImageData(W,H);
        const epsilon = 1e-8;

        const prob = new Float32Array(W*H);
        let total = 0;
        for(let j=0;j<H;j++){
            for(let i=0;i<W;i++){
                const alpha = attentionMapImageData.data[(j*W+i)*4+3]/255;
                prob[j*W+i] = alpha;
                total += alpha;
            }
        }
        const uniformVal = 1.0/(W*H);
        if(total < epsilon){
            prob.fill(uniformVal);
        }else{
            for(let k=0;k<prob.length;k++){
                prob[k] = (1-warpStrengthFactor)*uniformVal + warpStrengthFactor*(prob[k]/total);
            }
        }

        const pmfX = new Float32Array(W).fill(0);
        const pmfY = new Float32Array(H).fill(0);
        for(let j=0;j<H;j++){
            for(let i=0;i<W;i++){
                const p = prob[j*W+i];
                pmfX[i]+=p;
                pmfY[j]+=p;
            }
        }

        const cdfX = new Float32Array(W);
        const cdfY = new Float32Array(H);
        cdfX[0]=pmfX[0];
        for(let i=1;i<W;i++) cdfX[i]=cdfX[i-1]+pmfX[i];
        cdfY[0]=pmfY[0];
        for(let j=1;j<H;j++) cdfY[j]=cdfY[j-1]+pmfY[j];
        cdfX[W-1]=1; cdfY[H-1]=1;

        function inverseCDF(val,cdfArray){
            let low=0, high=cdfArray.length-1;
            while(low<high){
                const mid = Math.floor((low+high)/2);
                if(val>cdfArray[mid]) low=mid+1; else high=mid;
            }
            const idx = low;
            if(idx===0) return 0;
            const prev = cdfArray[idx-1];
            const curr = cdfArray[idx];
            const frac = (curr-prev)>epsilon? (val-prev)/(curr-prev):0;
            return (idx-1)+frac;
        }

        function sample(orig,x,y){
            x=Math.max(0,Math.min(W-1,x));
            y=Math.max(0,Math.min(H-1,y));
            const x0=Math.floor(x), y0=Math.floor(y);
            const x1=Math.min(x0+1,W-1), y1=Math.min(y0+1,H-1);
            const dx=x-x0, dy=y-y0;
            function get(ix,iy){
                const offset = (iy*W+ix)*4;
                return [
                    orig.data[offset],
                    orig.data[offset+1],
                    orig.data[offset+2],
                    orig.data[offset+3]
                ];
            }
            const c00=get(x0,y0), c10=get(x1,y0), c01=get(x0,y1), c11=get(x1,y1);
            const out=[0,0,0,0];
            for(let k=0;k<4;k++){
                const top = c00[k]*(1-dx)+c10[k]*dx;
                const bottom = c01[k]*(1-dx)+c11[k]*dx;
                out[k]=top*(1-dy)+bottom*dy;
            }
            return out;
        }

        for(let yNew=0;yNew<H;yNew++){
            const v = H<=1?0.5:yNew/(H-1);
            const ySrcIdx = inverseCDF(v,cdfY);
            const ySrc = ySrcIdx;
            for(let xNew=0;xNew<W;xNew++){
                const u = W<=1?0.5:xNew/(W-1);
                const xSrcIdx = inverseCDF(u,cdfX);
                const xSrc = xSrcIdx;
                const col = sample(originalImageData,xSrc,ySrc);
                const outIdx=(yNew*W+xNew)*4;
                output.data[outIdx]=col[0];
                output.data[outIdx+1]=col[1];
                output.data[outIdx+2]=col[2];
                output.data[outIdx+3]=col[3];
            }
        }
        resolve(output);
    });
}

function jetColorMap(v){
    v=Math.min(1,Math.max(0,v));
    const fourV = 4*v;
    const r = Math.min(1, Math.max(0, Math.min(fourV-1.5, -fourV+4.5)));
    const g = Math.min(1, Math.max(0, Math.min(fourV-0.5, -fourV+3.5)));
    const b = Math.min(1, Math.max(0, Math.min(fourV+0.5, -fourV+2.5)));
    return [Math.round(r*255),Math.round(g*255),Math.round(b*255)];
}

function warpFromProbSync(originalImageData, probArray, warpStrength){
    const W = originalImageData.width;
    const H = originalImageData.height;
    const N = W*H;
    const uniform = 1/N;
    const pdf = new Float32Array(N);
    let total=0;
    for(let k=0;k<N;k++){ total+=probArray[k]; }
    if(total===0){ pdf.fill(uniform);} else{
        for(let k=0;k<N;k++) pdf[k]=(1-warpStrength)*uniform + warpStrength*(probArray[k]/total);
    }
    const pmfX=new Float32Array(W).fill(0), pmfY=new Float32Array(H).fill(0);
    for(let j=0;j<H;j++){
        for(let i=0;i<W;i++){
            const p=pdf[j*W+i]; pmfX[i]+=p; pmfY[j]+=p;
        }
    }
    const cdfX=new Float32Array(W), cdfY=new Float32Array(H);
    cdfX[0]=pmfX[0]; for(let i=1;i<W;i++) cdfX[i]=cdfX[i-1]+pmfX[i];
    cdfY[0]=pmfY[0]; for(let j=1;j<H;j++) cdfY[j]=cdfY[j-1]+pmfY[j];
    cdfX[W-1]=1; cdfY[H-1]=1;
    const epsilon=1e-8;
    const output=new ImageData(W,H);
    function inv(v,cdf){let l=0,h=cdf.length-1;while(l<h){const m=(l+h)>>1;if(v>cdf[m])l=m+1;else h=m;} if(l===0)return 0; const prev=cdf[l-1],cur=cdf[l]; const f=(cur-prev)>epsilon? (v-prev)/(cur-prev):0; return (l-1)+f;}
    function sample(x,y){x=Math.max(0,Math.min(W-1,x));y=Math.max(0,Math.min(H-1,y));const x0=Math.floor(x),y0=Math.floor(y);const x1=Math.min(x0+1,W-1),y1=Math.min(y0+1,H-1);const dx=x-x0,dy=y-y0;function get(ix,iy){const o=(iy*W+ix)*4;const d=originalImageData.data;return[d[o],d[o+1],d[o+2],d[o+3]];} const c00=get(x0,y0),c10=get(x1,y0),c01=get(x0,y1),c11=get(x1,y1);const out=[0,0,0,0];for(let k=0;k<4;k++){const t=c00[k]*(1-dx)+c10[k]*dx;const b=c01[k]*(1-dx)+c11[k]*dx;out[k]=t*(1-dy)+b*dy;}return out;}
    for(let y=0;y<H;y++){const v=H<=1?0.5:y/(H-1);const ys=inv(v,cdfY);for(let x=0;x<W;x++){const u=W<=1?0.5:x/(W-1);const xs=inv(u,cdfX);const col=sample(xs,ys);const idx=(y*W+x)*4;output.data[idx]=col[0];output.data[idx+1]=col[1];output.data[idx+2]=col[2];output.data[idx+3]=col[3];}}
    return output;
} 