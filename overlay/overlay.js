const overlay = document.getElementById("overlay");
const label = document.getElementById("label");
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

const twoMinPanel = document.getElementById("twoMinPanel");
const twoMinChoices = document.getElementById("twoMinChoices");
const twoMinText = document.getElementById("twoMinText");
const twoMinSubmit = document.getElementById("twoMinSubmit");
const hintEnter = document.getElementById("hintEnter");
const hintRecover = document.getElementById("hintRecover");
const hintUndo = document.getElementById("hintUndo");

const backBtn = document.getElementById("backBtn");
const pauseBtn = document.getElementById("pauseBtn");
const twoMinBtn = document.getElementById("twoMinBtn");
const stuckBtn = document.getElementById("stuckBtn");
const recoverBtn = document.getElementById("recoverBtn");
const undoRecoverBtn = document.getElementById("undoRecoverBtn");
const snoozeBtn = document.getElementById("snoozeBtn");

let shownAt = null;
let currentPayload = null;

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
}

function resetAlignInput() {
  alignText.value = "";
  alignInput.classList.add("hidden");
}

function resetTwoMin() {
  if (!twoMinPanel) return;
  twoMinPanel.classList.add("hidden");
  twoMinChoices.innerHTML = "";
  twoMinText.value = "";
}

function showTwoMin(choices) {
  const defaults = ["Open TODO + pick 1 task", "Write 1 sentence", "Run the next command", "Close distraction tab"];
  const list = Array.isArray(choices) && choices.length ? choices : defaults;

  twoMinChoices.innerHTML = "";
  list.forEach((choice) => {
    const button = document.createElement("button");
    button.textContent = choice;
    button.addEventListener("click", () => {
      const value = window.overlayUtils?.normalizeTwoMinuteStep?.(choice);
      sendAction({ action: "two_min_step", value, kind: "choice" });
    });
    twoMinChoices.appendChild(button);
  });
  twoMinPanel.classList.remove("hidden");
  twoMinText.focus();
}

function updateFooterHints() {
  // Keep footer hints honest: only show shortcuts that are currently available.
  const isAlign = overlay.dataset.mode === "align";
  if (hintRecover) {
    const recoverAvailable = recoverBtn && !recoverBtn.classList.contains("hidden");
    hintRecover.classList.toggle("hidden", isAlign || !recoverAvailable);
  }
  if (hintUndo) {
    const undoAvailable = undoRecoverBtn && !undoRecoverBtn.classList.contains("hidden");
    hintUndo.classList.toggle("hidden", isAlign || !undoAvailable);
  }
}

