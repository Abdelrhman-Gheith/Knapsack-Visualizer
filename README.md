# Knapsack Visualizer — 0/1 Dynamic Programming Simulator

An interactive, educational web simulator for the **0/1 Knapsack Problem** using **Dynamic Programming**. All algorithmic calculations, Dynamic Programming table generation, step-by-step recurrence evaluations, and optimal item backtracking are executed in **Python** via a **Flask HTTP API**, while the frontend built with **HTML, CSS, Vanilla JavaScript, and Vite** renders the interactive visualizations.

---

## Project Structure

```text
project/
  backend/
    app.py              # Flask HTTP API server (/api/solve, /api/source, /api/health)
    knapsack.py         # Core 0/1 Knapsack DP algorithm & step-by-step history generator
    requirements.txt    # Python dependencies (Flask, Flask-CORS)

  frontend/
    index.html          # Main application layout & native modal dialog
    package.json        # Vite development & build scripts
    src/
      main.js           # Application state, API client, drag-and-drop & simulation controller
      style.css         # Clean light academic UI theme, DP table styling, and responsive layout
      visualization.js  # DOM rendering for Item Gallery, Backpack, Code Panel, and DP Table
      assets/
        backpack.svg    # Vector backpack icon used in header and favicon

  README.md             # Setup and usage documentation
```

---

## How to Run Locally (Two Terminals)

### Terminal 1 — Start the Python Flask Backend

1. Open a terminal in the project root directory and navigate to `backend/`:
   ```bash
   cd backend
   ```
2. Install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```
3. Start the Flask API server:
   ```bash
   python app.py
   ```
   The backend will start at **`http://127.0.0.1:5000`**.

---

### Terminal 2 — Start the Vite Frontend

1. Open a second terminal in the project root directory and navigate to `frontend/`:
   ```bash
   cd frontend
   ```
2. Install the frontend dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open the local URL shown in the terminal (typically **`http://localhost:5173`**) in your browser.

---

## Key Features

1. **Unchanged Python 0/1 Knapsack Algorithm (`backend/knapsack.py`)**
   - Preserves the exact textbook `knapsack(weights, values, capacity)` function.
   - Provides `solve_knapsack_detailed(items, capacity)` to record every cell calculation, include/exclude comparison, and optimal backtracking path.
2. **Interactive Item Gallery & Drag-and-Drop Backpack**
   - Add, edit, or delete custom items with custom icons, weights, values, and accent colors.
   - Drag and drop items into the interactive backpack illustration (or click item cards to pack/unpack).
   - Prevents exceeding the backpack capacity with visual feedback and capacity telemetry.
3. **Live Python Source Code Panel**
   - Displays the actual Python source code fetched from `backend/knapsack.py` with syntax highlighting, line numbers, and active line highlighting synchronized with the step-by-step simulation.
4. **Interactive Dynamic Programming Table (`dp[i][w]`)**
   - Displays all item rows (`i = 0..n`) and capacity columns (`w = 0..W`).
   - Highlights the active cell `dp[i][w]`, the **Include** lookup cell `dp[i-1][w - weight]`, the **Exclude** lookup cell `dp[i-1][w]`, and the final optimal backtracking path.
   - Click any cell in the DP table to jump directly to its calculation step.
5. **Step-by-Step Simulation & Optimal Results**
   - Play, Pause, Next Step, Previous Step, Restart, Jump to End, interactive step scrubber, and adjustable playback speed (`0.5x` to `8x`).
   - Displays the final maximum value, selected items, total weight, and remaining capacity, and packs the optimal items visually inside the backpack.

