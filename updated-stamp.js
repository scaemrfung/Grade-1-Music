/* "Updated … MT" stamp.
   SITE_UPDATED is baked in at commit time (run tools/bake-updated.sh before committing),
   so pages make no GitHub API calls. If it is ever empty, the page's Last-Modified date is used. */
(function () {
  var SITE_UPDATED = "2026-10-03T17:10:19Z";

  function formatStamp(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) d = new Date();
    var formatted = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Edmonton",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
    return "Updated " + formatted + " MT";
  }
  var stampText = formatStamp(SITE_UPDATED || document.lastModified || new Date().toISOString());

  var watching = false;
  function mount() {
    var body = document.body;
    if (!body) return;
    if (!document.querySelector(".site-updated-stamp")) {
      var el = document.createElement("div");
      el.className = "site-updated-stamp no-print";
      el.setAttribute("aria-label", "Site last updated");
      el.textContent = stampText;
      body.insertBefore(el, body.firstChild);
    }
    if (!watching && window.MutationObserver) {
      watching = true;
      /* Put it back if a re-render of the page drops it. */
      new MutationObserver(function () {
        if (!document.querySelector(".site-updated-stamp")) mount();
      }).observe(body, { childList: true });
    }
  }

  /* Wait for the window load event plus a short pause so the app has finished
     rendering/hydrating; adding DOM earlier can cause a hydration mismatch (React error #418). */
  function later() { setTimeout(mount, 400); }
  if (document.readyState === "complete") later();
  else window.addEventListener("load", later);
})();
