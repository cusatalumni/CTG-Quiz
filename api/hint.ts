// This file should be placed in an `api` directory at the root of your project.
// e.g., /api/hint.ts
// It defines a serverless function that hosting platforms like Vercel or Netlify can run.
import { GoogleGenAI } from "@google/genai";

// This config is optional but recommended for Vercel for best performance
export const config = {
  runtime: 'edge',
};

// This is the main handler for the serverless function
export default async function handler(request: Request) {
  // Only allow POST requests
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Ensure the API key is set as an environment variable on the server (e.g., in Vercel settings)
  if (!process.env.API_KEY) {
    console.error('API_KEY environment variable not set on server');
    return new Response(JSON.stringify({ error: 'Server configuration error.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const { questionText } = await request.json();

    if (!questionText) {
        return new Response(JSON.stringify({ error: 'questionText is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const prompt = `Provide a short, subtle, one-sentence hint for the following trivia question. Do not reveal the answer directly. The hint should gently guide someone towards the correct answer. Question: "${questionText}"`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    
    const hint = response.text.trim();

    // Send the hint back to the frontend
    return new Response(JSON.stringify({ hint }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Error in hint API:", error);
    return new Response(JSON.stringify({ error: 'Failed to generate hint' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
