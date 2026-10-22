/* pers-ui - CZ/EN language toggle.
   No flags, deliberately: a flag names a COUNTRY, not a language. English is not
   the United States and Czech is spoken outside Czechia, so a flag pair states
   something false in order to say something simple. Two text labels say it
   correctly and survive every platform's emoji font. The visible Czech label is
   CZ, which is what a Czech reader expects; the machinery underneath stays on
   the ISO 639-1 language code cs - data-pers-lang, .lang-cs, show-cs - because
   that is what actually denotes the language.
   Toggles visibility of .lang-cs / .lang-en content. Framework-agnostic; ported
   from the retired legacy toolkit (git history). Self-injects both the toggle chrome (tokenized) and
   the .lang-* visibility rules (id-guarded), so it needs no external stylesheet
   and core/base.css stays untouched.

   Usage (standalone):
     <script src="core/lang.js"></script>
     <script>persLang.init()</script>

   Usage (with custom UI):
     persLang.init({ renderToggle: false })
     persLang.set('cs')   // 'en' | 'cs'

   Content markup:
     <div class="lang-en">English</div>   <div class="lang-cs">Czech</div>
     <span class="lang-en">EN</span>       <span class="lang-cs">CS</span>

   Options: container, storageKey (default 'pers-ui-lang'), defaultLang ('en'),
   renderToggle (true), onLangChange(lang). */

var persLang = (function () {
  var STYLE_ID = "pers-ui-lang-style";
  var CSS = [
    ".lang-cs { display: none; } .lang-en { display: block; }",
    "body.show-cs .lang-cs { display: block; } body.show-cs .lang-en { display: none; }",
    "span.lang-cs { display: none; } span.lang-en { display: inline; }",
    "body.show-cs span.lang-cs { display: inline; } body.show-cs span.lang-en { display: none; }",
    ".pers-lang-toggle { display: inline-flex; gap: 0.1rem; align-items: center; background: var(--surface); border: 1px solid var(--border); border-radius: 999px; padding: 0.2rem; }",
    ".pers-lang-toggle button { border: 0; background: transparent; color: var(--text-muted); padding: 0.3rem 0.55rem; border-radius: 999px; line-height: 1; font-size: 0.85rem; cursor: pointer; display: inline-flex; align-items: center; gap: 0.3rem; }",
    ".pers-lang-toggle button:hover { color: var(--text); }",
    ".pers-lang-toggle button.active { background: var(--accent); color: var(--accent-contrast); }",
    "@media print { .pers-lang-toggle { display: none; } }"
  ].join("\n");

  var _opts = {};
  var _buttons = {};

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function apply(lang) {
    document.body.classList.toggle("show-cs", lang === "cs");
    try { localStorage.setItem(_opts.storageKey, lang); } catch (e) {}
    if (_buttons.en) {
      _buttons.en.classList.toggle("active", lang === "en");
      _buttons.cs.classList.toggle("active", lang === "cs");
    }
    if (_opts.onLangChange) _opts.onLangChange(lang);
  }

  function get() {
    return document.body.classList.contains("show-cs") ? "cs" : "en";
  }

  function renderToggle(container) {
    var wrap = document.createElement("div");
    wrap.className = "pers-lang-toggle";
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", "Language");
    wrap.innerHTML =
      '<button data-pers-lang="en" aria-label="English">EN</button>' +
      '<button data-pers-lang="cs" aria-label="Czech">CZ</button>';
    _buttons.en = wrap.querySelector('[data-pers-lang="en"]');
    _buttons.cs = wrap.querySelector('[data-pers-lang="cs"]');
    wrap.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-pers-lang]");
      if (btn) apply(btn.dataset.persLang);
    });
    (container || document.body).appendChild(wrap);
  }

  function init(opts) {
    _opts = Object.assign(
      { container: null, storageKey: "pers-ui-lang", defaultLang: "en", renderToggle: true, onLangChange: null },
      opts || {}
    );
    ensureStyle();
    if (_opts.renderToggle) renderToggle(_opts.container);
    var saved = null;
    try { saved = localStorage.getItem(_opts.storageKey); } catch (e) {}
    apply(saved || _opts.defaultLang);
  }

  return { init: init, set: apply, get: get };
})();
