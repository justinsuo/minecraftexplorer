# Training Guide: Fine-Tuning the AI FireBot

## Current Status
- ✅ Bot **collects** training data (screenshots + labels)
- ❌ Bot does **NOT** learn from data automatically
- The bot uses the base LLaVA 7B model (not trained on Minecraft fires)

## How to Train the Model

### Step 1: Collect Training Data
Run the bot for several hours to collect 500-1000+ images:
```bash
python3 advanced_ai_firebot.py
```

Your training data will be in:
- `training_data/fire_detected/` - Images with fire
- `training_data/no_fire/` - Images without fire
- `training_data/uncertain/` - Review and manually sort these
- `training_data/training_log.csv` - Metadata for all samples

### Step 2: Clean the Dataset
1. Review `training_data/uncertain/` folder
2. Manually move correct images to `fire_detected/` or `no_fire/`
3. Delete bad/blurry screenshots

### Step 3: Fine-Tune LLaVA Model
This requires significant computing power (GPU recommended).

**Option A: Use Ollama's Fine-Tuning** (Easiest, but limited)
- Ollama doesn't currently support vision model fine-tuning
- Wait for future Ollama updates

**Option B: Use LLaVA-NeXT Fine-Tuning** (Advanced)
1. Convert training data to LLaVA format
2. Use Hugging Face's `transformers` library
3. Fine-tune on GPU (requires 16GB+ VRAM)
4. Export to Ollama format

**Option C: Use API-based Fine-Tuning** (Paid)
- Use OpenAI GPT-4 Vision fine-tuning (when available)
- Use Anthropic Claude Vision fine-tuning (when available)

### Step 4: Use Fine-Tuned Model
Replace `llava:7b` with your fine-tuned model:
```python
response = ollama.generate(
    model='minecraft-firebot-finetuned',  # Your custom model
    prompt=prompt,
    images=[img_base64]
)
```

## Alternative: Improve Without Fine-Tuning

Instead of fine-tuning, you can improve the bot by:
1. **Better prompts** - Improve the system prompt (already doing this)
2. **Larger models** - Use `llava:13b` or `llava:34b` (slower but smarter)
3. **Rule-based fallback** - If AI is unsure, use thermal sensors only

## Training Data Best Practices

### What Makes Good Training Data?
- ✅ **Diverse scenarios**: Day/night, different biomes, various fire sizes
- ✅ **Clear labels**: Fire visible in image = fire_detected
- ✅ **Balanced dataset**: ~50% fire, ~50% no fire
- ✅ **High quality**: Clear screenshots, bot looking at relevant area

### What Makes Bad Training Data?
- ❌ Blurry/dark screenshots
- ❌ Bot looking at sky/ground (not relevant)
- ❌ Mislabeled data (fire in image but labeled "no_fire")
- ❌ Duplicate images

## Current Limitations

The bot collects data but doesn't learn because:
1. **No feedback loop**: Bot doesn't know if its decisions were correct
2. **No model updates**: Fine-tuning requires manual process
3. **No reward signal**: No way to measure "success" vs "failure"

## Future Improvements

To make the bot truly learn:
1. **Reinforcement Learning**: Reward bot for extinguishing fires quickly
2. **Online Learning**: Update model after each session
3. **Human Feedback**: Rate bot decisions to improve prompts
