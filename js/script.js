// ---------- elements ----------
const form = document.getElementById("transaction-form");
const typeInput = document.getElementById("transaction-type");
const amountInput = document.getElementById("amount");
const categoryInput = document.getElementById("category");
const dateInput = document.getElementById("date");
const descInput = document.getElementById("description");

const submitBtn = document.getElementById("submit-button");
const cancelBtn = document.getElementById("cancel-edit-button");
const formMessage = document.getElementById("form-message");

const list = document.getElementById("transaction-list");
const emptyState = document.getElementById("empty-state");

const totalIncomeEl = document.getElementById("total-income");
const totalExpensesEl = document.getElementById("total-expenses");
const balanceEl = document.getElementById("current-balance");

const typeFilter = document.getElementById("type-filter");
const categoryFilter = document.getElementById("category-filter");

const summaryMonth = document.getElementById("summary-month");
const monthIncomeEl = document.getElementById("monthly-income");
const monthExpensesEl = document.getElementById("monthly-expenses");
const monthBalanceEl = document.getElementById("monthly-balance");

const chartCanvas = document.getElementById("expense-chart");
const chartEmpty = document.getElementById("chart-empty-state");

// ---------- state ----------
const STORAGE_KEY = "expenseTrackerTransactions";
let transactions = [];
let editingId = null;

// default the form to today and the summary to this month
const todayStr = new Date().toISOString().split("T")[0];
dateInput.value = todayStr;
summaryMonth.value = todayStr.slice(0, 7);

// ---------- storage ----------
function loadTransactions() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
        transactions = JSON.parse(saved);
    } catch (err) {
        console.error("Couldn't read saved transactions:", err);
        transactions = [];
    }
}

function saveTransactions() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

// ---------- helpers ----------
function formatCurrency(amount) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2
    }).format(amount);
}

