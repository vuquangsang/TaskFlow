/**
 * TaskFlow — Personal Task Manager Application Logic
 * Pure Vanilla JavaScript with LocalStorage Persistence
 */

(function () {
    'use strict';

    const STORAGE_KEYS = {
        TASKS: 'taskflow_tasks_v1',
        THEME: 'taskflow_theme_v1'
    };

    const PRIORITY_WEIGHT = {
        'High': 3,
        'Medium': 2,
        'Low': 1
    };

    const VALID_PRIORITIES = ['Low', 'Medium', 'High'];
    const VALID_STATUSES = ['Todo', 'In Progress', 'Completed'];
    const VALID_REMIND_OFFSETS = [-1, 0, 5, 15, 30, 60, 1440];
    const REMINDER_LABELS = {
        '0': 'Đúng hạn',
        '5': 'Trước 5p',
        '15': 'Trước 15p',
        '30': 'Trước 30p',
        '60': 'Trước 1h',
        '1440': 'Trước 1 ngày'
    };

    // Application State
    let state = {
        tasks: [],
        filters: {
            search: '',
            status: 'all',
            priority: 'all',
            sortBy: 'dueDateAsc'
        },
        editingTaskId: null,
        deletingTaskId: null,
        reminderTimerId: null
    };

    // DOM Elements
    const dom = {
        html: document.documentElement,
        notifyToggleBtn: document.getElementById('notifyToggleBtn'),
        themeToggleBtn: document.getElementById('themeToggleBtn'),
        openAddModalBtn: document.getElementById('openAddModalBtn'),
        emptyAddBtn: document.getElementById('emptyAddBtn'),
        restoreSampleBtn: document.getElementById('restoreSampleBtn'),

        // Stats
        statTotal: document.getElementById('statTotal'),
        statOverdueText: document.getElementById('statOverdueText'),
        statPending: document.getElementById('statPending'),
        statPendingBreakdown: document.getElementById('statPendingBreakdown'),
        statCompleted: document.getElementById('statCompleted'),
        statCompletedRate: document.getElementById('statCompletedRate'),
        statProgressPercent: document.getElementById('statProgressPercent'),
        statProgressBar: document.getElementById('statProgressBar'),
        progressBarTrack: document.getElementById('progressBarTrack'),
        statProgressSummary: document.getElementById('statProgressSummary'),

        // Filters & Search
        searchInput: document.getElementById('searchInput'),
        clearSearchBtn: document.getElementById('clearSearchBtn'),
        statusFilterTabs: document.getElementById('statusFilterTabs'),
        priorityFilter: document.getElementById('priorityFilter'),
        sortBy: document.getElementById('sortBy'),
        resultsCountText: document.getElementById('resultsCountText'),
        resetFiltersBtn: document.getElementById('resetFiltersBtn'),

        // Tasks List
        tasksContainer: document.getElementById('tasksContainer'),
        emptyState: document.getElementById('emptyState'),
        emptyStateTitle: document.getElementById('emptyStateTitle'),
        emptyStateDesc: document.getElementById('emptyStateDesc'),

        // Add/Edit Modal
        taskModal: document.getElementById('taskModal'),
        modalTitle: document.getElementById('modalTitle'),
        closeModalBtn: document.getElementById('closeModalBtn'),
        cancelModalBtn: document.getElementById('cancelModalBtn'),
        taskForm: document.getElementById('taskForm'),
        taskId: document.getElementById('taskId'),
        taskTitle: document.getElementById('taskTitle'),
        taskDescription: document.getElementById('taskDescription'),
        taskDueDate: document.getElementById('taskDueDate'),
        taskDueTime: document.getElementById('taskDueTime'),
        taskReminder: document.getElementById('taskReminder'),
        taskPriority: document.getElementById('taskPriority'),
        taskStatus: document.getElementById('taskStatus'),
        titleError: document.getElementById('titleError'),
        dateError: document.getElementById('dateError'),
        timeError: document.getElementById('timeError'),

        // Delete Modal
        deleteModal: document.getElementById('deleteModal'),
        closeDeleteModalBtn: document.getElementById('closeDeleteModalBtn'),
        cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
        confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
        deleteTaskName: document.getElementById('deleteTaskName'),

        // Restore Sample Modal
        restoreModal: document.getElementById('restoreModal'),
        closeRestoreModalBtn: document.getElementById('closeRestoreModalBtn'),
        cancelRestoreBtn: document.getElementById('cancelRestoreBtn'),
        confirmRestoreBtn: document.getElementById('confirmRestoreBtn'),

        // Toast
        toastContainer: document.getElementById('toastContainer')
    };

    /* ==========================================================================
       Helper Utilities
       ========================================================================== */
    function generateId() {
        return 'task_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
    }

    function getTodayDateString() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function getRelativeDateString(offsetDays) {
        const date = new Date();
        date.setDate(date.getDate() + offsetDays);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function formatDisplayDate(dateStr, timeStr) {
        if (!dateStr) return 'Không có hạn';
        const parts = dateStr.split('-');
        const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
        const safeTime = isValidTimeString(timeStr) ? timeStr : '23:59';
        return `${formattedDate} · ${safeTime}`;
    }

    function getTaskDueTimestamp(dueDateStr, dueTimeStr) {
        if (!isValidDateString(dueDateStr)) return null;
        const safeTime = isValidTimeString(dueTimeStr) ? dueTimeStr : '23:59';
        const [year, month, day] = dueDateStr.split('-').map(Number);
        const [hour, minute] = safeTime.split(':').map(Number);
        return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
    }

    function isTaskOverdue(task, nowMs = Date.now()) {
        if (!task || task.status === 'Completed' || !task.dueDate) return false;
        const dueMs = getTaskDueTimestamp(task.dueDate, task.dueTime);
        if (dueMs === null) return false;
        return nowMs > dueMs;
    }

    function getDueStatus(dueDateStr, dueTimeStr, status) {
        const displayLabel = formatDisplayDate(dueDateStr, dueTimeStr);
        if (status === 'Completed' || !dueDateStr) {
            return { type: 'normal', label: displayLabel };
        }
        const dueMs = getTaskDueTimestamp(dueDateStr, dueTimeStr);
        if (dueMs !== null && Date.now() > dueMs) {
            return { type: 'overdue', label: `Quá hạn (${displayLabel})` };
        }
        const today = getTodayDateString();
        if (dueDateStr === today) {
            return { type: 'today', label: `Hôm nay (${displayLabel})` };
        }
        return { type: 'normal', label: displayLabel };
    }

    function escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function isValidDateString(dateStr) {
        if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return false;
        }
        const [year, month, day] = dateStr.split('-').map(Number);
        if (year < 2000 || year > 2099 || month < 1 || month > 12 || day < 1 || day > 31) {
            return false;
        }
        const date = new Date(year, month - 1, day);
        return (
            date.getFullYear() === year &&
            date.getMonth() === month - 1 &&
            date.getDate() === day
        );
    }

    function isValidTimeString(timeStr) {
        if (typeof timeStr !== 'string' || !/^\d{2}:\d{2}$/.test(timeStr)) {
            return false;
        }
        const [hour, minute] = timeStr.split(':').map(Number);
        return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
    }

    function buildReminderKey(dueDate, dueTime, remindOffset) {
        return `${dueDate}_${dueTime}_${remindOffset}`;
    }

    function normalizeTask(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const title = typeof raw.title === 'string' ? raw.title.trim() : '';
        if (!title) return null;

        const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : generateId();
        const description = typeof raw.description === 'string' ? raw.description.trim() : '';
        const dueDate = isValidDateString(raw.dueDate) ? raw.dueDate : getTodayDateString();
        const dueTime = isValidTimeString(raw.dueTime) ? raw.dueTime : '23:59';
        const parsedOffset = Number(raw.remindOffset);
        const remindOffset = VALID_REMIND_OFFSETS.includes(parsedOffset) ? parsedOffset : -1;
        const priority = VALID_PRIORITIES.includes(raw.priority) ? raw.priority : 'Medium';
        const status = VALID_STATUSES.includes(raw.status) ? raw.status : 'Todo';
        const createdAt = typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt)
            ? raw.createdAt
            : Date.now();
        const notifiedForKey = typeof raw.notifiedForKey === 'string' ? raw.notifiedForKey : null;

        return {
            id,
            title,
            description,
            dueDate,
            dueTime,
            remindOffset,
            notifiedForKey,
            priority,
            status,
            createdAt,
            ...(typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) ? { updatedAt: raw.updatedAt } : {})
        };
    }

    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        dom.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(20px)';
            toast.style.transition = 'all 0.2s ease';
            setTimeout(() => toast.remove(), 200);
        }, 2800);
    }

    /* ==========================================================================
       Theme Management (Light / Dark Mode)
       ========================================================================== */
    function initTheme() {
        const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
        if (savedTheme === 'dark' || savedTheme === 'light') {
            dom.html.setAttribute('data-theme', savedTheme);
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            dom.html.setAttribute('data-theme', 'dark');
        }
    }

    function toggleTheme() {
        const current = dom.html.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        dom.html.setAttribute('data-theme', next);
        localStorage.setItem(STORAGE_KEYS.THEME, next);
    }

    /* ==========================================================================
       LocalStorage & Sample Data
       ========================================================================== */
    function getSampleTasks() {
        return [
            {
                id: generateId(),
                title: 'Thiết kế giao diện UI/UX cho trang Dashboard',
                description: 'Chuẩn bị bảng màu Light/Dark mode, hệ thống lưới responsive và các thẻ thống kê.',
                dueDate: getRelativeDateString(1),
                dueTime: '23:59',
                remindOffset: -1,
                notifiedForKey: null,
                priority: 'High',
                status: 'In Progress',
                createdAt: Date.now() - 3600000 * 24
            },
            {
                id: generateId(),
                title: 'Viết tài liệu hướng dẫn bàn giao dự án',
                description: 'Tổng hợp cấu trúc thư mục, hướng dẫn sử dụng các bộ lọc và lưu trữ LocalStorage.',
                dueDate: getRelativeDateString(3),
                dueTime: '23:59',
                remindOffset: -1,
                notifiedForKey: null,
                priority: 'Medium',
                status: 'Todo',
                createdAt: Date.now() - 3600000 * 18
            },
            {
                id: generateId(),
                title: 'Kiểm thử tính năng Lọc và Thống kê công việc',
                description: 'Đảm bảo số liệu hoàn thành và chưa hoàn thành cập nhật tức thì khi đổi trạng thái.',
                dueDate: getTodayDateString(),
                dueTime: '23:59',
                remindOffset: -1,
                notifiedForKey: null,
                priority: 'High',
                status: 'Completed',
                createdAt: Date.now() - 3600000 * 12
            },
            {
                id: generateId(),
                title: 'Dọn dẹp email và sắp xếp lịch họp tuần tới',
                description: 'Phân loại các email quan trọng từ khách hàng và xác nhận lịch review sản phẩm.',
                dueDate: getRelativeDateString(-1),
                dueTime: '23:59',
                remindOffset: -1,
                notifiedForKey: null,
                priority: 'Low',
                status: 'Todo',
                createdAt: Date.now() - 3600000 * 30
            }
        ];
    }

    function loadTasks() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
            if (raw === null) {
                state.tasks = getSampleTasks();
                saveTasks();
            } else {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    state.tasks = parsed.map(normalizeTask).filter(Boolean);
                } else {
                    state.tasks = [];
                }
            }
        } catch (err) {
            console.error('Không thể đọc dữ liệu từ LocalStorage:', err);
            state.tasks = [];
        }
    }

    function saveTasks() {
        try {
            localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(state.tasks));
        } catch (err) {
            console.error('Không thể lưu dữ liệu vào LocalStorage:', err);
        }
    }

    /* ==========================================================================
       Statistics Calculation & Rendering
       ========================================================================== */
    function renderStats() {
        const total = state.tasks.length;
        const completed = state.tasks.filter(t => t.status === 'Completed').length;
        const todo = state.tasks.filter(t => t.status === 'Todo').length;
        const inProgress = state.tasks.filter(t => t.status === 'In Progress').length;
        const pending = todo + inProgress;

        const nowMs = Date.now();
        const overdue = state.tasks.filter(t => isTaskOverdue(t, nowMs)).length;

        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

        dom.statTotal.textContent = total;
        dom.statOverdueText.textContent = overdue > 0 ? `${overdue} công việc quá hạn` : 'Không có việc quá hạn';
        dom.statOverdueText.classList.toggle('overdue-alert', overdue > 0);

        dom.statPending.textContent = pending;
        dom.statPendingBreakdown.textContent = `${todo} Todo · ${inProgress} In Progress`;

        dom.statCompleted.textContent = completed;
        dom.statCompletedRate.textContent = `Tỷ lệ: ${percent}%`;

        dom.statProgressPercent.textContent = `${percent}%`;
        dom.statProgressBar.style.width = `${percent}%`;
        dom.progressBarTrack.setAttribute('aria-valuenow', percent);

        if (total === 0) {
            dom.statProgressSummary.textContent = 'Chưa có công việc nào';
        } else if (completed === total) {
            dom.statProgressSummary.textContent = 'Tuyệt vời! Bạn đã hoàn thành tất cả công việc.';
        } else {
            dom.statProgressSummary.textContent = `Đã hoàn thành ${completed}/${total} công việc (${pending} chưa hoàn thành)`;
        }
    }

    /* ==========================================================================
       Filtering, Sorting & Task List Rendering
       ========================================================================== */
    function getFilteredAndSortedTasks() {
        const { search, status, priority, sortBy } = state.filters;
        const keyword = search.trim().toLowerCase();

        const filtered = state.tasks.filter(task => {
            const matchesStatus = status === 'all' || task.status === status;
            const matchesPriority = priority === 'all' || task.priority === priority;
            const matchesSearch = !keyword ||
                task.title.toLowerCase().includes(keyword) ||
                (task.description && task.description.toLowerCase().includes(keyword));

            return matchesStatus && matchesPriority && matchesSearch;
        });

        return filtered.sort((a, b) => {
            if (sortBy === 'priorityDesc') {
                const diff = (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0);
                if (diff !== 0) return diff;
            } else if (sortBy === 'createdDesc') {
                return (b.createdAt || 0) - (a.createdAt || 0);
            }
            // Default: dueDateAsc (compare both dueDate and dueTime)
            const dateA = `${a.dueDate || '9999-12-31'}T${isValidTimeString(a.dueTime) ? a.dueTime : '23:59'}`;
            const dateB = `${b.dueDate || '9999-12-31'}T${isValidTimeString(b.dueTime) ? b.dueTime : '23:59'}`;
            if (dateA !== dateB) return dateA.localeCompare(dateB);
            return (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0);
        });
    }

    function hasActiveFilters() {
        return (
            state.filters.search.trim() !== '' ||
            state.filters.status !== 'all' ||
            state.filters.priority !== 'all' ||
            state.filters.sortBy !== 'dueDateAsc'
        );
    }

    function renderTasks() {
        const filteredTasks = getFilteredAndSortedTasks();
        const totalTasks = state.tasks.length;
        const isFiltered = hasActiveFilters();

        // Update results count & filter reset link
        dom.resultsCountText.textContent = isFiltered
            ? `Hiển thị ${filteredTasks.length} / ${totalTasks} công việc`
            : `Hiển thị ${filteredTasks.length} công việc`;
        dom.resetFiltersBtn.classList.toggle('hidden', !isFiltered);
        dom.clearSearchBtn.classList.toggle('hidden', state.filters.search.trim() === '');

        if (filteredTasks.length === 0) {
            dom.tasksContainer.innerHTML = '';
            dom.emptyState.classList.remove('hidden');

            if (totalTasks > 0 && isFiltered) {
                dom.emptyStateTitle.textContent = 'Không tìm thấy công việc phù hợp';
                dom.emptyStateDesc.textContent = 'Thử thay đổi bộ lọc trạng thái, mức ưu tiên hoặc từ khóa tìm kiếm của bạn.';
                dom.emptyAddBtn.classList.add('hidden');
            } else {
                dom.emptyStateTitle.textContent = 'Chưa có công việc nào';
                dom.emptyStateDesc.textContent = 'Hãy thêm công việc đầu tiên để bắt đầu quản lý thời gian hiệu quả hơn.';
                dom.emptyAddBtn.classList.remove('hidden');
            }
            return;
        }

        dom.emptyState.classList.add('hidden');

        dom.tasksContainer.innerHTML = filteredTasks.map(task => {
            const dueInfo = getDueStatus(task.dueDate, task.dueTime, task.status);
            const statusClass = task.status.replace(/\s+/g, '');
            const isCompleted = task.status === 'Completed';
            const hasReminder = typeof task.remindOffset === 'number' && task.remindOffset >= 0;
            const reminderLabel = hasReminder ? (REMINDER_LABELS[String(task.remindOffset)] || '') : '';

            const dueClass = dueInfo.type === 'overdue'
                ? 'is-overdue'
                : (dueInfo.type === 'today' ? 'is-today' : '');

            return `
                <article class="task-card ${isCompleted ? 'is-completed' : ''}" data-id="${escapeHtml(task.id)}" data-priority="${escapeHtml(task.priority)}">
                    <div>
                        <div class="task-card-top">
                            <div class="task-badges">
                                <span class="badge badge-priority-${escapeHtml(task.priority)}">
                                    ${escapeHtml(task.priority)}
                                </span>
                                <span class="badge badge-status-${escapeHtml(statusClass)}">
                                    ${escapeHtml(task.status)}
                                </span>
                                ${hasReminder ? `
                                <span class="badge badge-reminder" title="Nhắc nhở: ${escapeHtml(reminderLabel)}">
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                                        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                                    </svg>
                                    <span>${escapeHtml(reminderLabel)}</span>
                                </span>` : ''}
                            </div>
                            <div class="task-actions">
                                <button type="button" class="action-btn edit-btn" data-action="edit" data-id="${escapeHtml(task.id)}" title="Chỉnh sửa công việc" aria-label="Chỉnh sửa ${escapeHtml(task.title)}">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                    </svg>
                                </button>
                                <button type="button" class="action-btn delete-btn" data-action="delete" data-id="${escapeHtml(task.id)}" title="Xóa công việc" aria-label="Xóa ${escapeHtml(task.title)}">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div class="task-body" style="margin-top: 0.75rem;">
                            <h3 class="task-title">${escapeHtml(task.title)}</h3>
                            ${task.description ? `<p class="task-desc">${escapeHtml(task.description)}</p>` : ''}
                        </div>
                    </div>

                    <div class="task-footer">
                        <div class="task-due ${dueClass}" title="Ngày hết hạn">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="16" y1="2" x2="16" y2="6"></line>
                                <line x1="8" y1="2" x2="8" y2="6"></line>
                                <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                            <span>${escapeHtml(dueInfo.label)}</span>
                        </div>

                        <select class="quick-status-select" data-action="status-change" data-id="${escapeHtml(task.id)}" aria-label="Đổi trạng thái công việc">
                            <option value="Todo" ${task.status === 'Todo' ? 'selected' : ''}>Todo</option>
                            <option value="In Progress" ${task.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                            <option value="Completed" ${task.status === 'Completed' ? 'selected' : ''}>Completed</option>
                        </select>
                    </div>
                </article>
            `;
        }).join('');
    }

    function renderAll() {
        renderStats();
        renderTasks();
    }

    /* ==========================================================================
       Modal Operations (Add / Edit / Delete)
       ========================================================================== */
    function clearValidationErrors() {
        dom.titleError.classList.add('hidden');
        dom.dateError.classList.add('hidden');
        if (dom.timeError) dom.timeError.classList.add('hidden');
    }

    function openAddModal() {
        state.editingTaskId = null;
        dom.modalTitle.textContent = 'Thêm công việc mới';
        dom.taskForm.reset();
        dom.taskId.value = '';
        dom.taskDueDate.value = getTodayDateString();
        dom.taskDueTime.value = '23:59';
        dom.taskReminder.value = '-1';
        dom.taskPriority.value = 'Medium';
        dom.taskStatus.value = 'Todo';
        clearValidationErrors();

        dom.taskModal.classList.remove('hidden');
        setTimeout(() => dom.taskTitle.focus(), 50);
    }

    function openEditModal(id) {
        const task = state.tasks.find(t => t.id === id);
        if (!task) return;

        state.editingTaskId = task.id;
        dom.modalTitle.textContent = 'Chỉnh sửa công việc';
        dom.taskId.value = task.id;
        dom.taskTitle.value = task.title;
        dom.taskDescription.value = task.description || '';
        dom.taskDueDate.value = task.dueDate || getTodayDateString();
        dom.taskDueTime.value = isValidTimeString(task.dueTime) ? task.dueTime : '23:59';
        const offsetVal = VALID_REMIND_OFFSETS.includes(Number(task.remindOffset)) ? String(task.remindOffset) : '-1';
        dom.taskReminder.value = offsetVal;
        dom.taskPriority.value = task.priority || 'Medium';
        dom.taskStatus.value = task.status || 'Todo';
        clearValidationErrors();

        dom.taskModal.classList.remove('hidden');
        setTimeout(() => dom.taskTitle.focus(), 50);
    }

    function closeTaskModal() {
        dom.taskModal.classList.add('hidden');
        state.editingTaskId = null;
    }

    function handleTaskFormSubmit(e) {
        e.preventDefault();
        clearValidationErrors();

        const title = dom.taskTitle.value.trim();
        const description = dom.taskDescription.value.trim();
        const dueDate = dom.taskDueDate.value;
        const dueTime = dom.taskDueTime.value;
        const parsedRemindOffset = Number(dom.taskReminder.value);
        const remindOffset = VALID_REMIND_OFFSETS.includes(parsedRemindOffset) ? parsedRemindOffset : -1;
        const priority = dom.taskPriority.value;
        const status = dom.taskStatus.value;

        let isValid = true;
        if (!title) {
            dom.titleError.classList.remove('hidden');
            isValid = false;
        }
        if (!isValidDateString(dueDate)) {
            dom.dateError.classList.remove('hidden');
            isValid = false;
        }
        if (!isValidTimeString(dueTime)) {
            if (dom.timeError) dom.timeError.classList.remove('hidden');
            isValid = false;
        }
        if (!isValid) return;

        const safePriority = VALID_PRIORITIES.includes(priority) ? priority : 'Medium';
        const safeStatus = VALID_STATUSES.includes(status) ? status : 'Todo';

        if (state.editingTaskId) {
            const idx = state.tasks.findIndex(t => t.id === state.editingTaskId);
            if (idx !== -1) {
                const prev = state.tasks[idx];
                const scheduleChanged = (
                    prev.dueDate !== dueDate ||
                    prev.dueTime !== dueTime ||
                    prev.remindOffset !== remindOffset
                );
                state.tasks[idx] = {
                    ...prev,
                    title,
                    description,
                    dueDate,
                    dueTime,
                    remindOffset,
                    notifiedForKey: scheduleChanged ? null : (prev.notifiedForKey || null),
                    priority: safePriority,
                    status: safeStatus,
                    updatedAt: Date.now()
                };
                showToast('Đã cập nhật công việc thành công!');
            }
        } else {
            const newTask = {
                id: generateId(),
                title,
                description,
                dueDate,
                dueTime,
                remindOffset,
                notifiedForKey: null,
                priority: safePriority,
                status: safeStatus,
                createdAt: Date.now()
            };
            state.tasks.unshift(newTask);
            showToast('Đã thêm công việc mới!');
        }

        saveTasks();
        renderAll();
        checkReminders();
        closeTaskModal();
    }

    function openDeleteModal(id) {
        const task = state.tasks.find(t => t.id === id);
        if (!task) return;

        state.deletingTaskId = task.id;
        dom.deleteTaskName.textContent = `"${task.title}"`;
        dom.deleteModal.classList.remove('hidden');
    }

    function closeDeleteModal() {
        dom.deleteModal.classList.add('hidden');
        state.deletingTaskId = null;
    }

    function confirmDeleteTask() {
        if (!state.deletingTaskId) return;
        state.tasks = state.tasks.filter(t => t.id !== state.deletingTaskId);
        saveTasks();
        renderAll();
        closeDeleteModal();
        showToast('Đã xóa công việc.', 'danger');
    }

    function updateTaskStatusQuick(id, newStatus) {
        const task = state.tasks.find(t => t.id === id);
        if (!task || !VALID_STATUSES.includes(newStatus)) return;
        task.status = newStatus;
        task.updatedAt = Date.now();
        saveTasks();
        renderAll();
        showToast(`Đã chuyển trạng thái sang "${newStatus}"`);
    }

    function openRestoreModal() {
        dom.restoreModal.classList.remove('hidden');
    }

    function closeRestoreModal() {
        dom.restoreModal.classList.add('hidden');
    }

    function confirmRestoreSample() {
        state.tasks = getSampleTasks();
        saveTasks();
        resetAllFilters();
        renderAll();
        closeRestoreModal();
        showToast('Đã khôi phục dữ liệu mẫu!');
    }

    function resetAllFilters() {
        state.filters.search = '';
        state.filters.status = 'all';
        state.filters.priority = 'all';
        state.filters.sortBy = 'dueDateAsc';

        dom.searchInput.value = '';
        dom.priorityFilter.value = 'all';
        dom.sortBy.value = 'dueDateAsc';

        const tabs = dom.statusFilterTabs.querySelectorAll('.tab-btn');
        tabs.forEach(btn => {
            const isAll = btn.dataset.status === 'all';
            btn.classList.toggle('active', isAll);
            btn.setAttribute('aria-selected', isAll ? 'true' : 'false');
        });

        renderTasks();
    }

    /* ==========================================================================
       In-App & Browser Notifications (While Website Is Open)
       ========================================================================== */
    function updateNotifyButtonState() {
        if (!dom.notifyToggleBtn) return;
        if (!('Notification' in window)) {
            dom.notifyToggleBtn.classList.remove('is-active', 'is-denied');
            dom.notifyToggleBtn.title = 'Trình duyệt không hỗ trợ Notification API';
            return;
        }
        const perm = Notification.permission;
        dom.notifyToggleBtn.classList.toggle('is-active', perm === 'granted');
        dom.notifyToggleBtn.classList.toggle('is-denied', perm === 'denied');
        if (perm === 'granted') {
            dom.notifyToggleBtn.title = 'Thông báo nhắc nhở đang BẬT (khi mở trang)';
            dom.notifyToggleBtn.setAttribute('aria-label', 'Thông báo nhắc nhở đang bật');
        } else if (perm === 'denied') {
            dom.notifyToggleBtn.title = 'Quyền thông báo đã bị từ chối trong trình duyệt';
            dom.notifyToggleBtn.setAttribute('aria-label', 'Quyền thông báo đã bị từ chối');
        } else {
            dom.notifyToggleBtn.title = 'Bấm để bật thông báo nhắc nhở khi đang mở web';
            dom.notifyToggleBtn.setAttribute('aria-label', 'Bật thông báo nhắc nhở');
        }
    }

    function requestNotificationPermission() {
        if (!('Notification' in window)) {
            showToast('Trình duyệt của bạn không hỗ trợ thông báo hệ thống. Ứng dụng vẫn hiển thị nhắc nhở trực tiếp trên trang.');
            return;
        }
        if (Notification.permission === 'granted') {
            showToast('Thông báo nhắc nhở đã được bật sẵn!');
            updateNotifyButtonState();
            return;
        }
        if (Notification.permission === 'denied') {
            showToast('Bạn đã chặn quyền thông báo. Ứng dụng vẫn hoạt động và nhắc nhở trực tiếp trên trang.', 'danger');
            updateNotifyButtonState();
            return;
        }

        Notification.requestPermission().then(permission => {
            updateNotifyButtonState();
            if (permission === 'granted') {
                showToast('Đã bật thông báo nhắc nhở thành công!');
                checkReminders();
            } else {
                showToast('Chưa cấp quyền thông báo trình duyệt. Ứng dụng vẫn nhắc nhở trên giao diện web.');
            }
        }).catch(() => {
            updateNotifyButtonState();
        });
    }

    function triggerTaskReminder(task) {
        const displayDue = formatDisplayDate(task.dueDate, task.dueTime);
        const offsetDesc = REMINDER_LABELS[String(task.remindOffset)] || 'Đến hạn';
        const message = `Nhắc nhở (${offsetDesc}): "${task.title}" — Hạn: ${displayDue}`;

        showToast(message);

        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                new Notification(`TaskFlow — ${task.title}`, {
                    body: `Hạn chót: ${displayDue} (${offsetDesc})`,
                    tag: `taskflow_remind_${task.id}_${buildReminderKey(task.dueDate, task.dueTime, task.remindOffset)}`
                });
            } catch (err) {
                console.warn('Không thể khởi tạo Notification:', err);
            }
        }
    }

    function checkReminders() {
        const nowMs = Date.now();
        let hasNotifiedChanges = false;

        state.tasks.forEach(task => {
            if (!task || task.status === 'Completed') return;
            if (typeof task.remindOffset !== 'number' || task.remindOffset < 0) return;

            const dueMs = getTaskDueTimestamp(task.dueDate, task.dueTime);
            if (dueMs === null) return;

            const remindAtMs = dueMs - task.remindOffset * 60000;
            const currentKey = buildReminderKey(task.dueDate, task.dueTime, task.remindOffset);

            if (nowMs >= remindAtMs && task.notifiedForKey !== currentKey) {
                task.notifiedForKey = currentKey;
                hasNotifiedChanges = true;
                triggerTaskReminder(task);
            }
        });

        if (hasNotifiedChanges) {
            saveTasks();
        }

        // Refresh stats and due badges so tasks crossing their deadline immediately show Overdue
        renderAll();
    }

    function startReminderLoop() {
        if (state.reminderTimerId) {
            clearInterval(state.reminderTimerId);
        }
        state.reminderTimerId = setInterval(checkReminders, 15000);
    }

    /* ==========================================================================
       Event Listeners Binding
       ========================================================================== */
    function bindEvents() {
        // Notification permission toggle (only on explicit user click)
        if (dom.notifyToggleBtn) {
            dom.notifyToggleBtn.addEventListener('click', requestNotificationPermission);
        }

        // Theme toggle
        dom.themeToggleBtn.addEventListener('click', toggleTheme);

        // Open Add Modal
        dom.openAddModalBtn.addEventListener('click', openAddModal);
        dom.emptyAddBtn.addEventListener('click', openAddModal);

        // Close Add/Edit Modal
        dom.closeModalBtn.addEventListener('click', closeTaskModal);
        dom.cancelModalBtn.addEventListener('click', closeTaskModal);
        dom.taskModal.addEventListener('click', (e) => {
            if (e.target === dom.taskModal) closeTaskModal();
        });

        // Submit Form
        dom.taskForm.addEventListener('submit', handleTaskFormSubmit);

        // Delete Modal
        dom.closeDeleteModalBtn.addEventListener('click', closeDeleteModal);
        dom.cancelDeleteBtn.addEventListener('click', closeDeleteModal);
        dom.confirmDeleteBtn.addEventListener('click', confirmDeleteTask);
        dom.deleteModal.addEventListener('click', (e) => {
            if (e.target === dom.deleteModal) closeDeleteModal();
        });

        // Escape key closes active modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (!dom.taskModal.classList.contains('hidden')) closeTaskModal();
                if (!dom.deleteModal.classList.contains('hidden')) closeDeleteModal();
                if (!dom.restoreModal.classList.contains('hidden')) closeRestoreModal();
            }
        });

        // Search input
        dom.searchInput.addEventListener('input', (e) => {
            state.filters.search = e.target.value;
            renderTasks();
        });

        dom.clearSearchBtn.addEventListener('click', () => {
            state.filters.search = '';
            dom.searchInput.value = '';
            renderTasks();
            dom.searchInput.focus();
        });

        // Status Tabs Filter
        dom.statusFilterTabs.addEventListener('click', (e) => {
            const btn = e.target.closest('.tab-btn');
            if (!btn) return;

            const status = btn.dataset.status;
            state.filters.status = status;

            dom.statusFilterTabs.querySelectorAll('.tab-btn').forEach(tab => {
                const active = tab === btn;
                tab.classList.toggle('active', active);
                tab.setAttribute('aria-selected', active ? 'true' : 'false');
            });

            renderTasks();
        });

        // Priority Filter
        dom.priorityFilter.addEventListener('change', (e) => {
            state.filters.priority = e.target.value;
            renderTasks();
        });

        // Sort By
        dom.sortBy.addEventListener('change', (e) => {
            state.filters.sortBy = e.target.value;
            renderTasks();
        });

        // Reset Filters
        dom.resetFiltersBtn.addEventListener('click', resetAllFilters);

        // Task Card Actions Delegation (Edit, Delete, Quick Status Change)
        dom.tasksContainer.addEventListener('click', (e) => {
            const actionBtn = e.target.closest('[data-action]');
            if (!actionBtn) return;

            const action = actionBtn.dataset.action;
            const id = actionBtn.dataset.id;

            if (action === 'edit') {
                openEditModal(id);
            } else if (action === 'delete') {
                openDeleteModal(id);
            }
        });

        dom.tasksContainer.addEventListener('change', (e) => {
            const select = e.target.closest('[data-action="status-change"]');
            if (!select) return;
            updateTaskStatusQuick(select.dataset.id, select.value);
        });

        // Restore Sample Data Modal
        dom.restoreSampleBtn.addEventListener('click', openRestoreModal);
        dom.closeRestoreModalBtn.addEventListener('click', closeRestoreModal);
        dom.cancelRestoreBtn.addEventListener('click', closeRestoreModal);
        dom.confirmRestoreBtn.addEventListener('click', confirmRestoreSample);
        dom.restoreModal.addEventListener('click', (e) => {
            if (e.target === dom.restoreModal) closeRestoreModal();
        });
    }

    /* ==========================================================================
       Bootstrap Application
       ========================================================================== */
    function init() {
        initTheme();
        loadTasks();
        updateNotifyButtonState();
        bindEvents();
        renderAll();
        checkReminders();
        startReminderLoop();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

