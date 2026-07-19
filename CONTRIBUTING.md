# Contributing to Beamly ⚡

Thank you for your interest in contributing to **Beamly**! We aim to make this project the best open-source example of a Flask + WebRTC file transfer application.

Following these guidelines helps ensure a smooth contribution process for everyone.

---

## Code of Conduct

We expect all contributors to follow standard professional etiquette and respect each other during code reviews, issue discussions, and pull requests.

## How Can I Contribute?

### 1. Reporting Bugs
- Search existing issues to ensure the bug hasn't been reported yet.
- Open a new issue with a clear title and descriptive steps to reproduce the bug.
- Include details about your browser version, operating system, and any error logs.

### 2. Suggesting Features
- Open an issue explaining the feature and why it would be valuable.
- Outline how the user experience and codebase might be impacted.

### 3. Submitting Pull Requests
- Fork the repository.
- Create a new branch with a descriptive name (e.g., `feature/clipboard-sync` or `bugfix/ice-negotiation`).
- Keep your changes concise and focused.
- Ensure your code compiles, lints, and matches the project's code style.

---

## Development Setup

1. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/beamly.git
   cd beamly
   ```

2. **Python Setup**:
   - Create and activate a virtual environment:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```
   - Install dependencies:
     ```bash
     pip install -r requirements.txt
     ```

3. **Node.js Setup (Tailwind compilation)**:
   - Install dependencies:
     ```bash
     npm install
     ```
   - Build or watch Tailwind CSS:
     ```bash
     # One-time compile:
     npm run build:css
     
     # Watch for updates during development:
     npm run watch:css
     ```

4. **Running Locally**:
   - Run the Flask server:
     ```bash
     python run.py
     ```
   - Open your browser to `http://localhost:5000`.

---

## Code Style Guidelines

- **Clean Architecture**: Keep the backend strictly for routing, page serving, signaling, and rooms management. Files must **never** be buffered or routed through Flask.
- **Modularity**: Frontend JavaScript modules are split logically (`rtc.js`, `signaling.js`, `sender.js`, `receiver.js`, `connection.js`, `ui.js`). Avoid creating monolithic files.
- **Short Files**: Keep individual files under roughly **300 lines** of code.
- **Documentation**: Write descriptive JSDoc comments for JavaScript functions and type-hinted docstrings for Python functions.
- **Neo-Brutalism**: When adding UI components, strictly follow the Neo-Brutalism design token system configured in `tailwind.config.js` (thick borders, flat colors, no gradients, hard shadows).
