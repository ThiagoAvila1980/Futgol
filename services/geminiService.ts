import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Player } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Schema for the structured output we want from Gemini
const teamSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    teamA: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of player IDs for Team A",
    },
    teamB: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of player IDs for Team B",
    },
    reasoning: {
      type: Type.STRING,
      description: "Short explanation of why these teams are balanced.",
    },
  },
  required: ["teamA", "teamB"],
};

export const balanceTeamsWithAI = async (
  players: Player[]
): Promise<{ teamAIds: string[]; teamBIds: string[]; reasoning: string }> => {
  if (!apiKey) {
    throw new Error("API Key não configurada.");
  }

  // Simplify player data for the prompt to save tokens and avoid confusion
  // Use nickname if available, otherwise name, to give the AI context on who is playing
  const simplifiedPlayers = players.map((p) => ({
    id: p.id,
    name: p.nickname || p.name,
    position: p.position,
    rating: p.rating,
  }));

  const prompt = `
    Você é um técnico de futebol especialista. Eu tenho uma lista de jogadores confirmados para uma partida.
    
    Seu objetivo é dividir esses jogadores em dois times (Time A e Time B) de forma equilibrada, considerando:
    1. Equilíbrio de habilidade (rating).
    2. Distribuição de posições (ex: garantir que goleiros fiquem em times opostos se houver 2).
    
    Lista de Jogadores:
    ${JSON.stringify(simplifiedPlayers)}
    
    Retorne apenas os IDs dos jogadores distribuídos.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: teamSchema,
        temperature: 0.3, // Low temperature for more deterministic/logical results
      },
    });

    const result = JSON.parse(response.text || "{}");

    return {
      teamAIds: result.teamA || [],
      teamBIds: result.teamB || [],
      reasoning: result.reasoning || "Times gerados automaticamente.",
    };
  } catch (error) {
    console.error("Erro ao gerar times com IA:", error);
    throw error;
  }
};