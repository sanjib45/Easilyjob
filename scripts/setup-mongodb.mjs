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
  ApplicationStatusHistory: [
    [{ applicationId: 1, createdAt: 1 }],
    [{ actorId: 1, createdAt: 1 }],
  ],
  Interview: [
    [{ recruiterId: 1, scheduledAt: 1, status: 1 }],
    [{ recruiterId: 1, status: 1, scheduledAt: 1 }],
    [{ recruiterId: 1, createdAt: 1 }],
    [{ applicationId: 1, scheduledAt: 1 }],
    [{ jobId: 1, scheduledAt: 1 }],
  ],
  InterviewEvaluation: [
    [{ interviewId: 1 }, { unique: true }],
    [{ recruiterId: 1, createdAt: 1 }],
    [{ applicationId: 1, createdAt: 1 }],
  ],
  InterviewResult: [
    [{ interviewId: 1 }, { unique: true }],
    [{ applicationId: 1 }],
    [{ recruiterId: 1, sharedAt: 1 }],
  ],
  EmailOutbox: [
    [{ status: 1, nextAttemptAt: 1 }],
    [{ toEmail: 1, createdAt: 1 }],
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

  // Patch any legacy documents in MongoDB with null/missing timestamps
  const now = new Date();
  for (const collName of ["User", "Job", "Application", "Interview", "EmailOutbox"]) {
    await database.collection(collName).updateMany(
      { $or: [{ updatedAt: null }, { updatedAt: { $exists: false } }] },
      { $set: { updatedAt: now } }
    );
    await database.collection(collName).updateMany(
      { $or: [{ createdAt: null }, { createdAt: { $exists: false } }] },
      { $set: { createdAt: now } }
    );
  }
  await database.collection("Application").updateMany(
    { $or: [{ statusUpdatedAt: null }, { statusUpdatedAt: { $exists: false } }] },
    { $set: { statusUpdatedAt: now } }
  );
  console.log("Legacy null timestamp fields patched.");

  console.log(`MongoDB database '${databaseName}' is ready.`);
} finally {
  await client.close();
}
