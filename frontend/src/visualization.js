/**
 * visualization.js
 * Pure UI and DOM rendering module for Knapsack Visualizer.
 * All Dynamic Programming data, steps, and optimal results come exclusively from the Python backend.
 */

const PY_KEYWORDS = new Set([
  "def", "for", "in", "if", "elif", "else", "return", "while", "import", "from", "as", "True", "False", "None", "and", "or", "not"
]);

const PY_BUILTINS = new Set([
  "len", "range", "max", "min", "int", "sum", "str", "list", "dict", "enumerate"
]);

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Syntax highlight a single line of Python source code.
 */
export function highlightPythonLine(rawLine) {
  // Separate trailing comment if present
  let codePart = rawLine;
  let commentPart = "";
  const hashIdx = rawLine.indexOf("#");
  if (hashIdx !== -1) {
    codePart = rawLine.slice(0, hashIdx);
    commentPart = rawLine.slice(hashIdx);
  }

  // Tokenize identifiers, numbers, strings, and punctuation
  const tokenRegex = /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b[A-Za-z_][A-Za-z0-9_]*\b|\b\d+\b|[[\]()+=:.,<>*-]+)/g;

  let highlighted = "";
  let lastIdx = 0;
  let match;

  while ((match = tokenRegex.exec(codePart)) !== null) {
    if (match.index > lastIdx) {
      highlighted += escapeHtml(codePart.slice(lastIdx, match.index));
    }
    const token = match[0];

    if (token.startsWith('"') || token.startsWith("'")) {
      highlighted += `<span class="py-str">${escapeHtml(token)}</span>`;
    } else if (/^\d+$/.test(token)) {
      highlighted += `<span class="py-num">${escapeHtml(token)}</span>`;
    } else if (PY_KEYWORDS.has(token)) {
      highlighted += `<span class="py-kw">${escapeHtml(token)}</span>`;
    } else if (PY_BUILTINS.has(token)) {
      highlighted += `<span class="py-builtin">${escapeHtml(token)}</span>`;
    } else if (token === "knapsack" || token === "solve_knapsack_detailed") {
      highlighted += `<span class="py-fn">${escapeHtml(token)}</span>`;
    } else if (/^[[\]()+=:.,<>*-]+$/.test(token)) {
      highlighted += `<span class="py-op">${escapeHtml(token)}</span>`;
    } else {
      highlighted += escapeHtml(token);
    }

    lastIdx = tokenRegex.lastIndex;
  }

  if (lastIdx < codePart.length) {
    highlighted += escapeHtml(codePart.slice(lastIdx));
  }

  if (commentPart) {
    highlighted += `<span class="py-comment">${escapeHtml(commentPart)}</span>`;
  }

  return highlighted || " ";
}

/**
 * Render the Python source code panel and highlight active execution lines.
 */
export function renderPythonCodePanel(sourceData, viewMode = "core", activeLines = []) {
  const container = document.getElementById("python-code-container");
  const activeIndicator = document.getElementById("active-line-indicator");
  if (!container || !sourceData) return;

  const lines = viewMode === "full" ? sourceData.full_lines : sourceData.core_lines;
  const activeSet = new Set(activeLines);

  if (activeIndicator) {
    activeIndicator.textContent =
      activeLines && activeLines.length > 0
        ? `Executing Line${activeLines.length > 1 ? "s" : ""}: ${activeLines.join(", ")}`
        : "Idle";
  }

  container.innerHTML = lines
    .map((lineObj) => {
      const isActive = activeSet.has(lineObj.line_number);
      return `
        <div class="code-line ${isActive ? "active-code-line" : ""}" data-line="${lineObj.line_number}">
          <span class="line-num">${lineObj.line_number}</span>
          <span class="line-content">${highlightPythonLine(lineObj.code)}</span>
        </div>
      `;
    })
    .join("");
}

/**
 * Update only the active line highlights in the Python code panel during simulation steps.
 */
export function updateActiveCodeLines(activeLines = []) {
  const container = document.getElementById("python-code-container");
  const activeIndicator = document.getElementById("active-line-indicator");
  if (!container) return;

  const activeSet = new Set(activeLines);
  if (activeIndicator) {
    activeIndicator.textContent =
      activeLines && activeLines.length > 0
        ? `Executing Line${activeLines.length > 1 ? "s" : ""}: ${activeLines.join(", ")}`
        : "Ready";
  }

  const lineNodes = container.querySelectorAll(".code-line");
  lineNodes.forEach((node) => {
    const lineNum = Number(node.dataset.line);
    if (activeSet.has(lineNum)) {
      node.classList.add("active-code-line");
    } else {
      node.classList.remove("active-code-line");
    }
  });
}

