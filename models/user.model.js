import bcrypt from "bcryptjs";
import { db } from "../config/database.js";

const SALT_ROUNDS = 12;

export const getAllUsers = () => db.data.users;

export const findUserByEmail = (email) =>
  db.data.users.find(
    (user) => user.email.toLowerCase() === String(email).toLowerCase()
  );

export const findUserById = (id) => db.data.users.find((user) => user.id === id);

/**
 * Creates a new user with a securely hashed password.
 * Returns the created user (including the hash) — callers should use
 * toSafeUser() before sending anything back to a view/session.
 */
export const createUser = async ({ name, email, password, role }) => {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = {
    id: Date.now().toString(),
    name,
    email: email.toLowerCase(),
    passwordHash,
    role: role === "recruiter" ? "recruiter" : "applicant",
    createdAt: new Date().toISOString(),
  };
  db.data.users.push(user);
  await db.write();
  return user;
};

export const verifyPassword = async (user, password) => {
  if (!user || !user.passwordHash) return false;
  return bcrypt.compare(password, user.passwordHash);
};

/** Strips sensitive fields before storing in session / rendering views. */
export const toSafeUser = (user) => {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
};
