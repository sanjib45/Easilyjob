import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL?.startsWith("mongodb")) {
  throw new Error("DATABASE_URL must be a MongoDB connection string.");
}

const client = new MongoClient(process.env.DATABASE_URL);
await client.connect();
const databaseName = new URL(process.env.DATABASE_URL).pathname.replace(/^\//, "") || "jobPortal";
const database = client.db(databaseName);

const indexes = {
  User: [
    [{ email: 1 }, { unique: true }],
    [{ verifyToken: 1 }, { unique: true, sparse: true }],
  ],
  Job: [
    [{ recruiterId: 1 }],
    [{ location: 1 }],
    [{ category: 1 }],
    [{ applyBy: 1 }],
    [{ status: 1, applyBy: 1, createdAt: 1 }],
    [{ recruiterId: 1, status: 1, createdAt: 1 }],
  ],
  Application: [
    [{ jobId: 1, email: 1 }, { unique: true }],
    [{ applicantId: 1 }],
    [{ jobId: 1, createdAt: 1 }],
    [{ applicantId: 1, createdAt: 1 }],
  ],
  RefreshToken: [
    [{ tokenHash: 1 }, { unique: true }],
    [{ userId: 1 }],
  ],
  EmailLog: [],
};

try {
  for (const [collectionName, collectionIndexes] of Object.entries(indexes)) {
    await database.createCollection(collectionName).catch((error) => {
      if (error.codeName !== "NamespaceExists") throw error;
    });
    for (const [keys, options] of collectionIndexes) {
      await database.collection(collectionName).createIndex(keys, options);
    }
    console.log(`${collectionName}: ready`);
  }
  console.log(`MongoDB database '${databaseName}' is ready.`);
} finally {
  await client.close();
}
