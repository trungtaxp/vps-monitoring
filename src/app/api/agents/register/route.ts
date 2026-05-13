import { NextResponse } from 'next/server';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { connectDB } from '@/lib/db';
import { Agent } from '@/lib/models/Agent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  agentId: z.string().min(8).max(64).optional(),
  hostname: z.string().max(255).default('unknown'),
  os: z.string().max(64).default('unknown'),
  osVersion: z.string().max(128).default(''),
  kernel: z.string().max(128).default(''),
  arch: z.string().max(32).default(''),
  cpuModel: z.string().max(255).default(''),
  cpuCores: z.number().int().min(0).max(4096).default(0),
  totalMemoryBytes: z.number().min(0).default(0),
  totalDiskBytes: z.number().min(0).default(0),
  publicIp: z.string().max(64).optional(),
  privateIp: z.string().max(64).optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  await connectDB();

  let agent = parsed.data.agentId
    ? await Agent.findOne({ agentId: parsed.data.agentId })
    : null;

  if (agent) {
    Object.assign(agent, {
      hostname: parsed.data.hostname,
      os: parsed.data.os,
      osVersion: parsed.data.osVersion,
      kernel: parsed.data.kernel,
      arch: parsed.data.arch,
      cpuModel: parsed.data.cpuModel,
      cpuCores: parsed.data.cpuCores,
      totalMemoryBytes: parsed.data.totalMemoryBytes,
      totalDiskBytes: parsed.data.totalDiskBytes,
      publicIp: parsed.data.publicIp,
      privateIp: parsed.data.privateIp,
    });
    await agent.save();
    return NextResponse.json({
      ok: true,
      agentId: agent.agentId,
      token: agent.token,
      reused: true,
    });
  }

  const agentId = parsed.data.agentId ?? `vps_${nanoid(16)}`;
  const token = `tok_${nanoid(40)}`;

  agent = await Agent.create({
    agentId,
    token,
    hostname: parsed.data.hostname,
    os: parsed.data.os,
    osVersion: parsed.data.osVersion,
    kernel: parsed.data.kernel,
    arch: parsed.data.arch,
    cpuModel: parsed.data.cpuModel,
    cpuCores: parsed.data.cpuCores,
    totalMemoryBytes: parsed.data.totalMemoryBytes,
    totalDiskBytes: parsed.data.totalDiskBytes,
    publicIp: parsed.data.publicIp,
    privateIp: parsed.data.privateIp,
    registeredAt: new Date(),
  });

  return NextResponse.json({ ok: true, agentId: agent.agentId, token: agent.token, reused: false });
}
