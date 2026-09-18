'use strict';

/* =================================================================
   main.js — DOM wiring, save/load, boot, main loop.
   Loaded last. Depends on all other modules.
   ================================================================= */

const $ = id => document.getElementById(id);

/* -----------------------------------------------------------------
   Architecture parsing
   ----------------------------------------------------------------- */
const archIn   = $('archIn');
const archFull = $('archFull');
const archLbl  = $('archLbl');

function parseHidden(str){
  const nums = String(str).trim().split(/[^0-9]+/).filter(s=>s.length)
                    .map(s=>parseInt(s,10));
  if(!nums.length) return null;
  return nums.slice(0,4).map(n=>clamp(n||1, 1, 128));
}

function parseCnn(str){
  const nums = String(str).trim().split(/[^0-9]+/).filter(s=>s.length)
                    .map(s=>parseInt(s,10));
  if(nums.length < 3) return null;
  return {
    f1:    clamp(nums[0]||8,  1, 16),
    f2:    clamp(nums[1]||16, 1, 32),
    dense: clamp(nums[2]||32, 1, 128)
  };
}

function refreshArch(){
  if(netMode === 'cnn'){
    const cfg = parseCnn(archIn.value);
    if(!cfg){ archIn.classList.add('err'); return false; }
    archIn.classList.remove('err');
    cnnCfg = cfg;
    const H1 = Math.floor(SIZE/2);
    const H2 = Math.floor(H1/2);
    const flat = cfg.f2 * H2 * H2;
    archFull.textContent =
      '1×' + SIZE + '×' + SIZE
      + ' → ' + cfg.f1 + '@' + SIZE + '×' + SIZE
      + ' → ' + cfg.f2 + '@' + H1 + '×' + H1
      + ' → ' + cfg.f2 + '@' + H2 + '×' + H2
      + ' → ' + flat + ' → ' + cfg.dense + ' → ' + classes.length;
    return true;
  } else {
    const hidden = parseHidden(archIn.value);
    if(!hidden){ archIn.classList.add('err'); return false; }
    archIn.classList.remove('err');
    sizes = [SIZE*SIZE, ...hidden, classes.length];
    archFull.textContent = sizes.join(' → ');
    return true;
  }
}

/* -----------------------------------------------------------------
   Save / Load
   ----------------------------------------------------------------- */
