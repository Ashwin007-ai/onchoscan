document.addEventListener("DOMContentLoaded", function(){

    document.getElementById("predictBtn").addEventListener("click", runPrediction);

});

async function runPrediction(){

    let fileInput = document.getElementById("imageInput");
    let cancerType = document.getElementById("cancerType").value;

    if(!fileInput.files[0]){
        alert("Upload image first");
        return;
    }

    let formData = new FormData();
    formData.append("file", fileInput.files[0]);
    formData.append("cancer_type", cancerType);

    try{

        let response = await fetch("http://127.0.0.1:8000/predict", {
            method: "POST",
            body: formData
        });

        let result = await response.json();

        document.getElementById("result").innerHTML = `

            <div class="card">
                <h2>Prediction Result</h2>
                <p><b>Prediction:</b> ${result.prediction}</p>
                <p><b>Confidence:</b> ${result.confidence}%</p>
            </div>

            <div class="card">
                <h2>Risk Assessment</h2>
                <p><b>Risk Score:</b> ${result.risk_score}/100</p>
                <p><b>Risk Level:</b> ${result.risk_level}</p>

                <div class="risk-bar">
                    <div class="risk-fill" style="width:${result.risk_score}%"></div>
                </div>
            </div>

            <div class="card">
                <h2>Diagnostic Explanation</h2>
                <p>${result.diagnostic_text}</p>
            </div>

            <div class="card">
                <h2>Explainable AI (Grad-CAM)</h2>
                <img src="http://127.0.0.1:8000/${result.heatmap}" width="300"/>
            </div>

            <div class="card">
                <h2>Download Report</h2>
                <a href="http://127.0.0.1:8000/${result.report}" download>
                    Download Diagnostic Report (PDF)
                </a>
            </div>
        `;

    }catch(error){
        console.error(error);
        document.getElementById("result").innerHTML =
            "<p style='color:red'>Server error</p>";
    }
}
