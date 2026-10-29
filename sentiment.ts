import { z } from "zod";
import { invokeLLM } from "./_core/llm";

export type FeedbackSentiment = "positive" | "neutral" | "negative";
export type SentimentSource = "ai" | "fallback";

const sentimentResponse = z.object({ sentiment: z.enum(["positive", "neutral", "negative"]) });

function fallbackSentiment(rating: "up" | "down"): FeedbackSentiment {
  return rating === "up" ? "positive" : "negative";
}

export async function classifyFeedbackSentiment(input: { rating: "up" | "down"; comment: string }): Promise<{ sentiment: FeedbackSentiment; sentimentSource: SentimentSource }> {
  const comment = input.comment.trim();
  if (!comment) return { sentiment: fallbackSentiment(input.rating), sentimentSource: "fallback" };

  try {
    const response = await invokeLLM({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: "Classify the emotional sentiment of a support-feedback comment. Return positive for appreciation or satisfaction, negative for frustration or disapproval, and neutral for factual, mixed, or emotionally unclear comments. Analyze only sentiment; do not judge answer correctness. Output only the requested JSON.",
        },
        { role: "user", content: comment },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "feedback_sentiment",
          strict: true,
          schema: {
            type: "object",
            properties: { sentiment: { type: "string", enum: ["positive", "neutral", "negative"] } },
            required: ["sentiment"],
            additionalProperties: false,
          },
        },
      },
    });
    const content = response.choices[0]?.message.content;
    const parsed = sentimentResponse.parse(JSON.parse(typeof content === "string" ? content : "{}"));
    return { sentiment: parsed.sentiment, sentimentSource: "ai" };
  } catch (error) {
    console.warn("[Sentiment] Classification unavailable; using rating fallback", error);
    return { sentiment: fallbackSentiment(input.rating), sentimentSource: "fallback" };
  }
}
