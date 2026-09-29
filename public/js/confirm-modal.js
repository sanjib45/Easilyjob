(function () {
  var backdrop, dialog, titleEl, messageEl, iconEl, cancelBtn, confirmBtn;
  var triggerElement = null;
  var activeForm = null;
  var activeSubmitter = null;
  var isSubmitting = false;

  function initModal() {
    backdrop = document.getElementById("confirmModalBackdrop");
    if (!backdrop) return;

    dialog = backdrop.querySelector(".confirm-modal-dialog");
    titleEl = document.getElementById("confirmModalTitle");
    messageEl = document.getElementById("confirmModalMessage");
    iconEl = document.getElementById("confirmModalIcon");
    cancelBtn = document.getElementById("confirmModalCancelBtn");
    confirmBtn = document.getElementById("confirmModalConfirmBtn");

    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
    if (backdrop) {
      backdrop.addEventListener("click", function (e) {
        if (e.target === backdrop && !isSubmitting) closeModal();
      });
    }

    window.addEventListener("keydown", function (e) {
      if (!backdrop || !backdrop.classList.contains("is-open")) return;

      if (e.key === "Escape" && !isSubmitting) {
        e.preventDefault();
        closeModal();
      }

      // Focus trap
      if (e.key === "Tab" && dialog) {
        var focusables = dialog.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        var first = focusables[0];
        var last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    });

    if (confirmBtn) {
      confirmBtn.addEventListener("click", function () {
        if (isSubmitting || !activeForm) return;

        isSubmitting = true;
        confirmBtn.disabled = true;
        cancelBtn.disabled = true;
        confirmBtn.innerHTML = '<span>Processing...</span>';

        if (activeSubmitter && activeSubmitter.name) {
          var hiddenInput = document.createElement("input");
          hiddenInput.type = "hidden";
          hiddenInput.name = activeSubmitter.name;
          hiddenInput.value = activeSubmitter.value || "";
          activeForm.appendChild(hiddenInput);
        }

        activeForm.dataset.confirmed = "true";
        // Use requestSubmit() so the submit event fires (needed for CSRF & validators).
        // Fall back to submit() on very old browsers.
        if (typeof activeForm.requestSubmit === "function") {
          activeForm.requestSubmit(activeSubmitter instanceof HTMLElement ? activeSubmitter : null);
        } else {
          activeForm.submit();
        }
      });
    }

    // Restore state on bfcache / page restore
    window.addEventListener("pageshow", function () {
      resetSubmitState();
    });
  }

  function resetSubmitState() {
    isSubmitting = false;
    if (confirmBtn) {
      confirmBtn.disabled = false;
    }
    if (cancelBtn) {
      cancelBtn.disabled = false;
    }
  }

  function openModal(options) {
    if (!backdrop) initModal();
    if (!backdrop) return;

    options = options || {};
    triggerElement = options.trigger || document.activeElement;
    activeForm = options.form || null;
    activeSubmitter = options.submitter || null;
    resetSubmitState();

    var title = options.title || "Confirm Action";
    var message = options.message || "Are you sure you want to proceed?";
    var actionText = options.action || options.confirmText || "Proceed";
    var variant = (options.variant || "danger").toLowerCase();

    // Use textContent to prevent HTML injection
    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    if (confirmBtn) {
      confirmBtn.textContent = actionText;
      confirmBtn.className = "btn " + (variant === "primary" ? "btn-primary" : "btn-danger");
    }

    if (iconEl) {
      iconEl.className = "confirm-modal-icon-badge " + (variant === "primary" ? "variant-primary" : "variant-danger");
    }

    backdrop.style.display = "flex";
    document.body.style.overflow = "hidden";

    setTimeout(function () {
      backdrop.classList.add("is-open");
      if (confirmBtn) confirmBtn.focus();
    }, 10);

    backdrop.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    if (!backdrop) return;
    backdrop.classList.remove("is-open");
    document.body.style.overflow = "";

    setTimeout(function () {
      backdrop.style.display = "none";
    }, 200);

    backdrop.setAttribute("aria-hidden", "true");
    activeForm = null;
    activeSubmitter = null;

    if (triggerElement && typeof triggerElement.focus === "function") {
      try {
        triggerElement.focus();
      } catch (err) {}
    }
  }

  window.showConfirmModal = openModal;

  document.addEventListener("DOMContentLoaded", function () {
    initModal();

    // Intercept form submissions declaratively
    document.addEventListener("submit", function (e) {
      var form = e.target;
      if (!form) return;

      var hasDataConfirm = form.hasAttribute("data-confirm") || form.hasAttribute("data-confirm-message");
      if (!hasDataConfirm) return;

      if (form.dataset.confirmed === "true") {
        delete form.dataset.confirmed;
        return; // Allow native submission after modal confirmation
      }

      e.preventDefault();

      var submitter = e.submitter || document.activeElement;
      var title = form.getAttribute("data-confirm-title") || "Confirm Action";
      var message = form.getAttribute("data-confirm-message") || form.getAttribute("data-confirm") || "Are you sure?";
      var actionText = form.getAttribute("data-confirm-action") || "Confirm";
      var variant = form.getAttribute("data-confirm-variant") || "danger";

      openModal({
        title: title,
        message: message,
        action: actionText,
        variant: variant,
        form: form,
        submitter: submitter,
        trigger: submitter,
      });
    }, true);
  });
})();
