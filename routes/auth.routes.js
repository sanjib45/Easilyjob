import { Router } from "express";
import { renderLogin, renderRegister, handleRegister, handleLogin, handleLogout, handleVerifyEmail, handleResendVerification } from "../controllers/user.controller.js";
import { validate } from "../middleware/validate.js";
import { isGuest, isAuthenticated } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { verifyCsrfToken } from "../middleware/csrf.js";
import { registerValidators, loginValidators } from "../validators/index.js";

const router = Router();
router.get("/login", isGuest, renderLogin);
router.get("/register", isGuest, renderRegister);
router.get("/verify-email", handleVerifyEmail);
router.post("/register", isGuest, authLimiter, verifyCsrfToken, registerValidators, validate("/register"), handleRegister);
router.post("/login", isGuest, authLimiter, verifyCsrfToken, loginValidators, validate("/login"), handleLogin);
router.post("/logout", verifyCsrfToken, handleLogout);
router.post("/resend-verification", isAuthenticated, verifyCsrfToken, handleResendVerification);
export default router;
