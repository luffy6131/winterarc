/**
 * Winter Arc Ultimate Habit Tracker & Data Analytics
 * State Management, Local Storage Persistence, Supabase Auth + Cloud DB Sync & Chart.js Integration
 */

// Default Application State Structure
let appData = {
  userName: "Warrior Protocol",
  userMotto: "Discipline over motivation. Complete the 31-day arc.",
  theme: "arctic",
  xp: 0,
  currentDay: 1,
  habits: [
    { id: "h1", name: "Workout / Training", goal: "60 Min" },
    { id: "h2", name: "10k Daily Steps", goal: "10,000" },
    { id: "h3", name: "Read 20 Pages", goal: "20 pgs" },
    { id: "h4", name: "Cold Shower", goal: "Daily" },
    { id: "h5", name: "No Sugar / Junk", goal: "Strict" },
    { id: "h6", name: "Deep Work 4h", goal: "4 Hours" }
  ],
  habitLogs: {},  // Key: `${habitId}-${day}` => boolean
  sleepLogs: {},  // Key: `${day}` => { hours: number, quality: number }
  reflections: {
    w1: { wins: "", losses: "", score: 8 },
    w2: { wins: "", losses: "", score: 8 },
    w3: { wins: "", losses: "", score: 8 },
    w4: { wins: "", losses: "", score: 8 },
    monthly: { transformation: "" }
  }
};

// Warrior Ranks Configuration
const RANKS = [
  { title: "Frost Initiate", minXp: 0, maxXp: 150 },
  { title: "Cold Apprentice", minXp: 150, maxXp: 450 },
  { title: "Iron Will", minXp: 450, maxXp: 900 },
  { title: "Disciplined Arc", minXp: 900, maxXp: 1500 },
  { title: "Shadow Warrior", minXp: 1500, maxXp: 2200 },
  { title: "Blizzard Master", minXp: 2200, maxXp: 3000 },
  { title: "Arc Conqueror", minXp: 3000, maxXp: 99999 }
];

// Chart Instances Store
let chartInstances = {};

// Supabase State Variables
let supabaseUrl = localStorage.getItem("winterArc_sb_url") || "https://iwkdiglbtufiudxadmcq.supabase.co";
let supabaseAnonKey = localStorage.getItem("winterArc_sb_key") || "";
let supabaseClient = null;
let currentUser = null;

// ============================================================================
// INITIALIZATION & STATE PERSISTENCE
// ============================================================================

