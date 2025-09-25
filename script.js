const canvas = document.getElementById('draw-canvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('planner-container');
const image = document.getElementById('planner-bg');
const textLayer = document.getElementById('text-layer');

let penColor = '#000000';
let penSize = 5;

let history = [];
let redoStack = [];

let isEraser = false;

let textHistory = [];
let textRedoStack = [];

let pages = [];
let currentPageIndex = -1;

let drawing = false;

// ======= PAGE MANAGEMENT =======

function addPage() {
  const name = prompt("Enter page name:", "Page " + (pages.length + 1));
  if (!name) return;

  if (currentPageIndex !== -1) saveCurrentPage();

  const newPage = {
    name,
    background: image.src,
    drawing: "",
    textBoxesHTML: ""
  };

  pages.push(newPage);
  currentPageIndex = pages.length - 1;
  updatePageSelector();
  loadPage(currentPageIndex);
}

function updatePageSelector() {
  const selector = document.getElementById("pageSelector");
  selector.innerHTML = "";
  pages.forEach((page, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = page.name;
    selector.appendChild(option);
  });
  selector.value = currentPageIndex;
}

function renamePage() {
  if (currentPageIndex === -1) return;
  const name = prompt("Rename page:", pages[currentPageIndex].name);
  if (name) {
    pages[currentPageIndex].name = name;
    updatePageSelector();
    autoSaveProject();
  }
}

function deletePage() {
  if (currentPageIndex === -1) return;
  if (!confirm("Are you sure you want to delete this page?")) return;

  pages.splice(currentPageIndex, 1);
  if (pages.length === 0) {
    currentPageIndex = -1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    textLayer.innerHTML = "";
  } else {
    currentPageIndex = Math.max(0, currentPageIndex - 1);
    loadPage(currentPageIndex);
  }
  updatePageSelector();
  autoSaveProject();
}

function saveCurrentPage() {
  if (currentPageIndex === -1) return;
  pages[currentPageIndex].drawing = canvas.toDataURL();
  pages[currentPageIndex].textBoxesHTML = textLayer.innerHTML;
}

function loadPage(index) {
  currentPageIndex = parseInt(index);
  const page = pages[currentPageIndex];

  if (!page) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    textLayer.innerHTML = "";
    return;
  }

  image.src = page.background;

  image.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (page.drawing) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = page.drawing;
    }
  };

  textLayer.innerHTML = page.textBoxesHTML || "";
  rebindTextBoxes();

  autoSaveProject();
}

function autoSaveProject() {
  saveCurrentPage();
  const saveData = {
    pages,
    currentPageIndex
  };
  localStorage.setItem('plannerProject', JSON.stringify(saveData));
}

window.addEventListener('load', () => {
  resizeCanvas();

  const saved = localStorage.getItem('plannerProject');
  if (!saved) return;

  const project = JSON.parse(saved);
  pages = project.pages || [];
  currentPageIndex = project.currentPageIndex >= 0 ? project.currentPageIndex : 0;

  updatePageSelector();
  if (pages.length > 0) loadPage(currentPageIndex);
});

// ======= CANVAS RESIZE =======

function resizeCanvas() {
  const rect = container.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  // Save current canvas content
  const oldImage = canvas.toDataURL();

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  textLayer.style.width = rect.width + 'px';
  textLayer.style.height = rect.height + 'px';

  if (oldImage) {
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = oldImage;
  }
}

window.addEventListener('resize', resizeCanvas);
image.addEventListener('load', resizeCanvas);

// ======= DRAWING HANDLERS =======

canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  drawing = true;
  const rect = canvas.getBoundingClientRect();
  ctx.beginPath();
  ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
});

canvas.addEventListener('pointermove', e => {
  if (!drawing) return;
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  ctx.strokeStyle = isEraser ? '#FFFFFF' : penColor;
  ctx.lineWidth = penSize;
  ctx.lineCap = 'round';
  ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
  ctx.stroke();
});

canvas.addEventListener('pointerup', e => {
  if (drawing) {
    drawing = false;
    saveState();
  }
});

canvas.addEventListener('pointerleave', () => {
  drawing = false;
});

// Remove redundant mouse/touch handlers to avoid conflicts
// Pointer events cover mouse + touch properly

// ======= HISTORY MANAGEMENT =======

function saveState() {
  // Limit history length and save current canvas state
  if (history.length >= 50) history.shift();
  history.push(canvas.toDataURL());
  redoStack = [];
  autoSaveProject();
}

function undo() {
  if (history.length === 0) return;
  redoStack.push(canvas.toDataURL());
  const prevState = history.pop();
  loadCanvasFromDataURL(prevState);
}

function redo() {
  if (redoStack.length === 0) return;
  history.push(canvas.toDataURL());
  const nextState = redoStack.pop();
  loadCanvasFromDataURL(nextState);
}

function loadCanvasFromDataURL(dataURL) {
  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };
  img.src = dataURL;
}

// ======= TEXT BOX MANAGEMENT =======

function addTextBox() {
  const box = document.createElement('div');
  box.className = 'text-box';
  box.contentEditable = true;
  box.style.position = 'absolute';
  box.style.left = '50px';
  box.style.top = '50px';
  box.style.zIndex = 10; // Make sure text box is above canvas

  const closeBtn = document.createElement('button');
  closeBtn.className = 'close-btn';
  closeBtn.innerHTML = '×';
  closeBtn.onclick = function (e) {
    e.stopPropagation();
    box.remove();
    saveTextState();
  };

  box.appendChild(closeBtn);

  box.addEventListener('mousedown', dragMouseDown);
  box.addEventListener('input', saveTextState);

  textLayer.appendChild(box);
  saveTextState();
}

