/**
 * Easily Jobs - Creative Vanilla Toast Notification Engine
 * - Fixed top-right stackable container
 * - Strict 4-second auto-vanish with creative exit animation
 * - Glowing laser progress countdown
 * - Pause on hover / resume on mouse leave
 * - Full Light & Dark mode glassmorphism
 * - Auto-promotes server flash messages to toasts
 */
(function () {
  var container = null;

  var ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
  };

  function getOrCreateContainer() {
    if (!container) {
      container = document.getElementById("toastContainer");
      if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        container.className = "toast-container";
        container.setAttribute("aria-live", "polite");
        container.setAttribute("aria-atomic", "true");
        document.body.appendChild(container);
      }
    }
    return container;
  }

  function showToast(options) {
    if (typeof options === "string") {
      options = { message: options };
    }
    options = options || {};

    var type = (options.type || "info").toLowerCase();
    var message = options.message || "";
    var title = options.title || (type === "error" ? "Action Failed" : type === "success" ? "Success" : type === "warning" ? "Notice" : "Information");
    // Strict 4000ms auto-vanish delay
    var duration = typeof options.duration === "number" ? options.duration : 4000;

    var toastWrap = getOrCreateContainer();
    var toast = document.createElement("div");
    toast.className = "toast-card type-" + type;
    toast.setAttribute("role", "alert");

    var iconSvg = ICONS[type] || ICONS.info;

    toast.innerHTML = [
      '<div class="toast-icon-wrap">' + iconSvg + '</div>',
      '<div class="toast-body">',
      title ? '<div class="toast-title">' + escapeHtml(title) + '</div>' : '',
      '<p class="toast-message">' + escapeHtml(message) + '</p>',
      '</div>',
      '<button type="button" class="toast-close-btn" aria-label="Dismiss notification">' + ICONS.close + '</button>',
      duration > 0 ? '<div class="toast-progress-track"><div class="toast-progress-bar"></div></div>' : ''
    ].join("");

    var closeBtn = toast.querySelector(".toast-close-btn");
    var progressBar = toast.querySelector(".toast-progress-bar");

    var remainingTime = duration;
    var startTime = Date.now();
    var timerId = null;
    var isPaused = false;
    var isRemoving = false;

    function removeToast() {
      if (isRemoving) return;
      isRemoving = true;
      if (timerId) clearTimeout(timerId);

      // Trigger creative vanish animation
      toast.classList.remove("is-visible");
      toast.classList.add("is-hiding");

      // Phase 2: Collapse space smoothly
      setTimeout(function () {
        toast.classList.add("is-collapsed");
        setTimeout(function () {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 350);
      }, 280);
    }

    if (closeBtn) {
      closeBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        removeToast();
      });
    }

    function startTimer(time) {
      if (time <= 0) return;
      startTime = Date.now();
      
      if (progressBar) {
        progressBar.style.transitionDuration = time + "ms";
        progressBar.style.transform = "scaleX(0)";
      }

      timerId = setTimeout(function () {
        removeToast();
      }, time);
    }

    function pauseTimer() {
      if (duration <= 0 || isPaused || isRemoving) return;
      isPaused = true;
      clearTimeout(timerId);
      var elapsed = Date.now() - startTime;
      remainingTime = Math.max(0, remainingTime - elapsed);

      if (progressBar) {
        var computedStyle = window.getComputedStyle(progressBar);
        var matrix = computedStyle.transform || computedStyle.webkitTransform;
        progressBar.style.transitionDuration = "0ms";
        if (matrix && matrix !== "none") {
          progressBar.style.transform = matrix;
        }
      }
    }

    function resumeTimer() {
      if (duration <= 0 || !isPaused || isRemoving) return;
      isPaused = false;
      startTimer(remainingTime);
    }

    toast.addEventListener("mouseenter", pauseTimer);
    toast.addEventListener("mouseleave", resumeTimer);

    toastWrap.appendChild(toast);

    // Trigger creative entrance animation and start countdown
    requestAnimationFrame(function () {
      toast.classList.add("is-visible");
      setTimeout(function () {
        startTimer(duration);
      }, 50);
    });

    return {
      close: removeToast,
      element: toast
    };
  }

  function escapeHtml(str) {
    if (!str) return "";
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // Expose global methods
  window.showToast = showToast;
  window.toast = {
    show: showToast,
    success: function (msg, title, duration) {
      return showToast({ type: "success", message: msg, title: title || "Success", duration: duration || 4000 });
    },
    error: function (msg, title, duration) {
      return showToast({ type: "error", message: msg, title: title || "Error", duration: duration || 4000 });
    },
    warning: function (msg, title, duration) {
      return showToast({ type: "warning", message: msg, title: title || "Warning", duration: duration || 4000 });
    },
    info: function (msg, title, duration) {
      return showToast({ type: "info", message: msg, title: title || "Information", duration: duration || 4000 });
    }
  };

  // Auto-scan for server-rendered flash messages on load
  document.addEventListener("DOMContentLoaded", function () {
    var flashContainer = document.querySelector(".flash-messages-data");
    if (flashContainer) {
      var flashItems = flashContainer.querySelectorAll("[data-toast-msg]");
      flashItems.forEach(function (item, index) {
        var type = item.getAttribute("data-toast-type") || "info";
        var msg = item.getAttribute("data-toast-msg") || "";
        if (msg.trim()) {
          setTimeout(function () {
            showToast({
              type: type,
              message: msg,
              duration: 4000
            });
          }, index * 200);
        }
      });
    }
  });
})();
