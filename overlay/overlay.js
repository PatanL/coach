const overlay = document.getElementById("overlay");
const blockName = document.getElementById("blockName");
const headline = document.getElementById("headline");
const humanLine = document.getElementById("humanLine");
const diagnosis = document.getElementById("diagnosis");
const nextAction = document.getElementById("nextAction");
const snooze = document.getElementById("snoozeReason");
const miniPlan = document.getElementById("miniPlan");
const choiceButtons = document.getElementById("choiceButtons");
const alignInput = document.getElementById("alignInput");
const alignText = document.getElementById("alignText");
const alignSubmit = document.getElementById("alignSubmit");

const enterHint = document.getElementById("enterHint");
const quickHint = document.getElementById("quickHint");
const escHint = document.getElementById("escHint");
const detailsHint = document.getElementById("detailsHint");

const detailsBtn = document.getElementById("detailsBtn");

const backBtn = document.getElementById("backBtn");
const stuckBtn = document.getElementById("stuckBtn");
const recoverBtn = document.getElementById("recoverBtn");
const snoozeBtn = document.getElementById("snoozeBtn");

let shownAt = null;
let currentPayload = null;
let actionLocked = false;
let detailsOpen = true;

function setText(el, value) {
  if (!el) return;
  el.textContent = value || "";
}

function setControlsEnabled(enabled) {
  const controls = overlay?.querySelectorAll?.("button, input") || [];
  if (!enabled) {
    controls.forEach((el) => {
      el.disabled = true;
    });
    return;
  }

  controls.forEach((el) => {
    el.disabled = false;
  });
  syncAlignSubmitState();
}

function updatePrimaryLabel(payload) {
  if (payload?.block_id && String(payload.block_id).includes("habit")) {
    backBtn.textContent = "Habit completed";
    return;
  }
  backBtn.textContent = "Back on track";
}

function updateHotkeyHints() {
  if (!enterHint || !escHint) return;

  const mode = overlay?.dataset?.mode || "";
  const snoozeOpen = snooze && !snooze.classList.contains("hidden");
  const getHints = window.overlayUtils?.getHotkeyHints;
  if (typeof getHints !== "function") return;

  const { enterHint: enterText, quickHint: quickText, escHint: escText } = getHints({
    mode,
    activeElement: document.activeElement,
    snoozeOpen
  });

  enterHint.textContent = enterText;
  escHint.textContent = escText;

  if (quickHint) {
    quickHint.hidden = !quickText;
    if (quickText) quickHint.textContent = quickText;
  }

  if (detailsHint) {
    const isTyping = typeof window.overlayUtils?.isTextInputTarget === "function"
      ? window.overlayUtils.isTextInputTarget(document.activeElement)
      : false;

    detailsHint.hidden = !detailsBtn || detailsBtn.hidden || isTyping;
  }
}

function resetSnooze() {
  snooze.classList.add("hidden");
  updateHotkeyHints();
}

function syncAlignSubmitState() {
  alignSubmit.disabled = !alignText.value.trim();
}

function resetAlignInput() {
  alignText.value = "";
  // Prevent accidental submits / Enter-to-click on the submit button when empty.
  alignSubmit.disabled = true;
  alignInput.classList.add("hidden");
}

function setDetailsOpen(nextOpen) {
  detailsOpen = Boolean(nextOpen);

  // Use hidden class so the layout tightens when collapsed.
  if (diagnosis) diagnosis.classList.toggle("hidden", !detailsOpen);
  if (nextAction) nextAction.classList.toggle("hidden", !detailsOpen);

  if (detailsBtn) {
    detailsBtn.textContent = detailsOpen ? "Hide" : "Why?";
  }

  updateHotkeyHints();
}

function configureDetails(payload) {
  const hasDiagnosis = Boolean((payload?.diagnosis || "").trim());
  const hasNextAction = Boolean((payload?.next_action || "").trim());
  const hasDetails = hasDiagnosis || hasNextAction;

  if (!detailsBtn) return;

  detailsBtn.hidden = !hasDetails;

  if (!hasDetails) {
    detailsOpen = false;
    if (diagnosis) diagnosis.classList.add("hidden");
    if (nextAction) nextAction.classList.add("hidden");
    if (detailsHint) detailsHint.hidden = true;
    return;
  }

  // Preserve existing behavior: default to expanded.
  setDetailsOpen(true);
}

