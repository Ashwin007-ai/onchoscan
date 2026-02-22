/* OnchoScan — features.js  |  Toast + Notification Panel + Theme Toggle */

/* ── TOAST ─────────────────────────────────────────────────── */
var Toast = (function () {
  var wrap = null;
  var ICONS = { success:"✅", error:"❌", warning:"⚠️", info:"ℹ️" };

  function mount() {
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "toastWrap";
      document.body.appendChild(wrap);
    }
    return wrap;
  }

  function show(title, msg, type, ms) {
    type = type || "info";
    ms   = ms === undefined ? 4500 : ms;
    var w  = mount();
    var el = document.createElement("div");
    el.className = "ot ot-" + type;
    el.innerHTML =
      '<span class="ot-icon">' + (ICONS[type]||"ℹ️") + '</span>' +
      '<div class="ot-body"><div class="ot-title">' + title + '</div>' +
      (msg ? '<div class="ot-msg">' + msg + '</div>' : '') + '</div>' +
      '<button class="ot-x">\u2715</button>' +
      (ms > 0 ? '<div class="ot-bar" style="animation-duration:' + ms + 'ms"></div>' : '');
    el.querySelector(".ot-x").onclick = function(){ bye(el); };
    w.appendChild(el);
    if (ms > 0) setTimeout(function(){ bye(el); }, ms);
  }

  function bye(el) {
    if (!el.parentNode) return;
    el.classList.add("ot-out");
    el.addEventListener("animationend", function(){ if(el.parentNode) el.remove(); }, {once:true});
  }

  return {
    show:    show,
    success: function(t,m,d){ show(t,m,"success",d); },
    error:   function(t,m,d){ show(t,m,"error",d);   },
    warning: function(t,m,d){ show(t,m,"warning",d); },
    info:    function(t,m,d){ show(t,m,"info",d);    },
  };
})();


/* ── NOTIFICATION PANEL ────────────────────────────────────── */
var NotifPanel = (function () {
  var SK    = "oncho_notifs";
  var open  = false;
  var panel = null;
  var body  = null;
  var back  = null;

  function load() {
    try{ return JSON.parse(localStorage.getItem(SK))||[]; } catch(e){ return []; }
  }
  function save(a){ localStorage.setItem(SK, JSON.stringify(a)); }

  function add(title, msg, icon) {
    icon = icon || "🔔";
    var a = load();
    a.unshift({ id:Date.now(), title:title, msg:msg, icon:icon,
      time: new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),
      unread:true });
    if (a.length > 30) a.pop();
    save(a);
    badge();
    if (panel) renderItems();
  }

  function badge() {
    var el = document.getElementById("notifBadge");
    if (!el) return;
    var n = load().filter(function(x){ return x.unread; }).length;
    if (n > 0) { el.textContent = n > 99 ? "99+" : String(n); el.className = "notif-badge show"; }
    else        { el.textContent = ""; el.className = "notif-badge"; }
  }

  function renderItems() {
    if (!body) return;
    var a = load();
    if (!a.length) {
      body.innerHTML =
        '<div class="np-empty">' +
        '<div style="font-size:2rem;margin-bottom:10px;opacity:.5">🔔</div>' +
        '<div style="font-weight:600;margin-bottom:4px;color:var(--np-sub)">No notifications</div>' +
        '<div style="font-size:.78rem;color:var(--np-time)">Scan results will show here</div>' +
        '</div>';
      return;
    }
    body.innerHTML = a.map(function(n) {
      var bg  = n.icon==="🚨" ? "rgba(255,79,123,.16)"  : n.icon==="⚠️" ? "rgba(255,184,79,.16)" : n.icon==="✅" ? "rgba(79,255,176,.13)" : "rgba(0,212,255,.13)";
      var bar = n.icon==="🚨" ? "#ff4f7b"               : n.icon==="⚠️" ? "#ffb84f"              : n.icon==="✅" ? "#4fffb0"              : "#00d4ff";
      return '<div class="np-row' + (n.unread?" np-unread":"") + '"' +
        (n.unread ? ' style="border-left:3px solid '+bar+';"' : '') + '>' +
        '<div class="np-ico" style="background:' + bg + '">' + n.icon + '</div>' +
        '<div class="np-txt">' +
          '<div class="np-top"><span class="np-ttl">' + n.title + '</span><span class="np-time">' + n.time + '</span></div>' +
          '<div class="np-sub">' + n.msg + '</div>' +
        '</div>' +
        (n.unread ? '<div class="np-dot"></div>' : '') +
        '</div>';
    }).join("");
  }

  function markRead() {
    save(load().map(function(n){ return Object.assign({},n,{unread:false}); }));
    badge();
    var sub = document.getElementById("npSub");
    if (sub) sub.textContent = "All caught up";
  }

  function build() {
    if (panel) return;
    back = document.createElement("div");
    back.id = "npBack";
    back.onclick = close;
    document.body.appendChild(back);

    panel = document.createElement("div");
    panel.id = "npPanel";
    panel.innerHTML =
      '<div id="npArrow"></div>' +
      '<div class="np-head">' +
        '<div><div class="np-h-title">Notifications</div><div class="np-h-sub" id="npSub">All caught up</div></div>' +
        '<button class="np-clr" id="npClr">Clear all</button>' +
      '</div>' +
      '<div class="np-items" id="npItems"></div>' +
      '<div class="np-foot">Stored locally on this device</div>';
    document.body.appendChild(panel);

    body = document.getElementById("npItems");
    document.getElementById("npClr").onclick = function(e){
      e.stopPropagation(); save([]); badge(); renderItems();
      var s=document.getElementById("npSub"); if(s) s.textContent="All caught up";
    };
  }

  function position() {
    var bell = document.getElementById("notifBell");
    if (!bell || !panel) return;
    var r = bell.getBoundingClientRect();
    var W = 360, gap = 10;
    var top  = r.bottom + gap;
    var left = r.right  - W;
    if (left < 8) left = 8;
    if (left + W > window.innerWidth - 8) left = window.innerWidth - W - 8;
    panel.style.top  = top  + "px";
    panel.style.left = left + "px";
    var arrow = document.getElementById("npArrow");
    if (arrow) arrow.style.left = Math.max(10, ((r.left+r.right)/2) - left - 7) + "px";
  }

  function openPanel() {
    build();
    renderItems();
    var u = load().filter(function(x){return x.unread;}).length;
    var sub = document.getElementById("npSub");
    if (sub) sub.textContent = u > 0 ? u+" unread" : "All caught up";
    position();
    panel.classList.add("np-open");
    back.classList.add("np-back-on");
    open = true;
    setTimeout(markRead, 500);
  }

  function close() {
    if (panel) panel.classList.remove("np-open");
    if (back)  back.classList.remove("np-back-on");
    open = false;
  }

  function init() {
    badge();
    var bell = document.getElementById("notifBell");
    if (bell) bell.addEventListener("click", function(e){
      e.stopPropagation();
      open ? close() : openPanel();
    });
    window.addEventListener("resize", function(){ if(open) position(); });
    window.addEventListener("scroll", function(){ if(open) position(); }, true);
  }

  return { init:init, add:add };
})();


