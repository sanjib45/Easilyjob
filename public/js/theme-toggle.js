(function () {
  function getStoredTheme() {
    var cookieTheme = document.cookie
      .split("; ")
      .find(function (row) { return row.startsWith("theme="); });
    if (cookieTheme) cookieTheme = cookieTheme.split("=")[1];
    return cookieTheme || localStorage.getItem("theme") || "dark";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    document.cookie = "theme=" + theme + "; path=/; max-age=31536000; SameSite=Lax";
    localStorage.setItem("theme", theme);

    // Legacy checkbox toggles (sidebar)
    var toggles = document.querySelectorAll(".theme-toggle-input");
    toggles.forEach(function (toggle) {
      toggle.checked = theme === "dark";
    });
    var labels = document.querySelectorAll(".theme-toggle-label-text");
    labels.forEach(function (label) {
      label.textContent = theme === "dark" ? "Dark mode" : "Light mode";
    });

    // Topbar icon button aria-label
    var topbarBtns = document.querySelectorAll(".topbar-theme-btn, #topbarThemeBtn");
    topbarBtns.forEach(function (btn) {
      btn.setAttribute(
        "aria-label",
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      );
    });
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute("data-theme") || getStoredTheme();
    applyTheme(current === "dark" ? "light" : "dark");
  }

  document.addEventListener("DOMContentLoaded", function () {
    // Apply saved theme immediately
    applyTheme(getStoredTheme());

    // Topbar Sun/Moon buttons
    var topbarBtns = document.querySelectorAll(".topbar-theme-btn, #topbarThemeBtn, .theme-pill-switcher");
    topbarBtns.forEach(function (btn) {
      btn.addEventListener("click", toggleTheme);
      btn.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleTheme();
        }
      });
    });

    // Theme button group support ([data-theme-val])
    var themeButtons = document.querySelectorAll("[data-theme-val]");
    themeButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var val = btn.getAttribute("data-theme-val");
        if (val === "system") {
          var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
          applyTheme(prefersDark ? "dark" : "light");
        } else {
          applyTheme(val);
        }
      });
    });

    // Legacy checkbox support
    document.addEventListener("change", function (e) {
      if (e.target && e.target.classList.contains("theme-toggle-input")) {
        var newTheme = e.target.checked ? "dark" : "light";
        applyTheme(newTheme);
      }
    });

    // Mobile Header Navigation Drawer
    var mobileToggle = document.getElementById("headerMobileToggle");
    var siteNav = document.getElementById("siteNav");
    var navBackdrop = document.getElementById("headerNavBackdrop");

    function toggleMobileNav() {
      if (!siteNav || !mobileToggle) return;
      var isOpen = siteNav.classList.contains("is-open");
      if (isOpen) {
        closeMobileNav();
      } else {
        openMobileNav();
      }
    }

    function openMobileNav() {
      if (!siteNav || !mobileToggle) return;
      siteNav.classList.add("is-open");
      mobileToggle.classList.add("is-active");
      mobileToggle.setAttribute("aria-expanded", "true");
      if (navBackdrop) navBackdrop.classList.add("is-open");
    }

    function closeMobileNav() {
      if (!siteNav || !mobileToggle) return;
      siteNav.classList.remove("is-open");
      mobileToggle.classList.remove("is-active");
      mobileToggle.setAttribute("aria-expanded", "false");
      if (navBackdrop) navBackdrop.classList.remove("is-open");
    }

    if (mobileToggle) {
      mobileToggle.addEventListener("click", toggleMobileNav);
    }
    if (navBackdrop) {
      navBackdrop.addEventListener("click", closeMobileNav);
    }

    window.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        closeMobileNav();
      }
    });
  });
})();
