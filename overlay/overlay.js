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
const hintRelaunch = document.getElementById("hintRelaunch");

const backBtn = document.getElementById("backBtn");
const pauseBtn = document.getElementById("pauseBtn");
const twoMinBtn = document.getElementById("twoMinBtn");
const stuckBtn = document.getElementById("stuckBtn");
const recoverBtn = document.getElementById("recoverBtn");
const undoRecoverBtn = document.getElementById("undoRecoverBtn");
const snoozeBtn = document.getElementById("snoozeBtn");
const copyDiagBtn = document.getElementById("copyDiagBtn");
const relaunchBtn = document.getElementById("relaunchBtn");

let shownAt = null;
let currentPayload = null;
let overlayBusy = false;

// Guard against accidental "Recover" clicks / hotkeys.
// First click arms recover; second click confirms.
let recoverArmed = false;
let recoverArmTimer = null;

const DEFAULT_BUTTON_TEXT = {
  back: backBtn?.textContent || "Back on track",
  pause: pauseBtn?.textContent || "Pause 15",
  twoMin: twoMinBtn?.textContent || "2‑min step",
  stuck: stuckBtn?.textContent || "I'm stuck",
  recover: recoverBtn?.textContent || "Recover schedule",
  undoRecover: undoRecoverBtn?.textContent || "Undo recover",
  snooze: snoozeBtn?.textContent || "Snooze"
};

function setButtonsBusy(isBusy) {
  // Keep copy/relaunch available even while other actions are busy so users
  // can still recover during renderer issues (Apple Silicon actionable recovery).
  const buttons = [backBtn, pauseBtn, twoMinBtn, stuckBtn, recoverBtn, undoRecoverBtn, snoozeBtn];
  buttons.forEach((btn) => {
    if (!btn) return;
    btn.disabled = Boolean(isBusy);
  });
  overlayBusy = Boolean(isBusy);
  if (overlay) overlay.setAttribute("aria-busy", overlayBusy ? "true" : "false");
}

function resetButtonStates() {
  setButtonsBusy(false);
  if (backBtn) backBtn.textContent = DEFAULT_BUTTON_TEXT.back;
  if (pauseBtn) pauseBtn.textContent = DEFAULT_BUTTON_TEXT.pause;
  if (twoMinBtn) twoMinBtn.textContent = DEFAULT_BUTTON_TEXT.twoMin;
  if (stuckBtn) stuckBtn.textContent = DEFAULT_BUTTON_TEXT.stuck;
  if (recoverBtn) recoverBtn.textContent = DEFAULT_BUTTON_TEXT.recover;
  if (undoRecoverBtn) undoRecoverBtn.textContent = DEFAULT_BUTTON_TEXT.undoRecover;
  if (snoozeBtn) snoozeBtn.textContent = DEFAULT_BUTTON_TEXT.snooze;
  resetRecoverArm();
}

function resetRecoverArm() {
  recoverArmed = false;
  if (recoverBtn) recoverBtn.textContent = DEFAULT_BUTTON_TEXT.recover;
  updateRecoverArmUI();
  if (recoverArmTimer) {
    clearTimeout(recoverArmTimer);
    recoverArmTimer = null;
  }
}

function armRecover() {
  recoverArmed = true;
  if (recoverBtn) recoverBtn.textContent = "Confirm recover";
  updateRecoverArmUI();
  if (recoverArmTimer) clearTimeout(recoverArmTimer);
  recoverArmTimer = setTimeout(() => {
    resetRecoverArm();
  }, 8000);
}



function refreshHeaderLabel() {
  if (!label) return;
  const computed = (window.overlayUtils && window.overlayUtils.labelForOverlayState)
    ? window.overlayUtils.labelForOverlayState({
        mode: overlay?.dataset?.mode,
        canUndoRecover: Boolean(currentPayload?.can_undo_recover),
        customLabel: currentPayload?.label,
        recoverArmed
      })
    : (recoverArmed ? "CONFIRM" : (currentPayload?.can_undo_recover ? "RECOVERED" : (overlay?.dataset?.mode === "align" ? "ALIGN" : "DRIFT")));
  label.textContent = computed;
}

function updateRecoverArmUI() {
  // Keep the recovery hint honest: when recover is armed, the next press confirms.
  if (hintRecover) {
    hintRecover.textContent = recoverArmed ? "R: Confirm" : "R: Recover";
  }

  // Add an explicit visual + accessibility affordance when recover is armed.
  // This reduces accidental recoveries by making the "confirm" state unmissable.
  if (recoverBtn) {
    recoverBtn.classList.toggle("armed", recoverArmed);
    recoverBtn.setAttribute("aria-pressed", recoverArmed ? "true" : "false");
    // Keep screen readers aligned with the two-step confirm state.
    try {
      const aria = (window.overlayUtils && typeof window.overlayUtils.recoverAriaLabel === 'function')
        ? window.overlayUtils.recoverAriaLabel({ armed: recoverArmed })
        : (recoverArmed ? 'Confirm recover' : 'Recover schedule');
      recoverBtn.setAttribute('aria-label', aria);
    } catch (_e) {
      // noop
    }
  }

  // Also reflect the confirm state in the header label so it's unmissable.
  refreshHeaderLabel();

  // Keep the Enter hint honest as the recover arm state changes.
  // (Arming recover is a primary "actionable recovery" path.)
  updateEnterHint();
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
  updateRecoverArmUI();
}

