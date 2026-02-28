import { defineApp } from "convex/server";
import authKit from "@convex-dev/workos-authkit/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import agent from "@convex-dev/agent/convex.config";
import rag from "@convex-dev/rag/convex.config";
import aggregate from "@convex-dev/aggregate/convex.config";
import migrations from "@convex-dev/migrations/convex.config";
import actionRetrier from "@convex-dev/action-retrier/convex.config";
import timeline from "convex-timeline/convex.config";

const app = defineApp();

app.use(authKit);
app.use(rateLimiter);
app.use(agent);
app.use(rag);
app.use(aggregate);
app.use(migrations);
app.use(actionRetrier);
app.use(timeline);

export default app;
