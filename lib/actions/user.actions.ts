//lib/actions/user.actions.ts

"use server";

import { createAdminClient, createSessionClient } from "@/lib/appwrite";
import { appwriteConfig } from "@/lib/appwrite/config";
import { Query, ID } from "node-appwrite";
import { parseStringify } from "@/lib/utils";
import { cookies } from "next/headers";
import { avatarPlaceholderUrl } from "@/constants";
import { redirect } from "next/navigation";

const getUserByEmail = async (email: string) => {
  const { databases } = await createAdminClient();

  const result = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.usersCollectionId,
    [Query.equal("email", [email])]
  );

  return result.total > 0 ? result.documents[0] : null;
};

const handleError = (error: unknown, message: string) => {
  console.log(error, message);
  throw error;
};

// Send OTP via email and retrieve the OTP token ID
export const sendEmailOTP = async ({ email }: { email: string }) => {
  const { account } = await createAdminClient();

  try {
    const token = await account.createEmailToken(ID.unique(), email);
    return token.$id;  // Return the token ID for verification
  } catch (error) {
    handleError(error, "Failed to send email OTP");
  }
};

// Create user account if not existing, then send OTP
export const createAccount = async ({
  fullName,
  email,
}: {
  fullName: string;
  email: string;
}) => {
  const existingUser = await getUserByEmail(email);
  const { account } = await createAdminClient();

  // Create account if not existing
  if (!existingUser) {
    const newAccount = await account.create(ID.unique(), email, "password_placeholder", fullName);
    const accountId = newAccount.$id;

    const { databases } = await createAdminClient();
    await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.usersCollectionId,
      ID.unique(),
      {
        accountId,
        fullName,
        email,
        avatar: avatarPlaceholderUrl,
      }
    );

    return parseStringify({ accountId });
  }

  // Send OTP for existing user
  const tokenId = await sendEmailOTP({ email });
  if (!tokenId) throw new Error("Failed to send OTP");

  return parseStringify({ accountId: existingUser.$id });
};

// Verify OTP and create session
export const verifySecret = async ({
  accountId,
  token,
}: {
  accountId: string;
  token: string;
}) => {
  try {
    const { account } = await createAdminClient();
    const session = await account.updateEmailVerification(accountId, token);

    if (session) {
      // Setting the session cookie explicitly
      (await cookies()).set("appwrite-session", session.$id, {
        path: "/",
        httpOnly: true,
        sameSite: "strict",
        secure: true,
      });
    }

    return parseStringify({ sessionId: session.$id });
  } catch (error) {
    handleError(error, "Failed to verify OTP");
  }
};

// Fetch and return current user info
export const getCurrentUser = async () => {
  try {
    const { databases, account } = await createSessionClient();

    const userAccount = await account.get();
    const user = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.usersCollectionId,
      [Query.equal("accountId", userAccount.$id)]
    );

    if (user.total <= 0) return null;
    return parseStringify(user.documents[0]);
  } catch (error) {
    console.log(error);
  }
};

// Sign out user and remove session
export const signOutUser = async () => {
  const { account } = await createSessionClient();

  try {
    await account.deleteSession("current");
    (await cookies()).delete("appwrite-session");
  } catch (error) {
    handleError(error, "Failed to sign out user");
  } finally {
    redirect("/sign-in");
  }
};
