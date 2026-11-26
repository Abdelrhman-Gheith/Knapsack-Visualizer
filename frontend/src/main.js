import {
  renderPythonCodePanel,
  updateActiveCodeLines,
  renderItemsGallery,
  renderBackpack,
  showBackpackAlert,
  renderDPTable,
  renderStepInspector,
  renderFinalResults
} from "./visualization.js";

const API_BASE_URL = "http://127.0.0.1:5000/api";

const DEFAULT_ITEMS = [
  { id: 1, name: "Solar Power Bank", weight: 2, value: 9, icon: "🔋", color: "#0284c7" },
  { id: 2, name: "DSLR Camera", weight: 3, value: 12, icon: "📷", color: "#1d4ed8" },
  { id: 3, name: "Ultrabook Laptop", weight: 4, value: 16, icon: "💻", color: "#0d9488" },
  { id: 4, name: "Survey Drone", weight: 5, value: 19, icon: "🚁", color: "#15803d" }
];

const AVAILABLE_ICONS = ["📷", "💻", "🔋", "🚁", "🔭", "🧭", "🔦", "⛺", "🧪", "💎", "📡", "🧰"];
const AVAILABLE_COLORS = ["#1d4ed8", "#0284c7", "#0d9488", "#15803d", "#b45309", "#b91c1c"];

const state = {
  capacity: 10,
  items: structuredClone(DEFAULT_ITEMS),
  nextItemId: 5,
  packedIds: new Set(),
  pythonResult: null,
  sourceData: null,
  codeViewMode: "core",
  currentStepIndex: 0,
  isPlaying: false,
  playTimer: null,
  speedMs: 650,
  modalSelectedIcon: "📷",
  modalSelectedColor: "#38bdf8"
};

/**
 * Fallback for <dialog closedby="any"> per modern-web-guidance
 */
function setupDialogLightDismissFallback() {
  if (!("closedBy" in HTMLDialogElement.prototype)) {
    const outside = (e, dialog) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    for (const dialog of document.querySelectorAll('dialog[closedby="any"]')) {
      let pressedOutside = false;
      dialog.addEventListener("pointerdown", (e) => {
        pressedOutside = outside(e, dialog);
      });
      dialog.addEventListener("pointerup", (e) => {
        if (pressedOutside && outside(e, dialog)) dialog.close();
      });
    }
  }
}

/**
 * Update the backend connection badge in the header.
 */
function setBackendStatus(mode, text) {
  const pill = document.getElementById("backend-status");
  const label = document.getElementById("backend-status-text");
  if (!pill || !label) return;

  pill.classList.remove("status-connecting", "status-online", "status-error");
  if (mode === "online") pill.classList.add("status-online");
  else if (mode === "error") pill.classList.add("status-error");
  else pill.classList.add("status-connecting");

  label.textContent = text;
}

/**
 * Check backend health via GET /api/health and load Python source via GET /api/source.
 */
async function checkBackendAndLoadSource() {
  try {
    const healthRes = await fetch(`${API_BASE_URL}/health`);
    if (healthRes.ok) {
      setBackendStatus("online", "Python Flask API Connected");
    }
    if (!state.sourceData) {
      const sourceRes = await fetch(`${API_BASE_URL}/source`);
      if (sourceRes.ok) {
        state.sourceData = await sourceRes.json();
      }
    }
  } catch (err) {
    console.warn("Initial health/source check failed:", err);
  }
}

/**
 * Call the Python Flask backend to execute knapsack.py and retrieve DP table & steps.
 */
