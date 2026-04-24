const STORAGE_KEYS = { config: "eduplan.config", session: "eduplan.session", theme: "eduplan.theme" };
const state = {
  authMode: "login",
  config: loadConfig(),
  session: loadSession(),
  user: null,
  lessons: [],
  filters: { query: "", scope: "week", status: "all" },
  currentWeekStart: startOfWeek(new Date()),
  aiDraft: null,
  activeModal: null
};

const refs = {};
let toastTimer = null;

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  bindEvents();
  applyTheme(loadTheme());
  hydrateConfigForm();
  initializeApp();
});

function cacheElements() {
  const ids = [
    "setupView", "authView", "dashboardView", "logoutButton", "themeToggle", "themeToggleLabel", "toast",
    "configForm", "supabaseUrlInput", "supabaseAnonKeyInput", "rememberConfigInput", "clearConfigButton",
    "authTitle", "authModePill", "authForm", "authSubmitButton", "authSwitchText", "authSwitchButton", "authEmail", "authPassword",
    "welcomeHeading", "welcomeSubtext", "metricNextLesson", "metricNextLessonMeta", "metricWeekCount", "metricTotalCount", "metricAiCount",
    "calendarRangeLabel", "calendarGrid", "upcomingList", "upcomingCountPill", "lessonList", "assistantPreview", "searchInput", "scopeFilter", "statusFilter",
    "lessonModal", "lessonForm", "lessonModalTitle", "lessonIdInput", "lessonAiInput", "lessonTitleInput", "lessonDateTimeInput", "lessonStatusInput",
    "lessonObjectivesInput", "lessonActivitiesInput", "lessonAssessmentInput", "aiModal", "aiForm", "aiTopicInput", "aiAudienceInput",
    "aiContextInput", "aiGenerateButton", "aiResult"
  ];
  ids.forEach((id) => { refs[id] = document.getElementById(id); });
}

function bindEvents() {
  refs.themeToggle.addEventListener("click", toggleTheme);
  refs.configForm.addEventListener("submit", handleConfigSubmit);
  refs.clearConfigButton.addEventListener("click", clearSavedConfig);
  refs.authForm.addEventListener("submit", handleAuthSubmit);
  refs.authSwitchButton.addEventListener("click", toggleAuthMode);
  refs.logoutButton.addEventListener("click", handleLogout);
  document.getElementById("openLessonButton").addEventListener("click", () => openLessonModal());
  document.getElementById("openAiButton").addEventListener("click", () => openModal("ai"));
  document.getElementById("openAiButtonSecondary").addEventListener("click", () => openModal("ai"));
  document.getElementById("prevWeekButton").addEventListener("click", () => shiftWeek(-7));
  document.getElementById("nextWeekButton").addEventListener("click", () => shiftWeek(7));
  document.getElementById("todayWeekButton").addEventListener("click", () => {
    state.currentWeekStart = startOfWeek(new Date());
    renderDashboard();
  });
  refs.searchInput.addEventListener("input", (event) => {
    state.filters.query = event.target.value.trim().toLowerCase();
    renderDashboard();
  });
  refs.scopeFilter.addEventListener("change", (event) => {
    state.filters.scope = event.target.value;
    renderDashboard();
  });
  refs.statusFilter.addEventListener("change", (event) => {
    state.filters.status = event.target.value;
    renderDashboard();
  });
  refs.lessonForm.addEventListener("submit", handleLessonSubmit);
  refs.aiForm.addEventListener("submit", handleAiSubmit);

  document.addEventListener("click", (event) => {
    const closeTarget = event.target.closest("[data-close-modal]");
    if (closeTarget) {
      closeModal(closeTarget.dataset.closeModal);
      return;
    }

    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) {
      return;
    }

    const { action, lessonId } = actionButton.dataset;
    if (action === "apply-ai") {
      openLessonModal(convertDraftToLesson(state.aiDraft));
      closeModal("aiModal");
      return;
    }

    if (!lessonId) {
      return;
    }

    const lesson = state.lessons.find((item) => item.id === lessonId);
    if (action === "edit") {
      openLessonModal(lesson);
    }
    if (action === "delete") {
      handleDeleteLesson(lessonId);
    }
    if (action === "export") {
      handleExportLesson(lesson);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (state.activeModal === "lesson") {
        closeModal("lessonModal");
      }
      if (state.activeModal === "ai") {
        closeModal("aiModal");
      }
    }
  });
}

