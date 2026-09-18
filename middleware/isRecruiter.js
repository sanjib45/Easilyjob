export const isRecruiter = (req, res, next) => {
  if (String(req.user?.role || "").toUpperCase() === "RECRUITER") {
    return next();
  }
  return res.status(403).render("unauthorized", { title: "Access denied" });
};
