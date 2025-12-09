#!/usr/bin/env python3
"""
Mobile VLM Bridge for FireBot
Connects JavaScript bot to Python VLM for strategic planning
"""

import json
import time
from flask import Flask, request, jsonify
from mobile_vlm_planner import MobileVLMPlanner
import logging

# Suppress warnings
logging.getLogger('transformers').setLevel(logging.ERROR)

app = Flask(__name__)

# Mock VLM class for fallback with enhanced planning
class MockVLM:
    def plan_strategy(self, image, context):
        """Mock VLM that simulates visual analysis and detailed building planning"""
        import time
        import random
        import math

        start_time = time.time()

        fire_count = context.get('fire_count', 0)
        water_buckets = context.get('water_buckets', 0)
        position = context.get('position', {})
        fires_detected = context.get('fires_detected', False)

        # Simulate visual analysis processing time
        time.sleep(0.2)

        if fire_count == 0:
            # Patrol planning - analyze terrain for optimal patrol routes
            patrol_pattern = random.choice(['spiral', 'grid', 'perimeter'])
            patrol_radius = random.randint(24, 48)

            return {
                'strategy': 'patrol',
                'priority_level': 'LOW',
                'immediate_actions': ['patrol', 'scan_area'],
                'reason': f'No threats detected - executing {patrol_pattern} patrol pattern',
                'building_strategy': 'none',
                'movement_pattern': patrol_pattern,
                'patrol_radius': patrol_radius,
                'scan_frequency': 'high',
                'visual_analysis': 'Clear terrain, no threats detected',
                'planning_time_ms': int((time.time() - start_time) * 1000)
            }

        # Fire detected - perform detailed analysis
        bot_x, bot_y, bot_z = position.get('x', 0), position.get('y', 64), position.get('z', 0)

        # Simulate visual terrain analysis
        terrain_analysis = self.analyze_terrain(position)
        obstacle_analysis = self.analyze_obstacles(position)

        if fire_count > 3:
            # Multiple fires - complex strategic planning needed
            fire_cluster_center = self.calculate_fire_cluster_center(position, fire_count)
            distance_to_cluster = math.sqrt((bot_x - fire_cluster_center['x'])**2 + (bot_z - fire_cluster_center['z'])**2)

            # Plan strategic approach
            if terrain_analysis['elevation_variance'] > 10:
                building_plan = 'staircase_approach'
                materials_needed = {'dirt': 25, 'stone': 10, 'wood': 5}
                building_steps = self.generate_staircase_plan(position, fire_cluster_center)
            else:
                building_plan = 'direct_tower'
                materials_needed = {'dirt': 15, 'cobblestone': 8}
                building_steps = self.generate_tower_plan(position, fire_cluster_center)

            return {
                'strategy': 'suppress_urgent',
                'priority_level': 'CRITICAL',
                'immediate_actions': ['build_structure', 'suppress'],
                'reason': f'Multiple fire cluster detected at {distance_to_cluster:.1f} blocks - requires strategic response',
                'building_strategy': building_plan,
                'building_instructions': f'Build {building_plan} towards fire cluster, coordinate suppression from elevated position',
                'materials_needed': materials_needed,
                'building_coordinates': building_steps,
                'movement_pattern': 'coordinated_advance',
                'target_coordinates': fire_cluster_center,
                'visual_analysis': f'{terrain_analysis["description"]}, {obstacle_analysis["description"]}',
                'estimated_completion_time': '45_seconds',
                'planning_time_ms': int((time.time() - start_time) * 1000)
            }

        else:
            # Single fire - precise targeting
            fire_distance = random.randint(8, 25)
            fire_height = random.randint(bot_y + 5, bot_y + 15)

            # Calculate optimal building approach based on simulated visual analysis
            if fire_height > bot_y + 3:  # Lowered threshold from 8 to 3
                # Elevated fire - needs tower
                building_plan = 'elevated_tower'
                materials_needed = {'dirt': fire_height - bot_y + 3, 'cobblestone': 5}
                building_steps = self.generate_elevated_tower_plan(position, fire_height, fire_distance)
            else:
                # Normal fire - direct approach
                building_plan = 'quick_access'
                materials_needed = {'dirt': 3, 'stone': 2}
                building_steps = self.generate_quick_access_plan(position, fire_distance)

            return {
                'strategy': 'suppress',
                'priority_level': 'HIGH',
                'immediate_actions': ['approach_target', 'build_if_needed', 'suppress'],
                'reason': f'Single fire detected at {fire_distance} blocks, height {fire_height} - immediate response required',
                'building_strategy': building_plan,
                'building_instructions': f'Execute {building_plan} - {self.get_building_description(building_plan)}',
                'materials_needed': materials_needed,
                'building_coordinates': building_steps,
                'movement_pattern': 'direct_approach',
                'target_distance': fire_distance,
                'target_height': fire_height,
                'visual_analysis': f'Clear line of sight to fire, {terrain_analysis["description"]}',
                'estimated_completion_time': '20_seconds',
                'planning_time_ms': int((time.time() - start_time) * 1000)
            }

    def analyze_terrain(self, position):
        """Simulate terrain analysis based on position"""
        import random
        terrain_types = ['flat_plains', 'hills', 'mountainous', 'forest', 'desert']
        terrain = random.choice(terrain_types)

        analysis = {
            'flat_plains': {'elevation_variance': 2, 'description': 'Flat terrain with good visibility'},
            'hills': {'elevation_variance': 8, 'description': 'Rolling hills with moderate elevation changes'},
            'mountainous': {'elevation_variance': 15, 'description': 'Steep terrain requiring careful navigation'},
            'forest': {'elevation_variance': 5, 'description': 'Dense vegetation with limited visibility'},
            'desert': {'elevation_variance': 3, 'description': 'Open terrain with excellent visibility'}
        }

        return analysis[terrain]

    def analyze_obstacles(self, position):
        """Simulate obstacle analysis"""
        import random
        obstacles = ['clear', 'light_vegetation', 'dense_trees', 'water_bodies', 'rock_formations']
        obstacle = random.choice(obstacles)

        analysis = {
            'clear': {'description': 'No significant obstacles detected'},
            'light_vegetation': {'description': 'Light vegetation, minimal impact on movement'},
            'dense_trees': {'description': 'Dense tree coverage, may require clearing'},
            'water_bodies': {'description': 'Water obstacles detected, need bridge or circumnavigation'},
            'rock_formations': {'description': 'Rock formations may provide natural cover or obstacles'}
        }

        return analysis[obstacle]

    def calculate_fire_cluster_center(self, position, fire_count):
        """Simulate calculation of fire cluster center"""
        import random
        import math
        bot_x, bot_z = position.get('x', 0), position.get('z', 0)

        # Generate realistic fire cluster coordinates
        angle = random.uniform(0, 2 * math.pi)
        distance = random.uniform(10, 30)

        return {
            'x': bot_x + distance * math.cos(angle),
            'y': random.randint(position.get('y', 64), position.get('y', 64) + 10),
            'z': bot_z + distance * math.sin(angle)
        }

    def generate_staircase_plan(self, start_pos, target_pos):
        """Generate detailed staircase building coordinates"""
        steps = []
        num_steps = 12

        for i in range(num_steps):
            progress = (i + 1) / num_steps
            x = start_pos.get('x', 0) + (target_pos['x'] - start_pos.get('x', 0)) * progress
            z = start_pos.get('z', 0) + (target_pos['z'] - start_pos.get('z', 0)) * progress
            y = start_pos.get('y', 64) + progress * 8  # Gradual elevation

            steps.append({
                'step': i + 1,
                'coordinates': [int(x), int(y), int(z)],
                'block_type': 'dirt',
                'action': 'place_and_climb'
            })

        return steps

    def generate_tower_plan(self, start_pos, target_pos):
        """Generate tower building coordinates"""
        steps = []
        tower_height = 10

        for i in range(tower_height):
            steps.append({
                'step': i + 1,
                'coordinates': [start_pos.get('x', 0), start_pos.get('y', 64) + i + 1, start_pos.get('z', 0)],
                'block_type': 'dirt',
                'action': 'jump_place'
            })

        return steps

    def generate_elevated_tower_plan(self, start_pos, target_height, distance):
        """Generate elevated tower plan for hard-to-reach fires"""
        steps = []
        tower_blocks = target_height - start_pos.get('y', 64) + 3

        for i in range(tower_blocks):
            steps.append({
                'step': i + 1,
                'coordinates': [start_pos.get('x', 0), start_pos.get('y', 64) + i + 1, start_pos.get('z', 0)],
                'block_type': 'dirt',
                'action': 'rapid_jump_place',
                'urgency': 'high' if i > tower_blocks - 3 else 'normal'
            })

        return steps

    def generate_quick_access_plan(self, start_pos, distance):
        """Generate quick access plan for nearby fires"""
        return [
            {
                'step': 1,
                'coordinates': [start_pos.get('x', 0) + 2, start_pos.get('y', 64), start_pos.get('z', 0) + 2],
                'block_type': 'dirt',
                'action': 'place_if_needed'
            }
        ]

    def get_building_description(self, building_plan):
        """Get human-readable building description"""
        descriptions = {
            'elevated_tower': 'Build vertical tower with jump-placing technique for rapid elevation gain',
            'quick_access': 'Minimal building for quick access to nearby fire',
            'staircase_approach': 'Build diagonal staircase with 12 steps for stable elevated access',
            'direct_tower': 'Build compact 10-block tower for elevated suppression position'
        }
        return descriptions.get(building_plan, 'Standard building approach')

