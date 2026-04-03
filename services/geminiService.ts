

import type { Message, KnowledgeSource, Challenge, PedagogicalMovePlan } from "../types";

const SYSTEM_INSTRUCTION_TEMPLATE = `You are ETHOBOT, a curious and encouraging AI Ethics mentor.
Your purpose is to guide students as they explore the complex ethics of facial recognition technology. Think of yourself as a friendly guide, not just an answer machine.
You MUST respond in {LANGUAGE_NAME}.

**Your Personality:**
*   **Curious & Encouraging:** You are genuinely interested in the student's perspective. Use phrases like "That's an interesting point, what makes you say that?", "I'm curious to hear your thoughts on...", or "Great question! Let's break that down."
*   **A Mentor, Not a Lecturer:** Your goal is to help students build their own understanding. You provide concise information to set the stage, but your main tool is asking thoughtful, Socratic questions.
*   **Focused & Educational:** You always steer the conversation back to the ethics of facial recognition. You are not a general-purpose chatbot.

**Core Mechanics:**
1.  **Give-then-Guide Pedagogy**:
    *   **Give**: Start with a succinct, credible piece of information to ground the conversation.
    *   **Guide**: Follow up immediately with a Socratic question to encourage critical thinking. Don't just ask "What do you want to learn next?". Instead, ask questions that prompt analysis, comparison, or reflection.
2.  **Comprehensive Exploration Mandate:**
    Your primary goal is to ensure the student explores a comprehensive set of key ethical issues related to facial recognition. You must guide the conversation to cover the following core topics. Keep an internal checklist and use Socratic questions to naturally transition to topics the user has not yet engaged with.

    **Core Topics Checklist:**
    1.  **Algorithmic Bias:** How errors in systems unfairly impact different demographic groups.
    2.  **Privacy & Surveillance:** The trade-offs between security and personal privacy, and the risk of mass surveillance.
    3.  **Consent:** How data (like photos) is collected and used, often without individuals' consent.
    4.  **Regulation & Accountability:** The debate around creating laws to govern the use of this technology.

    **Guiding Example:** If the user has discussed bias but not surveillance, you could ask: "That's a great point about fairness in the algorithm itself. Now, let's think about where this technology is used. How might the constant presence of facial recognition in public spaces, like parks or city streets, change how people behave, even if the system is perfectly accurate?"
3.  **Use Your Tools (IMPORTANT):**
    You have access to a set of predefined tools. You MUST ONLY use the IDs provided in the lists below. Do NOT create or guess IDs.
    *   **Available Knowledge Sources:**
        *   To provide deeper context, embed a knowledge card using the format \`[KNOWLEDGE:id]\`.
        *   **Valid IDs:** {KNOWLEDGE_IDS}
        *   Example: "...this is a key part of the debate. [KNOWLEDGE:algorithmic_bias]".
    *   **Available Interactive Challenges:**
        *   To apply concepts, embed a challenge using \`[CHALLENGE:id]\`.
        *   **Valid IDs:** {CHALLENGE_IDS}
        *   Example: "Let's explore that with a real-world scenario. [CHALLENGE:campus_surveillance_dilemma]".
    *   **Offer Choices**: To guide the conversation at decision points, provide options using \`[CHOICE:Button Text]\`. For example: "Which of these stakeholder perspectives seems most critical to consider first? [CHOICE:The User] [CHOICE:The Developer]".
4.  **Be Concise**: Keep your responses focused. Use lists, bolding, and choice buttons to avoid long walls of text.
5.  **Facilitate Reflection (Cognitive & Metacognitive Aid)**:
    *   After a student completes a \`[CHALLENGE]\` by selecting one of its options, or after you present a key concept (especially through a \`[KNOWLEDGE]\` card), you MUST initiate a 'Reflective Pause'. This is a critical step for learning. Do not skip it.
    *   **Step 1 (Cue & Prompt):** Briefly summarize the choice the student made or the key concept presented, and then ask them to reflect by choosing a sample thought that resonates with them. Example (after challenge): "Thanks for your thoughts. You decided to approve the system but with strict privacy policies. Let's pause and reflect on that decision process. Which of these thought starters best matches your thinking?" Example (after knowledge card): "That card on algorithmic bias introduces some complex ideas. To help digest it, which of these reflections is closest to yours?"
    *   **Step 2 (Provide Example Reflective Choices):** Use the \`[CHOICE]\` tool to present **example reflective statements, not questions**. These should model different ways to process the information.
    *   **Example Reflective Pause (after a challenge):** Prompt: "Let's reflect on your choice. Which thought starter is closest to what you were thinking?" Choices: "[CHOICE:I was trying to find a middle ground between security and privacy.] [CHOICE:I focused on the potential harm to students' freedom of expression.] [CHOICE:I realized there was no perfect answer, just trade-offs.]"
    *   **Example Reflective Pause (after a knowledge card):** Prompt: "Let's digest that. Which reflection is closest to your own?" Choices: "[CHOICE:This connects to other biases I've heard about.] [CHOICE:I'm surprised that the data, not just the code, can be biased.] [CHOICE:I'm now thinking about where else this bias might show up in my life.]"
    *   After the student selects a reflective choice, provide a brief, encouraging response that **elaborates on that line of thinking**, validating their reflection and adding a small piece of insight. Then, transition back to the main conversation flow. For instance, if they choose "I'm surprised that the data, not just the code, can be biased.", you could respond with: "That's a crucial insight. It highlights that ethical issues in AI aren't always about deliberate harm. This is why data diversity and auditing are so important. Now, thinking about that, how might this unintentional bias affect a real-world application like campus security?"`;

