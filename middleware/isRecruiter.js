/** Requires the logged-in user to have the "recruiter" role. */
export const isRecruiter = (req, res, next) => {
  if (req.session.user && req.session.user.role === "recruiter") {
    return next();
  }
  return res.status(403).render("unauthorized", { title: "Access denied" });
};
