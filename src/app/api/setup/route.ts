import { NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import { User } from '@/lib/models/User';
import { hashPassword, signSession, setSessionCookie } from '@/lib/auth';
import { isSetupComplete } from '@/lib/setup';

export const runtime = 'nodejs';

export async function GET() {
  const done = await isSetupComplete();
  return NextResponse.json({ setupComplete: done });
}

const schema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_.-]+$/, 'Invalid username'),
  password: z.string().min(8).max(128),
});

export async function POST(req: Request) {
  if (await isSetupComplete()) {
    return NextResponse.json(
      { error: 'Setup already completed. Admin already exists.' },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  await connectDB();
  const passwordHash = await hashPassword(parsed.data.password);
  const user = await User.create({
    username: parsed.data.username.toLowerCase(),
    passwordHash,
    role: 'admin',
  });

  const token = await signSession({
    sub: user._id.toString(),
    username: user.username,
    role: 'admin',
  });
  await setSessionCookie(token);

  return NextResponse.json({ ok: true, username: user.username });
}