async function initializeApp() {
  updateAuthCopy();
  if (!hasConfig()) {
    showView("setup");
    return;
  }

  showView("auth");
  if (!state.session) {
    return;
  }

  try {
    await ensureValidSession();
    state.user = await getCurrentUser();
    refs.logoutButton.classList.remove("hidden");
    showView("dashboard");
    await refreshLessons();
  } catch (error) {
    clearSession();
    state.user = null;
    refs.logoutButton.classList.add("hidden");
    showView("auth");
    showToast(error.message || "Session expired. Please log in again.");
  }
}

function hasConfig() {
  return Boolean(state.config.supabaseUrl && state.config.supabaseAnonKey);
}

function showView(name) {
  refs.setupView.classList.toggle("hidden", name !== "setup");
  refs.authView.classList.toggle("hidden", name !== "auth");
  refs.dashboardView.classList.toggle("hidden", name !== "dashboard");
}

function hydrateConfigForm() {
  refs.supabaseUrlInput.value = state.config.supabaseUrl || "";
  refs.supabaseAnonKeyInput.value = state.config.supabaseAnonKey || "";
}

function handleConfigSubmit(event) {
  event.preventDefault();
  state.config = {
    supabaseUrl: refs.supabaseUrlInput.value.trim().replace(/\/+$/, ""),
    supabaseAnonKey: refs.supabaseAnonKeyInput.value.trim()
  };
  if (refs.rememberConfigInput.checked) {
    localStorage.setItem(STORAGE_KEYS.config, JSON.stringify(state.config));
  } else {
    localStorage.removeItem(STORAGE_KEYS.config);
  }
  showToast("Supabase configuration saved.");
  initializeApp();
}

function clearSavedConfig() {
  localStorage.removeItem(STORAGE_KEYS.config);
  state.config = { supabaseUrl: "", supabaseAnonKey: "" };
  refs.supabaseUrlInput.value = "";
  refs.supabaseAnonKeyInput.value = "";
  showToast("Saved configuration cleared.");
  showView("setup");
}

function toggleAuthMode() {
  state.authMode = state.authMode === "login" ? "signup" : "login";
  refs.authForm.reset();
  updateAuthCopy();
}

function updateAuthCopy() {
  const isLogin = state.authMode === "login";
  refs.authTitle.textContent = isLogin ? "Login to your planner" : "Create your EduPlan Pro account";
  refs.authModePill.textContent = isLogin ? "Login" : "Signup";
  refs.authSubmitButton.textContent = isLogin ? "Login" : "Create account";
  refs.authSwitchText.textContent = isLogin
    ? "New here? Create your account to start building lessons."
    : "Already have an account? Sign in and pick up where you left off.";
  refs.authSwitchButton.textContent = isLogin ? "Switch to signup" : "Switch to login";
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const buttonLabel = state.authMode === "login" ? "Login" : "Create account";
  setLoading(refs.authSubmitButton, true, state.authMode === "login" ? "Logging in..." : "Creating account...");

  try {
    const email = refs.authEmail.value.trim();
    const password = refs.authPassword.value;
    const authPayload = state.authMode === "login" ? await signIn(email, password) : await signUp(email, password);
    const sessionPayload = authPayload.session || authPayload;
    const userPayload = authPayload.user || authPayload.session?.user;

    if (!sessionPayload?.access_token) {
      showToast("Account created. Check your email if confirmation is enabled, then log in.");
      state.authMode = "login";
      updateAuthCopy();
      return;
    }

    state.session = normalizeSession(sessionPayload);
    persistSession();
    state.user = userPayload || (await getCurrentUser());
    refs.logoutButton.classList.remove("hidden");
    refs.authForm.reset();
    showView("dashboard");
    await refreshLessons();
    showToast(state.authMode === "login" ? "Welcome back." : "Account created successfully.");
  } catch (error) {
    showToast(error.message || "Authentication failed.");
  } finally {
    setLoading(refs.authSubmitButton, false, state.authMode === "login" ? "Login" : buttonLabel);
  }
}

