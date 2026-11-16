import { MongoClient, Db } from "mongodb";

if (!process.env.MONGODB_URI) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
}

const uri = process.env.MONGODB_URI;
const options = { appName: "fireaid-nextjs" };

// One connection per server process. In development it lives on `global` so
// hot reloads reuse it rather than opening a new pool on every edit.
const globalWithMongo = global as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient> | null;
};

function connect(): Promise<MongoClient> {
  const promise = new MongoClient(uri, options).connect();
  // A failed connect must not be cached, or every later query fails with the
  // same error even after MongoDB comes back (e.g. when the web container
  // starts before mongo is ready). Forget it so the next call retries.
  promise.catch(() => {
    if (globalWithMongo._mongoClientPromise === promise) {
      globalWithMongo._mongoClientPromise = null;
    }
  });
  return promise;
}

export async function getDb(): Promise<Db> {
  globalWithMongo._mongoClientPromise ??= connect();
  const client = await globalWithMongo._mongoClientPromise;
  return client.db("fireaid");
}
