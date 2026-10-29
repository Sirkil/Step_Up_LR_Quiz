// Questions and scoring follow the answer guide in game pompe (1).docx.
// Personal questions accept either answer and do not award points.
export const questions = [
  { text: 'Have you ever run faster for a deadline than for a workout?', correct: null },
  { text: 'Have you ever climbed the stairs and felt like you needed an oxygen break?', correct: null },
  { text: 'Do your muscles say “NO” more often than your manager?', correct: null },
  { text: 'Have you ever said, “I’ll start the gym on Saturday,” and never actually started?', correct: null },
  { text: 'Can Pompe disease affect both muscles and breathing?', correct: true },
  { text: 'Have you ever held your breath while sending an “URGENT” email?', correct: null },
  { text: 'Have you ever stood up from the sofa and felt like you completed a full workout?', correct: null },
  { text: 'Is Pompe disease a rare inherited disorder?', correct: true },
  { text: 'Can Leg Day turn climbing stairs into slow motion?', correct: null },
  { text: 'Does everyone with muscle weakness have Pompe disease?', correct: false },
  { text: 'Have you ever rushed to a meeting and forgotten why you were running?', correct: null },
  { text: 'Can Pompe symptoms appear in adulthood?', correct: true },
  { text: 'Does Sunday morning require stronger muscles than the weekend?', correct: null },
  { text: 'Is Pompe disease contagious?', correct: false },
  { text: 'Can muscle weakness affect getting up from a chair?', correct: true },
  { text: 'Do you take a deep breath before opening an email marked “URGENT”?', correct: null },
  { text: 'Do all people with Pompe disease experience the same symptoms?', correct: false },
  { text: 'Have you ever watched a deadline approach faster than your presentation gets finished?', correct: null },
  { text: 'Is the GAA enzyme involved in Pompe disease?', correct: true },
  { text: 'Can Pompe disease affect the muscles used for breathing?', correct: true },
  { text: 'Have you ever pretended to be busy while waiting for your coffee?', correct: null },
  { text: 'Can Pompe disease be confirmed through appropriate diagnostic testing?', correct: true },
  { text: "Can Pompe disease affect a person's ability to climb stairs?", correct: true },
  { text: 'Have you ever needed a recovery day after a full day of meetings?', correct: null },
  { text: 'Is early diagnosis important in managing Pompe disease?', correct: true }
];

export const maxScore = questions.filter((question) => question.correct !== null).length;

export function pointsForAnswer(question, answer) {
  return question.correct !== null && question.correct === answer ? 1 : 0;
}