document.addEventListener("DOMContentLoaded", () => {
  loadState();
  initDaySelectors();
  applyTheme(appData.theme || "arctic");
  updateRankUI();
  renderDashboard();
  renderMatrixTable();
  renderReflections();
  initSupabase();

  // Set report date string
  const dateStrElement = document.getElementById("report-date-str");
  if(dateStrElement) {
    dateStrElement.innerText = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
});

function saveState(autoCloudSync = true) {
  try {
    localStorage.setItem("winterArcData", JSON.stringify(appData));
  } catch (e) {
    console.error("Failed to save state to localStorage", e);
  }

  if (autoCloudSync && supabaseClient && currentUser) {
    syncAllToSupabase();
  }
}

function loadState() {
  try {
    const saved = localStorage.getItem("winterArcData");
    if (saved) {
      const parsed = JSON.parse(saved);
      appData = { ...appData, ...parsed };
      if (!appData.habits || appData.habits.length === 0) {
        appData.habits = [
          { id: "h1", name: "Workout / Training", goal: "60 Min" },
          { id: "h2", name: "10k Daily Steps", goal: "10,000" },
          { id: "h3", name: "Read 20 Pages", goal: "20 pgs" },
          { id: "h4", name: "Cold Shower", goal: "Daily" },
          { id: "h5", name: "No Sugar / Junk", goal: "Strict" },
          { id: "h6", name: "Deep Work 4h", goal: "4 Hours" }
        ];
      }
    }
  } catch (e) {
    console.error("Error loading localStorage state:", e);
  }

  const nameInput = document.getElementById("user-name-input");
  const mottoInput = document.getElementById("user-motto-input");
  if(nameInput) nameInput.value = appData.userName || "Warrior Protocol";
  if(mottoInput) mottoInput.value = appData.userMotto || "Discipline over motivation. Complete the 31-day arc.";
}

function saveUserProfile() {
  const nameInput = document.getElementById("user-name-input");
  const mottoInput = document.getElementById("user-motto-input");
  if(nameInput) appData.userName = nameInput.value || "Warrior Protocol";
  if(mottoInput) appData.userMotto = mottoInput.value || "Discipline over motivation. Complete the 31-day arc.";
  saveState();
  showToast("Profile details updated!");
}

// ============================================================================
// SUPABASE AUTHENTICATION & CLOUD SYNC
// ============================================================================

function initSupabase() {
  const urlInput = document.getElementById("sb-url-input");
  const keyInput = document.getElementById("sb-key-input");
  if (urlInput) urlInput.value = supabaseUrl;
  if (keyInput) keyInput.value = supabaseAnonKey;

  if (window.supabase && supabaseUrl && supabaseAnonKey) {
    try {
      supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
      
      supabaseClient.auth.onAuthStateChange((event, session) => {
        currentUser = session ? session.user : null;
        updateAuthUI();
        if (currentUser) {
          fetchFromSupabase();
        }
      });

      supabaseClient.auth.getSession().then(({ data }) => {
        if (data && data.session) {
          currentUser = data.session.user;
          updateAuthUI();
          fetchFromSupabase();
        }
      });
    } catch (e) {
      console.error("Supabase client init error:", e);
      updateAuthUI();
    }
  } else {
    updateAuthUI();
  }
}

function saveSupabaseConfig() {
  const urlInput = document.getElementById("sb-url-input");
  const keyInput = document.getElementById("sb-key-input");

  supabaseUrl = urlInput ? urlInput.value.trim() : "";
  supabaseAnonKey = keyInput ? keyInput.value.trim() : "";

  localStorage.setItem("winterArc_sb_url", supabaseUrl);
  localStorage.setItem("winterArc_sb_key", supabaseAnonKey);

  initSupabase();
  showToast("Supabase credentials saved!");
  switchAuthTab('login');
}

function updateAuthUI() {
  const btnLabel = document.getElementById("auth-btn-label");
  const loggedOutSec = document.getElementById("logged-out-section");
  const loggedInSec = document.getElementById("logged-in-section");
  const userEmailDisplay = document.getElementById("user-email-display");
  const cloudBadge = document.getElementById("cloud-status-badge");

  if (currentUser) {
    if (btnLabel) btnLabel.innerText = currentUser.email ? currentUser.email.split("@")[0] : "Synced";
    if (loggedOutSec) loggedOutSec.classList.add("hidden");
    if (loggedInSec) loggedInSec.classList.remove("hidden");
    if (userEmailDisplay) userEmailDisplay.innerText = currentUser.email || "Authenticated User";
    if (cloudBadge) {
      cloudBadge.innerText = "☁️ Cloud Synced";
      cloudBadge.className = "text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 font-bold";
    }
  } else {
    if (btnLabel) btnLabel.innerText = "Sync Cloud";
    if (loggedOutSec) loggedOutSec.classList.remove("hidden");
    if (loggedInSec) loggedInSec.classList.add("hidden");
    if (cloudBadge) {
      cloudBadge.innerText = "💾 Local Mode";
      cloudBadge.className = "text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700";
    }
  }
}

async function signInWithEmail() {
  if (!supabaseClient) {
    alert("Please configure Supabase URL & Anon Key under Supabase Config tab first.");
    switchAuthTab('config');
    return;
  }
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;
  if (!email || !password) {
    alert("Please enter both email and password.");
    return;
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    alert("Login failed: " + error.message);
  } else {
    showToast("Signed in successfully!");
    closeAuthModal();
  }
}

async function signUpWithEmail() {
  if (!supabaseClient) {
    alert("Please configure Supabase URL & Anon Key under Supabase Config tab first.");
    switchAuthTab('config');
    return;
  }
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;
  if (!email || !password) {
    alert("Please enter both email and password.");
    return;
  }

  const { data, error } = await supabaseClient.auth.signUp({ email, password });
  if (error) {
    alert("Sign up failed: " + error.message);
  } else {
    showToast("Account created! Check your email to confirm.");
  }
}

async function signInWithGoogle() {
  if (!supabaseClient) {
    alert("Please configure Supabase URL & Anon Key under Supabase Config tab first.");
    switchAuthTab('config');
    return;
  }
  const { data, error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href }
  });
  if (error) {
    alert("Google OAuth failed: " + error.message);
  }
}

async function signOutUser() {
  if (supabaseClient) {
    await supabaseClient.auth.signOut();
    currentUser = null;
    updateAuthUI();
    showToast("Signed out. Operating in local mode.");
  }
}

