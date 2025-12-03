"""
Capture what bot sees and send to AI
"""

import mss
import ollama
import base64
from PIL import Image
import io
import time

def capture_minecraft_screen():
    """Take screenshot of Minecraft window"""
    with mss.mss() as sct:
        # Capture primary monitor
        monitor = sct.monitors[1]
        screenshot = sct.grab(monitor)
        
        # Convert to PIL Image
        img = Image.frombytes('RGB', screenshot.size, screenshot.bgra, 'raw', 'BGRX')
        
        # Resize for AI (smaller = faster)
        img = img.resize((640, 480))
        
        return img

def ask_ai_about_scene(img):
    """Send image to LLaVA and get description"""
    
    # Convert image to base64
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    img_base64 = base64.b64encode(buffered.getvalue()).decode()
    
    # Ask AI
    prompt = """
You are a fire detection AI looking at a Minecraft scene.

Answer these questions:
1. Do you see any FIRE, FLAMES, or LAVA? (YES/NO)
2. Do you see any SMOKE? (YES/NO)
3. What terrain do you see? (forest/plains/cave/building)
4. Is the path ahead clear to walk? (YES/NO)
ç
Keep response under 50 words.
"""
    
    print("Asking AI...")
    response = ollama.generate(
        model='llava:7b',
        prompt=prompt,
        images=[img_base64]
    )
    
    return response['response']

# Main loop
print("Starting AI vision test...")
print("Open Minecraft and press Enter")
input()

while True:
    print("\n" + "="*60)
    
    # Capture screen
    img = capture_minecraft_screen()
    print("📸 Screenshot captured")
    
    # Get AI description
    ai_response = ask_ai_about_scene(img)
    print(f"\n🤖 AI says:\n{ai_response}")
    
    # Wait before next check
    time.sleep(5)