async function handleLogout() {
  try {
    if (state.session?.access_token) {
      await fetch(`${state.config.supabaseUrl}/auth/v1/logout`, {
        method: "POST",
        headers: createHeaders(true)
      });
    }
  } catch (error) {
    console.error(error);
  }

  clearSession();
  state.user = null;
  state.lessons = [];
  state.aiDraft = null;
  refs.logoutButton.classList.add("hidden");
  refs.assistantPreview.innerHTML = renderEmptyAssistant();
  refs.aiResult.innerHTML = renderEmptyAiResult();
  refs.upcomingList.innerHTML = "";
  refs.lessonList.innerHTML = "";
  refs.calendarGrid.innerHTML = "";
  showView("auth");
  showToast("You have been logged out.");
}

async function refreshLessons() {
  refs.dashboardView.classList.add("is-loading");
  try {
    state.lessons = await fetchLessons();
    renderDashboard();
  } catch (error) {
    showToast(error.message || "Unable to load lessons.");
  } finally {
    refs.dashboardView.classList.remove("is-loading");
  }
}

function renderDashboard() {
  const visibleLessons = getFilteredLessons();
  const upcomingLessons = state.lessons
    .filter((lesson) => new Date(lesson.scheduled_at) >= new Date())
    .sort((left, right) => new Date(left.scheduled_at) - new Date(right.scheduled_at));
  const thisWeekLessons = getLessonsForWeek(state.lessons, state.currentWeekStart);
  const nextLesson = upcomingLessons[0];

  refs.welcomeHeading.textContent = `Hello${state.user?.email ? `, ${state.user.email}` : ""}`;
  refs.welcomeSubtext.textContent = nextLesson
    ? `Your next lesson is ${formatLongDateTime(nextLesson.scheduled_at)}. Keep the week organized and editable from one place.`
    : "No lessons scheduled yet. Start with a manual lesson or let AI draft one for you.";
  refs.metricNextLesson.textContent = nextLesson ? formatShortDateTime(nextLesson.scheduled_at) : "No lessons";
  refs.metricNextLessonMeta.textContent = nextLesson ? nextLesson.title : "Create your first plan to get started.";
  refs.metricWeekCount.textContent = String(thisWeekLessons.length);
  refs.metricTotalCount.textContent = String(state.lessons.length);
  refs.metricAiCount.textContent = String(state.lessons.filter((lesson) => lesson.ai_generated).length);

  renderPlanner();
  renderAssistantPreview();
  refs.upcomingCountPill.textContent = `${upcomingLessons.length} ${upcomingLessons.length === 1 ? "lesson" : "lessons"}`;
  refs.upcomingList.innerHTML = upcomingLessons.length
    ? upcomingLessons.slice(0, 6).map(renderUpcomingCard).join("")
    : renderEmptyState("No upcoming lessons", "Your next scheduled lessons will appear here.");
  refs.lessonList.innerHTML = visibleLessons.length
    ? visibleLessons.map(renderLessonCard).join("")
    : renderEmptyState("No lessons match your filters", "Try changing the timeframe or create a new lesson.");
}

function renderPlanner() {
  const filteredLessons = getFilteredLessons();
  const weekLessons = getLessonsForWeek(filteredLessons, state.currentWeekStart);
  refs.calendarRangeLabel.textContent = `${formatDay(state.currentWeekStart)} - ${formatDay(addDays(state.currentWeekStart, 6))}`;
  refs.calendarGrid.innerHTML = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(state.currentWeekStart, index);
    const dayLessons = weekLessons.filter((lesson) => isSameDay(new Date(lesson.scheduled_at), day));
    const isToday = isSameDay(day, new Date());
    return `
      <article class="calendar-day ${isToday ? "today" : ""}">
        <div class="calendar-day-header">
          <div>
            <div class="calendar-day-name">${formatWeekday(day)}</div>
            <strong>${formatMonthDay(day)}</strong>
          </div>
          <div class="calendar-date-number">${day.getDate()}</div>
        </div>
        <div class="calendar-events">
          ${dayLessons.length ? dayLessons.map((lesson) => `
            <div class="calendar-event">
              <strong class="calendar-card-title">${escapeHtml(lesson.title)}</strong>
              <time>${formatShortTime(lesson.scheduled_at)}</time>
              <span class="timestamp">${escapeHtml(lesson.status || "planned")}</span>
            </div>
          `).join("") : `<div class="calendar-empty"><p>No lessons</p></div>`}
        </div>
      </article>
    `;
  }).join("");
}

