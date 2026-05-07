const VOICE_STORAGE_KEY = "jiuxingji-hanzi-quest-voice-v1";
const PANEL_STORAGE_KEY = "jiuxingji-hanzi-quest-panel-position-v1";
const NAME_STORAGE_KEY = "jiuxingji-hanzi-quest-player-name-v1";
const LEVEL_STORAGE_KEY = "jiuxingji-hanzi-quest-level-v1";
const OLD_PROGRESS_KEY = "jiuxingji-hanzi-quest-progress-v1";
const PROGRESS_STORAGE_PREFIX = "jiuxingji-hanzi-quest-progress-v2-";

const els = {
  dashboard: document.querySelector("#score-panel"),
  nameGate: document.querySelector("#name-gate"),
  playerForm: document.querySelector("#player-form"),
  playerNameInput: document.querySelector("#player-name-input"),
  playerBadge: document.querySelector("#player-badge"),
  playerName: document.querySelector("#player-name"),
  lessonLabel: document.querySelector("#lesson-label"),
  levelSelect: document.querySelector("#level-select"),
  rulesButton: document.querySelector("#rules-button"),
  rulesModal: document.querySelector("#rules-modal"),
  rulesClose: document.querySelector("#rules-close"),
  score: document.querySelector("#score"),
  streak: document.querySelector("#streak"),
  seen: document.querySelector("#seen"),
  total: document.querySelector("#total"),
  bankCount: document.querySelector("#bank-count"),
  bankGrid: document.querySelector("#bank-grid"),
  challenge: document.querySelector("#challenge"),
  answerZone: document.querySelector("#answer-zone"),
  feedback: document.querySelector("#feedback"),
  next: document.querySelector("#next-round"),
  previous: document.querySelector("#previous-round"),
  speak: document.querySelector("#speak-word"),
  roundLabel: document.querySelector("#round-label"),
  reset: document.querySelector("#reset-progress"),
  tabs: document.querySelectorAll(".mode-tab"),
  voiceSelect: document.querySelector("#voice-select"),
  testVoice: document.querySelector("#test-voice"),
};

const VOICE_OPTIONS = {
  mandarin: {
    lang: "zh-CN",
    audioFolder: "mandarin",
    match: [/^zh-CN\b/i, /Mandarin|Putonghua|普通话|国语|國語|Ting-Ting|Meijia|China/i],
    avoid: /Cantonese|粤|粵|Hong Kong|zh-HK|yue/i,
    rate: 0.82,
  },
  cantonese: {
    lang: "zh-HK",
    audioFolder: "cantonese",
    match: [/^zh-HK\b/i, /^yue\b/i, /Cantonese|粤|粵|Hong Kong|Sin-ji/i],
    avoid: /Mandarin|Putonghua|普通话|国语|國語|zh-CN/i,
    rate: 0.78,
  },
};

let currentAudio = null;
let autoNextTimer = null;
let WORDS = [];

const state = {
  level: getSavedLevel(),
  mode: "listen",
  voice: getSavedVoice(),
  round: 1,
  score: 0,
  streak: 0,
  seen: new Set(),
  mastered: new Set(),
  playerName: localStorage.getItem(NAME_STORAGE_KEY) || "",
  current: null,
  history: [],
  historyIndex: -1,
};

loadLesson(state.level);
restoreProgress();
renderBank();
setupNameGate();

els.levelSelect.value = state.level;
els.voiceSelect.value = state.voice;
els.speak.addEventListener("click", () => speak(state.current));
els.next.addEventListener("click", newRound);
els.previous.addEventListener("click", previousRound);
els.reset.addEventListener("click", resetProgress);
els.levelSelect.addEventListener("change", () => switchLesson(els.levelSelect.value));
els.rulesButton.addEventListener("click", openRules);
els.rulesClose.addEventListener("click", closeRules);
els.rulesModal.addEventListener("click", (event) => {
  if (event.target === els.rulesModal) closeRules();
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeRules();
});
els.voiceSelect.addEventListener("change", () => {
  state.voice = els.voiceSelect.value;
  localStorage.setItem(VOICE_STORAGE_KEY, state.voice);
  speak(state.current);
});
els.testVoice.addEventListener("click", () => speak(state.current));
setupFloatingPanel();
els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    state.mode = tab.dataset.mode;
    els.tabs.forEach((item) => item.classList.toggle("active", item === tab));
    if (state.playerName) newRound();
  });
});

if (state.playerName) {
  newRound();
} else {
  renderStats();
  updatePreviousButton();
  els.roundLabel.textContent = "第 1 题";
  els.next.hidden = true;
}

