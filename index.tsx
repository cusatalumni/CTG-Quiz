
// No longer importing GoogleGenAI on the client
// import { GoogleGenAI } from "@google/genai";

declare const html2pdf: any;

// --- INTERFACES ---
interface Question {
  questionText: string;
  options: string[];
  correctAnswerIndex: number;
}

// --- CONSTANTS ---
const QUIZ_LENGTH = 20;
const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTfT1NU4iS6T_dYt5R0QVrbPn1X0WfgUU84xBws3GjX-DQwWzHv-mGItn11R5iYIkZbF6Sltfa_qc66/pub?output=csv';
const PASSING_PERCENTAGE = 75;
const QUESTION_TIME_LIMIT = 30;

// --- SVG ICONS ---
const CheckIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 text-green-300"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>`;
const XIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 text-red-300"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>`;
const LightbulbIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.311a7.5 7.5 0 0 1-7.5 0c-1.421-.666-2.47-2.017-2.733-3.616a11.027 11.027 0 0 1 0-2.135c.263-1.599 1.312-2.95 2.733-3.616a7.5 7.5 0 0 1 7.5 0c1.421.666 2.47 2.017 2.733 3.616a11.027 11.027 0 0 1 0 2.135c-.263 1.599-1.312-2.95-2.733-3.616Z" /></svg>`;
const Spinner = `<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>`;

// --- STATE VARIABLES ---
let quizStatus = 'not-started'; // 'not-started' | 'in-progress' | 'completed' | 'review' | 'certificate'
let allQuestions: Question[] = [];
let questions: Question[] = [];
let currentQuestionIndex = 0;
let score = 0;
let userAnswers: (number | null)[] = [];
let isAnswered = false;
let hint: string | null = null;
let isHintLoading = false;
let candidateName = '';
let timeLeft = QUESTION_TIME_LIMIT;
let timerId: number | null = null;

// --- DOM ELEMENTS ---
const screens = {
  start: document.getElementById('start-screen') as HTMLElement,
  quiz: document.getElementById('quiz-screen') as HTMLElement,
  result: document.getElementById('result-screen') as HTMLElement,
  review: document.getElementById('review-screen') as HTMLElement,
  certificate: document.getElementById('certificate-screen') as HTMLElement,
};
const startScreenDesc = document.getElementById('start-screen-description') as HTMLElement;
const startLoader = document.getElementById('start-loader') as HTMLElement;
const startButtonContainer = document.getElementById('start-button-container') as HTMLElement;
const dataErrorEl = document.getElementById('data-error') as HTMLElement;
const candidateNameInput = document.getElementById('candidate-name-input') as HTMLInputElement;
const startQuizButton = document.getElementById('start-quiz-button') as HTMLButtonElement;
const questionCounter = document.getElementById('question-counter') as HTMLElement;
const progressBar = document.getElementById('progress-bar') as HTMLDivElement;
const timerEl = document.getElementById('timer') as HTMLElement;
const questionTextEl = document.getElementById('question-text') as HTMLElement;
const optionsContainer = document.getElementById('options-container') as HTMLElement;
const hintContainer = document.getElementById('hint-container') as HTMLElement;
const nextButtonContainer = document.getElementById('next-button-container') as HTMLElement;
const resultFeedback = document.getElementById('result-feedback') as HTMLElement;
const resultScore = document.getElementById('result-score') as HTMLElement;
const resultProgressBar = document.getElementById('result-progress-bar') as HTMLDivElement;
const certButtonContainer = document.getElementById('certificate-button-container') as HTMLElement;
const reviewAnswersButton = document.getElementById('review-answers-button') as HTMLButtonElement;
const playAgainResultButton = document.getElementById('play-again-button-result') as HTMLButtonElement;
const reviewContainer = document.getElementById('review-questions-container') as HTMLElement;
const playAgainReviewButton = document.getElementById('play-again-button-review') as HTMLButtonElement;
const certName = document.getElementById('certificate-name') as HTMLElement;
const certScore = document.getElementById('certificate-score') as HTMLElement;
const certDate = document.getElementById('certificate-date') as HTMLElement;
const backToResultsButton = document.getElementById('back-to-results-button') as HTMLButtonElement;
const downloadPdfButton = document.getElementById('download-pdf-button') as HTMLButtonElement;


