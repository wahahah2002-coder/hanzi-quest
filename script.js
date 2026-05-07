const WORDS = WORD_DATA.map((item) => ({
  ...item,
  plain: normalizePinyin(item.pinyin),
}));

const els = {
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
  speak: document.querySelector("#speak-word"),
  roundLabel: document.querySelector("#round-label"),
  reset: document.querySelector("#reset-progress"),
  tabs: document.querySelectorAll(".mode-tab"),
  voiceSelect: document.querySelector("#voice-select"),
  testVoice: document.querySelector("#test-voice"),
};

const STORAGE_KEY = "jiuxingji-hanzi-quest-progress-v1";
const VOICE_STORAGE_KEY = "jiuxingji-hanzi-quest-voice-v1";
const VOICE_OPTIONS = {
  mandarin: {
    lang: "zh-CN",
    match: [/^zh-CN\b/i, /Mandarin|Putonghua|普通话|国语|國語|Ting-Ting|Meijia|China/i],
    avoid: /Cantonese|粤|粵|Hong Kong|zh-HK|yue/i,
    rate: 0.82,
  },
  cantonese: {
    lang: "zh-HK",
    match: [/^zh-HK\b/i, /^yue\b/i, /Cantonese|粤|粵|Hong Kong|Sin-ji/i],
    avoid: /Mandarin|Putonghua|普通话|国语|國語|zh-CN/i,
    rate: 0.78,
  },
};
const state = {
  mode: "listen",
  voice: getSavedVoice(),
  round: 1,
  score: 0,
  streak: 0,
  seen: new Set(),
  current: null,
  selectedTiles: [],
};

restoreProgress();
renderBank();
newRound();

els.total.textContent = WORDS.length;
els.bankCount.textContent = `${WORDS.length} 个词`;
els.voiceSelect.value = state.voice;
els.speak.addEventListener("click", () => speak(state.current.word));
els.next.addEventListener("click", newRound);
els.reset.addEventListener("click", resetProgress);
els.voiceSelect.addEventListener("change", () => {
  state.voice = els.voiceSelect.value;
  localStorage.setItem(VOICE_STORAGE_KEY, state.voice);
  speak(state.current.word);
});
els.testVoice.addEventListener("click", () => speak(state.current.word));
els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    state.mode = tab.dataset.mode;
    els.tabs.forEach((item) => item.classList.toggle("active", item === tab));
    newRound();
  });
});

function newRound() {
  state.current = pickWord();
  state.selectedTiles = [];
  state.seen.add(state.current.word);
  els.roundLabel.textContent = `第 ${state.round} 题`;
  els.feedback.textContent = "";
  els.feedback.className = "feedback";
  els.next.hidden = true;
  renderStats();
  persistProgress();

  if (state.mode === "listen") renderListen();
  if (state.mode === "cards") renderCards();
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
  window.setTimeout(() => speak(state.current.word), 280);
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
    speak(state.current.word);
    finish(false, "再听一遍，慢慢来");
  });
  document.querySelector('[data-card="known"]').addEventListener("click", () => finish(true, "记住了", true));
  window.setTimeout(() => speak(state.current.word), 280);
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
    window.setTimeout(newRound, 850);
  }
}

function renderStats() {
  els.score.textContent = state.score;
  els.streak.textContent = state.streak;
  els.seen.textContent = state.seen.size;
}

function renderBank() {
  els.bankGrid.innerHTML = "";
  WORDS.forEach((item) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "bank-card";
    card.innerHTML = `<strong>${item.word}</strong><span>${item.pinyin}</span>`;
    card.addEventListener("click", () => speak(item.word));
    els.bankGrid.append(card);
  });
}

function pickWord() {
  const unseen = WORDS.filter((item) => !state.seen.has(item.word));
  const pool = unseen.length ? unseen : WORDS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const option = VOICE_OPTIONS[state.voice] || VOICE_OPTIONS.mandarin;
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

function persistProgress() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      score: state.score,
      streak: state.streak,
      seen: [...state.seen],
    }),
  );
}

function restoreProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return;
    state.score = saved.score || 0;
    state.streak = saved.streak || 0;
    state.seen = new Set(saved.seen || []);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function resetProgress() {
  state.score = 0;
  state.streak = 0;
  state.seen = new Set();
  state.round = 1;
  localStorage.removeItem(STORAGE_KEY);
  newRound();
}
