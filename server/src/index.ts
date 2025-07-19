import { config } from "dotenv";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { ApiResponse } from "shared/dist";
import properties from "./routes/properties";

// Load environment variables
config();

export const app = new Hono()

  .use(cors())

  .get("/", (c) => {
    return c.text("Hello Hono!");
  })

  .get("/hello", async (c) => {
    const data: ApiResponse = {
      message: "Hello BHVR!",
      success: true,
    };

    return c.json(data, { status: 200 });
  });

// Mount properties routes
app.route("/properties", properties);

export default app;
