import type { D1Database } from "@cloudflare/workers-types";

declare global {
  namespace Cloudflare {
    interface Env {
      DB?: D1Database;
    }
  }
}
