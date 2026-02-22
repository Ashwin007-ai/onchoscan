/* ═══════════════════════════════════════════════════════════
   OnchoScan — patient_notes.js
   Patient Notes feature — fully self-contained.
   Exposes window.PatientNotes with:
     .getFormData()  → appends note fields to a FormData object
     .showInResults(data) → renders saved note in results panel
     .clear()        → resets all fields after submission
   ═══════════════════════════════════════════════════════════ */

var PatientNotes = (function () {

  var MAX_CHARS = 500;

  var SYMPTOMS = [
    "Headache", "Vision changes", "Seizures", "Nausea",
    "Memory loss", "Skin lesion", "Itching", "Bleeding",
    "Color change", "Fatigue", "Weight loss", "Dizziness"
  ];

  /* ── Build the notes UI and inject it into .upload-card ── */
  function init() {
    var uploadCard = document.querySelector(".upload-card");
    if (!uploadCard) return;

    var section = document.createElement("div");
    section.className = "pn-section";
    section.innerHTML =
      /* Header row with toggle */
      '<div class="pn-header">' +
        '<div class="pn-header-left">' +
          '<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" style="color:var(--accent2)">' +
            '<path d="M9 12h6M9 8h6M5 8h.01M5 12h.01"/>' +
            '<rect x="2" y="3" width="16" height="14" rx="2"/>' +
          '</svg>' +
          '<h4>Patient Notes</h4>' +
          '<span class="pn-badge">Optional</span>' +
        '</div>' +
        '<button class="pn-toggle" id="pnToggle" type="button">' +
          'Add notes' +
          '<svg viewBox="0 0 12 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M1 1l5 5 5-5"/></svg>' +
        '</button>' +
      '</div>' +

      /* Collapsible body */
      '<div class="pn-body" id="pnBody">' +

        /* Row 1: name / age / sex */
        '<div class="pn-row3">' +
          '<div class="pn-field">' +
            '<label>Patient Name</label>' +
            '<input type="text" id="pnName" placeholder="Full name" maxlength="80">' +
          '</div>' +
          '<div class="pn-field">' +
            '<label>Age</label>' +
            '<input type="number" id="pnAge" placeholder="–" min="0" max="120">' +
          '</div>' +
          '<div class="pn-field">' +
            '<label>Sex</label>' +
            '<select id="pnSex">' +
              '<option value="">–</option>' +
              '<option value="Male">Male</option>' +
              '<option value="Female">Female</option>' +
              '<option value="Other">Other</option>' +
            '</select>' +
          '</div>' +
        '</div>' +

        /* Symptoms chips */
        '<div class="pn-chips-label">Reported Symptoms <span style="font-weight:400;text-transform:none;letter-spacing:0">(select all that apply)</span></div>' +
        '<div class="pn-chips" id="pnChips"></div>' +
        '<div style="margin-bottom:12px"></div>' +

        /* Clinical notes textarea */
        '<div class="pn-textarea-wrap">' +
          '<label>Clinical Notes</label>' +
          '<textarea id="pnNote" placeholder="Enter any additional observations, symptoms, medical history, or context that may be relevant to this scan…" maxlength="' + MAX_CHARS + '"></textarea>' +
          '<span class="pn-char" id="pnChar">0 / ' + MAX_CHARS + '</span>' +
        '</div>' +

      '</div>'; /* end pn-body */

    uploadCard.appendChild(section);

    /* Wire toggle */
    document.getElementById("pnToggle").addEventListener("click", function () {
      var body    = document.getElementById("pnBody");
      var toggle  = document.getElementById("pnToggle");
      var opening = !body.classList.contains("open");
      body.classList.toggle("open", opening);
      toggle.classList.toggle("open", opening);
      toggle.childNodes[0].textContent = opening ? "Collapse " : "Add notes ";
    });

    /* Build symptom chips */
    var chipsWrap = document.getElementById("pnChips");
    SYMPTOMS.forEach(function (sym) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pn-chip";
      btn.textContent = sym;
      btn.dataset.sym = sym;
      btn.addEventListener("click", function () {
        btn.classList.toggle("on");
      });
      chipsWrap.appendChild(btn);
    });

    /* Character counter */
    document.getElementById("pnNote").addEventListener("input", function () {
      var len    = this.value.length;
      var charEl = document.getElementById("pnChar");
      charEl.textContent = len + " / " + MAX_CHARS;
      charEl.className = "pn-char" + (len >= MAX_CHARS ? " over" : len >= MAX_CHARS * 0.85 ? " warn" : "");
    });
  }

  /* ── Collect values and append to FormData ── */
  function getFormData(fd) {
    var name = document.getElementById("pnName");
    var age  = document.getElementById("pnAge");
    var sex  = document.getElementById("pnSex");
    var note = document.getElementById("pnNote");

    /* Collect selected symptom chips */
    var symptoms = [];
    document.querySelectorAll(".pn-chip.on").forEach(function (btn) {
      symptoms.push(btn.dataset.sym);
    });

    fd.append("patient_name",     name ? name.value.trim()       : "");
    fd.append("patient_age",      age  ? age.value.trim()        : "");
    fd.append("patient_sex",      sex  ? sex.value               : "");
    fd.append("patient_symptoms", symptoms.join(", "));
    fd.append("patient_note",     note ? note.value.trim()       : "");
    return fd;
  }

  /* ── Show saved note inside results panel ── */
  function showInResults(data) {
    /* Find (or create) the notes result card in the results panel */
    var existing = document.getElementById("pnResultCard");
    if (existing) existing.remove();

    /* Only render if at least one note field has content */
    var hasContent = data.patient_name || data.patient_age || data.patient_sex ||
                     data.patient_symptoms || data.patient_note;

    /* Find the last card in results to insert after */
    var resultsPanel = document.getElementById("resultsPanel");
    if (!resultsPanel) return;

    /* Insert before the Download card */
    var downloadCard = resultsPanel.querySelector(".card:last-child");

    var card = document.createElement("div");
    card.className = "card";
    card.id = "pnResultCard";

    var inner = '<div class="card-header">' +
      '<h3>Patient Notes</h3>' +
    '</div>';

    if (!hasContent) {
      inner += '<div class="pn-result-empty">No patient notes were added for this scan.</div>';
    } else {
      inner += '<div class="pn-result-card">';

      /* Meta row */
      var metaItems = [];
      if (data.patient_name) metaItems.push({ k: "Name",   v: data.patient_name });
      if (data.patient_age)  metaItems.push({ k: "Age",    v: data.patient_age + " yrs" });
      if (data.patient_sex)  metaItems.push({ k: "Sex",    v: data.patient_sex });

      if (metaItems.length) {
        inner += '<div class="pn-result-meta">';
        metaItems.forEach(function (m) {
          inner += '<div class="pn-meta-item">' +
            '<span class="pn-meta-key">' + m.k + '</span>' +
            '<span class="pn-meta-val">'  + m.v + '</span>' +
          '</div>';
        });
        inner += '</div>';
      }

      /* Symptoms */
      if (data.patient_symptoms) {
        var syms = data.patient_symptoms.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
        if (syms.length) {
          inner += '<div class="pn-result-symptoms">';
          syms.forEach(function (s) { inner += '<span class="pn-sym-chip">' + s + '</span>'; });
          inner += '</div>';
        }
      }

      /* Note text */
      if (data.patient_note) {
        inner += '<p class="pn-result-note">' + escHtml(data.patient_note) + '</p>';
      }

      inner += '</div>';
    }

    card.innerHTML = inner;
    resultsPanel.insertBefore(card, downloadCard);
  }

  /* ── Reset all fields ── */
  function clear() {
    var name = document.getElementById("pnName");
    var age  = document.getElementById("pnAge");
    var sex  = document.getElementById("pnSex");
    var note = document.getElementById("pnNote");
    var char = document.getElementById("pnChar");
    if (name) name.value = "";
    if (age)  age.value  = "";
    if (sex)  sex.value  = "";
    if (note) note.value = "";
    if (char) { char.textContent = "0 / " + MAX_CHARS; char.className = "pn-char"; }
    document.querySelectorAll(".pn-chip.on").forEach(function (b) { b.classList.remove("on"); });
  }

  /* ── Utility: escape HTML to prevent XSS in displayed notes ── */
  function escHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* Auto-init when DOM is ready */
  document.addEventListener("DOMContentLoaded", init);

  return {
    getFormData:   getFormData,
    showInResults: showInResults,
    clear:         clear,
  };

})();

window.PatientNotes = PatientNotes;