// --- API FUNCTIONS ---
async function getHint(questionText: string): Promise<string> {
  try {
    const response = await fetch('/api/hint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ questionText }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({})); // try to parse error, but don't fail if it's not JSON
        console.error("API Error Response:", errorData);
        throw new Error(`Failed to fetch hint. Status: ${response.status}`);
    }

    const data = await response.json();
    return data.hint || "Sorry, couldn't get a hint.";

  } catch (error) {
    console.error("Error fetching hint from API route:", error);
    return "Sorry, I couldn't get a hint for you right now.";
  }
}


// --- UTILITY FUNCTIONS ---
const parseCsv = (csvText: string): Question[] => {
    const CsvRowRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
    const rows = csvText.trim().split(/\r?\n/).slice(1);
    return rows.map((rowStr): Question | null => {
        if (!rowStr.trim()) return null;
        const columns = rowStr.split(CsvRowRegex);
        if (columns.length !== 3) return null;
        const clean = (s: string) => (s.startsWith('"') && s.endsWith('"')) ? s.substring(1, s.length - 1).replace(/""/g, '"') : s;
        const [questionText, optionsStr, correctAnswerIndexStr] = columns.map(clean);
        const correctAnswerIndex = parseInt(correctAnswerIndexStr, 10);
        if (!questionText || !optionsStr || isNaN(correctAnswerIndex)) return null;
        const options = optionsStr.split('|').map(o => o.trim());
        if (options.length === 0 || options.some(o => !o)) return null;
        return { questionText: questionText.trim(), options, correctAnswerIndex };
    }).filter((q): q is Question => q !== null);
};

const shuffleAndSelectQuestions = (questionsArr: Question[], count: number): Question[] => {
  if (questionsArr.length === 0) return [];
  const shuffled = [...questionsArr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, questionsArr.length));
};

// --- RENDERING & UI UPDATES ---
function updateView() {
  Object.values(screens).forEach(screen => screen.classList.add('hidden'));
  const currentScreen = screens[quizStatus as keyof typeof screens];
  if (currentScreen) {
      currentScreen.classList.remove('hidden');
  }

  switch (quizStatus) {
    case 'not-started': renderStartScreen(); break;
    case 'in-progress': renderQuizScreen(); break;
    case 'completed': renderResultScreen(); break;
    case 'review': renderReviewScreen(); break;
    case 'certificate': renderCertificateScreen(); break;
  }
}

function renderStartScreen() {
    startScreenDesc.textContent = `Enter your name to begin. You'll face ${QUIZ_LENGTH > allQuestions.length && allQuestions.length > 0 ? allQuestions.length : QUIZ_LENGTH} random questions. Each question has a ${QUESTION_TIME_LIMIT}-second time limit. Good luck!`;
}

function renderQuizScreen() {
  isAnswered = false;
  hint = null;
  isHintLoading = false;
  
  const question = questions[currentQuestionIndex];
  if (!question) return;

  // Reset timer
  timeLeft = QUESTION_TIME_LIMIT;
  timerEl.textContent = String(timeLeft);
  timerEl.className = 'text-4xl font-bold text-cyan-400';
  if(timerId) clearInterval(timerId);
  timerId = window.setInterval(handleTimerTick, 1000);

  questionCounter.textContent = `Question ${currentQuestionIndex + 1} of ${questions.length}`;
  progressBar.style.width = `${((currentQuestionIndex + 1) / questions.length) * 100}%`;
  questionTextEl.textContent = question.questionText;

  optionsContainer.innerHTML = '';
  question.options.forEach((option, index) => {
    const button = document.createElement('button');
    button.className = "w-full p-4 rounded-lg text-white font-semibold text-left transition-all duration-300 border-2 border-transparent flex items-center justify-between bg-slate-700 hover:bg-slate-600";
    button.innerHTML = `<span>${option}</span>`;
    button.onclick = () => handleAnswerSelect(index);
    optionsContainer.appendChild(button);
  });
  
  updateQuizScreenControls();
}

