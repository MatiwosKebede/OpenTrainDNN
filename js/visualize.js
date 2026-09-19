'use strict';

/* =================================================================
   visualize.js — every canvas renderer and the prediction bar UI.
   Reads from state.js globals; writes only to the DOM.
   ================================================================= */

/* ---- canvas elements ---- */
const liveC   = document.getElementById('live');
const liveCtx = liveC.getContext('2d');
const dnnC    = document.getElementById('dnnView');
const dnnCtx  = dnnC.getContext('2d');
const dnnInfo = document.getElementById('dnnInfo');

const featPanel = document.getElementById('featurePanel');
const featGrid  = document.getElementById('featGrid');
let   featCanvases = [];

const predBarsEl   = document.getElementById('predBars');
const predWinnerEl = document.getElementById('predWinner');
const predNoteEl   = document.getElementById('predNote');
let   predBarNodes = [];

/* ---- helpers ---- */
function ensureCanvasSize(c){
  const dpr = window.devicePixelRatio || 1;
  const w = c.clientWidth, h = c.clientHeight;
  const W = Math.round(w*dpr), H = Math.round(h*dpr);
  if(c.width !== W || c.height !== H){ c.width = W; c.height = H; }
}

/* =================================================================
   LIVE VIEW
   ================================================================= */
function drawLive(){
  ensureCanvasSize(liveC);
  const w = liveC.width, h = liveC.height;
  liveCtx.clearRect(0,0,w,h);

  if(inputSource === 'mic'){
    const n = SIZE;
    const side = Math.min(w, h) - 40;
    const cell = side / n;
    const ox = (w - side)/2, oy = (h - side)/2;
    for(let y=0; y<n; y++){
      for(let x=0; x<n; x++){
        const v = lastLiveVec ? lastLiveVec[y*n + x] : 0;
        const g = clamp(Math.floor((v*0.5 + 0.5)*255), 0, 255);
        liveCtx.fillStyle = 'rgb('+g+','+g+','+g+')';
        liveCtx.fillRect(ox + x*cell, oy + y*cell, Math.ceil(cell)+0.5, Math.ceil(cell)+0.5);
      }
    }
    liveCtx.strokeStyle = 'rgba(53,224,138,0.55)';
    liveCtx.lineWidth = 1.2;
    liveCtx.strokeRect(ox, oy, side, side);
    liveCtx.fillStyle = '#68798f';
    liveCtx.font = '600 10px ui-monospace,monospace';
    liveCtx.textAlign = 'center'; liveCtx.textBaseline = 'top';
    liveCtx.fillText('time →', ox + side/2, oy + side + 8);
    liveCtx.save();
    liveCtx.translate(ox - 12, oy + side/2);
    liveCtx.rotate(-Math.PI/2);
    liveCtx.textBaseline = 'middle';
    liveCtx.fillText('frequency →', 0, 0);
    liveCtx.restore();
    if(!lastLiveVec){
      liveCtx.fillStyle = 'rgba(104,121,143,.75)';
      liveCtx.font = '600 13px ui-sans-serif,sans-serif';
      liveCtx.textAlign = 'center'; liveCtx.textBaseline = 'middle';
      liveCtx.fillText('Press Start to hear the microphone', w/2, oy + side/2);
    }
    return;
  }

  if(liveSource){
    const sw = liveSource.videoWidth || liveSource.width || 1;
    const sh = liveSource.videoHeight || liveSource.height || 1;
    const side = Math.min(sw, sh);
    const sx = (sw - side)/2, sy = (sh - side)/2;
    liveCtx.drawImage(liveSource, sx, sy, side, side, 0, 0, w, h);
  } else {
    liveCtx.fillStyle = '#0a0e15';
    liveCtx.fillRect(0,0,w,h);
    liveCtx.fillStyle = 'rgba(104,121,143,.6)';
    liveCtx.font = '600 '+(w/22)+'px ui-sans-serif,sans-serif';
    liveCtx.textAlign = 'center'; liveCtx.textBaseline = 'middle';
    liveCtx.fillText('No source', w/2, h/2 - w/25);
    liveCtx.font = '400 '+(w/32)+'px ui-sans-serif,sans-serif';
    liveCtx.fillText('Press Start, or drop images', w/2, h/2 + w/22);
  }
}

function setLiveSource(src, label){
  liveSource = src;
  document.getElementById('liveSrc').textContent = label || 'live';
  if(src && inputSource === 'camera'){
    try{ lastLiveVec = imageToVector(src); }catch(e){ lastLiveVec = null; }
  }
  if(!previewLocked){ drawLive(); updatePrediction(); }
}

function clearPreview(){
  previewLocked = false;
  previewName = '';
  if(inputSource === 'camera' && liveSource){
    try{ lastLiveVec = imageToVector(liveSource); }catch(e){}
  }
  drawLive();
  updatePrediction();
  rebuildClassesUI();
}

function setPreviewFromSample(s, name){
  previewLocked = true;
  previewName = name;
  lastLiveVec = new Float64Array(s.p);
  updatePrediction();
  rebuildClassesUI();
}

/* =================================================================
   PREDICTION UI
   ================================================================= */
