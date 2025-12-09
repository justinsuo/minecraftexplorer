"""
Mobile VLM Planner for Strategic Firefighting
Uses Qwen-VL for fast strategic planning (100-300ms)

Combines with CNN for:
- CNN: Instant fire detection (10-50ms)
- VLM: Strategic planning (100-300ms)
- Total: Real-time intelligent response
"""

import torch
import time
import json
from transformers import AutoModelForCausalLM, AutoTokenizer
from qwen_vl_utils import process_vision_info

# Try to import PIL for image processing
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    print("⚠️  PIL not available. Install with: pip install Pillow")

class MobileVLMPlanner:
    """
    Mobile VLM for strategic planning in firefighting scenarios
    Optimized for Jetson deployment and real-time performance
    """

    def __init__(self, model_name="Qwen/Qwen-VL-Chat"):
        print("🧠 Loading Mobile VLM (Qwen-VL)...")

        self.model_name = model_name
        self.model = None
        self.tokenizer = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"

        self._load_model()
        self._setup_prompts()

    def _load_model(self):
        """Load and optimize the VLM model"""
        try:
            # Load with optimizations for mobile/embedded deployment
            self.model = AutoModelForCausalLM.from_pretrained(
                self.model_name,
                torch_dtype=torch.float16,
                device_map="auto",
                load_in_4bit=True,  # Reduces from 7GB to ~2GB
                trust_remote_code=True
            )

            self.tokenizer = AutoTokenizer.from_pretrained(
                self.model_name,
                trust_remote_code=True
            )

            # Enable optimized attention if available
            if hasattr(self.model, 'config'):
                self.model.config.use_cache = True

            print(f"✅ Mobile VLM loaded on {self.device}")
            print(f"   Model size: ~{self._get_model_size():.1f}GB (4-bit quantized)")

        except Exception as e:
            print(f"❌ Failed to load Mobile VLM: {e}")
            print("   Using mock planner for development")
            self._setup_mock_model()

    def _setup_mock_model(self):
        """Setup mock model when VLM is not available"""
        self.mock_mode = True
        print("⚠️  Running in mock mode - install VLM for full functionality")

    def _get_model_size(self):
        """Estimate model size in GB"""
        if self.model is None:
            return 0

        param_count = sum(p.numel() for p in self.model.parameters())
        # 4-bit quantization: ~0.5 bytes per parameter
        return (param_count * 0.5) / (1024**3)

    def _setup_prompts(self):
        """Setup strategic planning prompts"""
        self.system_prompt = """
You are an expert wildfire firefighter AI planning system.
Your mission is to analyze fire scenes and provide optimal strategic plans.

Priorities:
1. Save human lives (rescue people in danger)
2. Suppress active fires (prevent spread)
3. Protect important structures
4. Ensure firefighter safety

Respond with clear, actionable strategies in JSON format.
"""

        self.analysis_prompt = """
Analyze the current scene and provide:

{{
  "priority_level": "CRITICAL|HIGH|MEDIUM|LOW",
  "immediate_actions": ["action1", "action2"],
  "strategic_goals": ["goal1", "goal2"],
  "route_optimization": "brief route description",
  "risk_assessment": "risk level and factors",
  "resource_allocation": "how to use available resources"
}}

Context: {context}
Environment: Minecraft simulation / Real world
"""

    def plan_strategy(self, image, context, max_tokens=256):
        """
        Strategic planning using Mobile VLM (100-300ms)

        Args:
            image: Current camera frame (PIL Image or numpy array)
            context: Dict with sensor data and mission info
            max_tokens: Maximum tokens for VLM response

        Returns:
            dict: Strategic plan
        """
        start_time = time.time()

        if hasattr(self, 'mock_mode'):
            return self._mock_strategy(context)

        try:
            # Prepare context string
            context_str = self._format_context(context)

            # Build messages
            messages = [
                {
                    "role": "system",
                    "content": [{"type": "text", "text": self.system_prompt}],
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "image", "image": image},
                        {
                            "type": "text",
                            "text": self.analysis_prompt.format(context=context_str),
                        },
                    ],
                },
            ]

            # Generate response
            response = self._generate_response(messages, max_tokens)

            # Parse JSON response
            try:
                plan = json.loads(response)
            except json.JSONDecodeError:
                # Fallback: extract strategy from text
                plan = self._parse_text_response(response)

            planning_time = (time.time() - start_time) * 1000
            plan['planning_time_ms'] = planning_time

            print(f"🧠 VLM planning completed in {planning_time:.1f}ms")
            return plan

        except Exception as e:
            print(f"❌ VLM planning failed: {e}")
            return self._emergency_strategy(context)

    def _format_context(self, context):
        """Format context for VLM input"""
        formatted = []

        # Fire information
        if context.get('fire_detected'):
            formatted.append(f"Fire detected with {context.get('fire_confidence', 0):.1%} confidence")

        # Sensor data
        if 'sensor_data' in context:
            sensor = context['sensor_data']
            formatted.append(f"Thermal sensors: {sensor.get('fire_count', 0)} heat signatures")
            formatted.append(f"Position: {sensor.get('position', {})}")

        # Recent action
        if 'last_action' in context:
            formatted.append(f"Last action: {context['last_action']}")

        return " | ".join(formatted) if formatted else "No immediate threats detected"

    def _generate_response(self, messages, max_tokens):
        """Generate response from VLM"""
        # Apply chat template
        text = self.tokenizer.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )

        # Process vision inputs
        image_inputs, video_inputs = process_vision_info(messages)

        # Prepare model inputs
        model_inputs = self.tokenizer(
            [text],
            return_tensors="pt",
            videos=video_inputs,
            images=image_inputs,
        ).to(self.device)

        # Generate response
        with torch.no_grad():
            generated_ids = self.model.generate(
                **model_inputs,
                max_new_tokens=max_tokens,
                do_sample=True,
                temperature=0.7,
                top_p=0.8,
                pad_token_id=self.tokenizer.eos_token_id
            )

        # Extract and decode response
        generated_ids_trimmed = [
            out_ids[len(in_ids):] for in_ids, out_ids in zip(model_inputs.input_ids, generated_ids)
        ]

        response = self.tokenizer.batch_decode(
            generated_ids_trimmed,
            skip_special_tokens=True,
            clean_up_tokenization_spaces=False
        )[0]

        return response

    def _parse_text_response(self, response):
        """Parse strategy from text response when JSON fails"""
        # Simple keyword-based strategy extraction
        strategy = {
            "priority_level": "MEDIUM",
            "immediate_actions": [],
            "strategic_goals": ["Investigate and respond"],
            "route_optimization": "Direct approach",
            "risk_assessment": "Moderate",
            "planning_time_ms": 0
        }

        response_lower = response.lower()

        if any(word in response_lower for word in ["critical", "urgent", "immediate"]):
            strategy["priority_level"] = "CRITICAL"
        elif any(word in response_lower for word in ["high", "danger", "risk"]):
            strategy["priority_level"] = "HIGH"

        if "save" in response_lower or "rescue" in response_lower:
            strategy["immediate_actions"].append("rescue_person")
        if "suppress" in response_lower or "extinguish" in response_lower:
            strategy["immediate_actions"].append("suppress_fire")

        return strategy

    def _mock_strategy(self, context):
        """Mock strategy for development/testing with building coordinates"""
        import random
        import math

        start_time = time.time()

        fire_count = context.get('fire_count', 0)
        water_buckets = context.get('water_buckets', 0)
        position = context.get('position', {})
        fires_detected = context.get('fires_detected', False)

        # Simulate VLM processing time
        time.sleep(0.15)  # 150ms mock delay

        if fire_count == 0:
            # Patrol planning
            patrol_pattern = random.choice(['spiral', 'grid', 'perimeter'])
            return {
                "priority_level": "LOW",
                "immediate_actions": ["patrol", "scan_area"],
                "strategic_goals": ["Search for threats", "Maintain readiness"],
                "route_optimization": f"{patrol_pattern} patrol pattern",
                "risk_assessment": "Low - no immediate threats",
                "resource_allocation": "Conserve resources",
                "planning_time_ms": int((time.time() - start_time) * 1000),
                "mock": True,
                "building_strategy": "none",
                "materials_needed": {},
                "building_coordinates": []
            }

        # Fire detected - enhanced planning with building
        bot_x, bot_y, bot_z = position.get('x', 0), position.get('y', 64), position.get('z', 0)

        if fire_count > 3:
            # Multiple fires - cluster response
            fire_cluster_center = self.calculate_mock_fire_cluster(position, fire_count)
            distance_to_cluster = math.sqrt((bot_x - fire_cluster_center['x'])**2 + (bot_z - fire_cluster_center['z'])**2)

            # Building plan for cluster
            building_steps = self.generate_mock_building_plan(position, fire_cluster_center, 'cluster')

            return {
                "priority_level": "CRITICAL",
                "immediate_actions": ["build_structure", "suppress"],
                "strategic_goals": ["Suppress cluster", "Prevent spread"],
                "route_optimization": "Coordinated advance to cluster",
                "risk_assessment": f"Critical - fire cluster {distance_to_cluster:.1f} blocks away",
                "resource_allocation": "Use water strategically from elevated position",
                "planning_time_ms": int((time.time() - start_time) * 1000),
                "mock": True,
                "building_strategy": "staircase_approach",
                "building_instructions": "Build staircase towards fire cluster for elevated suppression",
                "materials_needed": {"dirt": 25, "stone": 10, "wood": 5},
                "building_coordinates": building_steps,
                "target_coordinates": fire_cluster_center
            }

        else:
            # Single fire - precise response
            fire_distance = random.randint(8, 25)
            fire_height = random.randint(bot_y + 5, bot_y + 15)

            # Determine if building is needed (lowered threshold)
            if fire_height > bot_y + 3:  # Lowered from +8 to +3
                building_plan = 'elevated_tower'
                materials_needed = {'dirt': fire_height - bot_y + 3, 'cobblestone': 5}
                building_steps = self.generate_mock_tower_plan(position, fire_height)
            else:
                building_plan = 'direct_approach'
                materials_needed = {'dirt': 3, 'stone': 2}
                building_steps = self.generate_mock_direct_plan(position, fire_distance)

            return {
                "priority_level": "HIGH",
                "immediate_actions": ["approach_target", "build_if_needed", "suppress"],
                "strategic_goals": ["Extinguish fire", "Ensure safety"],
                "route_optimization": "Direct approach with tactical building",
                "risk_assessment": f"High - single fire at {fire_distance} blocks, height {fire_height}",
                "resource_allocation": "Immediate suppression with building support",
                "planning_time_ms": int((time.time() - start_time) * 1000),
                "mock": True,
                "building_strategy": building_plan,
                "building_instructions": f"Execute {building_plan} for optimal fire suppression",
                "materials_needed": materials_needed,
                "building_coordinates": building_steps,
                "target_distance": fire_distance,
                "target_height": fire_height
            }

    def calculate_mock_fire_cluster(self, position, fire_count):
        """Calculate mock fire cluster center"""
        import random
        import math
        bot_x, bot_z = position.get('x', 0), position.get('z', 0)

        angle = random.uniform(0, 2 * math.pi)
        distance = random.uniform(10, 30)

        return {
            'x': bot_x + distance * math.cos(angle),
            'y': random.randint(int(position.get('y', 64)), int(position.get('y', 64)) + 10),
            'z': bot_z + distance * math.sin(angle)
        }

    def generate_mock_building_plan(self, start_pos, target_pos, plan_type):
        """Generate mock building coordinates"""
        steps = []

        if plan_type == 'cluster':
            # Staircase approach
            for i in range(12):
                progress = (i + 1) / 12
                x = start_pos.get('x', 0) + (target_pos['x'] - start_pos.get('x', 0)) * progress
                z = start_pos.get('z', 0) + (target_pos['z'] - start_pos.get('z', 0)) * progress
                y = start_pos.get('y', 64) + progress * 8

                steps.append({
                    'step': i + 1,
                    'coordinates': [int(x), int(y), int(z)],
                    'block_type': 'dirt',
                    'action': 'place_and_climb'
                })

        return steps

    def generate_mock_tower_plan(self, position, fire_height):
        """Generate mock tower building plan"""
        steps = []
        tower_blocks = fire_height - position.get('y', 64) + 3

        for i in range(min(int(tower_blocks), 15)):  # Cap at 15 steps
            steps.append({
                'step': i + 1,
                'coordinates': [int(position.get('x', 0)), int(position.get('y', 64)) + i + 1, int(position.get('z', 0))],
                'block_type': 'dirt',
                'action': 'jump_place',
                'urgency': 'high' if i > tower_blocks - 3 else 'normal'
            })

        return steps

    def generate_mock_direct_plan(self, position, distance):
        """Generate mock direct approach plan"""
        return [
            {
                'step': 1,
                'coordinates': [position.get('x', 0) + 2, position.get('y', 64), position.get('z', 0) + 2],
                'block_type': 'dirt',
                'action': 'place_if_needed'
            }
        ]

    def _emergency_strategy(self, context):
        """Emergency fallback strategy"""
        return {
            "priority_level": "CRITICAL",
            "immediate_actions": ["patrol", "scan_360"],
            "strategic_goals": ["Safety", "Regain situational awareness"],
            "route_optimization": "Hold position and assess",
            "risk_assessment": "Unknown - system fallback",
            "resource_allocation": "Defensive posture",
            "planning_time_ms": 50,
            "emergency": True
        }