function updateQuizScreenControls() {
  const question = questions[currentQuestionIndex];

  // Update option button styles
  Array.from(optionsContainer.children).forEach((button, index) => {
      (button as HTMLButtonElement).disabled = isAnswered;
      let classes = "w-full p-4 rounded-lg text-white font-semibold text-left transition-all duration-300 border-2 border-transparent flex items-center justify-between ";
      
      if (!isAnswered) {
          classes += "bg-slate-700 hover:bg-slate-600";
      } else {
          const isCorrect = index === question.correctAnswerIndex;
          const userAnswer = userAnswers[currentQuestionIndex];
          
          if (isCorrect) {
              classes += "bg-green-500/50 border-green-500";
              button.innerHTML = `<span>${question.options[index]}</span>${CheckIcon}`;
          } else if (index === userAnswer && !isCorrect) {
              classes += "bg-red-500/50 border-red-500";
              button.innerHTML = `<span>${question.options[index]}</span>${XIcon}`;
          } else {
              classes += "bg-slate-800 text-slate-400 cursor-not-allowed";
          }
      }
      button.className = classes;
  });

  // Update hint and next buttons
  hintContainer.innerHTML = '';
  nextButtonContainer.innerHTML = '';
  
  if (isAnswered) {
    const nextButton = document.createElement('button');
    nextButton.className = "w-full sm:w-auto bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-8 rounded-lg transition-colors";
    nextButton.textContent = currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Finish Quiz';
    nextButton.onclick = handleNextQuestion;
    nextButtonContainer.appendChild(nextButton);
  } else if (!isHintLoading && hint) {
      hintContainer.innerHTML = `<p class="text-slate-400 italic text-center sm:text-left mt-2 sm:mt-0 bg-slate-800 p-3 rounded-lg">${hint}</p>`;
  } else {
    const hintButton = document.createElement('button');
    hintButton.className = "w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
    hintButton.disabled = isHintLoading;
    hintButton.innerHTML = isHintLoading ? `${Spinner} <span>Getting Hint...</span>` : `${LightbulbIcon} <span>Get a Hint</span>`;
    hintButton.onclick = handleFetchHint;
    hintContainer.appendChild(hintButton);
  }
}

function renderResultScreen() {
    const percentage = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
    const hasPassed = percentage >= PASSING_PERCENTAGE;

    resultFeedback.textContent = hasPassed ? "Congratulations! You've passed!" : (percentage >= 50 ? "Great effort! You're getting close." : "Keep practicing to improve your score!");
    resultScore.innerHTML = `${score} <span class="text-3xl font-medium text-slate-400">/ ${questions.length}</span>`;
    resultProgressBar.style.width = `${percentage}%`;
    resultProgressBar.className = `h-4 rounded-full ${hasPassed ? 'bg-gradient-to-r from-green-400 to-cyan-500' : 'bg-gradient-to-r from-amber-500 to-red-500'}`;
    
    certButtonContainer.innerHTML = '';
    if(hasPassed) {
        const certButton = document.createElement('button');
        certButton.className = "bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-3 px-8 rounded-lg text-lg transition-transform transform hover:scale-105 animate-pulse";
        certButton.textContent = 'View Certificate';
        certButton.onclick = () => { quizStatus = 'certificate'; updateView(); };
        certButtonContainer.appendChild(certButton);
    }
}

function renderReviewScreen() {
    reviewContainer.innerHTML = '';
    questions.forEach((q, qIndex) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = "bg-slate-800/50 p-6 rounded-xl border border-slate-700";
        let optionsHtml = '';
        q.options.forEach((option, oIndex) => {
            const isCorrect = oIndex === q.correctAnswerIndex;
            const isUserAnswer = oIndex === userAnswers[qIndex];
            let classes = "p-3 rounded-lg text-white text-left border-2 flex items-center justify-between ";
            let icon = '';
            if (isCorrect) {
                classes += "bg-green-500/30 border-green-500";
                icon = CheckIcon.replace('class="w-6 h-6', 'class="w-5 h-5');
            } else if (isUserAnswer && !isCorrect) {
                classes += "bg-red-500/30 border-red-500";
                icon = XIcon.replace('class="w-6 h-6', 'class="w-5 h-5');
            } else {
                classes += "bg-slate-800 border-slate-700";
            }
            optionsHtml += `<div class="${classes}"><span>${option}</span>${icon}</div>`;
        });

        questionDiv.innerHTML = `
            <p class="text-lg font-medium text-cyan-400 mb-2">Question ${qIndex + 1}</p>
            <h2 class="text-xl font-bold text-white mb-4">${q.questionText}</h2>
            <div class="space-y-3">${optionsHtml}</div>
            ${userAnswers[qIndex] === null ? `<p class="text-amber-400 italic mt-4 text-sm">You ran out of time for this question.</p>` : ''}
        `;
        reviewContainer.appendChild(questionDiv);
    });
}