function saveTextState() {
  if (textHistory.length >= 50) textHistory.shift();
  textHistory.push(textLayer.innerHTML);
  textRedoStack = [];
  autoSaveProject();
}

function undoText() {
  if (textHistory.length === 0) return;
  textRedoStack.push(textLayer.innerHTML);
  const prev = textHistory.pop();
  textLayer.innerHTML = prev;
  rebindTextBoxes();
}

function redoText() {
  if (textRedoStack.length === 0) return;
  textHistory.push(textLayer.innerHTML);
  const next = textRedoStack.pop();
  textLayer.innerHTML = next;
  rebindTextBoxes();
}

function rebindTextBoxes() {
  textLayer.querySelectorAll('.text-box').forEach(box => {
    box.contentEditable = true;
    box.removeEventListener('mousedown', dragMouseDown);
    box.addEventListener('mousedown', dragMouseDown);
    box.removeEventListener('input', saveTextState);
    box.addEventListener('input', saveTextState);

    if (!box.querySelector('.close-btn')) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'close-btn';
      closeBtn.innerHTML = '×';
      closeBtn.onclick = function (e) {
        e.stopPropagation();
        box.remove();
        saveTextState();
      };
      box.appendChild(closeBtn);
    }
  });
}

// ======= DRAGGING TEXT BOXES =======

function dragMouseDown(e) {
  const box = e.currentTarget;
  e.preventDefault();

  const rect = box.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const shiftX = e.clientX - rect.left;
  const shiftY = e.clientY - rect.top;

  function moveAt(pageX, pageY) {
    let newLeft = pageX - shiftX - containerRect.left;
    let newTop = pageY - shiftY - containerRect.top;

    // Constrain within container boundaries
    newLeft = Math.max(0, Math.min(newLeft, container.clientWidth - box.offsetWidth));
    newTop = Math.max(0, Math.min(newTop, container.clientHeight - box.offsetHeight));

    box.style.left = newLeft + 'px';
    box.style.top = newTop + 'px';
  }

  function onMouseMove(e) {
    moveAt(e.pageX, e.pageY);
  }

  document.addEventListener('mousemove', onMouseMove);

  document.addEventListener('mouseup', function onMouseUp() {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    saveTextState();
  });
}

// ======= PEN SETTINGS =======

document.getElementById('penColor').addEventListener('input', (e) => {
  penColor = e.target.value;
});

document.getElementById('penSize').addEventListener('change', (e) => {
  penSize = parseInt(e.target.value);
});

function toggleEraser() {
  isEraser = !isEraser;
  const btn = document.getElementById('eraserButton');
  btn.textContent = isEraser ? '🧽 Eraser: On' : '🧽 Eraser: Off';
}

// ======= CLEAR FUNCTIONS =======

function clearCanvas() {
  if (!confirm('Clear the canvas? This cannot be undone.')) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  saveState();
}

function clearText() {
  if (!confirm('Clear all text boxes? This cannot be undone.')) return;
  textLayer.innerHTML = '';
  saveTextState();
}

// ======= EXPORT =======

// Make sure html2canvas is loaded for this function to work
function exportToImage() {
  saveCurrentPage();

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = canvas.width;
  exportCanvas.height = canvas.height;
  const exportCtx = exportCanvas.getContext('2d');

  const bgImg = new Image();
  bgImg.crossOrigin = "anonymous"; // For CORS issues with image if needed
  bgImg.src = image.src;

  bgImg.onload = () => {
    exportCtx.drawImage(bgImg, 0, 0, exportCanvas.width, exportCanvas.height);
    exportCtx.drawImage(canvas, 0, 0);

    // Use html2canvas to convert textLayer divs to canvas image
    if (typeof html2canvas !== 'undefined') {
      html2canvas(textLayer, {
        backgroundColor: null,
        useCORS: true,
        scale: 2
      }).then(textCanvas => {
        exportCtx.drawImage(textCanvas, 0, 0, exportCanvas.width, exportCanvas.height);
        const link = document.createElement('a');
        link.download = 'planner_export.png';
        link.href = exportCanvas.toDataURL();
        link.click();
      });
    } else {
      alert("html2canvas library is required for export.");
    }
  };
}

// ======= BUTTON BINDINGS =======

document.getElementById('addTextBox').onclick = addTextBox;
document.getElementById('undoButton').onclick = () => {
  undo();
  undoText();
};
document.getElementById('redoButton').onclick = () => {
  redo();
  redoText();
};
document.getElementById('clearCanvas').onclick = clearCanvas;
document.getElementById('clearText').onclick = clearText;
document.getElementById('eraserButton').onclick = toggleEraser;

document.getElementById('addPageButton').onclick = addPage;
document.getElementById('renamePageButton').onclick = renamePage;
document.getElementById('deletePageButton').onclick = deletePage;
document.getElementById('pageSelector').onchange = (e) => {
  saveCurrentPage();
  loadPage(e.target.value);
};

document.getElementById('exportButton').onclick = exportToImage;

// ======= INITIAL SETUP =======

resizeCanvas();
