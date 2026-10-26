// Quick Mode info: a short hint beside the Quick Mode button (hover, tap or keyboard)
// and a longer explanation in a dialog. No game logic here.

const INFO_OPEN_DELAY_MS = 150;    // so passing the pointer over the icon does not flash the hint
const INFO_CLOSE_DELAY_MS = 250;   // lets the pointer travel from the icon into the hint

function InitInfo() {
  const button = $("infoBtn");
  const pop = $("infoPop");
  const dialog = $("aboutDialog");
  let openTimer = 0;
  let closeTimer = 0;
  let pinned = false;   // opened by a click or tap, so moving the pointer away must not close it

  const isOpen = () => !pop.hidden;
  const CancelTimers = () => { window.clearTimeout(openTimer); window.clearTimeout(closeTimer); };

  function Open() {
    CancelTimers();
    pop.hidden = false;
    button.setAttribute("aria-expanded", "true");
  }

  function Close(returnFocus) {
    CancelTimers();
    pinned = false;
    pop.hidden = true;
    button.setAttribute("aria-expanded", "false");
    if (returnFocus) button.focus();
  }

  const isMouse = (event) => event.pointerType === "mouse";

  function HoverIn(event) {
    if (!isMouse(event)) return;
    window.clearTimeout(closeTimer);
    if (!isOpen()) openTimer = window.setTimeout(Open, INFO_OPEN_DELAY_MS);
  }

  function HoverOut(event) {
    if (!isMouse(event) || pinned) return;
    window.clearTimeout(openTimer);
    closeTimer = window.setTimeout(() => Close(false), INFO_CLOSE_DELAY_MS);
  }

  button.addEventListener("pointerenter", HoverIn);
  button.addEventListener("pointerleave", HoverOut);
  pop.addEventListener("pointerenter", HoverIn);
  pop.addEventListener("pointerleave", HoverOut);

  button.addEventListener("click", () => {
    if (!isOpen()) { Open(); pinned = true; }
    else if (!pinned) { pinned = true; }   // it was open from hovering: keep it
    else { Close(false); }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen() && !dialog.open) Close(pop.contains(document.activeElement));
  });

  document.addEventListener("pointerdown", (event) => {
    if (isOpen() && !pop.contains(event.target) && !button.contains(event.target)) Close(false);
  });

  $("infoPop").addEventListener("focusout", (event) => {
    if (event.relatedTarget && !pop.contains(event.relatedTarget) && event.relatedTarget !== button) Close(false);
  });

  // ---------- the longer explanation ----------

  $("moreBtn").addEventListener("click", () => {
    Close(false);
    LockPage();
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    const body = dialog.querySelector(".modal-body");
    if (body) body.scrollTop = 0;   // always start reading from the top
  });

  const CloseDialog = () => { if (typeof dialog.close === "function") dialog.close(); else dialog.removeAttribute("open"); };
  $("aboutClose").addEventListener("click", CloseDialog);
  $("aboutDone").addEventListener("click", CloseDialog);
  dialog.addEventListener("click", (event) => { if (event.target === dialog) CloseDialog(); });   // a click on the dark backdrop
  dialog.addEventListener("close", () => { UnlockPage(); button.focus({ preventScroll: true }); });
}

// While the dialog is open the page behind it must not scroll, and must not jump sideways when the
// scrollbar would normally disappear. So the page is pinned where it was, and the scrollbar track is kept.
let lockedAt = 0;
function LockPage() {
  const root = document.documentElement;
  const hadScrollbar = window.innerWidth > root.clientWidth;
  lockedAt = window.scrollY;
  document.body.style.setProperty("--lock-top", -lockedAt + "px");
  if (hadScrollbar) root.classList.add("is-locked");
  document.body.classList.add("is-locked");
}
function UnlockPage() {
  if (!document.body.classList.contains("is-locked")) return;
  document.documentElement.classList.remove("is-locked");
  document.body.classList.remove("is-locked");
  document.body.style.removeProperty("--lock-top");
  window.scrollTo({ top: lockedAt, left: 0, behavior: "instant" });
}

// ---------- short explanations on words (hover, focus or tap) ----------

function InitTerms() {
  const terms = Array.from(document.querySelectorAll(".term"));
  const CloseAll = (except) => {
    for (const term of terms) {
      if (term === except) continue;
      term.querySelector(".term-tip").hidden = true;
      term.querySelector(".term-btn").setAttribute("aria-expanded", "false");
    }
  };
  const FitTip = (term, tip) => {
    tip.style.marginLeft = "0px";
    tip.style.position = "fixed";
    tip.style.left = "0px";
    tip.style.top = "0px";
    tip.style.visibility = "hidden";
    tip.hidden = false;
    const width = tip.getBoundingClientRect().width;
    const fragments = term.getClientRects();
    const startsAt = Math.min(fragments[0].left, fragments[fragments.length - 1].left);   // where "left: 0" lands for a word that wraps
    const gutter = 16;
    const farthestLeft = document.documentElement.clientWidth - gutter - width;
    tip.style.position = tip.style.left = tip.style.top = tip.style.visibility = "";
    tip.style.marginLeft = (startsAt > farthestLeft ? farthestLeft - startsAt : 0) + "px";
  };
  const KeepTipOnScreen = (tip) => {
    // A word near the bottom of the screen opens its explanation partly off screen, so nudge the page by just enough to show all of it.
    const margin = 12;
    const hidden = tip.getBoundingClientRect().bottom - (window.innerHeight - margin);
    if (hidden > 0) window.scrollBy({ top: hidden, left: 0, behavior: "smooth" });
  };
  const SetOpen = (term, open) => {
    const tip = term.querySelector(".term-tip");
    const btn = term.querySelector(".term-btn");
    if (open) {
      if (tip.hidden) { CloseAll(term); FitTip(term, tip); }
    } else {
      tip.hidden = true;
    }
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  };
  for (const term of terms) {
    const btn = term.querySelector(".term-btn");
    let pinned = false;
    term.addEventListener("pointerenter", (event) => { if (event.pointerType === "mouse") SetOpen(term, true); });
    term.addEventListener("pointerleave", (event) => { if (event.pointerType === "mouse" && !pinned) SetOpen(term, false); });
    btn.addEventListener("click", () => {
      const isOpen = btn.getAttribute("aria-expanded") === "true";
      if (isOpen && pinned) { pinned = false; SetOpen(term, false); return; }
      pinned = true;
      SetOpen(term, true);
      KeepTipOnScreen(term.querySelector(".term-tip"));
    });
    btn.addEventListener("focus", () => SetOpen(term, true));
    btn.addEventListener("blur", () => { pinned = false; SetOpen(term, false); });
  }
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") CloseAll(null); });
  document.addEventListener("pointerdown", (event) => { if (!(event.target instanceof Element) || !event.target.closest(".term")) CloseAll(null); });
}