/**
 * Render the visual gallery of available items.
 */
export function renderItemsGallery(items, packedIds, optimalIds, callbacks) {
  const gallery = document.getElementById("items-gallery");
  const countBadge = document.getElementById("item-count-badge");
  if (!gallery) return;

  if (countBadge) {
    countBadge.textContent = `${items.length} item${items.length === 1 ? "" : "s"}`;
  }

  gallery.innerHTML = items
    .map((item, idx) => {
      const isPacked = packedIds.has(item.id);
      const isOptimal = optimalIds.has(item.id);
      return `
        <div
          class="item-card ${isPacked ? "is-packed" : ""} ${isOptimal ? "is-optimal-choice" : ""}"
          style="--card-accent: ${escapeHtml(item.color || "#6366f1")}"
          draggable="true"
          data-item-id="${item.id}"
          role="listitem"
        >
          <div class="item-card-top">
            <div class="item-avatar" aria-hidden="true">${escapeHtml(item.icon || "📦")}</div>
            <div class="item-badges-right">
              ${isOptimal ? '<span class="optimal-star-badge" title="Selected in Python Optimal Solution">★ Optimal</span>' : ""}
              ${isPacked ? '<span class="packed-status-badge">In Bag</span>' : ""}
            </div>
          </div>

          <div class="item-card-title-row">
            <span class="item-name">${escapeHtml(item.name)}</span>
            <span class="item-index-tag">i = ${idx + 1}</span>
          </div>

          <div class="item-metrics-row">
            <div class="metric-pill metric-weight">
              <span class="metric-label">Weight</span>
              <span class="metric-val">${item.weight} kg</span>
            </div>
            <div class="metric-pill metric-value">
              <span class="metric-label">Value</span>
              <span class="metric-val">$${item.value}</span>
            </div>
          </div>

          <div class="item-card-actions">
            <button type="button" class="btn-pack-toggle" data-action="toggle-pack" data-id="${item.id}">
              ${isPacked ? "Remove from Bag" : "Pack in Bag"}
            </button>
            <button type="button" class="item-icon-btn" data-action="edit" data-id="${item.id}" title="Edit Item" aria-label="Edit ${escapeHtml(item.name)}">
              ✎
            </button>
            <button type="button" class="item-icon-btn btn-delete" data-action="delete" data-id="${item.id}" title="Delete Item" aria-label="Delete ${escapeHtml(item.name)}">
              🗑
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  // Attach Drag and Click listeners
  gallery.querySelectorAll(".item-card").forEach((card) => {
    const itemId = Number(card.dataset.itemId);

    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", String(itemId));
      e.dataTransfer.effectAllowed = "move";
      card.style.opacity = "0.65";
    });

    card.addEventListener("dragend", () => {
      card.style.opacity = "1";
    });

    // Clicking the card body (outside edit/delete buttons) also toggles packing
    card.addEventListener("click", (e) => {
      const actionBtn = e.target.closest("[data-action]");
      if (!actionBtn) {
        callbacks.onTogglePack(itemId);
        return;
      }
      const action = actionBtn.dataset.action;
      if (action === "toggle-pack") {
        callbacks.onTogglePack(itemId);
      } else if (action === "edit") {
        callbacks.onEditItem(itemId);
      } else if (action === "delete") {
        callbacks.onDeleteItem(itemId);
      }
    });
  });
}

/**
 * Render the interactive backpack interior, capacity bars, and telemetry counters.
 */
export function renderBackpack(items, packedIds, capacity, optimalMaxValue, onRemoveItem) {
  const packedItems = items.filter((item) => packedIds.has(item.id));
  const totalWeight = packedItems.reduce((acc, item) => acc + Number(item.weight), 0);
  const totalValue = packedItems.reduce((acc, item) => acc + Number(item.value), 0);
  const remainingCapacity = Math.max(0, capacity - totalWeight);
  const fillPercent = capacity > 0 ? Math.min(100, Math.round((totalWeight / capacity) * 100)) : 0;

  const flapCapEl = document.getElementById("bag-flap-capacity");
  const meterFillEl = document.getElementById("backpack-meter-fill");
  const emptyHintEl = document.getElementById("backpack-empty-hint");
  const packedContainer = document.getElementById("backpack-items-container");

  const valEl = document.getElementById("bag-current-value");
  const optCompEl = document.getElementById("bag-optimal-comparison");
  const weightEl = document.getElementById("bag-current-weight");
  const pctEl = document.getElementById("bag-weight-percent");
  const remEl = document.getElementById("bag-remaining-capacity");
  const countEl = document.getElementById("bag-item-count");

  if (flapCapEl) flapCapEl.textContent = `${totalWeight} / ${capacity} kg`;
  if (meterFillEl) {
    meterFillEl.style.width = `${fillPercent}%`;
    meterFillEl.classList.toggle("near-full", fillPercent >= 85);
  }

  if (emptyHintEl) {
    emptyHintEl.hidden = packedItems.length > 0;
  }

  if (packedContainer) {
    packedContainer.innerHTML = packedItems
      .map(
        (item) => `
        <div
          class="packed-chip"
          style="--chip-color: ${escapeHtml(item.color || "#1d4ed8")}"
          data-packed-id="${item.id}"
          draggable="true"
          role="listitem"
          title="Click or drag out to remove ${escapeHtml(item.name)} from backpack"
        >
          <span class="packed-chip-icon">${escapeHtml(item.icon || "📦")}</span>
          <div class="packed-chip-info">
            <span class="packed-chip-name">${escapeHtml(item.name)}</span>
            <span class="packed-chip-meta">${item.weight}kg • $${item.value}</span>
          </div>
          <span class="packed-chip-remove" aria-hidden="true">✕</span>
        </div>
      `
      )
      .join("");

    packedContainer.querySelectorAll(".packed-chip").forEach((chip) => {
      const id = Number(chip.dataset.packedId);
      chip.addEventListener("click", () => {
        onRemoveItem(id);
      });
      chip.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", String(id));
        e.dataTransfer.setData("application/x-packed-item", String(id));
        e.dataTransfer.effectAllowed = "move";
      });
    });
  }

  if (valEl) valEl.textContent = `$${totalValue}`;
  if (optCompEl) {
    if (optimalMaxValue > 0 && totalValue === optimalMaxValue) {
      optCompEl.textContent = `Matches Python Optimal ($${optimalMaxValue})`;
      optCompEl.style.color = "#15803d";
    } else {
      optCompEl.textContent = `Python Optimal: $${optimalMaxValue}`;
      optCompEl.style.color = "";
    }
  }
  if (weightEl) weightEl.textContent = `${totalWeight} kg`;
  if (pctEl) pctEl.textContent = `${fillPercent}% capacity used`;
  if (remEl) remEl.textContent = `${remainingCapacity} kg`;
  if (countEl) countEl.textContent = `${packedItems.length} item${packedItems.length === 1 ? "" : "s"} packed`;
}

/**
 * Show a temporary capacity warning inside the backpack panel and trigger shake animation.
 */
let alertTimeout = null;
export function showBackpackAlert(message) {
  const alertEl = document.getElementById("backpack-alert");
  const dropzone = document.getElementById("backpack-dropzone");

  if (dropzone) {
    dropzone.classList.remove("shake-error");
    void dropzone.offsetWidth; // Reflow to restart animation
    dropzone.classList.add("shake-error");
  }

  if (alertEl) {
    alertEl.textContent = message;
    alertEl.hidden = false;
    if (alertTimeout) clearTimeout(alertTimeout);
    alertTimeout = setTimeout(() => {
      alertEl.hidden = true;
    }, 3400);
  }
}

/**
 * Build and update the Dynamic Programming Table visualization from Python step data.
 */
export function renderDPTable(items, capacity, currentStep, allSteps, backtrackPath, onSelectCell) {
  const table = document.getElementById("dp-table");
  if (!table || !currentStep) return;

  const dpMatrix = currentStep.dp_snapshot;
  const isCompleteStep = currentStep.type === "complete";

  // Build lookup of which cells have been computed up to currentStep
  const computedCells = new Set();
  // Row 0 is initialized at step 0
  for (let w = 0; w <= capacity; w++) {
    computedCells.add(`0:${w}`);
  }
  for (const s of allSteps) {
    if (s.step_index <= currentStep.step_index && s.type === "compute") {
      computedCells.add(`${s.i}:${s.w}`);
    }
  }

  // Compare cells in current step
  const compareMap = new Map();
  if (Array.isArray(currentStep.compare_cells)) {
    for (const c of currentStep.compare_cells) {
      compareMap.set(`${c.i}:${c.w}`, c.role);
    }
  }

  // Optimal backtrack path highlights when simulation reaches final step
  const optimalSelectedCells = new Set();
  const optimalPathCells = new Set();
  if (isCompleteStep && Array.isArray(backtrackPath)) {
    for (const node of backtrackPath) {
      if (node.action === "selected") {
        optimalSelectedCells.add(`${node.i}:${node.w}`);
      } else {
        optimalPathCells.add(`${node.i}:${node.w}`);
      }
    }
  }

  // Header row: capacities w = 0 .. capacity
  let html = `<thead><tr><th>Item (i) \\ Cap (w)</th>`;
  for (let w = 0; w <= capacity; w++) {
    html += `<th>w = ${w}</th>`;
  }
  html += `</tr></thead><tbody>`;

  // Row 0..n
  for (let i = 0; i <= items.length; i++) {
    let rowHeaderHtml = "";
    if (i === 0) {
      rowHeaderHtml = `
        <th class="dp-row-header">
          <div class="row-item-label">
            <span>∅</span>
            <div>
              <strong>i = 0 (Base Case)</strong>
              <span class="row-item-meta">0 items considered</span>
            </div>
          </div>
        </th>
      `;
    } else {
      const it = items[i - 1];
      rowHeaderHtml = `
        <th class="dp-row-header">
          <div class="row-item-label">
            <span>${escapeHtml(it.icon || "📦")}</span>
            <div>
              <strong>i = ${i}: ${escapeHtml(it.name)}</strong>
              <span class="row-item-meta">w=${it.weight}kg, val=$${it.value}</span>
            </div>
          </div>
        </th>
      `;
    }

    html += `<tr>${rowHeaderHtml}`;

    for (let w = 0; w <= capacity; w++) {
      const key = `${i}:${w}`;
      const isComputed = computedCells.has(key);
      const isActive = currentStep.type !== "init" && currentStep.i === i && currentStep.w === w;
      const compareRole = compareMap.get(key);

      const classes = ["dp-cell"];
      if (isComputed) {
        classes.push("cell-computed");
      } else {
        classes.push("cell-uncomputed");
      }

      if (isActive) {
        classes.push("cell-active");
      } else if (compareRole === "include") {
        classes.push("cell-compare-include");
      } else if (compareRole === "exclude") {
        classes.push("cell-compare-exclude");
      } else if (optimalSelectedCells.has(key)) {
        classes.push("cell-optimal-selected");
      } else if (optimalPathCells.has(key)) {
        classes.push("cell-optimal-path");
      }

      const cellValue = isComputed ? dpMatrix[i][w] : "·";
      html += `<td class="${classes.join(" ")}" data-i="${i}" data-w="${w}" title="Click to inspect dp[${i}][${w}]">${cellValue}</td>`;
    }

    html += `</tr>`;
  }

  html += `</tbody>`;
  table.innerHTML = html;

  // Allow clicking any cell to jump directly to its calculation step
  table.querySelectorAll(".dp-cell").forEach((cell) => {
    cell.addEventListener("click", () => {
      const i = Number(cell.dataset.i);
      const w = Number(cell.dataset.w);
      onSelectCell(i, w);
    });
  });

  // Ensure active cell is visible within the scrollable table wrapper
  const activeCellEl = table.querySelector(".cell-active");
  if (activeCellEl) {
    activeCellEl.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }
}

/**
 * Update the Step Inspector cards with real Python step data.
 */
export function renderStepInspector(step, totalSteps) {
  if (!step) return;

  const stepCounterEl = document.getElementById("sim-step-counter");
  const cellCoordsEl = document.getElementById("sim-cell-coords");
  const sliderEl = document.getElementById("sim-step-slider");

  const statusPillEl = document.getElementById("step-status-pill");
  const itemDisplayEl = document.getElementById("step-item-display");
  const formulaCodeEl = document.getElementById("step-formula-code");

  const includeCardEl = document.getElementById("card-decision-include");
  const includeValEl = document.getElementById("step-include-val");
  const includeExpEl = document.getElementById("step-include-Automated");

  const excludeCardEl = document.getElementById("card-decision-exclude");
  const excludeValEl = document.getElementById("step-exclude-val");
  const excludeExpEl = document.getElementById("step-exclude-explanation");

  const selectedValEl = document.getElementById("step-selected-val");
  const summaryTextEl = document.getElementById("step-summary-text");

  if (stepCounterEl) {
    stepCounterEl.textContent = `Step ${step.step_index} / ${Math.max(0, totalSteps - 1)}`;
  }
  if (cellCoordsEl) {
    cellCoordsEl.textContent = `Cell dp[${step.i}][${step.w}]`;
  }
  if (sliderEl) {
    sliderEl.max = String(Math.max(0, totalSteps - 1));
    sliderEl.value = String(step.step_index);
  }

  // Context and Status Pill
  if (statusPillEl) {
    statusPillEl.className = "decision-pill";
    if (step.decision === "include" || step.decision === "tie_include") {
      statusPillEl.textContent = "Include Wins";
      statusPillEl.classList.add("decision-include");
    } else if (step.decision === "exclude_compared" || step.decision === "exclude_heavy") {
      statusPillEl.textContent = step.decision === "exclude_heavy" ? "Too Heavy (Exclude)" : "Exclude Wins";
      statusPillEl.classList.add("decision-exclude");
    } else if (step.decision === "complete") {
      statusPillEl.textContent = "Optimal Found";
      statusPillEl.classList.add("decision-include");
    } else {
      statusPillEl.textContent = "Base Case";
      statusPillEl.classList.add("decision-init");
    }
  }

  if (itemDisplayEl) {
    if (step.item) {
      itemDisplayEl.innerHTML = `
        <span class="step-item-icon">${escapeHtml(step.item.icon || "📦")}</span>
        <div>
          <strong>Item i=${step.i}: ${escapeHtml(step.item.name)} (w=${step.item.weight}kg, $${step.item.value})</strong>
          <p>Evaluating sub-capacity w = ${step.current_capacity} kg</p>
        </div>
      `;
    } else {
      itemDisplayEl.innerHTML = `
        <span class="step-item-icon">🧮</span>
        <div>
          <strong>Base Case Initialization (i = 0)</strong>
          <p>0 items considered • All capacities set to 0</p>
        </div>
      `;
    }
  }

  if (formulaCodeEl && step.explanation) {
    formulaCodeEl.textContent = step.explanation.formula;
  }

  // Include Decision Card
  if (includeValEl) {
    includeValEl.textContent = step.include_value !== null && step.include_value !== undefined
      ? `$${step.include_value}`
      : "N/A";
  }
  if (includeExpEl && step.explanation) {
    includeExpEl.textContent = step.explanation.include;
  }

  // Exclude Decision Card
  if (excludeValEl) {
    excludeValEl.textContent = step.exclude_value !== null && step.exclude_value !== undefined
      ? `$${step.exclude_value}`
      : "$0";
  }
  if (excludeExpEl && step.explanation) {
    excludeExpEl.textContent = step.explanation.exclude;
  }

  // Highlight winning card
  if (includeCardEl && excludeCardEl) {
    includeCardEl.classList.remove("winning-decision");
    excludeCardEl.classList.remove("winning-decision");
    if (step.decision === "include" || step.decision === "tie_include") {
      includeCardEl.classList.add("winning-decision");
    } else if (step.decision === "exclude_compared" || step.decision === "exclude_heavy") {
      excludeCardEl.classList.add("winning-decision");
    }
  }

  // Selected Maximum Value
  if (selectedValEl) {
    selectedValEl.textContent = `$${step.selected_value}`;
  }
  if (summaryTextEl && step.explanation) {
    summaryTextEl.textContent = step.explanation.summary;
  }
}

/**
 * Render the Final Optimal Python Results section.
 */
export function renderFinalResults(pythonResult) {
  if (!pythonResult) return;

  const maxValEl = document.getElementById("res-max-value");
  const totalWeightEl = document.getElementById("res-total-weight");
  const weightNoteEl = document.getElementById("res-weight-note");
  const remCapEl = document.getElementById("res-remaining-capacity");
  const countEl = document.getElementById("res-selected-count");
  const listEl = document.getElementById("res-selected-items-list");

  if (maxValEl) maxValEl.textContent = `$${pythonResult.max_value}`;
  if (totalWeightEl) totalWeightEl.textContent = `${pythonResult.total_weight} / ${pythonResult.capacity} kg`;
  if (weightNoteEl) {
    const pct = pythonResult.capacity > 0
      ? Math.round((pythonResult.total_weight / pythonResult.capacity) * 100)
      : 0;
    weightNoteEl.textContent = `${pct}% of total capacity utilized`;
  }
  if (remCapEl) remCapEl.textContent = `${pythonResult.remaining_capacity} kg`;
  if (countEl) countEl.textContent = String(pythonResult.selected_items.length);

  if (listEl) {
    if (pythonResult.selected_items.length === 0) {
      listEl.innerHTML = `<span class="result-stat-note">No items fit within capacity.</span>`;
    } else {
      listEl.innerHTML = pythonResult.selected_items
        .map(
          (item) => `
          <div class="result-item-pill">
            <span>${escapeHtml(item.icon || "📦")}</span>
            <span>${escapeHtml(item.name)}</span>
            <small>(${item.weight}kg, $${item.value})</small>
          </div>
        `
        )
        .join("");
    }
  }
}

