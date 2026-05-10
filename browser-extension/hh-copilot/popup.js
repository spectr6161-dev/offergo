const API_BASE_URL = "http://localhost:3001/api/v1";

const authView = document.getElementById("authView");
const appView = document.getElementById("appView");
const codeInput = document.getElementById("codeInput");
const connectButton = document.getElementById("connectButton");
const authStatusBox = document.getElementById("authStatusBox");
const logoutButton = document.getElementById("logoutButton");
const resumeSelect = document.getElementById("resumeSelect");
const statusBox = document.getElementById("statusBox");
const extractButton = document.getElementById("extractButton");
const generateButton = document.getElementById("generateButton");
const fillButton = document.getElementById("fillButton");
const letterPreview = document.getElementById("letterPreview");

let accessToken = "";
let currentVacancy = null;
let currentLetter = "";

function setAuthStatus(message) {
  authStatusBox.textContent = message || "";
}

function setStatus(message) {
  statusBox.textContent = message;
}

function normalizeCode(value) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function setAuthorizedView(isAuthorized) {
  authView.hidden = isAuthorized;
  appView.hidden = !isAuthorized;
}

function hasResumeText(resume) {
  return Boolean(
    resume?.currentVersion?.plainText?.trim() ||
      resume?.currentVersion?.summary?.trim(),
  );
}

async function saveState() {
  await chrome.storage.local.set({
    accessToken,
    resumeId: resumeSelect.value,
    currentLetter,
  });
}

async function loadState() {
  const state = await chrome.storage.local.get([
    "accessToken",
    "resumeId",
    "currentLetter",
  ]);
  accessToken = state.accessToken || "";
  currentLetter = state.currentLetter || "";
  letterPreview.value = currentLetter;
  setAuthorizedView(Boolean(accessToken));

  if (accessToken) {
    await loadResumes(state.resumeId || "");
  }
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ||
        payload?.message ||
        payload?.error ||
        `API error ${response.status}`,
    );
  }

  return payload;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("Активная вкладка не найдена.");
  return tab;
}

async function ensureContentScript(tabId) {
  if (!chrome.scripting?.executeScript) {
    return;
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"],
  });
}

async function sendToContent(type, payload = {}) {
  const tab = await getActiveTab();

  if (!/^https:\/\/([^/]+\.)?hh\.ru\//.test(tab.url || "")) {
    throw new Error("Откройте вакансию на hh.ru.");
  }

  try {
    return await chrome.tabs.sendMessage(tab.id, { type, ...payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (!message.includes("Receiving end does not exist")) {
      throw error;
    }

    await ensureContentScript(tab.id);
    return await chrome.tabs.sendMessage(tab.id, { type, ...payload });
  }
}

async function connectExtension() {
  const code = normalizeCode(codeInput.value);

  if (!code) {
    setAuthStatus("Введите код подключения.");
    return;
  }

  setAuthStatus("Подключаем расширение...");
  const result = await fetch(`${API_BASE_URL}/auth/extension/browser/poll`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ code }),
  }).then(async (response) => {
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.message || payload?.error || "Код не принят.");
    }
    return payload;
  });

  if (result.status !== "approved" || !result.accessToken) {
    throw new Error("Код ещё не подтверждён или истёк.");
  }

  accessToken = result.accessToken;
  codeInput.value = "";
  setAuthorizedView(true);
  await saveState();
  await loadResumes();
}

async function logout() {
  try {
    if (accessToken) {
      await apiFetch("/auth/extension/logout", { method: "POST" });
    }
  } finally {
    accessToken = "";
    currentLetter = "";
    currentVacancy = null;
    await chrome.storage.local.remove(["accessToken", "resumeId", "currentLetter"]);
    setAuthorizedView(false);
    setAuthStatus("");
  }
}

