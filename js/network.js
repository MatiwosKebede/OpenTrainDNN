'use strict';

/* =================================================================
   network.js — dense and CNN forward/backward, Adam optimizer,
   evaluation, and the network rebuild helpers.
   ================================================================= */

/* -----------------------------------------------------------------
   DENSE network
   ----------------------------------------------------------------- */
function denseBuild(){
  L = [];
  for(let i=1; i<sizes.length; i++){
    L.push({
      nin: sizes[i-1],
      nout: sizes[i],
      W: new Float64Array(sizes[i] * sizes[i-1]),
      b: new Float64Array(sizes[i])
    });
  }
  denseInit();
}

function denseInitAdam(){
  adamDense = {
    t: 0,
    m: L.map(l => ({ W: new Float64Array(l.W.length), b: new Float64Array(l.b.length) })),
    v: L.map(l => ({ W: new Float64Array(l.W.length), b: new Float64Array(l.b.length) }))
  };
}

function denseInit(){
  const gain = (act === 'relu') ? 2 : 1;
  for(const l of L){
    const s = Math.sqrt(gain / (l.nin + l.nout));
    for(let k=0;k<l.W.length;k++) l.W[k] = gauss()*s;
    l.b.fill(0);
  }
  /* rescale each layer so its outputs land near unit rms */
  if(data.length){
    for(let li=0; li<L.length; li++){
      for(let pass=0; pass<8; pass++){
        let s2 = 0, cnt = 0;
        const probe = data.slice(0, Math.min(8, data.length));
        for(const s of probe){
          const a = denseFwd(s.p).acts[li+1];
          for(const v of a){ s2 += v*v; cnt++; }
        }
        const rms = Math.sqrt(s2 / Math.max(1,cnt));
        if(!isFinite(rms) || rms === 0) break;
        const r = clamp(0.6/rms, 0.5, 2);
        if(r > 0.9 && r < 1.1) break;
        for(let k=0;k<L[li].W.length;k++) L[li].W[k] *= r;
      }
    }
  }
  denseInitAdam();
  steps = 0;
  bestValAcc = 0; bestValStep = 0;
}

function denseFwd(p, cache){
  const acts = [Float64Array.from(p)];
  const C = cache ? [] : null;
  for(let li=0; li<L.length; li++){
    const l = L[li];
    const ain = acts[li];
    const out = new Float64Array(l.nout);
    const last = li === L.length-1;
    if(mode === 'abstract'){
      const pre = cache ? new Float64Array(l.nout) : null;
      for(let j=0;j<l.nout;j++){
        let u = l.b[j];
        for(let i=0;i<l.nin;i++) u += l.W[j*l.nin+i]*ain[i];
        if(pre) pre[j] = u;
        out[j] = last ? u : actF(u, act);
      }
      if(cache) C.push({ pre, last });
    } else {
      const cw = cache ? new Float64Array(l.nout*l.nin) : null;
      const cb = cache ? new Float64Array(l.nout) : null;
      for(let j=0;j<l.nout;j++){
        let I = 0;
        for(let i=0;i<l.nin;i++){
          const d = l.W[j*l.nin+i]*ain[i];
          I += devId(d);
          if(cw) cw[j*l.nin+i] = P.RL*devIdP(d);
        }
        I += devId(l.b[j]);
        if(cb) cb[j] = P.RL*devIdP(l.b[j]);
        out[j] = P.RL * (I - (l.nin+1)*ID0);
      }
      if(cache) C.push({ cW:cw, cB:cb, last });
    }
    acts.push(out);
  }
  const logits = acts[acts.length-1];
  const probs  = softmax(logits);
  return { acts, C, logits, probs };
}

