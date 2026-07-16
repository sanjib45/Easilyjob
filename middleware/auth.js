/** Requires a logged-in user; otherwise redirects to login with a flash message. */
export const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  req.flash("error", "Please log in to continue.");
  res.redirect("/login");
};

/** Redirects already-authenticated users away from login/register pages. */
export const isGuest = (req, res, next) => {
  if (req.session.user) {
    return res.redirect("/jobs");
  }
  next();
};
