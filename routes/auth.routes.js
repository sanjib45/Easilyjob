import { Router } from "express";
import {
  renderLogin,
  renderRegister,
  renderQuickApply,
  handleQuickApplyRegister,
  handleRegister,
  handleLogin,
  handleLogout,
  handleVerifyEmail,
  handleResendVerification,
  renderForgotPassword,
  handleForgotPassword,
  renderResetPassword,
  handleResetPassword,
} from "../controllers/user.controller.js";
import { validate } from "../middleware/validate.js";
import { isGuest, isAuthenticated } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { verifyCsrfToken } from "../middleware/csrf.js";
import { registerValidators, loginValidators } from "../validators/index.js";

const router = Router();
router.get("/login", isGuest, renderLogin);
router.get("/register", isGuest, renderRegister);
router.get("/quick-apply", isGuest, renderQuickApply);
router.post("/api/quick-apply/register", isGuest, authLimiter, verifyCsrfToken, handleQuickApplyRegister);
router.get("/verify-email", handleVerifyEmail);
router.post("/register", isGuest, authLimiter, verifyCsrfToken, registerValidators, validate("/register"), handleRegister);
router.post("/login", isGuest, authLimiter, verifyCsrfToken, loginValidators, validate("/login"), handleLogin);
router.post("/logout", verifyCsrfToken, handleLogout);
router.post("/resend-verification", isAuthenticated, verifyCsrfToken, handleResendVerification);

router.get("/forgot-password", isGuest, renderForgotPassword);
router.post("/forgot-password", isGuest, authLimiter, verifyCsrfToken, handleForgotPassword);
router.get("/reset-password", isGuest, renderResetPassword);
router.post("/reset-password", isGuest, authLimiter, verifyCsrfToken, handleResetPassword);

export default router;
