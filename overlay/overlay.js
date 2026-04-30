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
const enterHint = document.getElementById("enterHint");

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

function updateEnterHint() {
  if (!enterHint) return;
  const mode = overlay.dataset.mode || "";
  const eventType = overlay.dataset.eventType || "";
  const text = window.overlayUtils?.getEnterHintText?.({ eventType, mode }) || "Enter: Back on track";
  enterHint.textContent = text;
}

function applyPrimaryButtonStyle() {
  const mode = overlay.dataset.mode || "";
  const eventType = overlay.dataset.eventType || "";
  const preferred = window.overlayUtils?.getPrimaryButtonId?.({ eventType, mode }) || "backBtn";

  // Clear existing primary styles first.
  [backBtn, recoverBtn, alignSubmit].forEach((el) => el?.classList?.remove("primary"));

  const el =
    preferred === "recoverBtn" ? recoverBtn : preferred === "alignSubmit" ? alignSubmit : backBtn;
  el?.classList?.add("primary");
}

function resetSnooze() {
  snooze.classList.add("hidden");
}

function resetAlignInput() {
  alignText.value = "";
  alignInput.classList.add("hidden");
}

function tryFocus(el) {
  if (!el) return false;
  if (el.disabled) return false;
  // offsetParent === null covers display:none and some hidden states.
  if (el.offsetParent === null) return false;
  el.focus({ preventScroll: true });
  return true;
}

function applyInitialFocus() {
  const mode = overlay.dataset.mode || "";
  const eventType = overlay.dataset.eventType || "";
  const preferred = window.overlayUtils?.getPreferredInitialFocus?.({ eventType, mode }) || "backBtn";

  // Defer until after layout so visibility checks are accurate.
  requestAnimationFrame(() => {
    if (preferred === "alignText") {
      if (!tryFocus(alignText)) {
        tryFocus(backBtn);
      }
      return;
    }

    if (preferred === "recoverBtn") {
      if (!tryFocus(recoverBtn)) {
        tryFocus(backBtn);
      }
      return;
    }

    tryFocus(backBtn);
  });
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
  updateEnterHint();
  applyPrimaryButtonStyle();
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

  applyInitialFocus();
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
      const eventType = overlay.dataset.eventType || "";
      const mode = overlay.dataset.mode || "";
      const action =
        window.overlayUtils?.getPrimaryEnterAction?.({ eventType, mode }) ||
        "back_on_track";

      if (action === "align_submit") {
        alignSubmit.click();
      } else {
        sendAction({ action });
      }
    }
  }
  if (event.key === "Escape") {
    snooze.classList.remove("hidden");
  }
});