async function syncAllToSupabase() {
  if (!supabaseClient || !currentUser) return;

  try {
    const payload = {
      user_id: currentUser.id,
      state_data: appData,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabaseClient
      .from("winter_arc_userdata")
      .upsert(payload, { onConflict: "user_id" });

    if (error) {
      console.warn("Supabase Cloud sync warning:", error.message);
    } else {
      showToast("Cloud synced to Supabase!");
    }
  } catch (e) {
    console.error("Supabase sync exception:", e);
  }
}

async function fetchFromSupabase() {
  if (!supabaseClient || !currentUser) return;

  try {
    const { data, error } = await supabaseClient
      .from("winter_arc_userdata")
      .select("state_data")
      .eq("user_id", currentUser.id)
      .single();

    if (data && data.state_data) {
      appData = { ...appData, ...data.state_data };
      saveState(false);
      applyTheme(appData.theme || "arctic");
      renderDashboard();
      renderMatrixTable();
      renderReflections();
      showToast("Cloud data loaded from Supabase!");
    }
  } catch (e) {
    console.error("Fetch from Supabase exception:", e);
  }
}

function openAuthModal() {
  const modal = document.getElementById("modal-auth");
  if (modal) modal.classList.remove("hidden");
}

function closeAuthModal() {
  const modal = document.getElementById("modal-auth");
  if (modal) modal.classList.add("hidden");
}

function switchAuthTab(tabName) {
  const loginView = document.getElementById("authview-login");
  const configView = document.getElementById("authview-config");
  const loginTab = document.getElementById("authtab-login");
  const configTab = document.getElementById("authtab-config");

  if (tabName === 'login') {
    if (loginView) loginView.classList.remove("hidden");
    if (configView) configView.classList.add("hidden");
    if (loginTab) loginTab.className = "px-4 py-2 font-bold text-emerald-400 border-b-2 border-emerald-400";
    if (configTab) configTab.className = "px-4 py-2 font-bold text-slate-400 border-b-2 border-transparent";
  } else {
    if (loginView) loginView.classList.add("hidden");
    if (configView) configView.classList.remove("hidden");
    if (loginTab) loginTab.className = "px-4 py-2 font-bold text-slate-400 border-b-2 border-transparent";
    if (configTab) configTab.className = "px-4 py-2 font-bold text-emerald-400 border-b-2 border-emerald-400";
  }
}

// ============================================================================
// THEME & VIEW NAVIGATION CONTROLLER
// ============================================================================

function applyTheme(themeName) {
  appData.theme = themeName;
  document.documentElement.setAttribute("data-theme", themeName);
  const selector = document.getElementById("theme-selector");
  if(selector) selector.value = themeName;
}

function changeTheme(themeName) {
  applyTheme(themeName);
  saveState();
  showToast(`Theme changed to ${themeName.toUpperCase()}`);
}

function switchView(viewName) {
  const views = ["dashboard", "habits", "analytics", "reflections", "report"];
  views.forEach(v => {
    const viewEl = document.getElementById(`view-${v}`);
    const tabBtn = document.getElementById(`tab-${v}`);
    if (viewEl) {
      if (v === viewName) {
        viewEl.classList.remove("hidden");
      } else {
        viewEl.classList.add("hidden");
      }
    }
    if (tabBtn) {
      if (v === viewName) {
        tabBtn.classList.add("active");
      } else {
        tabBtn.classList.remove("active");
      }
    }
  });

  if (viewName === "dashboard") {
    renderDashboard();
  } else if (viewName === "habits") {
    renderMatrixTable();
  } else if (viewName === "analytics") {
    renderAnalyticsCharts();
  } else if (viewName === "reflections") {
    renderReflections();
  } else if (viewName === "report") {
    renderReport();
  }
}

// ============================================================================
// WARRIOR RANK & XP CALCULATIONS
// ============================================================================

function getRankInfo(xp) {
  const currentXP = Math.max(0, xp);
  for (let i = 0; i < RANKS.length; i++) {
    if (currentXP >= RANKS[i].minXp && currentXP < RANKS[i].maxXp) {
      return {
        ...RANKS[i],
        level: i + 1,
        nextRank: RANKS[i + 1] ? RANKS[i + 1].title : "Max Rank"
      };
    }
  }
  return { title: "Arc Conqueror", minXp: 3000, maxXp: 99999, level: 7, nextRank: "Supreme Alpha" };
}

function updateRankUI() {
  const rank = getRankInfo(appData.xp);
  
  const headerRank = document.getElementById("header-rank-title");
  const headerXp = document.getElementById("header-xp-val");
  if(headerRank) headerRank.innerText = rank.title;
  if(headerXp) headerXp.innerText = `${appData.xp} XP`;

  const dashBadge = document.getElementById("dash-rank-badge");
  const xpText = document.getElementById("xp-progress-text");
  const xpBar = document.getElementById("xp-bar-fill");
  const totalXpEl = document.getElementById("dash-total-xp");

  if(dashBadge) dashBadge.innerHTML = `<i class="fa-solid fa-crown mr-1"></i> Lvl ${rank.level}: ${rank.title}`;
  if(totalXpEl) totalXpEl.innerText = appData.xp;

  const currentLevelXp = appData.xp - rank.minXp;
  const levelRange = rank.maxXp - rank.minXp;
  const percent = Math.min(100, Math.max(0, (currentLevelXp / levelRange) * 100));

  if(xpText) xpText.innerText = `${appData.xp} / ${rank.maxXp} XP (Next: ${rank.nextRank})`;
  if(xpBar) xpBar.style.width = `${percent}%`;
}

// ============================================================================
// DASHBOARD VIEW LOGIC
// ============================================================================

function initDaySelectors() {
  const dashSelect = document.getElementById("dash-day-select");
  if (!dashSelect) return;
  dashSelect.innerHTML = "";
  for (let d = 1; d <= 31; d++) {
    const opt = document.createElement("option");
    opt.value = d;
    opt.innerText = `Day ${d}`;
    if (d === appData.currentDay) opt.selected = true;
    dashSelect.appendChild(opt);
  }
}

function renderDashboardChecklist(day) {
  appData.currentDay = day || appData.currentDay || 1;
  const currentDayEl = document.getElementById("dash-current-day-num");
  if(currentDayEl) currentDayEl.innerText = appData.currentDay;

  const container = document.getElementById("dash-checklist-container");
  if (!container) return;

  container.innerHTML = "";

  if (appData.habits.length === 0) {
    container.innerHTML = `<div class="text-xs text-slate-400 italic">No habits configured yet. Add habits in the 31-Day Matrix tab!</div>`;
    return;
  }

  appData.habits.forEach(habit => {
    const logKey = `${habit.id}-${appData.currentDay}`;
    const isChecked = !!appData.habitLogs[logKey];

    const item = document.createElement("div");
    item.className = `flex items-center justify-between p-3 rounded-xl border transition-all ${
      isChecked ? "bg-cyan-500/10 border-cyan-500/40" : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
    }`;

    item.innerHTML = `
      <div class="flex items-center gap-3">
        <input type="checkbox" ${isChecked ? "checked" : ""} onchange="toggleHabitLog('${habit.id}', ${appData.currentDay}, this.checked)" class="matrix-checkbox">
        <div>
          <div class="text-xs font-bold ${isChecked ? "text-cyan-300 line-through opacity-80" : "text-white"}">${escapeHtml(habit.name)}</div>
          <div class="text-[10px] text-slate-400">Target: ${escapeHtml(habit.goal)}</div>
        </div>
      </div>
      <div class="text-xs font-extrabold ${isChecked ? "text-cyan-400" : "text-slate-500"}">
        ${isChecked ? "+15 XP" : "0 XP"}
      </div>
    `;
    container.appendChild(item);
  });

  const sleepData = appData.sleepLogs[appData.currentDay] || { hours: 0, quality: 0 };
  const hoursSelect = document.getElementById("dash-sleep-hours");
  if(hoursSelect) hoursSelect.value = sleepData.hours || 0;
  updateSleepStarsUI(sleepData.quality || 0);

  updateSummaryMetrics();
  renderMiniMatrix();
}

function saveDashSleep() {
  const day = appData.currentDay || 1;
  const hoursSelect = document.getElementById("dash-sleep-hours");
  const hours = parseFloat(hoursSelect ? hoursSelect.value : 0);
  
  if (!appData.sleepLogs[day]) {
    appData.sleepLogs[day] = { hours: 0, quality: 0 };
  }
  appData.sleepLogs[day].hours = hours;
  saveState();
  updateSummaryMetrics();
  showToast(`Day ${day} sleep logged: ${hours} hrs`);
}

function setDashSleepQuality(starRating) {
  const day = appData.currentDay || 1;
  if (!appData.sleepLogs[day]) {
    appData.sleepLogs[day] = { hours: 0, quality: 0 };
  }
  appData.sleepLogs[day].quality = starRating;
  updateSleepStarsUI(starRating);
  saveState();
  updateSummaryMetrics();
  showToast(`Day ${day} sleep quality rated ${starRating}/5 stars`);
}

function updateSleepStarsUI(quality) {
  const starsContainer = document.getElementById("dash-sleep-stars");
  if (!starsContainer) return;
  const stars = starsContainer.querySelectorAll(".star-btn");
  stars.forEach((star, index) => {
    if (index < quality) {
      star.classList.add("active");
    } else {
      star.classList.remove("active");
    }
  });
}

function renderMiniMatrix() {
  const container = document.getElementById("dash-mini-matrix");
  if (!container) return;
  container.innerHTML = "";

  for (let d = 1; d <= 31; d++) {
    let completedCount = 0;
    appData.habits.forEach(h => {
      if (appData.habitLogs[`${h.id}-${d}`]) completedCount++;
    });

    const totalHabits = appData.habits.length || 1;
    const ratio = completedCount / totalHabits;

    let bgClass = "bg-slate-800 border-slate-700 text-slate-500";
    if (ratio >= 0.8) {
      bgClass = "bg-cyan-500 border-cyan-400 text-slate-950 font-bold shadow-sm shadow-cyan-500/50";
    } else if (ratio > 0.4) {
      bgClass = "bg-cyan-800/60 border-cyan-600/60 text-cyan-300 font-bold";
    } else if (completedCount > 0) {
      bgClass = "bg-slate-700 border-slate-600 text-slate-300";
    }

    const tile = document.createElement("div");
    tile.className = `h-7 flex items-center justify-center rounded text-[10px] cursor-pointer transition-all border ${bgClass}`;
    tile.title = `Day ${d}: ${completedCount}/${totalHabits} completed`;
    tile.innerText = d;
    tile.onclick = () => {
      const select = document.getElementById("dash-day-select");
      if(select) select.value = d;
      renderDashboardChecklist(d);
    };
    container.appendChild(tile);
  }
}

function updateSummaryMetrics() {
  let totalCompletions = 0;
  let activeDaysSet = new Set();

  Object.keys(appData.habitLogs).forEach(key => {
    if (appData.habitLogs[key]) {
      totalCompletions++;
      const day = key.split("-")[1];
      activeDaysSet.add(day);
    }
  });

  const totalPossible = (appData.habits.length || 1) * 31;
  const completionRate = Math.round((totalCompletions / totalPossible) * 100);

  let totalSleepHours = 0;
  let sleepLoggedDays = 0;
  Object.keys(appData.sleepLogs).forEach(d => {
    if (appData.sleepLogs[d] && appData.sleepLogs[d].hours > 0) {
      totalSleepHours += appData.sleepLogs[d].hours;
      sleepLoggedDays++;
    }
  });
  const avgSleep = sleepLoggedDays > 0 ? (totalSleepHours / sleepLoggedDays).toFixed(1) : "0.0";

  let streak = 0;
  for (let d = 1; d <= 31; d++) {
    let dayCompleted = 0;
    appData.habits.forEach(h => {
      if (appData.habitLogs[`${h.id}-${d}`]) dayCompleted++;
    });
    if (dayCompleted >= Math.max(1, Math.floor(appData.habits.length * 0.5))) {
      streak++;
    } else {
      break;
    }
  }

  const streakVal = document.getElementById("dash-streak-val");
  const compVal = document.getElementById("dash-completion-val");
  const sleepVal = document.getElementById("dash-sleep-val");
  const daysLoggedVal = document.getElementById("dash-days-logged-count");

  if(streakVal) streakVal.innerText = `${streak} Days`;
  if(compVal) compVal.innerText = `${completionRate}%`;
  if(sleepVal) sleepVal.innerText = `${avgSleep} hrs`;
  if(daysLoggedVal) daysLoggedVal.innerText = `${activeDaysSet.size} / 31 Days`;

  updateRankUI();
}

function renderDashboard() {
  initDaySelectors();
  renderDashboardChecklist(appData.currentDay || 1);
}

// ============================================================================
// 31-DAY MATRIX TABLE LOGIC
// ============================================================================

function toggleHabitLog(habitId, day, isChecked) {
  const logKey = `${habitId}-${day}`;
  const prevChecked = !!appData.habitLogs[logKey];
  
  if (isChecked !== prevChecked) {
    appData.habitLogs[logKey] = isChecked;
    appData.xp += isChecked ? 15 : -15;
    if (appData.xp < 0) appData.xp = 0;
    saveState();
  }

  updateRankUI();
  updateSummaryMetrics();

  const dashView = document.getElementById("view-dashboard");
  if (dashView && !dashView.classList.contains("hidden")) {
    renderDashboardChecklist(appData.currentDay);
  }
}

function renderMatrixTable() {
  const tbody = document.getElementById("matrix-table-body");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (appData.habits.length === 0) {
    tbody.innerHTML = `<tr><td colspan="34" class="p-6 text-center text-xs text-slate-400">No habits added. Click "Add Custom Habit Slot" to start tracking!</td></tr>`;
    return;
  }

  appData.habits.forEach((habit, hIdx) => {
    const tr = document.createElement("tr");
    tr.className = "border-b border-slate-800/80 hover:bg-slate-900/40 transition-all text-xs";

    let html = `
      <td class="p-3 font-semibold sticky-col border-r border-slate-700/80">
        <div class="text-white font-bold">${escapeHtml(habit.name)}</div>
      </td>
      <td class="p-2 text-center text-[11px] text-slate-400 border-r border-slate-700/80">
        ${escapeHtml(habit.goal)}
      </td>
    `;

    for (let d = 1; d <= 31; d++) {
      const logKey = `${habit.id}-${d}`;
      const checked = !!appData.habitLogs[logKey];
      html += `
        <td class="p-2 text-center border-r border-slate-800 ${checked ? 'bg-cyan-500/10' : ''}">
          <input type="checkbox" ${checked ? "checked" : ""} onchange="toggleHabitLog('${habit.id}', ${d}, this.checked)" class="matrix-checkbox">
        </td>
      `;
    }

    html += `
      <td class="p-2 text-center">
        <button onclick="deleteHabit('${habit.id}')" title="Delete Habit Slot" class="text-slate-500 hover:text-rose-400 transition-colors">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    `;

    tr.innerHTML = html;
    tbody.appendChild(tr);
  });

  const sleepHoursTr = document.createElement("tr");
  sleepHoursTr.className = "bg-indigo-950/20 border-b border-indigo-900/40 text-xs font-semibold";
  let sleepHoursHtml = `
    <td class="p-3 sticky-col border-r border-slate-700/80 text-indigo-300 font-bold">
      <i class="fa-solid fa-bed mr-1.5"></i> Sleep Hours
    </td>
    <td class="p-2 text-center text-[11px] text-indigo-400 border-r border-slate-700/80">8 hrs</td>
  `;

  for (let d = 1; d <= 31; d++) {
    const sleepData = appData.sleepLogs[d] || { hours: 0, quality: 0 };
    sleepHoursHtml += `
      <td class="p-1 text-center border-r border-slate-800">
        <select onchange="updateMatrixSleep(${d}, 'hours', this.value)" class="sleep-select text-[10px]">
          <option value="0" ${sleepData.hours == 0 ? 'selected' : ''}>-</option>
          <option value="4" ${sleepData.hours == 4 ? 'selected' : ''}>4h</option>
          <option value="5" ${sleepData.hours == 5 ? 'selected' : ''}>5h</option>
          <option value="6" ${sleepData.hours == 6 ? 'selected' : ''}>6h</option>
          <option value="7" ${sleepData.hours == 7 ? 'selected' : ''}>7h</option>
          <option value="8" ${sleepData.hours == 8 ? 'selected' : ''}>8h</option>
          <option value="9" ${sleepData.hours == 9 ? 'selected' : ''}>9h+</option>
        </select>
      </td>
    `;
  }
  sleepHoursHtml += `<td class="p-2 text-center text-slate-600">-</td>`;
  sleepHoursTr.innerHTML = sleepHoursHtml;
  tbody.appendChild(sleepHoursTr);

  const sleepQualTr = document.createElement("tr");
  sleepQualTr.className = "bg-indigo-950/10 border-b border-indigo-900/40 text-xs";
  let sleepQualHtml = `
    <td class="p-3 sticky-col border-r border-slate-700/80 text-amber-300 font-bold">
      <i class="fa-solid fa-star mr-1.5"></i> Sleep Quality
    </td>
    <td class="p-2 text-center text-[11px] text-amber-400 border-r border-slate-700/80">1-5★</td>
  `;

  for (let d = 1; d <= 31; d++) {
    const sleepData = appData.sleepLogs[d] || { hours: 0, quality: 0 };
    sleepQualHtml += `
      <td class="p-1 text-center border-r border-slate-800 text-[10px] text-amber-400 font-bold">
        <select onchange="updateMatrixSleep(${d}, 'quality', this.value)" class="sleep-select text-[10px]">
          <option value="0" ${sleepData.quality == 0 ? 'selected' : ''}>-</option>
          <option value="1" ${sleepData.quality == 1 ? 'selected' : ''}>1★</option>
          <option value="2" ${sleepData.quality == 2 ? 'selected' : ''}>2★</option>
          <option value="3" ${sleepData.quality == 3 ? 'selected' : ''}>3★</option>
          <option value="4" ${sleepData.quality == 4 ? 'selected' : ''}>4★</option>
          <option value="5" ${sleepData.quality == 5 ? 'selected' : ''}>5★</option>
        </select>
      </td>
    `;
  }
  sleepQualHtml += `<td class="p-2 text-center text-slate-600">-</td>`;
  sleepQualTr.innerHTML = sleepQualHtml;
  tbody.appendChild(sleepQualTr);
}

function updateMatrixSleep(day, field, value) {
  if (!appData.sleepLogs[day]) {
    appData.sleepLogs[day] = { hours: 0, quality: 0 };
  }
  appData.sleepLogs[day][field] = parseFloat(value) || 0;
  saveState();
  updateSummaryMetrics();
  showToast(`Day ${day} sleep ${field} updated`);
}

function openAddHabitModal() {
  const modal = document.getElementById("modal-add-habit");
  if (modal) modal.classList.remove("hidden");
}

function closeAddHabitModal() {
  const modal = document.getElementById("modal-add-habit");
  if (modal) modal.classList.add("hidden");
}

function saveNewHabit() {
  const nameInput = document.getElementById("new-habit-name");
  const goalInput = document.getElementById("new-habit-goal");

  const name = nameInput ? nameInput.value.trim() : "";
  const goal = goalInput ? goalInput.value.trim() : "Daily";

  if (!name) {
    alert("Please enter a habit name.");
    return;
  }

  const newId = "h_" + Date.now();
  appData.habits.push({ id: newId, name: name, goal: goal });

  saveState();
  renderMatrixTable();
  closeAddHabitModal();

  if (nameInput) nameInput.value = "";
  if (goalInput) goalInput.value = "";

  showToast(`New habit "${name}" created!`);
}

function deleteHabit(habitId) {
  if (confirm("Are you sure you want to delete this habit slot? Existing log entries for this habit will be removed.")) {
    appData.habits = appData.habits.filter(h => h.id !== habitId);
    
    Object.keys(appData.habitLogs).forEach(key => {
      if (key.startsWith(`${habitId}-`)) {
        delete appData.habitLogs[key];
      }
    });

    saveState();
    renderMatrixTable();
    updateSummaryMetrics();
    showToast("Habit slot removed");
  }
}

// ============================================================================
// VISUAL ANALYTICS & CHART.JS ENGINE
// ============================================================================

function destroyCharts() {
  Object.keys(chartInstances).forEach(key => {
    if (chartInstances[key]) {
      chartInstances[key].destroy();
    }
  });
  chartInstances = {};
}

function renderAnalyticsCharts() {
  destroyCharts();

  const labels = Array.from({ length: 31 }, (_, i) => `Day ${i + 1}`);

  const completionData = labels.map((_, i) => {
    const day = i + 1;
    let done = 0;
    appData.habits.forEach(h => {
      if (appData.habitLogs[`${h.id}-${day}`]) done++;
    });
    return appData.habits.length > 0 ? Math.round((done / appData.habits.length) * 100) : 0;
  });

  const ctx1 = document.getElementById("chart-daily-completion");
  if (ctx1) {
    chartInstances.completion = new Chart(ctx1, {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
          label: "Habit Completion Rate (%)",
          data: completionData,
          borderColor: "#00f2fe",
          backgroundColor: "rgba(0, 242, 254, 0.15)",
          fill: true,
          tension: 0.3,
          pointBackgroundColor: "#00f2fe"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { min: 0, max: 100, ticks: { color: "#94a3b8" }, grid: { color: "rgba(148, 163, 184, 0.1)" } },
          x: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(148, 163, 184, 0.1)" } }
        },
        plugins: { legend: { labels: { color: "#f8fafc" } } }
      }
    });
  }

  const sleepHoursData = labels.map((_, i) => {
    const d = i + 1;
    return appData.sleepLogs[d] ? appData.sleepLogs[d].hours : 0;
  });

  const sleepQualityData = labels.map((_, i) => {
    const d = i + 1;
    return appData.sleepLogs[d] ? appData.sleepLogs[d].quality : 0;
  });

  const ctx2 = document.getElementById("chart-sleep-trends");
  if (ctx2) {
    chartInstances.sleep = new Chart(ctx2, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            type: "bar",
            label: "Sleep Hours",
            data: sleepHoursData,
            backgroundColor: "rgba(129, 140, 248, 0.6)",
            borderColor: "#818cf8",
            borderWidth: 1,
            yAxisID: "y"
          },
          {
            type: "line",
            label: "Sleep Quality (1-5★)",
            data: sleepQualityData,
            borderColor: "#f59e0b",
            backgroundColor: "#f59e0b",
            tension: 0.2,
            yAxisID: "y1"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { type: "linear", position: "left", min: 0, max: 12, ticks: { color: "#818cf8" } },
          y1: { type: "linear", position: "right", min: 0, max: 5, grid: { drawOnChartArea: false }, ticks: { color: "#f59e0b" } },
          x: { ticks: { color: "#94a3b8" } }
        },
        plugins: { legend: { labels: { color: "#f8fafc" } } }
      }
    });
  }

  const habitNames = appData.habits.map(h => h.name);
  const habitCompletions = appData.habits.map(h => {
    let count = 0;
    for (let d = 1; d <= 31; d++) {
      if (appData.habitLogs[`${h.id}-${d}`]) count++;
    }
    return Math.round((count / 31) * 100);
  });

  const ctx3 = document.getElementById("chart-habit-breakdown");
  if (ctx3) {
    chartInstances.habits = new Chart(ctx3, {
      type: "bar",
      data: {
        labels: habitNames,
        datasets: [{
          label: "Overall Habit Execution %",
          data: habitCompletions,
          backgroundColor: ["#34d399", "#38bdf8", "#818cf8", "#f43f5e", "#fbbf24", "#a78bfa"],
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        scales: {
          x: { min: 0, max: 100, ticks: { color: "#94a3b8" } },
          y: { ticks: { color: "#f8fafc" } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }

  let cumulativeXp = 0;
  const xpTrajectoryData = labels.map((_, i) => {
    const day = i + 1;
    let dayXp = 0;
    appData.habits.forEach(h => {
      if (appData.habitLogs[`${h.id}-${day}`]) dayXp += 15;
    });
    cumulativeXp += dayXp;
    return cumulativeXp;
  });

  const ctx4 = document.getElementById("chart-xp-growth");
  if (ctx4) {
    chartInstances.xp = new Chart(ctx4, {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
          label: "Cumulative XP Trajectory",
          data: xpTrajectoryData,
          borderColor: "#fbbf24",
          backgroundColor: "rgba(251, 191, 36, 0.15)",
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { ticks: { color: "#94a3b8" } },
          x: { ticks: { color: "#94a3b8" } }
        },
        plugins: { legend: { labels: { color: "#f8fafc" } } }
      }
    });
  }
}

// ============================================================================
// REFLECTIONS ENGINE
// ============================================================================

function renderReflections() {
  const ref = appData.reflections || {};
  
  ["w1", "w2", "w3", "w4"].forEach(w => {
    const winsEl = document.getElementById(`ref-${w}-wins`);
    const lossesEl = document.getElementById(`ref-${w}-losses`);
    const scoreEl = document.getElementById(`ref-${w}-score`);

    if (ref[w]) {
      if(winsEl) winsEl.value = ref[w].wins || "";
      if(lossesEl) lossesEl.value = ref[w].losses || "";
      if(scoreEl) scoreEl.value = ref[w].score || 8;
    }
  });

  const transEl = document.getElementById("ref-monthly-transformation");
  if (transEl && ref.monthly) {
    transEl.value = ref.monthly.transformation || "";
  }
}

function saveReflections() {
  appData.reflections = {
    w1: {
      wins: getVal("ref-w1-wins"),
      losses: getVal("ref-w1-losses"),
      score: parseInt(getVal("ref-w1-score")) || 8
    },
    w2: {
      wins: getVal("ref-w2-wins"),
      losses: getVal("ref-w2-losses"),
      score: parseInt(getVal("ref-w2-score")) || 8
    },
    w3: {
      wins: getVal("ref-w3-wins"),
      losses: getVal("ref-w3-losses"),
      score: parseInt(getVal("ref-w3-score")) || 8
    },
    w4: {
      wins: getVal("ref-w4-wins"),
      losses: getVal("ref-w4-losses"),
      score: parseInt(getVal("ref-w4-score")) || 8
    },
    monthly: {
      transformation: getVal("ref-monthly-transformation")
    }
  };

  saveState();
  showToast("Reflections saved!");
}

function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value : "";
}

// ============================================================================
// REPORT GENERATION & DATA PERSISTENCE CENTER
// ============================================================================

function renderReport() {
  const rank = getRankInfo(appData.xp);

  setTxt("report-user-name", appData.userName || "Warrior Protocol");
  setTxt("report-user-motto", `"${appData.userMotto || "Discipline over motivation."}"`);
  
  const rankBadgeEl = document.getElementById("report-rank-badge");
  if(rankBadgeEl) rankBadgeEl.innerText = `Lvl ${rank.level}: ${rank.title}`;

  let totalCompletions = 0;
  Object.keys(appData.habitLogs).forEach(k => {
    if (appData.habitLogs[k]) totalCompletions++;
  });

  const totalPossible = (appData.habits.length || 1) * 31;
  const completionRate = Math.round((totalCompletions / totalPossible) * 100);

  let totalSleep = 0;
  let sleepDays = 0;
  Object.keys(appData.sleepLogs).forEach(d => {
    if (appData.sleepLogs[d] && appData.sleepLogs[d].hours > 0) {
      totalSleep += appData.sleepLogs[d].hours;
      sleepDays++;
    }
  });
  const avgSleep = sleepDays > 0 ? (totalSleep / sleepDays).toFixed(1) : "0.0";

  setTxt("rep-kpi-total-habits", totalCompletions);
  setTxt("rep-kpi-completion", `${completionRate}%`);
  setTxt("rep-kpi-sleep", `${avgSleep}h`);
  setTxt("rep-kpi-xp", appData.xp);

  const tbody = document.getElementById("report-habit-tbody");
  if (tbody) {
    tbody.innerHTML = "";
    appData.habits.forEach(h => {
      let count = 0;
      for (let d = 1; d <= 31; d++) {
        if (appData.habitLogs[`${h.id}-${d}`]) count++;
      }
      const pct = Math.round((count / 31) * 100);
      const xpEarned = count * 15;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="p-2.5 font-bold text-white">${escapeHtml(h.name)}</td>
        <td class="p-2.5 text-slate-400">${escapeHtml(h.goal)}</td>
        <td class="p-2.5 text-center font-bold text-cyan-300">${count} / 31</td>
        <td class="p-2.5 text-center font-bold text-emerald-400">${pct}%</td>
        <td class="p-2.5 text-right font-extrabold text-amber-300">+${xpEarned} XP</td>
      `;
      tbody.appendChild(tr);
    });
  }

  const refSummary = document.getElementById("report-reflections-summary");
  if (refSummary) {
    refSummary.innerHTML = "";
    const ref = appData.reflections || {};

    const weeks = [
      { key: "w1", title: "Week 1 (Days 1–7)" },
      { key: "w2", title: "Week 2 (Days 8–14)" },
      { key: "w3", title: "Week 3 (Days 15–21)" },
      { key: "w4", title: "Week 4 (Days 22–31)" }
    ];

    weeks.forEach(w => {
      const data = ref[w.key] || {};
      const card = document.createElement("div");
      card.className = "bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/60 space-y-1";
      card.innerHTML = `
        <div class="font-bold text-cyan-300 flex justify-between">
          <span>${w.title}</span>
          <span class="text-amber-400">Score: ${data.score || 8}/10</span>
        </div>
        <div class="text-[11px] text-slate-300"><strong>Wins:</strong> ${escapeHtml(data.wins || 'N/A')}</div>
        <div class="text-[11px] text-slate-400"><strong>Obstacles:</strong> ${escapeHtml(data.losses || 'N/A')}</div>
      `;
      refSummary.appendChild(card);
    });
  }
}

function downloadPDFReport() {
  renderReport();
  window.print();
}

function exportCSVData() {
  let csv = "Habit Name,Goal,";
  for (let d = 1; d <= 31; d++) {
    csv += `Day ${d},`;
  }
  csv += "Total Completed,Completion Rate %\n";

  appData.habits.forEach(h => {
    csv += `"${h.name.replace(/"/g, '""')}","${h.goal.replace(/"/g, '""')}",`;
    let count = 0;
    for (let d = 1; d <= 31; d++) {
      const isChecked = !!appData.habitLogs[`${h.id}-${d}`];
      if (isChecked) count++;
      csv += isChecked ? "1," : "0,";
    }
    const pct = Math.round((count / 31) * 100);
    csv += `${count},${pct}%\n`;
  });

  csv += '"Sleep Hours","8 hrs",';
  for (let d = 1; d <= 31; d++) {
    const hours = appData.sleepLogs[d] ? appData.sleepLogs[d].hours : 0;
    csv += `${hours},`;
  }
  csv += "\n";

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `winter_arc_31day_matrix_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("CSV Data exported successfully!");
}

function exportJSONBackup() {
  const jsonStr = JSON.stringify(appData, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `winter_arc_backup_${Date.now()}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("JSON State Backup downloaded!");
}

function importJSONBackup(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (imported && typeof imported === "object") {
        appData = { ...appData, ...imported };
        saveState();
        applyTheme(appData.theme || "arctic");
        renderDashboard();
        renderMatrixTable();
        renderReflections();
        showToast("Backup restored successfully!");
      } else {
        alert("Invalid backup file format.");
      }
    } catch (err) {
      alert("Failed to parse JSON backup file.");
    }
  };
  reader.readAsText(file);
}

function confirmResetData() {
  if (confirm("DANGER: Are you sure you want to reset all habit logs, sleep logs, XP, and reflections? This action cannot be undone.")) {
    localStorage.removeItem("winterArcData");
    location.reload();
  }
}

// ============================================================================
// HELPER UTILITIES
// ============================================================================

function setTxt(id, text) {
  const el = document.getElementById(id);
  if(el) el.innerText = text;
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showToast(message) {
  const toast = document.getElementById("toast");
  const msgEl = document.getElementById("toast-msg");
  if (!toast || !msgEl) return;

  msgEl.innerText = message;
  toast.classList.remove("translate-y-20", "opacity-0", "pointer-events-none");

  setTimeout(() => {
    toast.classList.add("translate-y-20", "opacity-0", "pointer-events-none");
  }, 2500);
}