function formatDate(dateString) {
    const d = new Date(dateString + "T00:00:00");
    return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function escapeHTML(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function showMessage(text, type) {
    formMessage.textContent = text;
    formMessage.className = "form-message " + type;

    setTimeout(() => {
        formMessage.textContent = "";
        formMessage.className = "form-message";
    }, 3000);
}

// refresh everything on screen after the data changes
function refreshUI() {
    filterTransactions();
    updateTotals();
    updateMonthlySummary();
    updateExpenseChart();
}

// ---------- form reading + validation ----------
// returns the cleaned-up values, or null if something is wrong
function getFormData() {
    const type = typeInput.value;
    const amount = parseFloat(amountInput.value);
    const category = categoryInput.value;
    const date = dateInput.value;
    const description = descInput.value.trim();

    if (!type) {
        showMessage("Please select a transaction type.", "error");
        return null;
    }
    if (isNaN(amount) || amount <= 0) {
        showMessage("Please enter a valid amount greater than 0.", "error");
        return null;
    }
    if (!category) {
        showMessage("Please select a category.", "error");
        return null;
    }
    if (!date) {
        showMessage("Please select a date.", "error");
        return null;
    }
    if (!description) {
        showMessage("Please enter a description.", "error");
        return null;
    }

    return { type, amount, category, date, description };
}

// ---------- showing the list ----------
function displayTransactions(data = transactions) {
    // clear out whatever was there before
    list.querySelectorAll(".transaction-item").forEach(item => item.remove());

    if (data.length === 0) {
        emptyState.style.display = "block";
        return;
    }
    emptyState.style.display = "none";

    data.forEach(t => {
        const item = document.createElement("div");
        item.className = "transaction-item";

        const info = document.createElement("div");
        info.innerHTML = `
            <div class="transaction-description">${escapeHTML(t.description)}</div>
            <div class="transaction-type">${t.type === "income" ? "Income" : "Expense"}</div>
        `;

        const category = document.createElement("div");
        category.className = "transaction-category";
        category.textContent = t.category;

        const date = document.createElement("div");
        date.className = "transaction-date";
        date.textContent = formatDate(t.date);

        const amount = document.createElement("div");
        amount.className = "transaction-amount " + t.type;
        const sign = t.type === "income" ? "+" : "-";
        amount.textContent = sign + " " + formatCurrency(t.amount);

        const actions = document.createElement("div");
        actions.className = "transaction-actions";

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "edit-button";
        editBtn.textContent = "Edit";
        editBtn.addEventListener("click", () => editTransaction(t.id));

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "delete-button";
        deleteBtn.textContent = "Delete";
        deleteBtn.addEventListener("click", () => deleteTransaction(t.id));

        actions.append(editBtn, deleteBtn);
        item.append(info, category, date, amount, actions);
        list.appendChild(item);
    });
}

// ---------- totals ----------
// adds up income and expenses, optionally only for one month (YYYY-MM)
function sumTransactions(month) {
    let income = 0;
    let expenses = 0;

    transactions.forEach(t => {
        if (month && t.date.slice(0, 7) !== month) return;

        if (t.type === "income") income += t.amount;
        else if (t.type === "expense") expenses += t.amount;
    });

    return { income, expenses, balance: income - expenses };
}

function updateTotals() {
    const { income, expenses, balance } = sumTransactions();

    totalIncomeEl.textContent = formatCurrency(income);
    totalExpensesEl.textContent = formatCurrency(expenses);
    balanceEl.textContent = formatCurrency(balance);
}

function updateMonthlySummary() {
    const month = summaryMonth.value;
    if (!month) return;

    const { income, expenses, balance } = sumTransactions(month);

    monthIncomeEl.textContent = formatCurrency(income);
    monthExpensesEl.textContent = formatCurrency(expenses);
    monthBalanceEl.textContent = formatCurrency(balance);
}

// ---------- chart ----------
function updateExpenseChart() {
    const month = summaryMonth.value;
    if (!month) return;

    // total up expenses per category for the chosen month
    const totals = {};
    transactions.forEach(t => {
        if (t.type !== "expense") return;
        if (t.date.slice(0, 7) !== month) return;

        totals[t.category] = (totals[t.category] || 0) + t.amount;
    });

    const chartData = Object.entries(totals);

    if (chartData.length === 0) {
        chartCanvas.getContext("2d").clearRect(0, 0, chartCanvas.width, chartCanvas.height);
        chartCanvas.style.display = "none";
        chartEmpty.style.display = "block";
        return;
    }

    chartCanvas.style.display = "block";
    chartEmpty.style.display = "none";
    drawBarChart(chartData);
}

function drawBarChart(chartData) {
    const ctx = chartCanvas.getContext("2d");

    // match the canvas resolution to how big it's actually shown
    const width = chartCanvas.clientWidth;
    const height = chartCanvas.clientHeight;
    chartCanvas.width = width;
    chartCanvas.height = height;
    ctx.clearRect(0, 0, width, height);

    const leftPad = 110;
    const rightPad = 40;
    const topPad = 30;
    const rowHeight = 45;
    const barHeight = 24;
    const chartWidth = width - leftPad - rightPad;

    const maxValue = Math.max(...chartData.map(item => item[1]));

    chartData.forEach(([category, amount], i) => {
        const y = topPad + i * rowHeight;
        const midY = y + barHeight / 2;

        // category label
        ctx.fillStyle = "#374151";
        ctx.font = "14px Arial";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(category, leftPad - 12, midY);

        // grey track behind the bar
        ctx.fillStyle = "#e5e7eb";
        ctx.fillRect(leftPad, y, chartWidth, barHeight);

        // the actual bar
        const barWidth = (amount / maxValue) * chartWidth;
        ctx.fillStyle = "#4f46e5";
        ctx.fillRect(leftPad, y, barWidth, barHeight);

        // amount text - goes inside the bar if it would run off the canvas
        const text = formatCurrency(amount);
        ctx.font = "13px Arial";
        const textWidth = ctx.measureText(text).width;
        const textX = leftPad + barWidth + 8;

        if (textX + textWidth > width - 10) {
            ctx.fillStyle = "#ffffff";
            ctx.textAlign = "right";
            ctx.fillText(text, leftPad + barWidth - 8, midY);
        } else {
            ctx.fillStyle = "#1f2937";
            ctx.textAlign = "left";
            ctx.fillText(text, textX, midY);
        }
    });
}

// ---------- add / edit / delete ----------
function addTransaction() {
    const data = getFormData();
    if (!data) return;

    transactions.push({ id: Date.now(), ...data });

    saveTransactions();
    refreshUI();

    form.reset();
    dateInput.value = todayStr;

    showMessage("Transaction added successfully.", "success");
}

function editTransaction(id) {
    const t = transactions.find(t => t.id === id);
    if (!t) return;

    // put the old values back into the form
    typeInput.value = t.type;
    amountInput.value = t.amount;
    categoryInput.value = t.category;
    dateInput.value = t.date;
    descInput.value = t.description;

    editingId = id;
    submitBtn.textContent = "Update Transaction";
    cancelBtn.classList.remove("hidden");

    form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateTransaction() {
    const data = getFormData();
    if (!data) return;

    const index = transactions.findIndex(t => t.id === editingId);
    if (index === -1) {
        showMessage("Transaction could not be found.", "error");
        return;
    }

    transactions[index] = { ...transactions[index], ...data };

    saveTransactions();
    refreshUI();
    resetEditMode();

    showMessage("Transaction updated successfully.", "success");
}

function deleteTransaction(id) {
    if (!confirm("Are you sure you want to delete this transaction?")) return;

    transactions = transactions.filter(t => t.id !== id);

    saveTransactions();
    refreshUI();

    showMessage("Transaction deleted successfully.", "success");
}

function resetEditMode() {
    editingId = null;
    submitBtn.textContent = "Add Transaction";
    cancelBtn.classList.add("hidden");
    form.reset();
    dateInput.value = todayStr;
}

// ---------- filtering ----------
function filterTransactions() {
    const type = typeFilter.value;
    const category = categoryFilter.value;

    const filtered = transactions.filter(t => {
        const typeOk = type === "all" || t.type === type;
        const categoryOk = category === "all" || t.category === category;
        return typeOk && categoryOk;
    });

    displayTransactions(filtered);
}

// ---------- events ----------
form.addEventListener("submit", e => {
    e.preventDefault();

    if (editingId !== null) {
        updateTransaction();
    } else {
        addTransaction();
    }
});

cancelBtn.addEventListener("click", () => {
    resetEditMode();
    showMessage("Changes discarded.", "success");
});

summaryMonth.addEventListener("change", () => {
    updateMonthlySummary();
    updateExpenseChart();
});

typeFilter.addEventListener("change", filterTransactions);
categoryFilter.addEventListener("change", filterTransactions);

// ---------- start ----------
loadTransactions();
refreshUI();