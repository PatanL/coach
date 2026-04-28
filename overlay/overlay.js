const overlay = document.getElementById("overlay");
const eventLabel = document.getElementById("eventLabel");
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

const backBtn = document.getElementById("backBtn");
const stuckBtn = document.getElementById("stuckBtn");
const recoverBtn = document.getElementById("recoverBtn");
const snoozeBtn = document.getElementById("snoozeBtn");

const enterHint = document.getElementById("enterHint");

let shownAt = null;
let currentPayload = null;

function setText(el, value) {
  el.textContent = value || "";
}

function getEventType(payload) {
  const raw = payload?.source_event_type || payload?.event_type || payload?.type || "";
  return String(raw).toUpperCase();
}

function setEnterHint(label) {
  if (!enterHint) return;
  enterHint.textContent = `Enter: ${label}`;
}

function updatePrimaryLabel(payload) {
  const eventType = getEventType(payload);

  // Habit flow: keep the primary action semantically accurate.
  if (payload?.block_id && String(payload.block_id).includes("habit")) {
    backBtn.textContent = "Habit completed";
    setEnterHint("Habit completed");
    return;
  }

  // DRIFT_PERSIST should feel like a stronger pattern-break: a crisp, actionable reset.
  if (eventType === "DRIFT_PERSIST") {
    backBtn.textContent = "Reset now (60s)";
    setEnterHint("Reset now (60s)");
    return;
  }

  backBtn.textContent = "Back on track";
  setEnterHint("Back on track");
}

function updateEventLabel(payload) {
  // Prefer the originating event type when available (used for visual pattern-breaks like DRIFT_PERSIST).
  const eventType = getEventType(payload);
  overlay.dataset.eventType = eventType;

  if (!eventType) {
    setText(eventLabel, "DRIFT");
    return;
  }
  if (eventType === "DRIFT_PERSIST") {
    setText(eventLabel, "DRIFT — PERSIST");
    return;
  }
  if (eventType.startsWith("DRIFT")) {
    setText(eventLabel, "DRIFT");
    return;
  }
  setText(eventLabel, eventType.replaceAll("_", " "));
}

function resetSnooze() {
  snooze.classList.add("hidden");
}

function resetAlignInput() {
  alignText.value = "";
  alignInput.classList.add("hidden");
}

function showOverlay(payload) {
  overlay.classList.remove("hidden");
  resetSnooze();
  resetAlignInput();
  updateEventLabel(payload);
  updatePrimaryLabel(payload);

  if (payload.choices && Array.isArray(payload.choices)) {
    overlay.dataset.mode = "align";
  } else {
    overlay.dataset.mode = "";
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
  // Don't treat Enter as "Back on track" while the user is typing or interacting with a control.
  if (event.key === "Enter") {
    const ignoreEnter = window.overlayUtils?.shouldIgnoreGlobalEnter?.(event.target);
    if (!ignoreEnter) {
      sendAction({ action: "back_on_track" });
    }
  }
  if (event.key === "Escape") {
    snooze.classList.remove("hidden");
  }
});