function showOverlay(payload) {
  overlay.classList.remove("hidden");
  resetSnooze();
  resetAlignInput();
  resetTwoMin();
  resetButtonStates();
  overlay.setAttribute("aria-busy", "false");
  if (payload.choices && Array.isArray(payload.choices)) {
    overlay.dataset.mode = "align";
  } else {
    overlay.dataset.mode = "";
  }
  // Update keyboard hint to reflect current mode
  if (hintEnter) {
    hintEnter.textContent = (window.overlayUtils && window.overlayUtils.enterHintForState)
      ? window.overlayUtils.enterHintForState({ mode: overlay.dataset.mode, twoMinOpen: false, recoverArmed })
      : (recoverArmed ? "Enter: Confirm" : "Enter: Back on track");
  }
  // Dynamic header label for clarity (DRIFT / ALIGN / RECOVERED / CONFIRM)
  currentPayload = payload;
  refreshHeaderLabel();
  setText(blockName, payload.block_name || "");
  // Hide the block label when empty so the header doesn't show a stray placeholder.
  if (blockName) {
    const hasBlock = Boolean(String(payload.block_name || "").trim());
    blockName.classList.toggle("hidden", !hasBlock);
  }
  setText(headline, payload.headline || "Reset.");
  setText(humanLine, payload.human_line || "");
  setText(diagnosis, payload.diagnosis || "");
  setText(nextAction, payload.next_action || "");

  // Actionable recovery on Apple Silicon: when the overlay payload itself is an
  // error, provide an explicit relaunch affordance (in addition to auto-rehydrate).
  if (relaunchBtn) {
    const sys = (window.overlayAPI && typeof window.overlayAPI.getSystemInfo === 'function')
      ? window.overlayAPI.getSystemInfo()
      : { platform: 'unknown', arch: 'unknown' };

    const shouldShowRelaunch = (window.overlayUtils && typeof window.overlayUtils.shouldShowRelaunchButton === 'function')
      ? window.overlayUtils.shouldShowRelaunchButton({ env: sys, payload })
      : (sys.platform === 'darwin' && (sys.arch === 'arm64' || sys.arch === 'arm64e') && String(payload.headline || '') === 'Overlay data error');

    relaunchBtn.classList.toggle('hidden', !shouldShowRelaunch);

    // Surface a clear shortcut hint alongside the button for faster recovery.
    if (hintRelaunch) {
      hintRelaunch.classList.toggle('hidden', !shouldShowRelaunch);
    }
  }

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

  // Set an explicit focus target so keyboard shortcuts are predictable.
  // - Align mode: focus the text input so users can type immediately.
  // - Otherwise: focus the primary action button.
  requestAnimationFrame(() => {
    if (overlay.dataset.mode === "align") {
      alignText?.focus();
    } else {
      backBtn?.focus();
    }
  });
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

function buildDiagnosticsText() {
  const sys = (window.overlayAPI && typeof window.overlayAPI.getSystemInfo === 'function')
    ? window.overlayAPI.getSystemInfo()
    : { platform: 'unknown', arch: 'unknown', versions: {} };
  const payload = currentPayload || {};
  const lines = [];
  lines.push('[Coach Overlay Diagnostics]');
  lines.push(`Time: ${new Date().toISOString()}`);
  lines.push(`Platform: ${sys.platform}`);
  lines.push(`Arch: ${sys.arch}`);
  const v = sys.versions || {};
  lines.push(`Electron: ${v.electron || ''}`);
  lines.push(`Chrome: ${v.chrome || ''}`);
  lines.push(`Node: ${v.node || ''}`);
  lines.push('--- UI State ---');
  lines.push(`OverlayHidden: ${overlay?.classList?.contains('hidden') ? 'true' : 'false'}`);
  lines.push(`Mode: ${overlay?.dataset?.mode || ''}`);
  lines.push(`Busy: ${overlayBusy ? 'true' : 'false'}`);
  lines.push(`RecoverArmed: ${recoverArmed ? 'true' : 'false'}`);
  lines.push(`TwoMinOpen: ${twoMinPanel && !twoMinPanel.classList.contains('hidden') ? 'true' : 'false'}`);
  lines.push(`SnoozeOpen: ${snooze && !snooze.classList.contains('hidden') ? 'true' : 'false'}`);
  lines.push('--- Payload ---');
  lines.push(`Level: ${payload.level || ''}`);
  lines.push(`Headline: ${payload.headline || ''}`);
  lines.push(`Block: ${payload.block_name || ''} (${payload.block_id || ''})`);
  lines.push(`CmdId: ${payload.cmd_id || ''}`);
  lines.push(`SourceEventId: ${payload.source_event_id || ''}`);
  if (payload.diagnosis) lines.push(`Diagnosis: ${payload.diagnosis}`);
  if (payload.next_action) lines.push(`Next: ${payload.next_action}`);
  return lines.join('\n');
}

backBtn.addEventListener("click", () => {
  if (backBtn.disabled) return;
  resetRecoverArm();
  backBtn.textContent = "Logging…";
  setButtonsBusy(true);
  sendAction({ action: "back_on_track" });
});

pauseBtn.addEventListener("click", () => {
  if (pauseBtn.disabled) return;
  resetRecoverArm();
  pauseBtn.textContent = "Pausing…";
  setButtonsBusy(true);
  sendAction({ action: "pause_15", minutes: 15 });
});
twoMinBtn.addEventListener("click", () => {
  // Opening the 2‑min panel is an intentional alternative path; disarm recovery
  // confirmation so a stray second press of "R" can't trigger an accidental recover.
  resetRecoverArm();

  if (twoMinPanel.classList.contains("hidden")) {
    showTwoMin(currentPayload?.two_min_choices);
  } else {
    resetTwoMin();
  }
  if (hintEnter) {
    const twoMinOpen = twoMinPanel && !twoMinPanel.classList.contains("hidden");
    hintEnter.textContent = (window.overlayUtils && window.overlayUtils.enterHintForState)
      ? window.overlayUtils.enterHintForState({ mode: overlay.dataset.mode, twoMinOpen, recoverArmed })
      : (twoMinOpen ? "Enter: Set 2‑min step" : (recoverArmed ? "Enter: Confirm" : "Enter: Back on track"));
  }
});
stuckBtn.addEventListener("click", () => {
  if (stuckBtn.disabled) return;
  resetRecoverArm();
  stuckBtn.textContent = "Noted…";
  setButtonsBusy(true);
  sendAction({ action: "stuck" });
});

recoverBtn.addEventListener("click", () => {
  if (recoverBtn.disabled) return;

  // Two-step confirm to prevent accidental recoveries.
  if (!recoverArmed) {
    armRecover();
    return;
  }

  recoverBtn.textContent = "Recovering…";
  setButtonsBusy(true);
  resetRecoverArm();
  sendAction({ action: "recover" });
});

undoRecoverBtn?.addEventListener("click", () => {
  if (undoRecoverBtn.disabled) return;
  undoRecoverBtn.textContent = "Undoing…";
  setButtonsBusy(true);
  sendAction({ action: "undo_recover" });
});

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
  resetRecoverArm();
  toggleSnooze();
  updateEnterHint();
});

