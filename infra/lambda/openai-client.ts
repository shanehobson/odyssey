import OpenAI from "openai";

let _client: OpenAI | undefined;
export function getOpenAI(apiKey: string) {
  if (!_client) {
    console.log("Creating new OpenAI client with timeout configuration");
    _client = new OpenAI({ 
      apiKey,
      timeout: 60000, // 60 second timeout
      maxRetries: 2,
    });
  }
  return _client;
}