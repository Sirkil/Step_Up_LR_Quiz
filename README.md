# Step Up Left / Right Quiz

Run `Start_Quiz.bat` on Windows. It starts the quiz at `http://127.0.0.1:8765` and opens the browser. Keep the terminal window open while playing. Allow camera access when prompted, then use the browser's full-screen mode (F11) for the display. Keep the `assets` folder inside this quiz folder.

The browser runs body and hand recognition locally. The browser files and both model files are included in this folder, so the quiz does not need an internet connection at the venue. Node.js must be installed for the Windows launcher. Run `npm install` only if you need to update the MediaPipe dependency.

## Publish on GitHub Pages

Push the entire folder, including `index.html`, `assets/`, `models/`, and `vendor/mediapipe/`, to a GitHub repository. In the repository, open **Settings → Pages**. Under **Build and deployment**, select **Deploy from a branch**, choose the branch you pushed (usually `main`) and the **/(root)** folder, then save. Open the `github.io` site URL shown there. A repository's **Code** page does not run the quiz.

GitHub Pages uses `index.html` as the entry page. All links in the quiz are relative, so a project URL such as `https://USERNAME.github.io/REPOSITORY/` works. The camera needs an HTTPS site and browser permission. If you edit the quiz and push again, wait for Pages to finish publishing before refreshing the site.

## Questions

The 25 questions from `game pompe (1).docx` are in `questions.mjs`, in document order. Yes is on the left and No is on the right. The 12 knowledge questions award one point for the correct answer; personal/funny questions award no points regardless of the answer. Edit the `questions` list in `questions.mjs` to change the quiz. Use `correct: true` for Yes, `false` for No, and `null` for an unscored question.

## Playing

On the first screen, click **Start Game** or hold a thumbs up for about one second. The question appears large, shrinks, then reveals the choices. Stand in the center briefly to arm each question. Move to the left for Yes or the right for No and hold for about one second. After feedback, return to the center for the next question. At the end, the score is shown out of 12; click **Restart Game** or hold a thumbs up to play again from question 1 with a fresh score.

Use the gear icon to check camera orientation. Stand on the physical left of the screen; the position marker should move left. If it moves right, turn off or on **Mirror camera sides**. Only one player should be in camera view.

Operator test controls: Left and Right arrow keys answer the active question, R restarts after completion, and M flips camera sides. Add `?demo=1` to the URL to test the screen without a camera; click **Start Game** or press Enter. Add `?demo=1&models=1` to also check that the local recognition models load. Run `npm test` for the automated question, scoring, and asset checks.