function rebuildPredBars(){
  predBarsEl.innerHTML = '';
  predBarNodes = [];
  classes.forEach(c=>{
    const wrap = document.createElement('div');
    wrap.className = 'predBar';
    wrap.style.setProperty('--c', c.color);
    const name = document.createElement('div');
    name.className = 'predBarName'; name.textContent = c.name;
    const track = document.createElement('div'); track.className = 'predBarTrack';
    const fill = document.createElement('div'); fill.className = 'predBarFill';
    track.appendChild(fill);
    const val = document.createElement('div'); val.className = 'predBarVal';
    val.textContent = '—';
    wrap.append(name, track, val);
    predBarsEl.appendChild(wrap);
    predBarNodes.push({ fillEl:fill, valEl:val, wrapEl:wrap });
  });
}

function updatePrediction(){
  if(!lastLiveVec || steps === 0 || !data.length){
    predWinnerEl.textContent = '—';
    predWinnerEl.style.color = 'var(--dim)';
    predNoteEl.textContent = steps === 0 ? 'no model trained yet'
      : (!data.length ? 'no training data yet' : 'no input');
    predBarNodes.forEach(n=>{
      n.fillEl.style.width = '0%';
      n.valEl.textContent = '—';
      n.wrapEl.classList.remove('top');
    });
    return;
  }
  const probs = predictVec(lastLiveVec);
  const top = argmax(probs);
  predWinnerEl.textContent = classes[top].name;
  predWinnerEl.style.color = classes[top].color;
  predNoteEl.textContent = (probs[top]*100).toFixed(1) + '% confident'
    + (previewLocked ? '  ·  preview: ' + previewName : '');
  predBarNodes.forEach((n,i)=>{
    const p = probs[i] || 0;
    n.fillEl.style.width = (p*100).toFixed(1) + '%';
    n.valEl.textContent = (p*100).toFixed(1) + '%';
    n.wrapEl.classList.toggle('top', i === top);
  });
}

/* =================================================================
   DNN PREVIEW
   ================================================================= */
function drawCurvedEdge(x0, y0, x1, y1, w, dpr, alphaScale){
  const mag = Math.abs(w);
  if(mag < 0.015) return;
  const s = Math.min(mag / 2.0, 1);
  const color = w >= 0 ? '53,224,138' : '255,107,107';
  const alpha = (0.04 + 0.94 * Math.pow(s, 0.6)) * (alphaScale || 1);
  const lineW = (0.35 + 4.65 * Math.pow(s, 1.3)) * dpr;
  const dx = x1 - x0;
  const cp1x = x0 + dx * 0.45, cp1y = y0;
  const cp2x = x1 - dx * 0.45, cp2y = y1;

  dnnCtx.beginPath();
  dnnCtx.moveTo(x0, y0);
  dnnCtx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x1, y1);
  dnnCtx.strokeStyle = 'rgba('+color+','+alpha+')';
  dnnCtx.lineWidth = lineW;
  dnnCtx.lineCap = 'round';
  dnnCtx.stroke();

  if(s > 0.55){
    const boost = (s - 0.55) / 0.45;
    dnnCtx.save();
    dnnCtx.shadowColor = 'rgba('+color+','+(0.80 * boost)+')';
    dnnCtx.shadowBlur  = (4 + 14 * boost) * dpr;
    dnnCtx.beginPath();
    dnnCtx.moveTo(x0, y0);
    dnnCtx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x1, y1);
    dnnCtx.strokeStyle = 'rgba('+color+','+Math.min(1, alpha + 0.15*boost)+')';
    dnnCtx.lineWidth = lineW * 0.85;
    dnnCtx.lineCap = 'round';
    dnnCtx.stroke();
    dnnCtx.restore();

    dnnCtx.beginPath();
    dnnCtx.moveTo(x0, y0);
    dnnCtx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x1, y1);
    dnnCtx.strokeStyle = 'rgba(255,255,255,'+(0.40 * boost)+')';
    dnnCtx.lineWidth = Math.max(0.6*dpr, lineW * 0.28);
    dnnCtx.lineCap = 'round';
    dnnCtx.stroke();
  }
}

function drawInputImage(x, y, size, values, dpr){
  const n = Math.round(Math.sqrt(values.length));
  const cell = size / n;
  dnnCtx.save();
  dnnCtx.shadowColor = 'rgba(53,224,138,0.55)';
  dnnCtx.shadowBlur = 12*dpr;
  dnnCtx.strokeStyle = 'rgba(53,224,138,0.9)';
  dnnCtx.lineWidth = 1.5*dpr;
  dnnCtx.strokeRect(x, y, size, size);
  dnnCtx.restore();
  for(let i=0; i<n; i++){
    for(let j=0; j<n; j++){
      const v = values[i*n + j];
      const c = clamp(Math.floor((v*0.5 + 0.5)*255), 0, 255);
      dnnCtx.fillStyle = 'rgb('+c+','+c+','+c+')';
      dnnCtx.fillRect(x + j*cell, y + i*cell, Math.ceil(cell), Math.ceil(cell));
    }
  }
  if(n <= 32){
    dnnCtx.strokeStyle = 'rgba(0,0,0,0.16)';
    dnnCtx.lineWidth = 0.5*dpr;
    for(let i=1; i<n; i++){
      dnnCtx.beginPath();
      dnnCtx.moveTo(x + i*cell, y);
      dnnCtx.lineTo(x + i*cell, y + size);
      dnnCtx.stroke();
      dnnCtx.beginPath();
      dnnCtx.moveTo(x, y + i*cell);
      dnnCtx.lineTo(x + size, y + i*cell);
      dnnCtx.stroke();
    }
  }
}

