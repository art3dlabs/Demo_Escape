import { updateHUD } from "./ui.js";
import { setGameState, GAME_STATES, getGameState } from "./main.js"; // <<< MODIFIED LINE
import { playSound } from "./audio.js";

let timerIntervalId = null;
let timerValue = 0; // Current time in seconds
let timerRunning = false;

export function startTimer(durationInSeconds) {
  stopTimer(); // Clear previous timer if any
  timerValue = durationInSeconds > 0 ? durationInSeconds : 0;
  timerRunning = true;
  updateHUD(); // Show initial time

  timerIntervalId = setInterval(() => {
    // Check game state within interval
    const gameState = getGameState();
    if (timerRunning && gameState === GAME_STATES.PLAYING) {
      if (timerValue > 0) {
        timerValue--;
        updateHUD(); // Update time display
      } else {
        // Time's up!
        stopTimer();
        triggerGameOverTimeUp();
      }
    }
    // Timer implicitly pauses if not in PLAYING state
  }, 1000);

  console.log(`Timer started: ${durationInSeconds} seconds.`);
}

export function stopTimer() {
  if (timerIntervalId) {
    clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
  timerRunning = false;
  console.log("Timer stopped.");
  updateHUD(); // Update display (might hide timer)
}

export function isTimerRunning() {
  return timerRunning;
}

export function getFormattedTime() {
  const minutes = Math.floor(timerValue / 60);
  const seconds = timerValue % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

export function applyHelpPenalty() {
  if (timerRunning) {
    const originalTime = timerValue;
    timerValue = Math.ceil(timerValue / 2); // Halve time, round up
    console.log(
      `Help penalty applied. Time reduced from ${originalTime}s to ${timerValue}s.`
    );
    updateHUD(); // Update display immediately
  }
}

function triggerGameOverTimeUp() {
  console.log("GAME OVER - Time Ran Out!");
  playSound("game_over"); // Or a specific time-up sound
  setGameState(GAME_STATES.GAMEOVER_TIMEUP); // Set specific state for time up
}
