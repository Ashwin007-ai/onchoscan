const API   = "https://onchoscan-api.onrender.com";
const token = localStorage.getItem("oncho_token");

// Auth guard
if (!token) {
  window.location.replace("/app/index.html");
}

// Logout
window.logout = function() {
  localStorage.clear();
  window.location.replace("/app/index.html");
};

var selectedType = "brain";

window.addEventListener("load", async function() {

  // ── Nav: load user info from server ────────────────────────────────────────
  var av = document.getElementById("navAvatar");
  var nm = document.getElementById("navUsername");

  // Use cached name first for instant render
  var cachedName = localStorage.getItem("oncho_name") || "User";
  if (av) av.textContent = cachedName[0].toUpperCase();
  if (nm) nm.textContent = cachedName;

  // Then fetch latest from server (picks up profile changes)
  try {
    var res  = await fetch(API + "/profile", { headers: { "Authorization": "Bearer " + token } });
    if (res.status === 401) { window.logout(); return; }
    var data = await res.json();
    var name = data.full_name || data.username || "User";
    localStorage.setItem("oncho_name", name);
    if (nm) nm.textContent = name;
    if (av) {
      if (data.avatar) {
        av.innerHTML = '<img src="'+data.avatar+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
      } else {
        av.textContent = name[0].toUpperCase();
      }
    }
  } catch(e) { /* server not reachable, keep cached */ }

  // ── Clicking avatar or name opens profile ────────────────────────────────
  function makeProfileLink(el) {
    if (!el) return;
    el.style.cursor = "pointer";
    el.title = "My Profile";
    el.addEventListener("click", function(){ window.location.href = "/app/profile.html"; });
  }
  makeProfileLink(av);
  makeProfileLink(nm);

  // ── Logout btn ───────────────────────────────────────────────────────────
  var logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", window.logout);

  // ── Dashboard only ────────────────────────────────────────────────────────
  var fileInput  = document.getElementById("fileInput");
  var predictBtn = document.getElementById("predictBtn");
  if (!fileInput || !predictBtn) return;

  // Cancer type
  document.getElementById("opt-brain").addEventListener("click", function() {
    selectedType = "brain";
    document.getElementById("opt-brain").classList.add("active");
    document.getElementById("opt-skin").classList.remove("active");
  });
  document.getElementById("opt-skin").addEventListener("click", function() {
    selectedType = "skin";
    document.getElementById("opt-skin").classList.add("active");
    document.getElementById("opt-brain").classList.remove("active");
  });

  // File preview
  fileInput.addEventListener("change", function() {
    if (!this.files[0]) return;
    var preview = document.getElementById("preview");
    preview.src = URL.createObjectURL(this.files[0]);
    preview.classList.remove("hidden");
    document.getElementById("dzContent").classList.add("hidden");
  });

  // Drag and drop
  var dropzone = document.getElementById("dropzone");
  dropzone.addEventListener("dragover",  function(e) { e.preventDefault(); dropzone.style.borderColor = "var(--accent)"; });
  dropzone.addEventListener("dragleave", function()  { dropzone.style.borderColor = ""; });
  dropzone.addEventListener("drop", function(e) {
    e.preventDefault();
    dropzone.style.borderColor = "";
    var file = e.dataTransfer.files[0];
    if (!file) return;
    var dt = new DataTransfer(); dt.items.add(file); fileInput.files = dt.files;
    var preview = document.getElementById("preview");
    preview.src = URL.createObjectURL(file);
    preview.classList.remove("hidden");
    document.getElementById("dzContent").classList.add("hidden");
  });

  // Predict
  predictBtn.addEventListener("click", async function(e) {
    e.preventDefault();
    e.stopPropagation();

    if (!fileInput.files || !fileInput.files[0]) {
      alert("Please select an image first.");
      return;
    }

    predictBtn.disabled = true;
    predictBtn.querySelector("span").textContent = "Analyzing…";
    document.getElementById("loadingBar").classList.remove("hidden");
    document.getElementById("resultsPanel").classList.add("hidden");

    try {
      var fd = new FormData();
      fd.append("file", fileInput.files[0]);
      fd.append("cancer_type", selectedType);
      if (window.PatientNotes) window.PatientNotes.getFormData(fd);

      var res = await fetch(API + "/predict", {
        method: "POST",
        headers: { "Authorization": "Bearer " + token },
        body: fd
      });

      if (res.status === 401) { alert("Session expired."); window.logout(); return; }
      var r = await res.json();
      if (r.error) { alert("Error: " + r.error); return; }
      displayResults(r);
      if (window.PatientNotes) window.PatientNotes.showInResults(r);

      // ── Notifications ──────────────────────────────────────────────────────
      var isHigh = r.risk_level === "High Risk";
      var isMed  = r.risk_level === "Medium Risk";
      var icon   = isHigh ? "🚨" : isMed ? "⚠️" : "✅";
      var type   = isHigh ? "error" : isMed ? "warning" : "success";
      var title  = "Scan Complete";
      var msg    = (r.cancer_type === "brain" ? "🧠 Brain" : "🔬 Skin") +
                   " · " + r.prediction + " · " + r.risk_level +
                   " (" + r.confidence + "%)";

      // Toast pop-up
      if (window.Toast) window.Toast[type](title, msg);

      // Bell panel entry
      if (window.NotifPanel) window.NotifPanel.add(title, msg, icon);

      // Extra prominent alert for High Risk
      if (isHigh && window.Toast) {
        setTimeout(function() {
          window.Toast.error("⚠️ High Risk Detected", "Please review the diagnostic report immediately.", 7000);
        }, 600);
      }

    } catch(err) {
      console.error(err);
      alert("Server error. Is the backend running at " + API + "?");
    } finally {
      predictBtn.disabled = false;
      predictBtn.querySelector("span").textContent = "Run Analysis";
      if (window.PatientNotes) window.PatientNotes.clear();
      document.getElementById("loadingBar").classList.add("hidden");
    }
  });

});