function drawStrip(x, y, w, h, values, dpr){
  const n = values.length;
  const bh = h / n;
  let mx = 1e-6;
  for(const v of values) if(Math.abs(v) > mx) mx = Math.abs(v);
  for(let i=0; i<n; i++){
    const v = values[i] / mx;
    const a = Math.min(Math.abs(v), 1);
    dnnCtx.fillStyle = v >= 0
      ? 'rgba(53,224,138,'+(0.18 + 0.72*a)+')'
      : 'rgba(255,107,107,'+(0.18 + 0.72*a)+')';
    dnnCtx.fillRect(x, y + i*bh, w, Math.ceil(bh) + 0.5);
  }
  dnnCtx.strokeStyle = 'rgba(53,224,138,0.55)';
  dnnCtx.lineWidth = 1*dpr;
  dnnCtx.strokeRect(x, y, w, h);
}

function drawNeuron(cx, cy, r, v, dpr){
  const a = clamp(Math.abs(v), 0, 1);
  const baseCol = v >= 0 ? '53,224,138' : '255,107,107';
  if(a > 0.15){
    dnnCtx.save();
    dnnCtx.shadowColor = 'rgba('+baseCol+','+(a*0.9)+')';
    dnnCtx.shadowBlur = (6 + 10*a)*dpr;
    dnnCtx.beginPath();
    dnnCtx.arc(cx, cy, r, 0, 6.2832);
    dnnCtx.fillStyle = 'rgba('+baseCol+','+(0.4 + 0.5*a)+')';
    dnnCtx.fill();
    dnnCtx.restore();
  }
  dnnCtx.beginPath();
  dnnCtx.arc(cx, cy, r, 0, 6.2832);
  dnnCtx.fillStyle = 'rgba('+baseCol+','+(0.2 + 0.75*a)+')';
  dnnCtx.fill();
  dnnCtx.strokeStyle = 'rgba(10,14,21,0.95)';
  dnnCtx.lineWidth = 1.6*dpr;
  dnnCtx.stroke();
  if(r > 4*dpr){
    dnnCtx.beginPath();
    dnnCtx.arc(cx - r*0.25, cy - r*0.25, r*0.28, 0, 6.2832);
    dnnCtx.fillStyle = 'rgba(255,255,255,'+(0.15 + 0.35*a)+')';
    dnnCtx.fill();
  }
}

function drawDNNPreview(){
  ensureCanvasSize(dnnC);
  const W = dnnC.width, H = dnnC.height;
  const dpr = window.devicePixelRatio || 1;
  dnnCtx.clearRect(0,0,W,H);

  const bg = dnnCtx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0a0e15');
  bg.addColorStop(1, '#070a0f');
  dnnCtx.fillStyle = bg;
  dnnCtx.fillRect(0,0,W,H);

  dnnCtx.strokeStyle = 'rgba(36,48,64,0.18)';
  dnnCtx.lineWidth = 1;
  for(let gx=0; gx<W; gx+=40*dpr){
    dnnCtx.beginPath(); dnnCtx.moveTo(gx, 0); dnnCtx.lineTo(gx, H); dnnCtx.stroke();
  }
  for(let gy=0; gy<H; gy+=40*dpr){
    dnnCtx.beginPath(); dnnCtx.moveTo(0, gy); dnnCtx.lineTo(W, gy); dnnCtx.stroke();
  }

  if(!lastLiveVec){
    dnnCtx.fillStyle = 'rgba(104,121,143,.65)';
    dnnCtx.font = '600 '+(16*dpr)+'px ui-sans-serif,sans-serif';
    dnnCtx.textAlign = 'center'; dnnCtx.textBaseline = 'middle';
    dnnCtx.fillText('No input — start camera or microphone, or click a thumbnail',
                    W/2, H/2);
    dnnInfo.textContent = 'idle';
    return;
  }

  if(netMode === 'dense') drawDenseWithEdges(W, H, dpr);
  else drawCNNWithEdges(W, H, dpr);
}

