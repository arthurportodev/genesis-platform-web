import { startWebSessionServer } from "./web-session-server";

export default async function globalSetup() {
  return startWebSessionServer();
}
