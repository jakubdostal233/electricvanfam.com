/* Electric Van Fam - site behaviour. Plain JS, no dependencies, no build.

   Loaded at the end of <body>, after core/theme.js and core/lang.js. Every
   feature degrades to plain HTML without JS: menu items are links, a video card
   links to YouTube, a photo links to its full-size file.

   Features (inspiration-site behaviour in brackets):
   - language: Czech by default, EN/CZ toggle, ?lang= deep link
   - theme: light by default; light / auto / dark control, labels follow the language
   - phone menu: dropdown panel under the header row (slide down / up)
   - lightbox: photos and YouTube videos, arrows, keys, swipe, wrap-around
   - pagination: client-side pages of a photo grid
   - parallax: photo bands move slower than the page
   - reveal: one fade the first time a block scrolls into view
   - contact form: sends through Web3Forms, answer shown in the page          */
(function () {
  "use strict";

  var html = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---- strings that JS writes into the page, per language ---------------- */
  var STR = {
    en: {
      close: "Close", prev: "Previous", next: "Next",
      watch: "Watch on YouTube", view: "View on Instagram",
      menuOpen: "Open menu", menuClose: "Close menu",
      pager: "Gallery pages", page: "Page",
      theme: "Colour theme", light: "Light", auto: "Follow system", dark: "Dark",
      lang: "Language", en: "English", cs: "Czech",
      video: "Video player", photo: "Photo viewer",
      formNotSet: "The form is not connected yet. Please write to us on Instagram.",
      sending: "Sending...",
      sent: "Thank you! Your message is on its way to us.",
      failed: "The message could not be sent. Please try again, or write to us on Instagram."
    },
    cs: {
      close: "Zavřít", prev: "Předchozí", next: "Další",
      watch: "Přehrát na YouTube", view: "Zobrazit na Instagramu",
      menuOpen: "Otevřít menu", menuClose: "Zavřít menu",
      pager: "Stránky galerie", page: "Stránka",
      theme: "Barevný motiv", light: "Světlý", auto: "Podle systému", dark: "Tmavý",
      lang: "Jazyk", en: "Angličtina", cs: "Čeština",
      video: "Přehrávač videa", photo: "Prohlížeč fotek",
      formNotSet: "Formulář zatím není připojený. Napište nám prosím na Instagram.",
      sending: "Odesílám...",
      sent: "Děkujeme! Vaše zpráva je na cestě k nám.",
      failed: "Zprávu se nepodařilo odeslat. Zkuste to prosím znovu, nebo nám napište na Instagram."
    }
  };
  function lang() { return window.persLang ? persLang.get() : "en"; }
  function t(key) { return (STR[lang()] || STR.en)[key]; }

  /* ---- language ------------------------------------------------------------
     lang.js swaps the visible .lang-en / .lang-cs text. Attributes it cannot
     reach (aria-label, title, alt, placeholder, the document title) carry a
     pair of data-*-en / data-*-cs values, applied here on every change. */
  var ATTRS = ["aria-label", "title", "alt", "placeholder", "content"];
  function applyLangAttributes(l) {
    html.lang = l === "cs" ? "cs" : "en";
    html.setAttribute("data-lang", html.lang); // the pre-paint language rules in site.css
    var title = html.getAttribute("data-title-" + l);
    if (title) document.title = title;
    ATTRS.forEach(function (attr) {
      document.querySelectorAll("[data-" + attr + "-" + l + "]").forEach(function (el) {
        el.setAttribute(attr, el.getAttribute("data-" + attr + "-" + l));
      });
    });
    // The kit's controls render English labels; give them the page language.
    var tm = document.getElementById("theme-mount");
    if (tm) {
      tm.setAttribute("aria-label", t("theme"));
      [["light", 0], ["auto", 1], ["dark", 2]].forEach(function (p) {
        var b = tm.querySelectorAll("button")[p[1]];
        if (b) { b.title = t(p[0]); b.setAttribute("aria-label", t(p[0])); }
      });
    }
    var lt = document.querySelector(".pers-lang-toggle");
    if (lt) {
      lt.setAttribute("aria-label", t("lang"));
      lt.querySelectorAll("[data-pers-lang]").forEach(function (b) {
        b.setAttribute("aria-label", t(b.getAttribute("data-pers-lang")));
        b.setAttribute("aria-pressed", String(b.classList.contains("active")));
      });
    }
    updateMenuLabel();
    document.dispatchEvent(new CustomEvent("evf:lang", { detail: l }));
  }


  // The site opens light; a visitor switches to dark (or to the system's
  // setting) with the theme control, and that choice is remembered. theme.js
  // itself falls back to "auto", so the default is applied here.
  var DEFAULT_THEME = "light";
  if (window.persTheme) {
    var storedTheme = null;
    try { storedTheme = localStorage.getItem("pers-ui-theme"); } catch (e) {}
    persTheme.init();
    if (!storedTheme && !new URLSearchParams(location.search).get("theme")) persTheme.set(DEFAULT_THEME);
  }
  if (window.persLang) {
    persLang.init({
      container: document.getElementById("lang-mount"),
      defaultLang: "cs", // Czech first; English is one click away and remembered
      onLangChange: applyLangAttributes
    });
    // ?lang=cs|en deep-links a language. Applied after init because lang.js
    // prefers a stored choice over its default.
    var q = new URLSearchParams(location.search).get("lang");
    if (q === "cs" || q === "en") persLang.set(q);
  }

  window.addEventListener("load", function () {
    requestAnimationFrame(function () { html.classList.remove("preload"); });
  });

  /* ---- phone menu ---------------------------------------------------------- */
  var toggle = document.querySelector(".menu-toggle");
  var nav = document.getElementById("site-menu");
  function updateMenuLabel() {
    if (!toggle) return;
    var open = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-label", t(open ? "menuClose" : "menuOpen"));
  }
  function setMenu(open) {
    if (!toggle || !nav) return;
    toggle.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("is-open", open);
    updateMenuLabel();
  }
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      setMenu(toggle.getAttribute("aria-expanded") !== "true");
    });
    nav.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) { setMenu(false); toggle.focus(); }
    });
    window.matchMedia("(min-width: 981px)").addEventListener("change", function (m) { if (m.matches) setMenu(false); });
    updateMenuLabel();
  }

  /* ---- reveal -------------------------------------------------------------- */
  (function () {
    var els = document.querySelectorAll(".reveal");
    if (!els.length) return;
    if (reduceMotion.matches || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.05 });
    els.forEach(function (el) { io.observe(el); });
  })();

  /* ---- parallax bands ------------------------------------------------------ */
  (function () {
    var bands = Array.prototype.slice.call(document.querySelectorAll(".band"));
    if (!bands.length) return;
    var ticking = false;
    function update() {
      ticking = false;
      if (reduceMotion.matches) {
        bands.forEach(function (b) { var img = b.querySelector("img"); if (img) img.style.transform = ""; });
        return;
      }
      var vh = window.innerHeight;
      bands.forEach(function (b) {
        var img = b.querySelector("img");
        if (!img) return;
        var r = b.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        var p = (vh - r.top) / (vh + r.height); // 0 entering at the bottom, 1 leaving at the top
        img.style.transform = "translate3d(0," + ((p - 0.5) * 0.26 * r.height).toFixed(1) + "px,0)";
      });
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    reduceMotion.addEventListener("change", onScroll);
    update();
  })();

  /* ---- lightbox -------------------------------------------------------------
     Markup: a container with data-lb-group holds links with data-lb="photo"
     (href = full-size image) or data-lb="video" (href = YouTube watch URL,
     data-video-id, data-short for a vertical Short). Optional data-caption-en /
     data-caption-cs and data-source (a link shown under the item). The whole
     group is one set, including items a pager has hidden. */
  var ICON = {
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>'
  };
  var lb = null, lbItems = [], lbIndex = 0, lbTrigger = null;

  function buildLightbox() {
    lb = document.createElement("dialog");
    lb.className = "lb";
    lb.innerHTML =
      '<button type="button" class="lb-close">' + ICON.close + "</button>" +
      '<button type="button" class="lb-prev">' + ICON.prev + "</button>" +
      '<button type="button" class="lb-next">' + ICON.next + "</button>" +
      '<div class="lb-stage"><div class="lb-media"></div>' +
      '<div class="lb-info"><p class="lb-caption"></p><p class="lb-count" aria-live="polite"></p></div></div>';
    document.body.appendChild(lb);
    lb.querySelector(".lb-close").addEventListener("click", closeLightbox);
    lb.querySelector(".lb-prev").addEventListener("click", function () { show(lbIndex - 1); });
    lb.querySelector(".lb-next").addEventListener("click", function () { show(lbIndex + 1); });
    lb.addEventListener("click", function (e) {
      if (e.target === lb) closeLightbox();                       // backdrop
      else if (e.target.tagName === "IMG" && lbItems.length > 1) show(lbIndex + 1); // image = next
    });
    lb.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { e.preventDefault(); show(lbIndex - 1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); show(lbIndex + 1); }
    });
    lb.addEventListener("close", cleanup);
    var x0 = null;
    lb.addEventListener("pointerdown", function (e) { if (e.pointerType !== "mouse") x0 = e.clientX; });
    lb.addEventListener("pointerup", function (e) {
      if (x0 === null) return;
      var dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 50 && lbItems.length > 1) show(lbIndex + (dx < 0 ? 1 : -1));
    });
    document.addEventListener("evf:lang", labelLightbox);
  }

  function labelLightbox() {
    if (!lb) return;
    lb.querySelector(".lb-close").setAttribute("aria-label", t("close"));
    lb.querySelector(".lb-prev").setAttribute("aria-label", t("prev"));
    lb.querySelector(".lb-next").setAttribute("aria-label", t("next"));
    var item = lbItems[lbIndex];
    lb.setAttribute("aria-label", t(item && item.getAttribute("data-lb") === "video" ? "video" : "photo"));
    if (lb.open) renderInfo();
  }

  function captionOf(a) {
    return a.getAttribute("data-caption-" + lang()) || a.getAttribute("data-caption-en") || "";
  }

  function renderInfo() {
    var a = lbItems[lbIndex];
    var cap = lb.querySelector(".lb-caption");
    cap.textContent = captionOf(a);
    var isVideo = a.getAttribute("data-lb") === "video";
    var src = isVideo ? a.href : a.getAttribute("data-source");
    if (src) {
      var link = document.createElement("a");
      link.href = src; link.target = "_blank"; link.rel = "noopener";
      link.textContent = t(isVideo ? "watch" : "view");
      if (cap.textContent) cap.appendChild(document.createTextNode(" · "));
      cap.appendChild(link);
    }
    lb.querySelector(".lb-count").textContent = (lbIndex + 1) + " / " + lbItems.length;
  }

  function show(i, fromRect) {
    var n = lbItems.length;
    lbIndex = ((i % n) + n) % n; // wrap around
    var a = lbItems[lbIndex];
    var media = lb.querySelector(".lb-media");
    media.innerHTML = "";
    media.classList.remove("is-short");
    if (a.getAttribute("data-lb") === "video") {
      var id = a.getAttribute("data-video-id");
      var f = document.createElement("iframe");
      f.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(id) + "?autoplay=1&rel=0&playsinline=1";
      f.title = captionOf(a) || "YouTube";
      f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
      f.allowFullscreen = true;
      f.referrerPolicy = "strict-origin-when-cross-origin";
      if (a.hasAttribute("data-short")) media.classList.add("is-short");
      media.appendChild(f);
    } else {
      var img = document.createElement("img");
      var thumb = a.querySelector("img");
      img.src = a.getAttribute("href");
      img.alt = thumb ? thumb.alt : "";
      media.appendChild(img);
      if (fromRect && !reduceMotion.matches) zoomFrom(img, fromRect);
    }
    labelLightbox();
    renderInfo();
  }

  // Grow the opened image out of the thumbnail that was clicked (FLIP).
  function zoomFrom(img, from) {
    function run() {
      var to = img.getBoundingClientRect();
      if (!to.width || !to.height) return;
      img.animate([
        { transform: "translate(" + (from.left - to.left) + "px," + (from.top - to.top) + "px) scale(" + (from.width / to.width) + "," + (from.height / to.height) + ")", opacity: 0.6 },
        { transform: "none", opacity: 1 }
      ], { duration: 380, easing: "cubic-bezier(0.2, 0, 0, 1)" });
    }
    if (img.complete && img.naturalWidth) run(); else img.addEventListener("load", run, { once: true });
  }

  function openLightbox(a) {
    if (!lb) buildLightbox();
    var group = a.closest("[data-lb-group]");
    lbItems = Array.prototype.slice.call((group || document).querySelectorAll("a[data-lb]"));
    if (!group) lbItems = [a];
    lbTrigger = a;
    lb.classList.toggle("single", lbItems.length < 2);
    var thumb = a.querySelector("img");
    lb.showModal();
    html.classList.add("lb-lock");
    show(lbItems.indexOf(a), thumb ? thumb.getBoundingClientRect() : null);
  }

  function closeLightbox() { if (lb && lb.open) lb.close(); }
  function cleanup() {
    lb.querySelector(".lb-media").innerHTML = ""; // stops a playing video
    html.classList.remove("lb-lock");
    if (lbTrigger) { lbTrigger.focus({ preventScroll: true }); lbTrigger = null; }
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest("a[data-lb]");
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (typeof HTMLDialogElement !== "function") return; // old browser: follow the link
    e.preventDefault();
    openLightbox(a);
  });

  /* ---- pagination ------------------------------------------------------------
     <div data-paginate="8"> around the items; a pager is added after it. */
  document.querySelectorAll("[data-paginate]").forEach(function (grid) {
    var per = parseInt(grid.getAttribute("data-paginate"), 10) || 8;
    var items = Array.prototype.slice.call(grid.children);
    var pages = Math.ceil(items.length / per);
    if (pages < 2) return;
    var pager = document.createElement("nav");
    pager.className = "pager";
    grid.after(pager);
    var current = 1;

    function go(p, focusPage) {
      current = Math.min(Math.max(p, 1), pages);
      items.forEach(function (el, i) { el.hidden = Math.floor(i / per) + 1 !== current; });
      render(focusPage);
    }
    function button(label, page, aria) {
      var b = document.createElement("button");
      b.type = "button"; b.textContent = label;
      b.setAttribute("data-page", page);
      if (aria) b.setAttribute("aria-label", aria);
      if (page === current && /^\d+$/.test(label)) b.setAttribute("aria-current", "page");
      return b;
    }
    function render(focusPage) {
      pager.innerHTML = "";
      pager.setAttribute("aria-label", t("pager"));
      if (current > 1) pager.appendChild(button(t("prev"), current - 1));
      for (var p = 1; p <= pages; p++) pager.appendChild(button(String(p), p, t("page") + " " + p));
      if (current < pages) pager.appendChild(button(t("next"), current + 1));
      if (focusPage) {
        var target = pager.querySelector('[aria-current="page"]');
        if (target) target.focus();
      }
    }
    pager.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-page]");
      if (b) go(parseInt(b.getAttribute("data-page"), 10), true);
    });
    document.addEventListener("evf:lang", function () { render(false); });
    go(1, false);
  });

  /* ---- contact form: send through Web3Forms --------------------------------
     <form action="https://api.web3forms.com/submit" method="POST" data-web3forms>
     with a hidden access_key, name, email, message and the botcheck honeypot.
     With JS the message is posted as JSON and the answer shows in the page;
     without JS the browser posts the form and Web3Forms shows its own page.
     Nothing reaches Web3Forms until the visitor presses send. */
  document.querySelectorAll("form[data-web3forms]").forEach(function (form) {
    var status = form.querySelector(".form-status");
    var button = form.querySelector('button[type="submit"]');
    function say(key, isError) {
      if (!status) return;
      status.textContent = t(key);
      status.classList.toggle("is-error", !!isError);
      status.setAttribute("data-key", key);
    }
    document.addEventListener("evf:lang", function () {
      var key = status && status.getAttribute("data-key");
      if (key) status.textContent = t(key);
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      if (!form.elements.access_key || !form.elements.access_key.value.trim()) { say("formNotSet", true); return; }
      var data = Object.fromEntries(new FormData(form));
      if (data.email) data.replyto = data.email;
      say("sending");
      if (button) button.disabled = true;
      fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data)
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok && j.success !== false }; }); })
        .then(function (res) {
          if (res.ok) { form.reset(); say("sent"); } else { say("failed", true); }
        })
        .catch(function () { say("failed", true); })
        .then(function () { if (button) button.disabled = false; });
    });
  });
})();
