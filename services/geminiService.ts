import { StoreZone, DetectionResult, AISettings } from "../types";

// Helper to validate if the string is valid JSON
const tryParseJSON = (jsonString: string) => {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    return null;
  }
};

export const analyzeFrame = async (
  base64Image: string, 
  settings: AISettings
): Promise<DetectionResult | null> => {
  try {
    // Clean base64 string
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

    // Valid zones list for the prompt
    const validZones = Object.values(StoreZone).join(', ');

    const prompt = `
      Analyze this surveillance image of a retail store.
      
      Task:
      1. Count the visible people.
      2. Identify which zones they are in based on a 3x3 grid: ${validZones}.
      
      Output Requirement:
      - Return ONLY a raw JSON object.
      - DO NOT use markdown code blocks (like \`\`\`json).
      - Use the exact schema below:
      
      {
        "personCount": 0,
        "detectedZones": ["Top-Left", "Mid-Center"]
      }
    `;

    // Call Ollama API
    // Ensure no trailing slash in URL
    const baseUrl = settings.serverUrl.replace(/\/$/, '');
    
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.modelName,
        prompt: prompt,
        images: [cleanBase64],
        stream: false,
        format: "json", // Enforce JSON mode
        options: {
          temperature: 0.2, // Lower temperature for more deterministic output
          num_predict: 256
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API Error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Parse the response field from Ollama
    let resultData = data.response;
    
    // Handle string response (Ollama often returns a string containing JSON)
    if (typeof resultData === 'string') {
      // 1. Strip Markdown code blocks if present
      let cleanJson = resultData.replace(/```json\n?|\n?```/g, '').trim();
      
      // 2. Sometimes models add text before/after, try to extract the JSON object regex
      const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanJson = jsonMatch[0];
      }

      const parsed = tryParseJSON(cleanJson);
      if (parsed) {
        resultData = parsed;
      } else {
        console.warn("Could not parse Ollama response as JSON:", resultData);
        return null;
      }
    }

    // Map string response to Enum safely
    const zones: StoreZone[] = (resultData.detectedZones || [])
      .filter((z: string) => Object.values(StoreZone).includes(z as StoreZone))
      .map((z: string) => z as StoreZone);

    return {
      personCount: typeof resultData.personCount === 'number' ? resultData.personCount : 0,
      zones: zones,
      timestamp: Date.now(),
    };

  } catch (error) {
    console.error("Local AI Analysis Error:", error);
    return null;
  }
};