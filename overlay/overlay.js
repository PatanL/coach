const overlay = document.getElementById("overlay");
const eventLabel = document.getElementById("eventLabel");
const blockName = document.getElementById("blockName");
const headline = document.getElementById("headline");
const humanLine = document.getElementById("humanLine");
const diagnosis = document.getElementById("diagnosis");
const nextAction = document.getElementById("nextAction");
const snooze = document.getElementById("snoozeReason");
const enterHint = document.getElementById("enterHint");
const miniPlan = document.getElementById("miniPlan");
const choiceButtons = document.getElementById("choiceButtons");
const alignInput = document.getElementById("alignInput");
const alignText = document.getElementById("alignText");
const alignSubmit = document.getElementById("alignSubmit");

const backBtn = document.getElementById("backBtn");
const stuckBtn = document.getElementById("stuckBtn");
const recoverBtn = document.getElementById("recoverBtn");
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

function updateEventLabel(payload) {
  // Prefer the originating event type when available (used for visual pattern-breaks like DRIFT_PERSIST).
  const raw = payload?.source_event_type || payload?.event_type || payload?.type || "";
  const eventType = String(raw).toUpperCase();
  overlay.dataset.eventType = eventType;

  if (!eventType) {
    setText(eventLabel, "DRIFT");
    return eventType;
  }
  if (eventType === "DRIFT_PERSIST") {
    setText(eventLabel, "DRIFT — PERSIST");
    return eventType;
  }
  if (eventType.startsWith("DRIFT")) {
    setText(eventLabel, "DRIFT");
    return eventType;
  }
  setText(eventLabel, eventType.replaceAll("_", " "));
  return eventType;
}

function resetSnooze() {
  snooze.classList.add("hidden");
}

function resetAlignInput() {
  alignText.value = "";
  alignInput.classList.add("hidden");
}

function setEnterHint(text) {
  if (!enterHint) return;
  setText(enterHint, text);
}

function setPrimaryAction(primary) {
  // Ensure only one "primary" button styling at a time.
  [backBtn, stuckBtn, recoverBtn, snoozeBtn].forEach((btn) => btn.classList.remove("primary"));
  primary?.classList.add("primary");
}

function showOverlay(payload) {
  overlay.classList.remove("hidden");
  resetSnooze();
  resetAlignInput();
  const eventType = updateEventLabel(payload);
  updatePrimaryLabel(payload);

  if (payload.choices && Array.isArray(payload.choices)) {
    overlay.dataset.mode = "align";
  } else {
    overlay.dataset.mode = "";
  }

  // Option B actionable overlay: on persistent drift, make "Recover schedule" the default action.
  // This is both a motivational pattern-break (different default) and a safer recovery path.
  if (eventType === "DRIFT_PERSIST") {
    setPrimaryAction(recoverBtn);
    setEnterHint("Enter: Recover schedule");
  } else {
    setPrimaryAction(backBtn);
    setEnterHint("Enter: Back on track");
  }

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

  // Focus management: reduce accidental global hotkeys and make the default action obvious.
  // - Align mode: focus the text input.
  // - Otherwise: focus the primary action button (Recover schedule for DRIFT_PERSIST).
  requestAnimationFrame(() => {
    try {
      if (payload.choices && Array.isArray(payload.choices)) {
        alignText?.focus?.({ preventScroll: true });
      } else if (eventType === "DRIFT_PERSIST") {
        recoverBtn?.focus?.({ preventScroll: true });
      } else {
        backBtn?.focus?.({ preventScroll: true });
      }
    } catch (_) {
      // Focus is best-effort; avoid crashing the overlay on environments that don't support focus options.
      if (payload.choices && Array.isArray(payload.choices)) alignText?.focus?.();
      else if (eventType === "DRIFT_PERSIST") recoverBtn?.focus?.();
      else backBtn?.focus?.();
    }
  });

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

window.overlayAPI.onShow((payload) => {
  showOverlay(payload);
});

window.overlayAPI.onPause(() => {
  sendAction({ action: "pause_15" });
});

window.addEventListener("keydown", (event) => {
  // Don't treat Enter as a global action while the user is typing or interacting with a control.
  if (event.key === "Enter") {
    const ignoreEnter = window.overlayUtils?.shouldIgnoreGlobalEnter?.(event.target);
    if (!ignoreEnter) {
      const eventType = String(overlay?.dataset?.eventType || "").toUpperCase();
      if (eventType === "DRIFT_PERSIST") {
        sendAction({ action: "recover" });
      } else {
        sendAction({ action: "back_on_track" });
      }
    }
  }
  if (event.key === "Escape") {
    snooze.classList.remove("hidden");
  }
});
