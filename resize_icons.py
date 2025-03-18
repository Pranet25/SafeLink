from PIL import Image
import os

def resize_icon(input_path, output_path, size):
    try:
        with Image.open(input_path) as img:
            # Convert to RGBA if not already
            img = img.convert('RGBA')
            # Resize with high-quality resampling
            resized = img.resize((size, size), Image.Resampling.LANCZOS)
            # Save with maximum quality
            resized.save(output_path, 'PNG')
            print(f"Created {output_path} ({size}x{size})")
    except Exception as e:
        print(f"Error creating {output_path}: {str(e)}")

# Original icon path
icon_path = 'icon.png'

if not os.path.exists(icon_path):
    print(f"Error: {icon_path} not found!")
else:
    # Create different sizes
    sizes = {
        16: 'icon16.png',
        48: 'icon48.png',
        128: 'icon128.png'
    }

    for size, output_name in sizes.items():
        resize_icon(icon_path, output_name, size) 