function saveWeights(){
  const obj = {
    version: 1,
    netMode: netMode,
    size: SIZE,
    inputSource: inputSource,
    sizes: sizes.slice(),
    cnnCfg: Object.assign({}, cnnCfg),
    classes: classes.map(c => ({ name: c.name, color: c.color, count: c.samples.length })),
    weights: []
  };
  if(netMode === 'dense'){
    for(const l of L){
      obj.weights.push({ W: Array.from(l.W), b: Array.from(l.b) });
    }
  } else if(cnn){
    for(const layer of cnn.layers){
      if(!layer.W) continue;
      obj.weights.push({ W: Array.from(layer.W), b: Array.from(layer.b) });
    }
  }
  const blob = new Blob([JSON.stringify(obj)], { type:'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const ts   = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
  a.href     = url;
  a.download = 'opentraindnn-' + netMode + '-' + inputSource + '-' +
               SIZE + 'x' + SIZE + '-' + ts + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function loadWeightsFromFile(file){
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const obj = JSON.parse(reader.result);
      if(obj.version !== 1) throw new Error('Unsupported format version');
      if(obj.netMode !== netMode) throw new Error('Saved file is for ' + obj.netMode + ' mode.');
      if(obj.size !== SIZE) throw new Error('Saved file is for ' + obj.size + '×' + obj.size + ' input.');
      if(netMode === 'dense'){
        if(obj.weights.length !== L.length) throw new Error('Layer count mismatch');
        for(let li=0; li<L.length; li++){
          const w = obj.weights[li];
          if(w.W.length !== L[li].W.length) throw new Error('Weight length mismatch at layer ' + li);
          L[li].W.set(w.W);
          L[li].b.set(w.b);
        }
        denseInitAdam();
      } else {
        const cnnLayers = cnn.layers.filter(l => l.W);
        if(obj.weights.length !== cnnLayers.length) throw new Error('CNN layer count mismatch');
        for(let li=0; li<cnnLayers.length; li++){
          const w = obj.weights[li];
          if(w.W.length !== cnnLayers[li].W.length) throw new Error('CNN weight length mismatch at layer ' + li);
          cnnLayers[li].W.set(w.W);
          cnnLayers[li].b.set(w.b);
        }
        cnn.t = 0;
        for(const layer of cnn.layers){
          if(layer.mW) layer.mW.fill(0);
          if(layer.vW) layer.vW.fill(0);
          if(layer.mB) layer.mB.fill(0);
          if(layer.vB) layer.vB.fill(0);
        }
      }
      if(obj.classes && obj.classes.length === classes.length){
        for(let i=0; i<classes.length; i++){
          if(obj.classes[i].name)  classes[i].name  = obj.classes[i].name;
          if(obj.classes[i].color) classes[i].color = obj.classes[i].color;
        }
        rebuildClassesUI();
        rebuildPredBars();
      }
      evalAll();
      alert('Weights loaded successfully.');
    }catch(e){
      alert('Failed to load: ' + e.message);
    }
  };
  reader.readAsText(file);
}

/* -----------------------------------------------------------------
   Event wiring
   ----------------------------------------------------------------- */
$('startBtn').onclick = startSource;
$('stopBtn').onclick  = stopSource;
$('addClassBtn').onclick = addClass;

$('saveBtn').onclick = ()=>{
  if(steps === 0){ alert('Train the network before saving.'); return; }
  saveWeights();
};
$('loadBtn').onclick = ()=> $('loadFile').click();
$('loadFile').onchange = e=>{
  const f = e.target.files && e.target.files[0];
  if(f) loadWeightsFromFile(f);
  e.target.value = '';
};

document.addEventListener('keydown', e=>{
  if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const n = parseInt(e.key, 10);
  if(Number.isFinite(n) && n >= 1 && n <= 9){
    const ci = n - 1;
    if(ci < classes.length) captureCurrent(ci);
  }
});

/* live view click clears preview */
liveC.onclick = clearPreview;

/* Input source toggle */
document.querySelectorAll('#srcSeg button').forEach(b=>{
  b.onclick = ()=>{
    const newSrc = b.dataset.src;
    if(newSrc === inputSource) return;
    if(data.length || valData.length){
      const ok = confirm(
        'Switching input source will keep your existing samples, but a network trained on one source will not work on the other. Continue?'
      );
      if(!ok) return;
    }
    stopSource();
    inputSource = newSrc;
    document.querySelectorAll('#srcSeg button').forEach(x=>
      x.classList.toggle('on', x === b));
    $('srcTip').textContent = inputSource === 'mic'
      ? 'Microphone: 16×16 mel spectrogram of the last ~0.4 seconds of sound.'
      : 'Camera: spatial pattern of light.';
    $('liveTip').innerHTML = inputSource === 'mic'
      ? 'Microphone: say a word 20–30 times per class. Keys <b>1</b>–<b>9</b> grab the current spectrogram.'
      : 'Camera: capture 20–30 images per class. Keys <b>1</b>–<b>9</b> grab the live frame.';
    $('liveTitle').textContent = inputSource === 'mic' ? 'Live spectrogram' : 'Live view';
    $('startBtn').textContent  = inputSource === 'mic' ? '🎤 Start mic' : '📷 Start camera';
    lastLiveVec = null;
    previewLocked = false;
    currentPreviewSample = null;
    drawLive();
    updatePrediction();
    rebuildClassesUI();
  };
});

/* Network type toggle */
document.querySelectorAll('#netSeg button').forEach(b=>{
  b.onclick = ()=>{
    netMode = b.dataset.net;
    document.querySelectorAll('#netSeg button').forEach(x=>
      x.classList.toggle('on', x===b));
    if(netMode === 'cnn'){
      archLbl.textContent = 'CNN filters (F1-F2-Dense)';
      archIn.value = cnnCfg.f1 + '-' + cnnCfg.f2 + '-' + cnnCfg.dense;
      featPanel.classList.add('on');
      rebuildFeatureCells();
      document.querySelectorAll('#modeSeg button').forEach(x=>{
        if(x.dataset.mode === 'abstract') x.classList.add('on');
        else x.classList.remove('on');
      });
      mode = 'abstract';
    } else {
      archLbl.textContent = 'Hidden layers (Dense)';
      archIn.value = '32-16';
      featPanel.classList.remove('on');
    }
    if(refreshArch()) rebuildNetwork();
  };
});

/* Neuron type toggle */
document.querySelectorAll('#modeSeg button').forEach(b=>{
  b.onclick = ()=>{
    if(netMode === 'cnn' && b.dataset.mode === 'physical'){
      alert('Physical (MOSFET) mode is only available for the Dense network.');
      return;
    }
    mode = b.dataset.mode;
    document.querySelectorAll('#modeSeg button').forEach(x=>
      x.classList.toggle('on', x===b));
    if(netMode === 'dense') denseInit();
  };
});

/* Input resolution */
document.querySelectorAll('#sizeSeg button').forEach(b=>{
  b.onclick = ()=>{
    const newSize = parseInt(b.dataset.sz, 10);
    if(newSize === SIZE) return;
    if(data.length && !confirm('Changing input resolution clears all loaded images. Continue?')) return;
    SIZE = newSize;
    classes.forEach(c=>c.samples.length = 0);
    currentPreviewSample = null;
    rebuildData();
    document.querySelectorAll('#sizeSeg button').forEach(x=>
      x.classList.toggle('on', x===b));
    if(inputSource === 'mic'){
      specBuf = new Float64Array(SIZE * SIZE);
      specWrite = 0;
    }
    rebuildClassesUI();
    rebuildPredBars();
    if(netMode === 'cnn'){ if(refreshArch()) rebuildNetwork(); rebuildFeatureCells(); }
    else if(refreshArch()) rebuildNetwork();
  };
});

/* Architecture input */
archIn.addEventListener('input', refreshArch);
archIn.addEventListener('change', ()=>{ if(refreshArch()) rebuildNetwork(); });
archIn.addEventListener('keydown', e=>{
  if(e.key === 'Enter'){
    if(refreshArch()){ rebuildNetwork(); archIn.blur(); }
    e.preventDefault();
  }
});

/* Train / reset / clear */
const trainBtn = $('train');
trainBtn.onclick = ()=>{
  if(!data.length){ alert('Load or capture some training samples first.'); return; }
  if(classes.length < 2){ alert('Need at least 2 classes.'); return; }
  training = !training;
  trainBtn.textContent = training ? '■ Stop' : '▶ Train';
  trainBtn.classList.toggle('on', training);
};
$('reset').onclick = ()=> resetNetworks();
$('clear').onclick = ()=>{
  if(!confirm('Clear all samples and reset the network?')) return;
  classes.forEach(c=>c.samples.length = 0);
  currentPreviewSample = null;
  previewLocked = false;
  rebuildData();
  rebuildClassesUI();
  resetNetworks();
};

/* -----------------------------------------------------------------
   Main loop
   ----------------------------------------------------------------- */
function frame(){
  if(training){
    let perFrame = 30;
    if(netMode === 'cnn') perFrame = SIZE >= 32 ? 2 : 4;
    else perFrame = SIZE >= 48 ? 8 : (SIZE >= 32 ? 16 : 30);
    for(let i=0;i<perFrame;i++){
      lossNow = netMode === 'cnn' ? cnnStep() : denseStep();
    }
  }
  if(steps > 0 && steps % 10 === 0) evalAll();

  drawLive();
  if(!previewLocked) updatePrediction();
  drawDNNPreview();
  if(netMode === 'cnn') drawFeatureMaps();

  const set = (id,v)=>$(id).textContent = v;
  set('ro-acc',  data.length    ? (acc*100).toFixed(1)+'%' : '—');
  set('ro-vacc', valData.length ? (valAcc*100).toFixed(1)+'%' : '—');
  set('ro-best', bestValAcc > 0 ? (bestValAcc*100).toFixed(1)+'% @ '+bestValStep : '—');
  set('ro-loss', data.length
      ? (lossNow<0.001 ? lossNow.toExponential(2) : lossNow.toFixed(4)) : '—');
  set('ro-steps', steps);
  if(netMode === 'cnn'){
    set('ro-arch', 'CNN · ' + cnnCfg.f1 + '×conv1 · ' + cnnCfg.f2 + '×conv2 · '
      + cnnCfg.dense + '×dense');
  } else {
    set('ro-arch', sizes.join(' → '));
  }
  set('ro-cls', classes.length);
  let pars = 0;
  if(netMode === 'cnn' && cnn){
    for(const layer of cnn.layers) if(layer.W) pars += layer.W.length + layer.b.length;
  } else {
    for(const l of L) pars += l.W.length + l.b.length;
  }
  set('ro-par', pars.toLocaleString());
  const inputKind = inputSource === 'mic' ? 'spectrogram' : 'image';
  set('ro-in', SIZE*SIZE + ' numbers (' + SIZE + '×' + SIZE + ' ' + inputKind + ')');
  const [mn, mx] = weightRange();
  set('ro-wr', mn.toFixed(3) + ' – ' + mx.toFixed(3));

  $('ro-acc').className  = acc    > 0.9 ? 'g' : (acc    > 0.7 ? 'y' : '');
  $('ro-vacc').className = valAcc > 0.9 ? 'g'
                         : (valAcc > 0.7 ? 'y' : (valData.length ? 'r' : ''));

  const warn = $('valWarn');
  const isOverfit = valData.length >= 4
                 && bestValAcc > 0.3
                 && valAcc < bestValAcc - 0.10;
  if(isOverfit){
    warn.classList.add('on');
    set('warnBest', (bestValAcc*100).toFixed(1) + '% (at step ' + bestValStep + ')');
  } else {
    warn.classList.remove('on');
  }

  requestAnimationFrame(frame);
}

/* -----------------------------------------------------------------
   Callbacks for tick loops (avoid circular imports)
   ----------------------------------------------------------------- */
onInputTick = ()=>{
  drawLive();
  if(!previewLocked) updatePrediction();
};

/* -----------------------------------------------------------------
   Boot
   ----------------------------------------------------------------- */
if(refreshArch()) rebuildNetwork();
rebuildClassesUI();
rebuildPredBars();
drawLive();
requestAnimationFrame(frame);