// Copy diagnostics: small, safe helper for actionable recovery.
copyDiagBtn?.addEventListener('click', () => {
  const text = buildDiagnosticsText();
  const ok = (window.overlayAPI && typeof window.overlayAPI.copyText === 'function')
    ? window.overlayAPI.copyText(text)
    : false;

  if (ok) {
    copyDiagBtn.textContent = 'Copied';
    // After a successful copy, guide focus to relaunch when available.
    if (relaunchBtn && !relaunchBtn.classList.contains('hidden')) {
      try { relaunchBtn.focus(); } catch {}
    }
    setTimeout(() => {
      copyDiagBtn.textContent = 'Copy diagnostics';
    }, 1800);
    return;
  }

  // Clipboard can fail in some hardened contexts; provide a robust fallback.
  const sys = (window.overlayAPI && typeof window.overlayAPI.getSystemInfo === 'function')
    ? window.overlayAPI.getSystemInfo()
    : { platform: 'unknown' };
  const hint = sys.platform === 'darwin' ? 'Press Cmd+C to copy' : 'Press Ctrl+C to copy';

  try {
    // Ensure repeated failures don't leak hidden textareas.
    document.querySelectorAll('[data-overlay-diag="1"]').forEach((el) => el.remove());

    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.setAttribute('data-overlay-diag', '1');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
  } catch {}

  copyDiagBtn.textContent = `Copy failed — ${hint}`;
  setTimeout(() => {
    copyDiagBtn.textContent = 'Copy diagnostics';
    // Clean up any hidden textarea(s) we created for manual copy.
    try {
      document.querySelectorAll('[data-overlay-diag="1"]').forEach((el) => el.remove());
    } catch {}
  }, 4000);
});