function renderCertificateScreen() {
    certName.textContent = candidateName;
    certScore.textContent = `${Math.round((score/questions.length)*100)}%`;
    certDate.textContent = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}


// --- LOGIC & EVENT HANDLERS ---
function handleTimerTick() {
    if (isAnswered) {
        if(timerId) clearInterval(timerId);
        return;
    }
    timeLeft--;
    timerEl.textContent = String(timeLeft);
    if (timeLeft <= 5) {
        timerEl.className = 'text-4xl font-bold text-red-500 animate-pulse';
    }
    if (timeLeft === 0) {
        if(timerId) clearInterval(timerId);
        handleTimeUp();
    }
}

function handleTimeUp() {
    if (isAnswered) return;
    isAnswered = true;
    userAnswers[currentQuestionIndex] = null; // Timed out
    updateQuizScreenControls();
}

function startQuiz() {
  if (allQuestions.length === 0 || !candidateName.trim()) return;
  
  questions = shuffleAndSelectQuestions(allQuestions, QUIZ_LENGTH);
  score = 0;
  currentQuestionIndex = 0;
  userAnswers = new Array(questions.length).fill(null);
  
  quizStatus = 'in-progress';
  updateView();
}

function handleAnswerSelect(selectedIndex: number) {
  if (isAnswered) return;
  isAnswered = true;
  if(timerId) clearInterval(timerId);

  userAnswers[currentQuestionIndex] = selectedIndex;
  if (selectedIndex === questions[currentQuestionIndex].correctAnswerIndex) {
    score++;
  }
  
  updateQuizScreenControls();
}

function handleNextQuestion() {
  if (currentQuestionIndex < questions.length - 1) {
    currentQuestionIndex++;
    renderQuizScreen();
  } else {
    quizStatus = 'completed';
    updateView();
  }
}

async function handleFetchHint() {
  if (hint || isHintLoading) return;
  isHintLoading = true;
  updateQuizScreenControls();

  const questionText = questions[currentQuestionIndex].questionText;
  hint = await getHint(questionText);

  isHintLoading = false;
  updateQuizScreenControls();
}

function handleSaveAsPdf() {
    const element = document.getElementById('certificate-content');
    if (element) {
        const opt = {
            margin: 0,
            filename: `Certificate-${candidateName.replace(/ /g, '_')}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 3, backgroundColor: null, useCORS: true },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
        };
        html2pdf().from(element).set(opt).save();
    }
}


// --- INITIALIZATION ---
async function fetchQuestions() {
    try {
        const response = await fetch(GOOGLE_SHEET_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const csvText = await response.text();
        const parsed = parseCsv(csvText);
        if (parsed.length === 0) throw new Error("No questions could be parsed.");
        allQuestions = parsed;
        startLoader.classList.add('hidden');
        startButtonContainer.classList.remove('hidden');
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'An unknown error occurred.';
        dataErrorEl.textContent = `Could not load quiz questions. ${msg}`;
        dataErrorEl.classList.remove('hidden');
        startLoader.classList.add('hidden');
    }
}

function init() {
  // Event Listeners
  candidateNameInput.addEventListener('input', () => {
    candidateName = candidateNameInput.value;
    startQuizButton.disabled = !candidateName.trim();
  });
  
  startQuizButton.addEventListener('click', startQuiz);
  playAgainResultButton.addEventListener('click', startQuiz);
  playAgainReviewButton.addEventListener('click', startQuiz);
  
  reviewAnswersButton.addEventListener('click', () => {
      quizStatus = 'review';
      updateView();
  });

  backToResultsButton.addEventListener('click', () => {
      quizStatus = 'completed';
      updateView();
  });
  
  downloadPdfButton.addEventListener('click', handleSaveAsPdf);
  
  // Initial Load
  updateView();
  fetchQuestions();
}

document.addEventListener('DOMContentLoaded', init);
