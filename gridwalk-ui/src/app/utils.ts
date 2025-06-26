"use server";
import { cookies } from "next/headers";

export async function getAuthToken() {
  const cookieStore = await cookies();
  const sid = cookieStore.get("sid");

  if (!sid?.value) {
    throw new Error("Authentication token not found");
  }

  return sid.value;
}
