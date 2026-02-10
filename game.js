(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  if (!canvas || !ctx) {
    return;
  }

  const ui = {
    startBtn: document.getElementById("start-btn"),
    confirmBtn: document.getElementById("confirm-btn"),
    nextBtn: document.getElementById("next-btn"),
    cameraBtn: document.getElementById("camera-btn"),
    resetBtn: document.getElementById("reset-btn"),
    hint: document.getElementById("hint"),
  };

  const CAM_W = 160;
  const CAM_H = 120;
  const MAX_LIVES = 4;
  const THEME = {
    teal: "#22495A",
    darkTeal: "#1A3642",
    beige: "#D8C7BD",
    lightBeige: "#F2EBE7",
    cream: "#FAFAFA",
    text: "#1F2937",
    muted: "#6B7280",
    softWhite: "rgba(255, 255, 255, 0.9)",
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pick(list) {
    return list[randInt(0, list.length - 1)];
  }

  function shuffle(list) {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = arr[i];
      arr[i] = arr[j];
      arr[j] = temp;
    }
    return arr;
  }

  function gcd(a, b) {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y !== 0) {
      const t = x % y;
      x = y;
      y = t;
    }
    return x || 1;
  }

  function simplifyFraction(num, den) {
    if (den === 0) {
      return { num: 0, den: 1 };
    }
    const sign = den < 0 ? -1 : 1;
    const n = num * sign;
    const d = Math.abs(den);
    const g = gcd(n, d);
    return { num: n / g, den: d / g };
  }

  function toFractionLabel(value, maxDen = 12) {
    if (!Number.isFinite(value)) {
      return "?";
    }
    const rounded = Math.round(value);
    if (Math.abs(value - rounded) < 0.0001) {
      return String(rounded);
    }

    let bestNum = 0;
    let bestDen = 1;
    let bestErr = Infinity;

    for (let den = 1; den <= maxDen; den += 1) {
      const num = Math.round(value * den);
      const err = Math.abs(value - num / den);
      if (err < bestErr) {
        bestErr = err;
        bestNum = num;
        bestDen = den;
      }
    }

    const simplified = simplifyFraction(bestNum, bestDen);
    if (simplified.den === 1) {
      return String(simplified.num);
    }
    return `${simplified.num}/${simplified.den}`;
  }

  function toMixedLabel(value, maxDen = 12) {
    const sign = value < 0 ? -1 : 1;
    const abs = Math.abs(value);
    const whole = Math.floor(abs);
    const frac = abs - whole;
    if (whole === 0 || frac < 0.0001) {
      return toFractionLabel(value, maxDen);
    }

    let bestNum = 0;
    let bestDen = 1;
    let bestErr = Infinity;

    for (let den = 2; den <= maxDen; den += 1) {
      const num = Math.round(frac * den);
      const err = Math.abs(frac - num / den);
      if (num === 0) {
        continue;
      }
      if (err < bestErr) {
        bestErr = err;
        bestNum = num;
        bestDen = den;
      }
    }

    if (bestNum === 0) {
      return String(sign * whole);
    }

    const simplified = simplifyFraction(bestNum, bestDen);
    const prefix = sign < 0 ? "-" : "";
    return `${prefix}${whole} ${Math.abs(simplified.num)}/${simplified.den}`;
  }

  function formatCompactDecimal(value) {
    if (!Number.isFinite(value)) {
      return "?";
    }
    const rounded = Math.round(value * 1000) / 1000;
    const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(3).replace(/\.?0+$/, "");
    return text.replace(".", ",");
  }

  function extractDenominator(label) {
    if (typeof label !== "string") {
      return null;
    }
    const match = label.trim().match(/(\d+)\s*\/\s*(\d+)/);
    if (!match) {
      return null;
    }
    const den = Number(match[2]);
    if (!Number.isFinite(den) || den <= 0) {
      return null;
    }
    return den;
  }

  function getActiveTickStep() {
    if (!state.level) {
      return 0.125;
    }
    if (!state.level.dynamicTickFromQuestion) {
      return state.level.tickStep;
    }
    const q = currentQuestion();
    const den = q ? extractDenominator(q.label) : null;
    if (den) {
      return 1 / den;
    }
    return state.level.tickStep;
  }

  const LEVEL1_WARMUPS = [
    { value: 1 / 2, label: "1/2", tip: "Orta noktayi bul" },
    { value: 1 / 4, label: "1/4", tip: "Birinci çeyrek" },
    { value: 3 / 4, label: "3/4", tip: "Üçüncü çeyrek" },
    { value: 1 / 8, label: "1/8", tip: "Sekizde bir" },
    { value: 7 / 8, label: "7/8", tip: "Sona yakın" },
    { value: 3 / 8, label: "3/8", tip: "Üç sekizde" },
  ];

  function makeLevel1Question() {
    const den = pick([2, 4, 8]);
    const num = randInt(1, den - 1);
    return {
      value: num / den,
      label: `${num}/${den}`,
      tip: "Temel kesir avcısı",
    };
  }

  function makeLevel2Question() {
    const den = pick([2, 3, 4, 5, 6]);
    const num = randInt(1, den - 1);
    const mul = pick([2, 3, 4]);
    return {
      value: num / den,
      label: `${num * mul}/${den * mul}`,
      tip: `${num}/${den} ile eşdeğer`,
    };
  }

  function makeLevel2MixedQuestion() {
    const den = pick([2, 3, 4, 5, 6, 8]);
    const whole = randInt(1, 2);
    let num = randInt(1, den - 1);
    let guard = 0;
    // Denk kesir görünümünü engellemek için pay/payda aralarında asal seç.
    while (gcd(num, den) !== 1 && guard < 24) {
      num = randInt(1, den - 1);
      guard += 1;
    }
    return {
      value: whole + num / den,
      label: `${whole} ${num}/${den}`,
      tip: "Tam sayılı kesri doğru bölmeye yerleştir",
    };
  }

  function makeLevel2SlowSprintQuestion() {
    if (Math.random() < 0.52) {
      const warmup = pick(LEVEL1_WARMUPS);
      return {
        value: warmup.value,
        label: warmup.label,
        tip: warmup.tip,
      };
    }
    const mixed = makeLevel2MixedQuestion();
    return {
      value: mixed.value,
      label: mixed.label,
      tip: "Temel + tam sayılı kesir sprinti",
    };
  }

  function makeLevel3Question(range) {
    const den = pick([2, 3, 4, 5, 6]);
    const minNum = Math.ceil(range[0] * den);
    const maxNum = Math.floor(range[1] * den);
    let num = randInt(minNum, maxNum);
    if (num === 0) {
      num = Math.random() < 0.5 ? -1 : 1;
    }
    const simplified = simplifyFraction(num, den);
    return {
      value: simplified.num / simplified.den,
      label: `${simplified.num}/${simplified.den}`,
      tip: "Negatif bölge dikkat ister",
    };
  }

  function makeLevel4Question() {
    const den = pick([2, 3, 4, 5, 6, 8]);
    const whole = randInt(1, 2);
    const num = randInt(1, den - 1);
    const improperNum = whole * den + num;
    const asMixed = Math.random() < 0.55;
    return {
      value: improperNum / den,
      label: asMixed ? `${whole} ${num}/${den}` : `${improperNum}/${den}`,
      tip: asMixed ? "Tam + kesir" : "Bileşik kesir",
    };
  }

  function makeLevel5Question(range) {
    const den = pick([3, 4, 5, 6, 7, 8, 9]);
    const minNum = Math.ceil(range[0] * den);
    const maxNum = Math.floor(range[1] * den);
    const num = randInt(minNum + 1, Math.max(minNum + 1, maxNum - 1));
    const simplified = simplifyFraction(num, den);
    return {
      value: simplified.num / simplified.den,
      label: toFractionLabel(simplified.num / simplified.den, 12),
      tip: "Kayan hat modu",
    };
  }

  function makeLevel6Question(range) {
    const den = pick([3, 4, 5, 6, 7, 8, 9, 10]);
    const minNum = Math.ceil(range[0] * den);
    const maxNum = Math.floor(range[1] * den);
    const num = randInt(minNum, maxNum);
    const simplified = simplifyFraction(num, den);
    const value = simplified.num / simplified.den;
    const fancy = Math.random() < 0.45 ? toMixedLabel(value, 12) : toFractionLabel(value, 12);
    return {
      value,
      label: fancy,
      tip: "Kamera boss savaşı",
    };
  }

  const LEVELS = [
    {
      id: "L1",
      name: "Kesir Isınması",
      menuDesc: "0-1 arası temel kesirler",
      range: [0, 1],
      tickStep: 0.125,
      questions: 6,
      tolerance: 0.07,
      timeLimit: 0,
      moving: false,
      cameraFocus: false,
      dynamicTickFromQuestion: true,
      generator: makeLevel1Question,
    },
    {
      id: "L1B",
      name: "Tam Sayılı Geçiş",
      menuDesc: "Tam sayılı kesirde payda adımı",
      range: [0, 3],
      tickStep: 0.25,
      questions: 6,
      tolerance: 0.055,
      timeLimit: 0,
      moving: false,
      cameraFocus: false,
      dynamicTickFromQuestion: true,
      generator: makeLevel2MixedQuestion,
    },
    {
      id: "L2S",
      name: "Kayan Hat Sprint",
      menuDesc: "1-2 seviye zorluğu, yavaş kayan hat",
      range: [0, 3],
      tickStep: 0.125,
      questions: 8,
      tolerance: 0.06,
      timeLimit: 13,
      moving: true,
      moveSpeed: 0.42,
      moveAmplitude: 0.1,
      cameraFocus: false,
      dynamicTickFromQuestion: true,
      generator: makeLevel2SlowSprintQuestion,
    },
    {
      id: "L2",
      name: "Eşdeğer Portalı",
      menuDesc: "Eşdeğer kesir avı",
      range: [0, 1],
      tickStep: 0.125,
      questions: 6,
      tolerance: 0.04,
      timeLimit: 0,
      moving: false,
      cameraFocus: false,
      generator: makeLevel2Question,
    },
    {
      id: "L3",
      name: "Negatif Kanyon",
      menuDesc: "Negatif bölgede konum bul",
      range: [-2, 2],
      tickStep: 0.25,
      questions: 6,
      tolerance: 0.035,
      timeLimit: 0,
      moving: false,
      cameraFocus: false,
      generator: makeLevel3Question,
    },
    {
      id: "L4",
      name: "Bileşik Laboratuvar",
      menuDesc: "Bileşik ve tam sayılı kesirler",
      range: [0, 3],
      tickStep: 0.25,
      questions: 6,
      tolerance: 0.034,
      timeLimit: 0,
      moving: false,
      cameraFocus: false,
      generator: makeLevel4Question,
    },
    {
      id: "L5",
      name: "Kayan Hat Turbo",
      menuDesc: "İleri seviye hızlı kayan hat",
      range: [0, 3],
      tickStep: 0.25,
      questions: 7,
      tolerance: 0.038,
      timeLimit: 11,
      moving: true,
      cameraFocus: false,
      generator: makeLevel5Question,
    },
    {
      id: "L6",
      name: "Kamera Boss",
      menuDesc: "Parmak modu final seviyesi",
      range: [-1, 2],
      tickStep: 0.25,
      questions: 7,
      tolerance: 0.04,
      timeLimit: 10,
      moving: true,
      cameraFocus: true,
      generator: makeLevel6Question,
    },
  ];

  const cameraVideo = document.createElement("video");
  cameraVideo.autoplay = true;
  cameraVideo.muted = true;
  cameraVideo.playsInline = true;

  const cameraSampleCanvas = document.createElement("canvas");
  cameraSampleCanvas.width = CAM_W;
  cameraSampleCanvas.height = CAM_H;
  const cameraSampleCtx = cameraSampleCanvas.getContext("2d", { willReadFrequently: true });

  const state = {
    mode: "menu",
    hasPlayed: false,
    levelIndex: 0,
    level: null,
    questions: [],
    questionIndex: 0,
    markerValue: 0,
    score: 0,
    levelScore: 0,
    combo: 0,
    lives: 4,
    elapsedInLevel: 0,
    timeLeft: 0,
    lineShift: 0,
    feedback: "Kampanyayı başlat ve gezegenlere kesir yolu çiz.",
    feedbackType: "info",
    feedbackT: 0,
    particles: [],
    inputMode: "pointer",
    pointer: {
      down: false,
      x: 0,
      y: 0,
    },
    menuLevelRects: [],
    menuHoverIndex: -1,
    confirmRect: {
      x: 0,
      y: 0,
      w: 0,
      h: 0,
    },
    camera: {
      active: false,
      stream: null,
      baselineReady: false,
      prevFrame: new Uint8Array(CAM_W * CAM_H),
      currFrame: new Uint8Array(CAM_W * CAM_H),
      pointerX: 0.5,
      pointerY: 0.5,
      lastStableX: 0.5,
      dwell: 0,
      submitCooldown: 0,
      sampleAccumulator: 0,
      lastMotion: 0,
      trackingConfidence: 0,
      tracker: "basic",
      ml: {
        loading: false,
        loaded: false,
        loadPromise: null,
        hands: null,
        busy: false,
        lastSeen: 0,
        lastInference: 0,
        errorText: "",
      },
      errorText: "",
    },
    hudShakeT: 0,
    lifeDropT: 0,
    lifeDropText: "",
    flashT: 0,
    flashDuration: 0,
    flashColor: "34, 73, 90",
    questionCueT: 0,
    questionCueDuration: 0,
    questionCueLabel: "",
    lastTick: performance.now(),
    tickPulse: 0,
  };

  function pointInRect(point, rect) {
    return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
  }

  function getMenuLevelIndexAtPoint(point) {
    for (const entry of state.menuLevelRects) {
      if (pointInRect(point, entry)) {
        return entry.index;
      }
    }
    return -1;
  }

  function getLineGeometry() {
    return {
      x: canvas.width * 0.1,
      y: canvas.height * 0.64,
      width: canvas.width * 0.8,
    };
  }

  function getVisualRange() {
    if (!state.level) {
      return { min: 0, max: 1 };
    }
    const [min, max] = state.level.range;
    if (!state.level.moving) {
      return { min, max };
    }
    return {
      min: min + state.lineShift,
      max: max + state.lineShift,
    };
  }

  function valueToX(value) {
    const line = getLineGeometry();
    const range = getVisualRange();
    const ratio = (value - range.min) / (range.max - range.min);
    return line.x + ratio * line.width;
  }

  function xToValue(x) {
    const line = getLineGeometry();
    const range = getVisualRange();
    const ratio = clamp((x - line.x) / line.width, 0, 1);
    return range.min + ratio * (range.max - range.min);
  }

  function currentQuestion() {
    return state.questions[state.questionIndex] || null;
  }

  function buildQuestions(level) {
    if (level.id === "L1") {
      return shuffle(LEVEL1_WARMUPS).slice(0, level.questions).map((q) => ({ ...q }));
    }

    const picked = [];
    const seen = new Set();
    let guard = 0;

    while (picked.length < level.questions && guard < 240) {
      guard += 1;
      const question = level.generator(level.range);
      const key = Math.round(question.value * 10000) / 10000;
      if (key < level.range[0] || key > level.range[1]) {
        continue;
      }
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      picked.push(question);
    }

    while (picked.length < level.questions) {
      const span = level.range[1] - level.range[0];
      const value = level.range[0] + Math.random() * span;
      picked.push({
        value,
        label: toFractionLabel(value, 10),
        tip: "Serbest atış",
      });
    }

    return picked;
  }

  function updateHintText() {
    if (state.mode === "playing" && state.level) {
      const q = currentQuestion();
      const timerText = state.level.timeLimit > 0 ? ` | Süre: ${state.timeLeft.toFixed(1)} sn` : "";
      const modeText = state.inputMode === "camera" ? "kamera" : "fare/dokunmatik";
      ui.hint.textContent = `Seviye ${state.levelIndex + 1}/${LEVELS.length} (${state.level.name}) | Hedef: ${q ? q.label : "-"} | Can: ${state.lives} | Skor: ${state.score} | Mod: ${modeText}${timerText}`;
      return;
    }

    if (state.mode === "level_clear") {
      ui.hint.textContent = `${state.level ? state.level.name : "Seviye"} tamamlandı. Sonraki bölüme geç.`;
      return;
    }

    if (state.mode === "game_complete") {
      ui.hint.textContent = `Harika. Kampanya bitti. Toplam skor: ${state.score}. Tekrar başlatabilirsin.`;
      return;
    }

    ui.hint.textContent = `Klavye: 1-${LEVELS.length} seviye seç, 0 menü, Sol/Sağ konum, Space/Enter kilitle, C kamera, F tam ekran.`;
  }

  function updateCameraButtonText() {
    if (!state.camera.active) {
      ui.cameraBtn.textContent = "Kamera: Kapalı";
      return;
    }
    ui.cameraBtn.textContent = state.inputMode === "camera" ? "Kamera: Aktif" : "Kamera: Hazır";
  }

  function updateUI() {
    ui.startBtn.hidden = state.mode !== "menu";
    ui.confirmBtn.hidden = state.mode !== "playing";
    ui.nextBtn.hidden = !(state.mode === "level_clear" || state.mode === "game_complete");
    ui.resetBtn.hidden = state.mode === "menu";

    ui.startBtn.textContent = state.hasPlayed ? "Yeniden Başlat" : "Kampanyayı Başlat";
    ui.nextBtn.textContent = state.mode === "game_complete" ? "Baştan Oyna" : "Sonraki Seviye";

    if (state.mode !== "menu") {
      state.menuHoverIndex = -1;
      canvas.style.cursor = "default";
    }

    updateCameraButtonText();
    updateHintText();
  }

  function setFeedback(text, type = "info", duration = 2) {
    state.feedback = text;
    state.feedbackType = type;
    state.feedbackT = duration;
  }

  function triggerFlash(color, duration) {
    state.flashColor = color;
    state.flashDuration = duration;
    state.flashT = duration;
  }

  function triggerQuestionCue(label, duration = 1.05) {
    if (!label) {
      return;
    }
    state.questionCueLabel = label;
    state.questionCueDuration = duration;
    state.questionCueT = duration;
  }

  function triggerDamageFeedback(previousLives, nextLives) {
    const lost = Math.max(0, previousLives - nextLives);
    if (lost <= 0) {
      return;
    }
    state.hudShakeT = 0.42;
    state.lifeDropT = 1.2;
    state.lifeDropText = `CAN -${lost}`;
    triggerFlash("220, 38, 38", 0.28);
  }

  function spawnParticles(x, y, color, count = 18) {
    for (let i = 0; i < count; i += 1) {
      const speed = 90 + Math.random() * 180;
      const angle = Math.random() * Math.PI * 2;
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.6 + Math.random() * 0.9,
        ttl: 0.6 + Math.random() * 0.9,
        color,
        size: 2 + Math.random() * 4,
      });
    }

    if (state.particles.length > 260) {
      state.particles.splice(0, state.particles.length - 260);
    }
  }

  function setMarkerFromCanvasX(x) {
    if (!state.level) {
      return;
    }
    const value = xToValue(x);
    state.markerValue = normalizeMarkerValue(value);
  }

  function normalizeMarkerValue(value) {
    if (!state.level) {
      return value;
    }
    let nextValue = clamp(value, state.level.range[0], state.level.range[1]);
    if (state.level.dynamicTickFromQuestion) {
      const step = getActiveTickStep();
      nextValue = Math.round(nextValue / step) * step;
      nextValue = clamp(nextValue, state.level.range[0], state.level.range[1]);
    }
    return nextValue;
  }

  function beginLevel(index) {
    state.levelIndex = index;
    state.level = LEVELS[index];
    state.questions = buildQuestions(state.level);
    state.questionIndex = 0;
    state.levelScore = 0;
    state.elapsedInLevel = 0;
    state.timeLeft = state.level.timeLimit;
    state.lineShift = 0;
    state.mode = "playing";
    setFeedback(`Seviye ${index + 1} başladı: ${state.level.name}`, "info", 2.2);

    const center = (state.level.range[0] + state.level.range[1]) * 0.5;
    state.markerValue = normalizeMarkerValue(center);

    if (state.level.cameraFocus && state.inputMode !== "camera") {
      setFeedback(`Seviye ${index + 1} başladı: ${state.level.name} | Kamera modu tavsiye edilir (C)`, "info", 2.2);
    }
    const nextQuestion = currentQuestion();
    if (nextQuestion) {
      triggerQuestionCue(nextQuestion.label, 1.2);
    }

    updateUI();
  }

  function startCampaign() {
    startCampaignFromLevel(0);
  }

  function startCampaignFromLevel(levelIndex) {
    const safeLevelIndex = clamp(Math.floor(levelIndex), 0, LEVELS.length - 1);
    state.hasPlayed = true;
    state.score = 0;
    state.combo = 0;
    state.lives = MAX_LIVES;
    beginLevel(safeLevelIndex);
  }

  function getLevelShortcutIndex(key) {
    if (!/^[1-9]$/.test(key)) {
      return -1;
    }
    const index = Number(key) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= LEVELS.length) {
      return -1;
    }
    return index;
  }

  function returnToMenu() {
    state.mode = "menu";
    state.level = null;
    state.questions = [];
    state.questionIndex = 0;
    state.markerValue = 0;
    state.elapsedInLevel = 0;
    state.lineShift = 0;
    state.timeLeft = 0;
    state.combo = 0;
    setFeedback("Menüye dönüldü.", "info", 1.2);
    updateUI();
  }

  function handleQuestionAdvance() {
    state.questionIndex += 1;
    if (state.questionIndex >= state.questions.length) {
      if (state.levelIndex >= LEVELS.length - 1) {
        state.mode = "game_complete";
        setFeedback("Bütün kesir sistemleri dengelendi.", "success", 3);
      } else {
        state.mode = "level_clear";
        setFeedback(`${state.level.name} temizlendi.`, "success", 2.6);
      }
      updateUI();
      return;
    }

    state.timeLeft = state.level.timeLimit;
    const nextQuestion = currentQuestion();
    if (nextQuestion) {
      triggerQuestionCue(nextQuestion.label, 1.05);
    }
  }

  function submitGuess(source = "manual") {
    if (state.mode !== "playing" || !state.level) {
      return;
    }

    const question = currentQuestion();
    if (!question) {
      return;
    }

    const span = state.level.range[1] - state.level.range[0];
    const tolerance = span * state.level.tolerance;
    const error = Math.abs(state.markerValue - question.value);
    const correct = error <= tolerance;

    if (correct) {
      const timeBonus = state.level.timeLimit > 0 ? Math.round(Math.max(0, state.timeLeft) * 12) : 20;
      const precisionBonus = Math.round((1 - Math.min(1, error / tolerance)) * 100);
      const comboBonus = Math.min(120, state.combo * 8);
      const gain = 140 + timeBonus + precisionBonus + comboBonus;
      state.score += gain;
      state.levelScore += 1;
      state.combo += 1;
      setFeedback(`DOĞRU! ${question.label} bulundu. +${gain} puan`, "success", 2.4);
      triggerFlash("22, 163, 74", 0.18);
      spawnParticles(valueToX(question.value), getLineGeometry().y - 6, "#2fbf71", 22);

      handleQuestionAdvance();
      updateHintText();
    } else {
      const previousLives = state.lives;
      state.lives -= 1;
      state.combo = 0;
      setFeedback(`YANLIŞ! Hedef ${question.label}. Can -1 (${previousLives} -> ${state.lives})`, "error", 3);
      triggerDamageFeedback(previousLives, state.lives);
      spawnParticles(valueToX(state.markerValue), getLineGeometry().y - 6, "#e65100", 16);

      if (state.lives <= 0) {
        setFeedback("Canlar bitti. Kampanyayı yeniden başlat.", "error", 2.8);
        state.mode = "menu";
        updateUI();
        return;
      }
    }
  }

  function timeoutPenalty() {
    if (state.mode !== "playing" || !state.level) {
      return;
    }

    const previousLives = state.lives;
    state.lives -= 1;
    state.combo = 0;
    setFeedback(`SÜRE DOLDU! Can -1 (${previousLives} -> ${state.lives})`, "warning", 2.4);
    triggerDamageFeedback(previousLives, state.lives);

    if (state.lives <= 0) {
      setFeedback("Süreyi yetiştiremedin. Yeniden dene.", "error", 2.8);
      state.mode = "menu";
      updateUI();
      return;
    }

    handleQuestionAdvance();
    updateHintText();
  }

  function ensureCanvasSize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(760, Math.floor(rect.width));
    const h = Math.max(420, Math.floor(rect.height));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  async function ensureCameraActive() {
    if (state.camera.active) {
      return true;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      state.camera.errorText = "Tarayıcı kamera API'si yok.";
      setFeedback(state.camera.errorText, "warning", 2.2);
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      state.camera.stream = stream;
      cameraVideo.srcObject = stream;
      await cameraVideo.play();
      state.camera.active = true;
      state.camera.baselineReady = false;
      state.camera.pointerX = 0.5;
      state.camera.pointerY = 0.5;
      state.camera.lastStableX = 0.5;
      state.camera.dwell = 0;
      state.camera.submitCooldown = 0;
      state.camera.sampleAccumulator = 0;
      state.camera.lastMotion = 0;
      state.camera.trackingConfidence = 0;
      state.camera.tracker = "basic";
      state.camera.ml.lastSeen = 0;
      state.camera.ml.lastInference = 0;
      state.camera.errorText = "";
      void ensureMlTracker();
      updateCameraButtonText();
      return true;
    } catch (error) {
      state.camera.errorText = "Kamera açılamadı. İzin verip tekrar dene.";
      setFeedback(state.camera.errorText, "warning", 2.6);
      return false;
    }
  }

  function stopCamera() {
    if (!state.camera.stream) {
      state.camera.active = false;
      return;
    }

    state.camera.stream.getTracks().forEach((track) => track.stop());
    state.camera.stream = null;
    state.camera.active = false;
    state.camera.baselineReady = false;
    state.camera.lastMotion = 0;
    state.camera.trackingConfidence = 0;
    state.camera.tracker = "basic";
    updateCameraButtonText();
  }

  async function toggleCameraMode() {
    if (state.inputMode === "camera") {
      state.inputMode = "pointer";
      setFeedback("Kamera imleci pasif.", "info", 1.2);
      updateUI();
      return;
    }

    const ok = await ensureCameraActive();
    if (!ok) {
      updateUI();
      return;
    }

    state.inputMode = "camera";
    setFeedback("Kamera imleci aktif. Parmağını hareket ettir, sabit tutunca kilitler.", "info", 2.4);
    updateUI();
  }

  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      for (const script of document.scripts) {
        if (script.src === src) {
          if (script.dataset.loaded === "1") {
            resolve();
            return;
          }
          script.addEventListener("load", () => resolve(), { once: true });
          script.addEventListener("error", () => reject(new Error(`Script yüklenemedi: ${src}`)), { once: true });
          return;
        }
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.addEventListener(
        "load",
        () => {
          script.dataset.loaded = "1";
          resolve();
        },
        { once: true }
      );
      script.addEventListener("error", () => reject(new Error(`Script yüklenemedi: ${src}`)), { once: true });
      document.head.appendChild(script);
    });
  }

  async function ensureMlTracker() {
    const ml = state.camera.ml;
    if (ml.loaded && ml.hands) {
      return true;
    }
    if (ml.loading && ml.loadPromise) {
      return ml.loadPromise;
    }

    ml.loading = true;
    ml.loadPromise = (async () => {
      try {
        await loadScriptOnce("https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js");
        if (!window.Hands) {
          throw new Error("MediaPipe Hands API bulunamadı.");
        }

        const hands = new window.Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });
        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.62,
          minTrackingConfidence: 0.55,
        });
        hands.onResults((results) => {
          const handsFound = results && Array.isArray(results.multiHandLandmarks) ? results.multiHandLandmarks : [];
          if (!handsFound.length) {
            const unseenFor = performance.now() - ml.lastSeen;
            if (unseenFor > 180) {
              state.camera.trackingConfidence = Math.max(0, state.camera.trackingConfidence - 0.08);
              state.camera.lastMotion = Math.max(0, state.camera.lastMotion * 0.86);
            }
            return;
          }

          const landmarks = handsFound[0];
          const tip = landmarks[8];
          const pip = landmarks[6];
          const tipX = clamp(tip.x, 0, 1);
          const tipY = clamp(tip.y, 0, 1);
          const depthWeight = clamp(0.3 + Math.abs((pip ? pip.y : tipY) - tipY) * 2.4, 0.3, 1);

          state.camera.pointerX = lerp(state.camera.pointerX, tipX, 0.46);
          state.camera.pointerY = lerp(state.camera.pointerY, tipY, 0.42);
          state.camera.trackingConfidence = clamp(0.74 + depthWeight * 0.22, 0, 1);
          state.camera.lastMotion = 30000 * state.camera.trackingConfidence;
          ml.lastSeen = performance.now();
        });

        ml.hands = hands;
        ml.loaded = true;
        ml.errorText = "";
        state.camera.tracker = "ai";
        setFeedback("Kamera AI takibi aktif.", "success", 1.8);
        return true;
      } catch (error) {
        ml.errorText = error instanceof Error ? error.message : String(error);
        ml.loaded = false;
        ml.hands = null;
        state.camera.tracker = "basic";
        return false;
      } finally {
        ml.loading = false;
      }
    })();

    return ml.loadPromise;
  }

  function applyCameraPointerControl(sampleStepSeconds) {
    if (state.mode === "playing" && state.level && state.inputMode === "camera") {
      const line = getLineGeometry();
      const mirroredX = 1 - state.camera.pointerX;
      const canvasX = line.x + mirroredX * line.width;
      setMarkerFromCanvasX(canvasX);

      const deltaX = Math.abs(state.camera.pointerX - state.camera.lastStableX);
      const stableThreshold = state.camera.trackingConfidence > 0.7 ? 0.008 : 0.006;
      if (deltaX < stableThreshold) {
        state.camera.dwell += sampleStepSeconds;
      } else {
        state.camera.dwell = Math.max(0, state.camera.dwell - sampleStepSeconds);
        state.camera.lastStableX = state.camera.pointerX;
      }

      state.camera.submitCooldown = Math.max(0, state.camera.submitCooldown - sampleStepSeconds);
      if (state.camera.dwell > 0.95 && state.camera.submitCooldown <= 0 && state.camera.trackingConfidence > 0.35) {
        submitGuess("camera-dwell");
        state.camera.dwell = 0;
        state.camera.submitCooldown = 1.3;
      }
    } else {
      state.camera.dwell = Math.max(0, state.camera.dwell - sampleStepSeconds);
      state.camera.submitCooldown = Math.max(0, state.camera.submitCooldown - sampleStepSeconds);
    }
  }

  function isSkinPixel(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const rgbRule = r > 95 && g > 40 && b > 20 && max - min > 15 && Math.abs(r - g) > 15 && r > g && r > b;
    if (!rgbRule) {
      return false;
    }

    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    const ycbcrRule = cr >= 135 && cr <= 180 && cb >= 85 && cb <= 135;
    return ycbcrRule;
  }

  function processBasicCamera(sampleStepSeconds) {
    state.camera.tracker = "basic";

    cameraSampleCtx.drawImage(cameraVideo, 0, 0, CAM_W, CAM_H);
    const pixels = cameraSampleCtx.getImageData(0, 0, CAM_W, CAM_H).data;

    if (!state.camera.baselineReady) {
      for (let i = 0; i < CAM_W * CAM_H; i += 1) {
        const p = i * 4;
        state.camera.prevFrame[i] = Math.round(pixels[p] * 0.299 + pixels[p + 1] * 0.587 + pixels[p + 2] * 0.114);
      }
      state.camera.baselineReady = true;
      return;
    }

    let motion = 0;
    let motionX = 0;
    let motionY = 0;
    let skinCount = 0;
    let movingSkinCount = 0;
    let topY = CAM_H + 1;
    let topXSum = 0;
    let topCount = 0;

    for (let i = 0; i < CAM_W * CAM_H; i += 1) {
      const p = i * 4;
      const r = pixels[p];
      const g = pixels[p + 1];
      const b = pixels[p + 2];
      const gray = Math.round(pixels[p] * 0.299 + pixels[p + 1] * 0.587 + pixels[p + 2] * 0.114);
      state.camera.currFrame[i] = gray;
      const diff = Math.abs(gray - state.camera.prevFrame[i]);
      const x = i % CAM_W;
      const y = Math.floor(i / CAM_W);
      if (y < CAM_H * 0.1 || y > CAM_H * 0.94) {
        continue;
      }

      const skin = isSkinPixel(r, g, b);
      if (skin) {
        skinCount += 1;
      }

      if (skin && diff > 10) {
        movingSkinCount += 1;
        motion += diff;
        motionX += x * diff;
        motionY += y * diff;

        if (y < topY - 1) {
          topY = y;
          topXSum = x;
          topCount = 1;
        } else if (Math.abs(y - topY) <= 4) {
          topXSum += x;
          topCount += 1;
        }
      } else if (diff > 24) {
        const weightedDiff = diff * 0.35;
        motion += weightedDiff;
        motionX += x * weightedDiff;
        motionY += y * weightedDiff;
      }
    }

    const temp = state.camera.prevFrame;
    state.camera.prevFrame = state.camera.currFrame;
    state.camera.currFrame = temp;

    const hasSkinTop = topCount >= 4 && movingSkinCount > 24 && skinCount > 80;
    const hasMotion = motion > 900;
    let nextX = 0;
    let nextY = 0;
    let tracked = false;
    let confidence = 0;

    if (hasSkinTop) {
      nextX = topXSum / topCount / CAM_W;
      nextY = topY / CAM_H;
      tracked = true;
      confidence += 0.55;
    }

    if (hasMotion) {
      const mx = motionX / motion / CAM_W;
      const my = motionY / motion / CAM_H;
      if (!tracked) {
        nextX = mx;
        nextY = my;
        tracked = true;
      } else {
        nextX = lerp(nextX, mx, 0.28);
        nextY = lerp(nextY, my, 0.28);
      }
      confidence += 0.45;
    }

    if (tracked) {
      const smoothX = hasSkinTop ? 0.38 : 0.3;
      const smoothY = hasSkinTop ? 0.34 : 0.3;
      state.camera.pointerX = lerp(state.camera.pointerX, clamp(nextX, 0, 1), smoothX);
      state.camera.pointerY = lerp(state.camera.pointerY, clamp(nextY, 0, 1), smoothY);
      state.camera.lastMotion = motion;
      state.camera.trackingConfidence = clamp(confidence, 0, 1);
    } else {
      state.camera.lastMotion = Math.max(0, state.camera.lastMotion * 0.85);
      state.camera.trackingConfidence = Math.max(0, state.camera.trackingConfidence * 0.85);
    }

    applyCameraPointerControl(sampleStepSeconds);
  }

  function processCamera(dt) {
    if (!state.camera.active || !cameraSampleCtx || cameraVideo.readyState < 2) {
      return;
    }

    state.camera.sampleAccumulator += dt;
    if (state.camera.sampleAccumulator < 0.05) {
      return;
    }
    const sampleStepSeconds = state.camera.sampleAccumulator;
    state.camera.sampleAccumulator = 0;

    const ml = state.camera.ml;
    if (ml.loaded && ml.hands) {
      if (!ml.busy && performance.now() - ml.lastInference >= 34) {
        ml.busy = true;
        ml.lastInference = performance.now();
        ml.hands
          .send({ image: cameraVideo })
          .catch(() => {
            state.camera.tracker = "basic";
            ml.hands = null;
            ml.loaded = false;
            ml.errorText = "AI takip geçici olarak devre dışı. Basic takip kullanılıyor.";
          })
          .finally(() => {
            ml.busy = false;
          });
      }
      const aiSeenRecently = performance.now() - ml.lastSeen <= 260;
      if (aiSeenRecently && state.camera.trackingConfidence > 0.2) {
        state.camera.tracker = "ai";
        applyCameraPointerControl(sampleStepSeconds);
        return;
      }

      if (state.camera.trackingConfidence < 0.2) {
        state.camera.lastStableX = state.camera.pointerX;
        state.camera.dwell = 0;
        state.camera.submitCooldown = Math.max(state.camera.submitCooldown, 0.5);
      }
    }

    processBasicCamera(sampleStepSeconds);
  }

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.45, THEME.cream);
    grad.addColorStop(1, THEME.lightBeige);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 12; i += 1) {
      const phase = state.tickPulse * 0.35 + i * 0.7;
      const x = canvas.width * (0.08 + (i / 12) * 0.84);
      const y = canvas.height * (0.2 + 0.1 * Math.sin(phase));
      const r = 18 + 12 * Math.sin(phase * 1.1 + i);
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = i % 2 === 0 ? "rgba(216, 199, 189, 0.46)" : "rgba(34, 73, 90, 0.16)";
      ctx.beginPath();
      ctx.arc(x, y, Math.abs(r), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawNumberLine() {
    if (!state.level) {
      return;
    }

    const line = getLineGeometry();
    const range = getVisualRange();
    const span = range.max - range.min;

    ctx.strokeStyle = THEME.teal;
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(line.x, line.y);
    ctx.lineTo(line.x + line.width, line.y);
    ctx.stroke();

    const step = getActiveTickStep();
    const from = Math.floor(range.min / step) - 1;
    const to = Math.ceil(range.max / step) + 1;
    const precisionTol = Math.max(0.0001, step * 0.22);

    for (let i = from; i <= to; i += 1) {
      const value = i * step;
      if (value < range.min - 0.00001 || value > range.max + 0.00001) {
        continue;
      }
      const ratio = (value - range.min) / span;
      const x = line.x + ratio * line.width;

      const major = Math.abs(value - Math.round(value)) <= precisionTol;
      const halfStep = !major && Math.abs(value * 2 - Math.round(value * 2)) <= precisionTol * 2;
      const tickH = major ? 30 : halfStep ? 22 : 17;
      const tickWidth = major ? 3.5 : halfStep ? 2.8 : 2.2;
      const tickColor = major ? "#123746" : halfStep ? "rgba(26, 54, 66, 0.9)" : "rgba(34, 73, 90, 0.78)";

      ctx.strokeStyle = "rgba(255, 255, 255, 0.82)";
      ctx.lineWidth = tickWidth + 1.2;
      ctx.beginPath();
      ctx.moveTo(x, line.y - tickH / 2);
      ctx.lineTo(x, line.y + tickH / 2);
      ctx.stroke();

      ctx.strokeStyle = tickColor;
      ctx.lineWidth = tickWidth;
      ctx.beginPath();
      ctx.moveTo(x, line.y - tickH / 2);
      ctx.lineTo(x, line.y + tickH / 2);
      ctx.stroke();
    }

    const highlightIntegerAnchors = state.levelIndex <= 3;
    if (highlightIntegerAnchors) {
      const intStart = Math.ceil(range.min - 0.0001);
      const intEnd = Math.floor(range.max + 0.0001);
      for (let intValue = intStart; intValue <= intEnd; intValue += 1) {
        const x = valueToX(intValue);
        const isZero = intValue === 0;
        const barTop = isZero ? 42 : 34;
        const barBottom = isZero ? 42 : 28;

        ctx.strokeStyle = isZero ? "#b45309" : "rgba(26, 54, 66, 0.94)";
        ctx.lineWidth = isZero ? 4 : 3.1;
        ctx.beginPath();
        ctx.moveTo(x, line.y - barTop);
        ctx.lineTo(x, line.y + barBottom);
        ctx.stroke();

        ctx.fillStyle = isZero ? "rgba(255, 247, 237, 0.98)" : "rgba(241, 248, 251, 0.97)";
        ctx.strokeStyle = isZero ? "rgba(180, 83, 9, 0.95)" : "rgba(24, 66, 85, 0.94)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, line.y, isZero ? 8.5 : 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        const label = String(intValue);
        ctx.font = `${isZero ? 700 : 600} ${isZero ? 18 : 16}px 'Noto Sans', 'Outfit', sans-serif`;
        const labelW = Math.max(28, Math.ceil(ctx.measureText(label).width) + 16);
        const labelH = isZero ? 28 : 24;
        const labelX = clamp(x - labelW * 0.5, line.x - 3, line.x + line.width - labelW + 3);
        const labelY = line.y - 82;

        ctx.fillStyle = isZero ? "rgba(255, 247, 237, 0.96)" : "rgba(241, 248, 251, 0.96)";
        ctx.strokeStyle = isZero ? "rgba(180, 83, 9, 0.95)" : "rgba(24, 66, 85, 0.9)";
        ctx.lineWidth = isZero ? 2 : 1.8;
        ctx.beginPath();
        ctx.roundRect(labelX, labelY, labelW, labelH, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isZero ? "#9a3412" : "#184255";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, labelX + labelW * 0.5, labelY + labelH * 0.52);
      }
      ctx.textBaseline = "alphabetic";
    } else if (range.min <= 0 && range.max >= 0) {
      const zeroX = valueToX(0);
      ctx.strokeStyle = "#b45309";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(zeroX, line.y - 42);
      ctx.lineTo(zeroX, line.y + 42);
      ctx.stroke();

      ctx.fillStyle = "rgba(255, 247, 237, 0.96)";
      ctx.strokeStyle = "rgba(180, 83, 9, 0.95)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(zeroX, line.y, 8.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const labelW = 36;
      const labelH = 28;
      const labelX = clamp(zeroX - labelW * 0.5, line.x - 3, line.x + line.width - labelW + 3);
      const labelY = line.y - 82;
      ctx.fillStyle = "rgba(255, 247, 237, 0.95)";
      ctx.strokeStyle = "rgba(180, 83, 9, 0.95)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(labelX, labelY, labelW, labelH, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#9a3412";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "700 18px 'Noto Sans', 'Outfit', sans-serif";
      ctx.fillText("0", labelX + labelW * 0.5, labelY + labelH * 0.52);
      ctx.textBaseline = "alphabetic";
    }

    const markerX = valueToX(state.markerValue);
    ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
    ctx.beginPath();
    ctx.arc(markerX, line.y, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(34, 73, 90, 0.22)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = THEME.teal;
    ctx.strokeStyle = THEME.darkTeal;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(markerX, line.y - 28);
    ctx.lineTo(markerX - 16, line.y - 60);
    ctx.lineTo(markerX + 16, line.y - 60);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const confirmRect = {
      x: canvas.width * 0.76,
      y: canvas.height * 0.73,
      w: canvas.width * 0.18,
      h: canvas.height * 0.1,
    };
    state.confirmRect = confirmRect;

    const hoveringConfirm = pointInRect(state.pointer, confirmRect);
    const btnGrad = ctx.createLinearGradient(confirmRect.x, confirmRect.y, confirmRect.x, confirmRect.y + confirmRect.h);
    btnGrad.addColorStop(0, hoveringConfirm ? "#2d6074" : THEME.teal);
    btnGrad.addColorStop(1, hoveringConfirm ? "#214a5d" : THEME.darkTeal);
    ctx.fillStyle = btnGrad;
    ctx.strokeStyle = "rgba(26, 54, 66, 0.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(confirmRect.x, confirmRect.y, confirmRect.w, confirmRect.h, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 20px 'Noto Sans', 'Outfit', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ONAYLA", confirmRect.x + confirmRect.w * 0.5, confirmRect.y + confirmRect.h * 0.52);
    ctx.textBaseline = "alphabetic";
  }

  function drawTopCards() {
    const q = currentQuestion();
    const hudShake = state.hudShakeT > 0 ? Math.sin(state.tickPulse * 95) * 8 * (state.hudShakeT / 0.42) : 0;
    const rightX = canvas.width * 0.95 + hudShake;
    const cardX = canvas.width * 0.03;
    const cardY = canvas.height * 0.04;
    const cardW = canvas.width * 0.58;
    const cardH = clamp(canvas.height * 0.18, 96, 148);

    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.strokeStyle = "rgba(34, 73, 90, 0.24)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 16);
    ctx.fill();
    ctx.stroke();

    const cueDuration = Math.max(0.001, state.questionCueDuration || 1);
    const cueRatio = state.questionCueT > 0 ? clamp(state.questionCueT / cueDuration, 0, 1) : 0;
    const cueAge = 1 - cueRatio;
    const idlePulse = 1 + Math.sin(state.tickPulse * 5.3) * 0.008;
    const cuePulse = 1 + Math.sin(cueAge * Math.PI * 6) * 0.028 * cueRatio;
    const pulseScale = idlePulse * cuePulse;
    const targetW = clamp(cardW * 0.36, 210, 330);
    const targetH = clamp(cardH * 0.62, 52, 66);
    const targetX = cardX + cardW - targetW - 16;
    const targetY = cardY + (cardH - targetH) * 0.5;
    const targetCX = targetX + targetW * 0.5;
    const targetCY = targetY + targetH * 0.5;
    const targetLabel = q ? q.label : "-";
    const targetValue = q ? formatCompactDecimal(q.value) : "-";
    const titleText = `Seviye ${state.levelIndex + 1}: ${state.level ? state.level.name : "-"}`;
    const titleX = cardX + 24;
    const titleY = cardY + clamp(cardH * 0.34, 34, 48);
    const titleMaxW = Math.max(180, targetX - titleX - 16);

    ctx.fillStyle = THEME.teal;
    ctx.textAlign = "left";
    let titleSize = clamp(Math.round(cardH * 0.26), 22, 30);
    ctx.font = `700 ${titleSize}px 'Noto Serif', 'Forum', 'Caudex', serif`;
    while (titleSize > 19 && ctx.measureText(titleText).width > titleMaxW) {
      titleSize -= 1;
      ctx.font = `700 ${titleSize}px 'Noto Serif', 'Forum', 'Caudex', serif`;
    }
    ctx.fillText(titleText, titleX, titleY);

    const metaY = cardY + Math.max(58, cardH - 38);
    const hintY = Math.min(cardY + cardH - 12, metaY + 22);
    ctx.fillStyle = "rgba(24, 66, 85, 0.78)";
    ctx.font = "700 15px 'Noto Sans', 'Outfit', sans-serif";
    ctx.fillText(`Soru ${state.questionIndex + 1}/${Math.max(1, state.questions.length)}`, titleX, metaY);
    if (q) {
      const hintText = `İpucu: ${q.tip}`;
      let hintSize = 15;
      ctx.fillStyle = THEME.muted;
      ctx.font = `600 ${hintSize}px 'Noto Sans', 'Outfit', sans-serif`;
      while (hintSize > 12 && ctx.measureText(hintText).width > titleMaxW) {
        hintSize -= 1;
        ctx.font = `600 ${hintSize}px 'Noto Sans', 'Outfit', sans-serif`;
      }
      ctx.fillText(hintText, titleX, hintY);
    }

    if (cueRatio > 0.01) {
      ctx.save();
      ctx.globalAlpha = 0.26 * cueRatio;
      ctx.fillStyle = "rgba(26, 54, 66, 0.38)";
      ctx.beginPath();
      ctx.roundRect(targetX - 8, targetY - 7, targetW + 16, targetH + 14, 16);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(targetCX, targetCY);
    ctx.scale(pulseScale, pulseScale);
    ctx.translate(-targetCX, -targetCY);

    ctx.fillStyle = "rgba(241, 248, 251, 0.97)";
    ctx.strokeStyle = "rgba(24, 66, 85, 0.95)";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(targetX, targetY, targetW, targetH, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(24, 66, 85, 0.78)";
    ctx.textAlign = "left";
    ctx.font = "700 13px 'Noto Sans', 'Outfit', sans-serif";
    ctx.fillText("HEDEF SAYI", targetX + 14, targetY + 17);

    ctx.fillStyle = THEME.darkTeal;
    let targetLabelSize = clamp(Math.round(targetH * 0.7), 30, 42);
    ctx.font = `700 ${targetLabelSize}px 'Noto Sans', 'Outfit', sans-serif`;
    while (targetLabelSize > 24 && ctx.measureText(targetLabel).width > targetW * 0.62) {
      targetLabelSize -= 1;
      ctx.font = `700 ${targetLabelSize}px 'Noto Sans', 'Outfit', sans-serif`;
    }
    ctx.fillText(targetLabel, targetX + 14, targetY + targetH - 12);

    ctx.fillStyle = "rgba(26, 54, 66, 0.86)";
    ctx.textAlign = "right";
    ctx.font = "600 15px 'Noto Sans', 'Outfit', sans-serif";
    ctx.fillText(`≈ ${targetValue}`, targetX + targetW - 14, targetY + 19);
    ctx.restore();

    ctx.textAlign = "right";
    ctx.fillStyle = THEME.text;
    ctx.font = "700 22px 'Noto Sans', 'Outfit', sans-serif";
    ctx.fillText(`Skor ${state.score}`, rightX, canvas.height * 0.1);

    ctx.fillStyle = state.lifeDropT > 0 ? "#b91c1c" : THEME.text;
    ctx.fillText(`Can ${state.lives}/${MAX_LIVES}`, rightX, canvas.height * 0.15);

    const lifeRowY = canvas.height * 0.185;
    const lifeSpacing = 22;
    const lifeStartX = rightX - (MAX_LIVES - 1) * lifeSpacing - 8;
    for (let i = 0; i < MAX_LIVES; i += 1) {
      const x = lifeStartX + i * lifeSpacing;
      const alive = i < state.lives;
      ctx.fillStyle = alive ? "#ef4444" : "#cbd5e1";
      ctx.beginPath();
      ctx.arc(x, lifeRowY, 6, 0, Math.PI * 2);
      ctx.fill();
      if (!alive) {
        ctx.strokeStyle = "#9ca3af";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 4, lifeRowY - 4);
        ctx.lineTo(x + 4, lifeRowY + 4);
        ctx.stroke();
      }
    }

    if (state.lifeDropT > 0 && state.lifeDropText) {
      const badgeAlpha = clamp(state.lifeDropT / 1.2, 0, 1);
      const bx = rightX - 156;
      const by = canvas.height * 0.208;
      const bw = 144;
      const bh = 34;
      ctx.globalAlpha = badgeAlpha;
      ctx.fillStyle = "rgba(220, 38, 38, 0.95)";
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 10);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.font = "700 18px 'Noto Sans', 'Outfit', sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText(state.lifeDropText, bx + bw * 0.5, by + bh * 0.52);
      ctx.textBaseline = "alphabetic";
      ctx.globalAlpha = 1;
    }

    if (state.level && state.level.timeLimit > 0) {
      const timerW = canvas.width * 0.2;
      const timerH = 18;
      const timerX = canvas.width * 0.72;
      const timerY = canvas.height * 0.19;
      const ratio = clamp(state.timeLeft / state.level.timeLimit, 0, 1);

      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.beginPath();
      ctx.roundRect(timerX, timerY, timerW, timerH, 9);
      ctx.fill();

      ctx.fillStyle = ratio > 0.35 ? "#16a34a" : "#dc2626";
      ctx.beginPath();
      ctx.roundRect(timerX, timerY, timerW * ratio, timerH, 9);
      ctx.fill();

      ctx.fillStyle = THEME.darkTeal;
      ctx.font = "600 14px 'Noto Sans', 'Outfit', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${state.timeLeft.toFixed(1)} sn`, timerX + timerW * 0.5, timerY - 4);
    }

  }

  function drawQuestionCue() {
    if (state.mode !== "playing" || !state.level || state.questionCueT <= 0 || !state.questionCueLabel) {
      return;
    }

    const duration = Math.max(0.001, state.questionCueDuration || 1);
    const ratio = clamp(state.questionCueT / duration, 0, 1);
    const age = 1 - ratio;
    const alpha = clamp(ratio * 1.2, 0, 1);
    const line = getLineGeometry();
    const centerX = canvas.width * 0.5;
    const centerY = line.y - 108 - age * 16;
    const text = `Yeni hedef: ${state.questionCueLabel}`;

    ctx.save();
    ctx.globalAlpha = alpha * 0.35;
    ctx.fillStyle = "rgba(34, 73, 90, 0.42)";
    ctx.beginPath();
    ctx.roundRect(centerX - 220, centerY - 30, 440, 64, 22);
    ctx.fill();

    ctx.globalAlpha = alpha;
    ctx.font = "700 24px 'Noto Sans', 'Outfit', sans-serif";
    const textW = ctx.measureText(text).width;
    const cardW = clamp(textW + 44, 220, canvas.width * 0.64);
    const cardH = 48;
    const cardX = centerX - cardW * 0.5;
    const cardY = centerY - cardH * 0.5;

    ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
    ctx.strokeStyle = "rgba(26, 54, 66, 0.92)";
    ctx.lineWidth = 2.4 + Math.sin(age * Math.PI * 4) * 0.45;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = THEME.darkTeal;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, centerX, cardY + cardH * 0.52);
    ctx.textBaseline = "alphabetic";
    ctx.restore();
  }

  function drawParticles() {
    for (const p of state.particles) {
      const alpha = clamp(p.life / p.ttl, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawFeedback() {
    if (state.feedbackT <= 0 || !state.feedback) {
      return;
    }

    const palette = {
      info: { bg: "rgba(34, 73, 90, 0.92)", border: "rgba(26, 54, 66, 0.98)", chip: "#163642", chipText: "BİLGİ" },
      success: { bg: "rgba(22, 163, 74, 0.93)", border: "rgba(21, 128, 61, 0.98)", chip: "#166534", chipText: "DOĞRU" },
      error: { bg: "rgba(220, 38, 38, 0.94)", border: "rgba(153, 27, 27, 0.98)", chip: "#991b1b", chipText: "YANLIŞ" },
      warning: { bg: "rgba(234, 88, 12, 0.94)", border: "rgba(194, 65, 12, 0.98)", chip: "#9a3412", chipText: "SÜRE" },
    };
    const style = palette[state.feedbackType] || palette.info;
    const alpha = clamp(state.feedbackT / 3, 0, 1);
    const x = canvas.width * 0.16;
    const w = canvas.width * 0.68;
    const h = canvas.height * 0.11;
    const bottomPad = canvas.height * 0.02;
    let y = canvas.height * 0.835;

    if (state.mode === "menu") {
      const menuPanelH = Math.min(Math.max(canvas.height * 0.78, 420), canvas.height * 0.9);
      const menuPanelY = (canvas.height - menuPanelH) * 0.5;
      const belowPanelY = menuPanelY + menuPanelH + 12;
      const maxY = canvas.height - h - bottomPad;
      if (belowPanelY <= maxY) {
        y = belowPanelY;
      } else {
        y = menuPanelY - h - 12;
      }
    }
    y = clamp(y, bottomPad, canvas.height - h - bottomPad);

    ctx.globalAlpha = alpha;
    ctx.fillStyle = style.bg;
    ctx.strokeStyle = style.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 16);
    ctx.fill();
    ctx.stroke();

    const chipW = 126;
    const chipH = 38;
    const chipX = x + 14;
    const chipY = y + h * 0.5 - chipH * 0.5;
    ctx.fillStyle = style.chip;
    ctx.beginPath();
    ctx.roundRect(chipX, chipY, chipW, chipH, 12);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 18px 'Noto Sans', 'Outfit', sans-serif";
    ctx.fillText(style.chipText, chipX + chipW * 0.5, chipY + chipH * 0.52);

    const messageX = chipX + chipW + 20;
    const messageWidth = Math.max(120, x + w - messageX - 16);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    let fontSize = 24;
    let lineHeight = 28;
    ctx.font = `700 ${fontSize}px 'Noto Sans', 'Outfit', sans-serif`;
    let lines = wrapTextLines(state.feedback, messageWidth);

    if (lines.length > 2) {
      fontSize = 20;
      lineHeight = 24;
      ctx.font = `700 ${fontSize}px 'Noto Sans', 'Outfit', sans-serif`;
      lines = wrapTextLines(state.feedback, messageWidth);
    }
    if (lines.length > 3) {
      fontSize = 18;
      lineHeight = 22;
      ctx.font = `700 ${fontSize}px 'Noto Sans', 'Outfit', sans-serif`;
      lines = wrapTextLines(state.feedback, messageWidth);
    }

    const firstLineY = y + h * 0.5 - ((lines.length - 1) * lineHeight) * 0.5;
    lines.forEach((line, index) => {
      ctx.fillText(line, messageX, firstLineY + index * lineHeight);
    });
    ctx.textBaseline = "alphabetic";
    ctx.globalAlpha = 1;
  }

  function drawImpactFlash() {
    if (state.flashT <= 0 || state.flashDuration <= 0) {
      return;
    }
    const ratio = clamp(state.flashT / state.flashDuration, 0, 1);
    const alpha = 0.32 * ratio;
    ctx.fillStyle = `rgba(${state.flashColor}, ${alpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawCameraPreview() {
    if (!state.camera.active || cameraVideo.readyState < 2) {
      return;
    }

    const w = canvas.width * 0.2;
    const h = w * 0.75;
    const x = canvas.width * 0.76;
    const y = canvas.height * 0.04;

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.beginPath();
    ctx.roundRect(x - 5, y - 5, w + 10, h + 10, 12);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.clip();
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(cameraVideo, 0, 0, w, h);
    ctx.restore();

    const px = x + (1 - state.camera.pointerX) * w;
    const py = y + state.camera.pointerY * h;
    ctx.fillStyle = THEME.teal;
    ctx.strokeStyle = THEME.darkTeal;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = THEME.darkTeal;
    ctx.font = "600 13px 'Noto Sans', 'Outfit', sans-serif";
    ctx.textAlign = "left";
    const confidenceText = Math.round(state.camera.trackingConfidence * 100);
    const trackerLabel = state.camera.tracker === "ai" ? "AI" : "basic";
    ctx.fillText(`hareket ${Math.round(state.camera.lastMotion)} | takip %${confidenceText} | ${trackerLabel}`, x, y + h + 18);
  }

  function drawCenteredWrappedText(text, centerX, startY, maxWidth, lineHeight) {
    const lines = wrapTextLines(text, maxWidth);
    ctx.textAlign = "center";
    lines.forEach((line, index) => {
      ctx.fillText(line, centerX, startY + lineHeight * index);
    });
    return lines.length;
  }

  function wrapTextLines(text, maxWidth) {
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let current = "";

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth || !current) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }

    if (current) {
      lines.push(current);
    }
    if (!lines.length) {
      lines.push("");
    }
    return lines;
  }

  function drawMenuPanel() {
    const isMenuMode = state.mode === "menu";
    const panelW = canvas.width * 0.78;
    const menuDesiredHeight = Math.max(canvas.height * 0.78, 420);
    const panelH = isMenuMode ? Math.min(menuDesiredHeight, canvas.height * 0.9) : canvas.height * 0.56;
    const panelX = (canvas.width - panelW) * 0.5;
    const panelY = (canvas.height - panelH) * 0.5;
    if (!isMenuMode) {
      state.menuLevelRects = [];
      state.menuHoverIndex = -1;
    }

    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.strokeStyle = "rgba(34, 73, 90, 0.25)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 20);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.fillStyle = THEME.teal;
    const menuTitleSize = clamp(Math.round(panelH * 0.12), 48, 62);
    ctx.font = `700 ${menuTitleSize}px 'Noto Serif', 'Forum', 'Caudex', serif`;

    if (state.mode === "menu") {
      const titleY = panelY + 72;
      const subtitleY = panelY + 112;
      ctx.fillText("KESİR KÂŞİFİ", canvas.width * 0.5, titleY);
      const menuSubtitleSize = clamp(Math.round(panelH * 0.046), 20, 25);
      ctx.font = `600 ${menuSubtitleSize}px 'Noto Sans', 'Outfit', sans-serif`;
      const subtitleLines = drawCenteredWrappedText(
        "Bölüm seç, yöntemi belirle ve kesri doğru noktaya yerleştir.",
        canvas.width * 0.5,
        subtitleY,
        panelW * 0.84,
        clamp(Math.round(panelH * 0.06), 26, 32)
      );
      const subtitleBottom = subtitleY + (subtitleLines - 1) * clamp(Math.round(panelH * 0.06), 26, 32);

      const levelMeta = LEVELS.map((level, index) => ({
        key: String(index + 1),
        name: level.name,
        desc: level.menuDesc || level.name,
        accent: level.cameraFocus ? "#1a3642" : level.moving ? "#2d6074" : index === 0 ? "#1a3642" : "#22495a",
      }));
      const cols = 2;
      const rows = Math.ceil(levelMeta.length / cols);
      const compactCards = rows > 3;

      const gridPadX = 28;
      const menuLabelY = subtitleBottom + 18;
      const gridTop = menuLabelY + (compactCards ? 20 : 24);
      const footerPrimaryY = panelY + panelH - (compactCards ? 68 : 64);
      const footerSecondaryY = panelY + panelH - (compactCards ? 20 : 28);
      const gridBottom = footerPrimaryY - (compactCards ? 68 : 38);
      const colGap = 18;
      const rowGap = clamp(panelH * 0.014, compactCards ? 2 : 10, compactCards ? 8 : 16);
      const cardW = (panelW - gridPadX * 2 - colGap) / cols;
      const rawCardH = (gridBottom - gridTop - rowGap * (rows - 1)) / rows;
      const cardH = clamp(rawCardH, compactCards ? 24 : 52, 94);
      const cardRadius = 14;
      state.menuLevelRects = [];
      state.menuHoverIndex = -1;

      ctx.fillStyle = "rgba(24, 66, 85, 0.72)";
      ctx.textAlign = "left";
      ctx.font = "700 18px 'Noto Sans', 'Outfit', sans-serif";
      ctx.fillText("SEVİYE MENÜSÜ", panelX + gridPadX, menuLabelY);

      levelMeta.forEach((item, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        let x = panelX + gridPadX + col * (cardW + colGap);
        if (compactCards && levelMeta.length % cols === 1 && i === levelMeta.length - 1) {
          x = panelX + (panelW - cardW) * 0.5;
        }
        const y = gridTop + row * (cardH + rowGap);
        const hitRect = { x, y, w: cardW, h: cardH, index: i };
        state.menuLevelRects.push(hitRect);
        const hovered = pointInRect(state.pointer, hitRect);
        if (hovered) {
          state.menuHoverIndex = i;
        }
        const isPrimary = i === 0;
        const pulse = isPrimary ? 1 + Math.sin(state.tickPulse * 3.8) * 0.015 : 1;
        const cx = x + cardW * 0.5;
        const cy = y + cardH * 0.5;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(pulse, pulse);
        ctx.translate(-cx, -cy);

        ctx.fillStyle = hovered ? "rgba(227, 241, 248, 0.99)" : isPrimary ? "rgba(232, 242, 247, 0.98)" : "rgba(245, 249, 251, 0.96)";
        ctx.strokeStyle = hovered ? "rgba(21, 67, 87, 0.98)" : isPrimary ? "rgba(24, 66, 85, 0.95)" : "rgba(34, 73, 90, 0.45)";
        ctx.lineWidth = hovered ? 2.8 : isPrimary ? 2.4 : 1.8;
        ctx.beginPath();
        ctx.roundRect(x, y, cardW, cardH, cardRadius);
        ctx.fill();
        ctx.stroke();

        const badgeR = compactCards ? clamp(cardH * 0.26, 9, 12) : cardH > 70 ? 17 : 15;
        const badgeX = x + (compactCards ? 18 : 22);
        const badgeY = y + badgeR + (compactCards ? clamp(cardH * 0.16, 4, 8) : 10);
        ctx.fillStyle = item.accent;
        ctx.beginPath();
        ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `700 ${compactCards ? 14 : cardH > 70 ? 17 : 15}px 'Noto Sans', 'Outfit', sans-serif`;
        ctx.fillText(item.key, badgeX, badgeY + 0.5);
        ctx.textBaseline = "alphabetic";

        const textX = x + (compactCards ? 36 : 46);
        const titleMaxW = cardW - (compactCards ? 50 : 56);
        let titleSize = compactCards ? clamp(Math.round(cardH * 0.45), 11, 16) : cardH > 70 ? 21 : 18;
        ctx.fillStyle = item.accent;
        ctx.textAlign = "left";
        ctx.font = `700 ${titleSize}px 'Noto Sans', 'Outfit', sans-serif`;
        while (titleSize > (compactCards ? 9 : 14) && ctx.measureText(item.name).width > titleMaxW) {
          titleSize -= 1;
          ctx.font = `700 ${titleSize}px 'Noto Sans', 'Outfit', sans-serif`;
        }
        const titleYCard = y + (compactCards ? cardH * 0.62 : cardH > 70 ? 30 : 26);
        ctx.fillText(item.name, textX, titleYCard);

        if (!compactCards) {
          let descSize = cardH > 70 ? 13 : 12;
          ctx.fillStyle = "rgba(36, 53, 68, 0.76)";
          ctx.font = `600 ${descSize}px 'Noto Sans', 'Outfit', sans-serif`;
          while (descSize > 11 && ctx.measureText(item.desc).width > titleMaxW) {
            descSize -= 1;
            ctx.font = `600 ${descSize}px 'Noto Sans', 'Outfit', sans-serif`;
          }
          ctx.fillText(item.desc, textX, y + cardH - 14);
        }

        ctx.restore();
      });
      canvas.style.cursor = state.menuHoverIndex !== -1 ? "pointer" : "default";

      const primaryPillW = panelW * (compactCards ? 0.62 : 0.56);
      const primaryPillH = compactCards ? 34 : 38;
      const primaryPillX = panelX + (panelW - primaryPillW) * 0.5;
      const primaryPillY = footerPrimaryY - primaryPillH * 0.5;
      ctx.fillStyle = "rgba(34, 73, 90, 0.08)";
      ctx.strokeStyle = "rgba(34, 73, 90, 0.24)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(primaryPillX, primaryPillY, primaryPillW, primaryPillH, 13);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.fillStyle = "#1f3f52";
      ctx.font = `700 ${compactCards ? 18 : 20}px 'Noto Sans', 'Outfit', sans-serif`;
      ctx.fillText(`Kart tıkla veya 1-${LEVELS.length} ile seviyeyi başlat`, panelX + panelW * 0.5, footerPrimaryY + 5);

      const secondaryPillW = panelW * 0.86;
      const secondaryPillH = compactCards ? 30 : 32;
      const secondaryPillX = panelX + (panelW - secondaryPillW) * 0.5;
      const secondaryPillY = footerSecondaryY - secondaryPillH * 0.5;
      ctx.fillStyle = "rgba(24, 66, 85, 0.05)";
      ctx.strokeStyle = "rgba(24, 66, 85, 0.16)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(secondaryPillX, secondaryPillY, secondaryPillW, secondaryPillH, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "rgba(24, 66, 85, 0.76)";
      ctx.font = "600 17px 'Noto Sans', 'Outfit', sans-serif";
      ctx.fillText("Enter: Kampanya | C: Kamera | 0: Menü | F: Tam ekran", panelX + panelW * 0.5, footerSecondaryY + 5);
      return;
    }

    if (state.mode === "level_clear") {
      ctx.fillText("SEVİYE TAMAMLANDI", canvas.width * 0.5, panelY + 80);
      ctx.font = "700 28px 'Noto Sans', 'Outfit', sans-serif";
      ctx.fillStyle = "#16a34a";
      ctx.fillText(`Skor: ${state.score}`, canvas.width * 0.5, panelY + 134);
      ctx.font = "600 20px 'Noto Sans', 'Outfit', sans-serif";
      ctx.fillStyle = THEME.teal;
      ctx.fillText("Sonraki bölümde daha zor kesirler var.", canvas.width * 0.5, panelY + 182);
      ctx.fillText("Sonraki Seviye butonuna bas.", canvas.width * 0.5, panelY + 220);
      return;
    }

    if (state.mode === "game_complete") {
      ctx.fillText("GALAKSİ KURTARILDI", canvas.width * 0.5, panelY + 80);
      ctx.font = "700 31px 'Noto Sans', 'Outfit', sans-serif";
      ctx.fillStyle = "#16a34a";
      ctx.fillText(`Final Skor: ${state.score}`, canvas.width * 0.5, panelY + 136);
      ctx.font = "600 20px 'Noto Sans', 'Outfit', sans-serif";
      ctx.fillStyle = THEME.teal;
      ctx.fillText("Kamera + sayı doğrusu kombinasyonunu tamamladın.", canvas.width * 0.5, panelY + 188);
      ctx.fillText("Baştan Oyna ile yeni bir tur aç.", canvas.width * 0.5, panelY + 226);
    }
  }

  function update(dt) {
    state.tickPulse += dt;

    if (state.feedbackT > 0) {
      state.feedbackT = Math.max(0, state.feedbackT - dt);
    }
    if (state.hudShakeT > 0) {
      state.hudShakeT = Math.max(0, state.hudShakeT - dt);
    }
    if (state.lifeDropT > 0) {
      state.lifeDropT = Math.max(0, state.lifeDropT - dt);
    }
    if (state.flashT > 0) {
      state.flashT = Math.max(0, state.flashT - dt);
    }
    if (state.questionCueT > 0) {
      state.questionCueT = Math.max(0, state.questionCueT - dt);
    }

    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.life -= dt;
      p.vy += 240 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) {
        state.particles.splice(i, 1);
      }
    }

    processCamera(dt);

    if (state.mode !== "playing" || !state.level) {
      return;
    }

    state.elapsedInLevel += dt;

    if (state.level.moving) {
      const span = state.level.range[1] - state.level.range[0];
      const moveSpeed = Number.isFinite(state.level.moveSpeed) ? state.level.moveSpeed : 1.1;
      const moveAmplitude = Number.isFinite(state.level.moveAmplitude) ? state.level.moveAmplitude : 0.17;
      state.lineShift = Math.sin(state.elapsedInLevel * moveSpeed) * span * moveAmplitude;
    } else {
      state.lineShift = 0;
    }

    if (state.level.timeLimit > 0) {
      state.timeLeft -= dt;
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        timeoutPenalty();
      }
    }

    updateHintText();
  }

  function render() {
    ensureCanvasSize();

    drawBackground();

    if (state.mode === "playing" && state.level) {
      drawTopCards();
      drawNumberLine();
      drawParticles();
      drawQuestionCue();
      drawCameraPreview();
    } else {
      drawParticles();
      drawMenuPanel();
    }

    drawImpactFlash();
    drawFeedback();
  }

  function eventToCanvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  canvas.addEventListener("pointerdown", (event) => {
    const point = eventToCanvasPoint(event);
    state.pointer.down = true;
    state.pointer.x = point.x;
    state.pointer.y = point.y;
    canvas.setPointerCapture(event.pointerId);

    if (state.mode === "menu") {
      const clickedLevel = getMenuLevelIndexAtPoint(point);
      if (clickedLevel !== -1) {
        startCampaignFromLevel(clickedLevel);
      }
      return;
    }

    if (state.mode !== "playing") {
      return;
    }

    if (pointInRect(point, state.confirmRect)) {
      submitGuess("canvas-button");
      return;
    }

    if (state.inputMode !== "camera") {
      setMarkerFromCanvasX(point.x);
    }
  });

  canvas.addEventListener("pointermove", (event) => {
    const point = eventToCanvasPoint(event);
    state.pointer.x = point.x;
    state.pointer.y = point.y;

    if (state.mode === "menu") {
      state.menuHoverIndex = getMenuLevelIndexAtPoint(point);
      canvas.style.cursor = state.menuHoverIndex !== -1 ? "pointer" : "default";
      return;
    }

    if (!state.pointer.down || state.mode !== "playing") {
      canvas.style.cursor = "default";
      return;
    }

    if (state.inputMode !== "camera") {
      setMarkerFromCanvasX(point.x);
    }
  });

  function releasePointer(event) {
    state.pointer.down = false;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  }

  canvas.addEventListener("pointerup", releasePointer);
  canvas.addEventListener("pointercancel", releasePointer);

  async function handleCameraButton() {
    await toggleCameraMode();
  }

  ui.startBtn.addEventListener("click", startCampaign);
  ui.confirmBtn.addEventListener("click", () => submitGuess("dom-button"));
  ui.nextBtn.addEventListener("click", () => {
    if (state.mode === "level_clear") {
      beginLevel(state.levelIndex + 1);
      return;
    }
    startCampaign();
  });
  ui.resetBtn.addEventListener("click", returnToMenu);
  ui.cameraBtn.addEventListener("click", () => {
    void handleCameraButton();
  });

  async function onKeyDown(event) {
    const key = event.key.toLowerCase();
    const levelShortcutIndex = getLevelShortcutIndex(key);

    if (key === "f") {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
      return;
    }

    if (key === "c") {
      event.preventDefault();
      await toggleCameraMode();
      return;
    }

    if (levelShortcutIndex !== -1) {
      event.preventDefault();
      startCampaignFromLevel(levelShortcutIndex);
      return;
    }

    if (key === "0") {
      event.preventDefault();
      returnToMenu();
      return;
    }

    if (key === "r") {
      returnToMenu();
      return;
    }

    if (key === "n" && (state.mode === "level_clear" || state.mode === "game_complete")) {
      if (state.mode === "level_clear") {
        beginLevel(state.levelIndex + 1);
      } else {
        startCampaign();
      }
      return;
    }

    if ((key === " " || key === "enter") && state.mode === "menu") {
      event.preventDefault();
      startCampaign();
      return;
    }

    if ((key === " " || key === "enter") && (state.mode === "level_clear" || state.mode === "game_complete")) {
      event.preventDefault();
      if (state.mode === "level_clear") {
        beginLevel(state.levelIndex + 1);
      } else {
        startCampaign();
      }
      return;
    }

    if (state.mode !== "playing" || !state.level) {
      return;
    }

    const span = state.level.range[1] - state.level.range[0];
    const step = state.level.dynamicTickFromQuestion ? getActiveTickStep() : span / 60;

    if (key === "arrowleft") {
      state.markerValue = normalizeMarkerValue(state.markerValue - step);
      event.preventDefault();
    }

    if (key === "arrowright") {
      state.markerValue = normalizeMarkerValue(state.markerValue + step);
      event.preventDefault();
    }

    if (key === "arrowup") {
      state.markerValue = normalizeMarkerValue(state.markerValue + step * 2);
      event.preventDefault();
    }

    if (key === "arrowdown") {
      state.markerValue = normalizeMarkerValue(state.markerValue - step * 2);
      event.preventDefault();
    }

    if (key === " " || key === "enter") {
      event.preventDefault();
      submitGuess("keyboard");
    }
  }

  window.addEventListener("keydown", (event) => {
    void onKeyDown(event);
  });

  window.addEventListener("beforeunload", () => {
    stopCamera();
  });

  window.render_game_to_text = () => {
    const question = currentQuestion();
    const line = getLineGeometry();
    const visual = getVisualRange();

    return JSON.stringify({
      coordinateSystem: "Canvas origin top-left; x right, y down; number line values increase left to right.",
      mode: state.mode,
      level: state.level
        ? {
            index: state.levelIndex + 1,
            id: state.level.id,
            name: state.level.name,
          }
        : null,
      inputMode: state.inputMode,
      score: state.score,
      lives: state.lives,
      question: question
        ? {
            index: state.questionIndex + 1,
            total: state.questions.length,
            label: question.label,
            value: Number(question.value.toFixed(4)),
          }
        : null,
      line: state.level
        ? {
            pixelStart: Number(line.x.toFixed(2)),
            pixelEnd: Number((line.x + line.width).toFixed(2)),
            visualMin: Number(visual.min.toFixed(4)),
            visualMax: Number(visual.max.toFixed(4)),
            markerValue: Number(state.markerValue.toFixed(4)),
            markerX: Number(valueToX(state.markerValue).toFixed(2)),
          }
        : null,
      timer: state.level && state.level.timeLimit > 0 ? Number(state.timeLeft.toFixed(2)) : null,
      feedback: state.feedback,
      feedbackType: state.feedbackType,
      questionCue: state.questionCueT > 0 ? { label: state.questionCueLabel, ttl: Number(state.questionCueT.toFixed(2)) } : null,
      camera: {
        active: state.camera.active,
        usingCameraInput: state.inputMode === "camera",
        motion: Number(state.camera.lastMotion.toFixed(0)),
        pointerX: Number(state.camera.pointerX.toFixed(3)),
      },
    });
  };

  window.advanceTime = (ms) => {
    const frameMs = 1000 / 60;
    const steps = Math.max(1, Math.round(ms / frameMs));
    for (let i = 0; i < steps; i += 1) {
      update(1 / 60);
    }
    render();
  };

  function frame(now) {
    const dt = Math.min(0.05, (now - state.lastTick) / 1000);
    state.lastTick = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  async function boot() {
    updateUI();
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch {
        // Font promise errors should not block gameplay.
      }
    }
    render();
    requestAnimationFrame(frame);
  }

  void boot();
})();
