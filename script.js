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

let pages = []; // Array of page objects
let currentPageIndex = -1; // -1 means no page yet

{
  name: "Page 1",
  background: "image-url.jpg",
  drawing: "data:image/png;base64,...",
  textBoxesHTML: "<div class='text-box'>...</div>"
}

function addPage() {
  const name = prompt("Enter page name:", "Page " + (pages.length + 1));
  if (!name) return;

  // Save current page before switching
  if (currentPageIndex !== -1) saveCurrentPage();

  // Create new blank page
  const newPage = {
    name,
    background: image.src,
    drawing: "", // empty canvas
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

function autoSaveProject() {
  saveCurrentPage(); // Save current state before storing
  const saveData = {
    pages,
    currentPageIndex
  };
  localStorage.setItem('plannerProject', JSON.stringify(saveData));
}

window.addEventListener('load', () => {
  const saved = localStorage.getItem('plannerProject');
  if (!saved) return;

  const project = JSON.parse(saved);
  pages = project.pages || [];
  currentPageIndex = project.currentPageIndex || 0;

  updatePageSelector();
  if (pages.length > 0) loadPage(currentPageIndex);
});



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

  // Set background
  image.src = page.background;

  // Load drawing
  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
  };
  img.src = page.drawing || "";

  // Load text boxes
  textLayer.innerHTML = page.textBoxesHTML || "";
  rebindTextBoxes();

  autoSaveProject(); // Save project on switch
}


function saveTextState() {
  const snapshot = textLayer.innerHTML;
  textHistory.push(snapshot);
  if (textHistory.length > 50) textHistory.shift(); // limit size
  textRedoStack = []; // clear redo stack
  autoSave();
}


function toggleEraser() {
  isEraser = !isEraser;

  const btn = document.getElementById('eraserButton');
  if (isEraser) {
    btn.textContent = '🧽 Eraser: On';
  } else {
    btn.textContent = '🧽 Eraser: Off';
  }
}


// Resize canvas to match image
function resizeCanvas() {
  const rect = image.getBoundingClientRect();

  // Get device pixel ratio for crisp drawing on retina
  const dpr = window.devicePixelRatio || 1;

  // Set canvas size based on real pixels
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';

  ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
  ctx.scale(dpr, dpr);

  textLayer.style.width = rect.width + 'px';
  textLayer.style.height = rect.height + 'px';
}


window.addEventListener('resize', resizeCanvas);
image.onload = resizeCanvas;

// Drawing functionality
let drawing = false;

canvas.addEventListener('mousedown', e => {
  drawing = true;
  ctx.beginPath();
  ctx.moveTo(e.offsetX, e.offsetY);
});

canvas.addEventListener('mousedown', e => {
  drawing = true;
  ctx.beginPath();
  ctx.moveTo(e.offsetX, e.offsetY);
});

canvas.addEventListener('mousemove', e => {
  if (drawing) {
    ctx.strokeStyle = isEraser ? '#FFFFFF' : penColor;
    ctx.lineWidth = penSize;
    ctx.lineCap = 'round';
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.stroke();
  }
});


document.getElementById('penColor').addEventListener('input', (e) => {
  penColor = e.target.value;
});

document.getElementById('penSize').addEventListener('change', (e) => {
  penSize = parseInt(e.target.value);
});


canvas.addEventListener('mouseup', () => {
  drawing = false;
  saveState();
});

function saveState() {
  // Save current canvas state as image
  if (history.length > 50) history.shift(); // prevent memory overload
  history.push(canvas.toDataURL());
  redoStack = []; // clear redo stack when new action is made
  autoSave();
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
    ctx.drawImage(img, 0, 0);
  };
  img.src = dataURL;
}


canvas.addEventListener('mouseleave', () => {
  drawing = false;
});

// Add text boxes
function addTextBox() {
  const box = document.createElement('div');
  box.className = 'text-box';
  box.contentEditable = true;
  box.style.left = '50px';
  box.style.top = '50px';

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'close-btn';
  closeBtn.innerHTML = '×';
  closeBtn.onclick = function (e) {
    e.stopPropagation(); // prevent dragging
    box.remove();
    saveTextState();
  };

  box.appendChild(closeBtn);
  box.addEventListener('mousedown', dragMouseDown);
  box.addEventListener('input', saveTextState);
  textLayer.appendChild(box);
  saveTextState();
}

box.appendChild(closeBtn);
  box.addEventListener('mousedown', dragMouseDown);
  box.addEventListener('input', saveTextState);
  textLayer.appendChild(box);
  saveTextState();
}


box.addEventListener('input', () => {
  saveTextState(); // <--- Save when edited
});

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
    box.addEventListener('mousedown', dragMouseDown);
    box.addEventListener('input', saveTextState);

    // If close button is missing (after undo/redo), add it
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




