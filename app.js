import {
  FilesetResolver,
  GestureRecognizer,
  PoseLandmarker
} from '/node_modules/@mediapipe/tasks-vision/vision_bundle.mjs';

import { questions, maxScore, pointsForAnswer } from '/questions.mjs';

const timing = {
  questionIntroMs: 2200,
  revealMs: 450,
  centerHoldMs: 500,
  answerHoldMs: 900,
  feedbackMs: 1400,
  feedbackFadeMs: 500,
  restartHoldMs: 1000,
  visionIntervalMs: 90
};

const zoneLimits = { left: 0.43, right: 0.57 };
const el = (id) => document.getElementById(id);
const ui = {
  camera: el('camera'),
  quiz: el('quizScreen'),
  startup: el('startupScreen'),
  completion: el('completionScreen'),
  startupTitle: el('startupTitle'),
  startupMessage: el('startupMessage'),
  start: el('startButton'),
  startupGestureIcon: el('startupGestureIcon'),
  startupStatus: el('startupStatus'),
  startupGestureProgress: el('startupGestureProgressFill'),
  retry: el('retryButton'),
  progress: el('progressText'),
  score: el('scoreText'),
  questionPanel: el('questionPanel'),
  question: el('questionText'),
  questionPrompt: el('questionPrompt'),
  choices: el('choices'),
  trueChoice: el('trueChoice'),
  falseChoice: el('falseChoice'),
  trueHold: el('trueHold'),
  falseHold: el('falseHold'),
  trackingMessage: el('trackingMessage'),
  positionMarker: el('positionMarker'),
  feedback: el('feedback'),
  feedbackSymbol: el('feedbackSymbol'),
  feedbackTitle: el('feedbackTitle'),
  feedbackSubtitle: el('feedbackSubtitle'),
  confetti: el('confetti'),
  finalScore: el('finalScore'),
  restart: el('restartButton'),
  completionStatus: el('completionStatus'),
  gestureProgress: el('gestureProgressFill'),
  settingsButton: el('settingsButton'),
  settingsPanel: el('settingsPanel'),
  mirrorToggle: el('mirrorToggle')
};

const searchParams = new URLSearchParams(location.search);
const demoMode = searchParams.has('demo');
const modelCheckMode = demoMode && searchParams.has('models');
let mirrorCamera = localStorage.getItem('stepQuizMirrorCamera') !== 'false';
let state = 'startup';
let questionIndex = 0;
let score = 0;
let poseLandmarker;
let gestureRecognizer;
let cameraStream;
let initializing = false;
let cameraLoopStarted = false;
let lastVisionAt = 0;
let lastVideoTime = -1;
let scheduled = [];
let centerSince = 0;
let armed = false;
let candidateSide = null;
let candidateSince = 0;
let thumbSince = 0;

ui.mirrorToggle.checked = mirrorCamera;
ui.camera.classList.toggle('mirrored', mirrorCamera);

function later(callback, delay) {
  const timer = setTimeout(callback, delay);
  scheduled.push(timer);
}

function clearScheduled() {
  for (const timer of scheduled) clearTimeout(timer);
  scheduled = [];
}

function setScreen(screen) {
  ui.startup.hidden = screen !== 'startup';
  ui.quiz.hidden = screen !== 'quiz';
  ui.completion.hidden = screen !== 'completion';
}

function resetSelection() {
  centerSince = 0;
  armed = false;
  candidateSide = null;
  candidateSince = 0;
  ui.trueHold.style.width = '0%';
  ui.falseHold.style.width = '0%';
  ui.trueChoice.classList.remove('active');
  ui.falseChoice.classList.remove('active');
}

function showQuestion() {
  clearScheduled();
  resetSelection();
  state = 'question-intro';
  setScreen('quiz');
  ui.feedback.className = 'feedback';
  ui.feedback.hidden = true;
  ui.confetti.replaceChildren();
  ui.questionPanel.classList.remove('compact');
  ui.choices.classList.remove('visible');
  ui.choices.setAttribute('aria-hidden', 'true');
  ui.progress.textContent = 'Question ' + (questionIndex + 1) + ' of ' + questions.length;
  ui.score.textContent = score + ' / ' + maxScore;
  ui.question.textContent = questions[questionIndex].text;
  ui.questionPrompt.textContent = 'Get ready to choose';
  ui.trackingMessage.textContent = demoMode ? 'Demo mode: use Left and Right arrow keys' : 'Stand in the center to get ready';

  later(() => {
    ui.questionPanel.classList.add('compact');
    ui.questionPrompt.textContent = 'Yes on the left · No on the right';
    later(() => {
      ui.choices.classList.add('visible');
      ui.choices.setAttribute('aria-hidden', 'false');
      state = 'question-active';
      ui.trackingMessage.textContent = demoMode ? 'Use Left or Right arrow key' : 'Stand in the center, then move to your answer';
    }, timing.revealMs);
  }, timing.questionIntroMs);
}

