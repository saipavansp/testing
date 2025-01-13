// DOM Elements
const videoElement = document.getElementById('video');
const timerElement = document.getElementById('timer');
const emotionElement = document.getElementById('emotion');
const statusElement = document.getElementById('status');

// Global Variables
let videoStream;
let audioStream;
let mediaRecorder;
let audioRecorder;
let recordedChunks = [];
let audioChunks = [];
let spokenText = ''; // Stores all spoken text
let wordCount = 0;
let startTime;
let isRecording = false;
let timerInterval;
let emotionInterval;

// Initialize face mesh
let faceMesh;
let camera;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function () {
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

    faceMesh.onResults(onResults);

    camera = new Camera(videoElement, {
        onFrame: async () => {
            if (faceMesh) {
                await faceMesh.send({ image: videoElement });
            }
        },
        width: 680,
        height: 380
    });
}

// Handle face detection results
function onResults(results) {
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];
        if (isRecording) {
            analyzeExpression(landmarks);
        }
    } else if (isRecording) {
        handleFaceLost();
    }
}

// Start the assessment process
function start() {
    const userConsent = localStorage.getItem('userConsent');
    if (userConsent === 'true') {
        initializeRecording();
    } else {
        checkPermissions().then((hasPermissions) => {
            if (hasPermissions) {
                showConsentDialog();
            }
        });
    }
}

// Check for required permissions
async function checkPermissions() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: 680,
                height: 380,
                facingMode: 'user'
            },
            audio: true
        });

        // Stop all tracks immediately
        stream.getTracks().forEach((track) => track.stop());
        return true;
    } catch (error) {
        console.error('Permission error:', error);

        let errorMessage = 'Camera and microphone access are required for this application.';
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            errorMessage = 'Please allow access to your camera and microphone in your browser settings.';
        }

        Swal.fire({
            title: 'Permission Required',
            html: `${errorMessage}<br><br>To enable permissions:<br>1. Click the camera icon in your browser's address bar<br>2. Allow both camera and microphone access<br>3. Refresh the page`,
            icon: 'warning',
            confirmButtonText: 'Understood'
        });
        return false;
    }
}

// Show consent dialog
function showConsentDialog() {
    Swal.fire({
        title: 'Consent Required',
        html: 'This assessment will:<br>1. Record your video<br>2. Record your audio<br>3. Analyze your facial expressions<br><br>Do you consent to proceed?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'I Consent',
        cancelButtonText: 'Cancel'
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.setItem('userConsent', 'true'); // Save user consent
            initializeRecording();
        }
    });
}

// Initialize recording interface
function initializeRecording() {
    document.getElementById('recordings').style.display = 'block';
    document.getElementById('asses1').style.display = 'none';
    document.getElementById('stop_record').disabled = false; // Enable Stop button
    camera.start();
}

// Setup speech recognition
function setupSpeechRecognition() {
    window.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = function (event) {
        const transcript = event.results[event.results.length - 1][0].transcript;
        spokenText += transcript + ' '; // Append spoken words
        wordCount += transcript.trim().split(/\s+/).length;
        updateStatus(`Words spoken: ${wordCount}`);
    };

    recognition.onend = function () {
        if (isRecording) {
            recognition.start();
        }
    };
}

// Start recording process
async function startRecord() {
    try {
        isRecording = true;
        document.getElementById('start_record').disabled = true;
        document.getElementById('stop_record').disabled = false;

        // Get media streams
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: 680,
                height: 380,
                facingMode: 'user'
            }
        });
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Setup recorders
        mediaRecorder = new MediaRecorder(videoStream);
        audioRecorder = new MediaRecorder(audioStream);

        mediaRecorder.ondataavailable = (event) => recordedChunks.push(event.data);
        audioRecorder.ondataavailable = (event) => audioChunks.push(event.data);

        // Start all recordings
        mediaRecorder.start();
        audioRecorder.start();
        recognition.start();
        startTimer();

        updateStatus('Recording in progress...');
    } catch (error) {
        console.error('Recording error:', error);
        handleRecordingError(error);
    }
}

// Start timer countdown
function startTimer() {
    let timeLeft = 120; // 2 minutes

    timerInterval = setInterval(() => {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerElement.textContent = `Time Remaining: ${minutes}:${seconds.toString().padStart(2, '0')}`;

        if (timeLeft <= 0) {
            stopRecording();
        }
        timeLeft--;
    }, 1000);
}

// Stop recording process
function stopRecording() {
    isRecording = false;
    clearInterval(timerInterval);

    // Stop all recordings
    recognition.stop();
    mediaRecorder.stop();
    audioRecorder.stop();
    camera.stop();

    document.getElementById('start_record').disabled = false;
    document.getElementById('stop_record').disabled = true;

    videoStream.getTracks().forEach((track) => track.stop());
    audioStream.getTracks().forEach((track) => track.stop());

    mediaRecorder.onstop = () => {
        const videoBlob = new Blob(recordedChunks, { type: 'video/webm' });
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        handleRecordingComplete(videoBlob, audioBlob);
    };
}

// Handle recording completion
function handleRecordingComplete(videoBlob, audioBlob) {
    const videoUrl = URL.createObjectURL(videoBlob);

    Swal.fire({
        title: 'Recording Complete',
        html: `Total words spoken: ${wordCount}<br>Recording duration: 2 minutes`,
        icon: 'success',
        showCancelButton: true,
        confirmButtonText: 'Review Recording',
        cancelButtonText: 'Finish'
    }).then((result) => {
        if (result.isConfirmed) {
            showRecordingPreview(videoUrl);
        } else {
            console.log('Spoken Text:', spokenText); // Log spoken words
            window.location.reload();
        }
    });
}

// Show recording preview
function showRecordingPreview(videoUrl) {
    videoElement.srcObject = null;
    videoElement.src = videoUrl;
    videoElement.controls = true;
}

// Update status message
function updateStatus(message) {
    if (statusElement) {
        statusElement.textContent = message;
    }
}

// Handle face lost during recording
function handleFaceLost() {
    if (isRecording) {
        Swal.fire({
            title: 'Face Not Detected',
            text: 'Please ensure your face is clearly visible to the camera.',
            icon: 'warning'
        }).then(() => {
            stopRecording();
        });
    }
}

// Handle recording errors
function handleRecordingError(error) {
    console.error('Recording error:', error);
    Swal.fire({
        title: 'Recording Error',
        text: 'There was an error starting the recording. Please refresh and try again.',
        icon: 'error'
    });
}
