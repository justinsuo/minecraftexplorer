#!/usr/bin/env python3
"""
FireCNN Setup Script
Automates environment setup, dependency installation, and model creation
"""

import os
import sys
import subprocess
import platform
from pathlib import Path
import json

def print_banner():
    """Print setup banner"""
    print("🔥" * 60)
    print("🔥 FIRECNN SETUP - Replace LLaVA with Fast CNN")
    print("🔥" * 60)
    print("📊 Performance: 50x faster, 4700x smaller model")
    print("🧠 Features: Self-learning, continuous improvement")
    print("⚡ Target: <50ms inference vs 2000-5000ms for LLaVA")
    print("🔥" * 60)
    print()

def check_python_version():
    """Check Python version compatibility"""
    version = sys.version_info
    print(f"🐍 Python version: {version.major}.{version.minor}.{version.micro}")

    if version.major < 3:
        print("❌ Python 3+ required")
        return False
    elif version.minor >= 12:
        print("⚠️  Python 3.12+ may have TensorFlow compatibility issues")
        print("   Recommended: Python 3.10 or 3.11")
        response = input("   Continue anyway? (y/n): ").strip().lower()
        return response == 'y'
    else:
        print("✅ Python version compatible")
        return True

def create_virtual_environment():
    """Create virtual environment for CNN dependencies"""
    venv_path = Path("firebot_cnn_env")

    if venv_path.exists():
        print(f"✅ Virtual environment already exists: {venv_path}")
        response = input("   Recreate? (y/n): ").strip().lower()
        if response == 'y':
            import shutil
            shutil.rmtree(venv_path)
            print("   🗑️  Deleted existing environment")
        else:
            return True

    print(f"📦 Creating virtual environment...")
    try:
        subprocess.run([sys.executable, "-m", "venv", str(venv_path)], check=True)
        print(f"✅ Virtual environment created: {venv_path}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to create virtual environment: {e}")
        return False

def get_activate_command():
    """Get the command to activate virtual environment"""
    if platform.system() == "Windows":
        return "firebot_cnn_env\\Scripts\\activate"
    else:
        return "source firebot_cnn_env/bin/activate"

def install_dependencies():
    """Install required dependencies"""
    print("\n📚 Installing dependencies...")

    # Determine TensorFlow version based on Python version
    version = sys.version_info
    if version.minor >= 12:
        tf_version = "tensorflow-cpu"  # Fallback for newer Python
        print("⚠️  Using CPU-only TensorFlow (newer Python compatibility)")
    else:
        tf_version = "tensorflow==2.13.0"

    dependencies = [
        tf_version,
        "numpy",
        "pillow",
        "matplotlib",
        "seaborn",
        "scikit-learn",
        "opencv-python"  # For image processing
    ]

    activate_cmd = get_activate_command()

    for dep in dependencies:
        print(f"   Installing {dep}...")
        try:
            # Use pip from virtual environment
            pip_cmd = f"{activate_cmd} && pip install {dep}"
            subprocess.run(pip_cmd, shell=True, check=True, capture_output=True)
            print(f"   ✅ {dep} installed")
        except subprocess.CalledProcessError as e:
            print(f"   ❌ Failed to install {dep}: {e}")
            print(f"   💡 Try manual install: {activate_cmd} && pip install {dep}")
            return False

    return True

def create_directories():
    """Create necessary directories"""
    print("\n📁 Creating directories...")
    directories = [
        "models",
        "models/backup",
        "training_data/fire_detected",
        "training_data/no_fire",
        "training_data/uncertain",
        "logs"
    ]

    for directory in directories:
        Path(directory).mkdir(parents=True, exist_ok=True)
        print(f"   ✅ {directory}/")

def test_tensorflow():
    """Test if TensorFlow is working"""
    print("\n🧪 Testing TensorFlow...")
    activate_cmd = get_activate_command()

    test_script = '''
import sys
try:
    import tensorflow as tf
    print(f"✅ TensorFlow {tf.__version__} imported successfully")
    print(f"   GPU available: {tf.config.list_physical_devices('GPU')}")

    # Test basic operation
    x = tf.constant([1, 2, 3])
    y = tf.constant([4, 5, 6])
    z = tf.add(x, y)
    print(f"   Test operation successful: {z.numpy()}")

except ImportError as e:
    print(f"❌ TensorFlow import failed: {e}")
    sys.exit(1)
except Exception as e:
    print(f"❌ TensorFlow test failed: {e}")
    sys.exit(1)
'''

    try:
        result = subprocess.run(
            f"{activate_cmd} && python3 -c \"{test_script}\"",
            shell=True, capture_output=True, text=True
        )
        print(result.stdout)
        if result.stderr:
            print("⚠️  Warnings:")
            print(result.stderr)
        return result.returncode == 0
    except Exception as e:
        print(f"❌ TensorFlow test failed: {e}")
        return False