function drawDenseWithEdges(W, H, dpr){
  const f = denseFwd(lastLiveVec, true);

  const topPad = 64*dpr, botPad = 46*dpr;
  const boxH = H - topPad - botPad;
  const boxY = topPad;
  const yMid = boxY + boxH/2;

  /* ───────── input matches column height ───────── */
  const colH   = boxH * 0.92;
  const nHidden = L.length - 1;

  /* Column widths, output width, and the gap between layers.
     Gaps are very large by default so every layer has clear,
     visible breathing room. They shrink as the number of hidden
     layers grows, so up to 12 layers still fit on screen.       */
  let stripW = 12*dpr;
  let colW   = 42*dpr;
  let outW   = 84*dpr;
  let gap    = 110*dpr;

  if(nHidden >= 3) gap = 95*dpr;
  if(nHidden >= 4) gap = 80*dpr;
  if(nHidden >= 6){ gap = 65*dpr; colW = 38*dpr; outW = 76*dpr; }
  if(nHidden >= 8){ gap = 50*dpr; colW = 34*dpr; outW = 68*dpr; stripW = 10*dpr; }
  if(nHidden >= 10){ gap = 38*dpr; colW = 30*dpr; outW = 60*dpr; stripW = 8*dpr; }

  const fixedW = gap + stripW + gap
               + nHidden * (colW + gap)
               + outW;
  const maxInputW = W - fixedW - 20*dpr;
  const inputW = Math.max(40*dpr, Math.min(colH, maxInputW));

  const totalW = inputW + fixedW;
  let x = Math.max(12*dpr, (W - totalW) / 2);

  const inputX = x, inputY = yMid - inputW/2;
  drawInputImage(inputX, inputY, inputW, lastLiveVec, dpr);
  x += inputW + gap;

  const stripX = x, stripH = colH, stripY = yMid - stripH/2;
  const flat = f.acts[0];
  drawStrip(stripX, stripY, stripW, stripH, flat, dpr);
  const stripYof = i => stripY + (i + 0.5) * stripH / flat.length;
  x += stripW + gap;

  const hidden = [];
  for(let li=0; li<nHidden; li++){
    const nout = L[li].nout;
    const colY = yMid - colH/2;
    const rowH = colH / nout;
    const radius = clamp(rowH * 0.32, 1.6*dpr, 9*dpr);
    const positions = [];
    for(let j=0; j<nout; j++){
      positions.push({ x: x + colW/2, y: colY + (j + 0.5) * rowH, r: radius });
    }
    hidden.push({ x, w: colW, y: colY, h: colH, positions, nout,
                  values: f.acts[li+1], li });
    x += colW + gap;
  }

  const outX = x;
  const outColY = yMid - colH/2;
  const nCls = classes.length;
  const outRowH = colH / nCls;
  const outR = clamp(outRowH * 0.28, 2*dpr, 22*dpr);
  const outPositions = [];
  for(let j=0; j<nCls; j++){
    outPositions.push({ x: outX + outR + 4*dpr,
                        y: outColY + (j + 0.5) * outRowH, r: outR });
  }

  if(hidden.length){
    const l0 = L[0], h1 = hidden[0];
    const K = l0.nin > 256 ? 4 : (l0.nin > 64 ? 6 : l0.nin);
    for(let j=0; j<h1.nout; j++){
      const base = j * l0.nin;
      const hp = h1.positions[j];
      const endX = hp.x - hp.r, endY = hp.y;
      if(K >= l0.nin){
        for(let i=0; i<l0.nin; i++){
          const w = l0.W[base + i];
          drawCurvedEdge(stripX + stripW, stripYof(i), endX, endY, w, dpr, 0.85);
        }
      } else {
        const pairs = [];
        for(let i=0; i<l0.nin; i++) pairs.push({ i, w: l0.W[base + i] });
        pairs.sort((a,b)=> Math.abs(b.w) - Math.abs(a.w));
        for(const { i, w } of pairs.slice(0, K)){
          drawCurvedEdge(stripX + stripW, stripYof(i), endX, endY, w, dpr, 0.95);
        }
      }
    }
  }

  for(let li=0; li<hidden.length - 1; li++){
    const A = hidden[li], B = hidden[li+1];
    const layer = L[li + 1];
    for(let j=0; j<B.nout; j++){
      const base = j * layer.nin;
      const bp = B.positions[j];
      const endX = bp.x - bp.r, endY = bp.y;
      for(let i=0; i<A.nout; i++){
        const ap = A.positions[i];
        const startX = ap.x + ap.r, startY = ap.y;
        const w = layer.W[base + i];
        drawCurvedEdge(startX, startY, endX, endY, w, dpr, 0.92);
      }
    }
  }

  if(hidden.length){
    const lastH = hidden[hidden.length - 1];
    const lastLayer = L[L.length - 1];
    for(let j=0; j<nCls; j++){
      const base = j * lastLayer.nin;
      const op = outPositions[j];
      const endX = op.x - op.r, endY = op.y;
      for(let i=0; i<lastH.nout; i++){
        const hp = lastH.positions[i];
        const startX = hp.x + hp.r, startY = hp.y;
        const w = lastLayer.W[base + i];
        drawCurvedEdge(startX, startY, endX, endY, w, dpr, 1.0);
      }
    }
  }

  for(const col of hidden){
    let mx = 1e-6;
    for(const v of col.values) if(Math.abs(v) > mx) mx = Math.abs(v);
    for(let j=0; j<col.nout; j++){
      const p = col.positions[j];
      drawNeuron(p.x, p.y, p.r, col.values[j] / mx, dpr);
    }
  }

  /* ───────── output neuron labels adapt to the class count ─────────
     6 or fewer:  full name + percentage
     7 to 12:     shortened name + percentage
     13 to 24:    percentage only
     25 or more:  no labels, circles only                          */
  const nClsLabelMode = nCls <= 6 ? 'full'
                      : nCls <= 12 ? 'short'
                      : nCls <= 24 ? 'pct'
                      : 'none';

  for(let j=0; j<nCls; j++){
    const p = outPositions[j];
    const v = f.probs[j];
    dnnCtx.save();
    dnnCtx.shadowColor = classes[j].color;
    dnnCtx.shadowBlur = (8 + 18*v)*dpr;
    dnnCtx.beginPath();
    dnnCtx.arc(p.x, p.y, p.r, 0, 6.2832);
    dnnCtx.fillStyle = classes[j].color;
    dnnCtx.globalAlpha = 0.55 + 0.45*v;
    dnnCtx.fill();
    dnnCtx.globalAlpha = 1;
    dnnCtx.restore();
    dnnCtx.beginPath();
    dnnCtx.arc(p.x, p.y, p.r, 0, 6.2832);
    dnnCtx.strokeStyle = 'rgba(10,14,21,0.95)';
    dnnCtx.lineWidth = 1.8*dpr;
    dnnCtx.stroke();
    if(p.r > 8*dpr){
      dnnCtx.beginPath();
      dnnCtx.arc(p.x - p.r*0.28, p.y - p.r*0.28, p.r*0.24, 0, 6.2832);
      dnnCtx.fillStyle = 'rgba(255,255,255,0.35)';
      dnnCtx.fill();
    }

    if(nClsLabelMode === 'none') continue;

    const labelX = p.x + p.r + 8*dpr;
    const nameFont = nClsLabelMode === 'full' ? 12 : 10;
    const pctFont  = nClsLabelMode === 'full' ? 14 : 12;
    const maxNameChars = nClsLabelMode === 'full' ? 12 : 8;

    if(nClsLabelMode !== 'pct'){
      dnnCtx.fillStyle = '#e8f0ff';
      dnnCtx.font = '700 '+(nameFont*dpr)+'px ui-sans-serif,sans-serif';
      dnnCtx.textAlign = 'left'; dnnCtx.textBaseline = 'middle';
      const nm = classes[j].name.length > maxNameChars
        ? classes[j].name.slice(0, maxNameChars - 1) + '…'
        : classes[j].name;
      dnnCtx.fillText(nm, labelX, p.y - 7*dpr);
    }

    dnnCtx.fillStyle = classes[j].color;
    dnnCtx.font = '700 '+(pctFont*dpr)+'px ui-monospace,monospace';
    dnnCtx.textAlign = 'left'; dnnCtx.textBaseline = 'middle';
    dnnCtx.fillText((v*100).toFixed(0) + '%',
                    labelX, nClsLabelMode === 'pct' ? p.y : p.y + 10*dpr);
  }

  /* ───────── top labels ───────── */
  dnnCtx.textAlign = 'center'; dnnCtx.textBaseline = 'bottom';
  dnnCtx.fillStyle = '#e8f0ff';
  dnnCtx.font = '700 '+(12*dpr)+'px ui-sans-serif,sans-serif';
  dnnCtx.fillText('INPUT',   inputX + inputW/2, 28*dpr);
  dnnCtx.fillText('FLATTEN', stripX + stripW/2, 28*dpr);
  for(const col of hidden){
    dnnCtx.fillText('H' + (col.li + 1), col.x + col.w/2, 28*dpr);
  }
  dnnCtx.fillText('OUTPUT',  outX + outW/2, 28*dpr);

  dnnCtx.fillStyle = '#68798f';
  dnnCtx.font = '600 '+(10*dpr)+'px ui-monospace,monospace';
  dnnCtx.textBaseline = 'top';
  const inputLabel = inputSource === 'mic'
    ? SIZE + '×' + SIZE + ' spec'
    : SIZE + '×' + SIZE + ' img';
  dnnCtx.fillText(inputLabel, inputX + inputW/2, 32*dpr);
  dnnCtx.fillText(flat.length + ' vals', stripX + stripW/2, 32*dpr);
  for(const col of hidden){
    dnnCtx.fillText(col.nout + ' n', col.x + col.w/2, 32*dpr);
  }
  dnnCtx.fillText(nCls + ' cls', outX + outW/2, 32*dpr);

  dnnCtx.textBaseline = 'top';
  dnnCtx.fillStyle = 'rgba(104,121,143,0.7)';
  dnnCtx.font = '600 '+(10*dpr)+'px ui-monospace,monospace';
  dnnCtx.fillText(SIZE*SIZE + ' input numbers', inputX + inputW/2, boxY + boxH + 12*dpr);

  dnnInfo.textContent = 'DENSE · ' + sizes.join(' → ')
    + (previewLocked ? ' · preview: ' + previewName : ' · live input');
}