function displayResults(r) {
  // Hide empty state, show results
  var es = document.getElementById("emptyState");
  if (es) es.style.display = "none";
  document.getElementById("resultsPanel").classList.remove("hidden");
  document.getElementById("predictionDisplay").textContent = r.prediction;
  document.getElementById("confText").textContent = r.confidence + "%";
  setTimeout(function() { document.getElementById("confBar").style.width = r.confidence + "%"; }, 50);

  var badge = document.getElementById("riskBadge");
  badge.textContent = r.risk_level;
  badge.className = "risk-badge " + (r.risk_level === "High Risk" ? "high" : r.risk_level === "Medium Risk" ? "medium" : "low");

  renderGauge(r.risk_score, r.risk_level);
  document.getElementById("diagnosticText").innerHTML = r.diagnostic_text;

  var probWrap = document.getElementById("probBars");
  probWrap.innerHTML = Object.entries(r.class_probabilities)
    .sort(function(a,b) { return b[1]-a[1]; })
    .map(function(entry) {
      return '<div class="prob-row"><span class="prob-label">' + entry[0] + '</span>' +
        '<div class="prob-bar-wrap"><div class="prob-bar-fill" style="width:0%" data-w="' + entry[1] + '"></div></div>' +
        '<span class="prob-pct">' + entry[1] + '%</span></div>';
    }).join("");
  setTimeout(function() {
    probWrap.querySelectorAll(".prob-bar-fill").forEach(function(el) { el.style.width = el.dataset.w + "%"; });
  }, 50);

  document.getElementById("originalImg").src = API + "/" + r.original;
  document.getElementById("heatmapImg").src  = API + "/" + r.heatmap;
  document.getElementById("suggestionsList").innerHTML = (r.suggestions || []).map(function(s) { return "<li>" + s + "</li>"; }).join("");
  document.getElementById("reportLink").href = API + "/" + r.report;
  document.getElementById("resultsPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderGauge(score, level) {
  var color = level === "High Risk" ? "#ff4f7b" : level === "Medium Risk" ? "#ffb84f" : "#4fffb0";
  var dash  = ((score / 100) * 180 / 180 * 251.2).toFixed(1);
  var angle = (score / 100) * 180;
  document.getElementById("gaugeWrap").innerHTML =
    '<svg viewBox="0 0 200 110" width="200" height="110">' +
    '<path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="16" stroke-linecap="round"/>' +
    '<path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="' + color + '33" stroke-width="16" stroke-linecap="round"/>' +
    '<path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="' + color + '" stroke-width="16" stroke-linecap="round" stroke-dasharray="' + dash + ' 251.2"/>' +
    '<g transform="translate(100,100) rotate(' + (angle-90) + ')">' +
    '<line x1="0" y1="0" x2="0" y2="-72" stroke="' + color + '" stroke-width="2.5" stroke-linecap="round"/>' +
    '<circle cx="0" cy="0" r="6" fill="' + color + '"/></g>' +
    '<text x="100" y="92" text-anchor="middle" fill="' + color + '" font-size="22" font-weight="700" font-family="Space Grotesk">' + score + '</text>' +
    '<text x="100" y="108" text-anchor="middle" fill="#8bacc8" font-size="10" font-family="Space Grotesk">RISK SCORE</text></svg>';
}
