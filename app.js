const COORDINATOR_RATE = 4500;
const DRIVER_RATE = 3000;
const TRAINEE_DAYS = 60;
const STORAGE_KEY = "driver-routing-app";

const starterData = {
  users: [
    { id: "u1", name: "koord", password: "1234", role: "coordinator" },
    { id: "u2", name: "driver", password: "1234", role: "driver", coordinatorId: "u1", carNumber: "", trainee: false },
    { id: "u3", name: "manager", password: "1234", role: "manager" },
  ],
  restaurants: [
    { id: "r1", coordinatorId: "u1", name: "Burger House", mapUrl: "", price: COORDINATOR_RATE, driverPrice: DRIVER_RATE },
    { id: "r2", coordinatorId: "u1", name: "Sushi Time", mapUrl: "", price: COORDINATOR_RATE, driverPrice: DRIVER_RATE },
    { id: "r3", coordinatorId: "u1", name: "Pizza City", mapUrl: "", price: COORDINATOR_RATE, driverPrice: DRIVER_RATE },
  ],
  assignments: [],
  currentUserId: null,
};

const state = loadState();
migrateState();

const elements = {
  authPanel: document.querySelector("#authPanel"),
  dashboard: document.querySelector("#dashboard"),
  authForm: document.querySelector("#authForm"),
  authError: document.querySelector("#authError"),
  authSubmit: document.querySelector("#authSubmit"),
  accountAdmin: document.querySelector("#accountAdmin"),
  accountList: document.querySelector("#accountList"),
  roleField: document.querySelector("#roleField"),
  nameField: document.querySelector("#nameField"),
  nameInput: document.querySelector("#nameInput"),
  passwordField: document.querySelector("#passwordField"),
  passwordInput: document.querySelector("#passwordInput"),
  tabs: document.querySelectorAll(".tab"),
  logoutBtn: document.querySelector("#logoutBtn"),
  roleLabel: document.querySelector("#roleLabel"),
  userTitle: document.querySelector("#userTitle"),
  coordinatorView: document.querySelector("#coordinatorView"),
  driverView: document.querySelector("#driverView"),
  coordinatorNav: document.querySelector("#coordinatorNav"),
  coordinatorMain: document.querySelector("#coordinatorMain"),
  managerReportFilters: document.querySelector("#managerReportFilters"),
  driversPage: document.querySelector("#driversPage"),
  restaurantsPage: document.querySelector("#restaurantsPage"),
  workspaceGrid: document.querySelector(".workspace-grid"),
  driverSearchInput: document.querySelector("#driverSearchInput"),
  driverChecklist: document.querySelector("#driverChecklist"),
  assignmentRestaurantSearchInput: document.querySelector("#assignmentRestaurantSearchInput"),
  restaurantSelect: document.querySelector("#restaurantSelect"),
  timeInput: document.querySelector("#timeInput"),
  assignmentForm: document.querySelector("#assignmentForm"),
  assignmentHint: document.querySelector("#assignmentHint"),
  driverForm: document.querySelector("#driverForm"),
  newDriverNameInput: document.querySelector("#newDriverNameInput"),
  newDriverCarInput: document.querySelector("#newDriverCarInput"),
  newDriverTraineeInput: document.querySelector("#newDriverTraineeInput"),
  newDriverTraineeSinceInput: document.querySelector("#newDriverTraineeSinceInput"),
  driverManageSearchInput: document.querySelector("#driverManageSearchInput"),
  driverManageList: document.querySelector("#driverManageList"),
  driversCount: document.querySelector("#driversCount"),
  restaurantForm: document.querySelector("#restaurantForm"),
  restaurantNameInput: document.querySelector("#restaurantNameInput"),
  restaurantDriverPriceInput: document.querySelector("#restaurantDriverPriceInput"),
  restaurantSearchInput: document.querySelector("#restaurantSearchInput"),
  restaurantList: document.querySelector("#restaurantList"),
  restaurantsCount: document.querySelector("#restaurantsCount"),
  monthFilter: document.querySelector("#monthFilter"),
  reportSearchInput: document.querySelector("#reportSearchInput"),
  reportDateFromInput: document.querySelector("#reportDateFromInput"),
  reportDateToInput: document.querySelector("#reportDateToInput"),
  reportSearchSummary: document.querySelector("#reportSearchSummary"),
  reportHead: document.querySelector("#reportHead"),
  reportBody: document.querySelector("#reportBody"),
  assignedCount: document.querySelector("#assignedCount"),
  totalAmount: document.querySelector("#totalAmount"),
  driverAssignments: document.querySelector("#driverAssignments"),
};

let authMode = "login";
let editingAssignmentId = null;
let editingRestaurantId = null;
let coordinatorPage = "main";
let managerReportCoordinatorId = "all";
const selectedAssignmentDriverIds = new Set();