function startQuiz() {
  if (state !== 'ready' && state !== 'complete') return;
  clearScheduled();
  questionIndex = 0;
  score = 0;
  thumbSince = 0;
  ui.gestureProgress.style.width = '0%';
  ui.startupGestureProgress.style.width = '0%';
  showQuestion();
}

function makeConfetti() {
  const colors = ['#ffffff', '#28f1ec', '#c395ff', '#ffd644', '#6effad'];
  const pieces = document.createDocumentFragment();
  for (let i = 0; i < 48; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.setProperty('--piece-color', colors[i % colors.length]);
    piece.style.setProperty('--piece-left', (Math.random() * 100) + '%');
    piece.style.setProperty('--piece-time', (1.8 + Math.random() * 1.2) + 's');
    piece.style.setProperty('--piece-delay', (Math.random() * .6) + 's');
    piece.style.setProperty('--piece-rotation', (Math.random() * 360) + 'deg');
    piece.style.setProperty('--piece-drift', ((Math.random() - .5) * 300) + 'px');
    pieces.append(piece);
  }
  ui.confetti.replaceChildren(pieces);
}

function chooseAnswer(answer) {
  if (state !== 'question-active') return;
  clearScheduled();
  state = 'feedback';
  resetSelection();
  const personal = questions[questionIndex].correct === null;
  const correct = pointsForAnswer(questions[questionIndex], answer) === 1;
  if (correct) score++;
  ui.score.textContent = score + ' / ' + maxScore;
  ui.feedback.hidden = false;
  ui.feedback.className = 'feedback ' + (personal ? 'personal' : correct ? 'correct' : 'incorrect');
  ui.feedbackSymbol.textContent = personal ? '✓' : correct ? '✓' : '✕';
  ui.feedbackTitle.textContent = personal ? 'Thanks!' : correct ? 'Correct!' : 'Not quite';
  ui.feedbackSubtitle.textContent = personal ? 'Just for fun — no points on this one.' : correct ? 'One point earned!' : 'Keep going!';
  if (correct) makeConfetti();
  else ui.confetti.replaceChildren();
  requestAnimationFrame(() => ui.feedback.classList.add('show'));
  later(() => ui.feedback.classList.remove('show'), timing.feedbackMs);
  later(() => {
    ui.feedback.className = 'feedback';
    ui.feedback.hidden = true;
    ui.confetti.replaceChildren();
    questionIndex++;
    if (questionIndex < questions.length) showQuestion();
    else showCompletion();
  }, timing.feedbackMs + timing.feedbackFadeMs);
}

function showCompletion() {
  clearScheduled();
  state = 'complete';
  setScreen('completion');
  ui.finalScore.textContent = score + ' / ' + maxScore + ' points';
  ui.completionStatus.textContent = demoMode ? 'Click Restart Game or press R.' : 'Click Restart Game or hold a thumbs up.';
  ui.gestureProgress.style.width = '0%';
  thumbSince = 0;
}

function setMirror(value) {
  mirrorCamera = value;
  ui.mirrorToggle.checked = value;
  ui.camera.classList.toggle('mirrored', value);
  localStorage.setItem('stepQuizMirrorCamera', String(value));
  resetSelection();
}

function bodyX(poses) {
  if (poses.length !== 1) return null;
  const landmarks = poses[0];
  const torso = [11, 12, 23, 24].map((index) => landmarks[index]).filter((point) => point && (point.visibility ?? 1) >= .5);
  if (torso.length < 2) return null;
  const rawX = torso.reduce((sum, point) => sum + point.x, 0) / torso.length;
  return Math.max(0, Math.min(1, mirrorCamera ? 1 - rawX : rawX));
}

