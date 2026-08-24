const DRIVER_RATE = 3000;
const TRAINEE_DAYS = 60;
const STORAGE_KEY = "driver-routing-app";
const FIREBASE_COLLECTION = "appState";
const FIREBASE_DOCUMENT = "main";
const DATA_VERSION = 3;
const SEED_ACCOUNT_IDS = new Set(["u1", "u2", "u3"]);

const firebaseConfig = {
  apiKey: "AIzaSyD_CbV5Tyvp-9Im196VBkDlk3PaI-X7-LY",
  authDomain: "sity-drive.firebaseapp.com",
  projectId: "sity-drive",
  storageBucket: "sity-drive.firebasestorage.app",
  messagingSenderId: "258068770685",
  appId: "1:258068770685:web:0ed4cbee3fcd07ab6b2614",
  measurementId: "G-58EWMRFRCK",
};

const starterData = {
  users: [],
  restaurants: [],
  assignments: [],
  currentUserId: null,
  dataVersion: DATA_VERSION,
};

let state = clone(starterData);
let firestoreDb = null;
let authMode = "login";
let coordinatorPage = "main";
let managerReportCoordinatorId = "all";
let editingRestaurantId = null;
let editingAssignmentId = null;
let isApplyingRemoteState = false;

const selectedAssignmentDriverIds = new Set();

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const elements = {
  authPanel: $("#authPanel"),
  dashboard: $("#dashboard"),
  authForm: $("#authForm"),
  authError: $("#authError"),
  authSubmit: $("#authSubmit"),
  accountAdmin: $("#accountAdmin"),
  accountList: $("#accountList"),
  roleField: $("#roleField"),
  nameField: $("#nameField"),
  passwordField: $("#passwordField"),
  nameInput: $("#nameInput"),
  passwordInput: $("#passwordInput"),
  tabs: $$(".tab"),
  logoutBtn: $("#logoutBtn"),
  roleLabel: $("#roleLabel"),
  userTitle: $("#userTitle"),
  coordinatorView: $("#coordinatorView"),
  driverView: $("#driverView"),
  coordinatorNav: $("#coordinatorNav"),
  coordinatorMain: $("#coordinatorMain"),
  managerReportFilters: $("#managerReportFilters"),
  workspaceGrid: $(".workspace-grid"),
  driversPage: $("#driversPage"),
  restaurantsPage: $("#restaurantsPage"),
  driverSearchInput: $("#driverSearchInput"),
  driverChecklist: $("#driverChecklist"),
  assignmentRestaurantSearchInput: $("#assignmentRestaurantSearchInput"),
  restaurantSelect: $("#restaurantSelect"),
  timeInput: $("#timeInput"),
  assignmentForm: $("#assignmentForm"),
  assignmentHint: $("#assignmentHint"),
  monthFilter: $("#monthFilter"),
  reportSearchInput: $("#reportSearchInput"),
  reportDateFromInput: $("#reportDateFromInput"),
  reportDateToInput: $("#reportDateToInput"),
  reportSearchSummary: $("#reportSearchSummary"),
  reportHead: $("#reportHead"),
  reportBody: $("#reportBody"),
  assignedCount: $("#assignedCount"),
  totalAmount: $("#totalAmount"),
  driverForm: $("#driverForm"),
  newDriverNameInput: $("#newDriverNameInput"),
  newDriverCarInput: $("#newDriverCarInput"),
  newDriverTraineeInput: $("#newDriverTraineeInput"),
  newDriverTraineeSinceInput: $("#newDriverTraineeSinceInput"),
  driverManageSearchInput: $("#driverManageSearchInput"),
  driverManageList: $("#driverManageList"),
  driversCount: $("#driversCount"),
  restaurantForm: $("#restaurantForm"),
  restaurantNameInput: $("#restaurantNameInput"),
  restaurantDriverPriceInput: $("#restaurantDriverPriceInput"),
  restaurantSearchInput: $("#restaurantSearchInput"),
  restaurantList: $("#restaurantList"),
  restaurantsCount: $("#restaurantsCount"),
  driverAssignments: $("#driverAssignments"),
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createId() {
  return window.crypto?.randomUUID ? window.crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function normalizePrice(value) {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? price : DRIVER_RATE;
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString("ru-RU")} тг`;
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function includesSearch(value, query) {
  return String(value || "").toLowerCase().includes(query.toLowerCase());
}

function getUser(id) {
  return state.users.find((user) => user.id === id);
}

function getRestaurant(id) {
  return state.restaurants.find((restaurant) => restaurant.id === id);
}

function getCoordinators() {
  return state.users.filter((user) => user.role === "coordinator");
}

function getActiveCoordinatorId() {
  const user = getUser(state.currentUserId);
  return user?.role === "coordinator" ? user.id : "";
}

function getDefaultCoordinatorId() {
  return getActiveCoordinatorId() || getCoordinators()[0]?.id || "";
}

function getCoordinatorRestaurants(coordinatorId = getActiveCoordinatorId()) {
  return state.restaurants.filter((restaurant) => restaurant.coordinatorId === coordinatorId);
}

function getRestaurantsForAssignment(assignment) {
  return getCoordinatorRestaurants(assignment?.coordinatorId || getActiveCoordinatorId());
}

function getRoleLabel(role) {
  return {
    coordinator: "Координатор",
    manager: "Управляющий",
    driver: "Водитель",
  }[role] || "Пользователь";
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function createTraineeUntil(startDate = new Date()) {
  return addDays(startDate, TRAINEE_DAYS).toISOString();
}

function getTraineeText(driver) {
  return driver?.trainee ? `Стажёр до ${formatDate(driver.traineeUntil)}` : "Нет";
}

function renderTraineeBadge(driver) {
  return driver?.trainee ? `<span class="trainee-badge">${escapeHtml(getTraineeText(driver))}</span>` : "";
}

function loadLocalState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || clone(starterData);
  } catch {
    return clone(starterData);
  }
}

function getSharedStateSnapshot() {
  return {
    users: state.users,
    restaurants: state.restaurants,
    assignments: state.assignments,
    dataVersion: state.dataVersion || DATA_VERSION,
  };
}

function mergeById(primary = [], secondary = []) {
  const items = new Map();
  secondary.forEach((item) => items.set(item.id, item));
  primary.forEach((item) => items.set(item.id, item));
  return Array.from(items.values());
}

function mergeSharedState(remoteState, localState, currentUserId) {
  return {
    ...clone(starterData),
    ...remoteState,
    users: Array.isArray(remoteState.users) ? remoteState.users : [],
    restaurants: Array.isArray(remoteState.restaurants) ? remoteState.restaurants : [],
    assignments: Array.isArray(remoteState.assignments) ? remoteState.assignments : [],
    dataVersion: Number(remoteState.dataVersion) || 1,
    currentUserId,
  };
}

async function loadState() {
  const localState = loadLocalState();
  const currentUserId = localState.currentUserId || null;

  if (!firestoreDb) return localState;

  try {
    const snapshot = await firestoreDb.collection(FIREBASE_COLLECTION).doc(FIREBASE_DOCUMENT).get();
    return snapshot.exists ? mergeSharedState(snapshot.data(), localState, currentUserId) : localState;
  } catch (error) {
    console.warn("Firebase load failed, using local data.", error);
    return localState;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (!firestoreDb || isApplyingRemoteState) return;
  firestoreDb.collection(FIREBASE_COLLECTION).doc(FIREBASE_DOCUMENT).set(getSharedStateSnapshot()).catch((error) => {
    console.warn("Firebase save failed, data was saved locally.", error);
  });
}

function initFirebase() {
  if (!window.firebase?.apps) return;
  if (!window.firebase.apps.length) window.firebase.initializeApp(firebaseConfig);
  firestoreDb = window.firebase.firestore();
}

function subscribeToRemoteState() {
  if (!firestoreDb) return;
  firestoreDb.collection(FIREBASE_COLLECTION).doc(FIREBASE_DOCUMENT).onSnapshot(
    (snapshot) => {
      if (!snapshot.exists) return;
      const currentUserId = state.currentUserId;
      isApplyingRemoteState = true;
      const remoteState = snapshot.data();
      state = { ...clone(starterData), ...remoteState, dataVersion: Number(remoteState.dataVersion) || 1, currentUserId };
      migrateState();
      isApplyingRemoteState = false;
      renderApp();
    },
    (error) => console.warn("Firebase realtime sync failed.", error),
  );
}

function migrateState() {
  state.users = Array.isArray(state.users) ? state.users : [];
  state.restaurants = Array.isArray(state.restaurants) ? state.restaurants : [];
  state.assignments = Array.isArray(state.assignments) ? state.assignments : [];
  if ((state.dataVersion || 1) < DATA_VERSION) {
    const seedUserIds = new Set(
      state.users
        .filter((user) => SEED_ACCOUNT_IDS.has(user.id) && user.password === "1234" && ["koord", "driver", "manager"].includes(user.name))
        .map((user) => user.id),
    );
    state.users = state.users.filter((user) => !seedUserIds.has(user.id));
    state.restaurants = [];
    state.assignments = state.assignments.filter((assignment) => !seedUserIds.has(assignment.driverId) && !seedUserIds.has(assignment.coordinatorId));
    if (seedUserIds.has(state.currentUserId)) state.currentUserId = null;
  }
  state.dataVersion = DATA_VERSION;
  const defaultCoordinatorId = getDefaultCoordinatorId();

  state.users.forEach((user) => {
    if (user.role === "driver") {
      user.coordinatorId ||= defaultCoordinatorId;
      user.carNumber ||= "";
      user.trainee = Boolean(user.trainee);
      if (user.trainee && !user.traineeUntil) {
        user.traineeSince ||= new Date().toISOString();
        user.traineeUntil = createTraineeUntil(user.traineeSince);
      }
      if (user.traineeUntil && new Date(user.traineeUntil) <= new Date()) {
        user.trainee = false;
        user.traineeSince = "";
        user.traineeUntil = "";
      }
    }
  });

  state.restaurants.forEach((restaurant) => {
    restaurant.coordinatorId ||= defaultCoordinatorId;
    restaurant.driverPrice = normalizePrice(restaurant.driverPrice);
  });

  state.assignments.forEach((assignment) => {
    assignment.groupId ||= assignment.id;
    assignment.coordinatorId ||= defaultCoordinatorId;
    assignment.driverPrice = normalizePrice(assignment.driverPrice || getRestaurant(assignment.restaurantId)?.driverPrice);
    assignment.arrived = Boolean(assignment.arrived);
    assignment.estimatedFinish ||= "";
  });
}

function setAuthMode(mode) {
  authMode = mode;
  elements.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.mode === mode));
  const isDeleteMode = mode === "delete";
  elements.nameField.classList.toggle("hidden", isDeleteMode);
  elements.passwordField.classList.toggle("hidden", isDeleteMode);
  elements.roleField.hidden = mode !== "register";
  elements.authSubmit.classList.toggle("hidden", isDeleteMode);
  elements.accountAdmin.classList.toggle("hidden", !isDeleteMode);
  elements.authSubmit.textContent = mode === "register" ? "Зарегистрироваться" : "Войти";
  elements.authError.textContent = "";
  renderAccountList();
}

function renderAccountList() {
  const accounts = state.users
    .filter((user) => user.role === "coordinator" || user.role === "manager")
    .sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name, "ru"));
  if (!accounts.length) {
    elements.accountList.innerHTML = '<p class="empty-state">Аккаунтов пока нет.</p>';
    return;
  }

  elements.accountList.innerHTML = accounts.map((user) => {
    const coordinator = user.role === "driver" ? getUser(user.coordinatorId) : null;
    const details =
      user.role === "coordinator"
        ? ` · общих водителей: ${state.users.filter((item) => item.role === "driver").length} · своих ресторанов: ${getCoordinatorRestaurants(user.id).length}`
        : user.role === "driver"
          ? ` · машина: ${user.carNumber || "не указана"} · добавил: ${coordinator ? coordinator.name : "не найден"}`
          : "";

    return `
      <article class="account-item">
        <div>
          <strong>${escapeHtml(user.name)}</strong>
          <span>${getRoleLabel(user.role)}${escapeHtml(details)}</span>
        </div>
        <button type="button" class="danger-btn compact-btn" data-action="delete-account" data-id="${user.id}">Удалить</button>
      </article>
    `;
  }).join("");
}

function handleAuth(event) {
  event.preventDefault();
  const name = elements.nameInput.value.trim();
  const password = elements.passwordInput.value.trim();

  if (!name || !password) {
    elements.authError.textContent = "Введите имя и пароль.";
    return;
  }

  if (authMode === "register") {
    if (state.users.some((user) => user.name.trim().toLowerCase() === name.toLowerCase())) {
      elements.authError.textContent = "Такое имя уже занято.";
      return;
    }

    const role = new FormData(elements.authForm).get("role") || "coordinator";
    const user = { id: createId(), name, password, role };
    state.users.push(user);
    state.currentUserId = user.id;
    saveState();
    elements.authForm.reset();
    renderApp();
    return;
  }

  const user = state.users.find((item) => item.name.trim().toLowerCase() === name.toLowerCase() && item.password === password);
  if (!user) {
    elements.authError.textContent = "Аккаунт не найден или пароль неверный.";
    return;
  }

  state.currentUserId = user.id;
  saveState();
  elements.authForm.reset();
  renderApp();
}

function deleteAccount(id) {
  const user = getUser(id);
  if (!user || !confirm(`Удалить аккаунт "${user.name}"?`)) return;

  state.users = state.users.filter((item) => item.id !== id);
  if (user.role === "coordinator") {
    const restaurantIds = new Set(getCoordinatorRestaurants(id).map((restaurant) => restaurant.id));
    state.restaurants = state.restaurants.filter((restaurant) => restaurant.coordinatorId !== id);
    state.assignments = state.assignments.filter((assignment) => assignment.coordinatorId !== id && !restaurantIds.has(assignment.restaurantId));
  }
  if (user.role === "driver") {
    state.assignments = state.assignments.filter((assignment) => assignment.driverId !== id);
  }
  if (state.currentUserId === id) state.currentUserId = null;
  saveState();
  renderApp();
}

function logout() {
  state.currentUserId = null;
  saveState();
  renderApp();
}

function openDatePicker(input) {
  if (!input) return;
  if (typeof input.showPicker === "function") {
    try {
      input.showPicker();
      return;
    } catch {
      input.focus();
    }
  }
  input.focus();
}

function bindPicker(input) {
  input?.addEventListener("click", () => openDatePicker(input));
  input?.addEventListener("focus", () => openDatePicker(input));
}

function renderApp() {
  migrateState();
  const user = getUser(state.currentUserId);
  elements.authPanel.classList.toggle("hidden", Boolean(user));
  elements.dashboard.classList.toggle("hidden", !user);

  if (!user) {
    renderAccountList();
    return;
  }

  elements.roleLabel.textContent = getRoleLabel(user.role);
  elements.userTitle.textContent = user.name;
  elements.coordinatorView.classList.toggle("hidden", !["coordinator", "manager"].includes(user.role));
  elements.driverView.classList.toggle("hidden", user.role !== "driver");

  if (user.role === "driver") renderDriver(user);
  else renderCoordinator(user);
}

function renderCoordinator(user) {
  const canManage = user.role === "coordinator";
  if (!canManage) coordinatorPage = "main";

  elements.workspaceGrid.classList.toggle("hidden", !canManage);
  elements.coordinatorNav.classList.toggle("hidden", !canManage);
  elements.managerReportFilters.classList.toggle("hidden", user.role !== "manager");

  if (canManage) {
    renderDriverOptions();
    renderRestaurantOptions();
  } else {
    renderManagerReportFilters();
  }

  renderCoordinatorPage();
  renderReport();
}

function renderManagerReportFilters() {
  const coordinators = getCoordinators();
  if (managerReportCoordinatorId !== "all" && !coordinators.some((coordinator) => coordinator.id === managerReportCoordinatorId)) {
    managerReportCoordinatorId = "all";
  }

  elements.managerReportFilters.innerHTML = `
    <button type="button" class="secondary-btn ${managerReportCoordinatorId === "all" ? "active-filter" : ""}" data-report-coordinator="all">Все</button>
    ${coordinators.map((coordinator) => `
      <button type="button" class="secondary-btn ${managerReportCoordinatorId === coordinator.id ? "active-filter" : ""}" data-report-coordinator="${coordinator.id}">
        ${escapeHtml(coordinator.name)}
      </button>
    `).join("")}
  `;
}

function renderCoordinatorPage() {
  elements.coordinatorMain.classList.toggle("hidden", coordinatorPage !== "main");
  elements.driversPage.classList.toggle("hidden", coordinatorPage !== "drivers");
  elements.restaurantsPage.classList.toggle("hidden", coordinatorPage !== "restaurants");
  if (coordinatorPage === "drivers") renderDrivers();
  if (coordinatorPage === "restaurants") renderRestaurants();
}

function setCoordinatorPage(page) {
  coordinatorPage = page;
  editingAssignmentId = null;
  editingRestaurantId = null;
  renderApp();
}

function syncTraineeSinceInput() {
  elements.newDriverTraineeSinceInput.disabled = !elements.newDriverTraineeInput.checked;
  if (!elements.newDriverTraineeInput.checked) elements.newDriverTraineeSinceInput.value = "";
}

function resetRestaurantDriverPrice() {
  elements.restaurantDriverPriceInput.value = String(DRIVER_RATE);
}

function renderDriverOptions() {
  const query = elements.driverSearchInput.value.trim();
  const drivers = state.users.filter((user) => user.role === "driver" && (includesSearch(user.name, query) || includesSearch(user.carNumber, query)));

  elements.driverChecklist.innerHTML = drivers.length ? drivers.map((driver) => `
    <label class="driver-choice">
      <input type="checkbox" name="driverIds" value="${driver.id}" ${selectedAssignmentDriverIds.has(driver.id) ? "checked" : ""} />
      <span>${escapeHtml(driver.name)}${driver.carNumber ? ` · ${escapeHtml(driver.carNumber)}` : ""}</span>
      ${renderTraineeBadge(driver)}
    </label>
  `).join("") : '<p class="empty-state">Водители не найдены.</p>';
}

function renderRestaurantOptions() {
  const query = elements.assignmentRestaurantSearchInput.value.trim();
  elements.restaurantSelect.innerHTML = getCoordinatorRestaurants()
    .filter((restaurant) => includesSearch(restaurant.name, query))
    .map((restaurant) => `<option value="${restaurant.id}">${escapeHtml(restaurant.name)}</option>`)
    .join("");
}

function restaurantOptions(selectedId, assignment) {
  return getRestaurantsForAssignment(assignment).map((restaurant) => `
    <option value="${restaurant.id}" ${restaurant.id === selectedId ? "selected" : ""}>${escapeHtml(restaurant.name)}</option>
  `).join("");
}

function renderDrivers() {
  const query = elements.driverManageSearchInput.value.trim();
  const allDrivers = state.users.filter((user) => user.role === "driver");
  const drivers = allDrivers.filter((driver) => includesSearch(driver.name, query) || includesSearch(driver.carNumber, query));
  elements.driversCount.textContent = query ? `В списке: ${drivers.length} из ${allDrivers.length}` : `Всего: ${allDrivers.length}`;

  elements.driverManageList.innerHTML = drivers.length ? drivers.map((driver) => `
    <article class="restaurant-item">
      <strong>${escapeHtml(driver.name)}</strong>
      <span>${driver.carNumber ? `Машина: ${escapeHtml(driver.carNumber)}` : "Номер машины не указан"}</span>
      ${driver.trainee ? renderTraineeBadge(driver) : "<span>Основной водитель</span>"}
      <div class="item-actions">
        <button type="button" class="danger-btn compact-btn" data-action="delete-driver" data-id="${driver.id}">Удалить</button>
      </div>
    </article>
  `).join("") : '<p class="empty-state">Водители не найдены.</p>';
}

function renderRestaurants() {
  const query = elements.restaurantSearchInput.value.trim();
  const allRestaurants = getCoordinatorRestaurants();
  const restaurants = allRestaurants.filter((restaurant) => includesSearch(restaurant.name, query));
  elements.restaurantsCount.textContent = query ? `В списке: ${restaurants.length} из ${allRestaurants.length}` : `Всего: ${allRestaurants.length}`;

  elements.restaurantList.innerHTML = restaurants.length ? restaurants.map((restaurant) => {
    const count = filteredAssignments().filter((assignment) => assignment.restaurantId === restaurant.id).length;
    const sum = formatMoney(count * normalizePrice(restaurant.driverPrice));

    if (restaurant.id === editingRestaurantId) {
      return `
        <article class="restaurant-item">
          <div class="restaurant-edit">
            <input type="text" data-restaurant-field="name" data-id="${restaurant.id}" value="${escapeHtml(restaurant.name)}" placeholder="Название ресторана" />
            <input type="number" data-restaurant-field="driverPrice" data-id="${restaurant.id}" value="${escapeHtml(restaurant.driverPrice)}" placeholder="Сумма водителю" min="0" step="100" />
          </div>
          <span>${count} водителей за выбранный месяц · ${sum}</span>
          <span>Водителю: ${formatMoney(restaurant.driverPrice)}</span>
          <div class="item-actions">
            <button type="button" class="secondary-btn compact-btn" data-action="save-restaurant" data-id="${restaurant.id}">Сохранить</button>
            <button type="button" class="secondary-btn compact-btn" data-action="cancel-restaurant-edit">Отмена</button>
            <button type="button" class="danger-btn compact-btn" data-action="delete-restaurant" data-id="${restaurant.id}">Удалить</button>
          </div>
        </article>
      `;
    }

    return `
      <article class="restaurant-item">
        <strong>${escapeHtml(restaurant.name)}</strong>
        <span>Сумма водителю: ${formatMoney(restaurant.driverPrice)}</span>
        <span>${count} водителей за выбранный месяц · ${sum}</span>
        <div class="item-actions">
          <button type="button" class="secondary-btn compact-btn" data-action="edit-restaurant" data-id="${restaurant.id}">Изменить</button>
          <button type="button" class="danger-btn compact-btn" data-action="delete-restaurant" data-id="${restaurant.id}">Удалить</button>
        </div>
      </article>
    `;
  }).join("") : '<p class="empty-state">Рестораны не найдены.</p>';
}

function filteredAssignments() {
  const month = elements.monthFilter.value || currentMonth();
  const dateFrom = elements.reportDateFromInput.value;
  const dateTo = elements.reportDateToInput.value;
  const currentUser = getUser(state.currentUserId);

  return state.assignments.filter((assignment) => {
    const date = assignment.time.slice(0, 10);
    const coordinatorMatches =
      currentUser?.role !== "coordinator" ||
      assignment.coordinatorId === currentUser.id;
    const managerMatches =
      currentUser?.role !== "manager" ||
      managerReportCoordinatorId === "all" ||
      assignment.coordinatorId === managerReportCoordinatorId;
    return assignment.time.startsWith(month) && (!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo) && coordinatorMatches && managerMatches;
  });
}

function groupAssignments(assignments) {
  const groups = new Map();
  assignments.forEach((assignment) => {
    const groupId = assignment.groupId || assignment.id;
    if (!groups.has(groupId)) {
      groups.set(groupId, {
        id: groupId,
        coordinatorId: assignment.coordinatorId,
        restaurantId: assignment.restaurantId,
        time: assignment.time,
        assignments: [],
      });
    }
    groups.get(groupId).assignments.push(assignment);
  });
  return Array.from(groups.values());
}

function reportMatchesSearch(assignment, query) {
  if (!query) return true;
  const driver = getUser(assignment.driverId);
  const restaurant = getRestaurant(assignment.restaurantId);
  const coordinator = getUser(assignment.coordinatorId);
  const values = [driver?.name, driver?.carNumber, restaurant?.name, coordinator?.name, assignment.time, formatDate(assignment.time)];
  return values.some((value) => includesSearch(value, query));
}

function renderReport() {
  if (!elements.monthFilter.value) elements.monthFilter.value = currentMonth();
  const currentUser = getUser(state.currentUserId);
  const isManager = currentUser?.role === "manager";
  const canEdit = currentUser?.role === "coordinator" || currentUser?.role === "manager";
  const query = elements.reportSearchInput.value.trim();
  const groups = groupAssignments(filteredAssignments().filter((assignment) => reportMatchesSearch(assignment, query)))
    .sort((a, b) => new Date(a.time) - new Date(b.time));
  const visibleAssignments = groups.flatMap((group) => group.assignments);

  elements.reportHead.innerHTML = `
    <th>Дата</th>
    ${isManager ? "<th>Координатор</th>" : ""}
    <th>Водители</th>
    <th>Стажировка</th>
    <th>Ресторан</th>
    <th>Сумма</th>
    <th></th>
  `;
  elements.assignedCount.textContent = String(visibleAssignments.length);
  elements.totalAmount.textContent = formatMoney(visibleAssignments.reduce((sum, assignment) => sum + getAssignmentDriverPrice(assignment), 0));
  renderReportSearchSummary(visibleAssignments, query);

  if (!groups.length) {
    elements.reportBody.innerHTML = `<tr><td colspan="${isManager ? 7 : 6}">За этот месяц назначений нет.</td></tr>`;
    return;
  }

  elements.reportBody.innerHTML = groups.map((group) => renderReportGroup(group, { isManager, canEdit })).join("");
}

function getAssignmentDriverPrice(assignment) {
  return normalizePrice(assignment.driverPrice || getRestaurant(assignment.restaurantId)?.driverPrice);
}

function renderReportSearchSummary(assignments, query) {
  if (!query) {
    elements.reportSearchSummary.textContent = "";
    return;
  }
  elements.reportSearchSummary.textContent = assignments.length ? `Найдено: ${assignments.length}` : "Заказов не найдено";
}

function renderReportGroup(group, options) {
  const drivers = group.assignments.map((assignment) => getUser(assignment.driverId)).filter(Boolean);
  const restaurant = getRestaurant(group.restaurantId);
  const coordinator = getUser(group.coordinatorId);
  const total = group.assignments.reduce((sum, assignment) => sum + getAssignmentDriverPrice(assignment), 0);
  const firstAssignment = group.assignments[0];
  const driverPrice = getAssignmentDriverPrice(firstAssignment);

  if (options.canEdit && group.id === editingAssignmentId) {
    return `
      <tr>
        <td><input type="date" data-edit-field="time" data-id="${group.id}" value="${escapeHtml(group.time.slice(0, 10))}" /></td>
        ${options.isManager ? `<td>${escapeHtml(coordinator?.name || "Удалённый координатор")}</td>` : ""}
        <td>
          <div class="driver-checklist report-driver-editor">
            ${renderGroupDriverEditor(group)}
          </div>
        </td>
        <td>${renderGroupTraineeList(drivers)}</td>
        <td><select data-edit-field="restaurantId" data-id="${group.id}">${restaurantOptions(group.restaurantId, firstAssignment)}</select></td>
        <td><input type="number" data-edit-field="driverPrice" data-id="${group.id}" value="${escapeHtml(driverPrice)}" min="0" step="100" /></td>
        <td class="actions-cell">
          <button type="button" class="secondary-btn compact-btn" data-action="save-assignment" data-id="${group.id}">Сохранить</button>
          <button type="button" class="secondary-btn compact-btn" data-action="cancel-edit">Отмена</button>
          <button type="button" class="danger-btn compact-btn" data-action="delete-assignment" data-id="${group.id}">Удалить</button>
        </td>
      </tr>
    `;
  }

  return `
    <tr>
      <td>${formatDate(group.time)}</td>
      ${options.isManager ? `<td>${escapeHtml(coordinator?.name || "Удалённый координатор")}</td>` : ""}
      <td>${drivers.length ? drivers.map((driver) => `${escapeHtml(driver.name)}${driver.carNumber ? ` · ${escapeHtml(driver.carNumber)}` : ""}`).join("<br>") : "Удалённый водитель"}</td>
      <td>${renderGroupTraineeList(drivers)}</td>
      <td>${escapeHtml(restaurant?.name || "Удалённый ресторан")}</td>
      <td>${formatMoney(total)}</td>
      <td>${options.canEdit ? `
        <div class="actions-cell">
          <button type="button" class="secondary-btn compact-btn" data-action="edit-assignment" data-id="${group.id}">Изменить</button>
          <button type="button" class="danger-btn compact-btn" data-action="delete-assignment" data-id="${group.id}">Удалить</button>
        </div>
      ` : ""}</td>
    </tr>
  `;
}

function renderGroupDriverEditor(group) {
  const selectedDriverIds = new Set(group.assignments.map((assignment) => assignment.driverId));
  return state.users.filter((user) => user.role === "driver").map((driver) => `
    <label class="driver-choice">
      <input type="checkbox" data-edit-driver-id="${driver.id}" data-id="${group.id}" ${selectedDriverIds.has(driver.id) ? "checked" : ""} />
      <span>${escapeHtml(driver.name)}${driver.carNumber ? ` · ${escapeHtml(driver.carNumber)}` : ""}</span>
      ${renderTraineeBadge(driver)}
    </label>
  `).join("");
}

function renderGroupTraineeList(drivers) {
  const trainees = drivers.filter((driver) => driver.trainee);
  return trainees.length ? trainees.map((driver) => renderTraineeBadge(driver)).join("<br>") : "Нет";
}

function renderDriver(user) {
  const assignments = state.assignments.filter((assignment) => assignment.driverId === user.id).sort((a, b) => new Date(a.time) - new Date(b.time));
  elements.driverAssignments.innerHTML = assignments.length ? assignments.map((assignment) => {
    const restaurant = getRestaurant(assignment.restaurantId);
    return `
      <article class="assignment-item">
        <strong>${escapeHtml(restaurant?.name || "Ресторан не найден")}</strong>
        <span>${formatDate(assignment.time)}</span>
        ${renderTraineeBadge(user)}
        <span>${formatMoney(getAssignmentDriverPrice(assignment))} за заказ</span>
        <label class="check-row">
          <input type="checkbox" data-action="toggle-arrived" data-id="${assignment.id}" ${assignment.arrived ? "checked" : ""} />
          <span>Я приехал</span>
        </label>
        <div class="finish-row">
          <input type="text" data-finish-input="${assignment.id}" value="${escapeHtml(assignment.estimatedFinish)}" placeholder="Примерно закончу в 18:30" />
          <button type="button" class="secondary-btn" data-action="save-finish" data-id="${assignment.id}">Сохранить</button>
        </div>
      </article>
    `;
  }).join("") : '<p class="empty-state">Пока назначений нет.</p>';
}

function handleAssignment(event) {
  event.preventDefault();
  const selectedDriverIds = Array.from(selectedAssignmentDriverIds).filter((driverId) => getUser(driverId)?.role === "driver");
  if (!selectedDriverIds.length || !elements.restaurantSelect.value || !elements.timeInput.value) {
    elements.assignmentHint.textContent = "Выберите водителя, ресторан и дату.";
    return;
  }

  const groupId = createId();
  const selectedRestaurant = getRestaurant(elements.restaurantSelect.value);
  const driverPrice = normalizePrice(selectedRestaurant?.driverPrice);
  selectedDriverIds.forEach((driverId) => {
    state.assignments.push({
      id: createId(),
      groupId,
      driverId,
      restaurantId: elements.restaurantSelect.value,
      time: elements.timeInput.value,
      driverPrice,
      coordinatorId: state.currentUserId,
      arrived: false,
      estimatedFinish: "",
    });
  });

  selectedAssignmentDriverIds.clear();
  elements.assignmentForm.reset();
  elements.assignmentHint.textContent = "Водитель назначен.";
  saveState();
  renderApp();
}

function handleDriverCreate(event) {
  event.preventDefault();
  const name = elements.newDriverNameInput.value.trim();
  const carNumber = elements.newDriverCarInput.value.trim();
  const coordinatorId = getActiveCoordinatorId();
  if (!name || !carNumber || !coordinatorId) return;

  const traineeSince = elements.newDriverTraineeInput.checked
    ? new Date(`${elements.newDriverTraineeSinceInput.value || new Date().toISOString().slice(0, 10)}T00:00:00`)
    : null;

  state.users.push({
    id: createId(),
    name,
    password: "",
    role: "driver",
    coordinatorId,
    carNumber,
    trainee: Boolean(traineeSince),
    traineeSince: traineeSince ? traineeSince.toISOString() : "",
    traineeUntil: traineeSince ? createTraineeUntil(traineeSince) : "",
  });

  elements.driverForm.reset();
  syncTraineeSinceInput();
  saveState();
  renderApp();
}

function handleRestaurant(event) {
  event.preventDefault();
  const name = elements.restaurantNameInput.value.trim();
  const coordinatorId = getActiveCoordinatorId();
  if (!name || !coordinatorId) return;

  const driverPrice = normalizePrice(elements.restaurantDriverPriceInput.value);
  state.restaurants.push({ id: createId(), coordinatorId, name, driverPrice });
  elements.restaurantForm.reset();
  resetRestaurantDriverPrice();
  saveState();
  renderApp();
}

function handleReportAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;

  if (action === "edit-assignment") {
    editingAssignmentId = id;
    renderApp();
    return;
  }

  if (action === "cancel-edit") {
    editingAssignmentId = null;
    renderApp();
    return;
  }

  if (action === "delete-assignment") {
    if (!confirm("Удалить это назначение?")) return;
    state.assignments = state.assignments.filter((assignment) => (assignment.groupId || assignment.id) !== id);
    editingAssignmentId = null;
    saveState();
    renderApp();
    return;
  }

  if (action === "save-assignment") {
    const groupAssignments = state.assignments.filter((assignment) => (assignment.groupId || assignment.id) === id);
    if (!groupAssignments.length) return;

    const time = elements.reportBody.querySelector(`[data-edit-field="time"][data-id="${id}"]`)?.value || groupAssignments[0].time;
    const restaurantId = elements.reportBody.querySelector(`[data-edit-field="restaurantId"][data-id="${id}"]`)?.value || groupAssignments[0].restaurantId;
    const driverPrice = normalizePrice(elements.reportBody.querySelector(`[data-edit-field="driverPrice"][data-id="${id}"]`)?.value);
    const selectedDriverIds = Array.from(elements.reportBody.querySelectorAll(`[data-edit-driver-id][data-id="${id}"]:checked`)).map((input) => input.dataset.editDriverId);
    if (!selectedDriverIds.length) return;

    const existingDriverIds = new Set(groupAssignments.map((assignment) => assignment.driverId));
    const selectedDriverIdSet = new Set(selectedDriverIds);
    groupAssignments.forEach((assignment) => {
      assignment.time = time;
      assignment.restaurantId = restaurantId;
      assignment.driverPrice = driverPrice;
      assignment.groupId = id;
    });
    state.assignments = state.assignments.filter((assignment) => (assignment.groupId || assignment.id) !== id || selectedDriverIdSet.has(assignment.driverId));
    selectedDriverIds.forEach((driverId) => {
      if (existingDriverIds.has(driverId)) return;
      state.assignments.push({ id: createId(), groupId: id, driverId, restaurantId, time, driverPrice, coordinatorId: groupAssignments[0].coordinatorId, arrived: false, estimatedFinish: "" });
    });
    editingAssignmentId = null;
    saveState();
    renderApp();
  }
}

function handleRestaurantAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;

  if (action === "edit-restaurant") {
    editingRestaurantId = id;
    renderRestaurants();
    return;
  }
  if (action === "cancel-restaurant-edit") {
    editingRestaurantId = null;
    renderRestaurants();
    return;
  }
  if (action === "delete-restaurant") {
    if (!confirm("Удалить этот ресторан? Назначения с ним останутся в отчёте как удалённый ресторан.")) return;
    state.restaurants = state.restaurants.filter((restaurant) => restaurant.id !== id);
    editingRestaurantId = null;
    saveState();
    renderApp();
    return;
  }
  if (action === "save-restaurant") {
    const restaurant = getRestaurant(id);
    if (!restaurant) return;
    const name = elements.restaurantList.querySelector(`[data-restaurant-field="name"][data-id="${id}"]`)?.value.trim();
    const price = elements.restaurantList.querySelector(`[data-restaurant-field="driverPrice"][data-id="${id}"]`)?.value;
    if (!name) return;
    restaurant.name = name;
    restaurant.driverPrice = normalizePrice(price);
    editingRestaurantId = null;
    saveState();
    renderApp();
  }
}

function handleDriverManageAction(event) {
  const button = event.target.closest("[data-action='delete-driver']");
  if (!button) return;
  state.users = state.users.filter((user) => user.id !== button.dataset.id);
  state.assignments = state.assignments.filter((assignment) => assignment.driverId !== button.dataset.id);
  saveState();
  renderApp();
}

function handleDriverAction(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const assignment = state.assignments.find((item) => item.id === target.dataset.id);
  if (!assignment) return;

  if (target.dataset.action === "toggle-arrived") {
    assignment.arrived = target.checked;
  }
  if (target.dataset.action === "save-finish") {
    assignment.estimatedFinish = elements.driverAssignments.querySelector(`[data-finish-input="${assignment.id}"]`)?.value.trim() || "";
  }
  saveState();
  renderApp();
}

async function startApp() {
  initFirebase();
  state = await loadState();
  migrateState();
  saveState();
  subscribeToRemoteState();
  renderApp();
  syncTraineeSinceInput();
  resetRestaurantDriverPrice();
}

elements.tabs.forEach((tab) => tab.addEventListener("click", () => setAuthMode(tab.dataset.mode)));
elements.accountList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action='delete-account']");
  if (button) deleteAccount(button.dataset.id);
});
elements.authForm.addEventListener("submit", handleAuth);
elements.logoutBtn.addEventListener("click", logout);
elements.assignmentForm.addEventListener("submit", handleAssignment);
elements.driverChecklist.addEventListener("change", (event) => {
  const checkbox = event.target.closest('input[name="driverIds"]');
  if (!checkbox) return;
  if (checkbox.checked) selectedAssignmentDriverIds.add(checkbox.value);
  else selectedAssignmentDriverIds.delete(checkbox.value);
});
elements.driverForm.addEventListener("submit", handleDriverCreate);
elements.restaurantForm.addEventListener("submit", handleRestaurant);
elements.restaurantList.addEventListener("click", handleRestaurantAction);
elements.driverManageList.addEventListener("click", handleDriverManageAction);
elements.reportBody.addEventListener("click", handleReportAction);
elements.driverAssignments.addEventListener("click", handleDriverAction);
elements.driverAssignments.addEventListener("change", handleDriverAction);
elements.driverSearchInput.addEventListener("input", renderDriverOptions);
elements.assignmentRestaurantSearchInput.addEventListener("input", renderRestaurantOptions);
elements.driverManageSearchInput.addEventListener("input", renderDrivers);
elements.restaurantSearchInput.addEventListener("input", renderRestaurants);
elements.reportSearchInput.addEventListener("input", renderReport);
elements.reportDateFromInput.addEventListener("change", renderReport);
elements.reportDateToInput.addEventListener("change", renderReport);
elements.monthFilter.addEventListener("change", renderApp);
elements.newDriverTraineeInput.addEventListener("change", syncTraineeSinceInput);
[
  elements.timeInput,
  elements.monthFilter,
  elements.reportDateFromInput,
  elements.reportDateToInput,
  elements.newDriverTraineeSinceInput,
].forEach(bindPicker);
elements.reportBody.addEventListener("click", (event) => {
  const dateInput = event.target.closest('input[type="date"], input[type="month"]');
  if (dateInput) openDatePicker(dateInput);
});
elements.reportBody.addEventListener("focusin", (event) => {
  const dateInput = event.target.closest('input[type="date"], input[type="month"]');
  if (dateInput) openDatePicker(dateInput);
});
elements.coordinatorView.addEventListener("click", (event) => {
  const reportCoordinatorButton = event.target.closest("[data-report-coordinator]");
  if (reportCoordinatorButton) {
    managerReportCoordinatorId = reportCoordinatorButton.dataset.reportCoordinator;
    editingAssignmentId = null;
    renderApp();
    return;
  }
  const pageButton = event.target.closest("[data-page]");
  if (pageButton) setCoordinatorPage(pageButton.dataset.page);
});

startApp();
