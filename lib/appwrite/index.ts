// lib/appwrite/index.ts

"use server";

import { Account, Avatars, Client, Databases, Storage } from "node-appwrite";
import { appwriteConfig } from "@/lib/appwrite/config";
import { cookies } from "next/headers";

const RETRY_LIMIT = 3;

const initializeClient = () => {
  const client = new Client()
    .setEndpoint(appwriteConfig.endpointUrl)
    .setProject(appwriteConfig.projectId);
  return client;
};

const getSessionWithRetry = async (retries = RETRY_LIMIT) => {
  let session = (await cookies()).get("appwrite-session");

  for (let attempt = 1; !session && attempt <= retries; attempt++) {
    session = (await cookies()).get("appwrite-session");
  }

  if (!session || !session.value) {
    throw new Error("No session or session expired. Please sign in again.");
  }

  return session.value;
};

export const createSessionClient = async () => {
  const client = initializeClient();
  const sessionToken = await getSessionWithRetry();

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

export const refreshSession = async () => {
  const client = initializeClient();

  try {
    const account = new Account(client);
    const session = await account.createSession();
    client.setSession(session.$id);
    return session;
  } catch (error) {
    throw new Error("Failed to refresh session. Please log in again.");
  }
};