function updatePosition(screenX, poseCount, now) {
  if (screenX === null) {
    ui.positionMarker.classList.remove('seen');
    resetSelection();
    ui.trackingMessage.textContent = poseCount > 1 ? 'One player at a time, please' : 'Step into camera view';
    return;
  }

  ui.positionMarker.classList.add('seen');
  ui.positionMarker.style.left = (screenX * 100) + '%';
  if (state !== 'question-active') return;
  if (!ui.settingsPanel.hidden) {
    resetSelection();
    ui.trackingMessage.textContent = 'Close camera setup to answer';
    return;
  }

  const zone = screenX < zoneLimits.left ? 'left' : screenX > zoneLimits.right ? 'right' : 'center';
  if (!armed) {
    if (zone === 'center') {
      if (!centerSince) centerSince = now;
      if (now - centerSince >= timing.centerHoldMs) armed = true;
      ui.trackingMessage.textContent = armed ? 'Move left for Yes or right for No' : 'Hold in the center to get ready';
    } else {
      centerSince = 0;
      ui.trackingMessage.textContent = 'Return to the center to start this question';
    }
    return;
  }

  if (zone === 'center') {
    candidateSide = null;
    candidateSince = 0;
    ui.trueHold.style.width = '0%';
    ui.falseHold.style.width = '0%';
    ui.trueChoice.classList.remove('active');
    ui.falseChoice.classList.remove('active');
    ui.trackingMessage.textContent = 'Move left for Yes or right for No';
    return;
  }

  if (candidateSide !== zone) {
    candidateSide = zone;
    candidateSince = now;
  }
  const progress = Math.min(100, ((now - candidateSince) / timing.answerHoldMs) * 100);
  ui.trueHold.style.width = zone === 'left' ? progress + '%' : '0%';
  ui.falseHold.style.width = zone === 'right' ? progress + '%' : '0%';
  ui.trueChoice.classList.toggle('active', zone === 'left');
  ui.falseChoice.classList.toggle('active', zone === 'right');
  ui.trackingMessage.textContent = 'Hold ' + (zone === 'left' ? 'left for Yes' : 'right for No');
  if (progress >= 100) chooseAnswer(zone === 'left');
}

function updateThumb(result, now) {
  if ((state !== 'ready' && state !== 'complete') || !ui.settingsPanel.hidden) return;
  const onStart = state === 'ready';
  const progressFill = onStart ? ui.startupGestureProgress : ui.gestureProgress;
  const status = onStart ? ui.startupStatus : ui.completionStatus;
  const idleMessage = onStart ? 'Click Start Game or hold a thumbs up.' : 'Click Restart Game or hold a thumbs up.';
  const thumbsUp = result.gestures.some((categories) => categories.some((item) => item.categoryName === 'Thumb_Up' && item.score >= .65));
  if (!thumbsUp) {
    thumbSince = 0;
    progressFill.style.width = '0%';
    status.textContent = idleMessage;
    return;
  }
  if (!thumbSince) thumbSince = now;
  const progress = Math.min(100, ((now - thumbSince) / timing.restartHoldMs) * 100);
  progressFill.style.width = progress + '%';
  status.textContent = 'Keep your thumb up...';
  if (progress >= 100) startQuiz();
}

function processCamera(now) {
  requestAnimationFrame(processCamera);
  if (!poseLandmarker || !gestureRecognizer || ui.camera.readyState < 2) return;
  if (now - lastVisionAt < timing.visionIntervalMs || ui.camera.currentTime === lastVideoTime) return;
  lastVisionAt = now;
  lastVideoTime = ui.camera.currentTime;
  try {
    if (state === 'ready' || state === 'complete') {
      updateThumb(gestureRecognizer.recognizeForVideo(ui.camera, now), now);
    } else if (state === 'question-intro' || state === 'question-active') {
      const result = poseLandmarker.detectForVideo(ui.camera, now);
      updatePosition(bodyX(result.landmarks), result.landmarks.length, now);
    }
  } catch (error) {
    console.error('Camera tracking failed:', error);
    showError('Camera tracking stopped', 'Check the camera, then try again.');
  }
}

