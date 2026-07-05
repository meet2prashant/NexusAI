document.addEventListener('DOMContentLoaded', () => {
    // Theme Switcher Logic
    const themeSelector = document.getElementById('themeSelector');
    // Load saved theme or default
    const savedTheme = localStorage.getItem('nexus-theme') || 'midnight';
    document.body.setAttribute('data-theme', savedTheme);
    themeSelector.value = savedTheme;

    themeSelector.addEventListener('change', (e) => {
        const theme = e.target.value;
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('nexus-theme', theme);
    });

    // Analytics Modal Logic
    const analyticsBtn = document.getElementById('analyticsBtn');
    const analyticsModal = document.getElementById('analyticsModal');
    const closeAnalytics = document.getElementById('closeAnalytics');
    
    if (analyticsBtn && analyticsModal && closeAnalytics) {
        analyticsBtn.addEventListener('click', async () => {
            try {
                const res = await fetch('/api/stats');
                const data = await res.json();
                
                document.getElementById('statDocs').textContent = data.total_documents || 0;
                document.getElementById('statChats').textContent = data.total_chats || 0;
                
                const langsContainer = document.getElementById('statLangs');
                langsContainer.innerHTML = '';
                
                if (data.languages && Object.keys(data.languages).length > 0) {
                    const totalLangs = Object.values(data.languages).reduce((a,b)=>a+b, 0);
                    // Sort languages by highest count
                    const sortedLangs = Object.entries(data.languages).sort((a,b) => b[1] - a[1]);
                    
                    for (const [lang, count] of sortedLangs) {
                        const pct = Math.round((count / totalLangs) * 100);
                        langsContainer.innerHTML += `
                            <div class="lang-bar-row">
                                <div class="lang-label">${lang}</div>
                                <div class="lang-track"><div class="lang-fill" style="width: ${pct}%"></div></div>
                                <div class="lang-label" style="text-align: right; font-weight: bold; width: 40px;">${pct}%</div>
                            </div>
                        `;
                    }
                } else {
                    langsContainer.innerHTML = '<span style="color:var(--text-secondary)">No tracking data available yet.</span>';
                }
                
                analyticsModal.classList.remove('hidden');
            } catch (err) {
                console.error("Failed to load analytics", err);
                window.showToast("Analytics database hasn't initialized yet.", true);
            }
        });

        closeAnalytics.addEventListener('click', () => {
            analyticsModal.classList.add('hidden');
        });
        
        // Close modal on outside click
        analyticsModal.addEventListener('click', (e) => {
            if (e.target === analyticsModal) {
                analyticsModal.classList.add('hidden');
            }
        });
    }


    // Form DOM Elements
    const uploadForm = document.getElementById('uploadForm');
    const fileInput = document.getElementById('pdfFile');
    const dropArea = document.getElementById('dropArea');
    const fileMsg = document.getElementById('fileMsg');
    const submitBtn = document.getElementById('submitBtn');
    const errorMsg = document.getElementById('errorMessage');
    
    // UI Layout Sections
    const emptyState = document.getElementById('emptyState');
    const loadingSection = document.getElementById('loadingSection');
    const resultsContent = document.getElementById('resultsContent');
    const uploadSection = document.getElementById('uploadSection');
    
    // Drag & Drop Handling
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.remove('dragover'), false);
    });

    dropArea.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length) {
            fileInput.files = files;
            updateFileName();
        }
    }

    fileInput.addEventListener('change', updateFileName);

    function updateFileName() {
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const fileName = file.name;
            const fileSize = (file.size / (1024 * 1024)).toFixed(2); // Convert to MB
            
            if (fileName.match(/\.(pdf|docx|txt|png|jpg|jpeg|mp3|wav|m4a)$/i)) {
                fileMsg.innerHTML = `<span class="highlight" style="font-weight: 800;">${fileName}</span> <br> <span style="font-size: 0.85rem; color: var(--text-secondary);">${fileSize} MB</span>`;
                dropArea.classList.add('file-loaded');
                const iconBox = dropArea.querySelector('.upload-icon');
                if(iconBox) {
                    iconBox.innerHTML = `
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>`;
                }
            } else {
                fileMsg.innerHTML = `<span style="color: #ef4444; font-weight:600;">Unsupported Format. Please use PDF, DOCX, TXT, Image, or Audio.</span>`;
                dropArea.classList.remove('file-loaded');
                fileInput.value = '';
            }
        }
    }

    // Check URL for share query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const shareId = urlParams.get('share');
    if (shareId) {
        setLoading(true);
        fetch('/api/share/' + shareId)
            .then(res => res.json())
            .then(data => {
                if (data.detail) throw new Error(data.detail);
                
                // Mount shared data instantly
                prepareStreamUI(data.language || 'English');
                
                document.getElementById('summaryContent').innerHTML = data.summary;
                document.getElementById('summaryContent').classList.remove('is-typing');
                
                if (data.translation && data.language !== 'English') {
                    document.getElementById('translationBlock').classList.remove('hidden');
                    document.getElementById('translationContent').innerHTML = data.translation;
                    document.getElementById('translationContent').classList.remove('is-typing');
                }
                
                if (data.keywords && data.keywords.length > 0) {
                     let keywordsBlock = document.getElementById('keywordsBlock');
                     keywordsBlock.innerHTML = '<strong>Key Entities:</strong> ' + data.keywords.map((k, i) => `<span class="keyword-badge" style="animation-delay: ${i * 0.1}s">${k}</span>`).join('');
                }
                
                window.currentGeminiFileName = data.gemini_file_name;
                document.getElementById('resultsSection').classList.remove('active-glow');
            })
            .catch(err => {
                showError("Share link expired or invalid.");
                setLoading(false);
            });
    }

    // Input Mode Switching (File vs URL)
    window.currentInputMode = 'file';
    window.switchInputMode = function(mode) {
        window.currentInputMode = mode;
        const dropArea = document.getElementById('dropArea');
        const urlArea = document.getElementById('urlArea');
        const tabFile = document.getElementById('tabFile');
        const tabUrl = document.getElementById('tabUrl');
        const fileInput = document.getElementById('pdfFile');
        const urlInput = document.getElementById('urlInput');
        
        if (mode === 'file') {
            dropArea.classList.remove('hidden');
            urlArea.classList.add('hidden');
            tabFile.classList.add('active');
            tabUrl.classList.remove('active');
            if (fileInput) fileInput.required = true;
            if (urlInput) urlInput.required = false;
        } else {
            dropArea.classList.add('hidden');
            urlArea.classList.remove('hidden');
            tabFile.classList.remove('active');
            tabUrl.classList.add('active');
            if (fileInput) fileInput.required = false;
            if (urlInput) urlInput.required = true;
        }
    };

    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (window.currentInputMode === 'file' && (!fileInput.files || !fileInput.files[0])) {
            showError("Please select a document file first.");
            return;
        }
        
        const urlInput = document.getElementById('urlInput');
        if (window.currentInputMode === 'url' && !urlInput.value) {
            showError("Please enter a valid website URL first.");
            return;
        }

        const formData = new FormData();
        formData.append("doc_type", document.getElementById('docType').value);
        formData.append("category", document.getElementById('category').value);
        
        const targetLang = document.querySelector('input[name="targetLanguage"]:checked').value;
        formData.append("target_language", targetLang);
        formData.append("summary_style", document.getElementById('summaryStyle').value);
        formData.append("summary_length", document.getElementById('summaryLength').value);

        let endpoint = '/api/summarize';
        if (window.currentInputMode === 'file') {
            formData.append("file", fileInput.files[0]);
            const fileExt = fileInput.files[0].name.split('.').pop().toUpperCase();
            document.querySelector('.scanning-loader').setAttribute('data-filetype', fileExt.substring(0,4));
        } else {
            formData.append("url", urlInput.value);
            endpoint = '/api/summarize_url';
            document.querySelector('.scanning-loader').setAttribute('data-filetype', 'HTTP');
        }

        setLoading(true);
        hideError();

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'An error occurred during processing.');
            }

            // Prepare UI for streaming
            prepareStreamUI(targetLang);

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let fullText = "";
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                
                if (value) {
                    buffer += decoder.decode(value, { stream: true });
                }
                
                const lines = buffer.split('\n\n');
                if (!done) {
                    buffer = lines.pop(); // Keep the last incomplete chunk in the buffer
                } else {
                    buffer = "";
                }
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.substring(6);
                        try {
                            const dataObj = JSON.parse(dataStr);
                            if (dataObj.error) throw new Error(dataObj.error);
                            if (dataObj.gemini_file_name) window.currentGeminiFileName = dataObj.gemini_file_name;
                            if (dataObj.original_text_length !== undefined) {
                                document.getElementById('wordCount').textContent = dataObj.original_text_length.toLocaleString();
                                window.lastOriginalLength = dataObj.original_text_length;
                            }
                            
                            if (dataObj.chunk) {
                                fullText += dataObj.chunk;
                                throttleRender(fullText, targetLang);
                            }
                        } catch (e) {
                             if(e.name !== "SyntaxError") {
                                 console.error("Stream error", e);
                                 throw e;
                             }
                        }
                    }
                }
                if (done) break;
            }
            
            // Stream complete
            throttleRender(fullText, targetLang, true);
            document.getElementById('resultsSection').classList.remove('active-glow');
            document.getElementById('summaryContent').classList.remove('is-typing');
            document.getElementById('translationContent').classList.remove('is-typing');

        } catch (error) {
            showError(error.message);
            setLoading(false); 
        } finally {
            document.getElementById('resultsSection').classList.remove('active-glow');
        }
    });

    function setLoading(isLoading) {
        if (isLoading) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = "Processing...";
            uploadSection.style.pointerEvents = 'none';
            uploadSection.style.opacity = '0.7';
            emptyState.classList.add('hidden');
            resultsContent.classList.add('hidden');
            loadingSection.classList.remove('hidden');
            document.getElementById('resultsSection').classList.add('active-glow');
        } else {
            submitBtn.disabled = false;
            submitBtn.innerHTML = "Generate Analysis";
            uploadSection.style.pointerEvents = 'auto';
            uploadSection.style.opacity = '1';
            loadingSection.classList.add('hidden');
            document.getElementById('resultsSection').classList.remove('active-glow');
        }
    }

    function showError(message) {
        errorMsg.textContent = message;
        errorMsg.classList.remove('hidden');
        emptyState.classList.remove('hidden');
        loadingSection.classList.add('hidden');
        resultsContent.classList.add('hidden');
    }

    function hideError() {
        errorMsg.classList.add('hidden');
    }

    function prepareStreamUI(targetLang) {
        window.lastTargetLang = targetLang;
        submitBtn.disabled = false;
        submitBtn.innerHTML = "Analyze Another Document";
        uploadSection.style.pointerEvents = 'auto';
        uploadSection.style.opacity = '1';
        loadingSection.classList.add('hidden');
        emptyState.classList.add('hidden');
        
        const chatBlock = document.querySelector('.chat-block');
        if (chatBlock) chatBlock.classList.remove('hidden');
        
        window.chatHistoryLog = [];
        const chatWindow = document.getElementById('chatHistoryWindow');
        if (chatWindow) {
            chatWindow.innerHTML = `<div class="chat-message ai-message"><div class="msg-bubble">Hello! You can ask me any questions about the document I just summarized.</div></div>`;
        }
        
        resultsContent.classList.remove('hidden');
        resultsContent.classList.add('fade-in');

        document.getElementById('keywordsBlock').innerHTML = '<strong>Key Entities:</strong> <span class="loading-text">Extracting...</span>';
        const sumContent = document.getElementById('summaryContent');
        sumContent.innerHTML = '<span class="loading-text">Generating Summary...</span>';
        sumContent.classList.add('is-typing');
        
        if (targetLang !== 'English') {
            document.getElementById('translationBlock').classList.remove('hidden');
            document.getElementById('translationLang').textContent = targetLang;
            const transContent = document.getElementById('translationContent');
            transContent.innerHTML = '<span class="loading-text">Awaiting Translation...</span>';
            transContent.classList.add('is-typing');
        } else {
            document.getElementById('translationBlock').classList.add('hidden');
        }
    }

    let renderTimer = null;
    let pendingRenderText = "";
    
    function throttleRender(text, targetLang, force = false) {
        pendingRenderText = text;
        
        if (renderTimer && !force) return;
        
        const doRender = () => {
            const currentText = pendingRenderText;
            if (force && (!currentText || !currentText.includes("__SUMMARY__"))) {
                showError("The AI returned an empty or malformed response. Please try again or check if the document is supported.");
                return;
            }
            
            // Only paint once per frame
            requestAnimationFrame(() => {
                let parts = currentText.split("__SUMMARY__");
                let keywordsText = parts[0].replace("__KEYWORDS__", "").trim();
                
                let keywordsBlock = document.getElementById('keywordsBlock');
                if (keywordsText.length > 2 && !keywordsText.includes("Extracting...")) {
                    let kwds = keywordsText.split("|").filter(k => k.trim());
                    // Add staggered animation classes to badges for a premium entrance effect
                    keywordsBlock.innerHTML = '<strong>Key Entities:</strong> ' + kwds.map((k, i) => `<span class="keyword-badge" style="animation-delay: ${i * 0.1}s">${k.trim().replace(/[*`]/g,'')}</span>`).join('');
                }
                
                if (parts.length > 1) {
                    let sumTransParts = parts[1].split("__TRANSLATION__");
                    let summaryText = sumTransParts[0].trim();
                    let transText = sumTransParts.length > 1 ? sumTransParts[1] : "";
                    
                    let predictionText = "";
                    if (transText && transText.includes("__PREDICTIONS__")) {
                        let pParts = transText.split("__PREDICTIONS__");
                        transText = pParts[0].trim();
                        predictionText = pParts[1].trim();
                    } else if (summaryText.includes("__PREDICTIONS__")) {
                        let pParts = summaryText.split("__PREDICTIONS__");
                        summaryText = pParts[0].trim();
                        predictionText = pParts[1].trim();
                        predictionText = pParts[1].trim();
                    }
                    
                    // Robust extraction for Trust Score (handles missing __ prefixes)
                    let trustHtml = "";
                    let fullText = summaryText + " " + transText + " " + predictionText;
                    
                    let trustMatch = fullText.match(/__?TRUST_SCORE__?\|(\d+)/i) || fullText.match(/TRUST_SCORE\|(\d+)/i);
                    if (trustMatch) {
                        const score = parseInt(trustMatch[1]);
                        if (!isNaN(score)) {
                            let ringColor = '#10b981'; // Emerald
                            if (score < 50) ringColor = '#ef4444'; // Red
                            else if (score < 80) ringColor = '#f59e0b'; // Amber
                            
                            trustHtml = `
                            <div class="trust-badge" style="display:flex; align-items:center; gap:12px; margin-bottom: 24px; padding: 12px 20px; border-radius: 16px; background: rgba(0,0,0,0.15); border: 1px solid var(--glass-border); width: fit-content; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                                <div class="trust-ring-container" style="position:relative; width: 48px; height: 48px;">
                                    <svg viewBox="0 0 36 36" class="circular-chart" style="width:100%; height:100%;">
                                      <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="3" />
                                      <path class="circle" stroke-dasharray="${score}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="${ringColor}" stroke-width="3" stroke-linecap="round" style="animation: progressFill 1.5s ease-out forwards;" />
                                    </svg>
                                    <div class="trust-score-text" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); font-weight:800; font-size:0.9rem; color:var(--text-primary);">${score}</div>
                                </div>
                                <div class="trust-info">
                                    <div style="font-size:0.75rem; text-transform:uppercase; letter-spacing:1.5px; color:var(--text-secondary); font-weight:700; margin-bottom:2px;">AI Trust Metric</div>
                                    <div style="font-weight:800; font-size:1.1rem; color:${ringColor}; text-shadow: 0 0 10px ${ringColor}40;">${score >= 80 ? 'Highly Reliable' : (score >= 50 ? 'Moderate Reliability' : 'Questionable Source')}</div>
                                </div>
                            </div>`;
                        }
                    }
                    
                    let chipsHtml = "";
                    if (force && fullText.includes("|||")) {
                        let qSplit = fullText.substring(fullText.indexOf("|||"));
                        const qParts = qSplit.split("|||").map(q => q.trim()).filter(q => q.length > 0 && q.length < 150);
                        chipsHtml = '<div class="suggestion-chips">';
                        qParts.forEach(q => {
                            let escapedQ = q.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                            chipsHtml += `<button class="suggestion-chip" onclick="document.getElementById('chatInput').value='${escapedQ}'; window.sendChatMessage();">${q}</button>`;
                        });
                        chipsHtml += '</div>';
                    }
                    
                    // Clean up raw leaks from rendered text
                    const cleanupRegex = /(__?TRUST_SCORE__?\|\d+|TRUST_SCORE\|\d+)/gi;
                    summaryText = summaryText.replace(cleanupRegex, '').trim();
                    if (summaryText.includes("|||")) summaryText = summaryText.split("|||")[0].trim();
                    
                    if (transText) {
                        transText = transText.replace(cleanupRegex, '').trim();
                        if (transText.includes("|||")) transText = transText.split("|||")[0].trim();
                    }

                    if (summaryText) document.getElementById('summaryContent').innerHTML = trustHtml + marked.parse(summaryText) + (targetLang === 'English' ? chipsHtml : "");
                    
                    if (targetLang !== 'English' && transText) {
                        document.getElementById('translationContent').innerHTML = marked.parse(transText) + chipsHtml;
                    }
                }
                
                // Save state for Exports
                window.lastResultData = {
                    summary: document.getElementById('summaryContent').innerHTML,
                    translation: document.getElementById('translationContent').innerHTML,
                    keywords: keywordsText.split("|").filter(k => k.trim()).map(k => k.trim().replace(/[*`]/g,'')),
                    gemini_file_name: window.currentGeminiFileName,
                    original_text_length: window.lastOriginalLength || 0
                };
                renderTimer = null;
            });
        };

        if (force) {
            if (renderTimer) clearTimeout(renderTimer);
            doRender();
        } else {
            renderTimer = setTimeout(doRender, 150); // Massive 3x frame optimization
        }
    }

});

