import {
  AtUri,
  type ComAtprotoModerationCreateReport,
  ComAtprotoRepoStrongRef,
} from "npm:@atproto/api";

import { load } from "jsr:@std/dotenv";

const { SLACK_WEBHOOK } = await load();

Deno.serve({ port: 6969 }, async (request) => {
  const pathname = new URL(request.url).pathname;
  switch (pathname) {
    case "/":
      return new Response("hello world");
    case "/xrpc/com.atproto.moderation.createReport": {
      const report = await request.json();
      handleReport(
        report as ComAtprotoModerationCreateReport.InputSchema,
      );
      return Response.json(
        {
          id: 0,
          ...report,
        } satisfies ComAtprotoModerationCreateReport.OutputSchema,
      );
    }
    default:
      if (pathname.startsWith("/xrpc/")) {
        return new Response("Method Not Implemented", { status: 501 });
      } else {
        return new Response("Not Found", { status: 404 });
      }
  }
});

async function handleReport(
  report: ComAtprotoModerationCreateReport.InputSchema,
) {
  if (
    report.subject.type !== "post" ||
    !ComAtprotoRepoStrongRef.isMain(report.subject)
  ) return;

  const aturi = new AtUri(report.subject.uri);

  const message = `
Reported post: https://bsky.app/profile/${aturi.host}/post/${aturi.rkey}

Reason: ${report.reasonType.slice("com.atproto.moderation.defs#reason".length)}
Message:
${report.reason}`;

  const { ok } = await fetch(SLACK_WEBHOOK, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: message,
    }),
  });

  if (ok) {
    console.log("sent message to slack");
  } else {
    console.error("failed to send message to slack");
  }
}
