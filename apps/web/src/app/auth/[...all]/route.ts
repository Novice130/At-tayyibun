import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest } from "next/server";

const handlers = toNextJsHandler(auth);

export async function GET(req: NextRequest) {
  try {
    return await handlers.GET(req);
  } catch (error) {
    console.error(`[auth-route] GET ${req.nextUrl.pathname} failed:`, error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    return await handlers.POST(req);
  } catch (error) {
    console.error(`[auth-route] POST ${req.nextUrl.pathname} failed:`, error);
    throw error;
  }
}

