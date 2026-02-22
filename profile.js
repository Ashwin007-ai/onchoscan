/* OnchoScan — profile.js
   Matches profile.html exactly:
   - Tabs use data-tab + is-active class
   - Panels use id="pnl-X" + is-active class
   - Sidebar stats: sdTotal, sdReports
   - Overview stats: stTotal, stHigh, stLow
   - Role badge class: prf-role-doctor / prf-role-patient / etc.
   - Modal inputs: prf-minp
   All profile data read/written to server via /profile endpoint.
*/
(function () {
  var API   = "https://onchoscan-api.onrender.com";
  var token = localStorage.getItem("oncho_token");

  var SPECS = {
    doctor:     ["Radiology","Oncology","Neurology","Dermatology","Pathology","General Medicine","Surgery","Pediatrics"],
    researcher: ["AI / ML","Genomics","Epidemiology","Biostatistics","Medical Imaging","Clinical Trials"],
    patient:    ["Brain Tumor","Skin Cancer","Both"]
  };

  /* ── helpers ──────────────────────────────────────────── */
  function $id(id) { return document.getElementById(id); }
  function val(id) { var e = $id(id); return e ? e.value : ""; }
  function set(id, v) { var e = $id(id); if (e) e.textContent = v; }
  function esc(s)  { return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

  function authHdr() {
    return { "Authorization": "Bearer " + token, "Content-Type": "application/json" };
  }

  function toast(msg, type) {
    if (window.Toast) {
      if (type === "ok")   window.Toast.success("", msg);
      else if (type === "warn") window.Toast.warning("", msg);
      else window.Toast.info("", msg);
    }
  }

  /* ── server calls ─────────────────────────────────────── */
  async function fetchProfile() {
    var r = await fetch(API + "/profile", { headers: authHdr() });
    if (r.status === 401) { localStorage.clear(); window.location.href = API + "/"; return null; }
    if (!r.ok) throw new Error("Profile fetch failed");
    return await r.json();
  }

  async function pushProfile(data) {
    var r = await fetch(API + "/profile", {
      method: "PUT", headers: authHdr(), body: JSON.stringify(data)
    });
    if (!r.ok) { var e = await r.json().catch(function(){return {};}); throw new Error(e.detail || "Save failed"); }
    return true;
  }

  /* ── avatar ───────────────────────────────────────────── */
  function renderAvatar(url, name) {
    var initials = (name||"U").trim().split(/\s+/).map(function(w){return w[0];}).join("").toUpperCase().slice(0,2);
    var imgHtml  = url ? '<img src="'+url+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">' : null;
    var circle = $id("avCircle");
    var navAv  = $id("navAvatar");
    if (circle) { if (imgHtml) circle.innerHTML = imgHtml; else circle.textContent = initials; }
    if (navAv)  { if (imgHtml) navAv.innerHTML  = imgHtml; else navAv.textContent  = initials; }
  }

  function initAvatar(profile) {
    var inp = $id("avInput");
    var btn = $id("avBtn");
    if (!btn || !inp) return;
    btn.addEventListener("click", function () { inp.click(); });
    inp.addEventListener("change", function () {
      var file = inp.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { toast("Max 2 MB for avatar", "warn"); return; }
      var reader = new FileReader();
      reader.onload = async function (e) {
        var url = e.target.result;
        renderAvatar(url, profile.full_name);
        try {
          await pushProfile({ avatar: url });
          profile.avatar = url;
          toast("Avatar updated ✓", "ok");
        } catch (err) { toast("Could not save avatar: " + err.message, "warn"); }
      };
      reader.readAsDataURL(file);
    });
  }

  /* ── tabs ─────────────────────────────────────────────── */
  function initTabs() {
    var btns   = document.querySelectorAll(".prf-tab");
    var panels = document.querySelectorAll(".prf-panel");
    function activate(tabName) {
      btns.forEach(function(b) {
        b.classList.toggle("is-active", b.dataset.tab === tabName);
      });
      panels.forEach(function(p) {
        p.classList.toggle("is-active", p.id === "pnl-" + tabName);
      });
    }
    btns.forEach(function(btn) {
      btn.addEventListener("click", function() { activate(btn.dataset.tab); });
    });
    // open Overview by default
    activate("overview");
  }

  /* ── populate sidebar & nav ───────────────────────────── */
  function populateShell(p) {
    var name = p.full_name || p.username || "User";
    set("prfName",    name);
    set("prfHandle",  "@" + (p.username || ""));
    set("memberSince","Member since " + (p.join_date || "–"));
    set("sdTotal",    p.total_scans || 0);
    set("sdReports",  p.total_scans || 0);

    var navNm = $id("navUsername"); if (navNm) navNm.textContent = name;
    localStorage.setItem("oncho_name", name);
    renderRoleBadge(p.role || "");
    renderAvatar(p.avatar || "", name);
  }

  /* ── role badge ───────────────────────────────────────── */
  function renderRoleBadge(role) {
    var badge = $id("prfRoleBadge");
    if (!badge) return;
    var labels = { doctor:"👨‍⚕️ Doctor", patient:"🩺 Patient", researcher:"🔬 Researcher" };
    badge.textContent = labels[role] || "User";
    badge.className   = "prf-role-badge prf-role-" + (role || "other");
  }

  /* ── scan stats ───────────────────────────────────────── */
  async function loadStats() {
    try {
      var r    = await fetch(API + "/history", { headers: authHdr() });
      if (!r.ok) return;
      var data = await r.json();
      var list = data.history || [];
      var high = list.filter(function(x){ return x.risk_level === "High Risk";  }).length;
      var low  = list.filter(function(x){ return x.risk_level === "Low Risk";   }).length;

      set("stTotal",  list.length);
      set("stHigh",   high);
      set("stLow",    low);
      set("sdTotal",  list.length);
      set("sdReports",list.length);

      var ul = $id("recentList");
      if (!ul) return;
      if (!list.length) {
        ul.innerHTML = '<p class="prf-empty">No scans yet. <a href="/app/dashboard.html">Run your first scan →</a></p>';
        return;
      }
      ul.innerHTML = list.slice(0, 6).map(function (r) {
        var rc  = r.risk_level === "High Risk" ? "high" : r.risk_level === "Medium Risk" ? "med" : "low";
        var col = rc==="high" ? "#ff4f7b" : rc==="med" ? "#ffb84f" : "#4fffb0";
        var bg  = rc==="high" ? "rgba(255,79,123,.12)" : rc==="med" ? "rgba(255,184,79,.12)" : "rgba(79,255,176,.11)";
        var ico = r.cancer_type === "brain" ? "🧠" : "🔬";
        var dt  = new Date(r.timestamp).toLocaleDateString([], {month:"short",day:"numeric",year:"numeric"});
        return '<div class="prf-act-row">' +
          '<div class="prf-act-ico" style="background:'+bg+'">'+ico+'</div>' +
          '<div class="prf-act-info">' +
            '<div class="prf-act-title">'+esc(r.prediction)+'</div>' +
            '<div class="prf-act-sub">'+r.cancer_type.toUpperCase()+' · '+dt+'</div>' +
          '</div>' +
          '<span class="prf-risk-chip prf-risk-'+rc+'" style="background:'+bg+';color:'+col+'">'+r.risk_level+'</span>' +
        '</div>';
      }).join("");
    } catch(e) { console.warn("loadStats error:", e); }
  }

  /* ── personal form ────────────────────────────────────── */
  function initPersonal(profile) {
    // populate fields
    var map = { pfName:"full_name", pfEmail:"email", pfPhone:"phone", pfDob:"dob",
                pfGender:"gender", pfRole:"role", pfOrg:"org",
                pfCity:"city", pfCountry:"country", pfBio:"bio" };
    var pu = $id("pfUser"); if (pu) pu.value = profile.username || "";
    Object.keys(map).forEach(function(id) {
      var el = $id(id); if (el) el.value = profile[map[id]] || "";
    });

    // spec chips
    var savedSpecs = [];
    try { savedSpecs = JSON.parse(profile.specs || "[]"); } catch(e) {}
    buildChips(profile.role || "", savedSpecs);

    // role change → rebuild chips
    var roleEl = $id("pfRole");
    if (roleEl) roleEl.addEventListener("change", function() {
      buildChips(this.value, []);
      renderRoleBadge(this.value);
    });

    // save
    var saveBtn = $id("pfSave");
    if (!saveBtn) return;
    saveBtn.addEventListener("click", async function() {
      saveBtn.disabled = true; saveBtn.textContent = "Saving…";
      var specs = [];
      document.querySelectorAll(".prf-spec-chip.on").forEach(function(c){ specs.push(c.dataset.v); });
      var data = {
        full_name: val("pfName"),  email:   val("pfEmail"),
        phone:     val("pfPhone"), dob:     val("pfDob"),
        gender:    val("pfGender"),role:    val("pfRole"),
        org:       val("pfOrg"),   city:    val("pfCity"),
        country:   val("pfCountry"),bio:   val("pfBio"),
        specs:     JSON.stringify(specs)
      };
      try {
        await pushProfile(data);
        if (data.full_name) {
          localStorage.setItem("oncho_name", data.full_name);
          set("prfName", data.full_name);
          var navNm = $id("navUsername"); if (navNm) navNm.textContent = data.full_name;
        }
        renderRoleBadge(data.role);
        var ok = $id("pfSaveOk");
        if (ok) { ok.style.display = "flex"; setTimeout(function(){ ok.style.display = "none"; }, 3000); }
        toast("Profile saved ✓", "ok");
      } catch(err) {
        toast("Error: " + err.message, "warn");
      } finally {
        saveBtn.disabled = false; saveBtn.textContent = "Save Changes";
      }
    });
  }

  function buildChips(role, selected) {
    var wrap = $id("specWrap");
    var sec  = $id("specSec");
    if (!wrap || !sec) return;
    var pool = SPECS[role];
    if (!pool) { sec.style.display = "none"; return; }
    sec.style.display = "block";
    wrap.innerHTML = pool.map(function(s) {
      var on = selected.indexOf(s) > -1;
      return '<button type="button" class="prf-spec-chip'+(on?" on":"")+'" data-v="'+esc(s)+'">'+esc(s)+'</button>';
    }).join("");
    wrap.querySelectorAll(".prf-spec-chip").forEach(function(c) {
      c.addEventListener("click", function(){ c.classList.toggle("on"); });
    });
  }

  /* ── preferences ──────────────────────────────────────── */
  function initPrefs(profile) {
    var prefs = {};
    try { prefs = JSON.parse(profile.prefs || "{}"); } catch(e) {}
    ["pref1","pref2","pref3","pref4","pref5"].forEach(function(id) {
      var el = $id(id); if (!el) return;
      el.checked = prefs[id] !== false; // default ON
      el.addEventListener("change", async function() {
        prefs[id] = el.checked;
        try { await pushProfile({ prefs: JSON.stringify(prefs) }); }
        catch(e) { console.warn("prefs save:", e); }
      });
    });
    var themeBtn = $id("themeInPrefs");
    if (themeBtn && window.ThemeToggle) themeBtn.addEventListener("click", function(){ window.ThemeToggle.toggle(); });
  }

  /* ── security ─────────────────────────────────────────── */
  function initSecurity(profile) {
    var ll = $id("lastLogin");
    if (ll && profile.last_login) {
      try { ll.textContent = new Date(profile.last_login).toLocaleString(); }
      catch(e) { ll.textContent = profile.last_login; }
    }

    var modal     = $id("pwModal");
    var openBtn   = $id("openPwModal");
    var cancelBtn = $id("pwCancel");
    var saveBtn   = $id("pwSave");

    function closePw() { modal.classList.remove("prf-open"); clearPwFields(); }

    if (openBtn)   openBtn.addEventListener("click",   function(){ modal.classList.add("prf-open"); });
    if (cancelBtn) cancelBtn.addEventListener("click",  closePw);
    if (modal)     modal.addEventListener("click", function(e){ if (e.target === modal) closePw(); });

    if (saveBtn) saveBtn.addEventListener("click", async function() {
      var cur = val("pwCur"), nw = val("pwNew"), cn = val("pwCnf");
      if (!cur || !nw)    { toast("Fill all fields", "warn"); return; }
      if (nw.length < 6)  { toast("Minimum 6 characters", "warn"); return; }
      if (nw !== cn)      { toast("Passwords don't match", "warn"); return; }
      saveBtn.textContent = "Saving…"; saveBtn.disabled = true;
      try {
        var r = await fetch(API + "/change-password", {
          method: "POST", headers: authHdr(),
          body: JSON.stringify({ current_password: cur, new_password: nw })
        });
        var d = await r.json();
        if (!r.ok) throw new Error(d.detail || "Failed");
        toast("Password updated ✓", "ok");
        closePw();
      } catch(err) { toast("Error: " + err.message, "warn"); }
      finally { saveBtn.textContent = "Update Password"; saveBtn.disabled = false; }
    });
  }

  function clearPwFields() {
    ["pwCur","pwNew","pwCnf"].forEach(function(id){ var e=$id(id); if(e) e.value=""; });
  }

  /* ── danger zone ──────────────────────────────────────── */
  function initDanger(profile) {
    var username = profile.username || "DELETE";
    set("delHint", username.toUpperCase());

    // export
    var expBtn = $id("exportBtn");
    if (expBtn) expBtn.addEventListener("click", function() {
      var clean = Object.assign({}, profile); delete clean.hashed_password;
      var blob = new Blob([JSON.stringify(clean, null, 2)], {type:"application/json"});
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = "onchoscan_profile.json"; a.click();
      toast("Data exported ✓", "ok");
    });

    // delete account modal
    var delModal   = $id("delModal");
    var openBtn    = $id("openDelModal");
    var cancelBtn  = $id("delCancel");
    var confirmBtn = $id("delConfirm");
    var delInp     = $id("delInput");

    function closeDel() { delModal.classList.remove("prf-open"); if (delInp) delInp.value = ""; if (confirmBtn) confirmBtn.classList.remove("armed"); }

    if (openBtn)   openBtn.addEventListener("click",   function(){ delModal.classList.add("prf-open"); });
    if (cancelBtn) cancelBtn.addEventListener("click",  closeDel);
    if (delModal)  delModal.addEventListener("click",  function(e){ if (e.target === delModal) closeDel(); });

    if (delInp) delInp.addEventListener("input", function() {
      var match = delInp.value.trim().toUpperCase() === username.toUpperCase();
      if (confirmBtn) confirmBtn.classList.toggle("armed", match);
    });

    if (confirmBtn) confirmBtn.addEventListener("click", async function() {
      if (!this.classList.contains("armed")) return;
      this.textContent = "Deleting…"; this.disabled = true;
      try {
        var r = await fetch(API + "/account", { method: "DELETE", headers: authHdr() });
        if (!r.ok) throw new Error("Server error");
        localStorage.clear();
        window.location.href = API + "/";
      } catch(err) {
        toast("Error: " + err.message, "warn");
        this.textContent = "Delete Forever"; this.disabled = false;
      }
    });
  }

  /* ── MAIN INIT ────────────────────────────────────────── */
  document.addEventListener("DOMContentLoaded", async function() {
    if (!token) { window.location.href = API + "/"; return; }

    // logout
    var logoutBtn = $id("logoutBtn");
    if (logoutBtn) logoutBtn.addEventListener("click", function(){ localStorage.clear(); window.location.href = API + "/"; });

    // navbar avatar/name → profile page (other pages)
    function makeProfileLink(el) {
      if (!el || window.location.pathname.includes("profile")) return;
      el.style.cursor = "pointer"; el.title = "My Profile";
      el.addEventListener("click", function(){ window.location.href = "/app/profile.html"; });
    }
    makeProfileLink($id("navAvatar"));
    makeProfileLink($id("navUsername"));

    // init tabs first so page is interactive immediately
    initTabs();

    // fetch profile from server
    var profile;
    try {
      profile = await fetchProfile();
    } catch(e) {
      toast("Could not load profile from server", "warn");
      return;
    }
    if (!profile) return; // redirected to login

    // populate everything
    populateShell(profile);
    initAvatar(profile);
    initPersonal(profile);
    initPrefs(profile);
    initSecurity(profile);
    initDanger(profile);
    await loadStats();
  });

})();
