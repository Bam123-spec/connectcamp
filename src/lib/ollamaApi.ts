/**
 * API Service for communicating with a local Ollama instance.
 * 
 * Assumes Ollama is running locally on port 11434.
 * For browser usage, Ollama must be launched with OLLAMA_ORIGINS="*" 
 * to allow CORS requests from the browser.
 * 
 * Example command to run Ollama:
 * OLLAMA_ORIGINS="*" ollama serve
 */

export interface OllamaResponse {
    model: string;
    created_at: string;
    response: string;
    done: boolean;
    context?: number[];
    total_duration?: number;
    load_duration?: number;
    prompt_eval_count?: number;
    prompt_eval_duration?: number;
    eval_count?: number;
    eval_duration?: number;
}

export interface OllamaRequest {
    model: string;
    prompt: string;
    stream?: boolean;
    options?: {
        temperature?: number;
        num_ctx?: number; // Context window size
    };
}

const OLLAMA_URL = "http://localhost:11434/api/generate";
const DEFAULT_MODEL = "llama3.2"; // Or "deepseek-r1" or whatever the user has

export async function generateOllamaResponse(
    prompt: string,
    model: string = DEFAULT_MODEL
): Promise<string> {
    try {
        const response = await fetch(OLLAMA_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model,
                prompt,
                stream: false, // For simplicity in this implementation
                options: {
                    temperature: 0.7, // Balanced creativity/precision
                    num_ctx: 4096,    // Ensure enough context for the snapshot
                },
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ollama API error (${response.status}): ${errorText || response.statusText}`);
        }

        const data: OllamaResponse = await response.json();
        return data.response;
    } catch (error) {
        console.error(`Failed to call Ollama with model ${model}:`, error);
        throw error;
    }
}