function denseStep(){
  if(!data.length || classes.length < 2) return 0;
  const bs = Math.min(BATCH, data.length);
  const gW = L.map(l => new Float64Array(l.W.length));
  const gB = L.map(l => new Float64Array(l.b.length));
  let tot = 0;

  for(let n=0;n<bs;n++){
    const s = data[(Math.random()*data.length)|0];
    const f = denseFwd(s.p, true);
    const probs = f.probs;
    tot += -Math.log(Math.max(probs[s.cls], 1e-9));

    let dA = new Float64Array(probs.length);
    for(let j=0;j<probs.length;j++)
      dA[j] = (probs[j] - (j===s.cls ? 1 : 0))/bs;

    for(let li=L.length-1; li>=0; li--){
      const l = L[li], c = f.C[li], ain = f.acts[li];
      const din = new Float64Array(l.nin);
      for(let j=0;j<l.nout;j++){
        if(mode === 'abstract'){
          const yj = c.last ? c.pre[j] : actF(c.pre[j], act);
          const prime = c.last ? 1 : actDf(c.pre[j], act, yj);
          const du = dA[j] * prime;
          for(let i=0;i<l.nin;i++){
            gW[li][j*l.nin+i] += du*ain[i];
            din[i] += du*l.W[j*l.nin+i];
          }
          gB[li][j] += du;
        } else {
          for(let i=0;i<l.nin;i++){
            const k = c.cW[j*l.nin+i];
            gW[li][j*l.nin+i] += dA[j]*k*ain[i];
            din[i] += dA[j]*k*l.W[j*l.nin+i];
          }
          gB[li][j] += dA[j]*c.cB[j];
        }
      }
      dA = din;
    }
  }

  adamDense.t++;
  const bc1 = 1-Math.pow(BETA1, adamDense.t);
  const bc2 = 1-Math.pow(BETA2, adamDense.t);

  for(let li=0; li<L.length; li++){
    const l = L[li];
    const mW = adamDense.m[li].W, vW = adamDense.v[li].W;
    const mB = adamDense.m[li].b, vB = adamDense.v[li].b;
    for(let k=0;k<l.W.length;k++){
      const g = gW[li][k];
      mW[k] = BETA1*mW[k] + (1-BETA1)*g;
      vW[k] = BETA2*vW[k] + (1-BETA2)*g*g;
      l.W[k] -= ETA*(mW[k]/bc1)/(Math.sqrt(vW[k]/bc2)+ADAM_EPS);
      l.W[k] = clamp(l.W[k], -WEIGHT_CLIP, WEIGHT_CLIP);
    }
    for(let k=0;k<l.b.length;k++){
      const g = gB[li][k];
      mB[k] = BETA1*mB[k] + (1-BETA1)*g;
      vB[k] = BETA2*vB[k] + (1-BETA2)*g*g;
      l.b[k] -= ETA*(mB[k]/bc1)/(Math.sqrt(vB[k]/bc2)+ADAM_EPS);
      l.b[k] = clamp(l.b[k], -WEIGHT_CLIP, WEIGHT_CLIP);
    }
  }
  steps++;
  return tot/bs;
}

/* -----------------------------------------------------------------
   CNN
   ----------------------------------------------------------------- */
function cnnMakeConv(inC, inH, inW, outC, k, pad){
  const scale = Math.sqrt(2 / (inC*k*k));
  const nW = outC * inC * k * k;
  const W = new Float64Array(nW);
  for(let i=0;i<nW;i++) W[i] = gauss()*scale;
  return {
    type:'conv', inC, inH, inW, outC, k, pad,
    W, b: new Float64Array(outC),
    dW: new Float64Array(nW), db: new Float64Array(outC),
    mW: new Float64Array(nW), vW: new Float64Array(nW),
    mB: new Float64Array(outC), vB: new Float64Array(outC),
    cache: {}
  };
}

function cnnMakeDense(inSize, outSize){
  const scale = Math.sqrt(2 / inSize);
  const nW = outSize * inSize;
  const W = new Float64Array(nW);
  for(let i=0;i<nW;i++) W[i] = gauss()*scale;
  return {
    type:'dense', inSize, outSize,
    W, b: new Float64Array(outSize),
    dW: new Float64Array(nW), db: new Float64Array(outSize),
    mW: new Float64Array(nW), vW: new Float64Array(nW),
    mB: new Float64Array(outSize), vB: new Float64Array(outSize),
    cache: {}
  };
}

