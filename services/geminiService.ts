export const getHint = async (questionText: string): Promise<string> => {
  try {
    const response = await fetch('/api/hint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ questionText }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({})); // try to parse error, but don't fail if it's not JSON
        console.error("API Error Response:", errorData);
        throw new Error(`Failed to fetch hint. Status: ${response.status}`);
    }

    const data = await response.json();
    return data.hint || "Sorry, couldn't get a hint.";

  } catch (error) {
    console.error("Error fetching hint from API route:", error);
    return "Sorry, I couldn't get a hint for you right now.";
  }
};