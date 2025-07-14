import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Question, QuizStatus } from './types';
import { getHint } from './services/geminiService';
import Spinner from './components/Spinner';
import { CheckIcon, XIcon, LightbulbIcon } from './components/icons';
import Certificate from './components/Certificate';

const QUIZ_LENGTH = 20;
const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTfT1NU4iS6T_dYt5R0QVrbPn1X0WfgUU84xBws3GjX-DQwWzHv-mGItn11R5iYIkZbF6Sltfa_qc66/pub?output=csv';
const PASSING_PERCENTAGE = 75;
const QUESTION_TIME_LIMIT = 45;


const shuffleAndSelectQuestions = (questions: Question[], count: number): Question[] => {
  if (questions.length === 0) return [];
  const shuffled = [...questions].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, questions.length));
};

const parseCsv = (csvText: string): Question[] => {
    // This regex splits by comma, but ignores commas inside double-quoted strings.
    const CsvRowRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;

    const rows = csvText.trim().split(/\r?\n/).slice(1); // Ignore header row

    return rows.map(rowStr => {
        if (!rowStr.trim()) return null;

        const columns = rowStr.split(CsvRowRegex);
        
        if (columns.length !== 3) {
            console.warn("Skipping invalid CSV row (wrong number of columns):", rowStr);
            return null;
        }

        // Function to clean leading/trailing quotes and un-escape double quotes ("")
        const clean = (s: string) => {
            if (s.startsWith('"') && s.endsWith('"')) {
                return s.substring(1, s.length - 1).replace(/""/g, '"');
            }
            return s;
        };

        const questionText = clean(columns[0]);
        const optionsStr = clean(columns[1]);
        const correctAnswerIndexStr = clean(columns[2]);
        
        const correctAnswerIndex = parseInt(correctAnswerIndexStr, 10);

        if (!questionText || !optionsStr || isNaN(correctAnswerIndex)) {
             console.warn("Skipping invalid row (missing data):", rowStr);
            return null;
        }

        const options = optionsStr.split('|').map(o => o.trim());

        if (options.length === 0 || options.some(o => !o)) {
            console.warn(`Skipping row with invalid options: ${rowStr}`);
            return null;
        }
        
        return {
            questionText: questionText.trim(),
            options: options,
            correctAnswerIndex: correctAnswerIndex,
        };
    }).filter((q): q is Question => q !== null);
};


