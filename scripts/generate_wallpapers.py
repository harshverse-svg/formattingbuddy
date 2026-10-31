import os, math, random
from PIL import Image, ImageDraw, ImageFilter

OUTPUT_DIR = 'd:/autoeditor/assets/wallpapers'
os.makedirs(OUTPUT_DIR, exist_ok=True)

WALLPAPERS = [
    {
        'id': 'mist-mountains',
        'name': 'Mist & Mountains',
        'sky': [(160, 185, 215), (205, 220, 235), (235, 240, 248)],
        'layers': [
            {'y': 0.45, 'color': (140, 160, 185), 'roughness': 80, 'peaks': 5},
            {'y': 0.58, 'color': (95, 120, 150), 'roughness': 110, 'peaks': 7},
            {'y': 0.72, 'color': (55, 75, 105), 'roughness': 140, 'peaks': 9},
            {'y': 0.86, 'color': (30, 45, 70), 'roughness': 160, 'peaks': 12},
        ]
    },
    {
        'id': 'deep-forest',
        'name': 'Deep Forest',
        'sky': [(15, 45, 35), (25, 70, 50), (45, 105, 75)],
        'layers': [
            {'y': 0.40, 'color': (30, 75, 55), 'roughness': 70, 'peaks': 8},
            {'y': 0.55, 'color': (20, 60, 42), 'roughness': 90, 'peaks': 12},
            {'y': 0.70, 'color': (12, 45, 30), 'roughness': 120, 'peaks': 16},
            {'y': 0.85, 'color': (6, 28, 18), 'roughness': 140, 'peaks': 20},
        ]
    },
    {
        'id': 'calm-ocean',
        'name': 'Calm Ocean',
        'sky': [(12, 22, 45), (25, 55, 95), (65, 130, 165)],
        'layers': [
            {'y': 0.55, 'color': (40, 90, 125), 'roughness': 10, 'peaks': 2},
            {'y': 0.65, 'color': (25, 65, 95), 'roughness': 15, 'peaks': 3},
            {'y': 0.78, 'color': (15, 45, 70), 'roughness': 18, 'peaks': 4},
            {'y': 0.90, 'color': (8, 25, 45), 'roughness': 20, 'peaks': 5},
        ]
    },
    {
        'id': 'desert-dune',
        'name': 'Desert Dunes',
        'sky': [(240, 215, 180), (220, 175, 130), (185, 125, 80)],
        'layers': [
            {'y': 0.45, 'color': (210, 145, 85), 'roughness': 50, 'peaks': 3},
            {'y': 0.60, 'color': (180, 110, 55), 'roughness': 80, 'peaks': 4},
            {'y': 0.75, 'color': (140, 75, 30), 'roughness': 100, 'peaks': 5},
            {'y': 0.88, 'color': (95, 45, 15), 'roughness': 120, 'peaks': 6},
        ]
    },
    {
        'id': 'nocturne-aurora',
        'name': 'Nocturne Aurora',
        'sky': [(5, 10, 25), (10, 25, 50), (20, 55, 80)],
        'layers': [
            {'y': 0.35, 'color': (30, 160, 120), 'roughness': 120, 'peaks': 6, 'aurora': True},
            {'y': 0.50, 'color': (40, 180, 150), 'roughness': 100, 'peaks': 5, 'aurora': True},
            {'y': 0.75, 'color': (15, 25, 45), 'roughness': 90, 'peaks': 8},
            {'y': 0.88, 'color': (5, 10, 20), 'roughness': 110, 'peaks': 12},
        ]
    },
    {
        'id': 'architectural-minimal',
        'name': 'Architectural Minimal',
        'sky': [(210, 215, 225), (170, 178, 192), (130, 140, 158)],
        'layers': [
            {'y': 0.45, 'color': (110, 120, 138), 'roughness': 40, 'peaks': 2},
            {'y': 0.60, 'color': (80, 90, 108), 'roughness': 60, 'peaks': 3},
            {'y': 0.75, 'color': (50, 60, 76), 'roughness': 80, 'peaks': 4},
            {'y': 0.90, 'color': (30, 38, 50), 'roughness': 90, 'peaks': 5},
        ]
    },
    {
        'id': 'golden-coast',
        'name': 'Golden Coast',
        'sky': [(255, 220, 160), (245, 140, 100), (180, 60, 80)],
        'layers': [
            {'y': 0.48, 'color': (160, 50, 70), 'roughness': 60, 'peaks': 4},
            {'y': 0.62, 'color': (120, 30, 55), 'roughness': 80, 'peaks': 6},
            {'y': 0.76, 'color': (75, 18, 40), 'roughness': 110, 'peaks': 8},
            {'y': 0.90, 'color': (40, 8, 25), 'roughness': 130, 'peaks': 10},
        ]
    },
    {
        'id': 'paper-texture',
        'name': 'Studio Slate',
        'sky': [(40, 44, 52), (32, 36, 44), (22, 26, 33)],
        'layers': [
            {'y': 0.42, 'color': (35, 40, 48), 'roughness': 25, 'peaks': 3},
            {'y': 0.58, 'color': (28, 32, 40), 'roughness': 35, 'peaks': 4},
            {'y': 0.74, 'color': (20, 24, 30), 'roughness': 45, 'peaks': 5},
            {'y': 0.88, 'color': (14, 16, 22), 'roughness': 55, 'peaks': 6},
        ]
    }
]