function loadLesson(level) {
  const lesson = WORD_SETS[level] || WORD_SETS.nine;
  state.level = WORD_SETS[level] ? level : "nine";
  WORDS = lesson.words.map((item, index) => ({
    ...item,
    audioId: String(index + 1).padStart(3, "0"),
    audioLevel: state.level,
    plain: normalizePinyin(item.pinyin),
  }));
  els.lessonLabel.textContent = lesson.label;
  updateWordTotals();
}

function switchLesson(level) {
  if (level === state.level) return;
  persistProgress();
  clearPendingAutoNext();
  stopAudio();
  loadLesson(level);
  localStorage.setItem(LEVEL_STORAGE_KEY, state.level);
  resetRoundState();
  restoreProgress();
  renderBank();
  renderStats();
  if (state.playerName) {
    newRound();
  } else {
    els.roundLabel.textContent = "第 1 题";
    els.next.hidden = true;
    updatePreviousButton();
  }
}

function newRound() {
  clearPendingAutoNext();
  state.current = pickWord();
  state.history = state.history.slice(0, state.historyIndex + 1);
  state.history.push({ word: state.current.word });
  state.historyIndex = state.history.length - 1;
  state.seen.add(state.current.word);
  els.roundLabel.textContent = `第 ${state.round} 题`;
  els.feedback.textContent = "";
  els.feedback.className = "feedback";
  els.next.hidden = true;
  els.next.textContent = "下一题";
  updatePreviousButton();
  renderStats();
  persistProgress();

  if (state.mode === "listen") renderListen();
  if (state.mode === "cards") renderCards();
}

function previousRound() {
  if (state.historyIndex <= 0) return;
  clearPendingAutoNext();
  state.historyIndex -= 1;
  const entry = state.history[state.historyIndex];
  state.current = WORDS.find((item) => item.word === entry.word) || state.current;
  els.roundLabel.textContent = `回看第 ${state.historyIndex + 1} 题`;
  els.feedback.textContent = "看清拼音后，可以继续练习";
  els.feedback.className = "feedback good";
  els.next.hidden = true;
  els.next.textContent = "继续练习";
  updatePreviousButton();
  renderReview();
  speak(state.current);
}

function renderReview() {
  els.challenge.innerHTML = `
    <div class="card-panel review-card">
      <div class="review-label">上一题</div>
      <div class="big-word">${state.current.word}</div>
      <div class="pinyin">${state.current.pinyin}</div>
    </div>
  `;
  els.answerZone.innerHTML = `
    <div class="choice-grid review-actions">
      <button class="choice review-choice" type="button" data-review="speak">再读一次</button>
      <button class="choice review-choice" type="button" data-review="next">继续练习</button>
    </div>
  `;
  document.querySelector('[data-review="speak"]').addEventListener("click", () => speak(state.current));
  document.querySelector('[data-review="next"]').addEventListener("click", newRound);
}

function renderListen() {
  els.challenge.innerHTML = `
    <div>
      <div class="big-word">听</div>
      <div class="hint">选择听到的词</div>
    </div>
  `;
  const options = shuffle([
    state.current,
    ...shuffle(WORDS.filter((item) => item.word !== state.current.word)).slice(0, 3),
  ]);
  els.answerZone.innerHTML = `<div class="choice-grid"></div>`;
  const grid = els.answerZone.querySelector(".choice-grid");
  options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice";
    button.textContent = option.word;
    button.addEventListener("click", () => checkChoice(button, option.word === state.current.word));
    grid.append(button);
  });
  if (state.playerName) window.setTimeout(() => speak(state.current), 280);
}

function renderCards() {
  els.challenge.innerHTML = `
    <div class="card-panel">
      <div class="big-word">${state.current.word}</div>
      <div class="pinyin">${state.current.pinyin}</div>
    </div>
  `;
  els.answerZone.innerHTML = `
    <div class="choice-grid">
      <button class="choice" type="button" data-card="again">再练一次</button>
      <button class="choice" type="button" data-card="known">认识了</button>
    </div>
  `;
  document.querySelector('[data-card="again"]').addEventListener("click", () => {
    speak(state.current);
    finish(false, "再听一遍，慢慢来");
  });
  document.querySelector('[data-card="known"]').addEventListener("click", () => finish(true, "记住了", true));
  if (state.playerName) window.setTimeout(() => speak(state.current), 280);
}