/* ── THEME TOGGLE ───────────────────────────────────────────── */
var ThemeToggle = (function () {
  var STORAGE_KEY = "oncho_theme";
  var DARK  = "dark";
  var LIGHT = "light";

  /* Read saved preference, default to dark */
  function getSaved() {
    return localStorage.getItem(STORAGE_KEY) || DARK;
  }

  /* Apply theme to <body> and update every toggle button's icon */
  function apply(theme) {
    if (theme === LIGHT) {
      document.body.classList.add("light");
    } else {
      document.body.classList.remove("light");
    }
    /* Clean up flash-prevention class from <html> */
    document.documentElement.classList.remove("preload-light");
    /* Update all toggle buttons on the page */
    document.querySelectorAll(".theme-toggle").forEach(function(btn) {
      btn.textContent = theme === LIGHT ? "🌙" : "☀️";
      btn.title       = theme === LIGHT ? "Switch to dark mode" : "Switch to light mode";
    });
  }

  /* Toggle between dark and light */
  function toggle() {
    var current = getSaved();
    var next    = current === DARK ? LIGHT : DARK;
    localStorage.setItem(STORAGE_KEY, next);
    apply(next);
  }

  /* Wire up every .theme-toggle button already in the DOM */
  function init() {
    var saved = getSaved();
    apply(saved);                        /* apply on load, no flash */
    document.querySelectorAll(".theme-toggle").forEach(function(btn) {
      btn.addEventListener("click", toggle);
    });
  }

  return { init: init, toggle: toggle };
})();


/* ── INIT ───────────────────────────────────────────────────── */
/* Apply theme immediately (before DOMContentLoaded) to prevent flash */
(function(){
  var t = localStorage.getItem("oncho_theme");
  if (t === "light") document.documentElement.style.setProperty("--_pre","1");
  /* actual class applied after body exists */
})();

document.addEventListener("DOMContentLoaded", function(){
  ThemeToggle.init();
  NotifPanel.init();
});

window.Toast       = Toast;
window.NotifPanel  = NotifPanel;
window.ThemeToggle = ThemeToggle;