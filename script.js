/* ===================================================
   Doto — Todo App Script
   Single source of truth: todos[]
   All rendering goes through render()
   All persistence goes through saveTodos()
   =================================================== */

// ===================================================
// Global State
// ===================================================

/** Main data array — single source of truth */
let todos = [];

/** Currently active filter: 'all' | 'active' | 'completed' */
let currentFilter = 'all';

/** ID of todo being dragged */
let dragSrcId = null;

// ===================================================
// Dark Mode (runs BEFORE render to prevent flash)
// ===================================================

/** Read dark mode preference from localStorage and apply it immediately */
function initDarkMode() {
  const isDark = localStorage.getItem('doto_dark') === 'true';
  if (isDark) {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.getElementById('darkModeToggle').textContent = '☀️';
  }
}

/** Toggle dark/light mode and save preference */
function toggleDarkMode() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    document.getElementById('darkModeToggle').textContent = '🌙';
    localStorage.setItem('doto_dark', 'false');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.getElementById('darkModeToggle').textContent = '☀️';
    localStorage.setItem('doto_dark', 'true');
  }
}

// ===================================================
// Storage
// ===================================================

/** Persist todos array and current filter to localStorage */
function saveTodos() {
  localStorage.setItem('doto_todos', JSON.stringify(todos));
  localStorage.setItem('doto_filter', currentFilter);
}

/** Load todos array and filter from localStorage on startup */
function loadTodos() {
  try {
    const stored = localStorage.getItem('doto_todos');
    const storedFilter = localStorage.getItem('doto_filter');
    todos = stored ? JSON.parse(stored) : [];
    currentFilter = storedFilter || 'all';
  } catch (e) {
    // If parse fails, start fresh
    todos = [];
    currentFilter = 'all';
  }
}

// ===================================================
// Utility Helpers
// ===================================================

/** Generate a short unique ID for new todo items */
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Return the subset of todos matching currentFilter */
function getFilteredTodos() {
  if (currentFilter === 'active')    return todos.filter(t => !t.completed);
  if (currentFilter === 'completed') return todos.filter(t => t.completed);
  return todos;
}

/** Count todos that are not yet completed */
function getActiveCount() {
  return todos.filter(t => !t.completed).length;
}

/** Escape text to prevent XSS when inserting into innerHTML */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// ===================================================
// Sub-renders (called from render())
// ===================================================

/** Update the progress bar width and colour class */
function updateProgress() {
  const bar = document.getElementById('progressBar');
  if (todos.length === 0) {
    bar.style.width = '0%';
    bar.className = 'progress-bar';
    return;
  }
  const pct = Math.round((todos.filter(t => t.completed).length / todos.length) * 100);
  bar.style.width = pct + '%';
  const colorClass = pct <= 33 ? 'red' : pct <= 66 ? 'yellow' : 'green';
  bar.className = 'progress-bar ' + colorClass;
}

/** Update the "X tasks left" counter label */
function updateCounter() {
  const count = getActiveCount();
  document.getElementById('taskCounter').textContent =
    count === 1 ? '1 task left' : count + ' tasks left';
}

/** Highlight the currently active filter tab */
function updateFilterTabs() {
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.filter === currentFilter);
  });
}

/** Show / hide footer action buttons based on state */
function updateFooterButtons() {
  const hasCompleted = todos.some(t => t.completed);
  const hasAny = todos.length > 0;
  document.getElementById('clearCompletedBtn').classList.toggle('hidden', !hasCompleted);
  document.getElementById('clearAllBtn').classList.toggle('hidden', !hasAny);
}

// ===================================================
// Main Render Function
// ===================================================

/**
 * Rebuild the entire todo list DOM from the todos array.
 * This is the ONLY place where todo list elements are created.
 */
