<div align="center">
  <h1>🔐 The Password Game Automator</h1>
  <p><i>A fully unhinged, automated solver for Neal.fun's infamous <a href="https://neal.fun/password-game/">The Password Game</a>.</i></p>

  <p>
    <img src="https://img.shields.io/badge/Status-Active-success?style=flat-square" alt="Status">
    <img src="https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
    <img src="https://img.shields.io/badge/Manifest-V3-12100E?style=flat-square&logo=google-chrome&logoColor=white" alt="Manifest V3">
  </p>
</div>

<br>

Ever grown tired of looking up the current moon phase, calculating digit sums, searching for atomic numbers, and playing Wordle just to get a green checkmark? **The Password Game Automator** is a Chrome Extension that brute-forces, spies on, and solves rules automatically in real-time.

## ✨ Features

- 🧠 **Dynamic Constraint Solver**: An internal CSP (Constraint Satisfaction Problem) engine dynamically balances competing numerical constraints like digit sum (`25`), Roman numeral products (`x 35`), and atomic number sums (`200`).
- 🕵️ **"Password Spy" Memory Interception**: Hooks into the game's client-side internal validation `includes()` checks to passively capture hidden answers for **GeoGuessr**, **Chess**, and **Wordle**, without requiring external APIs!
- ⌨️ **ProseMirror Escalation**: Automatically injects text into the game's complex rich-text editor using an "escalation ladder" (from `execCommand` down to raw event firing).
- 🧱 **Zone Management Architecture**: Manages the generated password via distinct "Zones" (Text, Digits, Elements, Egg 🥚, etc.) to ensure that new rule payloads don't accidentally poison the budget of previous rules.

## 🚀 Installation & Build

Everything is built fast with `esbuild` using vanilla TypeScript.

1. Clone this repository:
   ```bash
   git clone https://github.com/Tha-Nixo/ThePasswordCrack.git
   cd ThePasswordCrack
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the extension:
   ```bash
   node esbuild.config.mjs
   ```
4. Load into Chrome:
   - Go to `chrome://extensions/`
   - Enable **Developer mode** toggle in the top right.
   - Click **Load unpacked** and select the root directory `ThePasswordCrack`.

## 🎮 Usage

Simply nagivate to [The Password Game](https://neal.fun/password-game/). The extension will immediately detect the editor and begin solving rules. 

Currently, the solver is highly automated up to **Rule 18**.
*Note: Rule 10 (CAPTCHA) requires quick human intervention via the browser to pass the image code, though automation efforts are underway!*

## 🧩 How It Works

This project is built around a complex Main Loop, an Engine, and several independent Evaluators:

- **`BudgetTracker`**: Analyzes the current password layout to find out the current "digit sum pollution" or "roman numeral pollution" originating from standard text zones.
- **`NumericSolver`**: Generates mathematically correct strings composed of digits, Roman numerals, and Periodic Table elements to satisfy global constraints.
- **`Spy Injector`**: Uses a `<script>` tag injection into the `MAIN` world to monkey-patch `String.prototype.includes` and `RegExp.prototype.match` to exfiltrate answers the game is testing your text against.

## 🤝 Contributing

Feel free to open a PR! As Neal.fun adds new rules, the engine will need more handler zones and specialized regex detectors. Currently exploring ways to bypass the CAPTCHA entirely.

---
*Disclaimer: This project was built for educational purposes to explore DOM manipulation, AST/regex intercepting, and algorithmic constraint solving. All rights for the actual game belong to Neal Agarwal.*
