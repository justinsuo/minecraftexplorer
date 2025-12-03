"""
Generate labeled fire detection dataset
"""

import time
import json
from pathlib import Path
import mss
from PIL import Image

Path("training_data/fire").mkdir(parents=True, exist_ok=True)
Path("training_data/no_fire").mkdir(parents=True, exist_ok=True)

def capture():
    with mss.mss() as sct:
        img = sct.grab(sct.monitors[1])
        return Image.frombytes('RGB', img.size, img.bgra, 'raw', 'BGRX')

def get_fire_data():
    try:
        with open('fire_data.json', 'r') as f:
            return json.load(f)
    except:
        return {'fires': []}

print("Collecting training data...")
print("Place fires in Minecraft to generate 'fire' samples")

count = 0
while count < 500:
    img = capture()
    data = get_fire_data()
    
    if len(data['fires']) > 0:
        label = 'fire'
        folder = 'training_data/fire'
    else:
        label = 'no_fire'
        folder = 'training_data/no_fire'
    
    img.save(f'{folder}/{count}_{int(time.time())}.jpg')
    
    with open('training_data/labels.json', 'a') as f:
        f.write(json.dumps({
            'id': count,
            'label': label,
            'fire_count': len(data['fires']),
            'timestamp': time.time()
        }) + '\n')
    
    count += 1
    print(f"Collected {count}/500 samples ({label})")
    time.sleep(2)

print("✅ Dataset complete!")