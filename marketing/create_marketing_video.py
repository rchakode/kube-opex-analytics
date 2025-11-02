#!/usr/bin/env python3
"""
Create a marketing video from screenshots
"""
import cv2
import numpy as np
from pathlib import Path
import re

# Configuration
SCREENSHOTS_DIR = Path("/home/redhat/kube-opex-analytics/screenshots/marketing/")
OUTPUT_VIDEO = Path("/home/redhat/kube-opex-analytics/screenshots/marketing/kube-opex-analytics-demo.mp4")
FPS = 30
DURATION_PER_SLIDE = 1  # seconds
TRANSITION_DURATION = 0.5  # seconds
TARGET_WIDTH = 1920
TARGET_HEIGHT = 1080

# Text overlays for each screenshot
SLIDE_TITLES = {
    "01-dashboard-light-theme.png": "Complete Usage Visibility Into Your Kubernetes Cluster",
    "01b-dashboard-monthly-usage-light.png": "Track Usage Across Hourly, Daily & Monthly Periods",
    #"01c-dashboard-heatmap-light.png": "Resource Utilization Heatmap",
    #"01d-dashboard-usage-trends-tooltip-light.png": "Interactive Usage Trends",
    "02-dashboard-dark-theme.png": "Dashboard Overview - Dark Theme",
    #"02b-dashboard-monthly-usage-dark.png": "Monthly Usage - Dark Theme",
    #"02c-dashboard-heatmap-dark.png": "Heatmap - Dark Theme",
    "03-usage-trends-charts.png": "Identify Trends & Forecast Future Resource Needss",
    "04-usage-efficiency-view.png": "Optimize Resource Request Efficiency & Reduce Waste",
    "05-daily-usage-accounting.png": "Transparent Daily Cost Tracking",
    "06-monthly-usage-accounting.png": "Monthly Reports for Chargeback & Budget Planning",
    "07-node-cpu-heatmap.png": "Heatmap to Visualize Node Utilization at a Glance",
    #"08-node-memory-heatmap.png": "Node Memory Heatmap",
    "09-node-cpu-pods-usage.png": "Understand Workload Distribution Across Nodes",
    "10-heatmap-tooltip-demo.png": "Tooltips to Drill Down Into Detailed Metrics on Demands",
    #"11-heatmap-dark-theme.png": "Heatmap Dark Theme",
    #"12-full-dashboard-dark.png": "Deep Insights Into Node Configurations & Capacity",
    "13-node-detail-popup-light.png": "Insights Into Node Configurations & Capacity",
    #"14-node-detail-popup-dark.png": "Node Details - Dark Theme",
    "15-export-menu-feature.png": "Export Data (PNG, CSV, JSON) for Custom AI & Analytics Workflows",
}


def natural_sort_key(s):
    """Sort filenames naturally (1, 2, 10 instead of 1, 10, 2)"""
    return [int(text) if text.isdigit() else text.lower()
            for text in re.split('([0-9]+)', str(s))]


def resize_and_pad(image, target_width, target_height):
    """Resize image to fit within target dimensions while maintaining aspect ratio, then pad"""
    height, width = image.shape[:2]

    # Calculate scaling factor
    scale = min(target_width / width, target_height / height)
    new_width = int(width * scale)
    new_height = int(height * scale)

    # Resize image
    resized = cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_AREA)

    # Create black canvas and paste resized image in center
    canvas = np.zeros((target_height, target_width, 3), dtype=np.uint8)
    y_offset = (target_height - new_height) // 2
    x_offset = (target_width - new_width) // 2
    canvas[y_offset:y_offset+new_height, x_offset:x_offset+new_width] = resized

    return canvas


def add_text_overlay(image, text, position='bottom'):
    """Add text overlay to image"""
    img_copy = image.copy()
    height, width = img_copy.shape[:2]

    # Configure text properties
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 1.2
    font_thickness = 2
    text_color = (255, 255, 255)
    bg_color = (0, 0, 0)

    # Get text size
    (text_width, text_height), baseline = cv2.getTextSize(text, font, font_scale, font_thickness)

    # Position text
    if position == 'bottom':
        text_x = (width - text_width) // 2
        text_y = height - 60
        bg_y1 = height - 100
        bg_y2 = height - 20
    else:  # top
        text_x = (width - text_width) // 2
        text_y = 60
        bg_y1 = 20
        bg_y2 = 100

    # Draw semi-transparent background
    overlay = img_copy.copy()
    cv2.rectangle(overlay, (0, bg_y1), (width, bg_y2), bg_color, -1)
    cv2.addWeighted(overlay, 0.7, img_copy, 0.3, 0, img_copy)

    # Draw text
    cv2.putText(img_copy, text, (text_x, text_y), font, font_scale, text_color, font_thickness, cv2.LINE_AA)

    return img_copy


