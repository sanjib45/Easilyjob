const AVATAR_PALETTE = [
  /* Avatar colors — teal/slate/amber family, no purple cluster */
  "#0d9488",
  "#0f766e",
  "#0369a1",
  "#d97706",
  "#b45309",
  "#334155",
  "#047857",
  "#155e75",
];

/** Deterministic color pick so the same name always gets the same avatar color. */
export const colorForName = (name = "") => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % AVATAR_PALETTE.length;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
};

export const initialsFor = (name = "") => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/** Lightweight "time ago" formatter — no dependency needed for this scale of app. */
export const timeAgo = (dateInput) => {
  const date = new Date(dateInput);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (Number.isNaN(seconds)) return "";
  if (seconds < 60) return "just now";

  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];

  for (const [unit, secondsInUnit] of units) {
    const value = Math.floor(seconds / secondsInUnit);
    if (value >= 1) {
      return `${value} ${unit}${value > 1 ? "s" : ""} ago`;
    }
  }
  return "just now";
};

export const daysUntil = (dateInput) => {
  const target = new Date(dateInput);
  const diffMs = target.setHours(23, 59, 59, 999) - Date.now();
  return Math.ceil(diffMs / 86400000);
};

export const formatDate = (dateInput) =>
  new Date(dateInput).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
