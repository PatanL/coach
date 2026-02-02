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

const twoMinPanel = document.getElementById("twoMinPanel");
const twoMinChoices = document.getElementById("twoMinChoices");
const twoMinText = document.getElementById("twoMinText");
const twoMinSubmit = document.getElementById("twoMinSubmit");

const backBtn = document.getElementById("backBtn");
const pauseBtn = document.getElementById("pauseBtn");
const twoMinBtn = document.getElementById("twoMinBtn");
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
pauseBtn.addEventListener("click", () => sendAction({ action: "pause_15", minutes: 15 }));
twoMinBtn.addEventListener("click", () => {
  if (twoMinPanel.classList.contains("hidden")) {
    showTwoMin(currentPayload?.two_min_choices);
  } else {
    resetTwoMin();
  }
});
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
  if (event.key === "Escape") {
    snooze.classList.remove("hidden");
  }
});
