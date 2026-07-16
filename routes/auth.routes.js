import { Router } from "express";
import { body } from "express-validator";
import {
  renderLogin,
  renderRegister,
  handleRegister,
  handleLogin,
  handleLogout,
} from "../controllers/user.controller.js";
import { validate } from "../middleware/validate.js";
import { isGuest } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { verifyCsrfToken } from "../middleware/csrf.js";

const router = Router();

router.get("/login", isGuest, renderLogin);
router.get("/register", isGuest, renderRegister);

router.post(
  "/register",
  isGuest,
  authLimiter,
  verifyCsrfToken,
  [
    body("name").trim().notEmpty().withMessage("Name is required.").isLength({ max: 100 }),
    body("email").trim().isEmail().withMessage("Enter a valid email address.").normalizeEmail(),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long."),
    body("role").isIn(["applicant", "recruiter"]).withMessage("Select a valid account type."),
  ],
  validate("/register"),
  handleRegister
);

router.post(
  "/login",
  isGuest,
  authLimiter,
  verifyCsrfToken,
  [
    body("email").trim().isEmail().withMessage("Enter a valid email address."),
    body("password").notEmpty().withMessage("Password is required."),
  ],
  validate("/login"),
  handleLogin
);

router.post("/logout", verifyCsrfToken, handleLogout);

export default router;
