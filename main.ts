import {
  AtpAgent,
  AtUri,
  type ComAtprotoModerationCreateReport,
  ComAtprotoRepoStrongRef,
} from "npm:@atproto/api";
import { decode } from "djwt";
import { load } from "jsr:@std/dotenv";

const { SLACK_WEBHOOK } = await load();

export default {
  async fetch(request) {
    const auth = request.headers.get("authorization");
    if (!auth) return new Response("Unauthorized", { status: 401 });
    const { sub: did } = decode(auth);
    const pathname = new URL(request.url).pathname;
    switch (pathname) {
      case "/":
        return new Response("hello world");
      case "/xrpc/com.atproto.moderation.createReport": {
        const report = await request.json();
        handleReport(
          report as ComAtprotoModerationCreateReport.InputSchema,
          did,
        );
        return new Response("ok");
      }
      default:
        if (pathname.startsWith("/xrpc/")) {
          return new Response("Method Not Implemented", { status: 501 });
        } else {
          return new Response("Not Found", { status: 404 });
        }
    }
  },
} satisfies Deno.ServeDefaultExport;

async function handleReport(
  report: ComAtprotoModerationCreateReport.InputSchema,
  did: string,
) {
  if (
    report.subject.type !== "post" ||
    !ComAtprotoRepoStrongRef.isMain(report.subject)
  ) return;

  const user = await agent.app.bsky.actor.getProfile({ actor: did });

  const aturi = new AtUri(report.subject.uri);

  const message = `
Reported post: https://bsky.app/profile/${aturi.host}/post/${aturi.rkey}

Reported by: @${user.data.handle}
Reason: ${report.reasonType.slice("com.atproto.moderation.defs#reason".length)}
Message:
${report.reason}`;

  await fetch(SLACK_WEBHOOK, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: message,
    }),
  });
}

const agent = new AtpAgent({
  service: "https://public.api.bsky.app",
});
