(function () {
  if (document.querySelector(".site-updated-stamp")) return;

  var script = document.currentScript;
  var repo =
    (script && script.getAttribute("data-repo")) ||
    document.documentElement.getAttribute("data-repo") ||
    "";

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

  function mount(text) {
    if (document.querySelector(".site-updated-stamp")) return;
    var el = document.createElement("div");
    el.className = "site-updated-stamp no-print";
    el.setAttribute("aria-label", "Site last updated");
    el.textContent = text;
    var body = document.body;
    if (!body) return;
    body.insertBefore(el, body.firstChild);
  }

  function apply(iso) {
    mount(formatStamp(iso));
  }

  function fallback() {
    apply(document.lastModified || new Date().toISOString());
  }

  function run() {
    if (!repo) {
      fallback();
      return;
    }
    fetch("https://api.github.com/repos/" + repo + "/commits?per_page=1")
      .then(function (r) {
        if (!r.ok) throw new Error("bad status");
        return r.json();
      })
      .then(function (data) {
        var date = data && data[0] && data[0].commit && data[0].commit.committer && data[0].commit.committer.date;
        if (date) apply(date);
        else fallback();
      })
      .catch(fallback);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
