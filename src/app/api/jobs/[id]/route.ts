import { NextRequest, NextResponse } from "next/server";
import { getJob, publicJobSnapshot } from "@/lib/job-store";
import { resumeJobIfNeeded } from "@/lib/job-runner";
import { commitGeneration, refundGeneration } from "@/lib/rate-limiter";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: { id: string } | Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const resolved = await Promise.resolve(ctx.params);
    const id = resolved.id;
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: "无效的任务编号" }, { status: 400 });
    }
    const job = await getJob(id);
    if (!job) {
      return NextResponse.json({ error: "找不到这个任务" }, { status: 404 });
    }

    if (job.status === "done") {
      void commitGeneration(id);
    } else if (job.status === "error") {
      void refundGeneration(id);
    } else if (job.status === "queued" || job.status === "running") {
      void resumeJobIfNeeded(id);
    }

    return NextResponse.json({ job: publicJobSnapshot(job) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "读取任务失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
