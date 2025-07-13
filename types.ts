export interface Question {
  questionText: string;
  options: string[];
  correctAnswerIndex: number;
}

export type QuizStatus = 'not-started' | 'in-progress' | 'completed' | 'review' | 'certificate';