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
const escHint = document.getElementById("escHint");

const backBtn = document.getElementById("backBtn");
const stuckBtn = document.getElementById("stuckBtn");
const recoverBtn = document.getElementById("recoverBtn");
const snoozeBtn = document.getElementById("snoozeBtn");

let shownAt = null;
let currentPayload = null;
let actionLocked = false;

function setControlsEnabled(enabled) {
  const controls = overlay?.querySelectorAll?.("button, input") || [];
  controls.forEach((el) => {
    // Don't re-enable elements that are intentionally disabled by state (e.g., empty submit).
    if (enabled) return;
    el.disabled = true;
  });

  if (enabled) {
    // Re-enable everything, then let stateful logic (like syncAlignSubmitState) disable as needed.
    controls.forEach((el) => {
      el.disabled = false;
    });
    syncAlignSubmitState();
  }
}

function updateHotkeyHints() {
  if (!enterHint || !escHint) return;

  const mode = overlay?.dataset?.mode || "";
  const snoozeOpen = snooze && !snooze.classList.contains("hidden");

  const getHints = window.overlayUtils?.getHotkeyHints;
  if (typeof getHints !== "function") return;

  const { enterHint: enterText, escHint: escText } = getHints({
    mode,
    activeElement: document.activeElement,
    snoozeOpen
  });

  enterHint.textContent = enterText;
  escHint.textContent = escText;
}

function setText(el, value) {
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
  updateHotkeyHints();
}

function resetAlignInput() {
  alignText.value = "";
  // Prevent accidental submits / Enter-to-click on the submit button when empty.
  alignSubmit.disabled = true;
  alignInput.classList.add("hidden");
}

function showOverlay(payload) {
  overlay.classList.remove("hidden");
  actionLocked = false;
  setControlsEnabled(true);
  resetSnooze();
  resetAlignInput();
  if (payload.choices && Array.isArray(payload.choices)) {
    overlay.dataset.mode = "align";
  } else {
    overlay.dataset.mode = "";
  }
  updateHotkeyHints();
  setText(blockName, payload.block_name || "");
  setText(headline, payload.headline || "Reset.");
  setText(humanLine, payload.human_line || "");
  setText(diagnosis, payload.diagnosis || "");
  setText(nextAction, payload.next_action || "");

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

    // Ensure the user can immediately type a custom answer without accidentally
    // confirming "Back on track" via the global Enter hotkey.
    try {
      alignText.focus({ preventScroll: true });
    } catch {
      alignText.focus();
    }
  } else {
    choiceButtons.classList.add("hidden");
    alignInput.classList.add("hidden");
  }

  overlay.dataset.level = payload.level || "B";
  currentPayload = payload;
  shownAt = Date.now();
}

function sendAction(action) {
  if (actionLocked) return;
  actionLocked = true;
  setControlsEnabled(false);

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

function syncAlignSubmitState() {
  alignSubmit.disabled = !alignText.value.trim();
}

alignText.addEventListener("input", syncAlignSubmitState);

alignSubmit.addEventListener("click", () => {
  const value = alignText.value.trim();
  if (!value) return;
  sendAction({ action: "align_choice", value, question_id: currentPayload?.question_id || null });
  alignText.value = "";
  syncAlignSubmitState();
});

alignText.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    // Prevent the global Enter handler from also firing (which would mark "Back on track").
    event.preventDefault();
    event.stopPropagation();
    alignSubmit.click();
  }
});

function openSnoozePanel() {
  snooze.classList.remove("hidden");
  updateHotkeyHints();

  // Keyboard-first: when the snooze panel opens, move focus onto the first
  // reason button so Enter/Space selects a reason (instead of falling back to
  // global overlay hotkeys).
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

  // Keep focus on a safe control so Enter won't accidentally confirm "Back on track".
  if (snoozeBtn) {
    try {
      snoozeBtn.focus({ preventScroll: true });
    } catch {
      snoozeBtn.focus();
    }
  }
}

snoozeBtn.addEventListener("click", () => {
  openSnoozePanel();
});

snooze.addEventListener("click", (event) => {
  const reason = event.target?.dataset?.reason;
  if (reason) {
    sendAction({ action: "snooze", reason, minutes: 5 });
  }
});

window.overlayAPI.onShow((payload) => {
  showOverlay(payload);
});

window.overlayAPI.onPause(() => {
  sendAction({ action: "pause_15" });
});

window.addEventListener("keydown", (event) => {
  if (overlay.classList.contains("hidden")) return;

  const activeElement = document.activeElement;

  // Option B actionable overlay: allow quick 1-9 choice selection (when not typing).
  if (
    overlay.dataset.mode === "align" &&
    snooze.classList.contains("hidden") &&
    currentPayload?.choices &&
    Array.isArray(currentPayload.choices)
  ) {
    const isTyping =
      window.overlayUtils?.isTextInputTarget?.(event.target) ||
      window.overlayUtils?.isTextInputTarget?.(activeElement);

    if (!isTyping) {
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

  // If the snooze panel is open, Escape should close it (quickly reversible).
  if (event.key === "Escape" && !snooze.classList.contains("hidden")) {
    event.preventDefault();
    event.stopPropagation();
    closeSnoozePanel();
    return;
  }

  // Don't treat Enter as "Back on track" while the user is typing.
  const shouldTrigger = window.overlayUtils?.shouldTriggerBackOnTrack;
  if (shouldTrigger && shouldTrigger(event, activeElement, shownAt)) {
    // Capture the key so it doesn't also activate a focused control or "fall through".
    event.preventDefault();
    event.stopPropagation();
    sendAction({ action: "back_on_track" });
    return;
  }

  const shouldTriggerSnooze =
    window.overlayUtils?.shouldTriggerSnooze || window.overlayUtils?.shouldTriggerSnoozeFromKeydown;
  if (shouldTriggerSnooze && shouldTriggerSnooze(event, activeElement, shownAt)) {
    // Capture Escape so it doesn't dismiss/affect other UI unexpectedly.
    event.preventDefault();
    event.stopPropagation();
    openSnoozePanel();
  }
});

document.addEventListener("focusin", () => {
  if (overlay.classList.contains("hidden")) return;
  updateHotkeyHints();
});