function cnnBuild(){
  const H  = SIZE;
  const F1 = cnnCfg.f1, F2 = cnnCfg.f2, DH = cnnCfg.dense;
  const k = 3, pad = 1;
  const layers = [];

  layers.push(cnnMakeConv(1, H, H, F1, k, pad));
  layers.push({ type:'relu', cache:{} });
  layers.push({ type:'maxpool', size:2, cache:{} });

  const H1 = Math.floor(H/2);
  layers.push(cnnMakeConv(F1, H1, H1, F2, k, pad));
  layers.push({ type:'relu', cache:{} });
  layers.push({ type:'maxpool', size:2, cache:{} });

  const H2 = Math.floor(H1/2);
  const flat = F2 * H2 * H2;
  layers.push({ type:'flatten', cache:{} });
  layers.push(cnnMakeDense(flat, DH));
  layers.push({ type:'relu', cache:{} });
  layers.push(cnnMakeDense(DH, classes.length));
  layers.push({ type:'softmax', cache:{} });

  cnn = { layers, H, nClasses: classes.length, t: 0 };
  steps = 0;
  bestValAcc = 0; bestValStep = 0;
}

function cnnForward(c, input){
  let cur = input;
  let shape = { C:1, H:c.H, W:c.H };

  for(const layer of c.layers){
    if(layer.type === 'conv'){
      const { inC, inH, inW, outC, k, pad } = layer;
      const outH = inH, outW = inW;
      const out = new Float64Array(outC * outH * outW);
      for(let oc=0; oc<outC; oc++){
        const wBase = oc * inC * k * k;
        const bias = layer.b[oc];
        const outBase = oc * outH * outW;
        for(let oy=0; oy<outH; oy++){
          for(let ox=0; ox<outW; ox++){
            let sum = bias;
            for(let ic=0; ic<inC; ic++){
              const inBase = ic * inH * inW;
              const wBaseIC = wBase + ic * k * k;
              for(let ky=0; ky<k; ky++){
                const iy = oy + ky - pad;
                if(iy < 0 || iy >= inH) continue;
                for(let kx=0; kx<k; kx++){
                  const ix = ox + kx - pad;
                  if(ix < 0 || ix >= inW) continue;
                  sum += layer.W[wBaseIC + ky*k + kx] * cur[inBase + iy*inW + ix];
                }
              }
            }
            out[outBase + oy*outW + ox] = sum;
          }
        }
      }
      layer.cache.input = cur;
      layer.cache.output = out;
      layer.cache.shape = { C:outC, H:outH, W:outW };
      cur = out;
      shape = { C:outC, H:outH, W:outW };
    }
    else if(layer.type === 'relu'){
      const out  = new Float64Array(cur.length);
      const mask = new Uint8Array(cur.length);
      for(let i=0;i<cur.length;i++){
        if(cur[i] > 0){ out[i] = cur[i]; mask[i] = 1; }
      }
      layer.cache.mask = mask;
      layer.cache.output = out;
      layer.cache.shape = { ...shape };
      cur = out;
    }
    else if(layer.type === 'maxpool'){
      const s    = layer.size;
      const outH = Math.floor(shape.H / s);
      const outW = Math.floor(shape.W / s);
      const out  = new Float64Array(shape.C * outH * outW);
      const argmax = new Int32Array(shape.C * outH * outW);
      for(let cc=0; cc<shape.C; cc++){
        const cBase = cc * shape.H * shape.W;
        const cOut  = cc * outH * outW;
        for(let oy=0; oy<outH; oy++){
          for(let ox=0; ox<outW; ox++){
            let best = -Infinity, bestIdx = 0;
            for(let ky=0; ky<s; ky++){
              for(let kx=0; kx<s; kx++){
                const iy = oy*s + ky;
                const ix = ox*s + kx;
                const idx = cBase + iy*shape.W + ix;
                const v = cur[idx];
                if(v > best){ best = v; bestIdx = idx; }
              }
            }
            out[cOut + oy*outW + ox] = best;
            argmax[cOut + oy*outW + ox] = bestIdx;
          }
        }
      }
      layer.cache.argmax = argmax;
      layer.cache.inShape = { C:shape.C, H:shape.H, W:shape.W };
      layer.cache.output = out;
      layer.cache.shape = { C:shape.C, H:outH, W:outW };
      cur = out;
      shape = { C:shape.C, H:outH, W:outW };
    }
    else if(layer.type === 'flatten'){
      layer.cache.shape = { ...shape };
      layer.cache.output = cur;
    }
    else if(layer.type === 'dense'){
      const out = new Float64Array(layer.outSize);
      for(let j=0; j<layer.outSize; j++){
        let sum = layer.b[j];
        const wBase = j * layer.inSize;
        for(let i=0; i<layer.inSize; i++) sum += layer.W[wBase + i] * cur[i];
        out[j] = sum;
      }
      layer.cache.input = cur;
      layer.cache.output = out;
      cur = out;
    }
    else if(layer.type === 'softmax'){
      const p = softmax(cur);
      layer.cache.probs = p;
      layer.cache.output = p;
      cur = p;
    }
  }
  return cur;
}

