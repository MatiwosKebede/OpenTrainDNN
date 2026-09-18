'use strict';

/* =================================================================
   math.js — pure math helpers, activations, and the MOSFET device model.
   No state, no DOM. Every function is a pure function of its inputs.
   ================================================================= */

function clamp(v,a,b){ return v<a?a:(v>b?b:v); }

function gauss(){
  let u=0,v=0;
  while(!u) u=Math.random();
  while(!v) v=Math.random();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
}

function sigmoid(x){
  return x>=0 ? 1/(1+Math.exp(-x)) : Math.exp(x)/(1+Math.exp(x));
}

function softplus(x){
  return x>30 ? x : (x<-30 ? Math.exp(x) : Math.log1p(Math.exp(x)));
}

function softmax(z){
  let m=-Infinity;
  for(let i=0;i<z.length;i++) if(z[i]>m) m=z[i];
  const e=new Float64Array(z.length);
  let s=0;
  for(let i=0;i<z.length;i++){ e[i]=Math.exp(z[i]-m); s+=e[i]; }
  for(let i=0;i<z.length;i++) e[i]/=s;
  return e;
}

function argmax(v){
  let k=0;
  for(let i=1;i<v.length;i++) if(v[i]>v[k]) k=i;
  return k;
}

/* -----------------------------------------------------------------
   MOSFET device model — used only in "Devices" mode
   ----------------------------------------------------------------- */
const NVT = 0.04;
const P   = { RL:12, RS:1.5, VB:1.0, K:1.0, VTH:0.7, G:0.2 };

function devId(d){
  const vgs = P.VB + P.RS*d*P.G;
  const z   = (vgs - P.VTH)/NVT;
  const vov = NVT*softplus(z);
  return 0.5*P.K*vov*vov;
}
function devIdP(d){
  const vgs = P.VB + P.RS*d*P.G;
  const z   = (vgs - P.VTH)/NVT;
  const vov = NVT*softplus(z);
  return P.K*vov*sigmoid(z)*P.RS*P.G;
}
const ID0 = devId(0);

/* -----------------------------------------------------------------
   Activation functions and their exact derivatives
   ----------------------------------------------------------------- */
function actF(u, k){
  if(k === 'relu') return u>0 ? u : 0;
  if(k === 'gelu'){
    const v = 0.7978845608028654*(u + 0.044715*u*u*u);
    return 0.5*u*(1 + Math.tanh(v));
  }
  return Math.tanh(u);
}

function actDf(u, k, y){
  if(k === 'relu') return u>0 ? 1 : 0;
  if(k === 'gelu'){
    const v  = 0.7978845608028654*(u + 0.044715*u*u*u);
    const t  = Math.tanh(v);
    const dv = 0.7978845608028654*(1 + 3*0.044715*u*u);
    return 0.5*(1+t) + 0.5*u*(1 - t*t)*dv;
  }
  return 1 - y*y;
}
