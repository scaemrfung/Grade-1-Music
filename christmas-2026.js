(function () {
  document.querySelectorAll(".loop-toggle").forEach(function (btn) {
    var audio = btn.previousElementSibling;
    if (!audio || audio.tagName !== "AUDIO") return;
    function paint() {
      var on = !!audio.loop;
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.textContent = on ? "🔁 Loop: On" : "Loop: Off";
    }
    paint();
    btn.addEventListener("click", function () {
      audio.loop = !audio.loop;
      paint();
    });
  });
})();