// Drag text boxes
function dragMouseDown(e) {
  const box = e.target;
  let shiftX = e.clientX - box.getBoundingClientRect().left;
  let shiftY = e.clientY - box.getBoundingClientRect().top;

  function moveAt(pageX, pageY) {
    box.style.left = pageX - shiftX - container.offsetLeft + 'px';
    box.style.top = pageY - shiftY - container.offsetTop + 'px';
  }

  function onMouseMove(e) {
    moveAt(e.pageX, e.pageY);
  }

  document.addEventListener('mousemove', onMouseMove);

  box.onmouseup = function () {
    document.removeEventListener('mousemove', onMouseMove);
    box.onmouseup = null;
    saveTextState(); // <--- Save move
  };
}

// Touch/stylus drawing
canvas.addEventListener('touchstart', function (e) {
  e.preventDefault();
  if (e.touches.length > 0) {
    drawing = true;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  }
}, { passive: false });

canvas.addEventListener('touchmove', function (e) {
  e.preventDefault();
  if (drawing && e.touches.length > 0) {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    ctx.strokeStyle = isEraser ? '#FFFFFF' : penColor;
    ctx.lineWidth = penSize;
    ctx.lineCap = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();
  }
}, { passive: false });

canvas.addEventListener('touchend', function (e) {
  e.preventDefault();
  drawing = false;
  saveState();
}, { passive: false });


// Clear canvas
function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// Load new page
function loadPage() {
  const page = document.getElementById('pageSelect').value;
  image.src = 'pages/' + page;
  clearCanvas();
  textLayer.innerHTML = '';
}

function saveAsImage() {
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = canvas.width;
  exportCanvas.height = canvas.height;
  const exportCtx = exportCanvas.getContext('2d');

  // Draw the background image
  exportCtx.drawImage(image, 0, 0, canvas.width, canvas.height);

  // Draw the canvas content (drawing layer)
  exportCtx.drawImage(canvas, 0, 0);

  // Draw text boxes from the textLayer
  const textBoxes = textLayer.querySelectorAll('.text-box');
  textBoxes.forEach(box => {
    const x = parseFloat(box.style.left);
    const y = parseFloat(box.style.top);
    exportCtx.font = '16px sans-serif';
    exportCtx.fillStyle = '#000';
    exportCtx.fillText(box.innerText, x, y + 16); // add y offset for baseline
  });

  // Save final image
  const dataURL = exportCanvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = 'planner-page.png';
  link.href = dataURL;
  link.click();
}

function savePage() {
  const textBoxes = [];
  textLayer.querySelectorAll('.text-box').forEach(box => {
    textBoxes.push({
      text: box.innerText,
      left: box.style.left,
      top: box.style.top
    });
  });

  const drawing = canvas.toDataURL(); // drawing as image

  const pageData = {
    background: image.src,
    drawing,
    textBoxes
  };

  const blob = new Blob([JSON.stringify(pageData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.download = 'planner-page.json';
  link.href = url;
  link.click();
}

document.getElementById('fileInput').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    const pageData = JSON.parse(e.target.result);
    loadSavedPage(pageData);
  };
  reader.readAsText(file);
});

function loadPageFromFile() {
  document.getElementById('fileInput').click();
}

function loadSavedPage(data) {
  // Set background image
  image.src = data.background;

  // Load drawing
  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
  };
  img.src = data.drawing;

  // Load text boxes
  textLayer.innerHTML = '';
  data.textBoxes.forEach(boxData => {
    const box = document.createElement('div');
    box.className = 'text-box';
    box.contentEditable = true;
    box.style.left = boxData.left;
    box.style.top = boxData.top;
    box.innerText = boxData.text;
    box.addEventListener('mousedown', dragMouseDown);
    textLayer.appendChild(box);
  });
}

function autoSave() {
  const textBoxesHTML = textLayer.innerHTML;
  const drawingData = canvas.toDataURL();
  const backgroundImage = image.src;

  const saveData = {
    drawingData,
    textBoxesHTML,
    backgroundImage
  };

  localStorage.setItem('plannerAutoSave', JSON.stringify(saveData));
}

window.addEventListener('load', () => {
  const saved = localStorage.getItem('plannerAutoSave');
  if (!saved) return;

  const data = JSON.parse(saved);

  // Restore image background
  image.src = data.backgroundImage;

  // Restore drawing layer
  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
  };
  img.src = data.drawingData;

  // Restore text layer
  textLayer.innerHTML = data.textBoxesHTML;
  rebindTextBoxes();
});

function clearAll() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  textLayer.innerHTML = '';
  localStorage.removeItem('plannerAutoSave');
  history = [];
  redoStack = [];
  textHistory = [];
  textRedoStack = [];
}