function checkChoice(button, ok) {
  document.querySelectorAll(".choice").forEach((choice) => {
    choice.disabled = true;
    if (choice.textContent === state.current.word) choice.classList.add("correct");
  });
  if (!ok) button.classList.add("wrong");
  finish(ok, ok ? `${state.current.pinyin}` : `正确答案：${state.current.word} · ${state.current.pinyin}`, ok);
}

function finish(ok, message, autoNext = false) {
  if (ok) {
    state.score += 10 + Math.min(state.streak, 5) * 2;
    state.streak += 1;
    state.mastered.add(state.current.word);
    renderBank();
  } else {
    state.streak = 0;
  }
  els.feedback.textContent = message;
  els.feedback.className = `feedback ${ok ? "good" : "bad"}`;
  els.next.hidden = autoNext;
  state.round += 1;
  renderStats();
  persistProgress();
  if (autoNext) {
    autoNextTimer = window.setTimeout(() => {
      autoNextTimer = null;
      newRound();
    }, 850);
  }
}

function renderStats() {
  els.score.textContent = state.score;
  els.streak.textContent = state.streak;
  els.seen.textContent = state.seen.size;
}

function updatePreviousButton() {
  els.previous.disabled = state.historyIndex <= 0;
}

function clearPendingAutoNext() {
  if (!autoNextTimer) return;
  window.clearTimeout(autoNextTimer);
  autoNextTimer = null;
}

function openRules() {
  els.rulesModal.hidden = false;
  els.rulesClose.focus();
}

function closeRules() {
  if (els.rulesModal.hidden) return;
  els.rulesModal.hidden = true;
  els.rulesButton.focus();
}

function setupFloatingPanel() {
  restorePanelPosition();
  window.addEventListener("resize", clampPanelToViewport);

  let dragStart = null;
  els.dashboard.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) return;
    const rect = els.dashboard.getBoundingClientRect();
    dragStart = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    els.dashboard.classList.add("dragging");
    els.dashboard.setPointerCapture(event.pointerId);
  });

  els.dashboard.addEventListener("pointermove", (event) => {
    if (!dragStart || event.pointerId !== dragStart.pointerId) return;
    event.preventDefault();
    movePanel(event.clientX - dragStart.offsetX, event.clientY - dragStart.offsetY);
  });

  ["pointerup", "pointercancel"].forEach((eventName) => {
    els.dashboard.addEventListener(eventName, (event) => {
      if (!dragStart || event.pointerId !== dragStart.pointerId) return;
      dragStart = null;
      els.dashboard.classList.remove("dragging");
      persistPanelPosition();
    });
  });
  els.playerBadge.addEventListener("click", () => {
    els.nameGate.hidden = false;
    els.playerNameInput.focus();
  });
}

function movePanel(left, top) {
  const rect = els.dashboard.getBoundingClientRect();
  const margin = 8;
  const maxLeft = window.innerWidth - rect.width - margin;
  const maxTop = window.innerHeight - rect.height - margin;
  els.dashboard.style.left = `${Math.min(Math.max(margin, left), maxLeft)}px`;
  els.dashboard.style.top = `${Math.min(Math.max(margin, top), maxTop)}px`;
  els.dashboard.style.right = "auto";
}

function clampPanelToViewport() {
  const rect = els.dashboard.getBoundingClientRect();
  movePanel(rect.left, rect.top);
}

function persistPanelPosition() {
  const rect = els.dashboard.getBoundingClientRect();
  localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify({ left: rect.left, top: rect.top }));
}

function restorePanelPosition() {
  try {
    const saved = JSON.parse(localStorage.getItem(PANEL_STORAGE_KEY));
    if (!saved) return;
    window.setTimeout(() => movePanel(saved.left, saved.top), 0);
  } catch {
    localStorage.removeItem(PANEL_STORAGE_KEY);
  }
}

function renderBank() {
  els.bankGrid.innerHTML = "";
  WORDS.forEach((item) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `bank-card${state.mastered.has(item.word) ? " mastered" : ""}`;
    card.innerHTML = `<strong>${item.word}</strong><span>${item.pinyin}</span>`;
    card.addEventListener("click", () => speak(item));
    els.bankGrid.append(card);
  });
}

function setupNameGate() {
  updatePlayerName(state.playerName);
  els.playerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = els.playerNameInput.value.trim();
    if (!name) return;
    state.playerName = name;
    localStorage.setItem(NAME_STORAGE_KEY, name);
    updatePlayerName(name);
    if (state.current) {
      speak(state.current);
    } else {
      newRound();
    }
  });
}

