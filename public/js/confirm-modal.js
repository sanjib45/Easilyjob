(() => {
  const overlay = document.getElementById("confirm-overlay");
  if (!overlay) return;

  const titleEl = document.getElementById("confirm-title");
  const messageEl = document.getElementById("confirm-message");
  const okBtn = document.getElementById("confirm-ok");
  const cancelBtn = document.getElementById("confirm-cancel");

  let pendingForm = null;

  const open = ({ title, message, form }) => {
    titleEl.textContent = title || "Are you sure?";
    messageEl.textContent = message || "This action cannot be undone.";
    pendingForm = form;
    overlay.classList.add("is-open");
    okBtn.focus();
  };

  const close = () => {
    overlay.classList.remove("is-open");
    pendingForm = null;
  };

  cancelBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("is-open")) close();
  });

  okBtn.addEventListener("click", () => {
    if (pendingForm) {
      const form = pendingForm;
      close();
      form.dataset.confirmed = "1";
      form.requestSubmit ? form.requestSubmit() : form.submit();
    }
  });

  document.addEventListener("submit", (e) => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (!form.hasAttribute("data-confirm")) return;
    if (form.dataset.confirmed === "1") {
      delete form.dataset.confirmed;
      return;
    }
    e.preventDefault();
    open({
      title: form.getAttribute("data-confirm-title") || "Please confirm",
      message: form.getAttribute("data-confirm"),
      form,
    });
  });
})();