async function solveWithPythonBackend({ autoPackOptimal = false, jumpToEnd = false } = {}) {
  stopSimulation();
  setBackendStatus("connecting", "Running knapsack.py...");

  try {
    const response = await fetch(`${API_BASE_URL}/solve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        capacity: state.capacity,
        items: state.items
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    state.pythonResult = data;
    if (data.source) {
      state.sourceData = data.source;
    }

    setBackendStatus("online", "Python Flask API Connected");

    if (autoPackOptimal && Array.isArray(data.selected_items)) {
      state.packedIds = new Set(data.selected_items.map((it) => it.id));
    }

    // Remove any packed items that exceed new capacity
    enforceCapacityOnExistingBag();

    const targetStep = jumpToEnd ? Math.max(0, data.steps.length - 1) : 0;
    state.currentStepIndex = targetStep;

    renderAll();
  } catch (err) {
    console.error("Failed to reach Python backend:", err);
    setBackendStatus("error", "Python Backend Offline (Port 5000)");
    showBackpackAlert(
      `Cannot connect to Python backend at ${API_BASE_URL}. Make sure 'python app.py' is running in backend/.`
    );
  }
}

/**
 * Ensure items currently in the backpack do not exceed state.capacity.
 */
function enforceCapacityOnExistingBag() {
  let runningWeight = 0;
  const validPacked = new Set();
  for (const item of state.items) {
    if (state.packedIds.has(item.id)) {
      if (runningWeight + item.weight <= state.capacity) {
        validPacked.add(item.id);
        runningWeight += item.weight;
      }
    }
  }
  state.packedIds = validPacked;
}

/**
 * Attempt to pack or unpack an item into/from the backpack.
 */
function togglePackItem(itemId, forcePack = false) {
  const item = state.items.find((it) => it.id === itemId);
  if (!item) return;

  if (state.packedIds.has(itemId) && !forcePack) {
    state.packedIds.delete(itemId);
    renderGalleryAndBackpack();
    return;
  }

  if (state.packedIds.has(itemId) && forcePack) {
    showBackpackAlert(`"${item.name}" is already inside the backpack.`);
    return;
  }

  const currentWeight = state.items
    .filter((it) => state.packedIds.has(it.id))
    .reduce((sum, it) => sum + Number(it.weight), 0);

  if (currentWeight + Number(item.weight) > state.capacity) {
    const remaining = Math.max(0, state.capacity - currentWeight);
    showBackpackAlert(
      `Cannot pack "${item.name}" (${item.weight} kg)! Exceeds remaining capacity (${remaining} kg left of ${state.capacity} kg).`
    );
    return;
  }

  state.packedIds.add(itemId);
  renderGalleryAndBackpack();
}

/**
 * Pack the optimal items calculated by Python into the visual backpack.
 */
function packOptimalSubsetFromPython() {
  if (!state.pythonResult || !Array.isArray(state.pythonResult.selected_items)) return;
  state.packedIds = new Set(state.pythonResult.selected_items.map((it) => it.id));
  renderGalleryAndBackpack();
}

/**
 * Render the Item Gallery and Interactive Backpack panels.
 */
function renderGalleryAndBackpack() {
  const optimalIds = new Set(
    state.pythonResult && Array.isArray(state.pythonResult.selected_items)
      ? state.pythonResult.selected_items.map((it) => it.id)
      : []
  );
  const optimalMaxValue = state.pythonResult ? state.pythonResult.max_value : 0;

  renderItemsGallery(state.items, state.packedIds, optimalIds, {
    onTogglePack: (id) => togglePackItem(id, false),
    onEditItem: (id) => openItemModal(id),
    onDeleteItem: (id) => deleteItem(id)
  });

  renderBackpack(state.items, state.packedIds, state.capacity, optimalMaxValue, (id) => {
    state.packedIds.delete(id);
    renderGalleryAndBackpack();
  });
}

/**
 * Render the current step in the Step Inspector, Code Panel, and DP Table.
 */
function renderCurrentSimulationStep() {
  if (!state.pythonResult || !state.pythonResult.steps.length) return;

  const steps = state.pythonResult.steps;
  const clampedIdx = Math.max(0, Math.min(state.currentStepIndex, steps.length - 1));
  state.currentStepIndex = clampedIdx;
  const currentStep = steps[clampedIdx];

  renderStepInspector(currentStep, steps.length);
  updateActiveCodeLines(currentStep.active_lines || []);
  renderDPTable(
    state.items,
    state.capacity,
    currentStep,
    steps,
    state.pythonResult.backtrack_path,
    (i, w) => jumpToCellStep(i, w)
  );

  // If simulation reached the final completion step, show optimal items in backpack
  if (currentStep.type === "complete") {
    packOptimalSubsetFromPython();
  }
}

/**
 * Render all sections of the UI.
 */
function renderAll() {
  renderGalleryAndBackpack();

  if (state.sourceData) {
    const currentStep =
      state.pythonResult && state.pythonResult.steps[state.currentStepIndex]
        ? state.pythonResult.steps[state.currentStepIndex]
        : null;
    renderPythonCodePanel(
      state.sourceData,
      state.codeViewMode,
      currentStep ? currentStep.active_lines : [2, 4]
    );
  }

  renderCurrentSimulationStep();

  if (state.pythonResult) {
    renderFinalResults(state.pythonResult);
  }
}

/**
 * Jump directly to the step that computes dp[i][w].
 */
function jumpToCellStep(i, w) {
  if (!state.pythonResult) return;
  stopSimulation();

  if (i === 0) {
    state.currentStepIndex = 0;
    renderCurrentSimulationStep();
    return;
  }

  const foundIdx = state.pythonResult.steps.findIndex(
    (s) => s.type === "compute" && s.i === i && s.w === w
  );
  if (foundIdx !== -1) {
    state.currentStepIndex = foundIdx;
    renderCurrentSimulationStep();
  }
}

/**
 * Step-by-step playback controls
 */
function updatePlayButtonUI() {
  const playBtn = document.getElementById("btn-sim-play");
  const iconEl = document.getElementById("play-btn-icon");
  const textEl = document.getElementById("play-btn-text");
  if (!playBtn || !iconEl || !textEl) return;

  if (state.isPlaying) {
    playBtn.classList.add("is-playing");
    iconEl.textContent = "⏸";
    textEl.textContent = "Pause";
  } else {
    playBtn.classList.remove("is-playing");
    iconEl.textContent = "▶";
    textEl.textContent = "Play";
  }
}

function startSimulation() {
  if (!state.pythonResult || !state.pythonResult.steps.length) return;

  // If already at the end, restart from 0
  if (state.currentStepIndex >= state.pythonResult.steps.length - 1) {
    state.currentStepIndex = 0;
    renderCurrentSimulationStep();
  }

  state.isPlaying = true;
  updatePlayButtonUI();

  if (state.playTimer) clearInterval(state.playTimer);
  state.playTimer = setInterval(() => {
    if (!state.pythonResult) {
      stopSimulation();
      return;
    }
    if (state.currentStepIndex < state.pythonResult.steps.length - 1) {
      state.currentStepIndex += 1;
      renderCurrentSimulationStep();
    } else {
      stopSimulation();
    }
  }, state.speedMs);
}

function stopSimulation() {
  state.isPlaying = false;
  if (state.playTimer) {
    clearInterval(state.playTimer);
    state.playTimer = null;
  }
  updatePlayButtonUI();
}

function toggleSimulation() {
  if (state.isPlaying) {
    stopSimulation();
  } else {
    startSimulation();
  }
}

/**
 * Item CRUD operations (Add, Edit, Delete)
 */
function deleteItem(itemId) {
  if (state.items.length <= 1) {
    showBackpackAlert("Keep at least 1 item in the dataset to visualize the Knapsack algorithm.");
    return;
  }
  state.items = state.items.filter((it) => it.id !== itemId);
  state.packedIds.delete(itemId);
  solveWithPythonBackend({ autoPackOptimal: false });
}

function renderModalPickers() {
  const iconGrid = document.getElementById("icon-picker");
  const colorRow = document.getElementById("color-picker");

  if (iconGrid) {
    iconGrid.innerHTML = AVAILABLE_ICONS.map(
      (ic) => `
      <button
        type="button"
        class="icon-option-btn ${state.modalSelectedIcon === ic ? "selected" : ""}"
        data-icon="${ic}"
        aria-label="Icon ${ic}"
      >${ic}</button>
    `
    ).join("");

    iconGrid.querySelectorAll(".icon-option-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.modalSelectedIcon = btn.dataset.icon;
        renderModalPickers();
      });
    });
  }

  if (colorRow) {
    colorRow.innerHTML = AVAILABLE_COLORS.map(
      (col) => `
      <button
        type="button"
        class="color-swatch-btn ${state.modalSelectedColor === col ? "selected" : ""}"
        style="background: ${col}"
        data-color="${col}"
        aria-label="Color ${col}"
      ></button>
    `
    ).join("");

    colorRow.querySelectorAll(".color-swatch-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.modalSelectedColor = btn.dataset.color;
        renderModalPickers();
      });
    });
  }
}

function openItemModal(editId = null) {
  const modal = document.getElementById("item-modal");
  const titleEl = document.getElementById("item-modal-title");
  const idInput = document.getElementById("item-id-input");
  const nameInput = document.getElementById("item-name-input");
  const weightInput = document.getElementById("item-weight-input");
  const valueInput = document.getElementById("item-value-input");

  if (!modal) return;

  if (editId !== null) {
    const existing = state.items.find((it) => it.id === editId);
    if (!existing) return;
    titleEl.textContent = `Edit "${existing.name}"`;
    idInput.value = String(existing.id);
    nameInput.value = existing.name;
    weightInput.value = String(existing.weight);
    valueInput.value = String(existing.value);
    state.modalSelectedIcon = existing.icon || "📦";
    state.modalSelectedColor = existing.color || "#38bdf8";
  } else {
    titleEl.textContent = "Add New Item";
    idInput.value = "";
    nameInput.value = "";
    weightInput.value = "3";
    valueInput.value = "11";
    state.modalSelectedIcon = AVAILABLE_ICONS[state.items.length % AVAILABLE_ICONS.length];
    state.modalSelectedColor = AVAILABLE_COLORS[state.items.length % AVAILABLE_COLORS.length];
  }

  renderModalPickers();
  modal.showModal();
}

/**
 * Initialize DOM event listeners
 */
function bindEvents() {
  // Capacity slider & number input
  const capSlider = document.getElementById("capacity-slider");
  const capInput = document.getElementById("capacity-input");
  const capBadge = document.getElementById("capacity-badge-value");

  const updateCapacity = (newCap) => {
    const parsed = Math.max(1, Math.min(50, Number(newCap) || 10));
    state.capacity = parsed;
    if (capSlider) capSlider.value = String(Math.min(25, parsed));
    if (capInput) capInput.value = String(parsed);
    if (capBadge) capBadge.textContent = `${parsed} kg`;
    solveWithPythonBackend({ autoPackOptimal: false });
  };

  if (capSlider) {
    capSlider.addEventListener("input", (e) => {
      if (capBadge) capBadge.textContent = `${e.target.value} kg`;
      if (capInput) capInput.value = e.target.value;
    });
    capSlider.addEventListener("change", (e) => updateCapacity(e.target.value));
  }

  if (capInput) {
    capInput.addEventListener("change", (e) => updateCapacity(e.target.value));
  }

  // Solve with Python button
  document.getElementById("btn-solve-python")?.addEventListener("click", () => {
    solveWithPythonBackend({ autoPackOptimal: true, jumpToEnd: true });
  });

  // Add Item / Reset Items
  document.getElementById("btn-add-item")?.addEventListener("click", () => openItemModal(null));
  document.getElementById("btn-reset-items")?.addEventListener("click", () => {
    state.items = structuredClone(DEFAULT_ITEMS);
    state.capacity = 10;
    state.packedIds.clear();
    if (capSlider) capSlider.value = "10";
    if (capInput) capInput.value = "10";
    if (capBadge) capBadge.textContent = "10 kg";
    solveWithPythonBackend({ autoPackOptimal: true });
  });

  // Backpack Drag & Drop events
  const dropzone = document.getElementById("backpack-dropzone");
  if (dropzone) {
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      dropzone.classList.add("drag-over");
    });

    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("drag-over");
    });

    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("drag-over");
      const rawId = e.dataTransfer.getData("text/plain");
      const itemId = Number(rawId);
      if (!Number.isNaN(itemId)) {
        togglePackItem(itemId, true);
      }
    });
  }

  // Allow dragging packed items out of the backpack onto the items gallery
  const galleryEl = document.getElementById("items-gallery");
  if (galleryEl) {
    galleryEl.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    });
    galleryEl.addEventListener("drop", (e) => {
      e.preventDefault();
      const packedId = Number(e.dataTransfer.getData("application/x-packed-item"));
      if (!Number.isNaN(packedId) && state.packedIds.has(packedId)) {
        state.packedIds.delete(packedId);
        renderGalleryAndBackpack();
      }
    });
  }

  // Backpack action buttons
  document.getElementById("btn-load-optimal-bag")?.addEventListener("click", () => {
    packOptimalSubsetFromPython();
  });

  document.getElementById("btn-sync-optimal-results")?.addEventListener("click", () => {
    packOptimalSubsetFromPython();
    document.getElementById("backpack-dropzone")?.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  document.getElementById("btn-clear-bag")?.addEventListener("click", () => {
    state.packedIds.clear();
    renderGalleryAndBackpack();
  });

  // Simulation controls
  document.getElementById("btn-sim-play")?.addEventListener("click", () => toggleSimulation());

  document.getElementById("btn-sim-restart")?.addEventListener("click", () => {
    stopSimulation();
    state.currentStepIndex = 0;
    renderCurrentSimulationStep();
  });

  document.getElementById("btn-sim-prev")?.addEventListener("click", () => {
    stopSimulation();
    if (state.currentStepIndex > 0) {
      state.currentStepIndex -= 1;
      renderCurrentSimulationStep();
    }
  });

  document.getElementById("btn-sim-next")?.addEventListener("click", () => {
    stopSimulation();
    if (state.pythonResult && state.currentStepIndex < state.pythonResult.steps.length - 1) {
      state.currentStepIndex += 1;
      renderCurrentSimulationStep();
    }
  });

  document.getElementById("btn-sim-end")?.addEventListener("click", () => {
    stopSimulation();
    if (state.pythonResult && state.pythonResult.steps.length > 0) {
      state.currentStepIndex = state.pythonResult.steps.length - 1;
      renderCurrentSimulationStep();
    }
  });

  document.getElementById("sim-step-slider")?.addEventListener("input", (e) => {
    stopSimulation();
    state.currentStepIndex = Number(e.target.value);
    renderCurrentSimulationStep();
  });

  document.getElementById("sim-speed-select")?.addEventListener("change", (e) => {
    state.speedMs = Number(e.target.value) || 650;
    if (state.isPlaying) {
      startSimulation();
    }
  });

  // Python Code Panel View Mode Toggle
  const btnCore = document.getElementById("btn-code-core");
  const btnFull = document.getElementById("btn-code-full");
  if (btnCore && btnFull) {
    btnCore.addEventListener("click", () => {
      state.codeViewMode = "core";
      btnCore.classList.add("active");
      btnFull.classList.remove("active");
      renderAll();
    });
    btnFull.addEventListener("click", () => {
      state.codeViewMode = "full";
      btnFull.classList.add("active");
      btnCore.classList.remove("active");
      renderAll();
    });
  }

  // Modal Dialog Form Submission & Close
  const modal = document.getElementById("item-modal");
  const form = document.getElementById("item-form");
  document.getElementById("btn-close-modal")?.addEventListener("click", () => modal?.close());
  document.getElementById("btn-cancel-modal")?.addEventListener("click", () => modal?.close());

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const idVal = document.getElementById("item-id-input").value;
      const nameVal = document.getElementById("item-name-input").value.trim() || "Custom Item";
      const weightVal = Math.max(1, Math.min(50, Number(document.getElementById("item-weight-input").value) || 1));
      const valueVal = Math.max(1, Math.min(500, Number(document.getElementById("item-value-input").value) || 1));

      if (idVal) {
        const numId = Number(idVal);
        const idx = state.items.findIndex((it) => it.id === numId);
        if (idx !== -1) {
          state.items[idx] = {
            ...state.items[idx],
            name: nameVal,
            weight: weightVal,
            value: valueVal,
            icon: state.modalSelectedIcon,
            color: state.modalSelectedColor
          };
        }
      } else {
        state.items.push({
          id: state.nextItemId++,
          name: nameVal,
          weight: weightVal,
          value: valueVal,
          icon: state.modalSelectedIcon,
          color: state.modalSelectedColor
        });
      }

      modal?.close();
      solveWithPythonBackend({ autoPackOptimal: false });
    });
  }
}

/**
 * Boot the application
 */
document.addEventListener("DOMContentLoaded", async () => {
  setupDialogLightDismissFallback();
  bindEvents();
  await checkBackendAndLoadSource();
  solveWithPythonBackend({ autoPackOptimal: true });
});