def test_mobile_vlm():
    """Test the Mobile VLM planner"""
    print("🧪 Testing Mobile VLM Planner...")

    try:
        planner = MobileVLMPlanner()

        # Test with mock image
        if PIL_AVAILABLE:
            test_image = Image.new('RGB', (224, 224), color='red')
        else:
            test_image = "mock_image"

        # Test context
        test_context = {
            'fire_detected': True,
            'fire_confidence': 0.9,
            'sensor_data': {
                'fire_count': 3,
                'position': {'x': 100, 'y': 64, 'z': 200}
            },
            'last_action': 'patrol'
        }

        # Test planning
        strategy = planner.plan_strategy(test_image, test_context)

        print("✅ Mobile VLM Planner test successful!")
        print(f"📋 Strategy: {strategy}")

        return planner

    except Exception as e:
        print(f"❌ Mobile VLM test failed: {e}")
        return None


if __name__ == "__main__":
    # Run test
    planner = test_mobile_vlm()

    if planner:
        print("\n🚀 Mobile VLM Planner ready for integration!")
        print("\nUsage in FireBot:")
        print("1. Import: from mobile_vlm_planner import MobileVLMPlanner")
        print("2. Initialize: planner = MobileVLMPlanner()")
        print("3. Plan: strategy = planner.plan_strategy(image, context)")
    else:
        print("\n💡 To install Mobile VLM dependencies:")
        print("   pip install transformers torch")
        print("   pip install qwen-vl-utils")
        print("   pip install Pillow")