function updatePlayerName(name) {
  els.playerNameInput.value = name;
  els.playerName.textContent = name;
  els.playerBadge.hidden = !name;
  els.nameGate.hidden = Boolean(name);
}

function pickWord() {
  const unseen = WORDS.filter((item) => !state.seen.has(item.word));
  const pool = unseen.length ? unseen : WORDS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function speak(itemOrText) {
  if (!itemOrText) return;
  const text = typeof itemOrText === "string" ? itemOrText : itemOrText.word;
  const audioId = typeof itemOrText === "string" ? null : itemOrText.audioId;
  const audioLevel = typeof itemOrText === "string" ? null : itemOrText.audioLevel;
  const option = VOICE_OPTIONS[state.voice] || VOICE_OPTIONS.mandarin;
  stopAudio();
  if (audioId && option.audioFolder) {
    const audioPath =
      audioLevel === "nine"
        ? `./audio/${option.audioFolder}/${audioId}.m4a`
        : `./audio/${audioLevel}/${option.audioFolder}/${audioId}.m4a`;
    const audio = new Audio(audioPath);
    currentAudio = audio;
    const playPromise = audio.play();
    if (playPromise?.catch) {
      playPromise.catch(() => {
        if (state.voice !== "mandarin") speakWithSystemVoice(text, option);
      });
    }
    return;
  }
  speakWithSystemVoice(text, option);
}

function stopAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function speakWithSystemVoice(text, option) {
  if (!("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = option.lang;
  utterance.voice = findPreferredVoice(option);
  utterance.rate = option.rate;
  utterance.pitch = 1.05;
  window.speechSynthesis.speak(utterance);
}

function findPreferredVoice(option) {
  const voices = window.speechSynthesis.getVoices();
  const voiceLabel = (voice) => `${voice.lang} ${voice.name}`;
  return (
    voices.find((voice) => voice.lang.toLowerCase() === option.lang.toLowerCase()) ||
    voices.find((voice) => option.match.some((pattern) => pattern.test(voiceLabel(voice))) && !option.avoid.test(voiceLabel(voice))) ||
    null
  );
}

function getSavedLevel() {
  const saved = localStorage.getItem(LEVEL_STORAGE_KEY);
  return WORD_SETS[saved] ? saved : "nine";
}

function getSavedVoice() {
  const savedVoice = localStorage.getItem(VOICE_STORAGE_KEY);
  return VOICE_OPTIONS[savedVoice] ? savedVoice : "mandarin";
}

function normalizePinyin(value) {
  const toneMap = {
    ā: "a",
    á: "a",
    ǎ: "a",
    à: "a",
    ē: "e",
    é: "e",
    ě: "e",
    è: "e",
    ī: "i",
    í: "i",
    ǐ: "i",
    ì: "i",
    ō: "o",
    ó: "o",
    ǒ: "o",
    ò: "o",
    ū: "u",
    ú: "u",
    ǔ: "u",
    ù: "u",
    ǖ: "v",
    ǘ: "v",
    ǚ: "v",
    ǜ: "v",
    ü: "v",
  };
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/g, (char) => toneMap[char])
    .replace(/[^a-z]/g, "");
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function getProgressKey() {
  return `${PROGRESS_STORAGE_PREFIX}${state.level}`;
}

function persistProgress() {
  localStorage.setItem(
    getProgressKey(),
    JSON.stringify({
      score: state.score,
      streak: state.streak,
      seen: [...state.seen],
      mastered: [...state.mastered],
      round: state.round,
    }),
  );
}

function restoreProgress() {
  try {
    const raw = localStorage.getItem(getProgressKey()) || (state.level === "nine" ? localStorage.getItem(OLD_PROGRESS_KEY) : null);
    const saved = JSON.parse(raw);
    if (!saved) return;
    state.score = saved.score || 0;
    state.streak = saved.streak || 0;
    state.seen = new Set(saved.seen || []);
    state.mastered = new Set(saved.mastered || []);
    state.round = saved.round || 1;
  } catch {
    localStorage.removeItem(getProgressKey());
  }
}

function resetRoundState() {
  state.round = 1;
  state.score = 0;
  state.streak = 0;
  state.seen = new Set();
  state.mastered = new Set();
  state.current = null;
  state.history = [];
  state.historyIndex = -1;
}

function resetProgress() {
  clearPendingAutoNext();
  stopAudio();
  resetRoundState();
  localStorage.removeItem(getProgressKey());
  renderBank();
  newRound();
}

function updateWordTotals() {
  els.total.textContent = WORDS.length;
  els.bankCount.textContent = `${WORDS.length} 个词`;
}
