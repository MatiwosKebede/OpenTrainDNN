'use strict';

/* =================================================================
   input.js — image and audio pipelines.
   Both produce a Float64Array(SIZE*SIZE) of values in [-1, 1].
   ================================================================= */

/* -----------------------------------------------------------------
   IMAGE
   ----------------------------------------------------------------- */
const _cv = document.createElement('canvas');
const _cx = _cv.getContext('2d', { willReadFrequently: true });

function imageToVector(img){
  _cv.width = SIZE; _cv.height = SIZE;
  _cx.drawImage(img, 0, 0, SIZE, SIZE);
  const d = _cx.getImageData(0, 0, SIZE, SIZE).data;
  const v = new Float64Array(SIZE*SIZE);
  for(let i=0;i<SIZE*SIZE;i++){
    const r = d[i*4], g = d[i*4+1], b = d[i*4+2];
    v[i] = ((0.299*r + 0.587*g + 0.114*b) / 255) * 2 - 1;
  }
  return v;
}

function makeThumbFromImage(img){
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  c.getContext('2d').drawImage(img, 0, 0, SIZE, SIZE);
  return c;
}

function makeThumbFromVec(vec){
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(SIZE, SIZE);
  for(let i=0;i<SIZE*SIZE;i++){
    const g = clamp(Math.floor((vec[i]*0.5 + 0.5)*255), 0, 255);
    img.data[i*4]   = g;
    img.data[i*4+1] = g;
    img.data[i*4+2] = g;
    img.data[i*4+3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function loadImageFromFile(file){
  return new Promise((res, rej)=>{
    const url = URL.createObjectURL(file);
    const im  = new Image();
    im.onload  = ()=> res(im);
    im.onerror = ()=>{ URL.revokeObjectURL(url); rej(new Error('load fail')); };
    im.src = url;
  });
}

/* -----------------------------------------------------------------
   AUDIO
   ----------------------------------------------------------------- */
function binFreq(freq, nBands){
  const out = new Float64Array(nBands);
  const N   = freq.length;
  for(let b=0;b<nBands;b++){
    const t0 = b / nBands;
    const t1 = (b + 1) / nBands;
    const i0 = Math.floor(N * Math.pow(t0, 1.4));
    const i1 = Math.max(i0 + 1, Math.floor(N * Math.pow(t1, 1.4)));
    let s = 0, c = 0;
    for(let i = i0; i < i1 && i < N; i++){ s += freq[i]; c++; }
    out[b] = c ? (s / c) : 0;
  }
  return out;
}

function makeMicVector(){
  const v = new Float64Array(SIZE * SIZE);
  for(let y = 0; y < SIZE; y++){
    const band = SIZE - 1 - y;
    for(let x = 0; x < SIZE; x++){
      const srcX = (specWrite + x) % SIZE;
      v[y*SIZE + x] = specBuf[band*SIZE + srcX];
    }
  }
  return v;
}

async function startMicrophone(){
  if(audioCtx) return;
  try{
    audioStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation:false, noiseSuppression:false, autoGainControl:false }
    });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = audioCtx.createMediaStreamSource(audioStream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.35;
    src.connect(analyser);
    freqBytes = new Uint8Array(analyser.frequencyBinCount);
    specBuf   = new Float64Array(SIZE * SIZE);
    specWrite = 0;
    micLastFrame = performance.now();
    micTick(performance.now());
    document.getElementById('liveSrc').textContent = 'microphone';
  }catch(e){
    alert('Could not start microphone: ' + e.message);
  }
}

function stopMicrophone(){
  if(micRaf) cancelAnimationFrame(micRaf), micRaf = null;
  if(audioStream){ audioStream.getTracks().forEach(t => t.stop()); audioStream = null; }
  if(audioCtx){ audioCtx.close(); audioCtx = null; }
  analyser = null;
  freqBytes = null;
  specBuf = null;
  document.getElementById('liveSrc').textContent = 'idle';
}

function micTick(now){
  if(!analyser) return;
  analyser.getByteFrequencyData(freqBytes);
  if(now - micLastFrame >= MIC_FRAME_MS){
    micLastFrame = now;
    const bands = binFreq(freqBytes, SIZE);
    for(let y = 0; y < SIZE; y++){
      const band = SIZE - 1 - y;
      specBuf[band * SIZE + specWrite] = (bands[band] / 255) * 2 - 1;
    }
    specWrite = (specWrite + 1) % SIZE;
  }
  lastLiveVec = makeMicVector();
  if(typeof onInputTick === 'function') onInputTick();
  micRaf = requestAnimationFrame(micTick);
}

/* -----------------------------------------------------------------
   CAMERA
   ----------------------------------------------------------------- */
async function startCamera(){
  if(camStream) return;
  try{
    camStream = await navigator.mediaDevices.getUserMedia({
      video:{ width:640, height:480 }, audio:false
    });
    videoEl = document.createElement('video');
    videoEl.playsInline = true;
    videoEl.muted = true;
    videoEl.srcObject = camStream;
    await videoEl.play();
    previewLocked = false;
    currentPreviewSample = null;
    setLiveSource(videoEl, 'camera');
    const tick = ()=>{
      if(!videoEl) return;
      try{ lastLiveVec = imageToVector(videoEl); }catch(e){}
      if(typeof onInputTick === 'function') onInputTick();
      camRaf = requestAnimationFrame(tick);
    };
    tick();
  }catch(e){
    alert('Could not start camera: ' + e.message);
  }
}

function stopCamera(){
  if(camRaf) cancelAnimationFrame(camRaf), camRaf = null;
  if(camStream){ camStream.getTracks().forEach(t => t.stop()); camStream = null; }
  videoEl = null;
  if(liveSource && liveSource.tagName === 'VIDEO') liveSource = null;
  document.getElementById('liveSrc').textContent = 'idle';
}

/* -----------------------------------------------------------------
   Unified start/stop for whichever source is active
   ----------------------------------------------------------------- */
async function startSource(){
  if(inputSource === 'mic'){
    previewLocked = false;
    currentPreviewSample = null;
    lastLiveVec = null;
    await startMicrophone();
  } else {
    await startCamera();
  }
}

function stopSource(){
  if(inputSource === 'mic'){
    stopMicrophone();
    lastLiveVec = null;
    drawLive();
    updatePrediction();
  } else {
    stopCamera();
  }
}
