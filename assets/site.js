/* Electric Van Fam - site behaviour. Plain JS, no dependencies, no build.

   Loaded at the end of <body>, after core/theme.js. Every feature degrades to
   plain HTML without JS: menu items are links, a video card links to YouTube, a
   photo links to its full-size file.

   Features (inspiration-site behaviour in brackets):
   - language: one page per language; the labels this script writes follow <html lang>
   - pickers: the language and the theme picker, each a button that opens its
     list of choices (WAI-ARIA disclosure); the theme is light by default
   - phone menu: dropdown panel under the header row (slide down / up)
   - sticky menu row: the title strip scrolls away, the menu row stays at the top
     (the inspiration site's header scrolls away whole)
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
      theme: "Colour theme", light: "Light", auto: "System", dark: "Dark",
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
      video: "Přehrávač videa", photo: "Prohlížeč fotek",
      formNotSet: "Formulář zatím není připojený. Napište nám prosím na Instagram.",
      sending: "Odesílám...",
      sent: "Děkujeme! Vaše zpráva je na cestě k nám.",
      failed: "Zprávu se nepodařilo odeslat. Zkuste to prosím znovu, nebo nám napište na Instagram."
    },
    de: {
      close: "Schließen", prev: "Zurück", next: "Weiter",
      watch: "Auf YouTube ansehen", view: "Auf Instagram ansehen",
      menuOpen: "Menü öffnen", menuClose: "Menü schließen",
      pager: "Galerieseiten", page: "Seite",
      theme: "Farbschema", light: "Hell", auto: "System", dark: "Dunkel",
      video: "Videoplayer", photo: "Fotoansicht",
      formNotSet: "Das Formular ist noch nicht eingerichtet. Schreib uns bitte auf Instagram.",
      sending: "Wird gesendet...",
      sent: "Danke! Deine Nachricht ist auf dem Weg zu uns.",
      failed: "Die Nachricht konnte nicht gesendet werden. Versuch es bitte noch einmal oder schreib uns auf Instagram."
    }
  };
  // The page's language is its <html lang>: each language has its own page, so
  // the strings are chosen once, at start.
  var S = STR[html.lang] || STR.en;
  function t(key) { return S[key] || STR.en[key]; }

  // The site opens light; a visitor switches to dark (or to the system's
  // setting) with the theme control, and that choice is remembered. theme.js
  // itself falls back to "auto", so the default is applied here. theme.js
  // renders its own toggle into its mount element; the site shows the theme
  // picker below instead, so init gets an id that no element carries.
  var DEFAULT_THEME = "light";
  if (window.persTheme) {
    var storedTheme = null;
    try { storedTheme = localStorage.getItem("pers-ui-theme"); } catch (e) {}
    persTheme.init({ mountId: "no-theme-mount" });
    if (!storedTheme && !new URLSearchParams(location.search).get("theme")) persTheme.set(DEFAULT_THEME);
  }

  /* ---- pickers: language and theme ------------------------------------------
     Markup: an element of class "picker" holds a button.picker-button with
     aria-expanded and aria-controls, and the list it controls (ul.picker-list,
     hidden) - the WAI-ARIA disclosure pattern. One picker is open at a time;
     Escape (focus back to its button), a click outside and focus moving out of
     the picker close it. */
  var pickers = [];
  function isOpen(p) { return p.button.getAttribute("aria-expanded") === "true"; }
  function setPicker(p, open) {
    p.button.setAttribute("aria-expanded", String(open));
    p.list.hidden = !open;
  }
  document.querySelectorAll(".picker").forEach(function (root) {
    var button = root.querySelector(".picker-button");
    var list = button && document.getElementById(button.getAttribute("aria-controls"));
    if (!list) return;
    var p = { root: root, button: button, list: list };
    pickers.push(p);
    setPicker(p, false);
    button.addEventListener("click", function () {
      var open = !isOpen(p);
      pickers.forEach(function (other) { if (other !== p) setPicker(other, false); });
      setPicker(p, open);
    });
    // Focus moving to an element outside the picker closes it. A click on
    // something that takes no focus (no relatedTarget) is left to the click
    // handler below, so a click on a choice still lands in every browser.
    root.addEventListener("focusout", function (e) {
      if (e.relatedTarget && !root.contains(e.relatedTarget)) setPicker(p, false);
    });
  });
  document.addEventListener("click", function (e) {
    pickers.forEach(function (p) { if (!p.root.contains(e.target)) setPicker(p, false); });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var open = pickers.filter(isOpen);
    if (!open.length) return;
    open.forEach(function (p) { setPicker(p, false); });
    open[0].button.focus();
    e.stopImmediatePropagation(); // the open picker takes this Escape, not the phone menu
  });

  // Language: the chosen language is remembered under the key the site root
  // reads, so the root sends the visitor back to it.
  (function () {
    var list = document.getElementById("lang-list");
    if (!list) return;
    list.addEventListener("click", function (e) {
      var a = e.target.closest("a[hreflang]");
      if (!a) return;
      try { localStorage.setItem("evf-lang", a.getAttribute("hreflang")); } catch (err) {}
    });
  })();

  // Theme: the button shows only the icon of the current mode (the sun, the
  // moon, or the half-filled circle for the system's setting), and its hidden
  // text names the mode with the word the list uses; the list holds the other
  // two. It drives theme.js through its API.
  (function () {
    var root = document.querySelector(".theme-picker");
    var p = pickers.filter(function (x) { return x.root === root; })[0];
    if (!p || !window.persTheme) return;
    var MODES = ["light", "auto", "dark"];
    var ICONS = { light: "i-sun", auto: "i-auto", dark: "i-moon" };
    function icon(mode) {
      return '<svg class="picker-icon" aria-hidden="true"><use href="#' + ICONS[mode] + '"/></svg>';
    }
    function hiddenText(text) { return '<span class="visually-hidden">' + text + "</span>"; }
    function current() {
      var mode = html.getAttribute("data-theme");
      return MODES.indexOf(mode) < 0 ? "auto" : mode;
    }
    p.list.innerHTML = MODES.map(function (mode) {
      return '<li><button class="picker-item" type="button" data-mode="' + mode + '">' +
        icon(mode) + "<span>" + t(mode) + "</span></button></li>";
    }).join("");
    function render() {
      var mode = current();
      p.button.innerHTML = hiddenText(t("theme") + ": " + t(mode)) + icon(mode) +
        '<svg class="picker-chevron" aria-hidden="true"><use href="#i-chevron"/></svg>';
      p.list.querySelectorAll("button[data-mode]").forEach(function (b) {
        b.parentNode.hidden = b.getAttribute("data-mode") === mode;
      });
    }
    p.list.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-mode]");
      if (!b) return;
      persTheme.set(b.getAttribute("data-mode"));
      render();
      setPicker(p, false);
      p.button.focus();
    });
    render();
  })();

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

  /* ---- sticky menu row ----------------------------------------------------- */
  // The header is sticky with top = minus the top strip's height (site.css), so
  // the strip scrolls away and the menu row stays. The strip's height changes
  // with the width and when the title image loads, so it is kept current.
  (function () {
    var strip = document.querySelector(".header-top");
    if (!strip) return;
    function measure() {
      html.style.setProperty("--header-top-h", strip.getBoundingClientRect().height + "px");
    }
    measure();
    if ("ResizeObserver" in window) new ResizeObserver(measure).observe(strip, { box: "border-box" });
    else window.addEventListener("resize", measure);
  })();

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
     data-video-id, data-short for a vertical Short). Optional data-caption and
     data-source (a link shown under the item). The whole
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
  }

  function labelLightbox() {
    if (!lb) return;
    lb.querySelector(".lb-close").setAttribute("aria-label", t("close"));
    lb.querySelector(".lb-prev").setAttribute("aria-label", t("prev"));
    lb.querySelector(".lb-next").setAttribute("aria-label", t("next"));
    var item = lbItems[lbIndex];
    lb.setAttribute("aria-label", t(item && item.getAttribute("data-lb") === "video" ? "video" : "photo"));
  }

  function captionOf(a) {
    return a.getAttribute("data-caption") || "";
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
    }
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
