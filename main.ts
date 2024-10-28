import {
  AtpAgent,
  AtUri,
  type ComAtprotoModerationCreateReport,
  ComAtprotoRepoStrongRef,
} from "npm:@atproto/api";
import { decode } from "jsr:@wok/djwt";
import { load } from "jsr:@std/dotenv";

const { SLACK_WEBHOOK } = await load();

const agent = new AtpAgent({
  service: "https://public.api.bsky.app",
});

Deno.serve({ port: 6969 }, async (request) => {
  const auth = request.headers.get("authorization");
  if (!auth) return new Response("Unauthorized", { status: 401 });
  const [_header, payload] = decode(auth);
  if (typeof payload !== "object" || payload === null || !("sub" in payload)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const did = payload.sub as string;
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
});

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