async function loadResumes(selectedId = "") {
  setStatus("Загружаем резюме...");
  const [resumesData, settingsData] = await Promise.all([
    apiFetch("/resumes?scope=active"),
    apiFetch("/cover-materials/auto-responses/settings"),
  ]);
  const rawItems = Array.isArray(resumesData)
    ? resumesData
    : Array.isArray(resumesData?.items)
      ? resumesData.items
      : [];
  const items = rawItems.filter(hasResumeText);
  resumeSelect.innerHTML = "";

  if (!items.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = rawItems.length
      ? "Нет резюме с текстовой версией"
      : "Нет резюме в этом аккаунте";
    resumeSelect.append(option);
    resumeSelect.disabled = true;
    setStatus(
      rawItems.length
        ? "У резюме нет текстовой версии. Откройте его в OfferGO и сохраните."
        : "В этом аккаунте нет активных резюме. Проверьте аккаунт в web-панели OfferGO.",
    );
    return;
  }

  resumeSelect.disabled = false;
  for (const resume of items) {
    const option = document.createElement("option");
    option.value = resume.id;
    option.textContent = resume.title || "Без названия";
    resumeSelect.append(option);
  }

  const preferredId = selectedId || settingsData.defaultResumeId || "";
  if (preferredId && items.some((item) => item.id === preferredId)) {
    resumeSelect.value = preferredId;
  }

  setStatus("Откройте вакансию на hh.ru.");
  await saveState();
}

async function extractVacancy() {
  const result = await sendToContent("extractVacancy");

  if (!result?.ok || !result.vacancy?.text) {
    throw new Error(result?.message || "Не удалось считать вакансию.");
  }

  currentVacancy = result.vacancy;
  setStatus(
    `Вакансия считана:\n${currentVacancy.title || "Без названия"}\n${
      currentVacancy.employer || ""
    }`,
  );
}

async function generateLetter() {
  if (!currentVacancy) {
    await extractVacancy();
  }

  if (!resumeSelect.value) {
    throw new Error("Выберите резюме.");
  }

  setStatus("Формируем индивидуальный отклик...");
  const data = await apiFetch("/cover-materials/individual-responses/generate", {
    method: "POST",
    body: JSON.stringify({
      resumeId: resumeSelect.value,
      vacancyText: currentVacancy.text,
      source: "hh_browser_copilot",
      vacancyUrl: currentVacancy.url,
      vacancyTitle: currentVacancy.title,
      employerName: currentVacancy.employer,
    }),
  });

  const item = data.item;
  if (item.decision === "mismatch" || !item.coverLetter) {
    currentLetter = "";
    letterPreview.value = "";
    setStatus(`Вакансия плохо совпадает с резюме.\n${item.summary || ""}`);
    await saveState();
    return;
  }

  currentLetter = item.coverLetter;
  letterPreview.value = currentLetter;
  setStatus("Отклик готов. Проверьте текст и вставьте его в форму.");
  await saveState();
}

async function fillLetter() {
  if (!currentLetter) {
    throw new Error("Сначала сгенерируйте отклик.");
  }

  await sendToContent("openApplyDialog");
  const result = await sendToContent("fillCoverLetter", { text: currentLetter });

  if (!result?.ok) {
    throw new Error(result?.message || "Не удалось вставить текст.");
  }

  setStatus("Текст вставлен. Проверьте форму и отправьте отклик вручную.");
}

async function run(button, action, targetStatus = setStatus) {
  try {
    button.disabled = true;
    await action();
  } catch (error) {
    targetStatus(error instanceof Error ? error.message : String(error));
  } finally {
    button.disabled = false;
  }
}

connectButton.addEventListener("click", () =>
  run(connectButton, connectExtension, setAuthStatus),
);
logoutButton.addEventListener("click", () => run(logoutButton, logout));
resumeSelect.addEventListener("change", saveState);
extractButton.addEventListener("click", () => run(extractButton, extractVacancy));
generateButton.addEventListener("click", () => run(generateButton, generateLetter));
fillButton.addEventListener("click", () => run(fillButton, fillLetter));
codeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    run(connectButton, connectExtension, setAuthStatus);
  }
});

loadState().catch((error) => {
  accessToken = "";
  setAuthorizedView(false);
  setAuthStatus(error instanceof Error ? error.message : "Ошибка подключения");
});
