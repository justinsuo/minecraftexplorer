"""
Online Learning System for FireCNN
Enables continuous improvement during gameplay

Features:
- Replay buffer for experience storage
- Incremental retraining
- Confidence-based learning
- Adaptive threshold adjustment
"""

import os
import json
import time
import numpy as np
from pathlib import Path
from collections import deque
from datetime import datetime, timedelta
import random
import logging

try:
    import tensorflow as tf
    from tensorflow.keras.preprocessing.image import ImageDataGenerator
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False

class OnlineLearner:
    """
    Online learning system that continuously improves the FireCNN
    during gameplay by learning from new experiences
    """

    def __init__(self, cnn_model, replay_buffer_size=1000, learning_threshold=0.3):
        self.cnn_model = cnn_model
        self.replay_buffer_size = replay_buffer_size
        self.learning_threshold = learning_threshold

        # Experience replay buffer
        self.experience_buffer = {
            'fire_detected': deque(maxlen=replay_buffer_size // 2),
            'no_fire': deque(maxlen=replay_buffer_size // 2)
        }

        # Learning statistics
        self.learning_stats = {
            'total_experiences': 0,
            'retraining_sessions': 0,
            'last_retraining': None,
            'confidence_history': [],
            'accuracy_improvement': 0,
            'adaptive_threshold': 0.5
        }

        # Load previous experiences if available
        self.load_experiences()

        print(f"🧠 Online Learning System initialized")
        print(f"   Replay buffer size: {replay_buffer_size}")
        print(f"   Learning threshold: {learning_threshold}")

    def add_experience(self, image, prediction, ground_truth, confidence):
        """
        Add new experience to replay buffer

        Args:
            image: PIL Image or numpy array
            prediction: Model prediction ('fire_detected' or 'no_fire')
            ground_truth: True label ('fire_detected' or 'no_fire')
            confidence: Model confidence score
        """

        # Store experience
        experience = {
            'image': image,
            'prediction': prediction,
            'ground_truth': ground_truth,
            'confidence': confidence,
            'timestamp': datetime.now().isoformat(),
            'was_correct': prediction == ground_truth
        }

        # Add to appropriate buffer
        self.experience_buffer[ground_truth].append(experience)
        self.learning_stats['total_experiences'] += 1
        self.learning_stats['confidence_history'].append(confidence)

        # Check if model needs retraining
        if self.should_retrain():
            self.trigger_retraining()

        return experience

    def should_retrain(self):
        """
        Determine if model should be retrained based on:
        1. Number of new experiences
        2. Recent accuracy
        3. Time since last retraining
        """

        total_experiences = sum(len(buffer) for buffer in self.experience_buffer.values())

        # Need at least 100 new experiences
        if total_experiences < 100:
            return False

        # Check recent accuracy (last 50 experiences)
        recent_experiences = []
        for buffer in self.experience_buffer.values():
            recent_experiences.extend(list(buffer)[-50:])

        if len(recent_experiences) < 50:
            return False

        recent_accuracy = sum(exp['was_correct'] for exp in recent_experiences) / len(recent_experiences)

        # Retrain if accuracy drops below 85%
        if recent_accuracy < 0.85:
            print(f"📉 Accuracy dropped to {recent_accuracy:.1%}, triggering retraining")
            return True

        # Check if enough time has passed (at least 10 minutes)
        if self.learning_stats['last_retraining']:
            last_retrain_time = datetime.fromisoformat(self.learning_stats['last_retraining'])
            if datetime.now() - last_retrain_time < timedelta(minutes=10):
                return False

        # Check if we have significantly more experiences
        if total_experiences > self.learning_stats['total_experiences'] * 1.5:
            print(f"📈 Experience buffer grew 50%, triggering retraining")
            return True

        return False

    def trigger_retraining(self):
        """Trigger incremental model retraining"""

        if not TF_AVAILABLE:
            print("⚠️  TensorFlow not available, skipping retraining")
            return

        print("\n🔄 Triggering incremental retraining...")

        # Prepare training data from replay buffer
        train_images = []
        train_labels = []

        for label, buffer in self.experience_buffer.items():
            for experience in buffer:
                # Only include experiences where model was wrong or uncertain
                if (not experience['was_correct'] or
                    experience['confidence'] < (1 - self.learning_threshold)):

                    train_images.append(experience['image'])
                    train_labels.append(1 if label == 'fire_detected' else 0)

        if len(train_images) < 20:
            print("❌ Insufficient training examples for retraining")
            return

        print(f"🎯 Retraining with {len(train_images)} examples")

        # Convert images to numpy arrays
        X_train = np.array([np.array(img) for img in train_images])
        y_train = np.array(train_labels)

        # Preprocess images
        X_train = tf.image.resize(X_train, (224, 224))
        X_train = X_train / 255.0

        # Data augmentation
        datagen = ImageDataGenerator(
            rotation_range=15,
            width_shift_range=0.1,
            height_shift_range=0.1,
            horizontal_flip=True,
            brightness_range=[0.9, 1.1]
        )

        # Incremental retraining (fewer epochs, lower learning rate)
        original_lr = self.cnn_model.model.optimizer.learning_rate
        self.cnn_model.model.optimizer.learning_rate.assign(original_lr * 0.1)

        # Train for fewer epochs
        history = self.cnn_model.model.fit(
            datagen.flow(X_train, y_train, batch_size=16),
            epochs=3,  # Short retraining
            verbose=1
        )

        # Restore original learning rate
        self.cnn_model.model.optimizer.learning_rate.assign(original_lr)

        # Update statistics
        self.learning_stats['retraining_sessions'] += 1
        self.learning_stats['last_retraining'] = datetime.now().isoformat()

        # Save updated model
        self.cnn_model.save_model("models/fire_cnn_online_trained.h5")

        print("✅ Incremental retraining completed!")
        print(f"   Model saved as: fire_cnn_online_trained.h5")

    def evaluate_batch(self, images, ground_truths):
        """
        Evaluate model on a batch of images and add to experience buffer

        Args:
            images: List of images
            ground_truths: List of true labels

        Returns:
            dict: Evaluation metrics
        """

        correct_predictions = 0
        low_confidence_predictions = 0
        wrong_predictions = 0

        for image, ground_truth in zip(images, ground_truths):
            # Get model prediction
            result = self.cnn_model.predict(image)
            prediction = result['prediction']
            confidence = result['confidence']

            # Add to experience buffer
            experience = self.add_experience(image, prediction, ground_truth, confidence)

            # Track metrics
            if prediction == ground_truth:
                correct_predictions += 1
            else:
                wrong_predictions += 1

            if confidence < (1 - self.learning_threshold):
                low_confidence_predictions += 1

        batch_size = len(images)
        accuracy = correct_predictions / batch_size

        metrics = {
            'accuracy': accuracy,
            'correct': correct_predictions,
            'wrong': wrong_predictions,
            'low_confidence': low_confidence_predictions,
            'batch_size': batch_size
        }

        return metrics

    def adapt_threshold(self, recent_predictions):
        """
        Adaptively adjust confidence threshold based on recent performance

        Args:
            recent_predictions: List of recent prediction results
        """

        if len(recent_predictions) < 20:
            return 0.5  # Default threshold

        # Calculate false positive and false negative rates
        false_positives = 0
        false_negatives = 0
        total = len(recent_predictions)

        for pred in recent_predictions:
            if pred['prediction'] == 'fire_detected' and pred['ground_truth'] == 'no_fire':
                false_positives += 1
            elif pred['prediction'] == 'no_fire' and pred['ground_truth'] == 'fire_detected':
                false_negatives += 1

        fp_rate = false_positives / total
        fn_rate = false_negatives / total

        # Adjust threshold to balance precision and recall
        current_threshold = self.learning_stats['adaptive_threshold']

        if fp_rate > 0.1:  # Too many false positives
            current_threshold = min(0.8, current_threshold + 0.05)
        elif fn_rate > 0.1:  # Too many false negatives
            current_threshold = max(0.2, current_threshold - 0.05)

        self.learning_stats['adaptive_threshold'] = current_threshold

        return current_threshold

    def save_experiences(self):
        """Save experience buffer and learning stats"""
        data = {
            'learning_stats': self.learning_stats,
            'experience_buffer': {
                label: [
                    {
                        'prediction': exp['prediction'],
                        'ground_truth': exp['ground_truth'],
                        'confidence': exp['confidence'],
                        'timestamp': exp['timestamp'],
                        'was_correct': exp['was_correct']
                        # Note: Not saving actual images to save space
                    }
                    for exp in buffer
                ]
                for label, buffer in self.experience_buffer.items()
            }
        }

        with open('models/online_learning_data.json', 'w') as f:
            json.dump(data, f, indent=2)

    def load_experiences(self):
        """Load previous experiences and learning stats"""
        try:
            with open('models/online_learning_data.json', 'r') as f:
                data = json.load(f)

            self.learning_stats = data.get('learning_stats', self.learning_stats)
            print(f"📂 Loaded {self.learning_stats['total_experiences']} previous experiences")

        except FileNotFoundError:
            print("📝 No previous learning data found, starting fresh")

    def get_learning_report(self):
        """Generate a report on learning progress"""
        total_experiences = sum(len(buffer) for buffer in self.experience_buffer.values())

        report = {
            'total_experiences_stored': total_experiences,
            'total_exprocessed': self.learning_stats['total_experiences'],
            'retraining_sessions': self.learning_stats['retraining_sessions'],
            'last_retraining': self.learning_stats['last_retraining'],
            'adaptive_threshold': self.learning_stats['adaptive_threshold']
        }

        if self.learning_stats['confidence_history']:
            avg_confidence = np.mean(self.learning_stats['confidence_history'][-100:])
            report['recent_avg_confidence'] = avg_confidence

        return report


def demo_online_learning():
    """Demonstrate online learning with mock data"""
    print("🧪 Online Learning Demo")

    # Mock CNN model for demonstration
    class MockCNN:
        def predict(self, image):
            # Random prediction for demo
            confidence = np.random.random()
            prediction = 'fire_detected' if confidence > 0.5 else 'no_fire'
            return {
                'prediction': prediction,
                'confidence': max(confidence, 1-confidence),
                'inference_time_ms': 45
            }

    mock_cnn = MockCNN()
    learner = OnlineLearner(mock_cnn)

    # Simulate gameplay with random experiences
    print("\n🎮 Simulating gameplay experiences...")
    for i in range(50):
        # Mock image (random noise)
        mock_image = np.random.randint(0, 255, (224, 224, 3))

        # Get prediction
        result = mock_cnn.predict(mock_image)

        # Random ground truth (for demo)
        ground_truth = np.random.choice(['fire_detected', 'no_fire'])

        # Add experience
        learner.add_experience(
            image=mock_image,
            prediction=result['prediction'],
            ground_truth=ground_truth,
            confidence=result['confidence']
        )

    # Generate report
    report = learner.get_learning_report()
    print(f"\n📊 Learning Report:")
    for key, value in report.items():
        print(f"   {key}: {value}")


if __name__ == "__main__":
    # Run demo
    demo_online_learning()