function showError(title, message) {
  clearScheduled();
  state = 'error';
  setScreen('startup');
  ui.startupTitle.textContent = title;
  ui.startupMessage.textContent = message;
  ui.start.hidden = true;
  ui.startupGestureIcon.hidden = true;
  ui.startupStatus.hidden = true;
  ui.startupGestureProgress.parentElement.hidden = true;
  ui.retry.hidden = false;
}

function showReady() {
  state = 'ready';
  setScreen('startup');
  thumbSince = 0;
  ui.startupTitle.textContent = 'Left or Right Quiz';
  ui.startupMessage.textContent = questions.length + ' questions · ' + maxScore + ' knowledge points. Step left for Yes or right for No.';
  ui.start.hidden = false;
  ui.startupGestureIcon.hidden = false;
  ui.retry.hidden = true;
  ui.startupStatus.hidden = false;
  ui.startupGestureProgress.parentElement.hidden = demoMode;
  ui.startupGestureProgress.style.width = '0%';
  ui.startupStatus.textContent = demoMode ? 'Demo mode: click Start Game or press Enter.' : 'Click Start Game or hold a thumbs up.';
}

async function loadVisionModels() {
  if (poseLandmarker && gestureRecognizer) return;
  const vision = await FilesetResolver.forVisionTasks('/node_modules/@mediapipe/tasks-vision/wasm');
  if (!poseLandmarker) {
    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: '/models/pose_landmarker_lite.task', delegate: 'CPU' },
      runningMode: 'VIDEO', numPoses: 2,
      minPoseDetectionConfidence: .55, minPosePresenceConfidence: .55, minTrackingConfidence: .55
    });
  }
  if (!gestureRecognizer) {
    gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
      baseOptions: { modelAssetPath: '/models/gesture_recognizer.task', delegate: 'CPU' },
      runningMode: 'VIDEO', numHands: 1
    });
  }
}

async function boot() {
  if (initializing) return;
  initializing = true;
  state = 'startup-loading';
  setScreen('startup');
  ui.start.hidden = true;
  ui.startupGestureIcon.hidden = true;
  ui.retry.hidden = true;
  ui.startupStatus.hidden = true;
  ui.startupGestureProgress.parentElement.hidden = true;
  ui.startupTitle.textContent = 'Setting up the camera';
  ui.startupMessage.textContent = 'Please allow camera access when your browser asks.';
  try {
    if (demoMode) {
      if (modelCheckMode) {
        ui.startupMessage.textContent = 'Checking local position and gesture models...';
        await loadVisionModels();
      }
      showReady();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access is unavailable in this browser.');
    if (!cameraStream || !cameraStream.active) {
      cameraStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24 } } });
      ui.camera.srcObject = cameraStream;
      cameraStream.getVideoTracks()[0].addEventListener('ended', () => showError('Camera disconnected', 'Reconnect the camera, then try again.'));
    }
    await ui.camera.play();
    ui.startupMessage.textContent = 'Loading position and hand tracking...';
    await loadVisionModels();
    if (!cameraLoopStarted) {
      cameraLoopStarted = true;
      requestAnimationFrame(processCamera);
    }
    showReady();
  } catch (error) {
    console.error('Quiz startup failed:', error);
    const denied = error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError';
    showError(denied ? 'Camera permission needed' : 'Camera could not start', denied ? 'Allow camera access in your browser, then try again.' : (error?.message || 'Check the camera and restart the quiz.'));
  } finally {
    initializing = false;
  }
}

ui.retry.addEventListener('click', boot);
ui.start.addEventListener('click', startQuiz);
ui.restart.addEventListener('click', startQuiz);
ui.settingsButton.addEventListener('click', () => {
  ui.settingsPanel.hidden = !ui.settingsPanel.hidden;
  ui.settingsButton.setAttribute('aria-expanded', String(!ui.settingsPanel.hidden));
  resetSelection();
});
ui.mirrorToggle.addEventListener('change', () => setMirror(ui.mirrorToggle.checked));
document.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'm') setMirror(!mirrorCamera);
  if (event.key === 'Escape') {
    ui.settingsPanel.hidden = true;
    ui.settingsButton.setAttribute('aria-expanded', 'false');
  }
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    if (state === 'question-active') chooseAnswer(event.key === 'ArrowLeft');
  }
  if (event.key === 'Enter' && state === 'ready' && demoMode) startQuiz();
  if (event.key.toLowerCase() === 'r' && state === 'complete') startQuiz();
});

boot();

