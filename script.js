// Global state variables
let videoStream;
let audioStream;
let mediaRecorder;
let audioRecorder;
let recordedChunks = [];
let audioChunks = [];
let wordCount = 0;
let startTime;
let isRecording = false;
let timerInterval;
let emotionInterval;
let emotionData = [];
let speechData = {
    totalWords: 0,
    wpm: 0,
    transcripts: []
};

// DOM Elements
const videoElement = document.getElementById('video');
const timerElement = document.getElementById('timer');
const emotionElement = document.getElementById('emotion');
const wpmElement = document.getElementById('wpm');
const wordCountElement = document.getElementById('word-count');
const startRecordButton = document.getElementById('start_record');
const stopRecordButton = document.getElementById('stop_record');

// Initialize face detection
let faceMesh;
let camera;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    initializeFaceMesh();
    setupSpeechRecognition();
});

// Initialize FaceMesh
function initializeFaceMesh() {
    faceMesh = new FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });

    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7
    });

    faceMesh.onResults(onFaceResults);

    camera = new Camera(videoElement, {
        onFrame: async () => {
            if (faceMesh) {
                await faceMesh.send({image: videoElement});
            }
        },
        width: 680,
        height: 380
    });
}

// Handle face detection results
function onFaceResults(results) {
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];
        if (isRecording) {
            analyzeExpression(landmarks);
        }
    } else if (isRecording) {
        handleFaceLost();
    }
}

// Setup speech recognition
function setupSpeechRecognition() {
    window.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = function(event) {
        const transcript = event.results[event.results.length - 1][0].transcript;
        handleSpeechResult(transcript);
    };

    recognition.onend = function() {
        if (isRecording) {
            recognition.start();
        }
    };
}

// Handle speech results
function handleSpeechResult(transcript) {
    const words = transcript.trim().split(/\s+/);
    wordCount += words.length;
    speechData.totalWords = wordCount;
    speechData.transcripts.push(transcript);
    
    // Update WPM
    const minutesElapsed = (Date.now() - startTime) / 60000;
    speechData.wpm = Math.round(wordCount / minutesElapsed);

    // Update UI
    updateMetrics();
}

// Update metrics display
function updateMetrics() {
    wordCountElement.textContent = `Total words: ${speechData.totalWords}`;
    wpmElement.textContent = `Words per minute: ${speechData.wpm}`;
}

// Start assessment
function start() {
    checkPermissions().then(hasPermissions => {
        if (hasPermissions) {
            showConsentDialog();
        }
    });
}

// Check permissions
async function checkPermissions() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        stream.getTracks().forEach(track => track.stop());
        return true;
    } catch (error) {
        Swal.fire({
            title: 'Permission Required',
            html: 'Please enable camera and microphone access.<br><br>How to enable:<br>1. Click the camera icon in address bar<br>2. Allow both permissions<br>3. Refresh the page',
            icon: 'warning'
        });
        return false;
    }
}

// Show consent dialog
function showConsentDialog() {
    Swal.fire({
        title: 'Start Assessment',
        html: 'This assessment will record:<br>• Video<br>• Audio<br>• Facial expressions<br>• Speech analysis',
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Start',
        cancelButtonText: 'Cancel'
    }).then((result) => {
        if (result.isConfirmed) {
            initializeRecording();
        }
    });
}

// Initialize recording interface
function initializeRecording() {
    document.getElementById('recordings').style.display = 'block';
    document.getElementById('asses1').style.display = 'none';
    camera.start();
}

// Start recording
async function startRecord() {
    try {
        isRecording = true;
        startTime = Date.now();
        startRecordButton.style.display = 'none';
        stopRecordButton.style.display = 'inline-block';

        // Get media streams
        videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Setup recorders
        mediaRecorder = new MediaRecorder(videoStream);
        audioRecorder = new MediaRecorder(audioStream);

        mediaRecorder.ondataavailable = event => recordedChunks.push(event.data);
        audioRecorder.ondataavailable = event => audioChunks.push(event.data);

        // Start all recordings
        mediaRecorder.start();
        audioRecorder.start();
        recognition.start();
        startTimer();
        startEmotionTracking();

        Swal.fire({
            title: 'Recording Started',
            text: 'You can stop recording at any time using the Stop button',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
        });
    } catch (error) {
        handleRecordingError(error);
    }
}