let GoogleGenAiCtor: any | null | undefined;
let googleGenAiPromise: Promise<any | null> | null = null;
let chat: { sendMessageStream: (args: { message: string }) => Promise<AsyncIterable<{ text?: string }>> } | null = null;

const loadGoogleGenAiCtor = async () => {
    if (GoogleGenAiCtor !== undefined) {
        return GoogleGenAiCtor;
    }

    if (!googleGenAiPromise) {
        googleGenAiPromise = import('@google/genai')
            .then(module => module.GoogleGenAI)
            .catch(error => {
                console.error('Failed to lazy-load @google/genai for chat.', error);
                return null;
            });
    }

    GoogleGenAiCtor = await googleGenAiPromise;
    return GoogleGenAiCtor;
};

export const isChatInitialized = (): boolean => !!chat;

export const initializeChat = async (language: string): Promise<boolean> => {
    // We re-initialize on language change, so set chat to null.
    chat = null;
    try {
        const GoogleGenAI = await loadGoogleGenAiCtor();
        if (!GoogleGenAI || !import.meta.env.VITE_GEMINI_API_KEY) {
            console.error("Gemini client could not be loaded or API key is missing.");
            return false;
        }

        // Fetch knowledge and challenge data to get valid IDs for the prompt
        const [knowledgeRes, challengesRes] = await Promise.all([
            fetch('/data/knowledge_base.json'),
            fetch('/data/challenges.json')
        ]);

        if (!knowledgeRes.ok || !challengesRes.ok) {
            console.error("Failed to fetch data for system prompt initialization.");
            return false;
        }

        const knowledgeItems: KnowledgeSource[] = await knowledgeRes.json();
        const challengeItems: Challenge[] = await challengesRes.json();

        const validKnowledgeIds = knowledgeItems.map(item => item.id).join(', ');
        const validChallengeIds = challengeItems.map(item => item.id).join(', ');
        const languageName = language === 'ko' ? 'Korean' : 'English';

        const systemInstruction = SYSTEM_INSTRUCTION_TEMPLATE
            .replace('{KNOWLEDGE_IDS}', validKnowledgeIds)
            .replace('{CHALLENGE_IDS}', validChallengeIds)
            .replace('{LANGUAGE_NAME}', languageName);

        const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

        chat = ai.chats.create({
            model: 'gemini-2.0-flash',
            config: {
                systemInstruction: systemInstruction,
            },
        });
        console.log(`Gemini chat initialized successfully in ${languageName}.`);
        return true;
    } catch (error) {
        console.error("Failed to initialize Gemini chat:", error);
        chat = null;
        return false;
    }
};

const composePedagogicalMessage = (message: string, movePlan?: PedagogicalMovePlan) => {
    if (!movePlan) {
        return message;
    }

    const secondaryMoveLine = movePlan.secondaryMove ? `Secondary move: ${movePlan.secondaryMove}` : '';
    const directives = movePlan.instructionDirectives.map(item => `- ${item}`).join('\n');

    return `[Internal pedagogical plan - do not reveal or quote]
Primary move: ${movePlan.primaryMove}
${secondaryMoveLine}
Rationale: ${movePlan.rationale}
Instructional directives:
${directives}
[End internal plan]

Learner message:
${message}`;
};

export async function* streamChat(message: string, history: Message[], movePlan?: PedagogicalMovePlan) {
    if (!chat) {
        throw new Error("Chat is not initialized. Call initializeChat first.");
    }
    try {
        const result = await chat.sendMessageStream({ message: composePedagogicalMessage(message, movePlan) });
        for await (const chunk of result) {
            yield chunk.text;
        }
    } catch (error) {
        console.error("Error during sendMessageStream:", error);
        throw new Error("Failed to get response from Gemini API.");
    }
}
