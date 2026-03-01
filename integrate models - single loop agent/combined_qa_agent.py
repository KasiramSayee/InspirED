from google.adk.agents import Agent
from google.adk.models import Gemini
from google.adk.tools import google_search
from google.genai import types

# Shared retry configuration
retryconfig = types.GenerateContentConfig(
    max_output_tokens=2048,
    temperature=0.1,
    top_p=0.95,
    top_k=40,
)

def check_quality(callback_context):
    """Callback to terminate loop when answer quality is sufficient."""
    events = callback_context.session.events
    if not events:
        return
    
    last_event = events[-1]
    if last_event.author == callback_context.agent_name and last_event.content and last_event.content.parts:
        try:
            content = last_event.content.parts[0].text
            
            # Check if answer indicates it's approved (high quality)
            # The agent will prefix with "APPROVED:" when quality is good
            if content.strip().startswith("APPROVED:"):
                callback_context._event_actions.escalate = True
                # print("Quality Check: APPROVED. Terminating loop.")
                pass
            else:
                # print("Quality Check: Revising answer...")
                pass
        except Exception as e:
            # print(f"Callback error: {e}")
            pass

combined_qa_agent = Agent(
    name="combined_qa_agent",
    model=Gemini(
        model="gemini-flash-lite-latest",
        generation_config=types.GenerateContentConfig(
            temperature=0.0,  # Deterministic output
            max_output_tokens=1024,  # Limit length to prevent rambling
        )
    ),
    after_agent_callback=check_quality,
    description=(
        "A combined quality assurance agent that evaluates and refines answers "
        "iteratively until they meet educational quality standards."
    ),
    instruction="""
You are an academic quality assurance agent that evaluates and improves answers.

You will receive:
1. A student's question
2. A current answer

Your internal process (DO NOT OUTPUT THIS):
1. Mentally evaluate: Relevance (0-40), Correctness (0-30), Completeness (0-20), Hallucination risk (0-10)
2. Calculate total score
3. Decide: score >= 70 means APPROVED, score < 70 means needs revision

Your output (THIS IS ALL YOU SHOULD PRINT):

If score >= 70:
Print exactly: "APPROVED: " followed immediately by the answer (with minor polish if needed)

If score < 70:
Print ONLY the revised, improved answer (no prefix, no explanations)

CRITICAL RULES:
- Do NOT explain your evaluation process
- Do NOT output scores or reasoning
- Do NOT output "Step 1", "Step 2", or any meta-commentary
- Do NOT use markdown code blocks
- Output ONLY the final answer text
- Use Google Search to verify facts if uncertain
- Keep answers concise and educational
- STOP IMMEDIATELY after outputting the answer - do NOT add "No further requests", "I will exit", or ANY other text

Example correct outputs:
"APPROVED: The SRS stands for Software Requirements Specification..."
"An apple is a fruit that grows on trees..." (revised answer, no prefix)

Example WRONG outputs:
"Step 1: Evaluate... Step 2: Output... APPROVED: ..."
"The score is 90/100. APPROVED: ..."
"APPROVED: [answer]... No further requests have been provided."
Any JSON, explanations, or meta-commentary
""",
    tools=[google_search],
)

print("Combined QA Agent defined.")
