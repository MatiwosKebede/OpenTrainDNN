'use strict';

/* =================================================================
   classes.js — class blocks, capture, file handling, add/remove class.
   ================================================================= */

const classesWrap  = document.getElementById('classesWrap');
const classCountEl = document.getElementById('classCount');

function rebuildClassesUI(){
  classesWrap.innerHTML = '';
  classCountEl.textContent = classes.length;

  classes.forEach((c, ci)=>{
    const block = document.createElement('div');
    block.className = 'classBlock';

    const header = document.createElement('div');
    header.className = 'classHeader';

    const swatch = document.createElement('div');
    swatch.className = 'classSwatch'; swatch.style.background = c.color;

    const nameIn = document.createElement('input');
    nameIn.type = 'text'; nameIn.className = 'className';
    nameIn.value = c.name; nameIn.maxLength = 20;
    nameIn.oninput = ()=>{ c.name = nameIn.value || ('Class '+(ci+1)); rebuildPredBars(); };
    nameIn.onblur  = ()=>{
      if(!nameIn.value.trim()){ c.name = 'Class '+(ci+1); nameIn.value = c.name; }
      rebuildPredBars();
    };

    const badge = document.createElement('div');
    badge.className = 'classIdxBadge';
    badge.textContent = '[' + (ci+1) + ']';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'removeBtn';
    removeBtn.textContent = '×';
    removeBtn.style.display = classes.length > 2 ? 'flex' : 'none';
    removeBtn.onclick = ()=> removeClass(c.id);

    header.append(swatch, nameIn, badge, removeBtn);

    const drop = document.createElement('div');
    drop.className = 'drop'; drop.textContent = 'Drop images here';
    const fileIn = document.createElement('input');
    fileIn.type = 'file'; fileIn.accept = 'image/*'; fileIn.multiple = true;
    fileIn.hidden = true;
    drop.onclick = ()=> fileIn.click();
    fileIn.onchange = e=>{ handleFiles(e.target.files, ci); e.target.value=''; };
    drop.addEventListener('dragover', e=>{ e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', ()=> drop.classList.remove('over'));
    drop.addEventListener('drop', e=>{
      e.preventDefault(); drop.classList.remove('over');
      handleFiles(e.dataTransfer.files, ci);
    });

    const cap = document.createElement('button');
    cap.className = 'captureBtn';
    cap.textContent = (inputSource === 'mic' ? '🎤 Capture   [' : '📷 Capture   [')
                      + (ci+1) + ']';
    cap.onclick = ()=> captureCurrent(ci);

    const thumbs = document.createElement('div');
    thumbs.className = 'thumbs';

    const cnt = document.createElement('div');
    cnt.className = 'count';

    block.append(header, drop, fileIn, cap, thumbs, cnt);
    classesWrap.appendChild(block);

    c.samples.forEach((s, idx)=>{
      const wrap = document.createElement('div');
      wrap.className = 'thumb';
      if(currentPreviewSample === s) wrap.classList.add('preview');
      if(s.isVal) wrap.classList.add('isval');
      wrap.title = s.isVal
        ? 'validation sample — click to preview · shift+click to remove'
        : 'training sample — click to preview · shift+click to remove';
      wrap.appendChild(s.thumb);
      wrap.onclick = (e)=>{
        if(e.shiftKey){ e.preventDefault(); removeSample(ci, idx); return; }
        currentPreviewSample = s;
        setPreviewFromSample(s, c.name + ' #' + (idx+1) + (s.isVal ? ' (val)' : ''));
        rebuildClassesUI();
      };
      thumbs.appendChild(wrap);
    });

    const nTrain = c.samples.filter(s => !s.isVal).length;
    const nVal   = c.samples.filter(s =>  s.isVal).length;
    cnt.textContent = nTrain + ' train · ' + nVal + ' val  (shift+click to remove)';
  });
}

async function handleFiles(files, ci){
  for(const f of files){
    if(!f.type.startsWith('image/')) continue;
    try{
      const im  = await loadImageFromFile(f);
      const vec = imageToVector(im);
      const thumb = makeThumbFromImage(im);
      const isVal = (classes[ci].samples.length % VAL_EVERY === VAL_EVERY-1);
      classes[ci].samples.push({ p: vec, thumb, isVal });
      if(!previewLocked && inputSource === 'camera') setLiveSource(im, 'image');
    }catch(e){ console.warn('skip', f.name, e); }
  }
  rebuildData();
  rebuildClassesUI();
}

function captureCurrent(ci){
  if(!lastLiveVec){ alert('No live input. Start camera or microphone first.'); return; }
  if(ci < 0 || ci >= classes.length) return;
  const vec = new Float64Array(lastLiveVec);
  let thumb;
  if(inputSource === 'mic'){
    thumb = makeThumbFromVec(vec);
  } else {
    thumb = document.createElement('canvas');
    thumb.width = thumb.height = SIZE;
    const tc = thumb.getContext('2d');
    if(liveSource){
      const sw = liveSource.videoWidth || liveSource.width || 1;
      const sh = liveSource.videoHeight || liveSource.height || 1;
      const side = Math.min(sw, sh);
      tc.drawImage(liveSource, (sw-side)/2, (sh-side)/2, side, side, 0, 0, SIZE, SIZE);
    } else {
      tc.fillStyle = '#0a0e15'; tc.fillRect(0,0,SIZE,SIZE);
    }
  }
  const isVal = (classes[ci].samples.length % VAL_EVERY === VAL_EVERY-1);
  classes[ci].samples.push({ p: vec, thumb, isVal });
  rebuildData();
  rebuildClassesUI();
}

function removeSample(ci, idx){
  if(currentPreviewSample === classes[ci].samples[idx]) currentPreviewSample = null;
  classes[ci].samples.splice(idx, 1);
  rebuildData();
  rebuildClassesUI();
}

function addClass(){
  if(classes.length >= 8){ alert('Maximum 8 classes.'); return; }
  const id = nextClassId++;
  classes.push({
    id,
    name: 'Class ' + (classes.length + 1),
    color: PALETTE[classes.length % PALETTE.length],
    samples: []
  });
  rebuildData();
  rebuildClassesUI();
  rebuildPredBars();
  rebuildNetwork();
}

function removeClass(id){
  if(classes.length <= 2) return;
  if(!confirm('Remove this class and all its images?')) return;
  classes = classes.filter(c => c.id !== id);
  rebuildData();
  rebuildClassesUI();
  rebuildPredBars();
  rebuildNetwork();
}