function showOverlay(payload) {
  overlay.classList.remove("hidden");
  actionLocked = false;
  setControlsEnabled(true);

  updatePrimaryLabel(payload);
  resetSnooze();
  resetAlignInput();

  overlay.dataset.mode = payload.choices && Array.isArray(payload.choices) ? "align" : "";
  overlay.dataset.level = payload.level || "B";

  setText(blockName, payload.block_name || "");
  setText(headline, payload.headline || "Reset.");
  setText(humanLine, payload.human_line || "");
  setText(diagnosis, payload.diagnosis || "");
  setText(nextAction, payload.next_action || "");
  configureDetails(payload);

  if (payload.level === "C") {
    miniPlan.classList.remove("hidden");
    setText(miniPlan, payload.mini_plan || "");
  } else {
    miniPlan.classList.add("hidden");
  }

  if (payload.choices && Array.isArray(payload.choices)) {
    choiceButtons.innerHTML = "";
    payload.choices.forEach((choice, index) => {
      const button = document.createElement("button");
      const prefix = index < 9 ? `${index + 1}. ` : "";
      button.textContent = `${prefix}${choice}`;
      button.addEventListener("click", () => {
        sendAction({ action: "align_choice", value: choice, question_id: currentPayload?.question_id || null });
      });
      choiceButtons.appendChild(button);
    });
    choiceButtons.classList.remove("hidden");
    alignInput.classList.remove("hidden");

    // Keyboard-first: start focus in the custom answer box.
    try {
      alignText.focus({ preventScroll: true });
    } catch {
      alignText.focus();
    }
  } else {
    choiceButtons.classList.add("hidden");
    alignInput.classList.add("hidden");

    // When not in align mode, keep focus on the primary action.
    try {
      backBtn.focus({ preventScroll: true });
    } catch {
      backBtn.focus();
    }
  }

  updateHotkeyHints();

  currentPayload = payload;
  shownAt = Date.now();
}

function sendAction(action) {
  if (actionLocked) return;
  actionLocked = true;
  setControlsEnabled(false);

  const timeToAction = shownAt ? Date.now() - shownAt : 0;
  window.overlayAPI?.sendAction?.({
    ...action,
    time_to_action_ms: timeToAction,
    cmd_id: currentPayload?.cmd_id || null,
    block_id: currentPayload?.block_id || null,
    level: currentPayload?.level || null,
    headline: currentPayload?.headline || null
  });
}

function openSnoozePanel() {
  snooze.classList.remove("hidden");
  updateHotkeyHints();

  // Move focus onto the first reason button so Enter/Space selects a reason.
  const firstReasonButton = snooze.querySelector("button[data-reason]");
  if (firstReasonButton) {
    try {
      firstReasonButton.focus({ preventScroll: true });
    } catch {
      firstReasonButton.focus();
    }
  }
}

function closeSnoozePanel() {
  snooze.classList.add("hidden");
  updateHotkeyHints();

  // Return focus to the primary action.
  if (backBtn) {
    try {
      backBtn.focus({ preventScroll: true });
    } catch {
      backBtn.focus();
    }
  }
}

backBtn.addEventListener("click", () => sendAction({ action: "back_on_track" }));
stuckBtn.addEventListener("click", () => sendAction({ action: "stuck" }));
recoverBtn.addEventListener("click", () => sendAction({ action: "recover" }));

if (detailsBtn) {
  detailsBtn.addEventListener("click", () => {
    if (detailsBtn.hidden) return;
    setDetailsOpen(!detailsOpen);
  });
}

alignText.addEventListener("input", () => {
  syncAlignSubmitState();
  updateHotkeyHints();
});

alignSubmit.addEventListener("click", () => {
  const value = alignText.value.trim();
  if (!value) return;
  sendAction({ action: "align_choice", value, question_id: currentPayload?.question_id || null });
  alignText.value = "";
  syncAlignSubmitState();
  updateHotkeyHints();
});

alignText.addEventListener("keydown", (event) => {
  const shouldSubmit = window.overlayUtils?.shouldTriggerAlignSubmitFromKeydown;
  if (typeof shouldSubmit === "function" ? shouldSubmit(event) : event.key === "Enter") {
    // Prevent the global Enter handler from also firing.
    event.preventDefault();
    event.stopPropagation();

    // Avoid relying on disabled-button click semantics.
    const value = alignText.value.trim();
    if (!value) return;

    sendAction({ action: "align_choice", value, question_id: currentPayload?.question_id || null });
    alignText.value = "";
    syncAlignSubmitState();
    updateHotkeyHints();
  }
});

