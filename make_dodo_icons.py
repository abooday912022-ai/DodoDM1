import os
import math
from PIL import Image, ImageDraw, ImageFilter

def generate_dodo_art(size=512):
    # High resolution canvas for super-sampling
    scale = 2
    W = size * scale
    H = size * scale
    
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    margin = int(W * 0.05)
    radius = int(W * 0.22)
    
    # Modern dark gradient rounded container
    # Background: Deep tech navy/cyan backdrop
    for y in range(margin, H - margin):
        t = (y - margin) / float(H - 2 * margin)
        # Interpolate between rich slate-navy (#0B132B) and deep cobalt (#1C2541)
        r = int(11 * (1 - t) + 28 * t)
        g = int(19 * (1 - t) + 37 * t)
        b = int(43 * (1 - t) + 65 * t)
        draw.line([(margin, y), (W - margin, y)], fill=(r, g, b, 255))
        
    # Mask to rounded squircle
    mask = Image.new('L', (W, H), 0)
    mdraw = ImageDraw.Draw(mask)
    mdraw.rounded_rectangle([margin, margin, W - margin, H - margin], radius=radius, fill=255)
    
    # Apply mask
    bg = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    bg.paste(img, (0, 0), mask)
    
    bdraw = ImageDraw.Draw(bg)
    
    # Outer neon border
    border_w = int(W * 0.018)
    bdraw.rounded_rectangle([margin, margin, W - margin, H - margin], radius=radius, outline=(0, 210, 255, 230), width=border_w)
    
    cx = W / 2.0
    cy = H / 2.0
    
    # Stylized "D" badge contour on left & top
    arc_w = int(W * 0.04)
    spine_x = int(W * 0.19)
    d_top = int(H * 0.19)
    d_bottom = int(H * 0.81)
    
    # Left vertical spine of 'D'
    bdraw.rounded_rectangle([spine_x, d_top, spine_x + arc_w, d_bottom], radius=int(arc_w/2), fill=(14, 165, 233, 240))
    
    # Right curve of 'D'
    bdraw.arc([spine_x + arc_w//2, d_top, int(W * 0.81), d_bottom], start=-85, end=85, fill=(14, 165, 233, 240), width=arc_w)
    
    # Central High-Speed Download Arrow (Electric Cyan & White)
    shaft_w = int(W * 0.14)
    shaft_top = int(H * 0.22)
    tip_y = int(H * 0.60)
    head_w = int(W * 0.38)
    head_h = int(H * 0.19)
    
    arrow_pts = [
        (cx - shaft_w/2, shaft_top),
        (cx + shaft_w/2, shaft_top),
        (cx + shaft_w/2, tip_y - head_h),
        (cx + head_w/2, tip_y - head_h),
        (cx, tip_y),
        (cx - head_w/2, tip_y - head_h),
        (cx - shaft_w/2, tip_y - head_h),
    ]
    bdraw.polygon(arrow_pts, fill=(0, 230, 255, 255))
    
    # Sleek glossy reflection on arrow top
    hi_pts = [
        (cx - shaft_w/2, shaft_top),
        (cx + shaft_w/2, shaft_top),
        (cx + shaft_w/2, shaft_top + int(H * 0.045)),
        (cx - shaft_w/2, shaft_top + int(H * 0.045)),
    ]
    bdraw.polygon(hi_pts, fill=(255, 255, 255, 255))
    
    # Multi-connection segmented bars (Multi-threaded download indicator)
    bar_y = int(H * 0.67)
    bar_h = int(H * 0.048)
    bar_total_w = int(W * 0.44)
    seg_count = 3
    gap = int(W * 0.02)
    seg_w = (bar_total_w - (seg_count - 1) * gap) // seg_count
    start_x = int(cx - bar_total_w / 2)
    
    colors = [(0, 255, 213, 255), (0, 210, 255, 255), (14, 165, 233, 255)]
    for i in range(seg_count):
        sx = start_x + i * (seg_w + gap)
        bdraw.rounded_rectangle([sx, bar_y, sx + seg_w, bar_y + bar_h], radius=int(bar_h*0.35), fill=colors[i])
        
    # Bottom tray/cradle
    tray_y = int(H * 0.76)
    tray_h = int(H * 0.04)
    tray_w = int(W * 0.48)
    bdraw.rounded_rectangle([int(cx - tray_w/2), tray_y, int(cx + tray_w/2), tray_y + tray_h], radius=int(tray_h*0.4), fill=(255, 255, 255, 230))
    
    # Resize with high quality Lanczos downsampling
    master = bg.resize((size, size), Image.Resampling.LANCZOS)
    return master

def main():
    root = os.path.dirname(os.path.abspath(__file__))
    print(f"Generating DODO DM1 brand icons in: {root}")
    
    master = generate_dodo_art(512)
    master.save(os.path.join(root, "dodo_dm1_logo.png"))
    print("Saved dodo_dm1_logo.png (512x512)")
    
    # Generate crates/app/ui/icon.png (256x256)
    ui_icon = master.resize((256, 256), Image.Resampling.LANCZOS)
    ui_icon.save(os.path.join(root, "crates", "app", "ui", "icon.png"))
    print("Saved crates/app/ui/icon.png (256x256)")
    
    # Generate crates/app/ui/icon-window.png (64x64)
    win_icon = master.resize((64, 64), Image.Resampling.LANCZOS)
    win_icon.save(os.path.join(root, "crates", "app", "ui", "icon-window.png"))
    print("Saved crates/app/ui/icon-window.png (64x64)")
    
    # Generate crates/app/ui/tray32.rgba (32x32 raw RGBA, 4096 bytes)
    tray_img = master.resize((32, 32), Image.Resampling.LANCZOS)
    raw_rgba = tray_img.tobytes()
    assert len(raw_rgba) == 4096, f"Expected 4096 bytes, got {len(raw_rgba)}"
    with open(os.path.join(root, "crates", "app", "ui", "tray32.rgba"), "wb") as f:
        f.write(raw_rgba)
    print("Saved crates/app/ui/tray32.rgba (32x32 raw RGBA, 4096 bytes)")
    
    # Generate crates/app/icon.ico with multiple sizes
    ico_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (24, 24), (16, 16)]
    ico_path = os.path.join(root, "crates", "app", "icon.ico")
    master.save(ico_path, format="ICO", sizes=ico_sizes)
    print("Saved crates/app/icon.ico (256, 128, 64, 48, 32, 24, 16)")
    
    # Extension icons
    ext_dir = os.path.join(root, "extension", "icons")
    os.makedirs(ext_dir, exist_ok=True)
    for sz in [16, 32, 48, 128]:
        e_img = master.resize((sz, sz), Image.Resampling.LANCZOS)
        e_img.save(os.path.join(ext_dir, f"icon{sz}.png"))
        print(f"Saved extension/icons/icon{sz}.png ({sz}x{sz})")

if __name__ == "__main__":
    main()
