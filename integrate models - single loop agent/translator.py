import asyncio
import edge_tts
import pygame
import time
import os
import hashlib
import re
from deep_translator import GoogleTranslator

class PedagogyEngine:
    def __init__(self, cache_dir="lesson_cache"):
        self.cache_dir = cache_dir
        os.makedirs(cache_dir, exist_ok=True)

        # Voice map
        self.voice_map = {
            'hi': {'male': 'hi-IN-MadhurNeural', 'female': 'hi-IN-SwararaNeural'},
            'ta': {'male': 'ta-IN-ValluvarNeural', 'female': 'ta-IN-PallaviNeural'},
            'te': {'male': 'te-IN-MohanNeural', 'female': 'te-IN-ShrutiNeural'},
            'en': {'male': 'en-IN-PrabhatNeural', 'female': 'en-IN-NeerjaNeural'},
            'en-us': {'male': 'en-US-GuyNeural', 'female': 'en-US-AriaNeural'},
            'es': {'male': 'es-ES-AlvaroNeural', 'female': 'es-ES-ElviraNeural'}
        }

    def _hash(self, text, lang):
        return hashlib.md5(f"{text}_{lang}".encode()).hexdigest()

    def clean_text(self, text):
        """Removes markdown and special characters that interfere with TTS."""
        # Remove asterisks, hashes, underscores, tildes, backticks, brackets
        return re.sub(r"[*#_~`\[\]]", "", text)

    def parse_dialogue(self, dialogue_text):
        # Improved regex to capture everything until the next speaker tag
        pattern = r"(Male|Female):\s*(.*?)(?=\s*(?:Male|Female):|$)"
        matches = re.findall(pattern, dialogue_text, re.DOTALL)
        
        # Fallback: if no speaker tags are found, treat the whole text as spoken by 'Male'
        if not matches and dialogue_text.strip():
            return [("male", dialogue_text.strip())]
            
        return [(speaker.lower(), text.strip()) for speaker, text in matches]

    async def process_dialogue(self, dialogue_text, lang_code):
        dialogue_parts = self.parse_dialogue(dialogue_text)
        audio_files = []

        print(f"\nProcessing {len(dialogue_parts)} dialogue parts...")

        for idx, (speaker, text) in enumerate(dialogue_parts):
            # 1. Translate first (if needed) to ensure hash is based on the final text
            final_text = text
            if not lang_code.startswith("en"):
                try:
                    final_text = GoogleTranslator(source='en', target=lang_code).translate(text)
                except Exception as e:
                    print(f"   [!] Translation failed for part {idx+1}, using original text: {e}")
                    final_text = text

            # Clean text for TTS
            final_text = self.clean_text(final_text)

            # 2. Check Cache
            cache_id = self._hash(final_text, lang_code + speaker)
            audio_path = os.path.join(self.cache_dir, f"{cache_id}.mp3")

            if os.path.exists(audio_path):
                print(f"   -> {idx+1}/{len(dialogue_parts)}: Using cached audio")
            else:
                voice = self.voice_map.get(lang_code, self.voice_map['en'])[speaker]
                print(f"   -> {idx+1}/{len(dialogue_parts)}: Generating audio ({voice})")
                
                try:
                    communicate = edge_tts.Communicate(final_text, voice)
                    await communicate.save(audio_path)
                    
                    # Add small delay to avoid rate limiting
                    await asyncio.sleep(0.5)
                    
                except Exception as e:
                    print(f"   [!] Failed to generate audio for part {idx+1}: {e}")
                    # Create a silent placeholder or skip
                    continue
            
            audio_files.append(audio_path)

        return audio_files

    def save_conversation(self, audio_files, output_filename="conversation.mp3"):
        print(f"\nSaving full conversation to {output_filename}...")
        try:
            with open(output_filename, "wb") as outfile:
                for f in audio_files:
                    with open(f, "rb") as infile:
                        outfile.write(infile.read())
            print(f"[OK] Saved: {output_filename}")
        except Exception as e:
            print(f"[Error] Error saving conversation: {e}")

    def play_conversation(self, audio_files):
        if not audio_files:
            print("No audio files to play.")
            return

        pygame.mixer.init()
        print("\nStarting Playback...\n")
        
        try:
            for file in audio_files:
                pygame.mixer.music.load(file)
                pygame.mixer.music.play()
                # Wait for the current clip to finish
                while pygame.mixer.music.get_busy():
                    pygame.time.Clock().tick(10)
        except Exception as e:
            print(f"Error during playback: {e}")
        finally:
            pygame.mixer.quit()

# ---------------- RUNNER ----------------
async def main():
    engine = PedagogyEngine()

    dialogue ="""
Male: Hello! I want to test if the *asterisks* are gone.

Female: Sure! What about #hashtags and _underscores_?

Male: They should be silent. even ~tildes~ and `backticks`.

Female: That's great! [This text in brackets] should also be cleaned up.
    """
    print("--- Multilingual Pedagogy Engine ---")
    lang = input("Enter Language Code (en/hi/ta/te/es): ").lower().strip()

    # Process (Translate + TTS)
    audio_files = await engine.process_dialogue(dialogue, lang)
    
    # Save Combined Audio
    engine.save_conversation(audio_files, f"output_{lang}.mp3")
    
    # Play
    engine.play_conversation(audio_files)
    print("\n[OK] Conversation Finished.")

if __name__ == "__main__":
    asyncio.run(main())