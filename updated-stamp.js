/* "Updated … MT" stamp + "Mr. Fung's sites" footer.
   SITE_UPDATED is baked in at commit time (run tools/bake-updated.sh before committing),
   so pages make no GitHub API calls. If it is ever empty, the page's Last-Modified date is used. */
(function () {
  var SITE_UPDATED = "2026-09-27T17:36:26Z";
  var THIS_SITE = "Grade-1-Music";
  /* Student-facing sites never link to Sub Day Plans (only Sub Day Plans lists everything). */
  var SITES = [
    ["pe-playbook", "PE Playbook"],
    ["Grade-1-Music", "Grade 1 Music"],
    ["music-practice-studio", "Music Practice Studio"],
    ["grade5health", "Grade 5 Health"],
    ["Grade5-iMovie", "Grade 5 iMovie"],
    ["Grade-6-Canva", "Grade 6 Canva"],
    ["Grade-6-Scratch", "Grade 6 Scratch"]
  ];

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

  function addStyle() {
    if (document.getElementById("mf-sites-style")) return;
    var st = document.createElement("style");
    st.id = "mf-sites-style";
    st.textContent =
      ".mf-sites{box-sizing:border-box;max-width:1100px;margin:32px auto 0;padding:16px 16px 28px;border-top:1px solid rgba(128,128,128,.35);font:14px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;text-align:center;color:inherit}" +
      ".mf-sites p{margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;opacity:.75}" +
      ".mf-sites ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;justify-content:center;gap:6px 16px}" +
      ".mf-sites a{color:inherit;text-decoration:underline;text-underline-offset:2px}" +
      ".mf-sites [aria-current]{font-weight:700;text-decoration:none}" +
      "@media print{.mf-sites{display:none!important}}";
    (document.head || document.documentElement).appendChild(st);
  }

  function footer() {
    var nav = document.createElement("nav");
    nav.className = "mf-sites no-print";
    nav.setAttribute("aria-label", "Mr. Fung's sites");
    var html = "<p>Mr. Fung's sites</p><ul>";
    for (var i = 0; i < SITES.length; i++) {
      var s = SITES[i];
      html += s[0] === THIS_SITE
        ? '<li><span aria-current="page">' + s[1] + "</span></li>"
        : '<li><a href="https://scaemrfung.github.io/' + s[0] + '/">' + s[1] + "</a></li>";
    }
    nav.innerHTML = html + "</ul>";
    return nav;
  }

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
    if (!document.querySelector(".mf-sites")) {
      addStyle();
      body.appendChild(footer());
    }
    if (!watching && window.MutationObserver) {
      watching = true;
      /* Put them back if a re-render of the page drops them. */
      new MutationObserver(function () {
        if (!document.querySelector(".site-updated-stamp") || !document.querySelector(".mf-sites")) mount();
      }).observe(body, { childList: true });
    }
  }

  /* Wait for the window load event plus a short pause so the app has finished
     rendering/hydrating; adding DOM earlier can cause a hydration mismatch (React error #418). */
  function later() { setTimeout(mount, 400); }
  if (document.readyState === "complete") later();
  else window.addEventListener("load", later);
})();