function showOverlay(payload) {
  overlay.classList.remove("hidden");
  resetSnooze();
  resetAlignInput();
  resetTwoMin();
  if (payload.choices && Array.isArray(payload.choices)) {
    overlay.dataset.mode = "align";
  } else {
    overlay.dataset.mode = "";
  }
  // Update keyboard hint to reflect current mode
  if (hintEnter) {
    hintEnter.textContent = (window.overlayUtils && window.overlayUtils.enterHintForState)
      ? window.overlayUtils.enterHintForState({ mode: overlay.dataset.mode, twoMinOpen: false })
      : "Enter: Back on track";
  }
  // Dynamic header label for clarity (RECOVER / ALIGN / DRIFT)
  if (label) {
    const computed = (window.overlayUtils && window.overlayUtils.labelForPayload)
      ? window.overlayUtils.labelForPayload({
          mode: overlay.dataset.mode,
          canUndoRecover: Boolean(payload?.can_undo_recover),
          customLabel: payload?.label
        })
      : (payload?.can_undo_recover ? "RECOVER" : (overlay.dataset.mode === "align" ? "ALIGN" : "DRIFT"));
    label.textContent = computed;
  }
  setText(blockName, payload.block_name || "");
  setText(headline, payload.headline || "Reset.");
  setText(humanLine, payload.human_line || "");
  setText(diagnosis, payload.diagnosis || "");
  setText(nextAction, payload.next_action || "");

  // Keep the primary action label context-sensitive (habits vs. focus blocks).
  updatePrimaryLabel(payload);

  // Recovery overlays should be reversible: show an explicit undo affordance.
  if (payload?.can_undo_recover) {
    undoRecoverBtn?.classList.remove("hidden");
    recoverBtn?.classList.add("hidden");
  } else {
    undoRecoverBtn?.classList.add("hidden");
    recoverBtn?.classList.remove("hidden");
  }

  updateFooterHints();

  if (payload.level === "C") {
    miniPlan.classList.remove("hidden");
    setText(miniPlan, payload.mini_plan || "");
  } else {
    miniPlan.classList.add("hidden");
  }

  if (payload.choices && Array.isArray(payload.choices)) {
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

  overlay.dataset.level = payload.level || "B";
  currentPayload = payload;
  shownAt = Date.now();
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
pauseBtn.addEventListener("click", () => sendAction({ action: "pause_15", minutes: 15 }));
twoMinBtn.addEventListener("click", () => {
  if (twoMinPanel.classList.contains("hidden")) {
    showTwoMin(currentPayload?.two_min_choices);
  } else {
    resetTwoMin();
  }
  if (hintEnter) {
    const twoMinOpen = twoMinPanel && !twoMinPanel.classList.contains("hidden");
    hintEnter.textContent = (window.overlayUtils && window.overlayUtils.enterHintForState)
      ? window.overlayUtils.enterHintForState({ mode: overlay.dataset.mode, twoMinOpen })
      : (twoMinOpen ? "Enter: Set 2‑min step" : "Enter: Back on track");
  }
});
stuckBtn.addEventListener("click", () => sendAction({ action: "stuck" }));
recoverBtn.addEventListener("click", () => sendAction({ action: "recover" }));
undoRecoverBtn?.addEventListener("click", () => sendAction({ action: "undo_recover" }));

alignSubmit.addEventListener("click", () => {
  const value = window.overlayUtils?.normalizeFreeform?.(alignText.value, { maxLen: 240 }) ?? alignText.value.trim();
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

twoMinSubmit.addEventListener("click", () => {
  const value = window.overlayUtils?.normalizeTwoMinuteStep?.(twoMinText.value);
  if (!value) return;
  sendAction({ action: "two_min_step", value, kind: "custom" });
});

twoMinText.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    event.stopPropagation();
    twoMinSubmit.click();
  }
});

function toggleSnooze(show) {
  const isHidden = snooze.classList.contains("hidden");
  const shouldShow = typeof show === "boolean" ? show : isHidden;
  snooze.classList.toggle("hidden", !shouldShow);
}

snoozeBtn.addEventListener("click", () => {
  toggleSnooze();
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

function updateEnterHint() {
  if (!hintEnter) return;
  const twoMinOpen = twoMinPanel && !twoMinPanel.classList.contains("hidden");
  hintEnter.textContent = (window.overlayUtils && window.overlayUtils.enterHintForState)
    ? window.overlayUtils.enterHintForState({ mode: overlay.dataset.mode, twoMinOpen })
    : (twoMinOpen ? "Enter: Set 2‑min step" : (overlay.dataset.mode === "align" ? "Enter: Submit answer" : "Enter: Back on track"));
}

window.addEventListener("keydown", (event) => {
  if (overlay.classList.contains("hidden")) return;

  // Keyboard shortcuts
  // - Enter: Back on track (guarded to avoid accidental actions while typing)
  // - Cmd/Ctrl+Shift+P: Pause 15 (matches footer hint)
  // - Escape: Close panels / Snooze
  // - R: Recover schedule; U: Undo recover (when available)
  // - 2 or T: Toggle 2‑min step panel
  // - K: I'm stuck

  const pauseShortcut = window.overlayUtils?.isPauseShortcut?.(event);
  if (pauseShortcut) {
    event.preventDefault();
    event.stopPropagation();
    sendAction({ action: "pause_15", minutes: 15 });
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();

    if (!snooze.classList.contains("hidden")) {
      toggleSnooze(false);
      updateEnterHint();
      return;
    }

    if (twoMinPanel && !twoMinPanel.classList.contains("hidden")) {
      resetTwoMin();
      updateEnterHint();
      return;
    }

    toggleSnooze(true);
    updateEnterHint();
    return;
  }

  // Reduce accidental recoveries:
  // - never treat Enter as "Back on track" while typing
  // - also disable the global Enter shortcut during the align + 2-min flows
  if (event.key === "Enter") {
    const shouldTrigger = window.overlayUtils?.shouldTriggerBackOnTrackOnEnter?.({
      target: event.target,
      mode: overlay.dataset.mode,
      twoMinOpen: twoMinPanel && !twoMinPanel.classList.contains("hidden")
    });
    if (shouldTrigger) {
      sendAction({ action: "back_on_track" });
    }
  }

  // Single-letter shortcuts (opt-in, low-risk):
  // - ignore while typing
  // - ignore when modifiers are down (avoid clobbering app/browser shortcuts)
  // - disable during align flow (except Escape handled above)
  if (overlay.dataset.mode !== "align") {
    const isTyping = window.overlayUtils?.isTextInputTarget?.(event.target);
    const hasModifier = Boolean(event.metaKey || event.ctrlKey || event.altKey);
    if (!isTyping && !hasModifier) {
      const key = String(event.key || "").toLowerCase();

      if (key === "r" && recoverBtn && !recoverBtn.classList.contains("hidden")) {
        event.preventDefault();
        event.stopPropagation();
        recoverBtn.click();
      }

      if (key === "u" && undoRecoverBtn && !undoRecoverBtn.classList.contains("hidden")) {
        event.preventDefault();
        event.stopPropagation();
        undoRecoverBtn.click();
      }

      if ((key === "2" || key === "t") && twoMinBtn) {
        event.preventDefault();
        event.stopPropagation();
        twoMinBtn.click();
      }

      if (key === "k" && stuckBtn) {
        event.preventDefault();
        event.stopPropagation();
        stuckBtn.click();
      }

      if (key === "s" && snoozeBtn) {
        event.preventDefault();
        event.stopPropagation();
        snoozeBtn.click();
      }
    }
  }

  updateEnterHint();
});