const App: React.FC = () => {
  const [quizStatus, setQuizStatus] = useState<QuizStatus>('not-started');
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(null);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  const [isAnswered, setIsAnswered] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [isHintLoading, setIsHintLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState<boolean>(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [candidateName, setCandidateName] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_LIMIT);
  
  useEffect(() => {
    const fetchQuestions = async () => {
        setIsDataLoading(true);
        setDataError(null);
        try {
            const response = await fetch(GOOGLE_SHEET_URL);
            if (!response.ok) {
                throw new Error(`Failed to fetch questions: ${response.status} ${response.statusText}`);
            }
            const csvText = await response.text();
            const parsedQuestions = parseCsv(csvText);
            if(parsedQuestions.length === 0) {
              throw new Error("No questions could be parsed from the data source. Please check the format.");
            }
            setAllQuestions(parsedQuestions);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            console.error("Error fetching or parsing questions:", err);
            setDataError(`Could not load quiz questions. ${errorMessage}`);
        } finally {
            setIsDataLoading(false);
        }
    };
    fetchQuestions();
  }, []);

  const handleTimeUp = useCallback(() => {
    if (isAnswered) return;
    setIsAnswered(true);
    const newAnswers = [...userAnswers];
    newAnswers[currentQuestionIndex] = null; // null indicates timed out
    setUserAnswers(newAnswers);
  }, [isAnswered, userAnswers, currentQuestionIndex]);

  // Timer logic
  useEffect(() => {
    if (quizStatus !== 'in-progress' || isAnswered) {
        return; 
    }
    if (timeLeft === 0) {
        handleTimeUp();
        return;
    }
    const timerId = setInterval(() => {
        setTimeLeft(prevTime => prevTime - 1);
    }, 1000);
    return () => clearInterval(timerId);
  }, [quizStatus, isAnswered, timeLeft, handleTimeUp]);

  // Reset timer for each new question
  useEffect(() => {
    if (quizStatus === 'in-progress') {
        setTimeLeft(QUESTION_TIME_LIMIT);
    }
  }, [currentQuestionIndex, quizStatus]);


  const startQuiz = useCallback(() => {
    if (allQuestions.length === 0 || !candidateName.trim()) return;
    const selectedQuestions = shuffleAndSelectQuestions(allQuestions, QUIZ_LENGTH);
    setQuestions(selectedQuestions);
    setScore(0);
    setCurrentQuestionIndex(0);
    setSelectedAnswerIndex(null);
    setIsAnswered(false);
    setHint(null);
    setUserAnswers(new Array(selectedQuestions.length).fill(null));
    setQuizStatus('in-progress');
  }, [allQuestions, candidateName]);

  const handleAnswerSelect = (selectedIndex: number) => {
    if (isAnswered) return;

    const newAnswers = [...userAnswers];
    newAnswers[currentQuestionIndex] = selectedIndex;
    setUserAnswers(newAnswers);

    setSelectedAnswerIndex(selectedIndex);
    setIsAnswered(true);
    if (selectedIndex === questions[currentQuestionIndex].correctAnswerIndex) {
      setScore(prevScore => prevScore + 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prevIndex => prevIndex + 1);
      setSelectedAnswerIndex(null);
      setIsAnswered(false);
      setHint(null);
      setIsHintLoading(false);
    } else {
      setQuizStatus('completed');
    }
  };

  const handleFetchHint = async () => {
    if (hint || isHintLoading) return;
    setIsHintLoading(true);
    const questionText = questions[currentQuestionIndex].questionText;
    const fetchedHint = await getHint(questionText);
    setHint(fetchedHint);
    setIsHintLoading(false);
  };

  const currentQuestion = useMemo(() => {
    return questions[currentQuestionIndex];
  }, [questions, currentQuestionIndex]);

  const getOptionClasses = (index: number) => {
    if (!isAnswered) {
      return "bg-slate-700 hover:bg-slate-600";
    }
    const isCorrect = index === currentQuestion.correctAnswerIndex;
    if (isCorrect) {
      return "bg-green-500/50 border-green-500";
    }
    if (index === selectedAnswerIndex && !isCorrect) {
      return "bg-red-500/50 border-red-500";
    }
    return "bg-slate-800 text-slate-400 cursor-not-allowed";
  };
  
  const renderQuizScreen = () => (
    <div className="w-full max-w-2xl mx-auto p-4 md:p-8">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <p className="text-lg font-medium text-cyan-400 mb-2">
            Question {currentQuestionIndex + 1} of {questions.length}
          </p>
          <div className="w-full bg-slate-700 rounded-full h-2.5">
            <div className="bg-cyan-500 h-2.5 rounded-full" style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}></div>
          </div>
        </div>
        <div className={`text-4xl font-bold ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-cyan-400'}`}>
          {timeLeft}
        </div>
      </div>

      <h2 className="text-2xl md:text-3xl font-bold text-white mb-8 min-h-[8rem]">{currentQuestion?.questionText}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {currentQuestion?.options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleAnswerSelect(index)}
            disabled={isAnswered}
            className={`w-full p-4 rounded-lg text-white font-semibold text-left transition-all duration-300 border-2 border-transparent flex items-center justify-between ${getOptionClasses(index)}`}
          >
            <span>{option}</span>
            {isAnswered && index === currentQuestion.correctAnswerIndex && <CheckIcon className="w-6 h-6 text-green-300" />}
            {isAnswered && index === selectedAnswerIndex && index !== currentQuestion.correctAnswerIndex && <XIcon className="w-6 h-6 text-red-300" />}
          </button>
        ))}
      </div>
      
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:w-auto min-h-[52px] flex items-center justify-center sm:justify-start">
            {/* Show hint button only if no hint is present and question is not answered */}
            {!hint && !isAnswered && (
              <button
                onClick={handleFetchHint}
                disabled={isHintLoading}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isHintLoading ? <Spinner /> : <LightbulbIcon className="w-5 h-5" />}
                <span>{isHintLoading ? "Getting Hint..." : "Get a Hint"}</span>
              </button>
            )}
            {/* Show hint if it exists. Replaces the button. */}
            {hint && (
              <p className="text-slate-400 italic text-center sm:text-left bg-slate-800 p-3 rounded-lg max-w-md">{hint}</p>
            )}
        </div>

        {isAnswered && (
          <button
            onClick={handleNextQuestion}
            className="w-full sm:w-auto bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-8 rounded-lg transition-colors"
          >
            {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
          </button>
        )}
      </div>
    </div>
  );

  const renderStartScreen = () => (
    <div className="text-center w-full max-w-2xl">
      <h1 className="text-5xl md:text-6xl font-extrabold text-white mb-2">
        Concrete Technology Group
      </h1>
      <p className="text-cyan-400 text-2xl mb-4">Civil Engineering Quiz</p>
      <p className="text-slate-300 text-lg md:text-xl max-w-2xl mx-auto mb-8">
        Enter your name to begin. You'll face {QUIZ_LENGTH > allQuestions.length && allQuestions.length > 0 ? allQuestions.length : QUIZ_LENGTH} random questions. Each question has a {QUESTION_TIME_LIMIT}-second time limit. Good luck!
      </p>

      <div className="mb-8">
        <input 
          type="text"
          value={candidateName}
          onChange={(e) => setCandidateName(e.target.value)}
          placeholder="Enter Your Full Name"
          className="w-full max-w-md p-4 bg-slate-800 border-2 border-slate-600 rounded-lg text-white text-center text-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition"
          aria-label="Candidate Name"
        />
      </div>

      {isDataLoading && (
        <div className="flex flex-col items-center justify-center gap-4">
            <Spinner />
            <p className="text-slate-400">Loading Questions...</p>
        </div>
      )}
      {dataError && <p className="text-red-400 bg-red-500/20 p-4 rounded-lg">{dataError}</p>}
      {!isDataLoading && !dataError && (
        <>
          <button
            onClick={startQuiz}
            disabled={allQuestions.length === 0 || !candidateName.trim()}
            className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-4 px-10 rounded-lg text-xl transition-transform transform hover:scale-105 disabled:bg-slate-700 disabled:cursor-not-allowed disabled:scale-100"
          >
            Start Quiz
          </button>
          <p className="text-slate-500 mt-8">
            An initiative by Concrete Technology Group | <a href="http://www.annapoornainfo.com" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400">www.annapoornainfo.com</a>
          </p>
        </>
      )}
    </div>
  );

  const renderResultScreen = () => {
    const percentage = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
    const hasPassed = percentage >= PASSING_PERCENTAGE;
    
    const getStaticFeedback = () => {
        if (hasPassed) return "Congratulations! You've passed!";
        if (percentage >= 50) return "Great effort! You're getting close.";
        return "Keep practicing to improve your score!";
    };

    return (
        <div className="text-center bg-slate-800/50 p-8 rounded-2xl shadow-2xl backdrop-blur-sm border border-slate-700 max-w-2xl w-full">
            <h1 className="text-4xl font-bold text-white mb-2">Quiz Completed!</h1>
            
            <div className="min-h-[3rem] flex items-center justify-center my-4">
                <p className="text-2xl font-semibold text-cyan-400">{getStaticFeedback()}</p>
            </div>

            <p className="text-slate-300 text-lg mb-4">You scored</p>
            <p className="text-7xl font-bold text-white mb-6">
                {score} <span className="text-3xl font-medium text-slate-400">/ {questions.length}</span>
            </p>
            <div className="w-full bg-slate-700 rounded-full h-4 mb-8">
                <div className={`h-4 rounded-full ${hasPassed ? 'bg-gradient-to-r from-green-400 to-cyan-500' : 'bg-gradient-to-r from-amber-500 to-red-500'}`} style={{ width: `${percentage}%` }}></div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                 <button
                    onClick={() => setQuizStatus('review')}
                    className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 px-8 rounded-lg text-lg transition-transform transform hover:scale-105"
                >
                    Review Answers
                </button>
                <button
                    onClick={startQuiz}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-8 rounded-lg text-lg transition-transform transform hover:scale-105"
                >
                    Play Again
                </button>
            </div>
             {hasPassed && (
                <div className="mt-6">
                    <button
                        onClick={() => setQuizStatus('certificate')}
                        className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-3 px-8 rounded-lg text-lg transition-transform transform hover:scale-105 animate-pulse"
                    >
                        View Certificate
                    </button>
                </div>
            )}
        </div>
    );
  };

  const renderReviewScreen = () => {
    const getReviewOptionClasses = (question: Question, questionIndex: number, optionIndex: number) => {
        const isCorrect = optionIndex === question.correctAnswerIndex;
        const userAnswer = userAnswers[questionIndex];
        const isUserAnswer = optionIndex === userAnswer;

        if (isCorrect) {
            return "bg-green-500/30 border-green-500";
        }
        if (isUserAnswer && !isCorrect) {
            return "bg-red-500/30 border-red-500";
        }
        return "bg-slate-800 border-slate-700";
    };

    return (
        <div className="w-full max-w-3xl mx-auto p-4 md:p-8">
            <h1 className="text-4xl font-bold text-white mb-8 text-center">Review Answers</h1>
            <div className="space-y-8">
                {questions.map((q, qIndex) => (
                    <div key={qIndex} className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                        <p className="text-lg font-medium text-cyan-400 mb-2">Question {qIndex + 1}</p>
                        <h2 className="text-xl font-bold text-white mb-4">{q.questionText}</h2>
                        <div className="space-y-3">
                            {q.options.map((option, oIndex) => {
                                const isCorrect = oIndex === q.correctAnswerIndex;
                                const isUserAnswer = oIndex === userAnswers[qIndex];
                                return (
                                    <div
                                        key={oIndex}
                                        className={`p-3 rounded-lg text-white text-left border-2 flex items-center justify-between ${getReviewOptionClasses(q, qIndex, oIndex)}`}
                                    >
                                        <span>{option}</span>
                                        {isCorrect && <CheckIcon className="w-5 h-5 text-green-300" />}
                                        {isUserAnswer && !isCorrect && <XIcon className="w-5 h-5 text-red-300" />}
                                    </div>
                                );
                            })}
                        </div>
                        {userAnswers[qIndex] === null && (
                            <p className="text-amber-400 italic mt-4 text-sm">You ran out of time for this question.</p>
                        )}
                    </div>
                ))}
            </div>
            <div className="text-center mt-12">
                <button
                    onClick={startQuiz}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-4 px-10 rounded-lg text-xl transition-transform transform hover:scale-105"
                >
                    Play Again
                </button>
            </div>
        </div>
    )
  };
  
  const renderCertificateScreen = () => {
      return (
          <Certificate 
            name={candidateName}
            score={score}
            totalQuestions={questions.length}
            onBack={() => setQuizStatus('completed')}
          />
      )
  }

  const renderContent = () => {
    switch(quizStatus) {
        case 'not-started':
            return renderStartScreen();
        case 'in-progress':
            return currentQuestion ? renderQuizScreen() : renderStartScreen();
        case 'completed':
            return renderResultScreen();
        case 'review':
            return renderReviewScreen();
        case 'certificate':
            return renderCertificateScreen();
        default:
            return renderStartScreen();
    }
  }
  
  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-slate-900 text-white p-4 font-sans bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]">
      {renderContent()}
    </main>
  );
};

export default App;