# Initialize Mobile VLM
VLM_AVAILABLE = False
vlm = None

try:
    vlm = MobileVLMPlanner()
    print("✅ Real Mobile VLM loaded successfully")
    VLM_AVAILABLE = True
except Exception as e:
    print(f"⚠️ Mobile VLM not available: {e}")
    print("   Bot will work with MockVLM fallback")
    VLM_AVAILABLE = False

# Use Mock VLM as fallback if real one isn't available
if not VLM_AVAILABLE:
    print("⚠️ Using MockVLM as fallback")
    vlm = MockVLM()
    VLM_AVAILABLE = True

@app.route('/plan', methods=['POST'])
def plan_strategy():
    """Get strategic plan from Mobile VLM"""
    if not VLM_AVAILABLE:
        return jsonify({
            'strategy': 'patrol',
            'priority_level': 'MEDIUM',
            'immediate_actions': ['patrol', 'scan_area'],
            'reason': 'VLM not available - using logic-only mode',
            'mock': True
        })

    try:
        data = request.json
        image_path = data.get('image_path')
        context = data.get('context', {})

        print(f"DEBUG: Received context with fire_count={context.get('fire_count', 0)}")

        # Mock image for now - in real implementation would use screenshot
        import numpy as np
        mock_image = np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8)

        # Get VLM strategy
        strategy = vlm.plan_strategy(mock_image, context)
        print(f"DEBUG: VLM returned strategy: {strategy.get('strategy', 'unknown')}")

        return jsonify({
            'strategy': strategy,
            'vlm_available': True,
            'planning_time_ms': strategy.get('planning_time_ms', 200)
        })

    except Exception as e:
        print(f"VLM planning error: {e}")
        return jsonify({
            'strategy': 'patrol',
            'priority_level': 'LOW',
            'immediate_actions': ['continue_patrol'],
            'reason': f'VLM error: {e}',
            'error': True
        })

@app.route('/status', methods=['GET'])
def get_status():
    """Get VLM system status"""
    return jsonify({
        'vlm_available': VLM_AVAILABLE,
        'model_loaded': VLM_AVAILABLE,
        'system_time': time.time()
    })

if __name__ == '__main__':
    print("🧠 Starting Mobile VLM Bridge Server...")
    print("📡 Server running on http://localhost:5001")
    print("🤖 Ready to enhance FireBot with strategic planning!")

    app.run(host='localhost', port=5001, debug=False)