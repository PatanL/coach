const overlay = document.getElementById("overlay");
const blockName = document.getElementById("blockName");
const eventLabel = document.getElementById("eventLabel");
const headline = document.getElementById("headline");
const humanLine = document.getElementById("humanLine");
const diagnosis = document.getElementById("diagnosis");
const nextAction = document.getElementById("nextAction");
const snooze = document.getElementById("snoozeReason");
const miniPlan = document.getElementById("miniPlan");
const choiceButtons = document.getElementById("choiceButtons");
const alignInput = document.getElementById("alignInput");
const primaryHotkey = document.getElementById("primaryHotkey");
const alignText = document.getElementById("alignText");
const alignSubmit = document.getElementById("alignSubmit");

const backBtn = document.getElementById("backBtn");
const stuckBtn = document.getElementById("stuckBtn");
const recoverBtn = document.getElementById("recoverBtn");
const snoozeBtn = document.getElementById("snoozeBtn");

let shownAt = null;
let currentPayload = null;

function setText(el, value) {
  if (!el) return;
  el.textContent = value || "";
}

function updatePrimaryLabel(payload) {
  if (payload?.block_id && String(payload.block_id).includes("habit")) {
    backBtn.textContent = "Habit completed";
    return;
  }
  backBtn.textContent = "Back on track";
}

function resetSnooze() {
  snooze.classList.add("hidden");
}

function resetAlignInput() {
  alignText.value = "";
  alignInput.classList.add("hidden");
}

function isPatternBreak(payload) {
  if (!payload) return false;
  if (payload.style_id === "pattern_break") return true;
  return window.overlayUtils?.isPatternBreakEvent?.(payload.event_type) || false;
}

function showOverlay(payload) {
  overlay.classList.remove("hidden");
  resetSnooze();
  resetAlignInput();

  overlay.dataset.styleId = payload?.style_id || "";
  overlay.dataset.eventType = payload?.event_type || "";

  const patternBreak = isPatternBreak(payload);
  overlay.classList.toggle("pattern-break", Boolean(patternBreak));
  setText(eventLabel, patternBreak ? "DRIFT (PERSIST)" : "DRIFT");

  // Pattern-break should feel different and more "do an action now".
  backBtn.classList.toggle("primary", !patternBreak);
  recoverBtn.classList.toggle("primary", Boolean(patternBreak));

  const enterAction =
    window.overlayUtils?.primaryEnterAction?.(payload?.event_type) || (patternBreak ? "recover" : "back_on_track");
  setText(
    primaryHotkey,
    enterAction === "recover" ? "Enter: Recover schedule (after 0.4s)" : "Enter: Back on track (after 0.4s)"
  );

  if (payload?.choices && Array.isArray(payload.choices)) {
    overlay.dataset.mode = "align";
  } else {
    overlay.dataset.mode = "";
  }

  updatePrimaryLabel(payload);
  setText(blockName, payload?.block_name || "");
  setText(headline, payload?.headline || "Reset.");
  setText(humanLine, payload?.human_line || "");
  setText(diagnosis, payload?.diagnosis || "");
  setText(nextAction, payload?.next_action || "");

  if (payload?.level === "C") {
    miniPlan.classList.remove("hidden");
    setText(miniPlan, payload?.mini_plan || "");
  } else {
    miniPlan.classList.add("hidden");
  }

  if (payload?.choices && Array.isArray(payload.choices)) {
    choiceButtons.innerHTML = "";
    payload.choices.forEach((choice) => {
      const button = document.createElement("button");
      button.textContent = choice;
      button.addEventListener("click", () => {
        sendAction({ action: "align_choice", value: choice, question_id: currentPayload?.question_id || null });
      });
      choiceButtons.appendChild(button);
    });
    choiceButtons.classList.remove("hidden");
    alignInput.classList.remove("hidden");
  } else {
    choiceButtons.classList.add("hidden");
    alignInput.classList.add("hidden");
  }

  overlay.dataset.level = payload?.level || "B";
  currentPayload = payload;
  shownAt = Date.now();

  // Keyboard-first recovery: put focus on the most relevant control.
  // Skip in deterministic screenshot mode to avoid focus-ring changes in assets.
  const screenshotMode = document.documentElement?.dataset?.screenshot === "1";
  if (!screenshotMode) {
    const hasChoices = Boolean(payload?.choices);
    const focusEl = hasChoices
      ? alignText
      : enterAction === "recover"
        ? recoverBtn
        : backBtn;

    // Avoid the "held Enter" problem: if we focus a button immediately, the browser can
    // treat the held key as an immediate click, bypassing our safety window.
    const focusDelayMs =
      window.overlayUtils?.initialFocusDelayMs?.({ hasChoices, minDelayMs: 400 }) ?? (hasChoices ? 0 : 400);

    setTimeout(() => focusEl?.focus?.(), focusDelayMs);
  }
}

function sendAction(action) {
  const timeToAction = shownAt ? Date.now() - shownAt : 0;
  window.overlayAPI.sendAction({
    ...action,
    time_to_action_ms: timeToAction,
    cmd_id: currentPayload?.cmd_id || null,
    block_id: currentPayload?.block_id || null,
    level: currentPayload?.level || null,
    headline: currentPayload?.headline || null
  });
}

backBtn.addEventListener("click", () => sendAction({ action: "back_on_track" }));
stuckBtn.addEventListener("click", () => sendAction({ action: "stuck" }));
recoverBtn.addEventListener("click", () => sendAction({ action: "recover" }));

alignSubmit.addEventListener("click", () => {
  const value = alignText.value.trim();
  if (!value) return;
  sendAction({ action: "align_choice", value, question_id: currentPayload?.question_id || null });
  alignText.value = "";
});

alignText.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    // Prevent the global Enter handler from also firing (which would mark "Back on track").
    event.preventDefault();
    event.stopPropagation();
    alignSubmit.click();
  }
});

snoozeBtn.addEventListener("click", () => {
  snooze.classList.remove("hidden");
});

snooze.addEventListener("click", (event) => {
  const reason = event.target?.dataset?.reason;
  if (reason) {
    sendAction({ action: "snooze", reason, minutes: 5 });
  }
});

if (window.overlayAPI?.onShow) {
  window.overlayAPI.onShow((payload) => {
    showOverlay(payload);
  });
}

if (window.overlayAPI?.onPause) {
  window.overlayAPI.onPause(() => {
    sendAction({ action: "pause_15" });
  });
}

// Test/screenshot harness: allow a deterministic runner to show the overlay without IPC.
window.__overlayOnShow = showOverlay;

window.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    // If an input handler already consumed this, don't also run the global fallback.
    if (event.defaultPrevented) return;

    const sinceShownMs = shownAt ? Date.now() - shownAt : null;
    const shouldTrigger = window.overlayUtils?.shouldTriggerBackOnTrack?.({
      eventTarget: event.target,
      activeElement: document.activeElement,
      sinceShownMs,
      minDelayMs: 400
    });
    if (shouldTrigger) {
      const enterAction = window.overlayUtils?.primaryEnterAction?.(currentPayload?.event_type) || "back_on_track";
      sendAction({ action: enterAction });
    }
  }
  if (event.key === "Escape") {
    snooze.classList.remove("hidden");
  }
});