function drawCNNWithEdges(W, H, dpr){
  const c = cnn;
  if(!c) return;

  const padY = 60*dpr;
  const areaH = H - padY - 40*dpr;
  const yMid = padY + areaH/2;

  const H_in = c.H;
  const H1 = Math.floor(H_in/2);
  const H2 = Math.floor(H1/2);

  const layers = [
    { type:'image',  title:'INPUT',  sub:H_in+'×'+H_in,
      values:lastLiveVec, C:1, GW:H_in, GH:H_in, desired: 110*dpr },
    { type:'fmaps',  title:'CONV 1',  sub:cnnCfg.f1+'@'+H_in,
      values:c.layers[0].cache.output, C:cnnCfg.f1, GW:H_in, GH:H_in, desired: 130*dpr },
    { type:'fmaps',  title:'RELU 1',  sub:cnnCfg.f1+'@'+H_in,
      values:c.layers[1].cache.output, C:cnnCfg.f1, GW:H_in, GH:H_in,
      desired: 60*dpr, skipDraw:true },
    { type:'fmaps',  title:'POOL 1',  sub:cnnCfg.f1+'@'+H1,
      values:c.layers[2].cache.output, C:cnnCfg.f1, GW:H1, GH:H1, desired: 115*dpr },
    { type:'fmaps',  title:'CONV 2',  sub:cnnCfg.f2+'@'+H1,
      values:c.layers[3].cache.output, C:cnnCfg.f2, GW:H1, GH:H1, desired: 130*dpr },
    { type:'fmaps',  title:'RELU 2',  sub:cnnCfg.f2+'@'+H1,
      values:c.layers[4].cache.output, C:cnnCfg.f2, GW:H1, GH:H1,
      desired: 60*dpr, skipDraw:true },
    { type:'fmaps',  title:'POOL 2',  sub:cnnCfg.f2+'@'+H2,
      values:c.layers[5].cache.output, C:cnnCfg.f2, GW:H2, GH:H2, desired: 115*dpr },
    { type:'strip',  title:'FLATTEN', sub:String(c.layers[6].cache.output.length),
      values:c.layers[6].cache.output, desired: 14*dpr },
    { type:'dots',   title:'DENSE',   sub:String(c.layers[7].outSize),
      values:c.layers[8].cache.output, n: c.layers[7].outSize, desired: 60*dpr },
    { type:'classes',title:'SOFTMAX', sub:classes.length+' cls',
      values:c.layers[10].cache.probs, desired: 120*dpr }
  ];

  /* CNN gap is larger too, so feature map layers have visible space */
  const gap = 60*dpr;
  let totalW = 0;
  for(const ly of layers){
    if(ly.skipDraw) continue;
    totalW += ly.desired + gap;
  }
  totalW -= gap;
  let x = Math.max(20*dpr, (W - totalW)/2);

  for(const ly of layers){
    if(ly.skipDraw){ ly.x = null; continue; }
    ly.x = x;
    ly.w = ly.desired;
    x += ly.w + gap;
  }

  const nodeY = (layer, idx)=>{
    if(layer.type === 'dots')
      return yMid - layer.h/2 + (idx + 0.5) * layer.h / layer.n;
    if(layer.type === 'classes'){
      const n = layer.values.length;
      return yMid - layer.h/2 + (idx + 0.5) * layer.h / n;
    }
    return yMid;
  };

  for(const ly of layers){
    if(ly.skipDraw) continue;
    if(ly.type === 'image'){
      ly.h = Math.min(ly.w, areaH);
    } else if(ly.type === 'fmaps'){
      const cols = Math.ceil(Math.sqrt(ly.C));
      const rows = Math.ceil(ly.C / cols);
      const cell = Math.min((ly.w - (cols-1)*4*dpr) / cols,
                            (areaH - (rows-1)*4*dpr) / rows);
      ly.h = rows*cell + (rows-1)*4*dpr;
      ly.cell = cell; ly.cols = cols; ly.rows = rows;
    } else {
      ly.h = areaH * 0.92;
    }
  }

  for(let li=0; li<layers.length - 1; li++){
    const A = layers[li], B = layers[li+1];
    if(A.skipDraw || B.skipDraw) continue;
    if(A.type === 'fmaps' && B.type === 'fmaps'
       && A.C === B.C && A.GW === B.GW*2){
      const nDraw = Math.min(A.C, 4);
      for(let c2=0; c2<nDraw; c2++){
        const aCell = A.cell, bCell = B.cell;
        const aTotalW = A.cols*aCell + (A.cols-1)*4*dpr;
        const aTotalH = A.rows*aCell + (A.rows-1)*4*dpr;
        const aStartX = A.x + (A.w - aTotalW)/2;
        const aStartY = yMid - aTotalH/2;
        const bTotalW = B.cols*bCell + (B.cols-1)*4*dpr;
        const bTotalH = B.rows*bCell + (B.rows-1)*4*dpr;
        const bStartX = B.x + (B.w - bTotalW)/2;
        const bStartY = yMid - bTotalH/2;
        const aCx = aStartX + (c2 % A.cols) * (aCell + 4*dpr) + aCell/2;
        const aCy = aStartY + Math.floor(c2 / A.cols) * (aCell + 4*dpr) + aCell/2;
        const bCx = bStartX + (c2 % B.cols) * (bCell + 4*dpr) + bCell/2;
        const bCy = bStartY + Math.floor(c2 / B.cols) * (bCell + 4*dpr) + bCell/2;
        dnnCtx.beginPath();
        dnnCtx.moveTo(aCx + aCell/2, aCy);
        dnnCtx.lineTo(bCx - bCell/2, bCy);
        dnnCtx.strokeStyle = 'rgba(90,169,255,0.45)';
        dnnCtx.lineWidth = 1.1*dpr;
        dnnCtx.stroke();
      }
    }
  }

  const flatL  = layers.find(l => l.type === 'strip' && !l.skipDraw);
  const denseL = layers.find(l => l.type === 'dots'  && !l.skipDraw);
  if(flatL && denseL && c.layers[7] && c.layers[7].W){
    const layer = c.layers[7];
    const K = 6;
    const rDense = clamp(denseL.h / denseL.n * 0.36, 3*dpr, 7*dpr);
    const denseCenterX = denseL.x + denseL.w/2;
    for(let j=0; j<layer.outSize; j++){
      const base = j * layer.inSize;
      const endX = denseCenterX - rDense;
      const endY = nodeY(denseL, j);
      const pairs = [];
      for(let i=0; i<layer.inSize; i++) pairs.push({ i, w: layer.W[base + i] });
      pairs.sort((a,b)=> Math.abs(b.w) - Math.abs(a.w));
      for(const { i, w } of pairs.slice(0, K)){
        const y0 = yMid - flatL.h/2 + (i + 0.5) * flatL.h / layer.inSize;
        drawCurvedEdge(flatL.x + flatL.w, y0, endX, endY, w, dpr, 0.95);
      }
    }
  }

  const denseLayer = c.layers[9];
  if(denseL && denseLayer && denseLayer.W){
    const clsL = layers[layers.length - 1];
    const nCls = classes.length;
    const clsLeftX = clsL.x + 6*dpr;
    const rDense = clamp(denseL.h / denseL.n * 0.36, 3*dpr, 7*dpr);
    const denseRightX = denseL.x + denseL.w/2 + rDense;
    for(let j=0; j<denseLayer.outSize; j++){
      const base = j * denseLayer.inSize;
      const endX = clsLeftX;
      const endY = nodeY(clsL, j);
      for(let i=0; i<denseLayer.inSize; i++){
        const startX = denseRightX;
        const startY = nodeY(denseL, i);
        const w = denseLayer.W[base + i];
        drawCurvedEdge(startX, startY, endX, endY, w, dpr, 1.0);
      }
    }
  }

  const paintFMaps = (layer)=>{
    const { x, w, C, GW, GH, cols, rows, cell, values } = layer;
    const totalW = cols*cell + (cols-1)*4*dpr;
    const totalH = rows*cell + (rows-1)*4*dpr;
    const startX = x + (w - totalW)/2;
    const startY = yMid - totalH/2;
    for(let ch=0; ch<C; ch++){
      const cx = startX + (ch % cols) * (cell + 4*dpr);
      const cy = startY + Math.floor(ch / cols) * (cell + 4*dpr);
      let mx = 1e-6;
      const base = ch * GW * GH;
      for(let i=0;i<GW*GH;i++) if(Math.abs(values[base + i]) > mx) mx = Math.abs(values[base + i]);
      const pw = cell / GW, ph = cell / GH;
      for(let yy=0; yy<GH; yy++){
        for(let xx=0; xx<GW; xx++){
          const v = values[base + yy*GW + xx] / mx;
          const cv = clamp(Math.floor(Math.abs(v)*255), 0, 255);
          dnnCtx.fillStyle = v >= 0
            ? 'rgb('+Math.floor(cv*0.21)+','+cv+','+Math.floor(cv*0.54)+')'
            : 'rgb('+cv+','+Math.floor(cv*0.42)+','+Math.floor(cv*0.42)+')';
          dnnCtx.fillRect(cx + xx*pw, cy + yy*ph, Math.ceil(pw)+0.5, Math.ceil(ph)+0.5);
        }
      }
      dnnCtx.strokeStyle = 'rgba(53,224,138,0.35)';
      dnnCtx.lineWidth = 0.8*dpr;
      dnnCtx.strokeRect(cx, cy, cell, cell);
    }
  };

  for(const ly of layers){
    if(ly.skipDraw) continue;
    if(ly.type === 'image'){
      const side = Math.min(ly.w, ly.h);
      const sx = ly.x + (ly.w - side)/2;
      const sy = yMid - side/2;
      drawInputImage(sx, sy, side, ly.values, dpr);
    } else if(ly.type === 'fmaps'){
      paintFMaps(ly);
    } else if(ly.type === 'strip'){
      const sy = yMid - ly.h/2;
      drawStrip(ly.x, sy, ly.w, ly.h, ly.values, dpr);
    } else if(ly.type === 'dots'){
      let mx = 1e-6;
      for(const v of ly.values) if(Math.abs(v) > mx) mx = Math.abs(v);
      const r = clamp(ly.h / ly.n * 0.36, 3*dpr, 7*dpr);
      for(let j=0; j<ly.n; j++){
        const cy = nodeY(ly, j);
        const cx = ly.x + ly.w/2;
        drawNeuron(cx, cy, r, ly.values[j]/mx, dpr);
      }
    } else if(ly.type === 'classes'){
      const n = ly.values.length;
      const r = clamp(ly.h / n * 0.30, 2*dpr, 22*dpr);
      const labelMode = n <= 6 ? 'full'
                      : n <= 12 ? 'short'
                      : n <= 24 ? 'pct'
                      : 'none';
      for(let j=0; j<n; j++){
        const cy = nodeY(ly, j);
        const cx = ly.x + r + 6*dpr;
        const v = ly.values[j];
        dnnCtx.save();
        dnnCtx.shadowColor = classes[j].color;
        dnnCtx.shadowBlur = (8 + 18*v)*dpr;
        dnnCtx.beginPath();
        dnnCtx.arc(cx, cy, r, 0, 6.2832);
        dnnCtx.fillStyle = classes[j].color;
        dnnCtx.globalAlpha = 0.55 + 0.45*v;
        dnnCtx.fill();
        dnnCtx.globalAlpha = 1;
        dnnCtx.restore();
        dnnCtx.beginPath();
        dnnCtx.arc(cx, cy, r, 0, 6.2832);
        dnnCtx.strokeStyle = 'rgba(10,14,21,0.95)';
        dnnCtx.lineWidth = 1.8*dpr;
        dnnCtx.stroke();
        if(labelMode === 'none') continue;
        const labelX = cx + r + 8*dpr;
        const nameFont = labelMode === 'full' ? 12 : 10;
        const pctFont  = labelMode === 'full' ? 14 : 12;
        const maxNameChars = labelMode === 'full' ? 12 : 8;
        if(labelMode !== 'pct'){
          dnnCtx.fillStyle = '#e8f0ff';
          dnnCtx.font = '700 '+(nameFont*dpr)+'px ui-sans-serif,sans-serif';
          dnnCtx.textAlign = 'left'; dnnCtx.textBaseline = 'middle';
          const nm = classes[j].name.length > maxNameChars
            ? classes[j].name.slice(0, maxNameChars - 1) + '…'
            : classes[j].name;
          dnnCtx.fillText(nm, labelX, cy - 7*dpr);
        }
        dnnCtx.fillStyle = classes[j].color;
        dnnCtx.font = '700 '+(pctFont*dpr)+'px ui-monospace,monospace';
        dnnCtx.textAlign = 'left'; dnnCtx.textBaseline = 'middle';
        dnnCtx.fillText((v*100).toFixed(0)+'%',
                        labelX, labelMode === 'pct' ? cy : cy + 10*dpr);
      }
    }
  }

  for(const ly of layers){
    if(ly.skipDraw) continue;
    dnnCtx.fillStyle = '#e8f0ff';
    dnnCtx.font = '700 '+(11*dpr)+'px ui-sans-serif,sans-serif';
    dnnCtx.textAlign = 'center'; dnnCtx.textBaseline = 'bottom';
    dnnCtx.fillText(ly.title, ly.x + ly.w/2, padY - 24*dpr);
    dnnCtx.fillStyle = '#68798f';
    dnnCtx.font = '600 '+(9.5*dpr)+'px ui-monospace,monospace';
    dnnCtx.textBaseline = 'bottom';
    dnnCtx.fillText(ly.sub, ly.x + ly.w/2, padY - 10*dpr);
  }

  dnnInfo.textContent = 'CNN · conv1+' + cnnCfg.f1 + ' · conv2+' + cnnCfg.f2
    + ' · dense+' + cnnCfg.dense
    + (previewLocked ? ' · preview: ' + previewName : ' · live input');
}

