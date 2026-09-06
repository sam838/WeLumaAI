import { auth } from "./firebase";

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const user = auth?.currentUser;
  if (!user || user.isAnonymous) {
    throw new Error("Sign in with Google to continue.");
  }
  const token = await user.getIdToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