function renderAssistantPreview() {
  refs.assistantPreview.innerHTML = state.aiDraft ? renderAiDraft(state.aiDraft, true) : renderEmptyAssistant();
  refs.aiResult.innerHTML = state.aiDraft ? renderAiDraft(state.aiDraft, false) : renderEmptyAiResult();
}

function renderUpcomingCard(lesson) {
  return `
    <article class="upcoming-card">
      <div class="upcoming-top">
        <div class="lesson-title-row">
          <strong class="lesson-title">${escapeHtml(lesson.title)}</strong>
          <span class="lesson-meta">${formatLongDateTime(lesson.scheduled_at)}</span>
        </div>
        <span class="small-pill">${escapeHtml(lesson.status || "planned")}</span>
      </div>
      <p class="lesson-snippet">${escapeHtml(trimText(lesson.objectives, 120))}</p>
    </article>
  `;
}

function renderLessonCard(lesson) {
  return `
    <article class="lesson-card">
      <div class="lesson-card-header">
        <div class="lesson-title-row">
          <strong class="lesson-title">${escapeHtml(lesson.title)}</strong>
          <span class="lesson-meta">${formatLongDateTime(lesson.scheduled_at)}</span>
        </div>
        <div class="pill-row">
          <span class="small-pill">${escapeHtml(lesson.status || "planned")}</span>
          <span class="small-pill neutral">${lesson.ai_generated ? "AI-assisted" : "Manual"}</span>
        </div>
      </div>
      <p class="lesson-snippet"><strong>Objectives:</strong> ${escapeHtml(trimText(lesson.objectives, 170))}</p>
      <p class="lesson-snippet"><strong>Activities:</strong> ${escapeHtml(trimText(lesson.activities, 190))}</p>
      <p class="lesson-snippet"><strong>Assessment:</strong> ${escapeHtml(trimText(lesson.assessment, 170))}</p>
      <div class="lesson-card-footer">
        <div class="pill-row">
          <span class="small-pill neutral">Created ${formatTimestamp(lesson.created_at)}</span>
          <span class="small-pill neutral">Updated ${formatTimestamp(lesson.updated_at)}</span>
        </div>
        <div class="lesson-actions">
          <button class="secondary-button" type="button" data-action="edit" data-lesson-id="${lesson.id}">Edit</button>
          <button class="secondary-button" type="button" data-action="export" data-lesson-id="${lesson.id}">Export PDF</button>
          <button class="danger-button" type="button" data-action="delete" data-lesson-id="${lesson.id}">Delete</button>
        </div>
      </div>
    </article>
  `;
}

function renderAiDraft(draft, compact) {
  const footer = compact
    ? `<div class="button-row"><button class="primary-button" type="button" data-action="apply-ai">Use in planner</button></div>`
    : `<div class="button-row"><button class="primary-button" type="button" data-action="apply-ai">Use in planner</button><span class="small-pill neutral">${escapeHtml(draft.sourceLabel)}</span></div>`;
  return `
    <div class="assistant-draft">
      <h4>${escapeHtml(draft.title)}</h4>
      <section><span>Objectives</span><p class="lead subtle">${escapeHtml(draft.objectives)}</p></section>
      <section><span>Activities</span><p class="lead subtle">${escapeHtml(draft.activities)}</p></section>
      <section><span>Assessment</span><p class="lead subtle">${escapeHtml(draft.assessment)}</p></section>
      ${footer}
    </div>
  `;
}

function renderEmptyState(title, copy) {
  return `<div class="empty-state"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(copy)}</p></div>`;
}

