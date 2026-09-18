'use strict';

/* =================================================================
   state.js — every piece of mutable state in the application.
   Other modules read and write these globals directly.
   Script load order guarantees this file runs before any consumer.
   ================================================================= */

/* ---- input ---- */
let SIZE = 16;
let inputSource = 'camera';      /* 'camera' | 'mic' */

/* ---- classes ---- */
const PALETTE = ['#35e08a','#ff6b6b','#e8b93c','#5ab1ff','#b088ff',
                 '#ff8cc6','#ffa94d','#66d9d9'];
let classes = [
  { id: 0, name: 'Class 1', color: PALETTE[0], samples: [] },
  { id: 1, name: 'Class 2', color: PALETTE[1], samples: [] }
];
let nextClassId = 2;
let data = [];       /* training samples */
let valData = [];    /* validation samples */
const VAL_EVERY = 5;

/* ---- training config ---- */
const WEIGHT_CLIP = 6;
const ETA         = 0.01;
const CNN_ETA     = 0.008;
const BETA1 = 0.9, BETA2 = 0.999, ADAM_EPS = 1e-8;
const BATCH     = 32;
const CNN_BATCH = 8;

/* ---- training runtime ---- */
let netMode  = 'dense';       /* 'dense' | 'cnn' */
let mode     = 'abstract';    /* 'abstract' | 'physical' */
let act      = 'relu';        /* 'relu' | 'gelu' | 'tanh' */
let training = false;
let steps = 0, acc = 0, valAcc = 0, lossNow = 0;
let bestValAcc = 0, bestValStep = 0;

/* ---- networks ---- */
let sizes = [SIZE*SIZE, 32, 16, classes.length];
let L = [];                   /* dense layers */
let adamDense = null;
let cnn = null;               /* CNN object when netMode === 'cnn' */
let cnnCfg = { f1: 8, f2: 16, dense: 32 };

/* ---- live view / preview ---- */
let liveSource = null;
let lastLiveVec = null;
let previewLocked = false;
let previewName = '';
let currentPreviewSample = null;

/* ---- camera ---- */
let videoEl  = null;
let camStream = null;
let camRaf   = null;

/* ---- microphone ---- */
let audioCtx   = null;
let audioStream = null;
let analyser   = null;
let freqBytes  = null;
let specBuf    = null;
let specWrite  = 0;
let micRaf     = null;
let micLastFrame = 0;
const MIC_FRAME_MS = 25;

/* ---- callbacks set by main.js to avoid circular imports ---- */
let onFrameTick = null;   /* called each main-loop frame */
let onInputTick = null;   /* called each camera/mic tick */