// Stop recording
function stopRecording() {
    if (!isRecording) return;

    Swal.fire({
        title: 'Stop Recording?',
        text: 'Are you sure you want to stop the recording?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, stop recording',
        cancelButtonText: 'No, continue'
    }).then((result) => {
        if (result.isConfirmed) {
            isRecording = false;
            clearInterval(timerInterval);
            stopRecordButton.style.display = 'none';

            // Stop all recordings
            recognition.stop();
            mediaRecorder.stop();
            audioRecorder.stop();
            camera.stop();

            // Stop all tracks
            videoStream.getTracks().forEach(track => track.stop());
            audioStream.getTracks().forEach(track => track.stop());

            // Process the recordings
            processRecordings();
        }
    });
}

// Finish recording and process data
async function finishRecording() {
    isRecording = false;
    clearInterval(timerInterval);
    stopRecordButton.style.display = 'none';

    // Stop all recordings
    recognition.stop();
    mediaRecorder.stop();
    audioRecorder.stop();
    camera.stop();

    // Stop all tracks
    videoStream.getTracks().forEach(track => track.stop());
    audioStream.getTracks().forEach(track => track.stop());

    // Show processing dialog
    Swal.fire({
        title: 'Processing',
        html: 'Analyzing your recording...',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    // Process recordings
    const videoBlob = new Blob(recordedChunks, { type: 'video/webm' });
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

    // Prepare data for upload
    const formData = new FormData();
    formData.append('videoFile', videoBlob, 'recording.webm');
    formData.append('audioFile', audioBlob, 'audio.webm');
    formData.append('emotionData', JSON.stringify(emotionData));
    formData.append('speechData', JSON.stringify(speechData));
    formData.append('wpm', speechData.wpm);

    try {
        // Upload to server
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            showResults(result.data);
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        handleUploadError(error);
    }
}

// Process recordings
// In script.js, update the processRecordings function:
async function processRecordings() {
    try {
        const videoBlob = new Blob(recordedChunks, { type: 'video/webm' });
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

        const formData = new FormData();
        formData.append('videoFile', videoBlob, 'recording.webm');
        formData.append('audioFile', audioBlob, 'audio.webm');
        formData.append('emotionData', JSON.stringify(emotionData));
        formData.append('speechData', JSON.stringify({
            transcripts: speechData.transcripts,
            duration: Math.floor((Date.now() - startTime) / 1000),
            wpm: speechData.wpm,
            totalWords: speechData.totalWords
        }));

        // Show loading
        Swal.fire({
            title: 'Processing...',
            text: 'Analyzing your recording',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        console.log('Upload result:', result); // Debug log

        if (result.success) {
            // Store report data
            localStorage.setItem('reportData', JSON.stringify(result.report));
            
            // Redirect
            window.location.href = '/report';
        } else {
            throw new Error(result.message || 'Processing failed');
        }
    } catch (error) {
        console.error('Processing error:', error);
        Swal.fire({
            title: 'Processing Failed',
            text: error.message,
            icon: 'error'
        });
    }
}

// Show results dialog
function showResults(data) {
    Swal.fire({
        title: 'Assessment Complete',
        html: `
            <div class="results-container">
                <p>Words per minute: ${speechData.wpm}</p>
                <p>Total words: ${speechData.totalWords}</p>
                <p>Recording duration: ${formatTime(Date.now() - startTime)}</p>
            </div>
        `,
        icon: 'success',
        confirmButtonText: 'View Full Report'
    }).then(() => {
        // Here you could redirect to a detailed report page
        window.location.reload();
    });
}

// Start emotion tracking
function startEmotionTracking() {
    let lastEmotion = 'Neutral';
    emotionInterval = setInterval(() => {
        if (lastEmotion !== 'Face not detected') {
            emotionData.push({
                timestamp: Date.now(),
                emotion: lastEmotion
            });
        }
    }, 1000);
}

// Analyze facial expressions
function analyzeExpression(landmarks) {
    const expressions = {
        eyeOpenness: calculateRatio(landmarks[159], landmarks[145], landmarks[386], landmarks[374]),
        browRaise: calculateRatio(landmarks[70], landmarks[159], landmarks[300], landmarks[386]),
        mouthOpenness: calculateRatio(landmarks[13], landmarks[14], landmarks[61], landmarks[291])
    };

    let emotion = determineEmotion(expressions);
    updateEmotionDisplay(emotion);
}

// Determine emotion from expressions
function determineEmotion(expressions) {
    if (expressions.mouthOpenness > 0.5) return "Speaking";
    if (expressions.browRaise > 1.2) return "Engaged";
    if (expressions.eyeOpenness < 0.5) return "Blinking";
    return "Neutral";
}

// Calculate facial ratios
function calculateRatio(p1, p2, p3, p4) {
    const dist1 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const dist2 = Math.hypot(p4.x - p3.x, p4.y - p3.y);
    return dist1 / dist2;
}

// Start timer
function startTimer() {
    let duration = 120; // 2 minutes
    updateTimer(duration);

    timerInterval = setInterval(() => {
        duration--;
        updateTimer(duration);
        
        if (duration <= 0) {
            finishRecording();
        }
    }, 1000);
}

// Update timer display
function updateTimer(duration) {
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    timerElement.textContent = `Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Format time helper
function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
}

// Update emotion display
function updateEmotionDisplay(emotion) {
    emotionElement.textContent = `Expression: ${emotion}`;
}

// Handle face lost during recording
function handleFaceLost() {
    updateEmotionDisplay('Face not detected');
}

// Handle recording error
function handleRecordingError(error) {
    console.error('Recording error:', error);
    Swal.fire({
        title: 'Recording Error',
        text: 'Failed to start recording. Please refresh and try again.',
        icon: 'error'
    });
}


function displayReport(report) {
    const reportHTML = `
        <div class="report-container">
            <div class="report-section">
                <h3>Summary</h3>
                <p>Duration: ${report.summary.totalDuration}</p>
                <p>Words per Minute: ${report.summary.wordsPerMinute}</p>
                <p>Total Words: ${report.summary.totalWords}</p>
            </div>

            <div class="report-section">
                <h3>Grammar Analysis</h3>
                <div class="score-circle">${report.grammarAnalysis.score}/10</div>
                <p>${report.grammarAnalysis.feedback}</p>
            </div>

            <div class="report-section">
                <h3>Communication Analysis</h3>
                <div class="scores-grid">
                    <div class="score-item">
                        <label>Confidence</label>
                        <div class="score">${report.sentimentAnalysis.confidenceScore}/10</div>
                    </div>
                    <div class="score-item">
                        <label>Clarity</label>
                        <div class="score">${report.sentimentAnalysis.clarityScore}/10</div>
                    </div>
                </div>
                <p>Overall Impression: ${report.sentimentAnalysis.overallImpression}</p>
                <p>Sentiment: ${report.sentimentAnalysis.sentiment}</p>
            </div>

            <div class="report-section">
                <h3>Professional Analysis</h3>
                <div class="scores-grid">
                    <div class="score-item">
                        <label>Communication</label>
                        <div class="score">${report.professionalAnalysis.communicationScore}/10</div>
                    </div>
                    <div class="score-item">
                        <label>Organization</label>
                        <div class="score">${report.professionalAnalysis.organizationScore}/10</div>
                    </div>
                </div>
                <h4>Recommendations:</h4>
                <ul>
                    ${report.professionalAnalysis.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>

            <div class="report-section">
                <h3>Emotion Analysis</h3>
                <div class="emotion-chart">
                    ${Object.entries(report.emotionAnalysis).map(([emotion, percentage]) => `
                        <div class="emotion-bar">
                            <label>${emotion}</label>
                            <div class="bar" style="width: ${percentage}%">${percentage}%</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    Swal.fire({
        title: 'Assessment Report',
        html: reportHTML,
        width: 800,
        showCloseButton: true,
        showConfirmButton: true,
        confirmButtonText: 'Download Report',
        showCancelButton: true,
        cancelButtonText: 'Close'
    }).then((result) => {
        if (result.isConfirmed) {
            downloadReport(report);
        }
    });
}

// Function to download report as PDF or JSON
function downloadReport(report) {
    const reportJson = JSON.stringify(report, null, 2);
    const blob = new Blob([reportJson], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assessment-report-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}
// Handle upload error
function handleUploadError(error) {
    console.error('Upload error:', error);
    Swal.fire({
        title: 'Upload Failed',
        text: 'Failed to upload recording. Please try again.',
        icon: 'error'
    });
}