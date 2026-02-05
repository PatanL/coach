const overlay = document.getElementById("overlay");
const eventLabel = document.getElementById("eventLabel");
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

function labelForEventType(eventType) {
  if (eventType === "DRIFT_PERSIST") return "DRIFT (AGAIN)";
  if (eventType === "DRIFT_START") return "DRIFT";
  if (eventType === "OFF_SCHEDULE") return "OFF-SCHEDULE";
  if (eventType === "HABIT_ESCALATE") return "HABIT";
  if (eventType === "RECOVER_TRIGGER") return "RECOVER";
  return "DRIFT";
}

function showOverlay(payload) {
  overlay.classList.remove("hidden");
  resetSnooze();
  resetAlignInput();
  if (payload.choices && Array.isArray(payload.choices)) {
    overlay.dataset.mode = "align";
  } else {
    overlay.dataset.mode = "";
  }
  const eventType = payload.source_event_type || payload.event_type || "";
  overlay.dataset.eventType = eventType;
  setText(eventLabel, labelForEventType(eventType));

  const eventType = payload.source_event_type || payload.event_type || "";
  overlay.dataset.eventType = eventType;
  setText(eventLabel, eventType ? eventType.replace(/_/g, " ") : "");
  setText(blockName, payload.block_name || "");
  updatePrimaryLabel(payload);
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

  // Put focus on the primary action to reduce accidental "Enter" keypresses
  // triggering something unintended somewhere else.
  requestAnimationFrame(() => {
    try {
      backBtn?.focus?.();
    } catch {
      // no-op
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
  if (event.key === "Enter") {
    const shouldTrigger = window.overlayUtils?.shouldImplicitEnterTriggerBackOnTrack?.({
      target: event.target,
      overlayHidden: overlay.classList.contains("hidden"),
      mode: overlay.dataset.mode || "",
      snoozeVisible: !snooze.classList.contains("hidden")
    });

    if (shouldTrigger) {
      sendAction({ action: "back_on_track" });
    }
  }

  // Esc should never interrupt typing (or align mode). Outside typing, toggle the snooze panel.
  if (event.key === "Escape") {
    const shouldToggle = window.overlayUtils?.shouldEscapeToggleSnooze?.({
      target: event.target,
      overlayHidden: overlay.classList.contains("hidden"),
      mode: overlay.dataset.mode || ""
    });

    if (shouldToggle) snooze.classList.toggle("hidden");
  }
});