def create_fade_transition(img1, img2, num_frames):
    """Create a fade transition between two images"""
    frames = []
    for i in range(num_frames):
        alpha = i / num_frames
        frame = cv2.addWeighted(img1, 1 - alpha, img2, alpha, 0)
        frames.append(frame)
    return frames


def create_intro_frame(width, height):
    """Create an intro frame with project title"""
    frame = np.zeros((height, width, 3), dtype=np.uint8)

    # Add title
    title = "Kube Opex Analytics"
    subtitle = "Kubernetes Resource Usage & Cost Analytics"

    font = cv2.FONT_HERSHEY_SIMPLEX

    # Main title
    title_scale = 2.5
    title_thickness = 3
    (title_width, title_height), _ = cv2.getTextSize(title, font, title_scale, title_thickness)
    title_x = (width - title_width) // 2
    title_y = height // 2 - 50
    cv2.putText(frame, title, (title_x, title_y), font, title_scale, (52, 152, 219), title_thickness, cv2.LINE_AA)

    # Subtitle
    subtitle_scale = 1.2
    subtitle_thickness = 2
    (subtitle_width, subtitle_height), _ = cv2.getTextSize(subtitle, font, subtitle_scale, subtitle_thickness)
    subtitle_x = (width - subtitle_width) // 2
    subtitle_y = height // 2 + 50
    cv2.putText(frame, subtitle, (subtitle_x, subtitle_y), font, subtitle_scale, (149, 165, 166), subtitle_thickness, cv2.LINE_AA)

    return frame


def create_outro_frame(width, height):
    """Create an outro frame with project info"""
    frame = np.zeros((height, width, 3), dtype=np.uint8)

    font = cv2.FONT_HERSHEY_SIMPLEX

    # Main message
    message = "github.com/rchakode/kube-opex-analytics"
    msg_scale = 1.5
    msg_thickness = 2
    (msg_width, msg_height), _ = cv2.getTextSize(message, font, msg_scale, msg_thickness)
    msg_x = (width - msg_width) // 2
    msg_y = height // 2
    cv2.putText(frame, message, (msg_x, msg_y), font, msg_scale, (52, 152, 219), msg_thickness, cv2.LINE_AA)

    return frame


def main():
    print(f"Creating marketing video from screenshots in {SCREENSHOTS_DIR}")

    # Get all PNG files sorted naturally
    image_files = sorted(SCREENSHOTS_DIR.glob("*.png"), key=natural_sort_key)

    if not image_files:
        print("No PNG files found in the directory!")
        return

    print(f"Found {len(image_files)} screenshots")

    # Initialize video writer
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(str(OUTPUT_VIDEO), fourcc, FPS, (TARGET_WIDTH, TARGET_HEIGHT))

    if not out.isOpened():
        print("Error: Could not open video writer!")
        return

    # Calculate frame counts
    frames_per_slide = int(FPS * DURATION_PER_SLIDE)
    transition_frames = int(FPS * TRANSITION_DURATION)

    # Add intro
    print("Adding intro...")
    intro_frame = create_intro_frame(TARGET_WIDTH, TARGET_HEIGHT)
    for _ in range(frames_per_slide):
        out.write(intro_frame)

    # Process each image
    previous_frame = intro_frame

    for idx, img_path in enumerate(image_files):
        print(f"Processing {img_path.name} ({idx+1}/{len(image_files)})")

        # Load and process image
        img = cv2.imread(str(img_path))
        if img is None:
            print(f"Warning: Could not load {img_path.name}")
            continue

        # Resize and pad
        img = resize_and_pad(img, TARGET_WIDTH, TARGET_HEIGHT)

        # Add text overlay if we have a title for this slide
        title = SLIDE_TITLES.get(img_path.name, "")
        if title:
            img = add_text_overlay(img, title)

        # Add transition from previous frame
        transition = create_fade_transition(previous_frame, img, transition_frames)
        for frame in transition:
            out.write(frame)

        # Hold on the image
        for _ in range(frames_per_slide):
            out.write(img)

        previous_frame = img

    # Add outro
    print("Adding outro...")
    outro_frame = create_outro_frame(TARGET_WIDTH, TARGET_HEIGHT)
    transition = create_fade_transition(previous_frame, outro_frame, transition_frames)
    for frame in transition:
        out.write(frame)
    for _ in range(frames_per_slide * 2):  # Hold outro longer
        out.write(outro_frame)

    # Release video writer
    out.release()

    print(f"\n✓ Video created successfully: {OUTPUT_VIDEO}")
    print(f"  Duration: ~{len(image_files) * (DURATION_PER_SLIDE + TRANSITION_DURATION) + 9} seconds")
    print(f"  Resolution: {TARGET_WIDTH}x{TARGET_HEIGHT}")
    print(f"  Frame rate: {FPS} FPS")


if __name__ == "__main__":
    main()