function renderEmptyAssistant() {
  return renderEmptyState("No AI draft yet", "Generate a lesson idea to preview it here before saving.");
}

function renderEmptyAiResult() {
  return renderEmptyState("No draft generated yet", "Describe a topic to create objectives, activities, and assessment suggestions.");
}

function openModal(modalType) {
  state.activeModal = modalType;
  if (modalType === "lesson") refs.lessonModal.classList.remove("hidden");
  if (modalType === "ai") refs.aiModal.classList.remove("hidden");
}

function closeModal(modalId) {
  if (modalId === "lessonModal") {
    refs.lessonModal.classList.add("hidden");
    refs.lessonForm.reset();
    refs.lessonIdInput.value = "";
    refs.lessonAiInput.value = "false";
  }
  if (modalId === "aiModal") {
    refs.aiModal.classList.add("hidden");
    refs.aiForm.reset();
  }
  state.activeModal = null;
}

function openLessonModal(lesson = null) {
  refs.lessonModalTitle.textContent = lesson?.id ? "Edit lesson" : "Create lesson";
  refs.lessonIdInput.value = lesson?.id || "";
  refs.lessonAiInput.value = lesson?.ai_generated ? "true" : "false";
  refs.lessonTitleInput.value = lesson?.title || "";
  refs.lessonDateTimeInput.value = toDateTimeLocalValue(lesson?.scheduled_at || new Date());
  refs.lessonStatusInput.value = lesson?.status || "planned";
  refs.lessonObjectivesInput.value = lesson?.objectives || "";
  refs.lessonActivitiesInput.value = lesson?.activities || "";
  refs.lessonAssessmentInput.value = lesson?.assessment || "";
  openModal("lesson");
}

async function handleLessonSubmit(event) {
  event.preventDefault();
  const payload = {
    title: refs.lessonTitleInput.value.trim(),
    objectives: refs.lessonObjectivesInput.value.trim(),
    activities: refs.lessonActivitiesInput.value.trim(),
    assessment: refs.lessonAssessmentInput.value.trim(),
    scheduled_at: new Date(refs.lessonDateTimeInput.value).toISOString(),
    status: refs.lessonStatusInput.value,
    ai_generated: refs.lessonAiInput.value === "true"
  };

  if (!payload.title || !payload.objectives || !payload.activities || !payload.assessment) {
    showToast("Please complete all lesson fields.");
    return;
  }

  const isEditing = Boolean(refs.lessonIdInput.value);
  const submitButton = refs.lessonForm.querySelector('button[type="submit"]');
  setLoading(submitButton, true, isEditing ? "Saving..." : "Creating...");

  try {
    if (isEditing) {
      await updateLesson(refs.lessonIdInput.value, payload);
      showToast("Lesson updated.");
    } else {
      await createLesson(payload);
      showToast("Lesson created.");
    }
    closeModal("lessonModal");
    await refreshLessons();
  } catch (error) {
    showToast(error.message || "Unable to save lesson.");
  } finally {
    setLoading(submitButton, false, "Save lesson");
  }
}

async function handleDeleteLesson(lessonId) {
  const lesson = state.lessons.find((item) => item.id === lessonId);
  if (!lesson || !window.confirm(`Delete "${lesson.title}"?`)) {
    return;
  }
  try {
    await deleteLesson(lessonId);
    await refreshLessons();
    showToast("Lesson deleted.");
  } catch (error) {
    showToast(error.message || "Unable to delete lesson.");
  }
}

async function handleExportLesson(lesson) {
  if (!lesson) return;
  try {
    if (!window.eduPlanDesktop?.exportPdf) {
      showToast("PDF export is available in the Electron desktop app.");
      return;
    }
    const result = await window.eduPlanDesktop.exportPdf({
      ...lesson,
      scheduledLabel: formatLongDateTime(lesson.scheduled_at),
      updatedLabel: formatLongDateTime(lesson.updated_at || lesson.created_at)
    });
    if (!result?.canceled && result?.filePath) {
      showToast(`PDF saved to ${result.filePath}`);
    }
  } catch (error) {
    showToast(error.message || "PDF export failed.");
  }
}

