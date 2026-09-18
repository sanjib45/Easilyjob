import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import initSqlJs from "sql.js";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const require = createRequire(import.meta.url);
const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sqlitePath = path.join(rootDir, "prisma", "dev.db");

if (!process.env.DATABASE_URL?.startsWith("mongodb")) {
  throw new Error("DATABASE_URL must be a MongoDB connection string.");
}
if (!fs.existsSync(sqlitePath)) {
  throw new Error(`SQLite source database not found: ${sqlitePath}`);
}

const SQL = await initSqlJs({
  locateFile: (file) => path.join(path.dirname(require.resolve("sql.js")), file),
});
const sqlite = new SQL.Database(fs.readFileSync(sqlitePath));
const readTable = (table) => {
  const result = sqlite.exec(`SELECT * FROM "${table}"`)[0];
  if (!result) return [];
  return result.values.map((values) => Object.fromEntries(result.columns.map((column, index) => [column, values[index]])));
};

const dateFields = {
  User: ["createdAt", "updatedAt", "verifyExpires"],
  Job: ["applyBy", "closedAt", "publishedAt", "createdAt", "updatedAt"],
  Application: ["createdAt"],
  RefreshToken: ["expiresAt", "revokedAt", "createdAt"],
  EmailLog: ["createdAt"],
};

const booleanFields = {
  User: ["emailVerified"],
};

const prepare = (model, row) => {
  const document = { ...row, _id: String(row.id) };
  delete document.id;
  for (const field of dateFields[model] || []) {
    if (document[field]) document[field] = new Date(document[field]);
    else if (document[field] === null) delete document[field];
  }
  for (const [field, value] of Object.entries(document)) {
    if (value === null) delete document[field];
  }
  for (const field of booleanFields[model] || []) {
    if (field in document) document[field] = Boolean(Number(document[field]));
  }
  if (model === "Job") {
    document.status ||= "OPEN";
    document.applicationsAccepted = Number(document.applicationsAccepted || 0);
  }
  return document;
};

const client = new MongoClient(process.env.DATABASE_URL);
await client.connect();
const databaseName = new URL(process.env.DATABASE_URL).pathname.replace(/^\//, "") || "jobPortal";
const database = client.db(databaseName);

try {
  if (process.env.MONGO_IMPORT_REPLACE === "true") {
    for (const model of ["Application", "RefreshToken", "EmailLog", "Job", "User"]) {
      await database.collection(model).deleteMany({});
    }
    console.log("MongoDB application collections cleared before replacement import.");
  }

  for (const model of ["User", "Job", "Application", "RefreshToken", "EmailLog"]) {
    const collection = database.collection(model);
    const rows = readTable(model);
    for (const row of rows) {
      await collection.replaceOne({ _id: String(row.id) }, prepare(model, row), { upsert: true });
    }
    console.log(`${model}: migrated ${rows.length} record(s)`);
  }
  console.log(`SQLite data migrated to MongoDB database '${databaseName}'.`);
} finally {
  sqlite.close();
  await client.close();
}