function render() {
  const list = document.getElementById('todoList');
  const filtered = getFilteredTodos();

  // Clear and repopulate the list
  list.innerHTML = '';

  if (filtered.length === 0) {
    // Empty state — message depends on active filter
    const states = {
      all:       { icon: '🎯', msg: 'Nothing to do! Add a task above.' },
      active:    { icon: '✨', msg: 'No active tasks.' },
      completed: { icon: '🏆', msg: 'No completed tasks yet.' }
    };
    const { icon, msg } = states[currentFilter];
    list.innerHTML = `
      <li class="empty-state">
        <div class="empty-icon">${icon}</div>
        <p class="empty-message">${msg}</p>
      </li>
    `;
  } else {
    filtered.forEach(todo => {
      const li = document.createElement('li');
      li.className = 'todo-item ' + (todo.completed ? 'completed-item' : 'active-item');
      li.setAttribute('data-id', todo.id);
      li.setAttribute('draggable', 'true');

      li.innerHTML = `
        <span class="drag-handle" aria-hidden="true">⠿</span>
        <input
          type="checkbox"
          class="todo-checkbox"
          ${todo.completed ? 'checked' : ''}
          aria-label="Mark as complete"
        >
        <span class="todo-text">${escapeHtml(todo.text)}</span>
        <div class="item-actions">
          <button class="action-btn edit-btn"   title="Edit task"   aria-label="Edit">✎</button>
          <button class="action-btn delete-btn" title="Delete task" aria-label="Delete">✕</button>
        </div>
      `;

      list.appendChild(li);
    });
  }

  updateProgress();
  updateCounter();
  updateFilterTabs();
  updateFooterButtons();
}

// ===================================================
// Todo CRUD Operations
// ===================================================

/** Read the input field, create a new todo, and re-render */
function addTodo() {
  const input = document.getElementById('todoInput');
  const text = input.value.trim();

  if (!text) {
    // Visual feedback: shake the input if it's empty
    input.classList.remove('shake-input');
    void input.offsetWidth; // reflow to restart animation
    input.classList.add('shake-input');
    setTimeout(() => input.classList.remove('shake-input'), 400);
    return;
  }

  todos.unshift({
    id:        genId(),
    text:      text,
    completed: false,
    createdAt: Date.now()
  });

  input.value = '';
  saveTodos();
  render();
}

/** Flip the completed state of a todo by its id */
function toggleTodo(id) {
  const todo = todos.find(t => t.id === id);
  if (todo) {
    todo.completed = !todo.completed;
    saveTodos();
    render();
  }
}

/** Replace the text span of a todo item with an editable input field */
function startEdit(id, li) {
  const todo = todos.find(t => t.id === id);
  if (!todo) return;

  const textSpan = li.querySelector('.todo-text');
  if (!textSpan) return; // already in edit mode

  const editInput = document.createElement('input');
  editInput.type = 'text';
  editInput.className = 'edit-input';
  editInput.value = todo.text;
  editInput.setAttribute('data-edit-id', id);

  li.replaceChild(editInput, textSpan);
  editInput.focus();
  editInput.select();
}

/** Commit an edited todo text and return to normal view */
function saveEdit(id, value) {
  const text = value.trim();
  // If text is non-empty and changed, update the array
  if (text) {
    const todo = todos.find(t => t.id === id);
    if (todo && todo.text !== text) {
      todo.text = text;
      saveTodos();
    }
  }
  render();
}

/**
 * Animate a shake on the todo item, wait 1 second, then
 * animate removal and delete from the array.
 */
function deleteTodo(id, li) {
  // Guard against double-trigger
  if (li.dataset.deleting) return;
  li.dataset.deleting = 'true';

  // Phase 1: shake to confirm deletion
  li.classList.add('shaking');

  setTimeout(() => {
    li.classList.remove('shaking');

    // Phase 2: slide-out animation
    li.classList.add('removing');

    setTimeout(() => {
      todos = todos.filter(t => t.id !== id);
      saveTodos();
      render();
    }, 280); // matches slideOut animation duration

  }, 420); // wait after shake
}

/** Remove all completed todos from the array */
function clearCompleted() {
  todos = todos.filter(t => !t.completed);
  saveTodos();
  render();
}

/** Remove every todo from the array */
function clearAll() {
  todos = [];
  saveTodos();
  render();
}

// ===================================================
// Drag & Drop Handlers
// ===================================================

/** Record the dragged item's id and add the dragging style */
function handleDragStart(e, li) {
  dragSrcId = li.dataset.id;
  li.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  // Needed for Firefox compatibility
  e.dataTransfer.setData('text/plain', dragSrcId);
}

/** Prevent default to allow drop; highlight the target item */
function handleDragOver(e, li) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  // Clear previous highlights
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  if (li.dataset.id !== dragSrcId) {
    li.classList.add('drag-over');
  }
}