def generate_wallpaper(spec):
    W, H = 1920, 1080
    img = Image.new('RGB', (W, H))
    draw = ImageDraw.Draw(img)

    # 1. Sky Gradient (Vertical Interpolation)
    sky_colors = spec['sky']
    for y in range(H):
        t = y / H
        if len(sky_colors) == 2:
            r = int(sky_colors[0][0] * (1 - t) + sky_colors[1][0] * t)
            g = int(sky_colors[0][1] * (1 - t) + sky_colors[1][1] * t)
            b = int(sky_colors[0][2] * (1 - t) + sky_colors[1][2] * t)
        else:
            if t < 0.5:
                sub_t = t * 2.0
                c1, c2 = sky_colors[0], sky_colors[1]
            else:
                sub_t = (t - 0.5) * 2.0
                c1, c2 = sky_colors[1], sky_colors[2]
            r = int(c1[0] * (1 - sub_t) + c2[0] * sub_t)
            g = int(c1[1] * (1 - sub_t) + c2[1] * sub_t)
            b = int(c1[2] * (1 - sub_t) + c2[2] * sub_t)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    # 2. Organic Ridge / Horizon Layers
    random.seed(hash(spec['id']))
    for layer in spec['layers']:
        base_y = int(H * layer['y'])
        roughness = layer.get('roughness', 50)
        peaks = layer.get('peaks', 6)
        color = layer['color']

        # Generate smooth contour with sinusoidal + noise
        points = []
        phase = random.random() * math.pi * 2
        for x in range(0, W + 20, 15):
            angle = (x / W) * math.pi * peaks + phase
            ny = base_y + math.sin(angle) * roughness * 0.7 + math.cos(angle * 2.3) * roughness * 0.3
            points.append((x, ny))

        points.append((W, H))
        points.append((0, H))

        if layer.get('aurora'):
            # Soft glowing ribbon
            aurora_img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            a_draw = ImageDraw.Draw(aurora_img)
            a_draw.polygon(points, fill=(*color, 90))
            aurora_img = aurora_img.filter(ImageFilter.GaussianBlur(radius=35))
            img.paste(aurora_img, (0, 0), mask=aurora_img)
        else:
            draw.polygon(points, fill=color)

    # 3. Soft photographic blur for clean background depth
    img = img.filter(ImageFilter.GaussianBlur(radius=2.5))

    # Save Desktop 1920x1080 (< 250KB)
    desk_path = os.path.join(OUTPUT_DIR, f"{spec['id']}.webp")
    img.save(desk_path, 'WEBP', quality=82, method=6)
    desk_size = os.path.getsize(desk_path)

    # Save Mobile 960x1080 (Centered Crop / Resize)
    mobile_crop = img.crop((480, 0, 1440, 1080))
    mobile_path = os.path.join(OUTPUT_DIR, f"{spec['id']}-mobile.webp")
    mobile_crop.save(mobile_path, 'WEBP', quality=80, method=6)
    mobile_size = os.path.getsize(mobile_path)

    # Save Thumbnail 160x90
    thumb = img.resize((160, 90), Image.Resampling.LANCZOS)
    thumb_path = os.path.join(OUTPUT_DIR, f"{spec['id']}-thumb.webp")
    thumb.save(thumb_path, 'WEBP', quality=75, method=6)
    thumb_size = os.path.getsize(thumb_path)

    print(f"Generated {spec['id']}: desktop={desk_size//1024}KB, mobile={mobile_size//1024}KB, thumb={thumb_size//1024}KB")

for spec in WALLPAPERS:
    generate_wallpaper(spec)
print("All 8 wallpapers generated successfully!")