function cloneStarterData() {
  return JSON.parse(JSON.stringify(starterData));
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return cloneStarterData();
  }

  try {
    return JSON.parse(saved);
  } catch {
    return cloneStarterData();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizePrice(value) {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? price : COORDINATOR_RATE;
}

function getAssignmentDriverPrice(assignment) {
  const restaurant = getRestaurant(assignment.restaurantId);
  return restaurant ? normalizePrice(restaurant.driverPrice || DRIVER_RATE) : DRIVER_RATE;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function createTraineeUntil(startDate = new Date()) {
  return addDays(startDate, TRAINEE_DAYS).toISOString();
}

function createDateFromInput(value) {
  return value ? new Date(`${value}T00:00:00`) : new Date();
}

function refreshTraineeStatus(user, now = new Date()) {
  if (!user || user.role !== "driver" || !user.trainee) {
    return false;
  }

  if (!user.traineeUntil) {
    user.traineeSince = user.traineeSince || now.toISOString();
    user.traineeUntil = createTraineeUntil(user.traineeSince);
  }

  if (new Date(user.traineeUntil) <= now) {
    user.trainee = false;
    user.traineeSince = "";
    user.traineeUntil = "";
    return true;
  }

  return false;
}

function refreshAllTrainees() {
  let changed = false;
  state.users.forEach((user) => {
    changed = refreshTraineeStatus(user) || changed;
  });

  if (changed) {
    saveState();
  }
}

function migrateState() {
  if (!Array.isArray(state.users)) {
    state.users = [];
  }
  if (!Array.isArray(state.restaurants)) {
    state.restaurants = [];
  }
  if (!Array.isArray(state.assignments)) {
    state.assignments = [];
  }

  const defaultCoordinatorId = getDefaultCoordinatorId();

  state.restaurants.forEach((restaurant) => {
    restaurant.coordinatorId = restaurant.coordinatorId || defaultCoordinatorId;
    restaurant.mapUrl = restaurant.mapUrl || "";
    restaurant.driverPrice = normalizePrice(restaurant.driverPrice || DRIVER_RATE);
    restaurant.price = normalizePrice(restaurant.price || restaurant.driverPrice);
  });

  state.users.forEach((user) => {
    if (user.role === "driver") {
      user.coordinatorId = user.coordinatorId || defaultCoordinatorId;
      user.carNumber = user.carNumber || "";
      user.trainee = Boolean(user.trainee);
      refreshTraineeStatus(user);
    }
  });

  state.assignments.forEach((assignment) => {
    const driver = getUser(assignment.driverId);
    const restaurant = getRestaurant(assignment.restaurantId);
    assignment.coordinatorId =
      assignment.coordinatorId || driver?.coordinatorId || restaurant?.coordinatorId || defaultCoordinatorId;
    assignment.groupId = assignment.groupId || assignment.id;
    assignment.arrived = Boolean(assignment.arrived);
    assignment.estimatedFinish = assignment.estimatedFinish || "";
  });

  saveState();
}

function formatMoney(value) {
  return `${value.toLocaleString("ru-RU")} тг`;
}

function formatDateTime(value) {
  if (String(value).length === 10) {
    return formatDate(value);
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const chars = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return chars[char];
  });
}

function getTraineeText(driver) {
  if (!driver || !driver.trainee) {
    return "Нет";
  }

  return `Стажер до ${formatDate(driver.traineeUntil)}`;
}

function renderTraineeBadge(driver) {
  return driver && driver.trainee ? `<span class="trainee-badge">${escapeHtml(getTraineeText(driver))}</span>` : "";
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getUser(id) {
  return state.users.find((user) => user.id === id);
}

function getRestaurant(id) {
  return state.restaurants.find((restaurant) => restaurant.id === id);
}

function getDefaultCoordinatorId() {
  const starterCoordinator = state.users.find((user) => user.id === "u1" && user.role === "coordinator");
  if (starterCoordinator) {
    return starterCoordinator.id;
  }

  return state.users.find((user) => user.role === "coordinator")?.id || "";
}

function getCoordinators() {
  return state.users.filter((user) => user.role === "coordinator");
}

function getActiveCoordinatorId() {
  const currentUser = getUser(state.currentUserId);
  return currentUser && currentUser.role === "coordinator" ? currentUser.id : "";
}

function getVisibleCoordinatorIds() {
  const currentUser = getUser(state.currentUserId);
  if (!currentUser) {
    return [];
  }

  if (currentUser.role === "coordinator") {
    return [currentUser.id];
  }

  if (currentUser.role === "manager") {
    if (managerReportCoordinatorId === "all") {
      return getCoordinators().map((coordinator) => coordinator.id);
    }

    return [managerReportCoordinatorId];
  }

  return [];
}

function belongsToCoordinator(item, coordinatorId) {
  return item.coordinatorId === coordinatorId;
}

function includesSearch(value, query) {
  return String(value || "").toLowerCase().includes(query.toLowerCase());
}

function normalizeLoginName(value) {
  return String(value || "").trim().toLowerCase();
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

function syncTraineeSinceInput() {
  elements.newDriverTraineeSinceInput.disabled = !elements.newDriverTraineeInput.checked;
  if (!elements.newDriverTraineeInput.checked) {
    elements.newDriverTraineeSinceInput.value = "";
  }
}

function resetRestaurantDriverPrice() {
  elements.restaurantDriverPriceInput.value = String(DRIVER_RATE);
}

function getRoleLabel(role) {
  const roleLabels = {
    coordinator: "Координатор",
    driver: "Водитель",
    manager: "Управляющий",
  };

  return roleLabels[role] || "Пользователь";
}

function getCoordinatorCounts(coordinatorId) {
  return {
    drivers: state.users.filter((user) => user.role === "driver" && user.coordinatorId === coordinatorId).length,
    restaurants: state.restaurants.filter((restaurant) => restaurant.coordinatorId === coordinatorId).length,
  };
}

function renderAccountList() {
  if (!elements.accountList) {
    return;
  }

  const accounts = state.users.filter((user) => user.role !== "driver");
  if (!accounts.length) {
    elements.accountList.innerHTML = '<p class="empty-state">Аккаунтов пока нет.</p>';
    return;
  }

  elements.accountList.innerHTML = accounts
    .map((user) => {
      const counts = user.role === "coordinator" ? getCoordinatorCounts(user.id) : null;
      const countText = counts ? ` · Водителей: ${counts.drivers} · Ресторанов: ${counts.restaurants}` : "";

      return `
        <article class="account-item">
          <div>
            <strong>${escapeHtml(user.name)}</strong>
            <span>${getRoleLabel(user.role)}${countText}</span>
          </div>
          <button type="button" class="danger-btn compact-btn" data-action="delete-account" data-id="${user.id}">Удалить</button>
        </article>
      `;
    })
    .join("");
}

function deleteAccount(id) {
  const user = getUser(id);
  if (!user) {
    return;
  }

  if (!confirm(`Удалить аккаунт "${user.name}"?`)) {
    return;
  }

  if (user.role === "coordinator") {
    const driverIds = state.users
      .filter((item) => item.role === "driver" && item.coordinatorId === user.id)
      .map((driver) => driver.id);
    const restaurantIds = state.restaurants
      .filter((restaurant) => restaurant.coordinatorId === user.id)
      .map((restaurant) => restaurant.id);

    state.users = state.users.filter((item) => item.id !== user.id && !driverIds.includes(item.id));
    state.restaurants = state.restaurants.filter((restaurant) => !restaurantIds.includes(restaurant.id));
    state.assignments = state.assignments.filter(
      (assignment) =>
        assignment.coordinatorId !== user.id &&
        !driverIds.includes(assignment.driverId) &&
        !restaurantIds.includes(assignment.restaurantId),
    );
  } else {
    state.users = state.users.filter((item) => item.id !== user.id);
  }

  if (state.currentUserId === user.id) {
    state.currentUserId = null;
  }

  saveState();
  renderAccountList();
  renderApp();
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
    if (state.users.some((user) => normalizeLoginName(user.name) === normalizeLoginName(name))) {
      elements.authError.textContent = "Такое имя уже занято.";
      return;
    }

    const role = new FormData(elements.authForm).get("role") || "coordinator";
    const user = {
      id: createId(),
      name,
      password,
      role,
    };
    state.users.push(user);
    state.currentUserId = user.id;
    saveState();
    elements.authForm.reset();
    renderApp();
    return;
  }

  const user = state.users.find(
    (item) => normalizeLoginName(item.name) === normalizeLoginName(name) && item.password === password
  );
  if (!user) {
    elements.authError.textContent = "Аккаунт не найден или пароль неверный.";
    return;
  }

  state.currentUserId = user.id;
  saveState();
  elements.authForm.reset();
  renderApp();
}

function logout() {
  state.currentUserId = null;
  saveState();
  renderApp();
}

function renderApp() {
  refreshAllTrainees();
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

  if (user.role === "coordinator" || user.role === "manager") {
    renderCoordinator(user);
  } else {
    renderDriver(user);
  }
}

function renderCoordinator(user = getUser(state.currentUserId)) {
  const canManageAssignments = user && user.role === "coordinator";
  if (!canManageAssignments) {
    coordinatorPage = "main";
  }

  elements.workspaceGrid.classList.toggle("hidden", !canManageAssignments);
  elements.coordinatorNav.classList.toggle("hidden", !canManageAssignments);
  elements.managerReportFilters.classList.toggle("hidden", !(user && user.role === "manager"));

  if (canManageAssignments) {
    renderDriverOptions();
    renderRestaurantOptions();
  } else {
    renderManagerReportFilters();
  }

  renderCoordinatorPage();
  renderReport();
}

function renderManagerReportFilters() {
  const currentUser = getUser(state.currentUserId);
  if (!currentUser || currentUser.role !== "manager") {
    return;
  }

  const coordinatorIds = getCoordinators().map((coordinator) => coordinator.id);
  if (managerReportCoordinatorId !== "all" && !coordinatorIds.includes(managerReportCoordinatorId)) {
    managerReportCoordinatorId = "all";
  }

  const coordinatorButtons = getCoordinators()
    .map(
      (coordinator) => `
        <button type="button" class="secondary-btn ${managerReportCoordinatorId === coordinator.id ? "active-filter" : ""}" data-report-coordinator="${coordinator.id}">
          ${escapeHtml(coordinator.name)}
        </button>
      `,
    )
    .join("");

  elements.managerReportFilters.innerHTML = `
    <button type="button" class="secondary-btn ${managerReportCoordinatorId === "all" ? "active-filter" : ""}" data-report-coordinator="all">Все</button>
    ${coordinatorButtons}
  `;
}

function renderCoordinatorPage() {
  elements.coordinatorMain.classList.toggle("hidden", coordinatorPage !== "main");
  elements.driversPage.classList.toggle("hidden", coordinatorPage !== "drivers");
  elements.restaurantsPage.classList.toggle("hidden", coordinatorPage !== "restaurants");

  if (coordinatorPage === "drivers") {
    renderDrivers();
  }

  if (coordinatorPage === "restaurants") {
    renderRestaurants();
  }
}

function setCoordinatorPage(page) {
  coordinatorPage = page;
  renderCoordinator();
}

function renderDriverOptions() {
  const query = elements.driverSearchInput.value.trim();
  const coordinatorId = getActiveCoordinatorId();
  const drivers = state.users.filter(
    (user) =>
      user.role === "driver" &&
      belongsToCoordinator(user, coordinatorId) &&
      (includesSearch(user.name, query) || includesSearch(user.carNumber, query)),
  );
  if (!drivers.length) {
    elements.driverChecklist.innerHTML = '<p class="empty-state">Р’РѕРґРёС‚РµР»Рё РЅРµ РЅР°Р№РґРµРЅС‹.</p>';
    return;
  }

  elements.driverChecklist.innerHTML = drivers
    .map(
      (driver) => `
        <label class="driver-choice">
          <input type="checkbox" name="driverIds" value="${driver.id}" ${selectedAssignmentDriverIds.has(driver.id) ? "checked" : ""} />
          <span>${escapeHtml(driver.name)}${driver.carNumber ? ` · ${escapeHtml(driver.carNumber)}` : ""}</span>
          ${renderTraineeBadge(driver)}
        </label>
      `,
    )
    .join("");
}

function handleDriverSelectionChange(event) {
  const checkbox = event.target.closest('input[name="driverIds"]');
  if (!checkbox) {
    return;
  }

  if (checkbox.checked) {
    selectedAssignmentDriverIds.add(checkbox.value);
  } else {
    selectedAssignmentDriverIds.delete(checkbox.value);
  }
}

function driverOptions(selectedId) {
  const coordinatorId = getActiveCoordinatorId();
  return state.users
    .filter((user) => user.role === "driver" && belongsToCoordinator(user, coordinatorId))
    .map(
      (driver) =>
        `<option value="${driver.id}" ${driver.id === selectedId ? "selected" : ""}>${escapeHtml(driver.name)}${driver.carNumber ? ` · ${escapeHtml(driver.carNumber)}` : ""}${driver.trainee ? ` · ${getTraineeText(driver)}` : ""}</option>`,
    )
    .join("");
}

function renderRestaurantOptions() {
  const query = elements.assignmentRestaurantSearchInput.value.trim();
  const coordinatorId = getActiveCoordinatorId();
  elements.restaurantSelect.innerHTML = state.restaurants
    .filter((restaurant) => belongsToCoordinator(restaurant, coordinatorId) && includesSearch(restaurant.name, query))
    .map((restaurant) => `<option value="${restaurant.id}">${escapeHtml(restaurant.name)}</option>`)
    .join("");
}

function restaurantOptions(selectedId) {
  const coordinatorId = getActiveCoordinatorId();
  return state.restaurants
    .filter((restaurant) => belongsToCoordinator(restaurant, coordinatorId))
    .map(
      (restaurant) =>
        `<option value="${restaurant.id}" ${restaurant.id === selectedId ? "selected" : ""}>${escapeHtml(restaurant.name)}</option>`,
    )
    .join("");
}

function renderDrivers() {
  const query = elements.driverManageSearchInput.value.trim();
  const coordinatorId = getActiveCoordinatorId();
  const allDrivers = state.users.filter((user) => user.role === "driver" && belongsToCoordinator(user, coordinatorId));
  const drivers = allDrivers.filter(
    (user) =>
      (includesSearch(user.name, query) || includesSearch(user.carNumber, query)),
  );
  elements.driversCount.textContent = query
    ? `В списке: ${drivers.length} из ${allDrivers.length}`
    : `Всего: ${allDrivers.length}`;

  if (!drivers.length) {
    elements.driverManageList.innerHTML = '<p class="empty-state">Водители не найдены.</p>';
    return;
  }

  elements.driverManageList.innerHTML = drivers
    .map(
      (driver) => `
        <article class="restaurant-item">
          <strong>${escapeHtml(driver.name)}</strong>
          <span>${driver.carNumber ? `Машина: ${escapeHtml(driver.carNumber)}` : "Номер машины не указан"}</span>
          ${driver.trainee ? renderTraineeBadge(driver) : "<span>Основной водитель</span>"}
          <div class="item-actions">
            <button type="button" class="danger-btn compact-btn" data-action="delete-driver" data-id="${driver.id}">Удалить</button>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderRestaurants() {
  const query = elements.restaurantSearchInput.value.trim();
  const coordinatorId = getActiveCoordinatorId();
  const allRestaurants = state.restaurants.filter((restaurant) => belongsToCoordinator(restaurant, coordinatorId));
  const restaurants = allRestaurants.filter((restaurant) => includesSearch(restaurant.name, query));
  elements.restaurantsCount.textContent = query
    ? `В списке: ${restaurants.length} из ${allRestaurants.length}`
    : `Всего: ${allRestaurants.length}`;

  if (!restaurants.length) {
    elements.restaurantList.innerHTML = '<p class="empty-state">Рестораны не найдены.</p>';
    return;
  }

  elements.restaurantList.innerHTML = restaurants
    .map((restaurant) => {
      const monthAssignments = filteredAssignments().filter(
        (assignment) => assignment.restaurantId === restaurant.id,
      );
      const count = monthAssignments.length;

      if (restaurant.id === editingRestaurantId) {
        return `
          <article class="restaurant-item">
            <div class="restaurant-edit">
              <input type="text" data-restaurant-field="name" data-id="${restaurant.id}" value="${escapeHtml(restaurant.name)}" placeholder="Название ресторана" />
              <input type="number" data-restaurant-field="driverPrice" data-id="${restaurant.id}" value="${escapeHtml(restaurant.driverPrice)}" placeholder="Сумма водителя" min="0" step="100" />
            </div>
            <span>${count} водителей за выбранный месяц · ${formatMoney(count * normalizePrice(restaurant.driverPrice || DRIVER_RATE))}</span>
            <span>Водителю: ${formatMoney(normalizePrice(restaurant.driverPrice || DRIVER_RATE))}</span>
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
          <span>Сумма водителя: ${formatMoney(normalizePrice(restaurant.driverPrice || DRIVER_RATE))}</span>
          <span>${count} водителей за выбранный месяц · ${formatMoney(count * normalizePrice(restaurant.driverPrice || DRIVER_RATE))}</span>
          <div class="item-actions">
            <button type="button" class="secondary-btn compact-btn" data-action="edit-restaurant" data-id="${restaurant.id}">Изменить</button>
            <button type="button" class="danger-btn compact-btn" data-action="delete-restaurant" data-id="${restaurant.id}">Удалить</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function filteredAssignments() {
  const month = elements.monthFilter.value || currentMonth();
  const dateFrom = elements.reportDateFromInput.value;
  const dateTo = elements.reportDateToInput.value;
  const visibleCoordinatorIds = getVisibleCoordinatorIds();
  return state.assignments.filter(
    (assignment) => {
      const assignmentDate = assignment.time.slice(0, 10);
      return (
        assignment.time.startsWith(month) &&
        (!dateFrom || assignmentDate >= dateFrom) &&
        (!dateTo || assignmentDate <= dateTo) &&
        visibleCoordinatorIds.includes(assignment.coordinatorId)
      );
    },
  );
}

function reportMatchesSearch(assignment, query) {
  if (!query) {
    return true;
  }

  const driver = getUser(assignment.driverId);
  const restaurant = getRestaurant(assignment.restaurantId);
  const coordinator = getUser(assignment.coordinatorId);
  const date = new Date(assignment.time);
  const values = [
    coordinator && coordinator.name,
    driver && driver.name,
    driver && driver.carNumber,
    getTraineeText(driver),
    restaurant && restaurant.name,
    assignment.time,
    date.toLocaleDateString("ru-RU"),
    formatDateTime(assignment.time),
  ];

  return values.some((value) => includesSearch(value, query));
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

    const group = groups.get(groupId);
    group.assignments.push(assignment);
    group.restaurantId = group.restaurantId || assignment.restaurantId;
    group.time = group.time || assignment.time;
  });

  return Array.from(groups.values());
}

function reportGroupMatchesSearch(group, query) {
  if (!query) {
    return true;
  }

  return group.assignments.some((assignment) => reportMatchesSearch(assignment, query));
}

function getGroupTotal(group) {
  return group.assignments.reduce((sum, assignment) => sum + getAssignmentDriverPrice(assignment), 0);
}

function getGroupDrivers(group) {
  return group.assignments.map((assignment) => getUser(assignment.driverId)).filter(Boolean);
}

function renderDriverNameList(drivers) {
  if (!drivers.length) {
    return "Удаленный водитель";
  }

  return drivers
    .map((driver) => `${escapeHtml(driver.name)}${driver.carNumber ? ` · ${escapeHtml(driver.carNumber)}` : ""}`)
    .join("<br>");
}

function renderGroupTraineeList(drivers) {
  const trainees = drivers.filter((driver) => driver.trainee);
  if (!trainees.length) {
    return "Нет";
  }

  return trainees.map((driver) => renderTraineeBadge(driver)).join("<br>");
}

function renderGroupDriverEditor(group) {
  const selectedDriverIds = new Set(group.assignments.map((assignment) => assignment.driverId));
  const coordinatorId = group.coordinatorId || getActiveCoordinatorId();
  return state.users
    .filter((user) => user.role === "driver" && belongsToCoordinator(user, coordinatorId))
    .map(
      (driver) => `
        <label class="driver-choice">
          <input type="checkbox" data-edit-driver-id="${driver.id}" data-id="${group.id}" ${selectedDriverIds.has(driver.id) ? "checked" : ""} />
          <span>${escapeHtml(driver.name)}${driver.carNumber ? ` · ${escapeHtml(driver.carNumber)}` : ""}</span>
          ${renderTraineeBadge(driver)}
        </label>
      `,
    )
    .join("");
}

function renderReportSearchSummary(assignments, query) {
  if (!query) {
    elements.reportSearchSummary.textContent = "";
    return;
  }

  const driverCounts = assignments.reduce((counts, assignment) => {
    const driver = getUser(assignment.driverId);
    const name = driver ? driver.name : "Удаленный водитель";
    counts.set(name, (counts.get(name) || 0) + 1);
    return counts;
  }, new Map());

  const countText = Array.from(driverCounts.entries())
    .map(([name, count]) => `${name}: ${count} заказов`)
    .join(" · ");

  elements.reportSearchSummary.textContent = countText || "Заказов не найдено";
}

function renderReport() {
  if (!elements.monthFilter.value) {
    elements.monthFilter.value = currentMonth();
  }

  const currentUser = getUser(state.currentUserId);
  const canEditAssignments = currentUser && currentUser.role === "coordinator";
  const isManagerReport = currentUser && currentUser.role === "manager";
  const reportQuery = elements.reportSearchInput.value.trim();
  const assignments = filteredAssignments()
    .sort((a, b) => new Date(a.time) - new Date(b.time));
  const groups = groupAssignments(assignments)
    .filter((group) => reportGroupMatchesSearch(group, reportQuery))
    .sort((a, b) => new Date(a.time) - new Date(b.time));
  elements.reportHead.innerHTML = `
    <th>Дата</th>
    ${isManagerReport ? "<th>Координатор</th>" : ""}
    <th>Водитель</th>
    <th>Стажировка</th>
    <th>Ресторан</th>
    <th>Сумма</th>
    <th></th>
  `;
  const visibleAssignments = groups.flatMap((group) => group.assignments);
  renderReportSearchSummary(visibleAssignments, reportQuery);
  elements.assignedCount.textContent = String(visibleAssignments.length);
  const total = visibleAssignments.reduce((sum, assignment) => sum + getAssignmentDriverPrice(assignment), 0);
  elements.totalAmount.textContent = formatMoney(total);

  if (!groups.length) {
    elements.reportBody.innerHTML = `
      <tr>
        <td colspan="${isManagerReport ? 7 : 6}">За этот месяц назначений нет.</td>
      </tr>
    `;
    return;
  }

  elements.reportBody.innerHTML = groups
    .map((group) => {
      const drivers = getGroupDrivers(group);
      const restaurant = getRestaurant(group.restaurantId);
      const coordinator = getUser(group.coordinatorId);
      const date = new Date(group.time);

      if (canEditAssignments && group.id === editingAssignmentId) {
        return `
          <tr>
            <td>
              <input type="date" data-edit-field="time" data-id="${group.id}" value="${escapeHtml(group.time.slice(0, 10))}" />
            </td>
            <td>
              <div class="driver-checklist report-driver-editor">
                ${renderGroupDriverEditor(group)}
              </div>
            </td>
            <td>${renderGroupTraineeList(drivers)}</td>
            <td>
              <select data-edit-field="restaurantId" data-id="${group.id}">
                ${restaurantOptions(group.restaurantId)}
              </select>
            </td>
            <td>${formatMoney(getGroupTotal(group))}</td>
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
          <td>${date.toLocaleDateString("ru-RU")}</td>
          ${isManagerReport ? `<td>${escapeHtml(coordinator ? coordinator.name : "Удаленный координатор")}</td>` : ""}
          <td>${renderDriverNameList(drivers)}</td>
          <td>${renderGroupTraineeList(drivers)}</td>
          <td>
            ${escapeHtml(restaurant ? restaurant.name : "Удаленный ресторан")}
          </td>
          <td>${formatMoney(getGroupTotal(group))}</td>
          <td>${
            canEditAssignments
              ? `<div class="actions-cell">
                  <button type="button" class="secondary-btn compact-btn" data-action="edit-assignment" data-id="${group.id}">Изменить</button>
                  <button type="button" class="danger-btn compact-btn" data-action="delete-assignment" data-id="${group.id}">Удалить</button>
                </div>`
              : ""
          }</td>
        </tr>
      `;
    })
    .join("");
}

function renderDriver(user) {
  const assignments = state.assignments
    .filter((assignment) => assignment.driverId === user.id)
    .sort((a, b) => new Date(a.time) - new Date(b.time));

  if (!assignments.length) {
    elements.driverAssignments.innerHTML = '<p class="empty-state">Пока назначений нет.</p>';
    return;
  }

  elements.driverAssignments.innerHTML = assignments
    .map((assignment) => {
      const restaurant = getRestaurant(assignment.restaurantId);
      return `
        <article class="assignment-item">
          <strong>${escapeHtml(restaurant ? restaurant.name : "Ресторан не найден")}</strong>
          <span>${formatDateTime(assignment.time)}</span>
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
    })
    .join("");
}

function handleAssignment(event) {
  event.preventDefault();
  const coordinatorId = getActiveCoordinatorId();
  const selectedDriverIds = Array.from(selectedAssignmentDriverIds).filter((driverId) => {
    const driver = getUser(driverId);
    return driver && driver.role === "driver" && belongsToCoordinator(driver, coordinatorId);
  });

  if (!selectedDriverIds.length || !elements.restaurantSelect.value || !elements.timeInput.value) {
    elements.assignmentHint.textContent = "Выберите водителя, ресторан и дату.";
    return;
  }

  const groupId = createId();
  selectedDriverIds.forEach((driverId) => {
    state.assignments.push({
      id: createId(),
      groupId,
      driverId,
      restaurantId: elements.restaurantSelect.value,
      time: elements.timeInput.value,
      coordinatorId: state.currentUserId,
      arrived: false,
      estimatedFinish: "",
    });
  });

  saveState();
  selectedAssignmentDriverIds.clear();
  elements.assignmentForm.reset();
  elements.assignmentHint.textContent = "Водитель направлен.";
  renderCoordinator();
}

function handleRestaurant(event) {
  event.preventDefault();
  const name = elements.restaurantNameInput.value.trim();
  const driverPrice = normalizePrice(elements.restaurantDriverPriceInput.value || DRIVER_RATE);
  const coordinatorId = getActiveCoordinatorId();

  if (!name || !coordinatorId) {
    return;
  }

  state.restaurants.push({ id: createId(), coordinatorId, name, mapUrl: "", price: driverPrice, driverPrice });
  saveState();
  elements.restaurantForm.reset();
  resetRestaurantDriverPrice();
  renderCoordinator();
}

function handleDriverCreate(event) {
  event.preventDefault();
  const name = elements.newDriverNameInput.value.trim();
  const carNumber = elements.newDriverCarInput.value.trim();
  const coordinatorId = getActiveCoordinatorId();
  const isTrainee = elements.newDriverTraineeInput.checked;
  const traineeSince = isTrainee ? createDateFromInput(elements.newDriverTraineeSinceInput.value) : null;

  if (!name || !carNumber || !coordinatorId) {
    return;
  }

  state.users.push({
    id: createId(),
    name,
    password: "",
    coordinatorId,
    carNumber,
    role: "driver",
    trainee: isTrainee,
    traineeSince: traineeSince ? traineeSince.toISOString() : "",
    traineeUntil: traineeSince ? createTraineeUntil(traineeSince) : "",
  });

  saveState();
  elements.driverForm.reset();
  syncTraineeSinceInput();
  renderCoordinator();
}

function handleReportAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const { action, id } = button.dataset;

  if (action === "edit-assignment") {
    editingAssignmentId = id;
    renderCoordinator();
    return;
  }

  if (action === "cancel-edit") {
    editingAssignmentId = null;
    renderCoordinator();
    return;
  }

  if (action === "save-assignment") {
    const groupAssignments = state.assignments.filter((item) => (item.groupId || item.id) === id);
    if (!groupAssignments.length) {
      return;
    }

    const group = {
      id,
      coordinatorId: groupAssignments[0].coordinatorId,
      restaurantId: groupAssignments[0].restaurantId,
      time: groupAssignments[0].time,
      assignments: groupAssignments,
    };
    const fields = elements.reportBody.querySelectorAll(`[data-edit-field][data-id="${id}"]`);
    const values = {};
    fields.forEach((field) => {
      values[field.dataset.editField] = field.value;
    });

    const selectedDriverIds = Array.from(
      elements.reportBody.querySelectorAll(`[data-edit-driver-id][data-id="${id}"]:checked`),
    ).map((input) => input.dataset.editDriverId);

    if (!selectedDriverIds.length) {
      return;
    }

    groupAssignments.forEach((assignment) => {
      assignment.time = values.time || assignment.time;
      assignment.restaurantId = values.restaurantId || assignment.restaurantId;
      assignment.groupId = id;
    });

    const existingDriverIds = new Set(groupAssignments.map((assignment) => assignment.driverId));
    const selectedDriverIdSet = new Set(selectedDriverIds);
    state.assignments = state.assignments.filter(
      (assignment) => (assignment.groupId || assignment.id) !== id || selectedDriverIdSet.has(assignment.driverId),
    );

    selectedDriverIds.forEach((driverId) => {
      if (existingDriverIds.has(driverId)) {
        return;
      }

      state.assignments.push({
        id: createId(),
        groupId: id,
        driverId,
        restaurantId: values.restaurantId || group.restaurantId,
        time: values.time || group.time,
        coordinatorId: group.coordinatorId,
        arrived: false,
        estimatedFinish: "",
      });
    });

    editingAssignmentId = null;
    saveState();
    renderCoordinator();
    return;
  }

  if (action === "delete-assignment") {
    if (!confirm("Удалить это назначение?")) {
      return;
    }

    state.assignments = state.assignments.filter((item) => (item.groupId || item.id) !== id);
    editingAssignmentId = null;
    saveState();
    renderCoordinator();
  }
}

function handleRestaurantAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

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

  if (action === "save-restaurant") {
    const restaurant = getRestaurant(id);
    if (!restaurant) {
      return;
    }

    const nameInput = elements.restaurantList.querySelector(`[data-restaurant-field="name"][data-id="${id}"]`);
    const driverPriceInput = elements.restaurantList.querySelector(`[data-restaurant-field="driverPrice"][data-id="${id}"]`);
    const name = nameInput ? nameInput.value.trim() : "";

    if (!name) {
      return;
    }

    restaurant.name = name;
    restaurant.driverPrice = normalizePrice(driverPriceInput ? driverPriceInput.value : restaurant.driverPrice || DRIVER_RATE);
    restaurant.price = restaurant.driverPrice;
    editingRestaurantId = null;
    saveState();
    renderCoordinator();
    return;
  }

  if (action === "delete-restaurant") {
    if (!confirm("Удалить этот ресторан? Назначения с ним останутся в отчете как удаленный ресторан.")) {
      return;
    }

    state.restaurants = state.restaurants.filter((restaurant) => restaurant.id !== id);
    editingRestaurantId = null;
    saveState();
    renderCoordinator();
  }
}

function handleDriverManageAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const { action, id } = button.dataset;

  if (action === "delete-driver") {
    state.users = state.users.filter((user) => user.id !== id);
    state.assignments = state.assignments.filter((assignment) => assignment.driverId !== id);
    saveState();
    renderCoordinator();
  }
}

function handleDriverAction(event) {
  const target = event.target.closest("[data-action]");
  if (!target) {
    return;
  }

  const assignment = state.assignments.find((item) => item.id === target.dataset.id);
  if (!assignment) {
    return;
  }

  if (target.dataset.action === "toggle-arrived") {
    assignment.arrived = target.checked;
    saveState();
    renderDriver(getUser(state.currentUserId));
    return;
  }

  if (target.dataset.action === "save-finish") {
    const input = elements.driverAssignments.querySelector(`[data-finish-input="${assignment.id}"]`);
    assignment.estimatedFinish = input ? input.value.trim() : "";
    saveState();
    renderDriver(getUser(state.currentUserId));
  }
}

elements.tabs.forEach((tab) => {
  tab.addEventListener("click", () => setAuthMode(tab.dataset.mode));
});

elements.accountList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action='delete-account']");
  if (button) {
    deleteAccount(button.dataset.id);
  }
});
elements.authForm.addEventListener("submit", handleAuth);
elements.logoutBtn.addEventListener("click", logout);
elements.assignmentForm.addEventListener("submit", handleAssignment);
elements.driverChecklist.addEventListener("change", handleDriverSelectionChange);
elements.driverForm.addEventListener("submit", handleDriverCreate);
elements.newDriverNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    elements.newDriverCarInput.focus();
  }
});
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
elements.newDriverTraineeInput.addEventListener("change", syncTraineeSinceInput);
elements.coordinatorView.addEventListener("click", (event) => {
  const reportCoordinatorButton = event.target.closest("[data-report-coordinator]");
  if (reportCoordinatorButton) {
    managerReportCoordinatorId = reportCoordinatorButton.dataset.reportCoordinator;
    editingAssignmentId = null;
    renderCoordinator();
    return;
  }

  const button = event.target.closest("[data-page]");
  if (button) {
    setCoordinatorPage(button.dataset.page);
  }
});
elements.monthFilter.addEventListener("change", renderCoordinator);

renderApp();
syncTraineeSinceInput();
resetRestaurantDriverPrice();