async function handleAiSubmit(event) {
  event.preventDefault();
  const topic = refs.aiTopicInput.value.trim();
  if (!topic) {
    showToast("Enter a topic to generate a lesson draft.");
    return;
  }
  setLoading(refs.aiGenerateButton, true, "Generating...");
  try {
    const payload = {
      topic,
      audience: refs.aiAudienceInput.value.trim(),
      context: refs.aiContextInput.value.trim()
    };
    const result = window.eduPlanDesktop?.generateLesson
      ? await window.eduPlanDesktop.generateLesson(payload)
      : buildClientFallbackLesson(payload);
    state.aiDraft = {
      ...result,
      sourceLabel: result.source === "openai" ? "Generated with OpenAI" : "Generated with smart template"
    };
    renderAssistantPreview();
    showToast(result.source === "openai" ? "AI lesson draft ready." : "Smart lesson template ready.");
  } catch (error) {
    showToast(error.message || "Unable to generate lesson.");
  } finally {
    setLoading(refs.aiGenerateButton, false, "Generate draft");
  }
}

function buildClientFallbackLesson({ topic, audience, context }) {
  const topicLabel = topic || "Lesson topic";
  const audienceLabel = audience || "students";
  const contextLabel = context || "guided discussion and short practice";
  return {
    title: `${topicLabel} lesson plan`,
    objectives: [
      `Define the essential concepts connected to ${topicLabel}.`,
      `Explain the topic clearly for ${audienceLabel}.`,
      "Apply understanding through a short task or collaborative response."
    ].join("\n"),
    activities: [
      `Warm-up prompt activating prior knowledge about ${topicLabel}.`,
      "Mini-lesson with examples, visuals, and think-aloud modeling.",
      `Guided practice using ${contextLabel}.`,
      "Closing reflection and quick share-out."
    ].join("\n"),
    assessment: [
      "Use questioning during the lesson to check understanding.",
      `Collect an exit ticket about the key takeaway from ${topicLabel}.`,
      "Review responses to plan reteaching or extension."
    ].join("\n"),
    source: "smart-template"
  };
}

function convertDraftToLesson(draft) {
  return {
    title: draft.title,
    objectives: draft.objectives,
    activities: draft.activities,
    assessment: draft.assessment,
    scheduled_at: new Date(),
    status: "draft",
    ai_generated: true
  };
}

function getFilteredLessons() {
  return [...state.lessons]
    .filter(matchesQuery)
    .filter(matchesScope)
    .filter(matchesStatus)
    .sort((left, right) => new Date(left.scheduled_at) - new Date(right.scheduled_at));
}

function matchesQuery(lesson) {
  if (!state.filters.query) return true;
  const haystack = [lesson.title, lesson.objectives, lesson.activities, lesson.assessment].join(" ").toLowerCase();
  return haystack.includes(state.filters.query);
}

function matchesScope(lesson) {
  const scheduledDate = new Date(lesson.scheduled_at);
  const now = new Date();
  if (state.filters.scope === "upcoming") return scheduledDate >= now;
  if (state.filters.scope === "past") return scheduledDate < now;
  if (state.filters.scope === "week") {
    const weekEnd = addDays(state.currentWeekStart, 7);
    return scheduledDate >= state.currentWeekStart && scheduledDate < weekEnd;
  }
  return true;
}

function matchesStatus(lesson) {
  return state.filters.status === "all" ? true : (lesson.status || "planned") === state.filters.status;
}

function getLessonsForWeek(lessons, weekStart) {
  const weekEnd = addDays(weekStart, 7);
  return lessons.filter((lesson) => {
    const scheduledDate = new Date(lesson.scheduled_at);
    return scheduledDate >= weekStart && scheduledDate < weekEnd;
  });
}

function shiftWeek(days) {
  state.currentWeekStart = addDays(state.currentWeekStart, days);
  renderDashboard();
}

function createHeaders(includeAuth = false) {
  const headers = { apikey: state.config.supabaseAnonKey, "Content-Type": "application/json" };
  if (includeAuth && state.session?.access_token) {
    headers.Authorization = `Bearer ${state.session.access_token}`;
  }
  return headers;
}