snoozeBtn.addEventListener("click", () => {
  // Toggle behavior: if the snooze panel is already open, clicking Snooze closes it.
  // This reduces friction and matches the Escape-to-close affordance.
  if (snooze && !snooze.classList.contains("hidden")) {
    closeSnoozePanel();
    return;
  }

  openSnoozePanel();
});

snooze.addEventListener("click", (event) => {
  const reason = event.target?.dataset?.reason;
  if (reason) {
    sendAction({ action: "snooze", reason, minutes: 5 });
  }
});

function isWithin(container, target) {
  if (!container || !target) return false;
  if (container === target) return true;
  return typeof container.contains === "function" ? container.contains(target) : false;
}

// UX: when the snooze panel is open, clicking elsewhere should close it.
// (This avoids a "modal trap" and makes recovery faster.)
document.addEventListener("click", (event) => {
  if (overlay.classList.contains("hidden")) return;
  if (snooze.classList.contains("hidden")) return;

  const target = event.target;

  // Ignore clicks inside the snooze panel (including reason buttons).
  if (isWithin(snooze, target)) return;

  // Ignore clicks on the Snooze button itself (it toggles/open behavior).
  if (isWithin(snoozeBtn, target)) return;

  closeSnoozePanel();
});

window.overlayAPI?.onShow?.((payload) => {
  showOverlay(payload);
});

window.overlayAPI?.onPause?.(() => {
  sendAction({ action: "pause_15" });
});

window.addEventListener("keydown", (event) => {
  if (overlay.classList.contains("hidden")) return;

  const activeElement = document.activeElement;
  const mode = overlay.dataset.mode || "";

  // "?" toggles extra context (why/next action) when available.
  const shouldToggleDetails = window.overlayUtils?.shouldTriggerDetailsToggleFromKeydown;
  if (
    typeof shouldToggleDetails === "function" &&
    shouldToggleDetails(event, activeElement) &&
    detailsBtn &&
    !detailsBtn.hidden
  ) {
    event.preventDefault();
    event.stopPropagation();
    setDetailsOpen(!detailsOpen);
    return;
  }

  // Option B actionable overlay: allow quick 1-9 choice selection (when not typing).
  if (mode === "align" && snooze.classList.contains("hidden")) {
    const shouldTriggerChoice = window.overlayUtils?.shouldTriggerChoiceFromKeydown;
    if (
      typeof shouldTriggerChoice === "function" &&
      shouldTriggerChoice(event, activeElement) &&
      Array.isArray(currentPayload?.choices)
    ) {
      const index = window.overlayUtils?.choiceIndexFromKey?.(event.key);
      const choice = index != null ? currentPayload.choices[index] : null;
      if (choice) {
        event.preventDefault();
        event.stopPropagation();
        sendAction({ action: "align_choice", value: choice, question_id: currentPayload?.question_id || null });
        return;
      }
    }
  }

  // If the snooze panel is open, Escape should close it.
  if (event.key === "Escape" && !snooze.classList.contains("hidden")) {
    event.preventDefault();
    event.stopPropagation();
    closeSnoozePanel();
    return;
  }

  // Escape opens snooze when safe.
  const shouldTriggerSnooze = window.overlayUtils?.shouldTriggerSnooze;
  if (typeof shouldTriggerSnooze === "function" && shouldTriggerSnooze(event, activeElement, shownAt)) {
    event.preventDefault();
    event.stopPropagation();
    openSnoozePanel();
    return;
  }

  // Enter confirms "Back on track" only when safe, and never in align mode.
  const shouldTriggerBackInMode = window.overlayUtils?.shouldTriggerBackOnTrackInMode;
  if (
    typeof shouldTriggerBackInMode === "function" &&
    shouldTriggerBackInMode(mode, event, activeElement, shownAt)
  ) {
    event.preventDefault();
    event.stopPropagation();
    sendAction({ action: "back_on_track" });
  }
});

document.addEventListener("focusin", () => {
  if (overlay.classList.contains("hidden")) return;
  updateHotkeyHints();
});

// Test/screenshot harness hook (safe no-op in production).
window.__overlayShow = showOverlay;