// Export utility functions
window.copyText = function(elementId) {
    const text = document.getElementById(elementId).innerText;
    navigator.clipboard.writeText(text).then(() => {
        const btns = document.querySelectorAll('.btn-export');
        btns.forEach(btn => {
            if (btn.innerText === 'Copy' && btn.getAttribute('onclick').includes(elementId)) {
                window.showToast("Copied to clipboard!", false);
                btn.innerText = 'Copied!';
                setTimeout(() => btn.innerText = 'Copy', 2000);
            }
        });
    });
};

window.downloadText = function(elementId, prefix) {
    const text = document.getElementById(elementId).innerText;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${prefix}_PADS_AI.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

window.downloadPDF = function(elementId, prefix) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const opt = {
      margin:       0.5,
      filename:     `${prefix}_PADS_AI.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(element).save();
};

window.generateShareLink = async function() {
    if (!window.lastResultData) return;
    const btn = document.getElementById('shareBtn');
    const originalText = btn.innerText;
    btn.innerText = 'Generating...';
    try {
        const payload = {
            summary: window.lastResultData.summary || "",
            translation: window.lastResultData.translation || "",
            language: window.lastTargetLang || "English",
            gemini_file_name: window.lastResultData.gemini_file_name || "",
            original_text_length: window.lastResultData.original_text_length || 0,
            keywords: window.lastResultData.keywords || []
        };
        const res = await fetch('/api/share', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if(res.ok) {
            const shareUrl = window.location.origin + window.location.pathname + '?share=' + data.share_id;
            
            // Show Share Modal and dynamically Generate QR Code
            const modal = document.getElementById('shareModal');
            document.getElementById('shareUrlInput').value = shareUrl;
            
            const qrWrapper = document.getElementById('qrCodeContainer');
            qrWrapper.innerHTML = ''; // Clear prior code
            new QRCode(qrWrapper, {
                text: shareUrl,
                width: 220,
                height: 220,
                colorDark: "#000000",
                colorLight: "#ffffff"
            });
            
            modal.classList.remove('hidden');
            btn.innerText = 'Shared!';
        } else {
            window.showToast('Failed to generate sharing payload: ' + data.detail, true);
            btn.innerText = originalText;
        }
    } catch(err) {
        window.showToast('Error: ' + err.message, true);
        btn.innerText = originalText;
    }
    setTimeout(() => {
        if(btn.innerText === 'Shared!') btn.innerText = originalText;
    }, 3000);
};

// --- Modal Handlers ---

window.closeShareModal = function() {
    document.getElementById('shareModal').classList.add('hidden');
};

window.copyShareUrl = function() {
    const input = document.getElementById('shareUrlInput');
    input.select();
    navigator.clipboard.writeText(input.value);
    window.showToast('Share Link copied to clipboard!', false);
    const cb = event.target;
    cb.innerText = 'Copied!';
    setTimeout(() => cb.innerText = 'Copy Link', 2000);
};

let adminChartInstance = null;
window.openAdminDashboard = async function() {
    const modal = document.getElementById('adminModal');
    modal.classList.remove('hidden');
    
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        
        document.getElementById('statTotalDocs').innerText = data.total_documents;
        document.getElementById('statTotalChats').innerText = data.total_chats;
        
        const ctx = document.getElementById('languagesChart').getContext('2d');
        if (adminChartInstance) adminChartInstance.destroy();
        
        const labels = Object.keys(data.languages);
        const values = Object.values(data.languages);
        
        const isDark = document.body.getAttribute('data-theme') !== 'light';
        const txtColor = isDark ? '#f8fafc' : '#0f172a';
        
        adminChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels.length > 0 ? labels : ['No Usage Yet'],
                datasets: [{
                    data: values.length > 0 ? values : [1],
                    backgroundColor: [
                        'rgba(99, 102, 241, 0.8)',
                        'rgba(16, 185, 129, 0.8)',
                        'rgba(236, 72, 153, 0.8)',
                        'rgba(245, 158, 11, 0.8)',
                        'rgba(139, 92, 246, 0.8)'
                    ],
                    borderColor: isDark ? '#1e293b' : '#ffffff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { color: txtColor } },
                    title: { display: true, text: 'Documents Processed by Language', color: txtColor, font: {size: 16} }
                }
            }
        });
    } catch(err) {
        console.error("Failed to load admin stats", err);
    }
};

window.closeAdminDashboard = function() {
    document.getElementById('adminModal').classList.add('hidden');
};


// Text-to-Speech Logic
window.playTTS = function(elementId) {
    if (!('speechSynthesis' in window)) {
        window.showToast("Text-to-Speech is not supported in this browser.", true);
        return;
    }

    const btns = document.querySelectorAll('.btn-export');
    let currentBtn = null;
    btns.forEach(btn => {
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(elementId) && 
           (btn.innerText === 'Listen' || btn.innerText === 'Stop')) {
            currentBtn = btn;
        }
    });

    if (currentBtn && currentBtn.innerText === 'Stop') {
        window.speechSynthesis.cancel();
        currentBtn.innerText = 'Listen';
        return;
    }

    window.speechSynthesis.cancel();
    btns.forEach(btn => {
        if (btn.innerText === 'Stop') btn.innerText = 'Listen';
    });

    const text = document.getElementById(elementId).innerText;
    const utterance = new SpeechSynthesisUtterance(text);
    
    if (elementId === 'translationContent') {
        const langText = document.getElementById('translationLang').textContent;
        if (langText === 'Hindi') utterance.lang = 'hi-IN';
    } else {
        utterance.lang = 'en-US';
    }

    if (currentBtn) {
        currentBtn.innerText = 'Stop';
        utterance.onend = () => currentBtn.innerText = 'Listen';
        utterance.onerror = () => currentBtn.innerText = 'Listen';
    }
    
    window.speechSynthesis.speak(utterance);
};

// Chat Widget Logic
window.currentGeminiFileName = "";
window.chatHistoryLog = [];

window.handleChatKeyPress = function(e) {
    if (e.key === 'Enter') {
        window.sendChatMessage();
    }
};

window.sendChatMessage = async function() {
    const inputField = document.getElementById('chatInput');
    const message = inputField.value.trim();
    if (!message || !window.currentGeminiFileName) return;

    inputField.value = '';
    
    const chatWindow = document.getElementById('chatHistoryWindow');
    const userMsgDiv = document.createElement('div');
    userMsgDiv.className = 'chat-message user-message';
    userMsgDiv.innerHTML = `<div class="msg-bubble">${message}</div>`;
    chatWindow.appendChild(userMsgDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    const aiMsgDiv = document.createElement('div');
    aiMsgDiv.className = 'chat-message ai-message';
    aiMsgDiv.innerHTML = `<div class="msg-bubble loading">Thinking...</div>`;
    chatWindow.appendChild(aiMsgDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    try {
        const payload = {
            gemini_file_name: window.currentGeminiFileName,
            message: message,
            history: window.chatHistoryLog
        };

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || 'Chat error');
        }

        aiMsgDiv.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: flex-start; max-width: 100%; width: 100%;">
                <div class="msg-bubble ai-response"></div>
                <div class="chat-chips-container" style="margin-top: 8px;"></div>
            </div>
        `;
        const contentDiv = aiMsgDiv.querySelector('.ai-response');
        const chipsContainer = aiMsgDiv.querySelector('.chat-chips-container');
        let fullText = "";
        
        document.getElementById('resultsSection').classList.add('active-glow');
        contentDiv.classList.add('is-typing');
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        let chatRenderTimer = null;
        const flushChat = (force = false) => {
             if (chatRenderTimer && !force) return;
             let renderText = fullText;
             
             requestAnimationFrame(() => {
                 let renderedHtml = "";
                 
                 if (force && renderText.includes('|||')) {
                     const parts = renderText.split('|||');
                     const pureText = parts[0];
                     const questions = parts.slice(1).map(q => q.trim()).filter(q => q.length > 0);
                     
                     renderedHtml = marked.parse(pureText);
                     let chipsHtml = '<div class="suggestion-chips">';
                     questions.forEach(q => {
                          let escapedQ = q.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                          chipsHtml += `<button class="suggestion-chip" onclick="document.getElementById('chatInput').value='${escapedQ}'; window.sendChatMessage();">${q}</button>`;
                     });
                     chipsHtml += '</div>';
                     chipsContainer.innerHTML = chipsHtml;
                     fullText = pureText.trim();
                 } else {
                     renderedHtml = marked.parse(renderText);
                     if (force) chipsContainer.innerHTML = '';
                 }
                 
                 contentDiv.innerHTML = renderedHtml;
                 chatWindow.scrollTop = chatWindow.scrollHeight;
                 chatRenderTimer = null;
             });
        };

        while (true) {
            const { done, value } = await reader.read();
            
            if (value) {
                buffer += decoder.decode(value, { stream: true });
            }
            
            const lines = buffer.split('\n\n');
            if (!done) {
                buffer = lines.pop(); // Keep the last incomplete chunk
            } else {
                buffer = "";
            }
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.substring(6);
                    try {
                        const dataObj = JSON.parse(dataStr);
                        if (dataObj.error) {
                            throw new Error(dataObj.error);
                        }
                        if (dataObj.chunk) {
                            fullText += dataObj.chunk;
                            
                            if(!chatRenderTimer) {
                                chatRenderTimer = setTimeout(() => flushChat(), 100);
                            }
                        }
                    } catch (e) {
                         if(e.name !== "SyntaxError") { 
                             console.error("Stream parse error", e); 
                             throw e;
                         }
                    }
                }
            }
            if (done) {
                if (chatRenderTimer) clearTimeout(chatRenderTimer);
                flushChat(true);
                contentDiv.classList.remove('is-typing');
                break;
            }
        }
        
        window.chatHistoryLog.push({ role: 'user', content: message });
        window.chatHistoryLog.push({ role: 'model', content: fullText });
        document.getElementById('resultsSection').classList.remove('active-glow');
        
    } catch (error) {
        document.getElementById('resultsSection').classList.remove('active-glow');
        aiMsgDiv.innerHTML = `<div class="msg-bubble error">Error: ${error.message}</div>`;
    }
    
    chatWindow.scrollTop = chatWindow.scrollHeight;
};

// --- Voice Input Logic ---
let recognition = null;
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRec();
    recognition.continuous = false;
    recognition.interimResults = false;
    
    recognition.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            }
        }
        if (finalTranscript) {
            document.getElementById('chatInput').value += finalTranscript;
        }
    };
    recognition.onend = () => {
        const micBtn = document.getElementById('chatMicBtn');
        if (micBtn) micBtn.classList.remove('mic-active');
        if (document.getElementById('chatInput').value.trim() !== '') {
            window.sendChatMessage();
        }
    };
}

window.toggleVoiceInput = function() {
    const micBtn = document.getElementById('chatMicBtn');
    if (!recognition) {
        window.showToast("Speech recognition is not fully supported in your current browser.", true);
        return;
    }
    if (micBtn.classList.contains('mic-active')) {
        recognition.stop();
        micBtn.classList.remove('mic-active');
    } else {
        recognition.start();
        micBtn.classList.add('mic-active');
    }
};

window.showToast = function(message, isError = false) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'toast-error' : 'toast-success'}`;
    
    const icon = isError 
        ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`
        : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
        
    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    }, 4000);
};
