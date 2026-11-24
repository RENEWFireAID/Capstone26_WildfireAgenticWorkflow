// System prompt lines shared by the app chats, so every assistant answers and charts the same way.

export const ANSWER_RULES = `- Answer in plain, friendly language. Never mention tools, function names, parameters, or JSON. Just give the answer.
- If a lookup fails or the data isn't there, say so. Don't make up numbers or facts.`;

export const CHART_RULES = `- When a chart would help, or the user asks for one, add a fenced code block tagged chart holding one JSON object:
  {"type": "bar" | "line" | "pie" | "scatter", "title": string, "description"?: string, "data": [{"label": string, "value": number}]}
  Only chart numbers you got from a lookup. Keep labels short (a few words) and the description to one sentence. Keep the written answer short and put the chart after it.`;
