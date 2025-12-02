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
    // Clean base64 string (Ollama usually expects the raw base64 without prefix, 
    // but some clients handle it. We strip it to be safe.)
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

    const prompt = `
      Analyze this surveillance image of a retail store.
      Task:
      1. Count the visible people.
      2. Locate them in a 3x3 grid (Top-Left, Top-Center, Top-Right, Mid-Left, Mid-Center, Mid-Right, Bottom-Left, Bottom-Center, Bottom-Right).
      
      Return ONLY a JSON object with this exact schema:
      {
        "personCount": number,
        "detectedZones": ["ZoneName", "ZoneName"]
      }
      Do not include markdown formatting or explanations.
    `;

    // Call Ollama API
    const response = await fetch(`${settings.serverUrl.replace(/\/$/, '')}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.modelName,
        prompt: prompt,
        images: [cleanBase64],
        stream: false,
        format: "json" // Force JSON mode (supported by newer Ollama versions)
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API Error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Parse the response field from Ollama
    let resultData = data.response;
    
    // If it's a string, try to parse it as JSON
    if (typeof resultData === 'string') {
      const parsed = tryParseJSON(resultData);
      if (parsed) {
        resultData = parsed;
      } else {
        console.warn("Could not parse Ollama response as JSON", resultData);
        // Fallback or regex extraction could go here
        return null;
      }
    }

    // Map string response to Enum
    const zones: StoreZone[] = (resultData.detectedZones || []).map((z: string) => z as StoreZone);

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