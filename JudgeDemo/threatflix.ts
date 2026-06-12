import SecurityAI from "../SDK/src/index.ts";

export const THREATFLIX_API_KEY = "PASTE_GENERATED_KEY_HERE";

export const threatflix = new SecurityAI({
  apiKey: THREATFLIX_API_KEY,
  projectId: "judge-demo-northstar",
  backendUrl: "http://127.0.0.1:8000/api",
});