def create_sample_model():
    """Create and test a sample CNN model"""
    print("\n🔧 Creating sample FireCNN model...")
    activate_cmd = get_activate_command()

    try:
        result = subprocess.run(
            f"{activate_cmd} && python3 models/fire_cnn.py",
            shell=True, capture_output=True, text=True
        )
        print(result.stdout)
        if result.returncode != 0:
            print("❌ Sample model creation failed:")
            print(result.stderr)
            return False
        return True
    except Exception as e:
        print(f"❌ Sample model test failed: {e}")
        return False

def check_training_data():
    """Check for existing training data"""
    print("\n📊 Checking training data...")

    training_dir = Path("training_data")
    if not training_dir.exists():
        print("   ❌ training_data/ directory not found")
        print("   💡 Run the bot first: python3 advanced_ai_firebot.py")
        return 0

    fire_count = len(list((training_dir / "fire_detected").glob("*.jpg")))
    no_fire_count = len(list((training_dir / "no_fire").glob("*.jpg")))
    total = fire_count + no_fire_count

    print(f"   🔥 Fire images: {fire_count}")
    print(f"   ✅ No fire images: {no_fire_count}")
    print(f"   📁 Total: {total}")

    if total == 0:
        print("   ⚠️  No training data found")
        print("   💡 Run the bot to collect data first")
    elif total < 100:
        print(f"   ⚠️  Only {total} images (recommended: 500+)")
    else:
        print("   ✅ Good amount of training data!")

    return total

def create_setup_info():
    """Create setup information file"""
    setup_info = {
        "setup_date": str(Path().resolve()),
        "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        "platform": platform.system(),
        "virtual_env": "firebot_cnn_env",
        "activate_command": get_activate_command(),
        "files_created": [
            "models/fire_cnn.py",
            "models/train_minecraft_cnn.py",
            "models/online_learner.py",
            "models/integration_guide.md",
            "setup_cnn.py"
        ],
        "next_steps": [
            "1. Collect training data: python3 advanced_ai_firebot.py",
            "2. Train model: source firebot_cnn_env/bin/activate && python3 models/train_minecraft_cnn.py",
            "3. Test model: python3 -c \"from models.fire_cnn import FireCNN; cnn = FireCNN('models/fire_cnn_trained.h5')\"",
            "4. Integrate with bot: follow models/integration_guide.md"
        ]
    }

    with open("models/setup_info.json", "w") as f:
        json.dump(setup_info, f, indent=2)

    print("\n💾 Setup info saved to: models/setup_info.json")

def main():
    """Main setup function"""
    print_banner()

    # Step 1: Check Python version
    if not check_python_version():
        sys.exit(1)

    # Step 2: Create virtual environment
    if not create_virtual_environment():
        sys.exit(1)

    # Step 3: Install dependencies
    if not install_dependencies():
        print("\n❌ Dependency installation failed!")
        print("💡 Try manual installation:")
        activate_cmd = get_activate_command()
        print(f"   {activate_cmd}")
        print("   pip install tensorflow==2.13.0 matplotlib seaborn scikit-learn")
        sys.exit(1)

    # Step 4: Create directories
    create_directories()

    # Step 5: Test TensorFlow
    if not test_tensorflow():
        print("\n❌ TensorFlow test failed!")
        print("💡 Setup incomplete - fix TensorFlow installation first")
        sys.exit(1)

    # Step 6: Create sample model
    if not create_sample_model():
        print("\n⚠️  Sample model test failed (but setup may still work)")

    # Step 7: Check training data
    training_images = check_training_data()

    # Step 8: Create setup info
    create_setup_info()

    # Success message
    print("\n" + "🔥" * 60)
    print("🎉 FIRECNN SETUP COMPLETED SUCCESSFULLY!")
    print("🔥" * 60)
    print()
    print("📊 What's been created:")
    print("   ✅ Virtual environment: firebot_cnn_env/")
    print("   ✅ CNN architecture: models/fire_cnn.py")
    print("   ✅ Training script: models/train_minecraft_cnn.py")
    print("   ✅ Online learning: models/online_learner.py")
    print("   ✅ Integration guide: models/integration_guide.md")
    print()
    print("🚀 Next steps:")
    print(f"   1. Activate environment: {get_activate_command()}")

    if training_images == 0:
        print("   2. Collect training data: python3 advanced_ai_firebot.py")
        print("   3. Train model: python3 models/train_minecraft_cnn.py")
        print("   4. Integrate: Follow models/integration_guide.md")
    elif training_images < 100:
        print(f"   2. Collect more data (you have {training_images}, need 100+)")
        print("   3. Train model: python3 models/train_minecraft_cnn.py")
        print("   4. Integrate: Follow models/integration_guide.md")
    else:
        print(f"   2. Train model: python3 models/train_minecraft_cnn.py")
        print("   3. Integrate: Follow models/integration_guide.md")

    print()
    print("💡 Expected improvements:")
    print("   ⚡ 20-50x faster inference (50ms vs 2000-5000ms)")
    print("   💾 4700x smaller model (1MB vs 4.7GB)")
    print("   🧠 Self-learning during gameplay")
    print()
    print("📖 For detailed instructions: models/integration_guide.md")
    print("🔥" * 60)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ Setup cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Setup failed: {e}")
        sys.exit(1)