relaunchBtn?.addEventListener('click', () => {
  const ok = (window.overlayAPI && typeof window.overlayAPI.relaunchOverlay === 'function')
    ? window.overlayAPI.relaunchOverlay()
    : false;
  relaunchBtn.textContent = ok ? 'Relaunching…' : 'Relaunch failed';
  setTimeout(() => {
    relaunchBtn.textContent = 'Relaunch overlay';
  }, 2000);
});

snooze.addEventListener("click", (event) => {
  const reason = event.target?.dataset?.reason;
  if (reason) {
    sendAction({ action: "snooze", reason, minutes: 5 });
    // Close the panel immediately so the overlay is ready for the next action.
    toggleSnooze(false);
    updateEnterHint();
  }
});

window.overlayAPI.onShow((payload) => {
  showOverlay(payload);
});

window.overlayAPI.onPause(() => {
  if (pauseBtn && !pauseBtn.disabled) {
    resetRecoverArm();
    pauseBtn.textContent = "Pausing…";
    setButtonsBusy(true);
  }
  // Keep payload consistent with other pause paths.
  sendAction({ action: "pause_15", minutes: 15 });
});

function updateEnterHint() {
  if (!hintEnter) return;
  const twoMinOpen = twoMinPanel && !twoMinPanel.classList.contains("hidden");
  hintEnter.textContent = (window.overlayUtils && window.overlayUtils.enterHintForState)
    ? window.overlayUtils.enterHintForState({ mode: overlay.dataset.mode, twoMinOpen, recoverArmed })
    : (twoMinOpen ? "Enter: Set 2‑min step" : (recoverArmed ? "Enter: Confirm" : (overlay.dataset.mode === "align" ? "Enter: Submit answer" : "Enter: Back on track")));
}

window.addEventListener("keydown", (event) => {
  if (overlay.classList.contains("hidden")) return;

  // When an action is in-flight, ignore most hotkeys to prevent double-sends.
  // Keep Escape working so users can close panels / cancel an armed recover.
  if (overlayBusy && event.key !== "Escape") return;

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
    // Route through the button handler so we get consistent UI feedback
    // (busy state + disarming recover) before the main process hides the overlay.
    if (pauseBtn && !pauseBtn.disabled) {
      pauseBtn.click();
    } else {
      sendAction({ action: "pause_15", minutes: 15 });
    }
    return;
  }

  // Explicit relaunch shortcut for actionable recovery (Apple Silicon only).
  // Only active when the relaunch affordance is visible to avoid surprise.
  if ((event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) && String(event.key).toLowerCase() === 'r') {
    const canRelaunch = relaunchBtn && !relaunchBtn.classList.contains('hidden');
    if (canRelaunch) {
      event.preventDefault();
      event.stopPropagation();
      relaunchBtn.click();
      return;
    }
  }

  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();

    // If recover is armed, Esc should always cancel the arm state.
    resetRecoverArm();

    // Always allow Esc to close existing panels, even while typing.
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

    // But don't open snooze while the user is typing into an input.
    const shouldOpen = window.overlayUtils?.shouldShowSnoozeOnEscape?.({ target: event.target });
    if (shouldOpen) {
      toggleSnooze(true);
      updateEnterHint();
    }
    return;
  }

  // Reduce accidental recoveries:
  // - never treat Enter as "Back on track" while typing
  // - also disable the global Enter shortcut during the align + 2-min flows
  if (event.key === "Enter") {
    const action = window.overlayUtils?.getOverlayHotkeyAction?.(event, {
      overlayHidden: overlay.classList.contains("hidden"),
      overlayBusy,
      mode: overlay.dataset.mode,
      twoMinOpen: twoMinPanel && !twoMinPanel.classList.contains("hidden"),
      snoozeOpen: snooze && !snooze.classList.contains("hidden"),
      recoverArmed
    });
    if (action === "back_on_track") {
      event.preventDefault();
      event.stopPropagation();
      // Use the button handler for consistent busy UI + recover disarm.
      if (backBtn && !backBtn.disabled) {
        backBtn.click();
      } else {
        sendAction({ action: "back_on_track" });
      }
    } else if (action === "confirm_recover" && recoverArmed) {
      event.preventDefault();
      event.stopPropagation();
      if (recoverBtn && !recoverBtn.disabled) {
        recoverBtn.click();
      } else {
        setButtonsBusy(true);
        resetRecoverArm();
        sendAction({ action: "recover" });
      }
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

      // Actionable recovery: quick diagnostics copy.
      // Keep it opt-in and low-risk: only when not typing, no modifiers, and not in align mode.
      if (key === "d" && copyDiagBtn) {
        event.preventDefault();
        event.stopPropagation();
        copyDiagBtn.click();
      }
    }
  }

  updateEnterHint();
});