function cnnZeroGrads(c){
  for(const layer of c.layers){
    if(layer.dW) layer.dW.fill(0);
    if(layer.db) layer.db.fill(0);
  }
}

function cnnBackward(c, target){
  const last = c.layers[c.layers.length-1];
  if(last.type !== 'softmax') return 0;
  const probs = last.cache.probs;
  const loss = -Math.log(Math.max(probs[target], 1e-9));

  let grad = new Float64Array(probs.length);
  for(let i=0; i<probs.length; i++) grad[i] = probs[i] - (i===target ? 1 : 0);

  for(let li = c.layers.length-2; li >= 0; li--){
    const layer = c.layers[li];
    if(layer.type === 'dense'){
      const input = layer.cache.input;
      const gin   = new Float64Array(layer.inSize);
      for(let j=0; j<layer.outSize; j++){
        const g = grad[j];
        if(g === 0) continue;
        const wBase = j * layer.inSize;
        for(let i=0; i<layer.inSize; i++){
          layer.dW[wBase + i] += g * input[i];
          gin[i] += g * layer.W[wBase + i];
        }
        layer.db[j] += g;
      }
      grad = gin;
    }
    else if(layer.type === 'relu'){
      const mask = layer.cache.mask;
      for(let i=0; i<grad.length; i++) if(!mask[i]) grad[i] = 0;
    }
    else if(layer.type === 'maxpool'){
      const { argmax, inShape } = layer.cache;
      const gin = new Float64Array(inShape.C * inShape.H * inShape.W);
      for(let i=0; i<argmax.length; i++) gin[argmax[i]] += grad[i];
      grad = gin;
    }
    else if(layer.type === 'flatten'){ /* no-op */ }
    else if(layer.type === 'conv'){
      const input = layer.cache.input;
      const { inC, inH, inW, outC, k, pad } = layer;
      const outH = inH, outW = inW;
      const gin = new Float64Array(inC * inH * inW);
      for(let oc=0; oc<outC; oc++){
        const wBase = oc * inC * k * k;
        const outBase = oc * outH * outW;
        for(let oy=0; oy<outH; oy++){
          for(let ox=0; ox<outW; ox++){
            const g = grad[outBase + oy*outW + ox];
            if(g === 0) continue;
            layer.db[oc] += g;
            for(let ic=0; ic<inC; ic++){
              const inBase = ic * inH * inW;
              const wBaseIC = wBase + ic * k * k;
              for(let ky=0; ky<k; ky++){
                const iy = oy + ky - pad;
                if(iy < 0 || iy >= inH) continue;
                for(let kx=0; kx<k; kx++){
                  const ix = ox + kx - pad;
                  if(ix < 0 || ix >= inW) continue;
                  const wi = wBaseIC + ky*k + kx;
                  layer.dW[wi] += g * input[inBase + iy*inW + ix];
                  gin[inBase + iy*inW + ix] += g * layer.W[wi];
                }
              }
            }
          }
        }
      }
      grad = gin;
    }
  }
  return loss;
}

