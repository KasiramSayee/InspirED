import ollama
from typing import List, Dict, Any, Optional

class OllamaClient:
    """
    Helper class to manage communication with the local Ollama server.
    """
    def __init__(self, model: str = "llama3.1:8b"):
        self.model = model

    async def generate(self, prompt: str, system_instruction: Optional[str] = None) -> str:
        """
        Mimics simple generation.
        """
        messages = []
        if system_instruction:
            messages.append({'role': 'system', 'content': system_instruction})
        messages.append({'role': 'user', 'content': prompt})
        
        try:
            response = ollama.chat(model=self.model, messages=messages)
            return response['message']['content']
        except Exception as e:
            print(f"Ollama error: {e}")
            return f"Error connecting to Ollama: {str(e)}"

    async def generate_stream(self, prompt: str, system_instruction: Optional[str] = None):
        """
        Yields text chunks from Ollama in real-time.
        """
        messages = []
        if system_instruction:
            messages.append({'role': 'system', 'content': system_instruction})
        messages.append({'role': 'user', 'content': prompt})
        
        try:
            stream = ollama.chat(model=self.model, messages=messages, stream=True)
            for chunk in stream:
                yield chunk['message']['content']
        except Exception as e:
            print(f"Ollama stream error: {e}")
            yield f"\n[Error connecting to Ollama: {str(e)}]"

    async def generate_json(self, prompt: str, system_instruction: Optional[str] = None) -> Dict[str, Any]:
        """
        Requests JSON output from Ollama.
        """
        import json
        import re
        
        messages = []
        if system_instruction:
            messages.append({'role': 'system', 'content': system_instruction + "\nEXTREMELY IMPORTANT: You MUST return ONLY valid JSON."})
        messages.append({'role': 'user', 'content': prompt})
        
        try:
            response = ollama.chat(
                model=self.model, 
                messages=messages,
                format='json'
            )
            content = response['message']['content']
            
            # Additional safety check to extract JSON
            json_match = re.search(r"\{.*\}", content, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            return json.loads(content)
        except Exception as e:
            print(f"Ollama JSON error: {e}")
            return {"error": str(e), "raw_content": content if 'content' in locals() else ""}

    async def generate_with_verification(self, prompt: str, system_instruction: Optional[str] = None, max_cycles: int = 3) -> str:
        """
        Generates an answer, internally cross-verifying up to max_cycles times to ensure
        pedagogical accuracy and zero hallucination.
        """
        print(f"\n[Validation Loop] Starting {max_cycles}-cycle agentic verification for Ollama...")
        
        # Cycle 1: Initial Generation
        current_answer = await self.generate(prompt, system_instruction)
        
        for cycle in range(1, max_cycles + 1):
            print(f"\n[Validation Loop] Cycle {cycle}/{max_cycles}: Evaluating Candidate Answer")
            
            eval_prompt = f"""
            ORIGINAL PROMPT:
            {prompt}

            CANDIDATE ANSWER TO EVALUATE:
            {current_answer}

            You are a strict academic reviewer checking the CANDIDATE ANSWER against the ORIGINAL PROMPT.
            Evaluate on 4 axes: Relevance (0-40), Correctness (0-30), Completeness (0-20), Hallucination risk (0-10) (0 is high risk, 10 is zero risk).
            
            Return ONLY a valid JSON object describing your evaluation. Do NOT return markdown or explanation.
            {{
                "relevance": number,
                "correctness": number,
                "completeness": number,
                "hallucination_safety": number,
                "total_score": number,
                "critique": "Brief explanation of flaws",
                "is_approved": boolean (true if total_score >= 80 and hallucination_safety == 10)
            }}
            """
            
            eval_result = await self.generate_json(eval_prompt)
            
            if "error" in eval_result:
                print(f"[Validation Loop] Eval error: {eval_result['error']}. Falling back to candidate.")
                return current_answer
                
            total = eval_result.get("total_score", 0)
            approved = eval_result.get("is_approved", False)
            safety = eval_result.get("hallucination_safety", 0)
            
            print(f"   Score: {total}/100 | Hallucination Safety: {safety}/10 | Approved: {approved}")
            print(f"   Critique: {eval_result.get('critique', 'None')}")
            
            if approved:
                print("[Validation Loop] Answer APPROVED. Exiting loop.")
                return current_answer
                
            if cycle < max_cycles:
                print(f"[Validation Loop] Answer REJECTED. Regenerating to fix flaws...")
                refine_prompt = f"""
                ORIGINAL PROMPT:
                {prompt}
                
                YOUR PREVIOUS DRAFT:
                {current_answer}
                
                CRITIQUE TO ADDRESS:
                {eval_result.get('critique', 'Ensure higher accuracy and zero hallucination.')}
                
                Provide a significantly improved answer fixing all issues mentioned in the critique.
                Output ONLY the raw improved answer text. No conversational filler.
                """
                current_answer = await self.generate(refine_prompt, system_instruction)
            else:
                print(f"[Validation Loop] Max cycles reached ({max_cycles}). Returning best effort.")
                
        return current_answer

