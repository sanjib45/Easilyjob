(function () {
  try {
    var storedTheme = localStorage.getItem("theme");
    var cookieTheme = document.cookie
      .split("; ")
      .find(function (row) { return row.startsWith("theme="); })
      ?.split("=")[1];

    var themeChoice = storedTheme || cookieTheme || "system";
    var finalTheme = "dark";

    if (themeChoice === "system") {
      finalTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } else {
      finalTheme = themeChoice === "light" ? "light" : "dark";
    }

    document.documentElement.setAttribute("data-theme", finalTheme);
    var metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute("content", finalTheme === "light" ? "#ffffff" : "#0b0f19");
    }
  } catch (err) {}
})();