function cnnAdamStep(c, eta){
  c.t++;
  const bc1 = 1-Math.pow(BETA1, c.t);
  const bc2 = 1-Math.pow(BETA2, c.t);
  for(const layer of c.layers){
    if(!layer.W) continue;
    for(let i=0;i<layer.W.length;i++){
      const g = layer.dW[i];
      layer.mW[i] = BETA1*layer.mW[i] + (1-BETA1)*g;
      layer.vW[i] = BETA2*layer.vW[i] + (1-BETA2)*g*g;
      layer.W[i] -= eta*(layer.mW[i]/bc1)/(Math.sqrt(layer.vW[i]/bc2)+ADAM_EPS);
      layer.W[i] = clamp(layer.W[i], -WEIGHT_CLIP, WEIGHT_CLIP);
    }
    for(let i=0;i<layer.b.length;i++){
      const g = layer.db[i];
      layer.mB[i] = BETA1*layer.mB[i] + (1-BETA1)*g;
      layer.vB[i] = BETA2*layer.vB[i] + (1-BETA2)*g*g;
      layer.b[i] -= eta*(layer.mB[i]/bc1)/(Math.sqrt(layer.vB[i]/bc2)+ADAM_EPS);
      layer.b[i] = clamp(layer.b[i], -WEIGHT_CLIP, WEIGHT_CLIP);
    }
  }
}

function cnnStep(){
  if(!cnn || !data.length || classes.length < 2) return 0;
  cnnZeroGrads(cnn);
  const bs = Math.min(CNN_BATCH, data.length);
  let tot = 0;
  for(let n=0; n<bs; n++){
    const s = data[(Math.random()*data.length)|0];
    const probs = cnnForward(cnn, s.p);
    tot += -Math.log(Math.max(probs[s.cls], 1e-9));
    cnnBackward(cnn, s.cls);
  }
  for(const layer of cnn.layers){
    if(!layer.dW) continue;
    for(let i=0;i<layer.dW.length;i++) layer.dW[i] /= bs;
    for(let i=0;i<layer.db.length;i++) layer.db[i] /= bs;
  }
  cnnAdamStep(cnn, CNN_ETA);
  steps++;
  return tot/bs;
}

/* -----------------------------------------------------------------
   Unified
   ----------------------------------------------------------------- */
function predictVec(vec){
  if(netMode === 'cnn'){
    if(!cnn) return new Float64Array(classes.length);
    return cnnForward(cnn, vec);
  }
  return denseFwd(vec).probs;
}

function evalAll(){
  if(!data.length){ acc = 0; lossNow = 0; }
  else {
    let ok = 0, tot = 0;
    for(const s of data){
      const probs = predictVec(s.p);
      if(argmax(probs) === s.cls) ok++;
      tot += -Math.log(Math.max(probs[s.cls], 1e-9));
    }
    acc = ok/data.length;
    lossNow = tot/data.length;
  }
  if(!valData.length){ valAcc = 0; return; }
  let vok = 0;
  for(const s of valData){
    const probs = predictVec(s.p);
    if(argmax(probs) === s.cls) vok++;
  }
  valAcc = vok/valData.length;
  if(valAcc > bestValAcc){
    bestValAcc = valAcc;
    bestValStep = steps;
  }
}

function resetNetworks(){
  if(netMode === 'cnn') cnnBuild(); else denseBuild();
  steps = 0;
  bestValAcc = 0; bestValStep = 0;
}

function weightRange(){
  let mn = Infinity, mx = 0;
  if(netMode === 'cnn' && cnn){
    for(const layer of cnn.layers){
      if(!layer.W) continue;
      for(const w of layer.W){
        const a = Math.abs(w);
        if(a > 0.001 && a < mn) mn = a;
        if(a > mx) mx = a;
      }
    }
  } else {
    for(const l of L){
      for(const w of l.W){
        const a = Math.abs(w);
        if(a > 0.001 && a < mn) mn = a;
        if(a > mx) mx = a;
      }
    }
  }
  if(!isFinite(mn)) mn = 0;
  return [mn, mx];
}

function rebuildData(){
  data = [];
  valData = [];
  classes.forEach((c, ci)=>{
    for(const s of c.samples){
      const entry = { p: s.p, cls: ci };
      if(s.isVal) valData.push(entry);
      else data.push(entry);
    }
  });
}

function rebuildNetwork(){
  if(netMode === 'cnn'){
    cnnBuild();
  } else {
    const hidden = parseHidden(archIn.value);
    if(!hidden) return;
    sizes = [SIZE*SIZE, ...hidden, classes.length];
    archFull.textContent = sizes.join(' → ');
    denseBuild();
  }
}