/* =================================================================
   FEATURE MAPS panel
   ================================================================= */
function rebuildFeatureCells(){
  featGrid.innerHTML = '';
  featCanvases = [];
  const n = netMode === 'cnn' ? cnnCfg.f1 : 0;
  for(let i=0;i<n;i++){
    const cell = document.createElement('div');
    cell.className = 'featCell';
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    cell.appendChild(c);
    featGrid.appendChild(cell);
    featCanvases.push(c);
  }
}

const _featTmp = document.createElement('canvas');
const _featTmpCtx = _featTmp.getContext('2d');

function drawFeatureMaps(){
  if(netMode !== 'cnn' || !cnn || !lastLiveVec) return;
  if(steps === 0) return;
  cnnForward(cnn, lastLiveVec);
  const relu1 = cnn.layers[1];
  const out = relu1.cache.output;
  if(!out) return;
  const H = cnn.H, W = cnn.H;
  const nF = cnnCfg.f1;
  for(let f=0; f<nF && f < featCanvases.length; f++){
    let maxAbs = 1e-6;
    const base = f * H * W;
    for(let i=0;i<H*W;i++) if(out[base + i] > maxAbs) maxAbs = out[base + i];
    _featTmp.width = H; _featTmp.height = W;
    const img = _featTmpCtx.createImageData(H, W);
    for(let i=0;i<H*W;i++){
      const v = out[base + i] / maxAbs;
      const c = clamp(Math.floor(v*255), 0, 255);
      img.data[i*4] = c; img.data[i*4+1] = c; img.data[i*4+2] = c; img.data[i*4+3] = 255;
    }
    _featTmpCtx.putImageData(img, 0, 0);
    const ctx = featCanvases[f].getContext('2d');
    ctx.clearRect(0,0,featCanvases[f].width,featCanvases[f].height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(_featTmp, 0, 0, featCanvases[f].width, featCanvases[f].height);
  }
}