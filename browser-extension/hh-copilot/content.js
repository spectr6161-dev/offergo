(() => {
  if (globalThis.__offergoHhCopilotContentLoaded) {
    return;
  }

  globalThis.__offergoHhCopilotContentLoaded = true;

  const APPLY_TEXT_PATTERNS = [
    "откликнуться",
    "отправить отклик",
    "respond",
    "apply",
  ];

  function cleanText(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function firstVisible(selectors) {
    for (const selector of selectors) {
      const nodes = Array.from(document.querySelectorAll(selector));
      const node = nodes.find((item) => {
        const rect = item.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });

      if (node) return node;
    }

    return null;
  }

  function extractVacancy() {
    const titleNode = firstVisible([
      '[data-qa="vacancy-title"]',
      "h1",
      '[data-qa="bloko-header-1"]',
    ]);
    const employerNode = firstVisible([
      '[data-qa="vacancy-company-name"]',
      '[data-qa="vacancy-company-name"] a',
      '[data-qa="company-name"]',
    ]);
    const descriptionNode = firstVisible([
      '[data-qa="vacancy-description"]',
      ".vacancy-description",
      '[data-qa="vacancy-section"]',
    ]);

    const title = cleanText(titleNode?.textContent);
    const employer = cleanText(employerNode?.textContent);
    const description = cleanText(
      descriptionNode?.innerText || descriptionNode?.textContent,
    );
    const fallbackText = cleanText(document.body.innerText).slice(0, 20000);
    const textParts = [
      title ? `Вакансия: ${title}` : "",
      employer ? `Компания: ${employer}` : "",
      description || fallbackText,
    ].filter(Boolean);

    return {
      url: window.location.href,
      title,
      employer,
      text: textParts.join("\n\n").slice(0, 30000),
    };
  }

  function findClickableButtonByText(patterns) {
    const candidates = Array.from(
      document.querySelectorAll("button, a, [role='button']"),
    );

    return candidates.find((node) => {
      const text = cleanText(node.textContent).toLowerCase();
      const rect = node.getBoundingClientRect();
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        patterns.some((pattern) => text.includes(pattern))
      );
    });
  }

  async function openApplyDialog() {
    const button = findClickableButtonByText(APPLY_TEXT_PATTERNS);

    if (!button) {
      return { ok: false, message: "Кнопка отклика не найдена." };
    }

    button.click();
    await new Promise((resolve) => setTimeout(resolve, 700));
    return { ok: true };
  }

  function setNativeValue(element, value) {
    const prototype = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

    if (descriptor?.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }

    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function findCoverLetterField() {
    return firstVisible([
      "textarea",
      '[contenteditable="true"]',
      '[role="textbox"]',
    ]);
  }

  function fillCoverLetter(text) {
    const field = findCoverLetterField();

    if (!field) {
      return {
        ok: false,
        message: "Поле сопроводительного письма не найдено.",
      };
    }

    field.focus();

    if (field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement) {
      setNativeValue(field, text);
    } else {
      field.textContent = text;
      field.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          inputType: "insertText",
          data: text,
        }),
      );
      field.dispatchEvent(new Event("change", { bubbles: true }));
    }

    highlightSubmitButton();
    return { ok: true };
  }

  function highlightSubmitButton() {
    const submitButton = findClickableButtonByText([
      "отправить",
      "откликнуться",
    ]);

    if (!submitButton) {
      return { ok: false };
    }

    submitButton.style.outline = "3px solid #0ea5e9";
    submitButton.style.outlineOffset = "3px";
    submitButton.scrollIntoView({ block: "center", behavior: "smooth" });
    return { ok: true };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    (async () => {
      if (message?.type === "extractVacancy") {
        sendResponse({ ok: true, vacancy: extractVacancy() });
        return;
      }

      if (message?.type === "openApplyDialog") {
        sendResponse(await openApplyDialog());
        return;
      }

      if (message?.type === "fillCoverLetter") {
        sendResponse(fillCoverLetter(message.text || ""));
        return;
      }

      if (message?.type === "highlightSubmit") {
        sendResponse(highlightSubmitButton());
        return;
      }

      sendResponse({ ok: false, message: "Неизвестная команда." });
    })();

    return true;
  });
})();