/** Reorder the todos array by moving src to the target's position */
function handleDrop(e, li) {
  e.preventDefault();
  const targetId = li.dataset.id;
  if (!targetId || targetId === dragSrcId || !dragSrcId) return;

  // Work on full todos array (not filtered view)
  const srcIdx    = todos.findIndex(t => t.id === dragSrcId);
  const targetIdx = todos.findIndex(t => t.id === targetId);
  if (srcIdx === -1 || targetIdx === -1) return;

  // Splice src out, insert at target position
  const [moved] = todos.splice(srcIdx, 1);
  todos.splice(targetIdx, 0, moved);

  saveTodos();
  render();
}

/** Clean up drag state after drag ends (drop or cancel) */
function handleDragEnd(li) {
  li.classList.remove('dragging');
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  dragSrcId = null;
}

// ===================================================
// Event Listener Setup (called once on DOMContentLoaded)
// ===================================================

/**
 * Attach all event listeners once using event delegation
 * wherever possible. No per-item listeners are added.
 */
function attachEventListeners() {
  const todoList           = document.getElementById('todoList');
  const todoInput          = document.getElementById('todoInput');
  const addBtn             = document.getElementById('addBtn');
  const filterTabsEl       = document.getElementById('filterTabs');
  const clearCompletedBtn  = document.getElementById('clearCompletedBtn');
  const clearAllBtn        = document.getElementById('clearAllBtn');
  const darkModeToggleBtn  = document.getElementById('darkModeToggle');

  // ---- Input: add on Enter key ----
  todoInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') addTodo();
  });

  // ---- Add Button click ----
  addBtn.addEventListener('click', addTodo);

  // ---- Dark mode toggle ----
  darkModeToggleBtn.addEventListener('click', toggleDarkMode);

  // ---- Filter Tabs (delegated) ----
  filterTabsEl.addEventListener('click', e => {
    const tab = e.target.closest('.filter-tab');
    if (!tab) return;
    currentFilter = tab.dataset.filter;
    saveTodos();
    render();
  });

  // ---- Clear Completed ----
  clearCompletedBtn.addEventListener('click', clearCompleted);

  // ---- Clear All ----
  clearAllBtn.addEventListener('click', clearAll);

  // ---- Todo List: clicks (checkbox, edit btn, delete btn) ----
  todoList.addEventListener('click', e => {
    const li = e.target.closest('.todo-item');
    if (!li) return;

    // Block interaction on items currently animating
    if (li.classList.contains('shaking') || li.classList.contains('removing')) return;

    const id = li.dataset.id;
    if (!id) return;

    if (e.target.classList.contains('todo-checkbox')) {
      toggleTodo(id);
    } else if (e.target.classList.contains('edit-btn')) {
      startEdit(id, li);
    } else if (e.target.classList.contains('delete-btn')) {
      deleteTodo(id, li);
    }
  });

  // ---- Todo List: save edit on Enter, cancel on Escape ----
  todoList.addEventListener('keydown', e => {
    if (!e.target.classList.contains('edit-input')) return;
    if (e.key === 'Enter') {
      e.target.blur(); // triggers focusout → saveEdit
    } else if (e.key === 'Escape') {
      render(); // discard changes
    }
  });

  // ---- Todo List: save edit when edit field loses focus ----
  todoList.addEventListener('focusout', e => {
    if (!e.target.classList.contains('edit-input')) return;
    const id = e.target.getAttribute('data-edit-id');
    if (id) saveEdit(id, e.target.value);
  });

  // ---- Drag & Drop (all delegated to the list) ----
  todoList.addEventListener('dragstart', e => {
    const li = e.target.closest('.todo-item[draggable]');
    if (li) handleDragStart(e, li);
  });

  todoList.addEventListener('dragover', e => {
    const li = e.target.closest('.todo-item[draggable]');
    if (li) handleDragOver(e, li);
  });

  todoList.addEventListener('drop', e => {
    const li = e.target.closest('.todo-item[draggable]');
    if (li) handleDrop(e, li);
  });

  todoList.addEventListener('dragend', e => {
    const li = e.target.closest('.todo-item[draggable]');
    if (li) handleDragEnd(li);
  });

  // Cleanup drag-over highlight if pointer leaves the list
  todoList.addEventListener('dragleave', e => {
    if (!todoList.contains(e.relatedTarget)) {
      document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    }
  });
}

// ===================================================
// App Bootstrap
// ===================================================

/** Entry point — runs when the DOM is fully loaded */
document.addEventListener('DOMContentLoaded', () => {
  initDarkMode();   // Apply saved theme BEFORE render (no flash)
  loadTodos();      // Load data from localStorage
  attachEventListeners(); // Wire up all interactions (once)
  render();         // Initial paint
});
