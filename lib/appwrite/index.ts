// lib/appwrite/index.ts

"use server";

import { Account, Avatars, Client, Databases, Storage } from "node-appwrite";
import { appwriteConfig } from "@/lib/appwrite/config";
import { cookies } from "next/headers";

// Retry limit for session fetching
const RETRY_LIMIT = 3;

// Helper function for creating an Appwrite client instance
const initializeClient = () => {
  const client = new Client()
    .setEndpoint(appwriteConfig.endpointUrl)
    .setProject(appwriteConfig.projectId);
  return client;
};

// Helper function to check for session expiration
const getSessionWithRetry = async (retries = RETRY_LIMIT) => {
  let session = (await cookies()).get("appwrite-session");

  for (let attempt = 1; !session && attempt <= retries; attempt++) {
    // Retry fetching session if it's missing
    session = (await cookies()).get("appwrite-session");
  }

  if (!session || !session.value) {
    throw new Error("No session or session has expired. Please sign in again.");
  }

  return session.value;
};

// Create a session-based client, with revalidation and retry logic
export const createSessionClient = async () => {
  const client = initializeClient();

  // Attempt to retrieve the session, with retries
  const sessionToken = await getSessionWithRetry();

  // Explicitly set the session to ensure it’s attached
  client.setSession(sessionToken);

  return {
    get account() {
      return new Account(client);
    },
    get databases() {
      return new Databases(client);
    },
    get storage() {
      return new Storage(client);
    },
  };
};

// Create an admin client with the admin key
export const createAdminClient = async () => {
  const client = initializeClient().setKey(appwriteConfig.secretKey);

  return {
    get account() {
      return new Account(client);
    },
    get databases() {
      return new Databases(client);
    },
    get storage() {
      return new Storage(client);
    },
    get avatars() {
      return new Avatars(client);
    },
  };
};

// Function to handle refreshing or revalidating the session if supported by Appwrite
export const refreshSession = async () => {
  const client = initializeClient();

  try {
    const account = new Account(client);
    const session = await account.createSession(); // Adjust if Appwrite has a session-refresh API
    client.setSession(session.$id);
    return session;
  } catch (error) {
    throw new Error("Failed to refresh session. Please log in again.");
  }
};
