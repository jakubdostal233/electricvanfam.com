/* pers-ui - dark / light / auto theme toggle.
   Framework-agnostic. Sets data-theme on <html>; every template styles
   [data-theme="dark"] plus the prefers-color-scheme fallback for auto.

   Usage:  <div id="theme-mount"></div>
           <script src="shared/theme.js"></script>
           <script>persTheme.init();</script>
*/
var persTheme = (function () {
  var KEY = "pers-ui-theme";
  var mount, buttons = {};

  function systemDark() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function effective(mode) {
    if (mode === "dark") return "dark";
    if (mode === "light") return "light";
    return systemDark() ? "dark" : "light";
  }
  function apply(mode) {
    document.documentElement.setAttribute("data-theme", mode); // "light" | "dark" | "auto"
    try { localStorage.setItem(KEY, mode); } catch (e) {}
    Object.keys(buttons).forEach(function (k) {
      buttons[k].classList.toggle("active", k === mode);
      buttons[k].setAttribute("aria-pressed", String(k === mode));
    });
    // Swap paired diagram variants (pers:diagram convention: name-light.svg /
    // name-dark.svg). The .only-light/.only-dark CSS path (core/diagrams.css)
    // handles embedded data-URI images where this filename swap can't match.
    var eff = effective(mode);
    var from = eff === "dark" ? "-light.svg" : "-dark.svg";
    var to = eff === "dark" ? "-dark.svg" : "-light.svg";
    document.querySelectorAll('img[src*="-dark.svg"], img[src*="-light.svg"]')
      .forEach(function (img) { img.src = img.src.replace(from, to); });
  }
  function render() {
    if (!mount) return;
    mount.classList.add("control");
    mount.setAttribute("role", "group");
    mount.setAttribute("aria-label", "Color theme");
    var defs = [
      ["light", "☀", "Light"],
      ["auto", "Auto", "Follow system"],
      ["dark", "☾", "Dark"]
    ];
    defs.forEach(function (d) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = d[1];
      b.title = d[2];
      b.setAttribute("aria-label", d[2]);
      b.addEventListener("click", function () { apply(d[0]); });
      buttons[d[0]] = b;
      mount.appendChild(b);
    });
  }
  function init(opts) {
    opts = opts || {};
    mount = document.getElementById(opts.mountId || "theme-mount");
    render();
    var forced = new URLSearchParams(location.search).get("theme");
    var saved = "auto";
    try { saved = localStorage.getItem(KEY) || "auto"; } catch (e) {}
    apply(forced || saved);
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
      var cur = "auto";
      try { cur = localStorage.getItem(KEY) || "auto"; } catch (e) {}
      if (cur === "auto") apply("auto");
    });
  }
  return { init: init, set: apply, effective: effective };
})();