async function supabaseRequest(path, options = {}, includeAuth = false) {
  if (includeAuth) {
    await ensureValidSession();
  }

  const response = await fetch(`${state.config.supabaseUrl}${path}`, {
    ...options,
    headers: { ...createHeaders(includeAuth), ...(options.headers || {}) }
  });

  if (!response.ok) {
    let message = "Request failed.";
    try {
      const errorPayload = await response.json();
      message = errorPayload.msg || errorPayload.message || errorPayload.error_description || message;
    } catch (error) {
      message = await response.text();
    }
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function signUp(email, password) {
  return supabaseRequest("/auth/v1/signup", { method: "POST", body: JSON.stringify({ email, password }) });
}

async function signIn(email, password) {
  return supabaseRequest("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) });
}

async function getCurrentUser() {
  return supabaseRequest("/auth/v1/user", { method: "GET", headers: { "Content-Type": "application/json" } }, true);
}

async function ensureValidSession() {
  if (!state.session) {
    throw new Error("No active session.");
  }
  if (state.session.expires_at && Date.now() < state.session.expires_at - 60000) {
    return state.session;
  }
  const refreshed = await supabaseRequest("/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: state.session.refresh_token })
  });
  state.session = normalizeSession(refreshed);
  persistSession();
  return state.session;
}

function normalizeSession(session) {
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at ? session.expires_at * 1000 : Date.now() + (session.expires_in || 3600) * 1000
  };
}

function persistSession() {
  sessionStorage.setItem(STORAGE_KEYS.session, JSON.stringify(state.session));
}

function clearSession() {
  state.session = null;
  sessionStorage.removeItem(STORAGE_KEYS.session);
}

async function fetchLessons() {
  return supabaseRequest("/rest/v1/lessons?select=*&order=scheduled_at.asc", {
    method: "GET",
    headers: { Prefer: "return=representation" }
  }, true);
}

async function createLesson(payload) {
  const body = { ...payload, user_id: state.user.id };
  return supabaseRequest("/rest/v1/lessons", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body)
  }, true);
}

async function updateLesson(id, payload) {
  return supabaseRequest(`/rest/v1/lessons?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload)
  }, true);
}

async function deleteLesson(id) {
  return supabaseRequest(`/rest/v1/lessons?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" }, true);
}

function loadConfig() {
  const bakedConfig = window.EDUPLAN_CONFIG || {};
  const savedConfig = safeJsonParse(localStorage.getItem(STORAGE_KEYS.config));
  return {
    supabaseUrl: bakedConfig.supabaseUrl || savedConfig?.supabaseUrl || "",
    supabaseAnonKey: bakedConfig.supabaseAnonKey || savedConfig?.supabaseAnonKey || ""
  };
}

function loadSession() {
  return safeJsonParse(sessionStorage.getItem(STORAGE_KEYS.session));
}

function loadTheme() {
  return localStorage.getItem(STORAGE_KEYS.theme) || "light";
}

function toggleTheme() {
  applyTheme(document.body.classList.contains("dark-theme") ? "light" : "dark");
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.body.classList.toggle("dark-theme", isDark);
  refs.themeToggleLabel.textContent = isDark ? "Light mode" : "Dark mode";
  localStorage.setItem(STORAGE_KEYS.theme, isDark ? "dark" : "light");
}

function setLoading(button, loading, label) {
  button.disabled = loading;
  button.textContent = label;
}

function showToast(message) {
  refs.toast.textContent = message;
  refs.toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => refs.toast.classList.add("hidden"), 3200);
}

function safeJsonParse(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function startOfWeek(value) {
  const date = new Date(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + diff);
  return date;
}

function addDays(value, days) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function isSameDay(left, right) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

function formatLongDateTime(value) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function formatShortDateTime(value) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function formatShortTime(value) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function formatTimestamp(value) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function formatDay(value) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

function formatWeekday(value) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(new Date(value));
}

function formatMonthDay(value) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

function toDateTimeLocalValue(value) {
  const date = new Date(value);
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function trimText(value, maxLength) {
  if (!value || value.length <= maxLength) return value || "";
  return `${value.slice(0, maxLength).trim()}...`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
