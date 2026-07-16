import {
  createUser,
  findUserByEmail,
  verifyPassword,
  toSafeUser,
} from "../models/user.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const regenerateSession = (req) =>
  new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });

export const renderLogin = (req, res) => {
  res.render("users/login", { title: "Log in" });
};

export const renderRegister = (req, res) => {
  res.render("users/register", { title: "Create account" });
};

export const handleRegister = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  if (findUserByEmail(email)) {
    req.flash("error", "An account with that email already exists.");
    return res.redirect("/register");
  }

  const user = await createUser({ name, email, password, role });

  await regenerateSession(req);
  req.session.user = toSafeUser(user);
  req.flash("success", `Welcome, ${user.name}!`);
  res.redirect(user.role === "recruiter" ? "/recruiter" : "/jobs");
});

export const handleLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = findUserByEmail(email);
  const isValid = user && (await verifyPassword(user, password));

  if (!isValid) {
    req.flash("error", "Invalid email or password.");
    return res.redirect("/login");
  }

  await regenerateSession(req);
  req.session.user = toSafeUser(user);
  req.flash("success", `Welcome back, ${user.name}!`);
  res.redirect(user.role === "recruiter" ? "/recruiter" : "/jobs");
});

export const handleLogout = (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/");
  });
};
